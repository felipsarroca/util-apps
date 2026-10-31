// Model de domini de M'avaluo. Les mateixes entitats es reflecteixen a db/schema.sql.

export type StageId = 'CM' | 'CS' | 'ESO'
export type GradeId = '3EP' | '4EP' | '5EP' | '6EP' | '1ESO' | '2ESO' | '3ESO' | '4ESO'
export type Role = 'admin' | 'teacher' | 'student'

export interface Stage {
  id: StageId
  name: string
  short: string
}

export interface Grade {
  id: GradeId
  name: string
  stage: StageId
  order: number
}

export interface Subject {
  id: string
  short: string
  long: string
  /** Color d'identificació (només decoratiu: mai és l'únic codi de significat). */
  hue: number
  active: boolean
}

export interface GradeSubject {
  gradeId: GradeId
  subjectId: string
  order: number
  optional: boolean
  active: boolean
}

export interface Student {
  id: string
  name: string
  surname: string
  email: string
  gradeId: GradeId
  group: string
  /** Optatives que cursa efectivament (ids de matèria). */
  electives: string[]
  guardians: Guardian[]
}

export interface Guardian {
  name: string
  email: string
  validated: boolean
}

export interface StaffMember {
  email: string
  name: string
  role: 'admin' | 'teacher'
  /** Grups assignats en format `GRADE-GRUP` (p. ex. `2ESO-A`). */
  groups: string[]
}

export interface ScaleOption {
  value: string
  label: string
  short?: string
  emoji?: string
}

export interface Scale {
  id: string
  name: string
  options: ScaleOption[]
  /** Valor «No escau» disponible. */
  allowNA: boolean
}

export type QuestionType = 'scale' | 'shortText' | 'longText' | 'subjects' | 'goalReview' | 'info'

export interface SubjectCriterion {
  id: string
  label: string
  /** Text breu i proper per a l'alumne. */
  prompt: string
  scaleId: string
}

export interface Question {
  id: string
  type: QuestionType
  text: string
  help?: string
  required: boolean
  scaleId?: string
  maxLength?: number
  /** Etiqueta al PDF (si és diferent del text). */
  pdfLabel?: string
  /** Només per a `subjects`. */
  criteria?: SubjectCriterion[]
  subjectComment?: { prompt: string; required: boolean; maxLength: number }
  /** Només per a `goalReview`: pregunta de l'avaluació anterior que conté l'objectiu. */
  sourceQuestionId?: string
  active: boolean
}

export interface Section {
  id: string
  title: string
  intro?: string
  emoji?: string
  questions: Question[]
}

export interface TemplateVersion {
  id: string
  templateId: string
  name: string
  stage: StageId
  version: number
  status: 'draft' | 'published'
  publishedAt?: string
  changeNote?: string
  sections: Section[]
}

export type CampaignStatus =
  | 'ESBORRANY'
  | 'PROGRAMADA'
  | 'OBERTA'
  | 'TANCADA'
  | 'EN_REVISIO'
  | 'INFORMES_GENERATS'
  | 'VALIDADA'
  | 'DISTRIBUIDA'
  | 'ARXIVADA'

export interface Campaign {
  id: string
  year: string
  gradeId: GradeId
  label: string
  templateVersionId: string
  start: string
  end: string
  status: CampaignStatus
  /** Instantània de les matèries del curs en publicar la recollida. */
  subjectsSnapshot: GradeSubject[]
}

export type ResponseStatus = 'NO_INICIADA' | 'EN_CURS' | 'LLIURADA' | 'VALIDADA' | 'INCIDENCIA'

/** Clau de resposta: `pregunta` o `pregunta|materia|criteri` o `pregunta|materia|comentari`. */
export type Answers = Record<string, string>

export interface StudentResponse {
  campaignId: string
  studentId: string
  status: ResponseStatus
  answers: Answers
  updatedAt: string
  submittedAt?: string
  revision: number
}

export interface AuditEntry {
  at: string
  actor: string
  action: string
  detail: string
}

export interface Session {
  email: string
  name: string
  role: Role
  studentId?: string
  groups?: string[]
  /** Compte del domini sense matrícula ni permisos: pendent de verificació. */
  pending?: boolean
  picture?: string
}
