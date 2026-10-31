// «Et veig» al servidor. Reaprofita els càlculs de src/domain (els mateixos que el prototip),
// però els permisos, el llindar i el model de confidencialitat s'apliquen aquí.
import { randomUUID } from 'node:crypto'
import {
  buildCenterView,
  buildTeacherReport,
  eligibleStudents,
  encodeAnswers,
  flagComment,
  groupKey,
  missingItems,
  stableShuffle,
  stageOfGrade,
  stagesOfTeacher,
  teachersForStudent,
  type FeedbackData,
} from '../src/domain/feedback'
import type {
  Answers,
  FeedbackAnswer,
  FeedbackCampaign,
  FeedbackComment,
  FeedbackForm,
  FeedbackStatus,
  GradeId,
  GradeSubject,
  ModerationStatus,
  Participation,
  Scale,
  SelfAssessment,
  StaffMember,
  StageId,
  Student,
  Subject,
  TeachingAssignment,
} from '../src/domain/types'
import { GRADES } from '../src/domain/catalog'
import type { Actor } from './auth'
import { open, seal } from './crypto'
import type { Db, Queryable } from './db'
import { conflict, forbidden, invalid, notFound } from './errors'

export interface Ctx {
  db: Db
  key: Buffer
  yearId: string
}

export const STATUS_FLOW: FeedbackStatus[] = ['ESBORRANY', 'PROGRAMADA', 'OBERTA', 'TANCADA', 'MODERACIO', 'INFORMES_GENERATS', 'PUBLICADA', 'ARXIVADA']
export const RESULTS_DIRECTION: FeedbackStatus[] = ['INFORMES_GENERATS', 'PUBLICADA', 'ARXIVADA']
export const RESULTS_TEACHER: FeedbackStatus[] = ['PUBLICADA', 'ARXIVADA']

const isDirection = (a: Actor) => a.roles.has('direction')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const day = (col: string) => `to_char(${col}, 'YYYY-MM-DD')`

// ---------- Càrrega de dades amb la forma del domini ----------

interface Loaded {
  data: FeedbackData
  scales: Scale[]
  idByEmail: Map<string, string>
}

/**
 * Què cal carregar. Sense `campaignId` es carreguen totes les recollides del curs; amb `results: false`
 * no es llegeixen respostes, comentaris ni autoavaluacions; amb `studentId`, només aquest alumne.
 */
interface Scope {
  campaignId?: string
  studentId?: string
  results?: boolean
}

async function load(q: Queryable, yearId: string, scope: Scope = {}): Promise<Loaded> {
  const { campaignId, studentId, results = true } = scope
  if (campaignId && !UUID.test(campaignId)) throw notFound()
  // Les consultes van en paral·lel: amb una base de dades remota, el temps el marca la latència.
  const byCampaign = (sql: string) => (campaignId ? `${sql} where campaign_id = $1` : sql)
  const cParams = campaignId ? [campaignId] : []
  const none = Promise.resolve({ rows: [] as never[] })
  const [staffRes, studentRes, subjectRes, gradeSubjectRes, scaleRes, formRes, campaignRes, answerRes, commentRes, selfRes, partRes] = await Promise.all([
    q.query<{ id: string; email: string; name: string; roles: string[] }>(
      `select u.id, lower(u.email) as email, u.display_name as name, array_agg(r.role) as roles
         from users u join user_roles r on r.user_id = u.id where u.active group by u.id`,
    ),
    q.query<{ id: string; name: string; surname: string; email: string; grade_id: GradeId; label: string; electives: string[] | null }>(
      `select s.id, s.given_name as name, s.family_name as surname, lower(s.school_email) as email, g.grade_id, g.label,
              array_remove(array_agg(ss.subject_id), null) as electives
         from students s join enrollments e on e.student_id = s.id and e.active
         join class_groups g on g.id = e.group_id and g.year_id = $1
         left join student_subjects ss on ss.enrollment_id = e.id
        where s.active ${studentId ? 'and s.id = $2' : ''} group by s.id, g.grade_id, g.label`,
      studentId ? [yearId, studentId] : [yearId],
    ),
    q.query<{ id: string; short_name: string; long_name: string; hue: number; active: boolean }>('select * from subjects'),
    q.query<{ grade_id: GradeId; subject_id: string; sort: number; optional: boolean; active: boolean }>('select * from grade_subjects where year_id = $1', [yearId]),
    q.query<{ id: string; name: string; na_label: string; options: Scale['options'] }>('select * from feedback_scales'),
    q.query<{ id: string; template_id: string; stage: StageId; version: number; status: 'draft' | 'published'; scale_id: string; definition: Pick<FeedbackForm, 'dimensions' | 'items' | 'open'> }>('select * from feedback_forms'),
    q.query<{ id: string; year_id: string; label: string; stages: StageId[]; start: string; end: string; status: FeedbackStatus; form_ids: FeedbackCampaign['formIds']; assignments: TeachingAssignment[] | null; teacher_ids: string[] | null }>(
      `select id, year_id, label, stages, ${day('starts_on')} as start, ${day('ends_on')} as "end", status, form_ids, assignments, teacher_ids from feedback_campaigns ${campaignId ? 'where id = $1' : ''}`,
      cParams,
    ),
    results
      ? q.query<{ id: string; campaign_id: string; form_id: string; teacher_id: string; stage: StageId; grade_id: GradeId; group_label: string; day: string; v: string }>(
          byCampaign(`select id, campaign_id, form_id, teacher_id, stage, grade_id, group_label, ${day('day')} as day, v from feedback_answers`),
          cParams,
        )
      : none,
    results
      ? q.query<{ id: string; campaign_id: string; teacher_id: string; stage: StageId; question_id: string; original: string; published: string | null; status: ModerationStatus; flags: string[] }>(byCampaign('select * from feedback_comments'), cParams)
      : none,
    results
      ? q.query<{ campaign_id: string; teacher_id: string; stage: StageId; answers: Answers; context: Record<string, string[]>; updated_at: Date; submitted_at: Date | null }>(byCampaign('select * from teacher_self_assessments'), cParams)
      : none,
    // Només per comptar la participació: el servidor no exposa mai aquesta llista.
    q.query<{ campaign_id: string; student_id: string; teacher_id: string }>(
      studentId
        ? `select campaign_id, student_id, teacher_id from feedback_participation where student_id = $1 ${campaignId ? 'and campaign_id = $2' : ''}`
        : byCampaign('select campaign_id, student_id, teacher_id from feedback_participation'),
      studentId ? (campaignId ? [studentId, campaignId] : [studentId]) : cParams,
    ),
  ])

  const staffRows = staffRes.rows
  const staff: StaffMember[] = staffRows.map((r) => ({ email: r.email, name: r.name, role: r.roles.includes('admin') ? 'admin' : 'teacher', groups: [], direction: r.roles.includes('direction') }))
  const idByEmail = new Map(staffRows.map((r) => [r.email, r.id]))
  const emailById = new Map(staffRows.map((r) => [r.id, r.email]))

  const students: Student[] = studentRes.rows.map((r) => ({ id: r.id, name: r.name, surname: r.surname, email: r.email, gradeId: r.grade_id, group: r.label, electives: r.electives ?? [], guardians: [] }))
  const subjects: Subject[] = subjectRes.rows.map((r) => ({ id: r.id, short: r.short_name, long: r.long_name, hue: r.hue, active: r.active }))
  const gradeSubjects: GradeSubject[] = gradeSubjectRes.rows.map((r) => ({ gradeId: r.grade_id, subjectId: r.subject_id, order: r.sort, optional: r.optional, active: r.active }))
  const scales: Scale[] = scaleRes.rows.map((r) => ({ id: r.id, name: r.name, options: r.options, allowNA: true, naLabel: r.na_label }))
  const feedbackForms: FeedbackForm[] = formRes.rows.map((r) => ({ id: r.id, templateId: r.template_id, stage: r.stage, version: r.version, status: r.status, scaleId: r.scale_id, ...r.definition }))
  const feedbackCampaigns: FeedbackCampaign[] = campaignRes.rows.map((r) => ({
    id: r.id, year: r.year_id, label: r.label, stages: r.stages, start: r.start, end: r.end, status: r.status, formIds: r.form_ids,
    assignments: r.assignments ?? [], teachers: (r.teacher_ids ?? []).map((id) => emailById.get(id) ?? id),
  }))
  const feedbackAnswers: FeedbackAnswer[] = answerRes.rows.map((r) => ({ id: r.id, campaignId: r.campaign_id, formId: r.form_id, teacherEmail: emailById.get(r.teacher_id) ?? '', stage: r.stage, gradeId: r.grade_id, group: r.group_label, day: r.day, v: r.v }))
  const feedbackComments: FeedbackComment[] = commentRes.rows.map((r) => ({ id: r.id, campaignId: r.campaign_id, teacherEmail: emailById.get(r.teacher_id) ?? '', stage: r.stage, questionId: r.question_id, original: r.original, published: r.published ?? undefined, status: r.status, flags: r.flags }))
  const selfAssessments: SelfAssessment[] = selfRes.rows.map((r) => ({ campaignId: r.campaign_id, teacherEmail: emailById.get(r.teacher_id) ?? '', stage: r.stage, answers: r.answers, context: r.context, updatedAt: new Date(r.updated_at).toISOString(), submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : undefined }))
  const participation: Participation[] = partRes.rows.map((r) => ({ campaignId: r.campaign_id, studentId: r.student_id, teacherEmail: emailById.get(r.teacher_id) ?? '', day: '' }))

  return { data: { year: yearId, students, staff, subjects, gradeSubjects, feedbackForms, feedbackCampaigns, feedbackAnswers, feedbackComments, selfAssessments, participation }, scales, idByEmail }
}

async function modules(q: Queryable) {
  const [row] = (await q.query<{ value: { emMiro?: boolean; etVeig?: boolean } }>("select value from app_settings where key = 'modules'")).rows
  return { emMiro: row?.value.emMiro ?? true, etVeig: row?.value.etVeig ?? true }
}

// ---------- Alumnat ----------

function ownTarget(l: Loaded, actor: Actor, campaignId: string, teacherEmail: string) {
  if (!actor.student) throw forbidden('Només l’alumnat pot valorar el professorat.')
  const student = l.data.students.find((s) => s.id === actor.student!.id)
  const campaign = l.data.feedbackCampaigns.find((c) => c.id === campaignId)
  if (!student || !campaign) throw notFound()
  const stage = stageOfGrade(student.gradeId)
  if (campaign.status !== 'OBERTA' || !campaign.stages.includes(stage)) throw forbidden('Aquesta recollida no està oberta per a tu.')
  const form = l.data.feedbackForms.find((f) => f.id === campaign.formIds[stage])
  if (!form) throw notFound()
  const target = teachersForStudent(student, campaign.assignments, l.data.gradeSubjects, l.data.subjects, l.data.staff, campaign.teachers).find((t) => t.email === teacherEmail)
  if (!target) throw forbidden('Aquest docent no et fa classe en aquesta recollida.')
  const teacherId = l.idByEmail.get(teacherEmail)!
  return { student, campaign, stage, form, target, teacherId, aad: `${campaign.id}|${student.id}|${teacherId}` }
}

export async function feedbackHome(ctx: Ctx, actor: Actor) {
  if (!actor.student) throw forbidden()
  if (!(await modules(ctx.db)).etVeig) return null
  const l = await load(ctx.db, ctx.yearId, { studentId: actor.student.id, results: false })
  const student = l.data.students.find((s) => s.id === actor.student!.id)
  if (!student) return null
  const stage = stageOfGrade(student.gradeId)
  const campaign = l.data.feedbackCampaigns.find((c) => c.status === 'OBERTA' && c.stages.includes(stage))
  const form = campaign && l.data.feedbackForms.find((f) => f.id === campaign.formIds[stage])
  if (!campaign || !form) return null
  const done = new Set(l.data.participation.filter((p) => p.campaignId === campaign.id && p.studentId === student.id).map((p) => p.teacherEmail))
  const drafts = (await ctx.db.query<{ teacher_id: string; payload: Uint8Array }>('select teacher_id, payload from feedback_drafts where campaign_id = $1 and student_id = $2', [campaign.id, student.id])).rows
  const targets = stableShuffle(teachersForStudent(student, campaign.assignments, l.data.gradeSubjects, l.data.subjects, l.data.staff, campaign.teachers), `${campaign.id}:${student.id}`).map((t) => {
    const teacherId = l.idByEmail.get(t.email)!
    const d = done.has(t.email) ? undefined : drafts.find((x) => x.teacher_id === teacherId)
    return { ...t, status: done.has(t.email) ? 'lliurat' : d ? 'esborrany' : 'pendent', draft: d ? open<Answers>(ctx.key, d.payload, `${campaign.id}|${student.id}|${teacherId}`) : undefined }
  })
  return { campaign: { id: campaign.id, label: campaign.label, end: campaign.end }, stage, form, scale: l.scales.find((s) => s.id === form.scaleId)!, targets }
}

export async function saveFeedbackDraft(ctx: Ctx, actor: Actor, campaignId: string, teacherEmail: string, answers: Answers) {
  const t = ownTarget(await load(ctx.db, ctx.yearId, { campaignId, studentId: actor.student?.id, results: false }), actor, campaignId, teacherEmail)
  const [done] = (await ctx.db.query('select 1 from feedback_participation where campaign_id = $1 and student_id = $2 and teacher_id = $3', [campaignId, t.student.id, t.teacherId])).rows
  if (done) throw conflict('Aquesta valoració ja està lliurada i no es pot modificar.')
  await ctx.db.query(
    `insert into feedback_drafts (campaign_id, student_id, teacher_id, payload) values ($1, $2, $3, $4)
     on conflict (campaign_id, student_id, teacher_id) do update set payload = excluded.payload, updated_at = now()`,
    [campaignId, t.student.id, t.teacherId, seal(ctx.key, answers, t.aad)],
  )
}

/**
 * Lliurament (pla mestre §5.7): en una sola transacció s'anota la participació (sense respostes),
 * es desen les respostes sense cap identificador d'alumne i s'esborra l'esborrany.
 */
export async function submitFeedback(ctx: Ctx, actor: Actor, campaignId: string, teacherEmail: string, answers: Answers) {
  // Tot l'alumnat: els noms serveixen per marcar els comentaris que n'esmenten algun.
  const l = await load(ctx.db, ctx.yearId, { campaignId, results: false })
  const t = ownTarget(l, actor, campaignId, teacherEmail)
  if (missingItems(t.form, answers).length) throw invalid('Encara hi ha afirmacions per respondre.')
  const names = [...new Set([...l.data.students.map((x) => x.name), ...l.data.staff.map((x) => x.name.split(' ')[0])])]
  await ctx.db.tx(async (q) => {
    const inserted = (
      await q.query(
        `insert into feedback_participation (campaign_id, student_id, teacher_id, stage, grade_id, group_label) values ($1, $2, $3, $4, $5, $6)
         on conflict do nothing returning 1`,
        [campaignId, t.student.id, t.teacherId, t.stage, t.student.gradeId, t.student.group],
      )
    ).rows
    if (!inserted.length) throw conflict('Ja has lliurat la valoració d’aquest docent.')
    await q.query('insert into feedback_answers (id, campaign_id, form_id, teacher_id, stage, grade_id, group_label, day, v) values ($1, $2, $3, $4, $5, $6, $7, current_date, $8)', [
      randomUUID(), campaignId, t.form.id, t.teacherId, t.stage, t.student.gradeId, t.student.group, encodeAnswers(t.form, answers),
    ])
    for (const qn of t.form.open) {
      const text = answers[qn.id]?.trim()
      if (!text) continue
      await q.query('insert into feedback_comments (id, campaign_id, teacher_id, stage, question_id, original, flags) values ($1, $2, $3, $4, $5, $6, $7)', [
        randomUUID(), campaignId, t.teacherId, t.stage, qn.id, text.slice(0, qn.maxLength), flagComment(text, names),
      ])
    }
    await q.query('delete from feedback_drafts where campaign_id = $1 and student_id = $2 and teacher_id = $3', [campaignId, t.student.id, t.teacherId])
  })
}

// ---------- Professorat ----------

export async function saveSelfAssessment(ctx: Ctx, actor: Actor, campaignId: string, stage: StageId, answers: Answers, context: Record<string, string[]>, submit: boolean) {
  const l = await load(ctx.db, ctx.yearId, { campaignId })
  const c = l.data.feedbackCampaigns.find((x) => x.id === campaignId)
  if (!c || !stagesOfTeacher(c, actor.email).includes(stage)) throw forbidden('Aquesta autoavaluació no et correspon.')
  if (!['OBERTA', 'TANCADA'].includes(c.status)) throw forbidden('L’autoavaluació d’aquesta recollida ja està tancada.')
  const prev = l.data.selfAssessments.find((x) => x.campaignId === campaignId && x.teacherEmail === actor.email && x.stage === stage)
  if (prev?.submittedAt) throw conflict('Ja has lliurat aquesta autoavaluació.')
  const form = l.data.feedbackForms.find((f) => f.id === c.formIds[stage])!
  if (submit && missingItems(form, answers).length) throw invalid('Encara hi ha afirmacions per respondre.')
  await ctx.db.query(
    `insert into teacher_self_assessments (campaign_id, teacher_id, stage, answers, context, submitted_at) values ($1, $2, $3, $4, $5, $6)
     on conflict (campaign_id, teacher_id, stage) do update set answers = excluded.answers, context = excluded.context, updated_at = now(), submitted_at = excluded.submitted_at`,
    [campaignId, actor.userId, stage, JSON.stringify(answers), JSON.stringify(context), submit ? new Date() : null],
  )
}

/** Autoavaluacions que pot fer ara aquest docent: una per recollida oberta o tancada i etapa on fa classe. */
export async function selfTasks(ctx: Ctx, actor: Actor) {
  if (actor.student || !actor.roles.size) throw forbidden()
  const l = await load(ctx.db, ctx.yearId, { results: false })
  const open = l.data.feedbackCampaigns.filter((c) => c.year === ctx.yearId && ['OBERTA', 'TANCADA'].includes(c.status) && c.teachers.includes(actor.email))
  if (!open.length) return []
  const own = (
    await ctx.db.query<{ campaign_id: string; stage: StageId; answers: Answers; context: Record<string, string[]>; submitted_at: Date | null }>(
      'select campaign_id, stage, answers, context, submitted_at from teacher_self_assessments where teacher_id = $1 and campaign_id = any($2)',
      [actor.userId, open.map((c) => c.id)],
    )
  ).rows
  return open.flatMap((c) =>
    stagesOfTeacher(c, actor.email).map((stage) => {
      const form = l.data.feedbackForms.find((f) => f.id === c.formIds[stage])!
      const self = own.find((x) => x.campaign_id === c.id && x.stage === stage)
      return {
        campaign: { id: c.id, label: c.label, year: c.year, status: c.status, end: c.end },
        stage,
        form,
        scale: l.scales.find((x) => x.id === form.scaleId)!,
        groups: [...new Set(c.assignments.filter((a) => a.teacherEmail === actor.email && stageOfGrade(a.gradeId) === stage).map((a) => groupKey(a.gradeId, a.group)))],
        self: self && { answers: self.answers, context: self.context, submittedAt: self.submitted_at ? new Date(self.submitted_at).toISOString() : undefined },
      }
    }),
  )
}

export async function teacherReport(ctx: Ctx, actor: Actor, campaignId: string, teacherEmail: string) {
  const l = await load(ctx.db, ctx.yearId, { campaignId })
  const c = l.data.feedbackCampaigns.find((x) => x.id === campaignId)
  if (!c) throw notFound()
  const allowed = isDirection(actor) ? RESULTS_DIRECTION.includes(c.status) : actor.email === teacherEmail && RESULTS_TEACHER.includes(c.status)
  if (!allowed) throw forbidden('No tens permís per veure aquest informe.')
  const report = buildTeacherReport(l.data, l.scales, campaignId, teacherEmail)
  if (!report) throw notFound()
  if (actor.email !== teacherEmail) {
    await ctx.db.query("insert into feedback_report_views (campaign_id, teacher_id, viewer_id, action) values ($1, $2, $3, 'Consulta')", [campaignId, l.idByEmail.get(teacherEmail), actor.userId])
  }
  return report
}

export async function centerView(ctx: Ctx, actor: Actor, campaignId: string) {
  const l = await load(ctx.db, ctx.yearId, { campaignId })
  const c = l.data.feedbackCampaigns.find((x) => x.id === campaignId)
  if (!c) throw notFound()
  if (!isDirection(actor) || !RESULTS_DIRECTION.includes(c.status)) throw forbidden('Només l’Equip Directiu pot veure la visió de centre.')
  const counts = (await ctx.db.query<{ grade_id: GradeId; students: number; participants: number }>('select grade_id, students, participants from feedback_participation_counts where campaign_id = $1', [campaignId])).rows
  return buildCenterView(l.data, l.scales, campaignId).map((v) => {
    const rows = counts.filter((r) => stageOfGrade(r.grade_id) === v.stage)
    return rows.length ? { ...v, students: sum(rows.map((r) => r.students)), participants: sum(rows.map((r) => r.participants)) } : v
  })
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + Number(b), 0)

/**
 * Seguiment del professorat d'una recollida: valoracions rebudes (només el recompte) i autoavaluació lliurada.
 * Per a l'administració i l'Equip Directiu. No diu mai qui ha valorat ni què ha respost.
 */
export async function teacherStatus(ctx: Ctx, actor: Actor, campaignId: string) {
  if (!actor.roles.has('admin') && !isDirection(actor)) throw forbidden()
  const [l, answers, selfs] = await Promise.all([
    load(ctx.db, ctx.yearId, { campaignId, results: false }),
    ctx.db.query<{ teacher_id: string; n: string }>('select teacher_id, count(*) as n from feedback_answers where campaign_id = $1 group by teacher_id', [campaignId]),
    ctx.db.query<{ teacher_id: string; stage: StageId }>('select teacher_id, stage from teacher_self_assessments where campaign_id = $1 and submitted_at is not null', [campaignId]),
  ])
  const c = l.data.feedbackCampaigns.find((x) => x.id === campaignId)
  if (!c) throw notFound()
  const nById = new Map(answers.rows.map((r) => [r.teacher_id, Number(r.n)]))
  return c.teachers
    .map((email) => {
      const id = l.idByEmail.get(email)
      const stages = stagesOfTeacher(c, email)
      return {
        email,
        name: l.data.staff.find((x) => x.email === email)?.name ?? email,
        stages,
        n: (id && nById.get(id)) || 0,
        eligible: stages.reduce((a, st) => a + eligibleStudents(l.data, c, email, st).length, 0),
        selfDone: selfs.rows.filter((r) => r.teacher_id === id && stages.includes(r.stage)).length,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ca'))
}

// ---------- Gestió de les recollides ----------

/** Recollides visibles per al personal, sense assignacions ni cap dada de participació. */
export async function listCampaigns(ctx: Ctx, actor: Actor) {
  if (actor.student || !actor.roles.size) throw forbidden()
  return (
    await ctx.db.query<{ id: string; year: string; label: string; stages: StageId[]; start: string; end: string; status: FeedbackStatus }>(
      `select id, year_id as year, label, stages, ${day('starts_on')} as start, ${day('ends_on')} as "end", status from feedback_campaigns where year_id = $1 order by starts_on desc`,
      [ctx.yearId],
    )
  ).rows
}

/** Comentaris d'una recollida per moderar-los: només l'Equip Directiu. */
export async function listComments(ctx: Ctx, actor: Actor, campaignId: string) {
  if (!isDirection(actor)) throw forbidden('La moderació dels comentaris la fa l’Equip Directiu.')
  return (
    await ctx.db.query<{ id: string; teacherName: string; stage: StageId; questionId: string; original: string; published: string | null; status: ModerationStatus; flags: string[] }>(
      `select c.id, u.display_name as "teacherName", c.stage, c.question_id as "questionId", c.original, c.published, c.status, c.flags
         from feedback_comments c join users u on u.id = c.teacher_id where c.campaign_id = $1 order by u.display_name, c.stage, c.question_id`,
      [campaignId],
    )
  ).rows
}

export async function setFeedbackStatus(ctx: Ctx, actor: Actor, campaignId: string, status: FeedbackStatus) {
  if (!actor.roles.has('admin') && !isDirection(actor)) throw forbidden()
  const l = await load(ctx.db, ctx.yearId, { campaignId })
  const c = l.data.feedbackCampaigns.find((x) => x.id === campaignId)
  if (!c) throw notFound()
  const from = STATUS_FLOW.indexOf(c.status)
  const to = STATUS_FLOW.indexOf(status)
  if (to !== from + 1) throw invalid(`No es pot passar de ${c.status} a ${status}.`)
  if (status === 'INFORMES_GENERATS' && l.data.feedbackComments.some((x) => x.campaignId === campaignId && x.status === 'pendent')) throw conflict('Encara hi ha comentaris pendents de moderar.')
  if (status === 'TANCADA') return close(ctx, actor, campaignId)
  if (status === 'PUBLICADA') {
    // Publicats els informes, ja no cal saber qui ha participat: només en queden els recomptes per grup.
    await ctx.db.tx(async (q) => {
      await q.query('delete from feedback_participation where campaign_id = $1', [campaignId])
      await q.query('update feedback_campaigns set status = $2 where id = $1', [campaignId, status])
      await audit(q, actor, campaignId, status)
    })
    return
  }
  if (status === 'OBERTA') {
    // Les assignacions es congelen en obrir: els canvis posteriors no alteren qui valora qui.
    const assignments = (
      await ctx.db.query<TeachingAssignment>(
        `select lower(u.email) as "teacherEmail", g.grade_id as "gradeId", g.label as "group", a.subject_id as "subjectId"
           from teaching_assignments a join class_groups g on g.id = a.group_id and g.year_id = $1 join users u on u.id = a.teacher_id`,
        [ctx.yearId],
      )
    ).rows.filter((a) => c.stages.includes(stageOfGrade(a.gradeId)))
    const teacherIds = [...new Set(assignments.map((a) => l.idByEmail.get(a.teacherEmail)!))]
    await ctx.db.query('update feedback_campaigns set status = $2, assignments = $3, teacher_ids = $4 where id = $1', [campaignId, status, JSON.stringify(assignments), teacherIds])
  } else {
    await ctx.db.query('update feedback_campaigns set status = $2 where id = $1', [campaignId, status])
  }
  await audit(ctx.db, actor, campaignId, status)
}

const audit = (q: Queryable, actor: Actor, campaignId: string, status: FeedbackStatus) =>
  q.query('insert into audit_log (actor_id, action, detail) values ($1, $2, $3)', [actor.userId, 'Estat de recollida d’Et veig…', JSON.stringify({ campaignId, status })])

/**
 * Tancament: es desen els recomptes de participació per grup i es tornen a escriure les respostes
 * i els comentaris en ordre aleatori, perquè l'ordre d'inserció no es pugui relacionar amb
 * l'ordre de la participació.
 */
async function close(ctx: Ctx, actor: Actor, campaignId: string) {
  await ctx.db.tx(async (q) => {
    await q.query(
      `insert into feedback_participation_counts (campaign_id, grade_id, group_label, students, participants)
       select $1, g.grade_id, g.label, count(distinct e.student_id),
              count(distinct p.student_id)
         from class_groups g join enrollments e on e.group_id = g.id and e.active
         left join feedback_participation p on p.campaign_id = $1 and p.student_id = e.student_id
        where g.year_id = $2 and g.grade_id = any($3)
        group by g.grade_id, g.label
       on conflict (campaign_id, grade_id, group_label) do update set students = excluded.students, participants = excluded.participants`,
      [campaignId, ctx.yearId, (await campaignGrades(q, campaignId))],
    )
    for (const table of ['feedback_answers', 'feedback_comments']) {
      await q.query(`create temp table shuffled on commit drop as select * from ${table} where campaign_id = $1 order by random()`, [campaignId])
      await q.query(`delete from ${table} where campaign_id = $1`, [campaignId])
      await q.query(`insert into ${table} select * from shuffled order by random()`)
      await q.query('drop table shuffled')
    }
    await q.query("update feedback_campaigns set status = 'TANCADA' where id = $1", [campaignId])
    await audit(q, actor, campaignId, 'TANCADA')
  })
}

async function campaignGrades(q: Queryable, campaignId: string): Promise<GradeId[]> {
  const [c] = (await q.query<{ stages: StageId[] }>('select stages from feedback_campaigns where id = $1', [campaignId])).rows
  return GRADES.filter((g) => c.stages.includes(g.stage)).map((g) => g.id)
}

export async function moderateComment(ctx: Ctx, actor: Actor, commentId: string, status: Exclude<ModerationStatus, 'pendent'>, text?: string) {
  if (!isDirection(actor)) throw forbidden('La moderació dels comentaris la fa l’Equip Directiu.')
  const [row] = (await ctx.db.query<{ original: string; status: FeedbackStatus }>('select c.original, k.status from feedback_comments c join feedback_campaigns k on k.id = c.campaign_id where c.id = $1', [commentId])).rows
  if (!row) throw notFound()
  if (row.status !== 'MODERACIO') throw conflict('Els comentaris es moderen quan la recollida és en moderació.')
  if (status === 'editat' && !text?.trim()) throw invalid('Cal el text editat.')
  const published = status === 'acceptat' ? row.original : status === 'editat' ? text!.trim() : null
  await ctx.db.query('update feedback_comments set status = $2, published = $3, moderated_by = $4, moderated_at = now() where id = $1', [commentId, status, published, actor.userId])
}
