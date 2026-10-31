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
import { checkGroupLabel, setGroupConfig } from '../domain/groups'
import type {
  Answers, Campaign, CampaignStatus, FeedbackAnswer, FeedbackCampaign, FeedbackComment, FeedbackForm, FeedbackStatus, GradeId, GradeSubject, Guardian, MailSettings, ModerationStatus, Modules,
  Section, SelfAssessment, Session, StageId, Student, StudentResponse, Subject, TemplateVersion,
} from '../domain/types'
import type { AssignmentRow, GuardianRow } from '../domain/csv'
import { checkSchoolEmail } from '../domain/email'
import { cleanMail, validateMail } from '../domain/mail'
import { createDemoState, DEMO_VERSION, type DemoState } from './seed'

const KEY = 'mavaluo:demo'

export class ForbiddenError extends Error {}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as DemoState
      // Les dades desades abans que hi hagués la configuració del correu la prenen per defecte.
      if (s.version === DEMO_VERSION) return { ...s, mail: cleanMail(s.mail) }
    }
  } catch {
    /* sense emmagatzematge: es treballa en memòria */
  }
  return createDemoState()
}

let state: DemoState = load()
setGroupConfig(state.classGroups)
const listeners = new Set<() => void>()

/** En mode connectat (o al servidor) no es desa res al navegador: les dades reals no surten mai de la sessió. */
let persistLocal = true

function commit(next: DemoState) {
  state = next
  setGroupConfig(next.classGroups)
  if (persistLocal) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* ignorat */
    }
  }
  listeners.forEach((l) => l())
}

/** Mode connectat: substitueix l'estat pel que envia el servidor (ja retallat segons la sessió). */
export function hydrate(next: DemoState) {
  persistLocal = false
  commit(next)
}

/**
 * Executa operacions sobre un estat donat i en torna el resultat. El servidor ho fa servir per aplicar
 * exactament les mateixes regles que la demostració sobre les dades de la base de dades.
 */
export function runWithState<T>(s: DemoState, fn: () => T): { state: DemoState; result: T } {
  const saved = state
  const savedPersist = persistLocal
  state = s
  persistLocal = false
  setGroupConfig(s.classGroups)
  try {
    const result = fn()
    return { state, result }
  } finally {
    state = saved
    persistLocal = savedPersist
    setGroupConfig(saved.classGroups)
  }
}

/** Destí de les operacions en mode connectat (vegeu remote.ts). */
let opSink: ((name: string, args: unknown[]) => void) | null = null
export function connectOps(sink: ((name: string, args: unknown[]) => void) | null) {
  opSink = sink
}

/** Cada operació s'aplica primer aquí (resposta immediata) i, en mode connectat, s'envia al servidor. */
function op<A extends unknown[], R>(name: string, fn: (session: Session, ...args: A) => R): (session: Session, ...args: A) => R {
  return (session, ...args) => {
    const result = fn(session, ...args)
    opSink?.(name, args)
    return result
  }
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
  // L'Equip Directiu fa el seguiment de tot l'alumnat.
  if (session.role === 'admin' || isDirection(session)) return true
  if (session.role === 'teacher') return !!session.groups?.includes(groupKey(st))
  return session.studentId === st.id
}

function requireAdmin(session: Session) {
  if (session.role !== 'admin') throw new ForbiddenError('Aquesta acció només la pot fer l’administració.')
}

/** Recollides d'«Et veig…»: les gestiona l'administració o l'Equip Directiu. */
function requireAdminOrDirection(session: Session) {
  if (session.role !== 'admin' && !isDirection(session)) throw new ForbiddenError('Aquesta acció només la pot fer l’administració o l’Equip Directiu.')
}

export const visibleStudents = (s: DemoState, session: Session) => s.students.filter((st) => canSeeStudent(session, st))

export const visibleGrades = (s: DemoState, session: Session): GradeId[] =>
  session.role === 'admin' || isDirection(session) ? GRADES.map((g) => g.id) : [...new Set(visibleStudents(s, session).map((x) => x.gradeId))]

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

function saveDraft$(session: Session, campaignId: string, answers: Answers) {
  const { student } = ownOpenCampaign(session, campaignId)
  const prev = state.responses.find((r) => r.campaignId === campaignId && r.studentId === student.id)
  const next: StudentResponse = prev
    ? { ...prev, answers, updatedAt: nowIso(), status: prev.status === 'NO_INICIADA' ? 'EN_CURS' : prev.status }
    : { campaignId, studentId: student.id, status: 'EN_CURS', answers, updatedAt: nowIso(), revision: 0 }
  commit({ ...state, responses: [...state.responses.filter((r) => r !== prev), next] })
}

function submitResponse$(session: Session, campaignId: string, answers: Answers) {
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

function setCampaignStatus$(session: Session, campaignId: string, status: CampaignStatus, reason?: string) {
  const c = state.campaigns.find((x) => x.id === campaignId)
  if (!c) return
  const own = session.role === 'teacher' && session.groups?.some((g) => g.startsWith(c.gradeId + '-'))
  if (session.role !== 'admin' && !own) throw new ForbiddenError('No tens permís sobre aquesta recollida.')
  if (status === 'DISTRIBUIDA' && c.status === 'OBERTA') throw new Error('No es poden distribuir informes d’una recollida oberta.')
  commit(audit({ ...state, campaigns: state.campaigns.map((x) => (x.id === campaignId ? { ...x, status } : x)) }, session.email, 'Estat de recollida', `${c.gradeId} · ${c.label}: ${c.status} → ${status}${reason ? ` (${reason})` : ''}`))
}

function updateCampaign$(session: Session, campaignId: string, patch: Partial<Pick<Campaign, 'start' | 'end' | 'label'>>, reason: string) {
  requireAdmin(session)
  const c = state.campaigns.find((x) => x.id === campaignId)!
  commit(audit({ ...state, campaigns: state.campaigns.map((x) => (x.id === campaignId ? { ...x, ...patch } : x)) }, session.email, 'Canvi de recollida', `${c.gradeId} · ${c.label}: ${reason}`))
}

function createCampaign$(session: Session, gradeId: GradeId, label: string, start: string, end: string) {
  requireAdmin(session)
  const stage = GRADES.find((g) => g.id === gradeId)!.stage
  const tpl = state.templates.filter((t) => t.stage === stage && t.status === 'published').sort((a, b) => b.version - a.version)[0]
  if (!tpl) throw new Error('No hi ha cap qüestionari publicat per a aquesta etapa.')
  const id = crypto.randomUUID()
  const campaign: Campaign = { id, year: state.year, gradeId, label, templateVersionId: tpl.id, start, end, status: 'PROGRAMADA', subjectsSnapshot: state.gradeSubjects.filter((g) => g.gradeId === gradeId).map((g) => ({ ...g })) }
  commit(audit({ ...state, campaigns: [...state.campaigns, campaign] }, session.email, 'Nova recollida', `${gradeId} · ${label} amb ${tpl.name} v${tpl.version}`))
}

function setGradeSubject$(session: Session, gs: GradeSubject) {
  requireAdmin(session)
  const exists = state.gradeSubjects.some((x) => x.gradeId === gs.gradeId && x.subjectId === gs.subjectId)
  const list = exists ? state.gradeSubjects.map((x) => (x.gradeId === gs.gradeId && x.subjectId === gs.subjectId ? gs : x)) : [...state.gradeSubjects, gs]
  commit(audit({ ...state, gradeSubjects: list }, session.email, 'Matèries', `${gs.gradeId} · ${gs.subjectId}: ${gs.active ? 'activa' : 'desactivada'}${gs.optional ? ', optativa' : ''}`))
}

function moveGradeSubject$(session: Session, gradeId: GradeId, subjectId: string, dir: -1 | 1) {
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

function saveTemplateDraft$(session: Session, t: TemplateVersion) {
  requireAdmin(session)
  if (t.status !== 'draft' || !state.templates.some((x) => x.templateId === t.templateId && x.stage === t.stage) || !Array.isArray(t.sections)) throw new Error('Esborrany no vàlid.')
  const published = state.templates.find((x) => x.id === t.id && x.status === 'published')
  if (published) throw new Error('Una versió publicada no es pot modificar: crea’n una de nova.')
  const exists = state.templates.some((x) => x.id === t.id)
  commit({ ...state, templates: exists ? state.templates.map((x) => (x.id === t.id ? t : x)) : [...state.templates, t] })
}

function newDraftFrom$(session: Session, versionId: string): TemplateVersion {
  requireAdmin(session)
  const base = state.templates.find((t) => t.id === versionId)!
  const existing = state.templates.find((t) => t.templateId === base.templateId && t.status === 'draft')
  if (existing) return existing
  const version = Math.max(...state.templates.filter((t) => t.templateId === base.templateId).map((t) => t.version)) + 1
  const draft: TemplateVersion = { ...structuredClone(base), id: `${base.templateId}-v${version}`, version, status: 'draft', publishedAt: undefined, changeNote: '' }
  commit({ ...state, templates: [...state.templates, draft] })
  return draft
}

function discardDraft$(session: Session, versionId: string) {
  requireAdmin(session)
  commit({ ...state, templates: state.templates.filter((t) => !(t.id === versionId && t.status === 'draft')) })
}

function publishTemplate$(session: Session, versionId: string, note: string) {
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
function adoptTemplateInScheduled$(session: Session, versionId: string): number {
  requireAdmin(session)
  const t = state.templates.find((x) => x.id === versionId)!
  const stageGrades = GRADES.filter((g) => g.stage === t.stage).map((g) => g.id)
  const targets = state.campaigns.filter((c) => stageGrades.includes(c.gradeId) && (c.status === 'ESBORRANY' || c.status === 'PROGRAMADA'))
  if (!targets.length) return 0
  commit({ ...state, campaigns: state.campaigns.map((c) => (targets.includes(c) ? { ...c, templateVersionId: versionId } : c)) })
  return targets.length
}

function addStaff$(session: Session, email: string, name: string, role: 'admin' | 'teacher', groups: string[]) {
  requireAdmin(session)
  const check = checkSchoolEmail(email)
  if (!check.ok) throw new Error(check.reason)
  const rest = state.staff.filter((s) => s.email !== check.email)
  const direction = state.staff.find((s) => s.email === check.email)?.direction
  commit(audit({ ...state, staff: [...rest, { email: check.email, name, role, groups, ...(direction ? { direction } : {}) }] }, session.email, 'Permisos', `${check.email}: ${role === 'admin' ? 'administració' : `professorat (${groups.join(', ') || 'sense grups'})`}`))
}

/**
 * Pertinença a l'Equip Directiu (permís per veure els resultats d'«Et veig…»).
 * La pot donar o treure l'administració o algú que ja en forma part, mai a si mateix.
 */
function setDirection$(session: Session, email: string, on: boolean) {
  requireAdminOrDirection(session)
  if (email === session.email) throw new Error('No pots canviar la teva pròpia pertinença a l’Equip Directiu.')
  const target = state.staff.find((s) => s.email === email)
  if (!target) throw new Error('Aquesta persona no té accés a l’aplicació.')
  commit(
    audit(
      { ...state, staff: state.staff.map((s) => (s.email === email ? { ...s, direction: on } : s)) },
      session.email,
      'Permisos',
      `${email}: ${on ? 'afegit a' : 'tret de'} l’Equip Directiu`,
    ),
  )
}

function removeStaff$(session: Session, email: string) {
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
function importCensus$(session: Session, rows: CensusRow[]): number {
  requireAdmin(session)
  const ok = rows.filter(
    (r) =>
      !r.issues.length && r.gradeId && GRADES.some((g) => g.id === r.gradeId) && typeof r.id === 'string' && r.id.trim() && r.name?.trim() && r.surname?.trim() &&
      checkSchoolEmail(r.email).ok && (state.classGroups[r.gradeId] ?? []).includes(r.group),
  )
  const byId = new Map(state.students.map((s) => [s.id, s]))
  for (const r of ok) {
    const prev = byId.get(r.id)
    byId.set(r.id, { id: r.id, name: r.name, surname: r.surname, email: r.email, gradeId: r.gradeId!, group: r.group, electives: prev?.electives ?? [], guardians: prev?.guardians ?? [] })
  }
  commit(audit({ ...state, students: [...byId.values()] }, session.email, 'Importació de cens', `${ok.length} alumnes importats o actualitzats`))
  return ok.length
}

// ---------- Correus de les famílies ----------

/** Substitueix els responsables de cada alumne que surt al fitxer; la resta d'alumnes no canvia. */
function importGuardians$(session: Session, rows: GuardianRow[]): number {
  requireAdminOrDirection(session)
  const by = new Map<string, Guardian[]>()
  for (const r of rows) {
    if (!state.students.some((x) => x.id === r.studentId) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.guardian?.email ?? '')) throw new Error(`Fila ${r.line}: dades no vàlides.`)
    const g = { name: String(r.guardian.name ?? '').slice(0, 120) || 'Família', email: r.guardian.email.toLowerCase(), validated: true }
    by.set(r.studentId, [...(by.get(r.studentId) ?? []), g])
  }
  commit(
    audit(
      { ...state, students: state.students.map((st) => (by.has(st.id) ? { ...st, guardians: by.get(st.id)! } : st)) },
      session.email,
      'Correus de les famílies',
      `${rows.length} correus importats per a ${by.size} alumnes`,
    ),
  )
  return by.size
}

function setGuardianValidated$(session: Session, studentId: string, email: string, validated: boolean) {
  requireAdminOrDirection(session)
  commit(
    audit(
      { ...state, students: state.students.map((st) => (st.id === studentId ? { ...st, guardians: st.guardians.map((g) => (g.email === email ? { ...g, validated } : g)) } : st)) },
      session.email,
      'Correus de les famílies',
      `${studentId}: ${email} ${validated ? 'validat' : 'pendent de validar'}`,
    ),
  )
}

function removeGuardian$(session: Session, studentId: string, email: string) {
  requireAdminOrDirection(session)
  commit(audit({ ...state, students: state.students.map((st) => (st.id === studentId ? { ...st, guardians: st.guardians.filter((g) => g.email !== email) } : st)) }, session.email, 'Correus de les famílies', `${studentId}: ${email} eliminat`))
}

// ---------- Grups de cada curs ----------

function addClassGroup$(session: Session, gradeId: GradeId, label: string) {
  requireAdmin(session)
  const cur = state.classGroups[gradeId] ?? []
  const err = checkGroupLabel(label, cur)
  if (err) throw new Error(err)
  commit(audit({ ...state, classGroups: { ...state.classGroups, [gradeId]: [...cur, label.trim()] } }, session.email, 'Grups', `${gradeId}: nou grup «${label.trim()}»`))
}

/** Canvia el nom d'un grup a tot arreu: alumnat, assignacions i grups del professorat. */
function renameClassGroup$(session: Session, gradeId: GradeId, from: string, to: string) {
  requireAdmin(session)
  const cur = state.classGroups[gradeId] ?? []
  const err = checkGroupLabel(to, cur.filter((x) => x !== from))
  if (err) throw new Error(err)
  const t = to.trim()
  const key = (g: string) => (g === `${gradeId}-${from}` ? `${gradeId}-${t}` : g)
  commit(
    audit(
      {
        ...state,
        classGroups: { ...state.classGroups, [gradeId]: cur.map((x) => (x === from ? t : x)) },
        students: state.students.map((x) => (x.gradeId === gradeId && x.group === from ? { ...x, group: t } : x)),
        assignments: state.assignments.map((a) => (a.gradeId === gradeId && a.group === from ? { ...a, group: t } : a)),
        staff: state.staff.map((p) => ({ ...p, groups: p.groups.map(key) })),
      },
      session.email,
      'Grups',
      `${gradeId}: «${from}» passa a dir-se «${t}»`,
    ),
  )
}

/** Només es pot treure un grup buit, sense assignacions i que no sigui l'únic del curs. */
function removeClassGroup$(session: Session, gradeId: GradeId, label: string) {
  requireAdmin(session)
  const cur = state.classGroups[gradeId] ?? []
  if (cur.length <= 1) throw new Error('Cada curs ha de tenir com a mínim un grup.')
  if (state.students.some((x) => x.gradeId === gradeId && x.group === label)) throw new Error('Aquest grup encara té alumnes: canvia’ls de grup abans de treure’l.')
  commit(
    audit(
      {
        ...state,
        classGroups: { ...state.classGroups, [gradeId]: cur.filter((x) => x !== label) },
        assignments: state.assignments.filter((a) => !(a.gradeId === gradeId && a.group === label)),
        staff: state.staff.map((p) => ({ ...p, groups: p.groups.filter((g) => g !== `${gradeId}-${label}`) })),
      },
      session.email,
      'Grups',
      `${gradeId}: grup «${label}» eliminat`,
    ),
  )
}

/** Canvia un alumne de grup (dins del seu curs). */
function setStudentGroup$(session: Session, studentId: string, group: string) {
  requireAdmin(session)
  const st = state.students.find((x) => x.id === studentId)
  if (!st || !(state.classGroups[st.gradeId] ?? []).includes(group)) throw new Error('Aquest grup no existeix en aquest curs.')
  commit(audit({ ...state, students: state.students.map((x) => (x.id === studentId ? { ...x, group } : x)) }, session.email, 'Grups', `${studentId}: grup ${st.group} → ${group}`))
}

function setElective$(session: Session, studentId: string, subjectId: string, on: boolean) {
  requireAdmin(session)
  if (!state.subjects.some((x) => x.id === subjectId)) throw new Error('Aquesta matèria no existeix.')
  commit({ ...state, students: state.students.map((s) => (s.id === studentId ? { ...s, electives: on ? [...new Set([...s.electives, subjectId])] : s.electives.filter((x) => x !== subjectId) } : s)) })
}

function logAudit$(session: Session, action: string, detail: string) {
  action = String(action).slice(0, 80)
  detail = String(detail).slice(0, 500)
  commit(audit(state, session.email, action, detail))
}

export function resetDemo() {
  commit(createDemoState())
}

// ---------- Configuració general ----------

function setModules$(session: Session, patch: Partial<Modules>) {
  requireAdmin(session)
  const modules = { ...state.modules, ...patch }
  commit(audit({ ...state, modules }, session.email, 'Apartats', `Em miro: ${modules.emMiro ? 'actiu' : 'inactiu'} · Et veig…: ${modules.etVeig ? 'actiu' : 'inactiu'}`))
}

function setMail$(session: Session, patch: Partial<MailSettings>) {
  requireAdmin(session)
  const mail = cleanMail({ ...state.mail, ...patch })
  const problem = validateMail(mail)
  if (problem) throw new Error(problem)
  const from = mail.sender || 'pendent'
  commit(audit({ ...state, mail }, session.email, 'Correu', `Remitent: ${mail.senderName} <${from}> · respostes: ${mail.replyTo === 'tutor' ? 'tutoria' : mail.replyToEmail}`))
}

function setAssignment$(session: Session, gradeId: GradeId, group: string, subjectId: string, teacherEmail: string | null) {
  requireAdmin(session)
  if (teacherEmail && !state.staff.some((x) => x.email === teacherEmail)) throw new Error(`${teacherEmail} no té accés a l’aplicació.`)
  const rest = state.assignments.filter((a) => !(a.gradeId === gradeId && a.group === group && a.subjectId === subjectId))
  const assignments = teacherEmail ? [...rest, { gradeId, group, subjectId, teacherEmail }] : rest
  commit(audit({ ...state, assignments }, session.email, 'Assignació docent', `${gradeId} ${group} · ${subjectId}: ${teacherEmail ?? 'sense docent'}`))
}

/** Aplica d'una vegada les assignacions validades d'una importació CSV. */
function importAssignments$(session: Session, rows: AssignmentRow[]): number {
  requireAdmin(session)
  for (const r of rows)
    if (!state.staff.some((x) => x.email === r.teacherEmail) || !(state.classGroups[r.gradeId] ?? []).includes(r.group) || !state.subjects.some((x) => x.id === r.subjectId))
      throw new Error(`Fila ${r.line}: dades no vàlides.`)
  const keys = new Set(rows.map((r) => `${r.gradeId}|${r.group}|${r.subjectId}`))
  const kept = state.assignments.filter((a) => !keys.has(`${a.gradeId}|${a.group}|${a.subjectId}`))
  const added = rows.map(({ gradeId, group, subjectId, teacherEmail }) => ({ gradeId, group, subjectId, teacherEmail }))
  commit(audit({ ...state, assignments: [...kept, ...added] }, session.email, 'Assignació docent', `Importació CSV: ${rows.length} assignacions`))
  return rows.length
}

// ---------- Et veig…: permisos ----------

export const isDirection = (session: Session) => !!state.staff.find((s) => s.email === session.email)?.direction

/** Resultats d'«Et veig…»: el mateix docent o l'Equip Directiu. L'administració sense permís de direcció, no. */
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

// ---------- Et veig…: alumne ----------

export interface FeedbackTarget extends TeacherTarget {
  status: 'pendent' | 'esborrany' | 'lliurat'
  draft?: Answers
}

export interface FeedbackHome {
  campaign: Pick<FeedbackCampaign, 'id' | 'label' | 'end'>
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

// ---------- Et veig…: autoavaluació docent ----------

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

// ---------- Et veig…: administració ----------

export function setFeedbackStatus(session: Session, campaignId: string, status: FeedbackStatus) {
  requireAdminOrDirection(session)
  const c = state.feedbackCampaigns.find((x) => x.id === campaignId)!
  if (status === 'INFORMES_GENERATS' && state.feedbackComments.some((x) => x.campaignId === campaignId && x.status === 'pendent'))
    throw new Error('Encara hi ha comentaris pendents de moderar.')
  if (status === 'OBERTA' && state.feedbackCampaigns.some((x) => x.id !== campaignId && x.status === 'OBERTA' && x.stages.some((st) => c.stages.includes(st))))
    throw new Error('Ja hi ha una altra recollida d’«Et veig…» oberta per a alguna d’aquestes etapes.')
  // En obrir-la, es congelen les assignacions docents vigents.
  const patch = status === 'OBERTA' && c.status !== 'TANCADA' ? { assignments: state.assignments.map((a) => ({ ...a })), teachers: [...new Set(state.assignments.map((a) => a.teacherEmail))] } : {}
  commit(audit({ ...state, feedbackCampaigns: state.feedbackCampaigns.map((x) => (x.id === campaignId ? { ...x, ...patch, status } : x)) }, session.email, 'Estat de recollida d’Et veig…', `${c.label}: ${c.status} → ${status}`))
}

function createFeedbackCampaign$(session: Session, label: string, stages: StageId[], start: string, end: string) {
  requireAdminOrDirection(session)
  if (!stages.length) throw new Error('Tria com a mínim una etapa.')
  const formIds: Partial<Record<StageId, string>> = {}
  for (const st of stages) {
    const f = state.feedbackForms.filter((x) => x.stage === st && x.status === 'published').sort((a, b) => b.version - a.version)[0]
    if (!f) throw new Error(`No hi ha cap qüestionari d’«Et veig…» publicat per a ${st}.`)
    formIds[st] = f.id
  }
  const c: FeedbackCampaign = {
    id: crypto.randomUUID(), year: state.year, label, stages, start, end, status: 'PROGRAMADA', formIds,
    assignments: state.assignments.map((a) => ({ ...a })), teachers: [...new Set(state.assignments.map((a) => a.teacherEmail))],
  }
  commit(audit({ ...state, feedbackCampaigns: [...state.feedbackCampaigns, c] }, session.email, 'Nova recollida d’Et veig…', `${label} · ${stages.join(', ')}`))
}

export function moderateComment(session: Session, commentId: string, status: Exclude<ModerationStatus, 'pendent'>, text?: string) {
  if (!isDirection(session)) throw new ForbiddenError('La moderació dels comentaris la fa l’Equip Directiu.')
  commit({
    ...state,
    feedbackComments: state.feedbackComments.map((x) =>
      x.id === commentId ? { ...x, status, published: status === 'descartat' ? undefined : status === 'editat' ? (text ?? '').trim() : x.original } : x,
    ),
  })
}

export function acceptUnflagged(session: Session, campaignId: string): number {
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

function saveFeedbackFormDraft$(session: Session, f: FeedbackForm) {
  requireAdmin(session)
  if (f.status !== 'draft' || !state.feedbackForms.some((x) => x.templateId === f.templateId && x.stage === f.stage)) throw new Error('Esborrany no vàlid.')
  if (state.feedbackForms.some((x) => x.id === f.id && x.status === 'published')) throw new Error('Una versió publicada no es pot modificar: crea’n una de nova.')
  const exists = state.feedbackForms.some((x) => x.id === f.id)
  commit({ ...state, feedbackForms: exists ? state.feedbackForms.map((x) => (x.id === f.id ? f : x)) : [...state.feedbackForms, f] })
}

function newFeedbackDraft$(session: Session, formId: string): FeedbackForm {
  requireAdmin(session)
  const base = state.feedbackForms.find((f) => f.id === formId)!
  const existing = state.feedbackForms.find((f) => f.templateId === base.templateId && f.status === 'draft')
  if (existing) return existing
  const version = Math.max(...state.feedbackForms.filter((f) => f.templateId === base.templateId).map((f) => f.version)) + 1
  const draft: FeedbackForm = { ...structuredClone(base), id: `${base.templateId}-v${version}`, version, status: 'draft', publishedAt: undefined, changeNote: '' }
  commit({ ...state, feedbackForms: [...state.feedbackForms, draft] })
  return draft
}

function discardFeedbackDraft$(session: Session, formId: string) {
  requireAdmin(session)
  commit({ ...state, feedbackForms: state.feedbackForms.filter((f) => !(f.id === formId && f.status === 'draft')) })
}

function publishFeedbackForm$(session: Session, formId: string, note: string) {
  requireAdmin(session)
  const f = state.feedbackForms.find((x) => x.id === formId)!
  const issues = validateFeedbackForm(f)
  if (issues.length) throw new Error(issues[0])
  // Les recollides que encara no s'han obert passen a fer servir la versió nova.
  const feedbackCampaigns = state.feedbackCampaigns.map((c) => (c.stages.includes(f.stage) && ['ESBORRANY', 'PROGRAMADA'].includes(c.status) ? { ...c, formIds: { ...c.formIds, [f.stage]: f.id } } : c))
  commit(audit({ ...state, feedbackCampaigns, feedbackForms: state.feedbackForms.map((x) => (x.id === formId ? { ...x, status: 'published', publishedAt: nowIso(), changeNote: note } : x)) }, session.email, 'Publicació de qüestionari d’Et veig…', `${f.stage} v${f.version}: ${note || 'sense nota'}`))
}

export const gradeOf = (id: GradeId) => GRADES.find((g) => g.id === id)!

/** Estat actual (per a proves i operacions fora de React). */
export const snapshot = (): DemoState => state

// ---------- Operacions ----------

export const saveDraft = op('saveDraft', saveDraft$)
export const submitResponse = op('submitResponse', submitResponse$)
export const setCampaignStatus = op('setCampaignStatus', setCampaignStatus$)
export const updateCampaign = op('updateCampaign', updateCampaign$)
export const createCampaign = op('createCampaign', createCampaign$)
export const setGradeSubject = op('setGradeSubject', setGradeSubject$)
export const moveGradeSubject = op('moveGradeSubject', moveGradeSubject$)
export const saveTemplateDraft = op('saveTemplateDraft', saveTemplateDraft$)
export const newDraftFrom = op('newDraftFrom', newDraftFrom$)
export const discardDraft = op('discardDraft', discardDraft$)
export const publishTemplate = op('publishTemplate', publishTemplate$)
export const adoptTemplateInScheduled = op('adoptTemplateInScheduled', adoptTemplateInScheduled$)
export const addStaff = op('addStaff', addStaff$)
export const setDirection = op('setDirection', setDirection$)
export const removeStaff = op('removeStaff', removeStaff$)
export const importCensus = op('importCensus', importCensus$)
export const importGuardians = op('importGuardians', importGuardians$)
export const setGuardianValidated = op('setGuardianValidated', setGuardianValidated$)
export const removeGuardian = op('removeGuardian', removeGuardian$)
export const addClassGroup = op('addClassGroup', addClassGroup$)
export const renameClassGroup = op('renameClassGroup', renameClassGroup$)
export const removeClassGroup = op('removeClassGroup', removeClassGroup$)
export const setStudentGroup = op('setStudentGroup', setStudentGroup$)
export const setElective = op('setElective', setElective$)
export const logAudit = op('logAudit', logAudit$)
export const setModules = op('setModules', setModules$)
export const setMail = op('setMail', setMail$)
export const setAssignment = op('setAssignment', setAssignment$)
export const importAssignments = op('importAssignments', importAssignments$)
export const createFeedbackCampaign = op('createFeedbackCampaign', createFeedbackCampaign$)
export const saveFeedbackFormDraft = op('saveFeedbackFormDraft', saveFeedbackFormDraft$)
export const newFeedbackDraft = op('newFeedbackDraft', newFeedbackDraft$)
export const discardFeedbackDraft = op('discardFeedbackDraft', discardFeedbackDraft$)
export const publishFeedbackForm = op('publishFeedbackForm', publishFeedbackForm$)

/** Les mateixes operacions sense enviar res: el servidor les executa amb runWithState. */
export const SERVER_OPS = {
  saveDraft: saveDraft$,
  submitResponse: submitResponse$,
  setCampaignStatus: setCampaignStatus$,
  updateCampaign: updateCampaign$,
  createCampaign: createCampaign$,
  setGradeSubject: setGradeSubject$,
  moveGradeSubject: moveGradeSubject$,
  saveTemplateDraft: saveTemplateDraft$,
  newDraftFrom: newDraftFrom$,
  discardDraft: discardDraft$,
  publishTemplate: publishTemplate$,
  adoptTemplateInScheduled: adoptTemplateInScheduled$,
  addStaff: addStaff$,
  setDirection: setDirection$,
  removeStaff: removeStaff$,
  importCensus: importCensus$,
  importGuardians: importGuardians$,
  setGuardianValidated: setGuardianValidated$,
  removeGuardian: removeGuardian$,
  addClassGroup: addClassGroup$,
  renameClassGroup: renameClassGroup$,
  removeClassGroup: removeClassGroup$,
  setStudentGroup: setStudentGroup$,
  setElective: setElective$,
  logAudit: logAudit$,
  setModules: setModules$,
  setMail: setMail$,
  setAssignment: setAssignment$,
  importAssignments: importAssignments$,
  createFeedbackCampaign: createFeedbackCampaign$,
  saveFeedbackFormDraft: saveFeedbackFormDraft$,
  newFeedbackDraft: newFeedbackDraft$,
  discardFeedbackDraft: discardFeedbackDraft$,
  publishFeedbackForm: publishFeedbackForm$,
}
