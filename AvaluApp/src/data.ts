export type EvaluationId = 1 | 2 | 3

export interface StudentRecord {
  name: string
  evaluations: Partial<Record<EvaluationId, Array<number | null>>>
}

export interface EvaluationData {
  fileName: string
  sheetName: string
  subjects: string[]
  evaluations: EvaluationId[]
  students: StudentRecord[]
  warnings: string[]
}

type CellValue = string | number | boolean | null | undefined

export const evaluationLabel = (evaluation: EvaluationId) => `${evaluation}a`

/** Llindar de suspens: una qualificació inferior a aquest valor és un NA. */
export const PASS_MARK = 1.96

const cleanText = (value: CellValue) =>
  String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .trim()

const normaliseText = (value: CellValue) =>
  cleanText(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const parseEvaluation = (value: CellValue): EvaluationId | null => {
  const match = normaliseText(value).match(/[123]/)
  return match ? (Number(match[0]) as EvaluationId) : null
}

const parseGrade = (value: CellValue): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = cleanText(value).replace(',', '.')
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

const isStudentHeader = (cell: CellValue) => normaliseText(cell) === 'alumne'

/** Converteix les files d'un full en dades d'avaluació. */
export function parseRows(
  rows: CellValue[][],
  fileName: string,
  sheetName: string,
  extraWarnings: string[] = [],
): EvaluationData {
  const headerRowIndex = rows.findIndex((row) => row.some(isStudentHeader))
  if (headerRowIndex < 0) {
    throw new Error("No s'ha trobat cap columna amb el títol «Alumne».")
  }

  const headers = rows[headerRowIndex]
  const studentColumn = headers.findIndex(isStudentHeader)
  // Si hi ha una columna titulada «Avaluació» (o «Aval.»), s'utilitza aquesta;
  // si no, es pren la columna immediatament a la dreta d'«Alumne».
  const namedEvaluationColumn = headers.findIndex(
    (cell, index) => index !== studentColumn && /^aval/.test(normaliseText(cell)),
  )
  const evaluationColumn =
    namedEvaluationColumn >= 0 ? namedEvaluationColumn : studentColumn + 1
  const subjectColumns = headers
    .map((header, index) => ({ header: cleanText(header), index }))
    .filter(
      ({ header, index }) =>
        index > studentColumn && index !== evaluationColumn && header,
    )

  if (subjectColumns.length === 0) {
    throw new Error("No s'han trobat les columnes de les matèries.")
  }

  const warnings = [...extraWarnings]
  const studentMap = new Map<string, StudentRecord>()
  let currentStudent = ''
  let invalidGrades = 0
  let duplicateRows = 0

  rows.slice(headerRowIndex + 1).forEach((row) => {
    const studentCell = cleanText(row[studentColumn])
    if (studentCell) currentStudent = studentCell

    const evaluation = parseEvaluation(row[evaluationColumn])
    if (!currentStudent || !evaluation) return

    const grades = subjectColumns.map(({ index }) => {
      const grade = parseGrade(row[index])
      if (grade !== null && (grade < 0 || grade > 4)) {
        invalidGrades += 1
        return null
      }
      return grade
    })

    if (!grades.some((grade) => grade !== null)) return

    const student = studentMap.get(currentStudent) ?? {
      name: currentStudent,
      evaluations: {},
    }
    if (student.evaluations[evaluation]) duplicateRows += 1
    student.evaluations[evaluation] = grades
    studentMap.set(currentStudent, student)
  })

  const students = Array.from(studentMap.values())
  if (students.length === 0) {
    throw new Error("No s'han pogut llegir registres d'alumnes amb qualificacions.")
  }

  if (invalidGrades > 0) {
    warnings.push(
      `${invalidGrades} qualificacions fora de l'interval 0–4 s'han ignorat.`,
    )
  }
  if (duplicateRows > 0) {
    warnings.push(
      `${duplicateRows} files repetides han estat substituïdes per l'última fila trobada.`,
    )
  }

  const evaluations = ([1, 2, 3] as EvaluationId[]).filter((evaluation) =>
    students.some((student) => student.evaluations[evaluation]),
  )

  return {
    fileName,
    sheetName,
    subjects: subjectColumns.map(({ header }) => header),
    evaluations,
    students,
    warnings,
  }
}

export async function parseWorkbook(file: File): Promise<EvaluationData> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellStyles: false })
  if (workbook.SheetNames.length === 0) {
    throw new Error('El llibre no conté cap full de càlcul.')
  }

  const readSheet = (name: string) =>
    XLSX.utils.sheet_to_json<CellValue[]>(workbook.Sheets[name], {
      header: 1,
      raw: true,
      defval: null,
    })

  // Es fa servir el primer full que tingui una columna «Alumne».
  const sheetName =
    workbook.SheetNames.find((name) =>
      readSheet(name).some((row) => row.some(isStudentHeader)),
    ) ?? workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const warnings: string[] = []
  if (workbook.SheetNames.length > 1) {
    warnings.push(`S'ha llegit el full «${sheetName}».`)
  }
  const hyperlinkCount = Object.values(sheet).filter(
    (cell) => typeof cell === 'object' && cell !== null && 'l' in cell,
  ).length
  if (hyperlinkCount > 0) {
    warnings.push(
      `S'han ignorat ${hyperlinkCount} hipervincles o identificadors interns del fitxer.`,
    )
  }

  return parseRows(readSheet(sheetName), file.name, sheetName, warnings)
}

export const validGrades = (grades?: Array<number | null>) =>
  (grades ?? []).filter((grade): grade is number => grade !== null)

export const mean = (values: number[]) =>
  values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null

export const studentMean = (
  student: StudentRecord,
  evaluation: EvaluationId,
) => mean(validGrades(student.evaluations[evaluation]))

export const classMean = (
  data: EvaluationData,
  evaluation: EvaluationId,
) =>
  mean(
    data.students.flatMap((student) =>
      validGrades(student.evaluations[evaluation]),
    ),
  )

export const subjectStats = (
  data: EvaluationData,
  evaluation: EvaluationId,
) =>
  data.subjects.map((subject, subjectIndex) => {
    const grades = data.students
      .map((student) => student.evaluations[evaluation]?.[subjectIndex] ?? null)
      .filter((grade): grade is number => grade !== null)
    return {
      subject,
      mean: mean(grades),
      fails: grades.filter((grade) => grade < PASS_MARK).length,
      count: grades.length,
      levels: LEVELS.map(
        (level) => grades.filter((grade) => gradeLevel(grade)?.code === level.code).length,
      ),
    }
  })

export const studentStats = (
  data: EvaluationData,
  evaluation: EvaluationId,
) =>
  data.students
    .map((student) => {
      const grades = validGrades(student.evaluations[evaluation])
      return {
        name: student.name,
        mean: mean(grades),
        fails: grades.filter((grade) => grade < PASS_MARK).length,
        gradesCount: grades.length,
      }
    })
    .filter((student) => student.mean !== null)

export const formatNumber = (value: number | null, digits = 2) =>
  value === null
    ? '—'
    : value.toLocaleString('ca-ES', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })

/** Qualificació individual: sense decimals si és entera, amb un decimal si no. */
export const formatGrade = (value: number | null) =>
  value === null
    ? '—'
    : formatNumber(value, Number.isInteger(value) ? 0 : 1)

export const formatSigned = (value: number | null, digits = 2) =>
  value === null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), digits)}`

/* ---------- Nivells d'assoliment ---------- */

export type LevelCode = 'NA' | 'AS' | 'AN' | 'AE'

export interface Level {
  code: LevelCode
  name: string
  range: string
  tone: 'fail' | 'pass' | 'good' | 'high'
}

/**
 * Equivalència de l'escala 0–4 amb els nivells d'assoliment.
 * NA: menys de 1,96 · AS: de 1,96 a 2,95 · AN: de 2,96 a 3,79 · AE: de 3,8 a 4.
 */
export const LEVELS: Level[] = [
  { code: 'NA', name: 'No assoliment', range: 'menys de 1,96', tone: 'fail' },
  { code: 'AS', name: 'Assoliment satisfactori', range: '1,96 – 2,95', tone: 'pass' },
  { code: 'AN', name: 'Assoliment notable', range: '2,96 – 3,79', tone: 'good' },
  { code: 'AE', name: 'Assoliment excel·lent', range: '3,8 – 4', tone: 'high' },
]

export const gradeLevel = (value: number | null): Level | null => {
  if (value === null) return null
  if (value < PASS_MARK) return LEVELS[0]
  if (value < 2.96) return LEVELS[1]
  if (value < 3.8) return LEVELS[2]
  return LEVELS[3]
}

/* ---------- Indicadors per a la junta d'avaluació ---------- */

/** Variació de la mitjana que es considera rellevant (en punts sobre 4). */
export const RELEVANT_CHANGE = 0.25
/** Nombre de suspensos a partir del qual es demana seguiment. */
export const RISK_FAILS = 3
/** Mitjana mínima (nivell AE), sense cap suspens, per proposar una felicitació. */
export const EXCELLENCE_MEAN = 3.8

export type AlertKind =
  | 'risc'
  | 'persistent'
  | 'nous'
  | 'baixa'
  | 'millora'
  | 'recupera'
  | 'excel'
  | 'incomplet'
  | 'nou-alumne'

export interface Alert {
  kind: AlertKind
  label: string
  detail: string
  tone: 'danger' | 'warning' | 'success' | 'neutral'
}

export interface StudentInsight {
  name: string
  student: StudentRecord
  grades: Array<number | null>
  previousGrades: Array<number | null> | null
  mean: number | null
  previousMean: number | null
  delta: number | null
  failSubjects: string[]
  newFails: string[]
  persistentFails: string[]
  recovered: string[]
  improvedSubjects: string[]
  worsenedSubjects: string[]
  strengths: string[]
  missing: string[]
  alerts: Alert[]
  needsAttention: boolean
}

const listText = (items: string[], max = 4) =>
  items.length <= max
    ? items.join(', ')
    : `${items.slice(0, max).join(', ')} i ${items.length - max} més`

export function studentInsight(
  data: EvaluationData,
  student: StudentRecord,
  evaluation: EvaluationId,
  previous?: EvaluationId,
): StudentInsight {
  const grades = student.evaluations[evaluation] ?? data.subjects.map(() => null)
  const previousGrades = previous ? (student.evaluations[previous] ?? null) : null
  const currentMean = studentMean(student, evaluation)
  const previousMean = previous ? studentMean(student, previous) : null
  const delta =
    currentMean !== null && previousMean !== null ? currentMean - previousMean : null

  const failSubjects: string[] = []
  const newFails: string[] = []
  const persistentFails: string[] = []
  const recovered: string[] = []
  const improvedSubjects: string[] = []
  const worsenedSubjects: string[] = []
  const missing: string[] = []

  data.subjects.forEach((subject, index) => {
    const grade = grades[index] ?? null
    const before = previousGrades?.[index] ?? null
    if (grade === null) {
      if (student.evaluations[evaluation]) missing.push(subject)
      return
    }
    if (grade < PASS_MARK) {
      failSubjects.push(subject)
      if (before !== null && before < PASS_MARK) persistentFails.push(subject)
      else if (before !== null) newFails.push(subject)
    } else if (before !== null && before < PASS_MARK) {
      recovered.push(subject)
    }
    if (before !== null) {
      const currentLevel = LEVELS.indexOf(gradeLevel(grade) as Level)
      const beforeLevel = LEVELS.indexOf(gradeLevel(before) as Level)
      if (currentLevel > beforeLevel) improvedSubjects.push(subject)
      if (currentLevel < beforeLevel) worsenedSubjects.push(subject)
    }
  })

  const strengths = data.subjects
    .map((subject, index) => ({ subject, grade: grades[index] ?? null }))
    .filter((item): item is { subject: string; grade: number } => item.grade !== null && item.grade >= 2.96)
    .sort((a, b) => b.grade - a.grade)
    .map((item) => item.subject)

  const alerts: Alert[] = []
  if (!student.evaluations[evaluation]) {
    alerts.push({
      kind: 'incomplet',
      label: 'Sense notes',
      detail: `No té qualificacions a la ${evaluation}a avaluació.`,
      tone: 'neutral',
    })
  }
  if (failSubjects.length >= RISK_FAILS) {
    alerts.push({
      kind: 'risc',
      label: `${failSubjects.length} suspensos`,
      detail: `Suspèn ${listText(failSubjects, 6)}.`,
      tone: 'danger',
    })
  }
  if (persistentFails.length > 0) {
    alerts.push({
      kind: 'persistent',
      label: 'Suspensos repetits',
      detail: `Torna a suspendre ${listText(persistentFails)}.`,
      tone: 'danger',
    })
  }
  if (newFails.length > 0) {
    alerts.push({
      kind: 'nous',
      label: 'Nous suspensos',
      detail: `Suspèn per primera vegada ${listText(newFails)}.`,
      tone: 'warning',
    })
  }
  if (delta !== null && delta <= -RELEVANT_CHANGE) {
    alerts.push({
      kind: 'baixa',
      label: 'Baixa',
      detail: `La mitjana baixa ${formatNumber(Math.abs(delta))} punts.`,
      tone: 'warning',
    })
  }
  if (delta !== null && delta >= RELEVANT_CHANGE) {
    alerts.push({
      kind: 'millora',
      label: 'Millora',
      detail: `La mitjana puja ${formatNumber(delta)} punts.`,
      tone: 'success',
    })
  }
  if (recovered.length > 0) {
    alerts.push({
      kind: 'recupera',
      label: 'Recupera',
      detail: `Supera ${listText(recovered)}.`,
      tone: 'success',
    })
  }
  if (
    currentMean !== null &&
    failSubjects.length === 0 &&
    currentMean >= EXCELLENCE_MEAN
  ) {
    alerts.push({
      kind: 'excel',
      label: 'Excel·lent',
      detail: `Mitjana de ${formatNumber(currentMean)} sense cap suspens.`,
      tone: 'success',
    })
  }
  if (previous && student.evaluations[evaluation] && !previousGrades) {
    alerts.push({
      kind: 'nou-alumne',
      label: 'Sense dades anteriors',
      detail: `No té qualificacions a la ${previous}a avaluació.`,
      tone: 'neutral',
    })
  }
  if (missing.length > 0) {
    alerts.push({
      kind: 'incomplet',
      label: 'Notes pendents',
      detail: `Falten qualificacions de ${listText(missing)}.`,
      tone: 'neutral',
    })
  }

  return {
    name: student.name,
    student,
    grades,
    previousGrades,
    mean: currentMean,
    previousMean,
    delta,
    failSubjects,
    newFails,
    persistentFails,
    recovered,
    improvedSubjects,
    worsenedSubjects,
    strengths,
    missing,
    alerts,
    needsAttention: alerts.some((alert) =>
      ['risc', 'persistent', 'nous', 'baixa'].includes(alert.kind),
    ),
  }
}

export const groupInsights = (
  data: EvaluationData,
  evaluation: EvaluationId,
  previous?: EvaluationId,
) => data.students.map((student) => studentInsight(data, student, evaluation, previous))

const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`

/** Resum en text pla per a l'acta de la junta d'avaluació. */
export function juntaSummaryText(
  data: EvaluationData,
  evaluation: EvaluationId,
  previous?: EvaluationId,
): string {
  const insights = groupInsights(data, evaluation, previous).filter(
    (item) => item.mean !== null,
  )
  const total = insights.length
  const groupMean = classMean(data, evaluation)
  const previousGroupMean = previous ? classMean(data, previous) : null
  const subjects = subjectStats(data, evaluation).filter((item) => item.count > 0)
  const noFails = insights.filter((item) => item.failSubjects.length === 0).length
  const fewFails = insights.filter(
    (item) => item.failSubjects.length > 0 && item.failSubjects.length < RISK_FAILS,
  ).length
  const manyFails = insights.filter((item) => item.failSubjects.length >= RISK_FAILS)
  const percent = (value: number) =>
    total > 0 ? `${formatNumber((value / total) * 100, 0)} %` : '—'

  const lines: string[] = []
  lines.push(
    `Resum de la ${evaluation}a avaluació · ${plural(total, 'alumne', 'alumnes')} · ${plural(data.subjects.length, 'matèria', 'matèries')}`,
  )
  lines.push('')
  lines.push(
    `• Mitjana del grup: ${formatNumber(groupMean)} sobre 4` +
      (previous && previousGroupMean !== null && groupMean !== null
        ? ` (${formatSigned(groupMean - previousGroupMean)} respecte de la ${previous}a avaluació).`
        : '.'),
  )
  lines.push(
    `• Sense cap suspens: ${noFails} (${percent(noFails)}). Amb 1 o 2 suspensos: ${fewFails} (${percent(fewFails)}). Amb ${RISK_FAILS} o més: ${manyFails.length} (${percent(manyFails.length)}).`,
  )

  const byFails = [...subjects].filter((item) => item.fails > 0).sort((a, b) => b.fails - a.fails)
  if (byFails.length > 0) {
    lines.push(
      `• Matèries amb més suspensos: ${byFails
        .slice(0, 4)
        .map((item) => `${item.subject} (${item.fails})`)
        .join(', ')}.`,
    )
  }
  const byMean = [...subjects].sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0))
  lines.push(
    `• Matèries amb la mitjana més alta: ${byMean
      .slice(0, 3)
      .map((item) => `${item.subject} (${formatNumber(item.mean)})`)
      .join(', ')}.`,
  )
  lines.push(
    `• Matèries amb la mitjana més baixa: ${byMean
      .slice(-3)
      .reverse()
      .map((item) => `${item.subject} (${formatNumber(item.mean)})`)
      .join(', ')}.`,
  )

  const attention = insights
    .filter((item) => item.needsAttention)
    .sort((a, b) => b.failSubjects.length - a.failSubjects.length || (a.delta ?? 0) - (b.delta ?? 0))
  lines.push('')
  lines.push(`Alumnat que requereix seguiment (${attention.length}):`)
  if (attention.length === 0) lines.push('• Cap alumne.')
  attention.forEach((item) => {
    const parts: string[] = []
    if (item.failSubjects.length > 0) {
      parts.push(`${plural(item.failSubjects.length, 'suspens', 'suspensos')}: ${item.failSubjects.join(', ')}`)
    }
    if (item.persistentFails.length > 0) parts.push(`repeteix suspens a ${item.persistentFails.join(', ')}`)
    if (item.delta !== null && item.delta <= -RELEVANT_CHANGE) parts.push(`baixa ${formatNumber(Math.abs(item.delta))}`)
    lines.push(`• ${item.name}: ${parts.join('; ')}.`)
  })

  const improving = insights
    .filter((item) => (item.delta ?? 0) >= RELEVANT_CHANGE || item.recovered.length > 0)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
  if (previous) {
    lines.push('')
    lines.push(`Millores destacades (${improving.length}):`)
    if (improving.length === 0) lines.push('• Cap alumne.')
    improving.forEach((item) => {
      const parts: string[] = []
      if (item.delta !== null && item.delta >= RELEVANT_CHANGE) parts.push(`mitjana ${formatSigned(item.delta)}`)
      if (item.recovered.length > 0) parts.push(`supera ${item.recovered.join(', ')}`)
      lines.push(`• ${item.name}: ${parts.join('; ')}.`)
    })
  }

  const excellent = insights.filter((item) => item.alerts.some((alert) => alert.kind === 'excel'))
  lines.push('')
  lines.push(`Rendiment excel·lent, sense suspensos i mitjana d'almenys ${formatNumber(EXCELLENCE_MEAN, 1)} (${excellent.length}):`)
  lines.push(
    excellent.length === 0
      ? '• Cap alumne.'
      : `• ${excellent.map((item) => `${item.name} (${formatNumber(item.mean)})`).join(', ')}.`,
  )

  return lines.join('\n')
}

/** Frase de resum per a l'informe de la família, en un llenguatge planer. */
export function familySummary(insight: StudentInsight, subjectsCount: number) {
  const assessed = insight.grades.filter((grade) => grade !== null).length
  const passed = assessed - insight.failSubjects.length
  const sentences: string[] = []
  if (assessed === 0) return 'Encara no hi ha qualificacions per a aquesta avaluació.'
  sentences.push(
    passed === assessed
      ? `Ha assolit totes les matèries avaluades (${assessed}).`
      : `Ha assolit ${passed} de les ${assessed} matèries avaluades.`,
  )
  if (assessed < subjectsCount && insight.missing.length > 0) {
    sentences.push(`Queden pendents de qualificar: ${listText(insight.missing)}.`)
  }
  if (insight.delta !== null) {
    sentences.push(
      Math.abs(insight.delta) < 0.1
        ? 'El resultat global és similar al de l’avaluació anterior.'
        : insight.delta > 0
          ? 'El resultat global millora respecte de l’avaluació anterior.'
          : 'El resultat global és més baix que el de l’avaluació anterior.',
    )
  }
  if (insight.recovered.length > 0) {
    sentences.push(`Ha superat ${listText(insight.recovered)}, que tenia pendent.`)
  }
  return sentences.join(' ')
}

/* ---------- Dades d'exemple ---------- */

export function createDemoData(): EvaluationData {
  const names = [
    'Aina B.', 'Biel C.', 'Carla D.', 'Dani E.', 'Emma F.', 'Fatima G.',
    'Guillem H.', 'Hugo I.', 'Iria J.', 'Joel K.', 'Laia L.', 'Marc M.',
    'Nora N.', 'Omar O.', 'Paula P.', 'Pol Q.', 'Rita R.', 'Sara S.',
    'Teo T.', 'Úrsula U.', 'Víctor V.', 'Yasmina Y.', 'Zoe Z.', 'Adam A.',
  ]
  const subjects = [
    'Català', 'Castellà', 'Anglès', 'Matemàtiques', 'Biologia',
    'Física i Química', 'Socials', 'Tecnologia', 'Ed. Física', 'Música',
  ]
  let seed = 11
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const students: StudentRecord[] = names.map((name, index) => {
    const base = 1.5 + random() * 2.3
    const trend = (random() - 0.45) * 0.7
    const evaluations: StudentRecord['evaluations'] = {}
    ;([1, 2, 3] as EvaluationId[]).forEach((evaluation) => {
      if (evaluation === 3) return // curs en marxa: dues avaluacions
      if (index === names.length - 1 && evaluation === 1) return // alumne nouvingut
      evaluations[evaluation] = subjects.map((_, subjectIndex) => {
        const value =
          base + trend * (evaluation - 1) + (random() - 0.5) * 1.5 +
          (subjectIndex === 3 || subjectIndex === 5 ? -0.35 : 0) +
          (subjectIndex === 8 ? 0.4 : 0)
        return Math.max(1, Math.min(4, Math.round(value)))
      })
    })
    return { name, evaluations }
  })
  return {
    fileName: "Dades d'exemple (alumnat fictici)",
    sheetName: 'Exemple',
    subjects,
    evaluations: [1, 2],
    students,
    warnings: [],
  }
}
