// Estat d'«Em miro» i de la gestió del centre amb la mateixa forma que la demostració (DemoState).
// El servidor el llegeix sencer per aplicar-hi les regles de src/data/api.ts i l'envia al navegador
// retallat segons qui el demana. «Et veig» no hi és: té el seu model confidencial a server/etveig.ts.
import { GRADES } from '../src/domain/catalog'
import type { ClassGroups } from '../src/domain/groups'
import type {
  AuditEntry, Campaign, CampaignStatus, FeedbackCampaign, FeedbackForm, FeedbackStatus, GradeId, GradeSubject, Guardian, Modules, Scale, Section, Session,
  StaffMember, StageId, Student, StudentResponse, Subject, TeachingAssignment, TemplateVersion,
} from '../src/domain/types'
import type { DemoState } from '../src/data/seed'
import { DEMO_VERSION } from '../src/data/seed'
import type { Actor } from './auth'
import type { Queryable } from './db'

/** Identificadors de la base de dades que no surten a l'estat del navegador. */
export interface Ids {
  userByEmail: Map<string, string>
  studentByRef: Map<string, string>
  enrollmentByRef: Map<string, string>
  /** `GRADE-ETIQUETA` → id del grup. */
  groupByKey: Map<string, string>
}

const day = (col: string) => `to_char(${col}, 'YYYY-MM-DD')`
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : undefined)
export const DEFAULT_MODULES: Modules = { emMiro: true, etVeig: true }

export async function loadState(q: Queryable, yearId: string): Promise<{ state: DemoState; ids: Ids }> {
  const [subjects, gradeSubjects, scales, fbScales, templates, groups, students, electives, guardians, users, roles, tutor, campaigns, responses, assignments, settings, audit, forms, fbCampaigns] =
    await Promise.all([
      q.query<{ id: string; short_name: string; long_name: string; hue: number; active: boolean }>('select * from subjects order by id'),
      q.query<{ grade_id: GradeId; subject_id: string; sort: number; optional: boolean; active: boolean }>('select * from grade_subjects where year_id = $1', [yearId]),
      q.query<{ id: string; name: string; allow_na: boolean; options: Scale['options'] }>('select * from answer_scales order by id'),
      q.query<{ id: string; name: string; na_label: string; options: Scale['options'] }>('select * from feedback_scales order by id'),
      q.query<{ id: string; template_id: string; name: string; stage: StageId; version: number; status: 'draft' | 'published'; definition: { sections: Section[] }; change_note: string | null; published_at: Date | null }>(
        'select v.*, t.name, t.stage from template_versions v join questionnaire_templates t on t.id = v.template_id order by v.template_id, v.version',
      ),
      q.query<{ id: string; grade_id: GradeId; label: string }>('select id, grade_id, label from class_groups where year_id = $1 order by grade_id, label', [yearId]),
      q.query<{ id: string; ref: string; name: string; surname: string; email: string; enrollment_id: string; grade_id: GradeId; label: string }>(
        `select s.id, s.school_ref as ref, s.given_name as name, s.family_name as surname, lower(s.school_email) as email, e.id as enrollment_id, g.grade_id, g.label
           from students s join enrollments e on e.student_id = s.id and e.active join class_groups g on g.id = e.group_id and g.year_id = $1
          where s.active order by g.grade_id, g.label, s.family_name, s.given_name`,
        [yearId],
      ),
      q.query<{ enrollment_id: string; subject_id: string }>('select * from student_subjects'),
      q.query<{ student_id: string; name: string; email: string; validated: boolean }>(
        'select sg.student_id, g.full_name as name, lower(g.email) as email, sg.validated_at is not null as validated from student_guardians sg join guardians g on g.id = sg.guardian_id order by g.full_name',
      ),
      q.query<{ id: string; email: string; name: string }>('select id, lower(email) as email, display_name as name from users where active order by display_name'),
      q.query<{ user_id: string; role: string }>('select user_id, role from user_roles'),
      q.query<{ user_id: string; grade_id: GradeId; label: string }>('select t.user_id, g.grade_id, g.label from teacher_group_assignments t join class_groups g on g.id = t.group_id and g.year_id = $1', [yearId]),
      q.query<{ id: string; grade_id: GradeId; label: string; template_version_id: string; subjects_snapshot: GradeSubject[]; start: string; end: string; status: CampaignStatus }>(
        `select id, grade_id, label, template_version_id, subjects_snapshot, ${day('starts_on')} as start, ${day('ends_on')} as "end", status from campaigns where year_id = $1 order by starts_on`,
        [yearId],
      ),
      q.query<{ campaign_id: string; enrollment_id: string; status: StudentResponse['status']; answers: StudentResponse['answers']; revision: number; updated_at: Date; submitted_at: Date | null }>(
        'select r.* from responses r join campaigns c on c.id = r.campaign_id where c.year_id = $1',
        [yearId],
      ),
      q.query<{ grade_id: GradeId; label: string; subject_id: string; teacher_id: string }>(
        'select g.grade_id, g.label, a.subject_id, a.teacher_id from teaching_assignments a join class_groups g on g.id = a.group_id and g.year_id = $1',
        [yearId],
      ),
      q.query<{ key: string; value: unknown }>("select key, value from app_settings where key = 'modules'"),
      q.query<{ at: Date; email: string | null; action: string; detail: { text?: string } | null }>(
        'select a.at, lower(u.email) as email, a.action, a.detail from audit_log a left join users u on u.id = a.actor_id order by a.id desc limit 500',
      ),
      q.query<{ id: string; template_id: string; stage: StageId; version: number; status: 'draft' | 'published'; scale_id: string; definition: Pick<FeedbackForm, 'dimensions' | 'items' | 'open'>; change_note: string | null; published_at: Date | null }>(
        'select * from feedback_forms order by template_id, version',
      ),
      q.query<{ id: string; label: string; stages: StageId[]; start: string; end: string; status: FeedbackStatus; form_ids: FeedbackCampaign['formIds'] }>(
        `select id, label, stages, ${day('starts_on')} as start, ${day('ends_on')} as "end", status, form_ids from feedback_campaigns where year_id = $1 order by starts_on`,
        [yearId],
      ),
    ])

  const ids: Ids = { userByEmail: new Map(), studentByRef: new Map(), enrollmentByRef: new Map(), groupByKey: new Map() }
  const emailById = new Map(users.rows.map((u) => [u.id, u.email]))
  for (const u of users.rows) ids.userByEmail.set(u.email, u.id)
  for (const g of groups.rows) ids.groupByKey.set(`${g.grade_id}-${g.label}`, g.id)

  const classGroups = Object.fromEntries(GRADES.map((g) => [g.id, groups.rows.filter((x) => x.grade_id === g.id).map((x) => x.label)])) as ClassGroups
  const refByEnrollment = new Map<string, string>()
  const studentList: Student[] = students.rows.map((r) => {
    ids.studentByRef.set(r.ref, r.id)
    ids.enrollmentByRef.set(r.ref, r.enrollment_id)
    refByEnrollment.set(r.enrollment_id, r.ref)
    return {
      id: r.ref, name: r.name, surname: r.surname, email: r.email, gradeId: r.grade_id, group: r.label,
      electives: electives.rows.filter((e) => e.enrollment_id === r.enrollment_id).map((e) => e.subject_id),
      guardians: guardians.rows.filter((g) => g.student_id === r.id).map((g): Guardian => ({ name: g.name, email: g.email, validated: g.validated })),
    }
  })
  const rolesOf = (id: string) => roles.rows.filter((r) => r.user_id === id).map((r) => r.role)
  const staff: StaffMember[] = users.rows
    .filter((u) => rolesOf(u.id).length)
    .map((u) => {
      const rs = rolesOf(u.id)
      return {
        email: u.email, name: u.name, role: rs.includes('admin') ? 'admin' : 'teacher',
        groups: tutor.rows.filter((t) => t.user_id === u.id).map((t) => `${t.grade_id}-${t.label}`),
        ...(rs.includes('direction') ? { direction: true } : {}),
      }
    })
  const modules = settings.rows[0]?.value as Modules | undefined

  const state: DemoState = {
    version: DEMO_VERSION,
    year: yearId,
    subjects: subjects.rows.map((r): Subject => ({ id: r.id, short: r.short_name, long: r.long_name, hue: r.hue, active: r.active })),
    gradeSubjects: gradeSubjects.rows.map((r): GradeSubject => ({ gradeId: r.grade_id, subjectId: r.subject_id, order: r.sort, optional: r.optional, active: r.active })),
    scales: [
      ...scales.rows.map((r): Scale => ({ id: r.id, name: r.name, options: r.options, allowNA: r.allow_na })),
      ...fbScales.rows.map((r): Scale => ({ id: r.id, name: r.name, options: r.options, allowNA: true, naLabel: r.na_label })),
    ],
    templates: templates.rows.map((r): TemplateVersion => ({
      id: r.id, templateId: r.template_id, name: r.name, stage: r.stage, version: r.version, status: r.status,
      publishedAt: iso(r.published_at), changeNote: r.change_note ?? undefined, sections: r.definition.sections,
    })),
    students: studentList,
    staff,
    campaigns: campaigns.rows.map((r): Campaign => ({
      id: r.id, year: yearId, gradeId: r.grade_id, label: r.label, templateVersionId: r.template_version_id, start: r.start, end: r.end, status: r.status, subjectsSnapshot: r.subjects_snapshot,
    })),
    responses: responses.rows
      .filter((r) => refByEnrollment.has(r.enrollment_id))
      .map((r): StudentResponse => ({
        campaignId: r.campaign_id, studentId: refByEnrollment.get(r.enrollment_id)!, status: r.status, answers: r.answers, revision: r.revision, updatedAt: iso(r.updated_at)!, submittedAt: iso(r.submitted_at),
      })),
    audit: audit.rows.map((r): AuditEntry => ({ at: iso(r.at)!, actor: r.email ?? 'sistema', action: r.action, detail: r.detail?.text ?? '' })),
    modules: { ...DEFAULT_MODULES, ...modules },
    assignments: assignments.rows.map((r): TeachingAssignment => ({ gradeId: r.grade_id, group: r.label, subjectId: r.subject_id, teacherEmail: emailById.get(r.teacher_id) ?? '' })),
    feedbackForms: forms.rows.map((r): FeedbackForm => ({
      id: r.id, templateId: r.template_id, stage: r.stage, version: r.version, status: r.status, scaleId: r.scale_id,
      publishedAt: iso(r.published_at), changeNote: r.change_note ?? undefined, ...r.definition,
    })),
    // Només el necessari per a les pantalles de configuració: cap assignació congelada ni cap resultat.
    feedbackCampaigns: fbCampaigns.rows.map((r): FeedbackCampaign => ({ id: r.id, year: yearId, label: r.label, stages: r.stages, start: r.start, end: r.end, status: r.status, formIds: r.form_ids, assignments: [], teachers: [] })),
    feedbackDrafts: [],
    participation: [],
    feedbackAnswers: [],
    feedbackComments: [],
    selfAssessments: [],
    classGroups,
  }
  return { state, ids }
}

/** Sessió amb la forma de la demostració, construïda al servidor a partir del testimoni verificat. */
export function sessionOf(actor: Actor, state: DemoState): Session {
  const staff = state.staff.find((s) => s.email === actor.email)
  if (staff) return { email: actor.email, name: actor.name, role: staff.role, groups: staff.groups, direction: staff.direction }
  const st = state.students.find((s) => s.email === actor.email)
  if (st) return { email: actor.email, name: actor.name, role: 'student', studentId: st.id }
  return { email: actor.email, name: actor.name, role: 'student', pending: true }
}

/**
 * Retalla l'estat segons qui el demana: l'alumnat només veu el seu; la tutoria, els seus grups;
 * l'administració i l'Equip Directiu, tot. Mai surt res d'«Et veig» que no sigui configuració.
 */
export function scopeState(state: DemoState, session: Session): DemoState {
  const isAdmin = session.role === 'admin'
  const isDir = !!session.direction
  if (session.role === 'student') {
    const me = state.students.filter((s) => s.id === session.studentId).map((s) => ({ ...s, guardians: [] }))
    const campaigns = state.campaigns.filter((c) => c.gradeId === me[0]?.gradeId)
    const used = new Set(campaigns.map((c) => c.templateVersionId))
    return {
      ...state,
      students: me,
      staff: [],
      campaigns,
      templates: state.templates.filter((t) => used.has(t.id)),
      responses: state.responses.filter((r) => r.studentId === session.studentId),
      audit: [],
      assignments: [],
      feedbackForms: [],
      feedbackCampaigns: [],
    }
  }
  if (isAdmin || isDir) return isAdmin ? state : { ...state, audit: [] }
  // Tutoria: només els seus grups; del personal, el nom i el correu.
  const mine = new Set(session.groups ?? [])
  const students = state.students.filter((s) => mine.has(`${s.gradeId}-${s.group}`))
  const refs = new Set(students.map((s) => s.id))
  return {
    ...state,
    students,
    responses: state.responses.filter((r) => refs.has(r.studentId)),
    staff: state.staff.map((s) => (s.email === session.email ? s : { email: s.email, name: s.name, role: s.role, groups: [] })),
    audit: state.audit.filter((a) => a.action === 'Lliurament' && students.some((s) => s.email === a.actor)),
    assignments: state.assignments.filter((a) => a.teacherEmail === session.email),
    feedbackCampaigns: [],
  }
}
