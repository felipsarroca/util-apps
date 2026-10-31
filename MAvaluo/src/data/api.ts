// Capa de dades. `DemoApi` simula al navegador el servidor previst (Neon + API amb autorització):
// cada operació comprova els permisos de la sessió, com ho farà el backend real.
// Per connectar-hi Neon, cal implementar la mateixa interfície amb crides HTTP.

import { useSyncExternalStore } from 'react'
import { GRADES } from '../domain/catalog'
import { buildSteps, findMissing, subjectsForStudent } from '../domain/engine'
import {
  buildCenterView, buildTeacherReport, encodeAnswers, flagComment, missingItems, stableShuffle, stageOfGrade, stagesOfTeacher, teachersForStudent,
  type CenterStage, type TeacherReport, type TeacherTarget,
} from '../domain/feedback'
import { validateFeedbackForm } from '../domain/feedbackForms'
import type {
  Answers, Campaign, CampaignStatus, FeedbackAnswer, FeedbackCampaign, FeedbackComment, FeedbackForm, FeedbackStatus, GradeId, GradeSubject, ModerationStatus, Modules,
  Section, SelfAssessment, Session, StageId, Student, StudentResponse, Subject, TemplateVersion,
} from '../domain/types'
import { checkSchoolEmail } from './auth'
import { createDemoState, DEMO_VERSION, type DemoState } from './seed'

const KEY = 'mavaluo:demo'

export class ForbiddenError extends Error {}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as DemoState
      if (s.version === DEMO_VERSION) return s
    }
  } catch {
    /* sense emmagatzematge: es treballa en memòria */
  }
  return createDemoState()
}

let state: DemoState = load()
const listeners = new Set<() => void>()

function commit(next: DemoState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignorat */
  }
  listeners.forEach((l) => l())
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

const nowIso = () => new Date().toISOString()
const audit = (s: DemoState, actor: string, action: string, detail: string): DemoState => ({
  ...s,
  audit: [{ at: nowIso(), actor, action, detail }, ...s.audit].slice(0, 500),
})

// ---------- Sessió ----------

export function resolveSession(rawEmail: string, profile?: { name?: string; picture?: string }): Session | { error: string } {
  const check = checkSchoolEmail(rawEmail)
  if (!check.ok) return { error: check.reason }
  const email = check.email
  const staff = state.staff.find((s) => s.email === email)
  if (staff) return { email, name: staff.name, role: staff.role, groups: staff.groups, direction: staff.direction, picture: profile?.picture }
  const st = state.students.find((s) => s.email === email)
  if (st) return { email, name: `${st.name} ${st.surname}`, role: 'student', studentId: st.id, picture: profile?.picture }
  // Correu del domini però sense matrícula ni permís: no es dona accés a cap dada.
  return { email, name: profile?.name ?? email, role: 'student', pending: true, picture: profile?.picture }
}

// ---------- Permisos ----------

const groupKey = (s: Student) => `${s.gradeId}-${s.group}`

export function canSeeStudent(session: Session, st: Student): boolean {
  if (session.role === 'admin') return true
  if (session.role === 'teacher') return !!session.groups?.includes(groupKey(st))
  return session.studentId === st.id
}

function requireAdmin(session: Session) {
  if (session.role !== 'admin') throw new ForbiddenError('Aquesta acció només la pot fer l’administració.')
}

export const visibleStudents = (s: DemoState, session: Session) => s.students.filter((st) => canSeeStudent(session, st))

export const visibleGrades = (s: DemoState, session: Session): GradeId[] =>
  session.role === 'admin' ? GRADES.map((g) => g.id) : [...new Set(visibleStudents(s, session).map((x) => x.gradeId))]

export const templateById = (s: DemoState, id: string) => s.templates.find((t) => t.id === id)

// ---------- Alumne ----------

export interface StudentHome {
  student: Student
  campaign?: Campaign
  template?: TemplateVersion
  subjects: Subject[]
  response?: StudentResponse
  previousGoal?: string
  history: { campaign: Campaign; response: StudentResponse }[]
}

export function studentHome(s: DemoState, session: Session): StudentHome | null {
  const student = s.students.find((x) => x.id === session.studentId)
  if (!student || !canSeeStudent(session, student)) return null
  const mine = s.campaigns.filter((c) => c.gradeId === student.gradeId && c.year === s.year)
  const campaign = s.modules.emMiro ? mine.find((c) => c.status === 'OBERTA') : undefined
  const template = campaign && templateById(s, campaign.templateVersionId)
  const subjects = campaign ? subjectsForStudent(campaign.subjectsSnapshot, student, s.subjects) : []
  const response = campaign && s.responses.find((r) => r.campaignId === campaign.id && r.studentId === student.id)
  // Objectiu anterior: l'última resposta lliurada d'una recollida anterior que contingui la pregunta d'origen.
  const sources = (template?.sections ?? []).flatMap((x: Section) => x.questions).filter((q) => q.type === 'goalReview').map((q) => q.sourceQuestionId!)
  const prev = s.responses
    .filter((r) => r.studentId === student.id && r.campaignId !== campaign?.id && r.submittedAt)
    .sort((a, b) => (b.submittedAt! > a.submittedAt! ? 1 : -1))
    .find((r) => sources.some((k) => r.answers[k]))
  const history = s.responses
    .filter((r) => r.studentId === student.id && r.campaignId !== campaign?.id && r.submittedAt)
    .map((r) => ({ response: r, campaign: s.campaigns.find((c) => c.id === r.campaignId)! }))
  return { student, campaign, template, subjects, response, previousGoal: prev && sources.map((k) => prev.answers[k]).find(Boolean), history }
}

function ownOpenCampaign(session: Session, campaignId: string): { campaign: Campaign; student: Student } {
  const student = state.students.find((x) => x.id === session.studentId)
  const campaign = state.campaigns.find((c) => c.id === campaignId)
  if (!student || !campaign || campaign.gradeId !== student.gradeId) throw new ForbiddenError('Aquesta autoavaluació no és teva.')
  if (campaign.status !== 'OBERTA' || !state.modules.emMiro) throw new ForbiddenError('Aquesta autoavaluació ja està tancada.')
  return { campaign, student }
}

export function saveDraft(session: Session, campaignId: string, answers: Answers) {
  const { student } = ownOpenCampaign(session, campaignId)
  const prev = state.responses.find((r) => r.campaignId === campaignId && r.studentId === student.id)
  const next: StudentResponse = prev
    ? { ...prev, answers, updatedAt: nowIso(), status: prev.status === 'NO_INICIADA' ? 'EN_CURS' : prev.status }
    : { campaignId, studentId: student.id, status: 'EN_CURS', answers, updatedAt: nowIso(), revision: 0 }
  commit({ ...state, responses: [...state.responses.filter((r) => r !== prev), next] })
}

export function submitResponse(session: Session, campaignId: string, answers: Answers) {
  const { campaign, student } = ownOpenCampaign(session, campaignId)
  const template = templateById(state, campaign.templateVersionId)!
  const home = studentHome(state, session)!
  const steps = buildSteps(template, { stage: template.stage, subjects: home.subjects, previousGoal: home.previousGoal })
  if (findMissing(steps, answers).length) throw new Error('Encara hi ha respostes obligatòries pendents.')
  const prev = state.responses.find((r) => r.campaignId === campaignId && r.studentId === student.id)
  const next: StudentResponse = { campaignId, studentId: student.id, status: 'LLIURADA', answers, updatedAt: nowIso(), submittedAt: nowIso(), revision: (prev?.revision ?? 0) + 1 }
  commit(audit({ ...state, responses: [...state.responses.filter((r) => r !== prev), next] }, session.email, 'Lliurament', `${campaign.label} · revisió ${next.revision}`))
}

// ---------- Professorat i administració ----------

export function setCampaignStatus(session: Session, campaignId: string, status: CampaignStatus, reason?: string) {
  const c = state.campaigns.find((x) => x.id === campaignId)
  if (!c) return
  const own = session.role === 'teacher' && session.groups?.some((g) => g.startsWith(c.gradeId + '-'))
  if (session.role !== 'admin' && !own) throw new ForbiddenError('No tens permís sobre aquesta recollida.')
  if (status === 'DISTRIBUIDA' && c.status === 'OBERTA') throw new Error('No es poden distribuir informes d’una recollida oberta.')
  commit(audit({ ...state, campaigns: state.campaigns.map((x) => (x.id === campaignId ? { ...x, status } : x)) }, session.email, 'Estat de recollida', `${c.gradeId} · ${c.label}: ${c.status} → ${status}${reason ? ` (${reason})` : ''}`))
}

export function updateCampaign(session: Session, campaignId: string, patch: Partial<Pick<Campaign, 'start' | 'end' | 'label'>>, reason: string) {
  requireAdmin(session)
  const c = state.campaigns.find((x) => x.id === campaignId)!
  commit(audit({ ...state, campaigns: state.campaigns.map((x) => (x.id === campaignId ? { ...x, ...patch } : x)) }, session.email, 'Canvi de recollida', `${c.gradeId} · ${c.label}: ${reason}`))
}

export function createCampaign(session: Session, gradeId: GradeId, label: string, start: string, end: string) {
  requireAdmin(session)
  const stage = GRADES.find((g) => g.id === gradeId)!.stage
  const tpl = state.templates.filter((t) => t.stage === stage && t.status === 'published').sort((a, b) => b.version - a.version)[0]
  if (!tpl) throw new Error('No hi ha cap qüestionari publicat per a aquesta etapa.')
  const id = `C-${gradeId}-${Date.now().toString(36)}`
  const campaign: Campaign = { id, year: state.year, gradeId, label, templateVersionId: tpl.id, start, end, status: 'PROGRAMADA', subjectsSnapshot: state.gradeSubjects.filter((g) => g.gradeId === gradeId).map((g) => ({ ...g })) }
  commit(audit({ ...state, campaigns: [...state.campaigns, campaign] }, session.email, 'Nova recollida', `${gradeId} · ${label} amb ${tpl.name} v${tpl.version}`))
}

export function setGradeSubject(session: Session, gs: GradeSubject) {
  requireAdmin(session)
  const exists = state.gradeSubjects.some((x) => x.gradeId === gs.gradeId && x.subjectId === gs.subjectId)
  const list = exists ? state.gradeSubjects.map((x) => (x.gradeId === gs.gradeId && x.subjectId === gs.subjectId ? gs : x)) : [...state.gradeSubjects, gs]
  commit(audit({ ...state, gradeSubjects: list }, session.email, 'Matèries', `${gs.gradeId} · ${gs.subjectId}: ${gs.active ? 'activa' : 'desactivada'}${gs.optional ? ', optativa' : ''}`))
}

export function moveGradeSubject(session: Session, gradeId: GradeId, subjectId: string, dir: -1 | 1) {
  requireAdmin(session)
  const list = state.gradeSubjects.filter((x) => x.gradeId === gradeId).sort((a, b) => a.order - b.order)
  const i = list.findIndex((x) => x.subjectId === subjectId)
  const j = i + dir
  if (j < 0 || j >= list.length) return
  const a = list[i], b = list[j]
  commit({
    ...state,
    gradeSubjects: state.gradeSubjects.map((x) =>
      x === a ? { ...x, order: b.order } : x === b ? { ...x, order: a.order } : x,
    ),
  })
}

export function saveTemplateDraft(session: Session, t: TemplateVersion) {
  requireAdmin(session)
  const published = state.templates.find((x) => x.id === t.id && x.status === 'published')
  if (published) throw new Error('Una versió publicada no es pot modificar: crea’n una de nova.')
  const exists = state.templates.some((x) => x.id === t.id)
  commit({ ...state, templates: exists ? state.templates.map((x) => (x.id === t.id ? t : x)) : [...state.templates, t] })
}

export function newDraftFrom(session: Session, versionId: string): TemplateVersion {
  requireAdmin(session)
  const base = state.templates.find((t) => t.id === versionId)!
  const existing = state.templates.find((t) => t.templateId === base.templateId && t.status === 'draft')
  if (existing) return existing
  const version = Math.max(...state.templates.filter((t) => t.templateId === base.templateId).map((t) => t.version)) + 1
  const draft: TemplateVersion = { ...structuredClone(base), id: `${base.templateId}-v${version}`, version, status: 'draft', publishedAt: undefined, changeNote: '' }
  commit({ ...state, templates: [...state.templates, draft] })
  return draft
}

export function discardDraft(session: Session, versionId: string) {
  requireAdmin(session)
  commit({ ...state, templates: state.templates.filter((t) => !(t.id === versionId && t.status === 'draft')) })
}

export function publishTemplate(session: Session, versionId: string, note: string) {
  requireAdmin(session)
  const t = state.templates.find((x) => x.id === versionId)!
  commit(
    audit(
      { ...state, templates: state.templates.map((x) => (x.id === versionId ? { ...x, status: 'published', publishedAt: nowIso(), changeNote: note } : x)) },
      session.email,
      'Publicació de qüestionari',
      `${t.name} v${t.version}: ${note || 'sense nota'}`,
    ),
  )
}

/** Assigna la versió publicada més recent a les recollides que encara no s'han obert. */
export function adoptTemplateInScheduled(session: Session, versionId: string): number {
  requireAdmin(session)
  const t = state.templates.find((x) => x.id === versionId)!
  const stageGrades = GRADES.filter((g) => g.stage === t.stage).map((g) => g.id)
  const targets = state.campaigns.filter((c) => stageGrades.includes(c.gradeId) && (c.status === 'ESBORRANY' || c.status === 'PROGRAMADA'))
  if (!targets.length) return 0
  commit({ ...state, campaigns: state.campaigns.map((c) => (targets.includes(c) ? { ...c, templateVersionId: versionId } : c)) })
  return targets.length
}

export function addStaff(session: Session, email: string, name: string, role: 'admin' | 'teacher', groups: string[]) {
  requireAdmin(session)
  const check = checkSchoolEmail(email)
  if (!check.ok) throw new Error(check.reason)
  const rest = state.staff.filter((s) => s.email !== check.email)
  commit(audit({ ...state, staff: [...rest, { email: check.email, name, role, groups }] }, session.email, 'Permisos', `${check.email}: ${role === 'admin' ? 'administració' : `professorat (${groups.join(', ') || 'sense grups'})`}`))
}

export function removeStaff(session: Session, email: string) {
  requireAdmin(session)
  if (email === session.email) throw new Error('No et pots treure el teu propi accés.')
  commit(audit({ ...state, staff: state.staff.filter((s) => s.email !== email) }, session.email, 'Permisos', `${email}: accés retirat`))
}

export interface CensusRow {
  id: string
  name: string
  surname: string
  email: string
  gradeId: GradeId | null
  group: string
  issues: string[]
}

/** Importació de cens: només s'apliquen les files sense incidències. */
export function importCensus(session: Session, rows: CensusRow[]): number {
  requireAdmin(session)
  const ok = rows.filter((r) => !r.issues.length && r.gradeId)
  const byId = new Map(state.students.map((s) => [s.id, s]))
  for (const r of ok) {
    const prev = byId.get(r.id)
    byId.set(r.id, { id: r.id, name: r.name, surname: r.surname, email: r.email, gradeId: r.gradeId!, group: r.group, electives: prev?.electives ?? [], guardians: prev?.guardians ?? [] })
  }
  commit(audit({ ...state, students: [...byId.values()] }, session.email, 'Importació de cens', `${ok.length} alumnes importats o actualitzats`))
  return ok.length
}

export function setElective(session: Session, studentId: string, subjectId: string, on: boolean) {
  requireAdmin(session)
  commit({ ...state, students: state.students.map((s) => (s.id === studentId ? { ...s, electives: on ? [...new Set([...s.electives, subjectId])] : s.electives.filter((x) => x !== subjectId) } : s)) })
}

export function logAudit(session: Session, action: string, detail: string) {
  commit(audit(state, session.email, action, detail))
}

export function resetDemo() {
  commit(createDemoState())
}

// ---------- Configuració general ----------

export function setModules(session: Session, patch: Partial<Modules>) {
  requireAdmin(session)
  const modules = { ...state.modules, ...patch }
  commit(audit({ ...state, modules }, session.email, 'Apartats', `Em miro: ${modules.emMiro ? 'actiu' : 'inactiu'} · Et veig: ${modules.etVeig ? 'actiu' : 'inactiu'}`))
}

export function setAssignment(session: Session, gradeId: GradeId, group: string, subjectId: string, teacherEmail: string | null) {
  requireAdmin(session)
  const rest = state.assignments.filter((a) => !(a.gradeId === gradeId && a.group === group && a.subjectId === subjectId))
  const assignments = teacherEmail ? [...rest, { gradeId, group, subjectId, teacherEmail }] : rest
  commit(audit({ ...state, assignments }, session.email, 'Assignació docent', `${gradeId} ${group} · ${subjectId}: ${teacherEmail ?? 'sense docent'}`))
}

// ---------- Et veig: permisos ----------

export const isDirection = (session: Session) => !!state.staff.find((s) => s.email === session.email)?.direction

/** Resultats d'«Et veig»: el mateix docent o l'Equip Directiu. L'administració sense permís de direcció, no. */
export function canSeeTeacherReport(session: Session, teacherEmail: string, campaign: FeedbackCampaign): boolean {
  if (isDirection(session)) return RESULTS_VISIBLE_DIRECTION.includes(campaign.status)
  return session.email === teacherEmail && RESULTS_VISIBLE_TEACHER.includes(campaign.status)
}
export const RESULTS_VISIBLE_DIRECTION: FeedbackStatus[] = ['INFORMES_GENERATS', 'PUBLICADA', 'ARXIVADA']
export const RESULTS_VISIBLE_TEACHER: FeedbackStatus[] = ['PUBLICADA', 'ARXIVADA']

export function teacherReport(session: Session, campaignId: string, teacherEmail: string): TeacherReport {
  const c = state.feedbackCampaigns.find((x) => x.id === campaignId)
  if (!c || !canSeeTeacherReport(session, teacherEmail, c)) throw new ForbiddenError('No tens permís per veure aquest informe.')
  return buildTeacherReport(state, state.scales, campaignId, teacherEmail)!
}

export function centerView(session: Session, campaignId: string): CenterStage[] {
  const c = state.feedbackCampaigns.find((x) => x.id === campaignId)
  if (!c || !isDirection(session) || !RESULTS_VISIBLE_DIRECTION.includes(c.status)) throw new ForbiddenError('Només l’Equip Directiu pot veure la visió de centre.')
  return buildCenterView(state, state.scales, campaignId)
}

/** Registre de consulta d'informes (traça de qui veu què). */
export function logReportView(session: Session, campaignId: string, teacherEmail: string, action: 'Consulta' | 'Descàrrega') {
  if (session.email === teacherEmail) return
  commit(audit(state, session.email, `${action} d’informe Així et veiem`, `${campaignId} · ${teacherEmail}`))
}

// ---------- Et veig: alumne ----------

export interface FeedbackTarget extends TeacherTarget {
  status: 'pendent' | 'esborrany' | 'lliurat'
  draft?: Answers
}

export interface FeedbackHome {
  campaign: FeedbackCampaign
  form: FeedbackForm
  targets: FeedbackTarget[]
}

export function feedbackHome(s: DemoState, session: Session): FeedbackHome | null {
  if (!s.modules.etVeig) return null
  const student = s.students.find((x) => x.id === session.studentId)
  if (!student || !canSeeStudent(session, student)) return null
  const stage = stageOfGrade(student.gradeId)
  const campaign = s.feedbackCampaigns.find((c) => c.status === 'OBERTA' && c.stages.includes(stage))
  const form = campaign && s.feedbackForms.find((f) => f.id === campaign.formIds[stage])
  if (!campaign || !form) return null
  const targets = stableShuffle(teachersForStudent(student, campaign.assignments, s.gradeSubjects, s.subjects, s.staff, campaign.teachers), `${campaign.id}:${student.id}`).map((t) => {
    const done = s.participation.some((p) => p.campaignId === campaign.id && p.studentId === student.id && p.teacherEmail === t.email)
    const draft = s.feedbackDrafts.find((d) => d.campaignId === campaign.id && d.studentId === student.id && d.teacherEmail === t.email)
    return { ...t, status: done ? 'lliurat' : draft ? 'esborrany' : 'pendent', draft: done ? undefined : draft?.answers } as FeedbackTarget
  })
  return { campaign, form, targets }
}

function ownFeedbackTarget(session: Session, campaignId: string, teacherEmail: string) {
  const student = state.students.find((x) => x.id === session.studentId)
  const campaign = state.feedbackCampaigns.find((c) => c.id === campaignId)
  if (!student || !campaign || !state.modules.etVeig) throw new ForbiddenError('Aquesta valoració no està disponible.')
  if (campaign.status !== 'OBERTA') throw new ForbiddenError('Aquesta recollida ja està tancada.')
  const stage = stageOfGrade(student.gradeId)
  if (!campaign.stages.includes(stage)) throw new ForbiddenError('Aquesta recollida no és per al teu curs.')
  const target = teachersForStudent(student, campaign.assignments, state.gradeSubjects, state.subjects, state.staff, campaign.teachers).find((t) => t.email === teacherEmail)
  if (!target) throw new ForbiddenError('Només pots valorar el professorat que et fa classe.')
  if (state.participation.some((p) => p.campaignId === campaignId && p.studentId === student.id && p.teacherEmail === teacherEmail)) throw new Error('Ja has lliurat la valoració d’aquest docent.')
  const form = state.feedbackForms.find((f) => f.id === campaign.formIds[stage])!
  return { student, campaign, stage, form }
}

export function saveFeedbackDraft(session: Session, campaignId: string, teacherEmail: string, answers: Answers) {
  const { student } = ownFeedbackTarget(session, campaignId, teacherEmail)
  const rest = state.feedbackDrafts.filter((d) => !(d.campaignId === campaignId && d.studentId === student.id && d.teacherEmail === teacherEmail))
  commit({ ...state, feedbackDrafts: [...rest, { campaignId, studentId: student.id, teacherEmail, answers, updatedAt: nowIso() }] })
}

/**
 * Lliurament: en una sola operació s'anota la participació (qui ha lliurat qui) i es desen les respostes
 * sense cap identificador d'alumne; després s'esborra l'esborrany. A partir d'aquí ningú no pot relacionar-les.
 */
export function submitFeedback(session: Session, campaignId: string, teacherEmail: string, answers: Answers) {
  const { student, campaign, stage, form } = ownFeedbackTarget(session, campaignId, teacherEmail)
  if (missingItems(form, answers).length) throw new Error('Encara hi ha afirmacions per respondre.')
  const day = nowIso().slice(0, 10)
  const answer: FeedbackAnswer = { id: randomId(), campaignId, formId: form.id, teacherEmail, stage, gradeId: student.gradeId, group: student.group, day, v: encodeAnswers(form, answers) }
  const names = [...new Set([...state.students.map((x) => x.name), ...state.staff.map((x) => x.name.split(' ')[0])])]
  const comments: FeedbackComment[] = form.open
    .filter((q) => answers[q.id]?.trim())
    .map((q) => ({ id: randomId(), campaignId, teacherEmail, stage, questionId: q.id, original: answers[q.id].trim().slice(0, q.maxLength), status: 'pendent', flags: flagComment(answers[q.id], names) }))
  // L'ordre de les respostes es barreja perquè la posició a la llista tampoc no permeti relacionar-les.
  const at = Math.floor(Math.random() * (state.feedbackAnswers.length + 1))
  commit({
    ...state,
    participation: [...state.participation, { campaignId, studentId: student.id, teacherEmail, day }],
    feedbackAnswers: [...state.feedbackAnswers.slice(0, at), answer, ...state.feedbackAnswers.slice(at)],
    feedbackComments: [...state.feedbackComments, ...comments],
    feedbackDrafts: state.feedbackDrafts.filter((d) => !(d.campaignId === campaign.id && d.studentId === student.id && d.teacherEmail === teacherEmail)),
  })
}

const randomId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`)

// ---------- Et veig: autoavaluació docent ----------

export function selfAssessmentTasks(s: DemoState, session: Session) {
  return s.feedbackCampaigns
    .filter((c) => c.teachers.includes(session.email) && ['OBERTA', 'TANCADA'].includes(c.status))
    .flatMap((c) => stagesOfTeacher(c, session.email).map((stage) => ({ campaign: c, stage, form: s.feedbackForms.find((f) => f.id === c.formIds[stage])!, self: s.selfAssessments.find((x) => x.campaignId === c.id && x.teacherEmail === session.email && x.stage === stage) })))
}

export function saveSelfAssessment(session: Session, campaignId: string, stage: StageId, answers: Answers, context: Record<string, string[]>, submit: boolean) {
  const c = state.feedbackCampaigns.find((x) => x.id === campaignId)
  if (!c || !stagesOfTeacher(c, session.email).includes(stage)) throw new ForbiddenError('Aquesta autoavaluació no et correspon.')
  // Es fa abans de veure els resultats: un cop la recollida passa a moderació, queda bloquejada.
  if (!['OBERTA', 'TANCADA'].includes(c.status)) throw new ForbiddenError('L’autoavaluació d’aquesta recollida ja està tancada.')
  const prev = state.selfAssessments.find((x) => x.campaignId === campaignId && x.teacherEmail === session.email && x.stage === stage)
  if (prev?.submittedAt) throw new Error('Ja has lliurat aquesta autoavaluació.')
  const form = state.feedbackForms.find((f) => f.id === c.formIds[stage])!
  if (submit && missingItems(form, answers).length) throw new Error('Encara hi ha afirmacions per respondre.')
  const next: SelfAssessment = { campaignId, teacherEmail: session.email, stage, answers, context, updatedAt: nowIso(), submittedAt: submit ? nowIso() : undefined }
  const rest = state.selfAssessments.filter((x) => x !== prev)
  const s2 = { ...state, selfAssessments: [...rest, next] }
  commit(submit ? audit(s2, session.email, 'Autoavaluació docent', `${c.label} · ${stage}`) : s2)
}

// ---------- Et veig: administració ----------

export function setFeedbackStatus(session: Session, campaignId: string, status: FeedbackStatus) {
  requireAdmin(session)
  const c = state.feedbackCampaigns.find((x) => x.id === campaignId)!
  if (status === 'INFORMES_GENERATS' && state.feedbackComments.some((x) => x.campaignId === campaignId && x.status === 'pendent'))
    throw new Error('Encara hi ha comentaris pendents de moderar.')
  if (status === 'OBERTA' && state.feedbackCampaigns.some((x) => x.id !== campaignId && x.status === 'OBERTA' && x.stages.some((st) => c.stages.includes(st))))
    throw new Error('Ja hi ha una altra recollida d’«Et veig» oberta per a alguna d’aquestes etapes.')
  // En obrir-la, es congelen les assignacions docents vigents.
  const patch = status === 'OBERTA' && c.status !== 'TANCADA' ? { assignments: state.assignments.map((a) => ({ ...a })), teachers: [...new Set(state.assignments.map((a) => a.teacherEmail))] } : {}
  commit(audit({ ...state, feedbackCampaigns: state.feedbackCampaigns.map((x) => (x.id === campaignId ? { ...x, ...patch, status } : x)) }, session.email, 'Estat de recollida d’Et veig', `${c.label}: ${c.status} → ${status}`))
}

export function createFeedbackCampaign(session: Session, label: string, stages: StageId[], start: string, end: string) {
  requireAdmin(session)
  if (!stages.length) throw new Error('Tria com a mínim una etapa.')
  const formIds: Partial<Record<StageId, string>> = {}
  for (const st of stages) {
    const f = state.feedbackForms.filter((x) => x.stage === st && x.status === 'published').sort((a, b) => b.version - a.version)[0]
    if (!f) throw new Error(`No hi ha cap qüestionari d’«Et veig» publicat per a ${st}.`)
    formIds[st] = f.id
  }
  const c: FeedbackCampaign = {
    id: `FV-${Date.now().toString(36)}`, year: state.year, label, stages, start, end, status: 'PROGRAMADA', formIds,
    assignments: state.assignments.map((a) => ({ ...a })), teachers: [...new Set(state.assignments.map((a) => a.teacherEmail))],
  }
  commit(audit({ ...state, feedbackCampaigns: [...state.feedbackCampaigns, c] }, session.email, 'Nova recollida d’Et veig', `${label} · ${stages.join(', ')}`))
}

export function moderateComment(session: Session, commentId: string, status: Exclude<ModerationStatus, 'pendent'>, text?: string) {
  requireAdmin(session)
  if (!isDirection(session)) throw new ForbiddenError('La moderació dels comentaris la fa l’Equip Directiu.')
  commit({
    ...state,
    feedbackComments: state.feedbackComments.map((x) =>
      x.id === commentId ? { ...x, status, published: status === 'descartat' ? undefined : status === 'editat' ? (text ?? '').trim() : x.original } : x,
    ),
  })
}

export function acceptUnflagged(session: Session, campaignId: string): number {
  requireAdmin(session)
  if (!isDirection(session)) throw new ForbiddenError('La moderació dels comentaris la fa l’Equip Directiu.')
  let n = 0
  const feedbackComments = state.feedbackComments.map((x) => {
    if (x.campaignId !== campaignId || x.status !== 'pendent' || x.flags.length) return x
    n++
    return { ...x, status: 'acceptat' as const, published: x.original }
  })
  commit(audit({ ...state, feedbackComments }, session.email, 'Moderació', `${n} comentaris sense marques acceptats`))
  return n
}

export function saveFeedbackFormDraft(session: Session, f: FeedbackForm) {
  requireAdmin(session)
  if (state.feedbackForms.some((x) => x.id === f.id && x.status === 'published')) throw new Error('Una versió publicada no es pot modificar: crea’n una de nova.')
  const exists = state.feedbackForms.some((x) => x.id === f.id)
  commit({ ...state, feedbackForms: exists ? state.feedbackForms.map((x) => (x.id === f.id ? f : x)) : [...state.feedbackForms, f] })
}

export function newFeedbackDraft(session: Session, formId: string): FeedbackForm {
  requireAdmin(session)
  const base = state.feedbackForms.find((f) => f.id === formId)!
  const existing = state.feedbackForms.find((f) => f.templateId === base.templateId && f.status === 'draft')
  if (existing) return existing
  const version = Math.max(...state.feedbackForms.filter((f) => f.templateId === base.templateId).map((f) => f.version)) + 1
  const draft: FeedbackForm = { ...structuredClone(base), id: `${base.templateId}-v${version}`, version, status: 'draft', publishedAt: undefined, changeNote: '' }
  commit({ ...state, feedbackForms: [...state.feedbackForms, draft] })
  return draft
}

export function discardFeedbackDraft(session: Session, formId: string) {
  requireAdmin(session)
  commit({ ...state, feedbackForms: state.feedbackForms.filter((f) => !(f.id === formId && f.status === 'draft')) })
}

export function publishFeedbackForm(session: Session, formId: string, note: string) {
  requireAdmin(session)
  const f = state.feedbackForms.find((x) => x.id === formId)!
  const issues = validateFeedbackForm(f)
  if (issues.length) throw new Error(issues[0])
  // Les recollides que encara no s'han obert passen a fer servir la versió nova.
  const feedbackCampaigns = state.feedbackCampaigns.map((c) => (c.stages.includes(f.stage) && ['ESBORRANY', 'PROGRAMADA'].includes(c.status) ? { ...c, formIds: { ...c.formIds, [f.stage]: f.id } } : c))
  commit(audit({ ...state, feedbackCampaigns, feedbackForms: state.feedbackForms.map((x) => (x.id === formId ? { ...x, status: 'published', publishedAt: nowIso(), changeNote: note } : x)) }, session.email, 'Publicació de qüestionari d’Et veig', `${f.stage} v${f.version}: ${note || 'sense nota'}`))
}

export const gradeOf = (id: GradeId) => GRADES.find((g) => g.id === id)!

/** Estat actual (per a proves i operacions fora de React). */
export const snapshot = (): DemoState => state
