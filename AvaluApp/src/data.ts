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

const cleanText = (value: CellValue) =>
  String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .trim()

const normaliseText = (value: CellValue) =>
  cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

export async function parseWorkbook(file: File): Promise<EvaluationData> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellStyles: false })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  if (!sheet) throw new Error("El llibre no conté cap full de càlcul.")

  const rows = XLSX.utils.sheet_to_json<CellValue[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  })

  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => normaliseText(cell) === 'alumne'),
  )
  if (headerRowIndex < 0) {
    throw new Error("No s'ha trobat cap columna amb el títol «Alumne».")
  }

  const headers = rows[headerRowIndex]
  const studentColumn = headers.findIndex(
    (cell) => normaliseText(cell) === 'alumne',
  )
  const evaluationColumn = studentColumn + 1
  const subjectColumns = headers
    .map((header, index) => ({ header: cleanText(header), index }))
    .filter(({ header, index }) => index > evaluationColumn && header)

  if (subjectColumns.length === 0) {
    throw new Error("No s'han trobat les columnes de les matèries.")
  }

  const warnings: string[] = []
  const hyperlinkCount = Object.values(sheet).filter(
    (cell) => typeof cell === 'object' && cell !== null && 'l' in cell,
  ).length
  if (hyperlinkCount > 0) {
    warnings.push(
      `S'han ignorat ${hyperlinkCount} hipervincles o identificadors interns del fitxer.`,
    )
  }

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
    fileName: file.name,
    sheetName,
    subjects: subjectColumns.map(({ header }) => header),
    evaluations,
    students,
    warnings,
  }
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
      fails: grades.filter((grade) => grade < 2).length,
      count: grades.length,
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
        fails: grades.filter((grade) => grade < 2).length,
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
