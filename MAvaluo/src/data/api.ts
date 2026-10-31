// Capa de dades. `DemoApi` simula al navegador el servidor previst (Neon + API amb autorització):
// cada operació comprova els permisos de la sessió, com ho farà el backend real.
// Per connectar-hi Neon, cal implementar la mateixa interfície amb crides HTTP.

import { useSyncExternalStore } from 'react'
import { GRADES } from '../domain/catalog'
import { buildSteps, findMissing, subjectsForStudent } from '../domain/engine'
import type { Answers, Campaign, CampaignStatus, GradeId, GradeSubject, Section, Session, Student, StudentResponse, Subject, TemplateVersion } from '../domain/types'
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
  if (staff) return { email, name: staff.name, role: staff.role, groups: staff.groups, picture: profile?.picture }
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
  const campaign = mine.find((c) => c.status === 'OBERTA')
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
  if (campaign.status !== 'OBERTA') throw new ForbiddenError('Aquesta autoavaluació ja està tancada.')
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

export const gradeOf = (id: GradeId) => GRADES.find((g) => g.id === id)!
