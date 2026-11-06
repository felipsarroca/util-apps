import {
  type EvaluationData,
  type EvaluationId,
  evaluationLabel,
  groupInsights,
  juntaSummaryText,
  subjectStats,
} from './data'
import type { NotesMap } from './settings'

export const shortSubject = (subject: string) =>
  subject.length <= 9 ? subject : `${subject.slice(0, 8).trim()}.`

/** Files per al full de càlcul de la junta. */
export function juntaWorkbook(
  data: EvaluationData,
  evaluation: EvaluationId,
  notes: NotesMap,
  previous?: EvaluationId,
) {
  const insights = groupInsights(data, evaluation, previous)
  const round = (value: number | null) => (value === null ? null : Math.round(value * 100) / 100)
  const header = [
    'Alumne',
    ...data.subjects,
    'Mitjana',
    ...(previous ? [`Variació respecte de la ${evaluationLabel(previous)}`] : []),
    'Suspensos',
    'Matèries suspeses',
    'Indicadors',
    'Acords de la junta',
    'Missatge per a la família',
  ]
  const studentRows = insights.map((item) => [
    item.name,
    ...item.grades.map((grade) => grade),
    round(item.mean),
    ...(previous ? [round(item.delta)] : []),
    item.mean === null ? null : item.failSubjects.length,
    item.failSubjects.join(', '),
    item.alerts.map((alert) => alert.detail).join(' '),
    notes[item.name]?.acords ?? '',
    notes[item.name]?.familia ?? '',
  ])
  const subjects = subjectStats(data, evaluation)
  const subjectRows = [
    ['Matèria', 'Mitjana', 'Suspensos', 'Alumnes avaluats', '% assoliment', 'NA', 'AS', 'AN', 'AE'],
    ...subjects.map((item) => [
      item.subject,
      round(item.mean),
      item.fails,
      item.count,
      item.count ? Math.round(((item.count - item.fails) / item.count) * 100) : null,
      ...item.levels,
    ]),
  ]
  return [
    {
      name: `Junta ${evaluationLabel(evaluation)}`,
      rows: [header, ...studentRows],
      widths: [18, ...data.subjects.map(() => 9), 9, ...(previous ? [12] : []), 10, 30, 50, 50, 50],
    },
    { name: 'Matèries', rows: subjectRows, widths: [22, 10, 10, 10, 12, 6, 6, 6, 6] },
    {
      name: 'Resum',
      rows: juntaSummaryText(data, evaluation, previous)
        .split('\n')
        .map((line) => [line]),
      widths: [120],
    },
  ]
}
