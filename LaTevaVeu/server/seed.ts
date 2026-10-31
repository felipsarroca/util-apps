// Dades de prova del servidor: totes fictícies. Les fan servir les proves, el servidor local
// (npm run server:local) i el fitxer db/dades-prova.sql per a una base de dades de proves.
import { initialGradeSubjects, SUBJECTS } from '../src/domain/catalog'
import { FEEDBACK_SCALES, INITIAL_FEEDBACK_FORMS } from '../src/domain/feedbackForms'
import { INITIAL_SCALES, INITIAL_TEMPLATES } from '../src/domain/templates'
import type { Queryable } from './db'

export type Statement = [sql: string, params: unknown[]]

export const PROVA = {
  year: '2026-2027',
  campaignId: '11111111-1111-4111-8111-111111111111',
  /** Recollida oberta d'«Em miro» de 2n d'ESO. */
  emCampaignId: '22222222-2222-4222-8222-222222222222',
  domain: 'ramonpont.cat',
}

/** Identificadors fixos perquè el fitxer SQL sigui estable. */
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const mail = (u: string) => `${u}@${PROVA.domain}`

const STAFF: [user: string, name: string, roles: string[]][] = [
  ['marta', 'Marta Riera', ['teacher']],
  ['xavier', 'Xavier Duran', ['teacher']],
  ['anna', 'Anna Vila', ['teacher']],
  ['admin', 'Administració', ['admin']],
  ['dir', 'Direcció', ['admin', 'direction']],
]
const NAMES = ['Aina', 'Biel', 'Carla', 'Dani', 'Emma', 'Ferran', 'Gal·la', 'Hugo', 'Iris', 'Joel', 'Laia', 'Marc', 'Nora', 'Oriol', 'Pol', 'Queralt']

/**
 * Configuració inicial d'una base de dades nova, sense cap persona: curs, matèries, escales,
 * qüestionaris d'«Em miro» i d'«Et veig…». La fan servir les dades de prova i la posada en marxa.
 */
export function baseStatements(year: string, starts: string, ends: string): Statement[] {
  const out: Statement[] = [['insert into academic_years values ($1, $2, $3, true)', [year, starts, ends]]]
  for (const s of SUBJECTS) out.push(['insert into subjects values ($1, $2, $3, $4, true)', [s.id, s.short, s.long, s.hue]])
  for (const g of initialGradeSubjects()) out.push(['insert into grade_subjects values ($1, $2, $3, $4, $5, true)', [year, g.gradeId, g.subjectId, g.order, g.optional]])
  for (const s of INITIAL_SCALES) out.push(['insert into answer_scales values ($1, $2, $3, $4)', [s.id, s.name, s.allowNA, JSON.stringify(s.options)]])
  for (const t of [...new Map(INITIAL_TEMPLATES.map((t) => [t.templateId, t])).values()]) out.push(['insert into questionnaire_templates values ($1, $2, $3)', [t.templateId, t.name, t.stage]])
  for (const t of INITIAL_TEMPLATES)
    out.push([
      'insert into template_versions (id, template_id, version, status, definition, change_note, published_at) values ($1, $2, $3, $4, $5, $6, $7)',
      [t.id, t.templateId, t.version, t.status, JSON.stringify({ sections: t.sections }), t.changeNote ?? null, t.publishedAt ?? null],
    ])
  out.push(["insert into app_settings values ('modules', $1)", [JSON.stringify({ emMiro: true, etVeig: true })]])
  for (const s of FEEDBACK_SCALES) out.push(['insert into feedback_scales values ($1, $2, $3, $4)', [s.id, s.name, s.naLabel, JSON.stringify(s.options)]])
  for (const f of INITIAL_FEEDBACK_FORMS)
    out.push([
      "insert into feedback_forms (id, template_id, stage, version, status, scale_id, definition) values ($1, $2, $3, $4, 'published', $5, $6)",
      [f.id, f.templateId, f.stage, f.version, f.scaleId, JSON.stringify({ dimensions: f.dimensions, items: f.items, open: f.open })],
    ])
  return out
}

/** Una persona del personal amb els seus rols (p. ex. el primer administrador). */
export function staffStatements(id: string, email: string, name: string, roles: string[]): Statement[] {
  return [['insert into users (id, email, display_name) values ($1, $2, $3)', [id, email.toLowerCase(), name]], ...roles.map((r): Statement => ['insert into user_roles (user_id, role) values ($1, $2)', [id, r]])]
}

export function seedStatements(): Statement[] {
  const { year, campaignId } = PROVA
  const out: Statement[] = baseStatements(year, '2026-09-01', '2027-06-30')
  // 2n d'ESO A (16 alumnes) i 3r de primària A (3 alumnes).
  const eso = uid(101)
  const cm = uid(102)
  out.push(["insert into class_groups values ($1, $2, '2ESO', 'A'), ($3, $2, '3EP', 'A')", [eso, year, cm]])
  const staffId = new Map<string, string>()
  STAFF.forEach(([u, name, roles], i) => {
    const id = uid(201 + i)
    staffId.set(u, id)
    out.push(...staffStatements(id, mail(u), name, roles))
  })
  out.push([
    "insert into teaching_assignments values ($1, 'MAT', $2), ($1, 'CAT', $3), ($4, 'CAT', $5), ($4, 'MAT', $5)",
    [eso, staffId.get('marta'), staffId.get('xavier'), cm, staffId.get('anna')],
  ])
  const student = (n: number, u: string, name: string, groupId: string) => {
    out.push(["insert into students (id, school_ref, given_name, family_name, school_email) values ($1, $2, $3, 'Prova', $4)", [uid(n), u, name, mail(u)]])
    out.push(['insert into enrollments (id, student_id, group_id) values ($1, $2, $3)', [uid(n + 500), uid(n), groupId]])
  }
  NAMES.forEach((name, i) => student(301 + i, `e${String(i + 1).padStart(2, '0')}`, name, eso))
  for (let i = 1; i <= 3; i++) student(400 + i, `p${i}`, `Primària ${i}`, cm)
  // Marta és la tutora de 2n d'ESO A.
  out.push(['insert into teacher_group_assignments values ($1, $2)', [staffId.get('marta'), eso]])
  // «Em miro»: una recollida oberta de 2n d'ESO.
  const esoTpl = INITIAL_TEMPLATES.filter((t) => t.stage === 'ESO' && t.status === 'published').sort((a, b) => b.version - a.version)[0]
  out.push([
    "insert into campaigns (id, year_id, grade_id, label, template_version_id, subjects_snapshot, starts_on, ends_on, status) values ($1, $2, '2ESO', '1a avaluació', $3, $4, '2026-11-02', '2026-11-20', 'OBERTA')",
    [PROVA.emCampaignId, year, esoTpl.id, JSON.stringify(initialGradeSubjects().filter((g) => g.gradeId === '2ESO'))],
  ])
  const formIds = Object.fromEntries(INITIAL_FEEDBACK_FORMS.map((f) => [f.stage, f.id]))
  out.push([
    "insert into feedback_campaigns (id, year_id, label, stages, starts_on, ends_on, status, form_ids) values ($1, $2, 'Recollida de prova', $3, '2026-11-02', '2026-11-20', 'PROGRAMADA', $4)",
    [campaignId, year, ['CM', 'ESO'], JSON.stringify(formIds)],
  ])
  return out
}

export async function applySeed(q: Queryable) {
  for (const [sql, params] of seedStatements()) await q.query(sql, params)
}

/** Converteix les sentències en un script SQL amb els valors escrits literalment. */
export function seedScript(): string {
  const lit = (v: unknown): string => {
    if (v === null || v === undefined) return 'null'
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    if (Array.isArray(v)) return `array[${v.map(lit).join(', ')}]::text[]`
    return `'${String(v).replace(/'/g, "''")}'`
  }
  const lines = seedStatements().map(([sql, params]) => sql.replace(/\$(\d+)/g, (_, n: string) => lit(params[Number(n) - 1])) + ';')
  return ['-- Dades de prova de La teva veu: totes fictícies. Generat amb npm run docs; no l’editis a mà.', 'begin;', ...lines, 'commit;', ''].join('\n')
}
