// Lògica d'«Et veig…»: quins docents valora cada alumne, codificació anònima de les respostes,
// agregació amb el llindar mínim i informes «Així et veiem» i de centre. Independent de la interfície.

import { GRADES, STAGES } from './catalog'
import { subjectsForStudent } from './engine'
import type {
  Answers, FeedbackAnswer, FeedbackCampaign, FeedbackComment, FeedbackDimension, FeedbackForm, FeedbackItem, GradeId, GradeSubject,
  Participation, Scale, SelfAssessment, StaffMember, StageId, Student, Subject, TeachingAssignment,
} from './types'

/** Mínim de respostes per mostrar qualsevol resultat agregat (decisió acordada). */
export const THRESHOLD = 15
/** Valor normalitzat (0-1) a partir del qual una valoració es considera alta. */
const HIGH = 0.66

export interface FeedbackData {
  year: string
  students: Student[]
  staff: StaffMember[]
  subjects: Subject[]
  gradeSubjects: GradeSubject[]
  feedbackForms: FeedbackForm[]
  feedbackCampaigns: FeedbackCampaign[]
  feedbackAnswers: FeedbackAnswer[]
  feedbackComments: FeedbackComment[]
  selfAssessments: SelfAssessment[]
  participation: Participation[]
}

export const stageOfGrade = (g: GradeId): StageId => GRADES.find((x) => x.id === g)!.stage
export const groupKey = (gradeId: GradeId, group: string) => `${gradeId}-${group}`

// ---------- Qui valora qui ----------

export interface TeacherTarget {
  email: string
  name: string
  subjects: Subject[]
}

/** Docents d'un alumne: els que li fan alguna matèria que cursa. Cadascun hi surt UNA sola vegada. */
export function teachersForStudent(student: Student, assignments: TeachingAssignment[], gradeSubjects: GradeSubject[], catalog: Subject[], staff: StaffMember[], only?: string[]): TeacherTarget[] {
  const mine = new Set(subjectsForStudent(gradeSubjects, student, catalog).map((s) => s.id))
  const map = new Map<string, TeacherTarget>()
  for (const a of assignments) {
    if (a.gradeId !== student.gradeId || a.group !== student.group || !mine.has(a.subjectId)) continue
    if (only && !only.includes(a.teacherEmail)) continue
    const subject = catalog.find((s) => s.id === a.subjectId)!
    const t = map.get(a.teacherEmail) ?? { email: a.teacherEmail, name: staff.find((s) => s.email === a.teacherEmail)?.name ?? a.teacherEmail, subjects: [] }
    if (!t.subjects.some((x) => x.id === subject.id)) t.subjects.push(subject)
    map.set(a.teacherEmail, t)
  }
  return [...map.values()]
}

/** Ordre aleatori però estable per alumne: el cansament no perjudica sempre els mateixos docents. */
export function stableShuffle<T>(list: T[], seed: string): T[] {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const r = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 2 ** 32
  }
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Docents que han de fer l'autoavaluació en una etapa d'una recollida. */
export function stagesOfTeacher(c: FeedbackCampaign, email: string): StageId[] {
  return c.stages.filter((st) => c.assignments.some((a) => a.teacherEmail === email && stageOfGrade(a.gradeId) === st))
}

// ---------- Codificació de les respostes (sense identitat) ----------

export function encodeAnswers(form: FeedbackForm, answers: Answers): string {
  return form.items.map((i) => (answers[i.id] === 'NA' ? '0' : answers[i.id] && /^[1-9]$/.test(answers[i.id]) ? answers[i.id] : '-')).join('')
}

export const missingItems = (form: FeedbackForm, answers: Answers) => form.items.filter((i) => !answers[i.id])

// ---------- Agregació ----------

export interface Dist {
  /** Recompte per opció (índex 0 = valor 1). */
  counts: number[]
  na: number
  /** Respostes vàlides (sense «No ho puc valorar» ni buits). */
  valid: number
  /** Proporció de valoracions favorables (opcions superiors). */
  fav: number
  /** Mitjana normalitzada 0-1. */
  mean: number
}

const favFrom = (n: number) => (n >= 4 ? n - 1 : n) // 4 opcions: Sovint i Sempre; 3 opcions: només la més alta

export function distOf(values: string[], nOptions: number): Dist {
  const counts = Array(nOptions).fill(0) as number[]
  let na = 0
  for (const v of values) {
    if (v === '0') na++
    else if (v >= '1' && v <= String(nOptions)) counts[Number(v) - 1]++
  }
  const valid = counts.reduce((a, b) => a + b, 0)
  const fav = valid ? counts.slice(favFrom(nOptions) - 1).reduce((a, b) => a + b, 0) / valid : 0
  const mean = valid ? counts.reduce((a, c, i) => a + c * (i / (nOptions - 1)), 0) / valid : 0
  return { counts, na, valid, fav, mean }
}

const valuesFor = (answers: FeedbackAnswer[], form: FeedbackForm, items: FeedbackItem[]) => {
  const idx = items.map((it) => form.items.findIndex((x) => x.id === it.id)).filter((i) => i >= 0)
  return answers.flatMap((a) => (a.formId === form.id ? idx.map((i) => a.v[i]) : []))
}

/** Mitjana normalitzada de l'autoavaluació en una dimensió (o undefined si no hi ha respostes). */
export function selfScore(self: SelfAssessment | undefined, form: FeedbackForm, dimensionId: string, nOptions: number): number | undefined {
  if (!self) return undefined
  const vals = form.items.filter((i) => i.dimensionId === dimensionId).map((i) => self.answers[i.id]).filter((v) => v && v !== 'NA').map(Number)
  if (!vals.length) return undefined
  return vals.reduce((a, v) => a + (v - 1) / (nOptions - 1), 0) / vals.length
}

export type Quadrant = 'confirmades' | 'cecs' | 'ocultes' | 'reptes'

export const QUADRANTS: Record<Quadrant, { title: string; help: string }> = {
  confirmades: { title: 'Fortaleses confirmades', help: 'Tu i l’alumnat ho valoreu alt.' },
  cecs: { title: 'Punts cecs', help: 'Tu ho valores alt; l’alumnat, més baix.' },
  ocultes: { title: 'Fortaleses ocultes', help: 'L’alumnat ho valora més alt que tu.' },
  reptes: { title: 'Reptes reconeguts', help: 'Tu i l’alumnat hi veieu marge de millora.' },
}

export const quadrantOf = (students: number, self: number): Quadrant =>
  students >= HIGH ? (self >= HIGH ? 'confirmades' : 'ocultes') : self >= HIGH ? 'cecs' : 'reptes'

/** Etiqueta de l'escala més propera a una mitjana normalitzada. */
export const nearestLabel = (scale: Scale, mean01: number) => scale.options[Math.round(mean01 * (scale.options.length - 1))]?.label ?? ''

// ---------- Llindar de confidencialitat ----------

const emptyDist = (nOptions: number): Dist => ({ counts: Array(nOptions).fill(0) as number[], na: 0, valid: 0, fav: 0, mean: 0 })

/**
 * Treu de l'informe tot el que queda per sota del llindar, no només ho amaga:
 * així el que surt del càlcul ja és segur d'enviar al navegador.
 */
function redactStage(r: StageReport): StageReport {
  const nOpt = r.scale.options.length
  const groups = r.groups.map((g) => (g.shown && !r.suppressed ? g : { ...g, fav: {}, items: {} }))
  if (!r.suppressed) return { ...r, groups }
  return {
    ...r,
    dims: r.dims.map((x) => ({ ...x, dist: emptyDist(nOpt), quadrant: undefined })),
    items: [],
    groups,
    previous: undefined,
    comments: [],
  }
}

// ---------- Informe «Així et veiem» ----------

export interface DimRow {
  dim: FeedbackDimension
  dist: Dist
  self?: number
  quadrant?: Quadrant
}

export interface GroupRow {
  key: string
  gradeId: GradeId
  group: string
  n: number
  shown: boolean
  fav: Record<string, number>
  /** Percentatge favorable de cada afirmació en aquest grup (buit si el grup no arriba al llindar). */
  items: Record<string, number>
  context: string[]
}

export interface StageReport {
  stage: StageId
  form: FeedbackForm
  scale: Scale
  n: number
  eligible: number
  suppressed: boolean
  dims: DimRow[]
  items: { item: FeedbackItem; dist: Dist }[]
  groups: GroupRow[]
  previous?: { label: string; fav: Record<string, number> }
  /** Comentaris publicats; els repetits hi surten una sola vegada amb el nombre de persones que els han escrit. */
  comments: { question: string; texts: { text: string; count: number }[] }[]
  self?: SelfAssessment
}

export interface TeacherReport {
  campaign: FeedbackCampaign
  teacher: { email: string; name: string }
  stages: StageReport[]
}

/** Alumnes que podien valorar un docent en una etapa d'una recollida. */
export function eligibleStudents(d: FeedbackData, c: FeedbackCampaign, email: string, stage: StageId): Student[] {
  return d.students.filter(
    (s) => stageOfGrade(s.gradeId) === stage && teachersForStudent(s, c.assignments, d.gradeSubjects, d.subjects, d.staff, c.teachers).some((t) => t.email === email),
  )
}

function previousCampaign(d: FeedbackData, c: FeedbackCampaign): FeedbackCampaign | undefined {
  return d.feedbackCampaigns
    .filter((x) => x.id !== c.id && x.start < c.start && (x.status === 'PUBLICADA' || x.status === 'ARXIVADA'))
    .sort((a, b) => (a.start < b.start ? 1 : -1))[0]
}

export function stageReport(d: FeedbackData, scales: Scale[], c: FeedbackCampaign, email: string, stage: StageId, withPrevious = true): StageReport | null {
  const form = d.feedbackForms.find((f) => f.id === c.formIds[stage])
  if (!form) return null
  const scale = scales.find((s) => s.id === form.scaleId)!
  const nOpt = scale.options.length
  const answers = d.feedbackAnswers.filter((a) => a.campaignId === c.id && a.teacherEmail === email && a.stage === stage)
  const n = answers.length
  const suppressed = n < THRESHOLD
  const self = d.selfAssessments.find((x) => x.campaignId === c.id && x.teacherEmail === email && x.stage === stage && x.submittedAt)
  const dims: DimRow[] = form.dimensions.map((dim) => {
    const dist = distOf(valuesFor(answers, form, form.items.filter((i) => i.dimensionId === dim.id)), nOpt)
    const sc = selfScore(self, form, dim.id, nOpt)
    return { dim, dist, self: sc, quadrant: sc !== undefined && !suppressed && dist.valid ? quadrantOf(dist.mean, sc) : undefined }
  })
  const keys = [...new Set(c.assignments.filter((a) => a.teacherEmail === email && stageOfGrade(a.gradeId) === stage).map((a) => groupKey(a.gradeId, a.group)))].sort(
    (a, b) => GRADES.findIndex((g) => a.startsWith(g.id + '-')) - GRADES.findIndex((g) => b.startsWith(g.id + '-')) || a.localeCompare(b),
  )
  const groups: GroupRow[] = keys.map((key) => {
    const [gradeId, group] = key.split('-') as [GradeId, string]
    const ga = answers.filter((a) => a.gradeId === gradeId && a.group === group)
    const fav: Record<string, number> = {}
    for (const dim of form.dimensions) fav[dim.id] = distOf(valuesFor(ga, form, form.items.filter((i) => i.dimensionId === dim.id)), nOpt).fav
    const items: Record<string, number> = {}
    for (const item of form.items) items[item.id] = distOf(valuesFor(ga, form, [item]), nOpt).fav
    return { key, gradeId, group, n: ga.length, shown: ga.length >= THRESHOLD, fav, items, context: self?.context[key] ?? [] }
  })
  let previous: StageReport['previous']
  const prev = withPrevious ? previousCampaign(d, c) : undefined
  if (prev && prev.stages.includes(stage)) {
    const pr = stageReport(d, scales, prev, email, stage, false)
    if (pr && !pr.suppressed) previous = { label: `${prev.label} (${prev.year})`, fav: Object.fromEntries(pr.dims.map((x) => [x.dim.id, x.dist.fav])) }
  }
  const comments = suppressed
    ? []
    : form.open.map((q) => ({
        question: q.text,
        texts: groupComments(
          d.feedbackComments
            .filter((x) => x.campaignId === c.id && x.teacherEmail === email && x.stage === stage && x.questionId === q.id && (x.status === 'acceptat' || x.status === 'editat') && x.published)
            .map((x) => x.published!),
        ),
      }))
  return {
    stage, form, scale, n, eligible: eligibleStudents(d, c, email, stage).length, suppressed, dims,
    items: form.items.map((item) => ({ item, dist: distOf(valuesFor(answers, form, [item]), nOpt) })),
    groups, previous, comments, self,
  }
}

export function buildTeacherReport(d: FeedbackData, scales: Scale[], campaignId: string, email: string): TeacherReport | null {
  const c = d.feedbackCampaigns.find((x) => x.id === campaignId)
  if (!c) return null
  const stages = stagesOfTeacher(c, email)
    .map((st) => stageReport(d, scales, c, email, st))
    .filter((x): x is StageReport => !!x)
    .map(redactStage)
  return { campaign: c, teacher: { email, name: d.staff.find((s) => s.email === email)?.name ?? email }, stages }
}

/**
 * Agrupa els comentaris iguals (sense tenir en compte majúscules, espais ni la puntuació final):
 * cadascun surt una vegada, amb quantes persones l'han escrit. Primer els més repetits.
 */
export function groupComments(texts: string[]): { text: string; count: number }[] {
  const key = (t: string) => t.toLocaleLowerCase('ca').replace(/\s+/g, ' ').replace(/[\s.!…]+$/u, '').trim()
  const groups = new Map<string, { text: string; count: number }>()
  for (const t of texts) {
    const g = groups.get(key(t))
    if (g) g.count++
    else groups.set(key(t), { text: t.trim(), count: 1 })
  }
  return [...groups.values()].sort((a, b) => b.count - a.count)
}

// ---------- Visió de centre ----------

export interface CenterStage {
  stage: StageId
  form: FeedbackForm
  scale: Scale
  dims: { dim: FeedbackDimension; dist: Dist; prevFav?: number }[]
  teachers: { email: string; name: string; n: number; suppressed: boolean; fav: Record<string, number>; self: boolean }[]
  students: number
  participants: number
  /** Respostes de l'etapa (totes les valoracions de tots els docents). */
  n: number
}

export function buildCenterView(d: FeedbackData, scales: Scale[], campaignId: string): CenterStage[] {
  const c = d.feedbackCampaigns.find((x) => x.id === campaignId)
  if (!c) return []
  const prev = previousCampaign(d, c)
  return c.stages.flatMap((stage) => {
    const form = d.feedbackForms.find((f) => f.id === c.formIds[stage])
    if (!form) return []
    const scale = scales.find((s) => s.id === form.scaleId)!
    const nOpt = scale.options.length
    const answers = d.feedbackAnswers.filter((a) => a.campaignId === c.id && a.stage === stage)
    const prevForm = prev && d.feedbackForms.find((f) => f.id === prev.formIds[stage])
    const prevAnswers = prev ? d.feedbackAnswers.filter((a) => a.campaignId === prev.id && a.stage === stage) : []
    const dims = form.dimensions.map((dim) => {
      const dist = distOf(valuesFor(answers, form, form.items.filter((i) => i.dimensionId === dim.id)), nOpt)
      const pd = prevForm && prevAnswers.length >= THRESHOLD ? distOf(valuesFor(prevAnswers, prevForm, prevForm.items.filter((i) => i.dimensionId === dim.id)), nOpt) : undefined
      return { dim, dist, prevFav: pd?.valid ? pd.fav : undefined }
    })
    const emails = [...new Set(c.assignments.filter((a) => stageOfGrade(a.gradeId) === stage && c.teachers.includes(a.teacherEmail)).map((a) => a.teacherEmail))]
    const teachers = emails
      .map((email) => {
        const ta = answers.filter((a) => a.teacherEmail === email)
        const fav: Record<string, number> = {}
        for (const dim of form.dimensions) fav[dim.id] = distOf(valuesFor(ta, form, form.items.filter((i) => i.dimensionId === dim.id)), nOpt).fav
        const self = d.selfAssessments.some((x) => x.campaignId === c.id && x.teacherEmail === email && x.stage === stage && x.submittedAt)
        return { email, name: d.staff.find((s) => s.email === email)?.name ?? email, n: ta.length, suppressed: ta.length < THRESHOLD, fav, self }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ca'))
    const studs = d.students.filter((s) => stageOfGrade(s.gradeId) === stage)
    const participants = new Set(d.participation.filter((p) => p.campaignId === c.id && studs.some((s) => s.id === p.studentId)).map((p) => p.studentId)).size
    const stageSuppressed = answers.length < THRESHOLD
    return [
      {
        stage, form, scale, students: studs.length, participants, n: answers.length,
        dims: stageSuppressed ? dims.map((x) => ({ ...x, dist: emptyDist(nOpt), prevFav: undefined })) : dims,
        // Els docents per sota del llindar no porten cap resultat.
        teachers: teachers.map((t) => (t.suppressed ? { ...t, fav: {} } : t)),
      },
    ]
  })
}

// ---------- Moderació dels comentaris ----------

const INSULTS = ['idiota', 'imbècil', 'imbecil', 'burro', 'burra', 'estúpid', 'estúpida', 'estupid', 'inútil', 'inutil', 'pesat', 'pesada', 'odio', 'merda', 'collons', 'tonto', 'tonta', 'gilipolles', 'subnormal', 'fastigós', 'fastigosa', 'horrible', 'pallús', 'cutre']

/** Marca automàticament els comentaris que cal revisar abans de publicar-los. */
export function flagComment(text: string, names: string[]): string[] {
  const flags: string[] = []
  const words = text.split(/[^\p{L}'’]+/u).filter(Boolean)
  const lower = words.map((w) => w.toLowerCase())
  const bad = INSULTS.filter((w) => lower.includes(w))
  if (bad.length) flags.push(`Possible insult: ${bad.join(', ')}`)
  const found = [...new Set(words.filter((w) => /^\p{Lu}/u.test(w) && names.includes(w)))]
  if (found.length) flags.push(`Nom propi: ${found.join(', ')}`)
  if (/@|\d{6,}/.test(text)) flags.push('Dades de contacte')
  if (/\b(jo sóc|em dic|sóc l[ae]? que)\b/i.test(text)) flags.push('Pot identificar qui ho escriu')
  return flags
}

export const STAGE_NAME = (st: StageId) => STAGES[st].name
