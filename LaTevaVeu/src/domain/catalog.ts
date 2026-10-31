import type { Grade, GradeId, GradeSubject, Stage, StageId, Subject } from './types'

export const SCHOOL = {
  name: 'Escola Ramon Pont',
  domain: 'ramonpont.cat',
  timezone: 'Europe/Madrid',
}

export const STAGES: Record<StageId, Stage> = {
  CM: { id: 'CM', name: 'Cicle mitjà de primària', short: '3r i 4t' },
  CS: { id: 'CS', name: 'Cicle superior de primària', short: '5è i 6è' },
  ESO: { id: 'ESO', name: 'Educació secundària obligatòria', short: 'ESO' },
}

export const GRADES: Grade[] = [
  { id: '3EP', name: '3r de primària', stage: 'CM', order: 1 },
  { id: '4EP', name: '4t de primària', stage: 'CM', order: 2 },
  { id: '5EP', name: '5è de primària', stage: 'CS', order: 3 },
  { id: '6EP', name: '6è de primària', stage: 'CS', order: 4 },
  { id: '1ESO', name: "1r d'ESO", stage: 'ESO', order: 5 },
  { id: '2ESO', name: "2n d'ESO", stage: 'ESO', order: 6 },
  { id: '3ESO', name: "3r d'ESO", stage: 'ESO', order: 7 },
  { id: '4ESO', name: "4t d'ESO", stage: 'ESO', order: 8 },
]

export const gradeById = (id: GradeId): Grade => GRADES.find((g) => g.id === id)!

/** Curs al qual passa l'alumnat en començar un curs escolar nou; després de 4t d'ESO, cap (surt de l'escola). */
export const nextGrade = (id: GradeId): GradeId | null => GRADES[GRADES.findIndex((g) => g.id === id) + 1]?.id ?? null

/** Curs escolar següent: «2026-2027» → «2027-2028». */
export const nextYear = (year: string): string => {
  const m = /^(\d{4})-(\d{4})$/.exec(year)
  if (!m) throw new Error(`Curs escolar no vàlid: «${year}».`)
  return `${Number(m[1]) + 1}-${Number(m[2]) + 1}`
}

/** Nom compacte per a taules i xips: «3r EP», «2n ESO». */
export const gradeShort = (id: GradeId): string => id.replace(/^(\d)(EP|ESO)$/, (_, n: string, s: string) => `${n}${({ 1: 'r', 2: 'n', 3: 'r', 4: 't', 5: 'è', 6: 'è' } as Record<string, string>)[n]} ${s}`)

export const SUBJECTS: Subject[] = [
  { id: 'CAT', short: 'Català', long: 'Llengua Catalana i Literatura', hue: 4, active: true },
  { id: 'CAST', short: 'Castellà', long: 'Llengua Castellana i Literatura', hue: 32, active: true },
  { id: 'ANG', short: 'Anglès', long: 'Llengua Estrangera (Anglès)', hue: 210, active: true },
  { id: 'MAT', short: 'Matemàtiques', long: 'Matemàtiques', hue: 250, active: true },
  { id: 'MEDI', short: 'Medi', long: 'Coneixement del Medi Natural, Social i Cultural', hue: 130, active: true },
  { id: 'ART', short: 'Educació Artística', long: 'Educació Artística (Música i Plàstica)', hue: 300, active: true },
  { id: 'EF', short: 'Educació Física', long: 'Educació Física', hue: 160, active: true },
  { id: 'REL', short: 'Religió', long: 'Religió', hue: 45, active: true },
  { id: 'VAL', short: 'Valors', long: 'Educació en Valors Cívics i Ètics', hue: 190, active: true },
  { id: 'BIO', short: 'Biologia', long: 'Biologia i Geologia', hue: 110, active: true },
  { id: 'FQ', short: 'Física i Química', long: 'Física i Química', hue: 270, active: true },
  { id: 'SOC', short: 'Socials', long: 'Ciències Socials: Geografia i Història', hue: 20, active: true },
  { id: 'TEC', short: 'Tecnologia', long: 'Tecnologia i Digitalització', hue: 200, active: true },
  { id: 'MUS', short: 'Música', long: 'Música', hue: 330, active: true },
  { id: 'EPVA', short: 'Plàstica', long: 'Educació Plàstica, Visual i Audiovisual', hue: 350, active: true },
  { id: 'FRA', short: 'Francès', long: 'Segona Llengua Estrangera (Francès)', hue: 225, active: true },
  { id: 'CLA', short: 'Cultura Clàssica', long: 'Cultura Clàssica', hue: 38, active: true },
  { id: 'LLA', short: 'Llatí', long: 'Llatí', hue: 15, active: true },
  { id: 'ECO', short: 'Economia', long: 'Economia i Emprenedoria', hue: 145, active: true },
  { id: 'REC', short: 'Projecte de recerca', long: 'Projecte de Recerca', hue: 175, active: true },
]

export const subjectById = (id: string): Subject | undefined => SUBJECTS.find((s) => s.id === id)

const PRIMARY = ['CAT', 'CAST', 'ANG', 'MAT', 'MEDI', 'ART', 'EF']

/**
 * Catàleg inicial provisional. Primària segueix el Decret 175/2022.
 * ESO: base provisional fins a importar l'inventari real dels formularis del centre.
 */
const PLAN: Record<GradeId, { common: string[]; optional: string[] }> = {
  '3EP': { common: PRIMARY, optional: ['REL'] },
  '4EP': { common: PRIMARY, optional: ['REL'] },
  '5EP': { common: PRIMARY, optional: ['REL'] },
  '6EP': { common: [...PRIMARY, 'VAL'], optional: ['REL'] },
  '1ESO': { common: ['CAT', 'CAST', 'ANG', 'MAT', 'BIO', 'SOC', 'EF', 'MUS', 'TEC'], optional: ['FRA', 'REL'] },
  '2ESO': { common: ['CAT', 'CAST', 'ANG', 'MAT', 'FQ', 'SOC', 'EF', 'EPVA', 'VAL'], optional: ['FRA', 'CLA', 'REL'] },
  '3ESO': { common: ['CAT', 'CAST', 'ANG', 'MAT', 'BIO', 'FQ', 'SOC', 'EF', 'TEC'], optional: ['FRA', 'REL'] },
  '4ESO': { common: ['CAT', 'CAST', 'ANG', 'MAT', 'SOC', 'EF', 'REC'], optional: ['BIO', 'FQ', 'LLA', 'ECO', 'TEC', 'FRA', 'REL'] },
}

export const initialGradeSubjects = (): GradeSubject[] =>
  GRADES.flatMap((g) => {
    const p = PLAN[g.id]
    return [
      ...p.common.map((subjectId, i) => ({ gradeId: g.id, subjectId, order: i + 1, optional: false, active: true })),
      ...p.optional.map((subjectId, i) => ({ gradeId: g.id, subjectId, order: p.common.length + i + 1, optional: true, active: true })),
    ]
  })
