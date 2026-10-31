// Model de domini de La teva veu (apartats «Em miro» i «Et veig»). Les mateixes entitats es reflecteixen a db/schema.sql.

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
  /** Equip Directiu: pot veure tots els resultats d'«Et veig» (permís `et_veig_direccio`). */
  direction?: boolean
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
  /** Text de l'opció «No escau» (p. ex. «No ho puc valorar»). */
  naLabel?: string
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
  direction?: boolean
}

// ---------- Configuració general ----------

/** Apartats que l'administració pot activar o desactivar temporalment. */
export interface Modules {
  emMiro: boolean
  etVeig: boolean
}

/** Qui imparteix cada matèria a cada grup. És la base d'«Et veig». */
export interface TeachingAssignment {
  teacherEmail: string
  gradeId: GradeId
  group: string
  subjectId: string
}

// ---------- Et veig ----------

export interface FeedbackDimension {
  id: string
  name: string
  emoji: string
}

export interface FeedbackItem {
  id: string
  dimensionId: string
  /** Text per a l'alumnat. */
  student: string
  /** La mateixa afirmació en primera persona, per a l'autoavaluació del docent. */
  teacher: string
}

export interface FeedbackOpenQuestion {
  id: string
  text: string
  maxLength: number
}

/** Qüestionari d'«Et veig» d'una etapa. Una versió publicada és immutable. */
export interface FeedbackForm {
  id: string
  templateId: string
  stage: StageId
  version: number
  status: 'draft' | 'published'
  publishedAt?: string
  changeNote?: string
  scaleId: string
  dimensions: FeedbackDimension[]
  items: FeedbackItem[]
  open: FeedbackOpenQuestion[]
}

export type FeedbackStatus = 'ESBORRANY' | 'PROGRAMADA' | 'OBERTA' | 'TANCADA' | 'MODERACIO' | 'INFORMES_GENERATS' | 'PUBLICADA' | 'ARXIVADA'

export interface FeedbackCampaign {
  id: string
  year: string
  label: string
  stages: StageId[]
  start: string
  end: string
  status: FeedbackStatus
  /** Versió de qüestionari congelada per etapa. */
  formIds: Partial<Record<StageId, string>>
  /** Assignacions docents congelades en obrir-la. */
  assignments: TeachingAssignment[]
  /** Docents que participen en aquesta recollida. */
  teachers: string[]
}

/** Esborrany d'un alumne sobre un docent. S'esborra en lliurar (al servidor anirà xifrat). */
export interface FeedbackDraft {
  campaignId: string
  studentId: string
  teacherEmail: string
  answers: Answers
  updatedAt: string
}

/** Control de participació: qui ha lliurat qui. No conté respostes. */
export interface Participation {
  campaignId: string
  studentId: string
  teacherEmail: string
  day: string
}

/**
 * Respostes lliurades, SENSE cap identificador d'alumne.
 * `v`: un caràcter per afirmació, en l'ordre del qüestionari ('1'-'4'; '0' = no ho puc valorar; '-' = sense resposta).
 */
export interface FeedbackAnswer {
  id: string
  campaignId: string
  formId: string
  teacherEmail: string
  stage: StageId
  gradeId: GradeId
  group: string
  day: string
  v: string
}

export type ModerationStatus = 'pendent' | 'acceptat' | 'editat' | 'descartat'

export interface FeedbackComment {
  id: string
  campaignId: string
  teacherEmail: string
  stage: StageId
  questionId: string
  original: string
  /** Text que veurà el docent (només si s'ha acceptat o editat). */
  published?: string
  status: ModerationStatus
  flags: string[]
}

export const CONTEXT_TAGS = [
  { id: 'nova', label: 'Primer any que imparteixo aquesta matèria' },
  { id: 'gestio', label: 'Grup amb necessitats elevades de gestió de l’aula' },
  { id: 'diversitat', label: 'Grup amb molta diversitat o NESE' },
  { id: 'hores', label: 'Poques hores setmanals amb el grup' },
] as const

export interface SelfAssessment {
  campaignId: string
  teacherEmail: string
  stage: StageId
  answers: Answers
  /** Etiquetes de context per grup (`GRADE-GRUP` → ids de CONTEXT_TAGS). */
  context: Record<string, string[]>
  updatedAt: string
  submittedAt?: string
}
