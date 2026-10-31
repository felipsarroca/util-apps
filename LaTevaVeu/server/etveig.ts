// «Et veig» al servidor. Reaprofita els càlculs de src/domain (els mateixos que el prototip),
// però els permisos, el llindar i el model de confidencialitat s'apliquen aquí.
import { randomUUID } from 'node:crypto'
import {
  buildCenterView,
  buildTeacherReport,
  encodeAnswers,
  flagComment,
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
const day = (col: string) => `to_char(${col}, 'YYYY-MM-DD')`

// ---------- Càrrega de dades amb la forma del domini ----------

interface Loaded {
  data: FeedbackData
  scales: Scale[]
  idByEmail: Map<string, string>
}

async function load(q: Queryable, yearId: string): Promise<Loaded> {
  const staffRows = (
    await q.query<{ id: string; email: string; name: string; roles: string[] }>(
      `select u.id, lower(u.email) as email, u.display_name as name, array_agg(r.role) as roles
         from users u join user_roles r on r.user_id = u.id where u.active group by u.id`,
    )
  ).rows
  const staff: StaffMember[] = staffRows.map((r) => ({ email: r.email, name: r.name, role: r.roles.includes('admin') ? 'admin' : 'teacher', groups: [], direction: r.roles.includes('direction') }))
  const idByEmail = new Map(staffRows.map((r) => [r.email, r.id]))
  const emailById = new Map(staffRows.map((r) => [r.id, r.email]))

  const students: Student[] = (
    await q.query<{ id: string; name: string; surname: string; email: string; grade_id: GradeId; label: string; electives: string[] | null }>(
      `select s.id, s.given_name as name, s.family_name as surname, lower(s.school_email) as email, g.grade_id, g.label,
              array_remove(array_agg(ss.subject_id), null) as electives
         from students s join enrollments e on e.student_id = s.id and e.active
         join class_groups g on g.id = e.group_id and g.year_id = $1
         left join student_subjects ss on ss.enrollment_id = e.id
        where s.active group by s.id, g.grade_id, g.label`,
      [yearId],
    )
  ).rows.map((r) => ({ id: r.id, name: r.name, surname: r.surname, email: r.email, gradeId: r.grade_id, group: r.label, electives: r.electives ?? [], guardians: [] }))

  const subjects: Subject[] = (await q.query<{ id: string; short_name: string; long_name: string; hue: number; active: boolean }>('select * from subjects')).rows.map((r) => ({ id: r.id, short: r.short_name, long: r.long_name, hue: r.hue, active: r.active }))
  const gradeSubjects: GradeSubject[] = (
    await q.query<{ grade_id: GradeId; subject_id: string; sort: number; optional: boolean; active: boolean }>('select * from grade_subjects where year_id = $1', [yearId])
  ).rows.map((r) => ({ gradeId: r.grade_id, subjectId: r.subject_id, order: r.sort, optional: r.optional, active: r.active }))

  const scales: Scale[] = (await q.query<{ id: string; name: string; na_label: string; options: Scale['options'] }>('select * from feedback_scales')).rows.map((r) => ({
    id: r.id, name: r.name, options: r.options, allowNA: true, naLabel: r.na_label,
  }))
  const feedbackForms: FeedbackForm[] = (
    await q.query<{ id: string; template_id: string; stage: StageId; version: number; status: 'draft' | 'published'; scale_id: string; definition: Pick<FeedbackForm, 'dimensions' | 'items' | 'open'> }>('select * from feedback_forms')
  ).rows.map((r) => ({ id: r.id, templateId: r.template_id, stage: r.stage, version: r.version, status: r.status, scaleId: r.scale_id, ...r.definition }))

  const feedbackCampaigns: FeedbackCampaign[] = (
    await q.query<{ id: string; year_id: string; label: string; stages: StageId[]; start: string; end: string; status: FeedbackStatus; form_ids: FeedbackCampaign['formIds']; assignments: TeachingAssignment[] | null; teacher_ids: string[] | null }>(
      `select id, year_id, label, stages, ${day('starts_on')} as start, ${day('ends_on')} as "end", status, form_ids, assignments, teacher_ids from feedback_campaigns`,
    )
  ).rows.map((r) => ({
    id: r.id, year: r.year_id, label: r.label, stages: r.stages, start: r.start, end: r.end, status: r.status, formIds: r.form_ids,
    assignments: r.assignments ?? [], teachers: (r.teacher_ids ?? []).map((id) => emailById.get(id) ?? id),
  }))

  const feedbackAnswers: FeedbackAnswer[] = (
    await q.query<{ id: string; campaign_id: string; form_id: string; teacher_id: string; stage: StageId; grade_id: GradeId; group_label: string; day: string; v: string }>(
      `select id, campaign_id, form_id, teacher_id, stage, grade_id, group_label, ${day('day')} as day, v from feedback_answers`,
    )
  ).rows.map((r) => ({ id: r.id, campaignId: r.campaign_id, formId: r.form_id, teacherEmail: emailById.get(r.teacher_id) ?? '', stage: r.stage, gradeId: r.grade_id, group: r.group_label, day: r.day, v: r.v }))

  const feedbackComments: FeedbackComment[] = (
    await q.query<{ id: string; campaign_id: string; teacher_id: string; stage: StageId; question_id: string; original: string; published: string | null; status: ModerationStatus; flags: string[] }>('select * from feedback_comments')
  ).rows.map((r) => ({ id: r.id, campaignId: r.campaign_id, teacherEmail: emailById.get(r.teacher_id) ?? '', stage: r.stage, questionId: r.question_id, original: r.original, published: r.published ?? undefined, status: r.status, flags: r.flags }))

  const selfAssessments: SelfAssessment[] = (
    await q.query<{ campaign_id: string; teacher_id: string; stage: StageId; answers: Answers; context: Record<string, string[]>; updated_at: Date; submitted_at: Date | null }>('select * from teacher_self_assessments')
  ).rows.map((r) => ({ campaignId: r.campaign_id, teacherEmail: emailById.get(r.teacher_id) ?? '', stage: r.stage, answers: r.answers, context: r.context, updatedAt: new Date(r.updated_at).toISOString(), submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : undefined }))

  // Només per comptar la participació: el servidor no exposa mai aquesta llista.
  const participation: Participation[] = (await q.query<{ campaign_id: string; student_id: string; teacher_id: string }>('select campaign_id, student_id, teacher_id from feedback_participation')).rows.map((r) => ({
    campaignId: r.campaign_id, studentId: r.student_id, teacherEmail: emailById.get(r.teacher_id) ?? '', day: '',
  }))

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
  const l = await load(ctx.db, ctx.yearId)
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
  const t = ownTarget(await load(ctx.db, ctx.yearId), actor, campaignId, teacherEmail)
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
  const l = await load(ctx.db, ctx.yearId)
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
  const l = await load(ctx.db, ctx.yearId)
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

export async function teacherReport(ctx: Ctx, actor: Actor, campaignId: string, teacherEmail: string) {
  const l = await load(ctx.db, ctx.yearId)
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
  const l = await load(ctx.db, ctx.yearId)
  const c = l.data.feedbackCampaigns.find((x) => x.id === campaignId)
  if (!c) throw notFound()
  if (!isDirection(actor) || !RESULTS_DIRECTION.includes(c.status)) throw forbidden('Només l’Equip Directiu pot veure la visió de centre.')
  return buildCenterView(l.data, l.scales, campaignId)
}

// ---------- Gestió de les recollides ----------

export async function setFeedbackStatus(ctx: Ctx, actor: Actor, campaignId: string, status: FeedbackStatus) {
  if (!actor.roles.has('admin') && !isDirection(actor)) throw forbidden()
  const l = await load(ctx.db, ctx.yearId)
  const c = l.data.feedbackCampaigns.find((x) => x.id === campaignId)
  if (!c) throw notFound()
  const from = STATUS_FLOW.indexOf(c.status)
  const to = STATUS_FLOW.indexOf(status)
  if (to !== from + 1) throw invalid(`No es pot passar de ${c.status} a ${status}.`)
  if (status === 'INFORMES_GENERATS' && l.data.feedbackComments.some((x) => x.campaignId === campaignId && x.status === 'pendent')) throw conflict('Encara hi ha comentaris pendents de moderar.')
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
  await ctx.db.query('insert into audit_log (actor_id, action, detail) values ($1, $2, $3)', [actor.userId, 'Estat de recollida d’Et veig', JSON.stringify({ campaignId, status })])
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
