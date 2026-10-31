// Motor de qüestionaris: genera els passos de l'alumne, valida i calcula el progrés.
// És independent de la interfície i es prova a tests/domain.test.ts.

import type { Answers, GradeSubject, Question, Scale, Section, StageId, Student, Subject, TemplateVersion } from './types'

export const NA = 'NA'

export const keyOf = (questionId: string, subjectId?: string, part?: string): string =>
  [questionId, subjectId, part].filter(Boolean).join('|')

export type Step =
  | { kind: 'question'; section: Section; question: Question; indexInSection: number }
  | { kind: 'section'; section: Section; questions: Question[] }
  | { kind: 'subject'; section: Section; question: Question; subject: Subject; subjectIndex: number; subjectCount: number }
  | { kind: 'review' }

export interface StepContext {
  stage: StageId
  subjects: Subject[]
  /** Objectiu de l'avaluació anterior (si n'hi ha) per a les preguntes `goalReview`. */
  previousGoal?: string
}

/** Matèries que cursa l'alumne: comunes actives + optatives que té assignades. */
export const subjectsForStudent = (snapshot: GradeSubject[], student: Student, catalog: Subject[]): Subject[] =>
  snapshot
    .filter((gs) => gs.gradeId === student.gradeId && gs.active && (!gs.optional || student.electives.includes(gs.subjectId)))
    .sort((a, b) => a.order - b.order)
    .map((gs) => catalog.find((s) => s.id === gs.subjectId))
    .filter((s): s is Subject => !!s && s.active)

const visibleQuestions = (section: Section, ctx: StepContext): Question[] =>
  section.questions.filter((q) => q.active && (q.type !== 'goalReview' || !!ctx.previousGoal))

/**
 * Cicle mitjà: una pregunta per pantalla. Cicle superior i ESO: un bloc per pantalla.
 * Les preguntes per matèria sempre fan una pantalla per matèria.
 */
export function buildSteps(template: TemplateVersion, ctx: StepContext): Step[] {
  const steps: Step[] = []
  for (const section of template.sections) {
    const qs = visibleQuestions(section, ctx)
    if (!qs.length) continue
    let pending: Question[] = []
    const flush = () => {
      if (!pending.length) return
      if (ctx.stage === 'CM') pending.forEach((question, i) => steps.push({ kind: 'question', section, question, indexInSection: i }))
      else steps.push({ kind: 'section', section, questions: pending })
      pending = []
    }
    for (const question of qs) {
      if (question.type === 'subjects') {
        flush()
        ctx.subjects.forEach((subject, subjectIndex) =>
          steps.push({ kind: 'subject', section, question, subject, subjectIndex, subjectCount: ctx.subjects.length }),
        )
      } else pending.push(question)
    }
    flush()
  }
  steps.push({ kind: 'review' })
  return steps
}

export interface Missing {
  step: number
  label: string
  key: string
}

const isFilled = (v: string | undefined) => v !== undefined && v.trim() !== ''

/** Claus obligatòries de cada pas (per validar i calcular el progrés). */
export function requiredKeys(step: Step): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  const push = (q: Question) => {
    if (q.type === 'info' || !q.required) return
    out.push({ key: keyOf(q.id), label: q.pdfLabel ?? q.text })
  }
  if (step.kind === 'question') push(step.question)
  if (step.kind === 'section') step.questions.forEach(push)
  if (step.kind === 'subject') {
    const { question: q, subject } = step
    q.criteria?.forEach((c) => out.push({ key: keyOf(q.id, subject.id, c.id), label: `${subject.short}: ${c.label.toLowerCase()}` }))
    if (q.subjectComment?.required) out.push({ key: keyOf(q.id, subject.id, 'obs'), label: `${subject.short}: ${q.subjectComment.prompt.toLowerCase()}` })
  }
  return out
}

export function findMissing(steps: Step[], answers: Answers): Missing[] {
  return steps.flatMap((step, i) =>
    requiredKeys(step)
      .filter((r) => !isFilled(answers[r.key]))
      .map((r) => ({ step: i, label: r.label, key: r.key })),
  )
}

export const stepComplete = (step: Step, answers: Answers) => requiredKeys(step).every((r) => isFilled(answers[r.key]))

export function progress(steps: Step[], answers: Answers): { done: number; total: number; ratio: number } {
  const keys = steps.flatMap(requiredKeys)
  const done = keys.filter((r) => isFilled(answers[r.key])).length
  return { done, total: keys.length, ratio: keys.length ? done / keys.length : 1 }
}

/** Comprovacions de l'editor abans de publicar una versió. */
export function validateTemplate(t: TemplateVersion, scales: Scale[]): string[] {
  const issues: string[] = []
  const ids = new Set<string>()
  const scaleIds = new Set(scales.map((s) => s.id))
  if (!t.sections.length) issues.push('El qüestionari no té cap apartat.')
  for (const s of t.sections) {
    if (!s.title.trim()) issues.push('Hi ha un apartat sense títol.')
    if (!s.questions.some((q) => q.active)) issues.push(`L’apartat «${s.title || 'sense títol'}» no té preguntes actives.`)
    for (const q of s.questions) {
      if (ids.has(q.id)) issues.push(`L’identificador ${q.id} està repetit.`)
      ids.add(q.id)
      if (!q.text.trim()) issues.push(`Hi ha una pregunta sense text a «${s.title}».`)
      if ((q.type === 'scale' || q.type === 'goalReview') && !scaleIds.has(q.scaleId ?? '')) issues.push(`«${q.text}» no té una escala vàlida.`)
      if (q.type === 'subjects' && !q.criteria?.length) issues.push(`«${q.text}» no té criteris per matèria.`)
      q.criteria?.forEach((c) => {
        if (!scaleIds.has(c.scaleId)) issues.push(`El criteri «${c.label}» no té una escala vàlida.`)
      })
      if ((q.type === 'shortText' || q.type === 'longText') && (!q.maxLength || q.maxLength < 20)) issues.push(`«${q.text}» ha de tenir un límit de caràcters raonable (mínim 20).`)
    }
  }
  return issues
}

/** Text llegible d'un valor d'escala. */
export function scaleLabel(scale: Scale | undefined, value: string | undefined, short = false): string {
  if (!scale || !value) return ''
  if (value === NA) return 'No escau'
  const o = scale.options.find((x) => x.value === value)
  return o ? (short && o.short ? o.short : o.label) : ''
}
