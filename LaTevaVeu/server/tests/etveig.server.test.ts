// Proves del servidor d'«Et veig» contra un PostgreSQL real (PGlite) amb l'esquema complet.
// Comproven els criteris d'acceptació del pla mestre v2 (§10) al servidor, no a la interfície.
import { PGlite } from '@electric-sql/pglite'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { initialGradeSubjects, SUBJECTS } from '../../src/domain/catalog'
import { FEEDBACK_SCALES, INITIAL_FEEDBACK_FORMS } from '../../src/domain/feedbackForms'
import type { Answers } from '../../src/domain/types'
import { buildApp } from '../app'
import type { Db } from '../db'

const YEAR = '2026-2027'
const CID = '11111111-1111-4111-8111-111111111111'
const ESO = INITIAL_FEEDBACK_FORMS.find((f) => f.stage === 'ESO')!
const mail = (u: string) => `${u}@ramonpont.cat`
const full = (extra: Answers = {}): Answers => ({ ...Object.fromEntries(ESO.items.map((i) => [i.id, '3'])), ...extra })

let pg: PGlite
let app: ReturnType<typeof buildApp>

const call = async (user: string | null, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) => {
  const r = await app.inject({ method, url, payload, headers: user ? { authorization: `Bearer ${mail(user)}` } : {} })
  return { status: r.statusCode, body: r.body ? (JSON.parse(r.body) as Record<string, unknown>) : undefined }
}
const one = async <T,>(sql: string, p: unknown[] = []) => (await pg.query<T>(sql, p)).rows[0]
const toStatus = (user: string, status: string) => call(user, 'POST', `/api/et-veig/${CID}/status`, { status })

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8'))
  const db: Db = {
    query: async (sql, params) => ({ rows: (await pg.query(sql, params)).rows as never[] }),
    tx: (fn) => pg.transaction((t) => fn({ query: async (sql, params) => ({ rows: (await t.query(sql, params)).rows as never[] }) })),
  }
  // Dades mínimes: 2n d'ESO A (16 alumnes) i 3r de primària A (3 alumnes).
  await pg.query(`insert into academic_years values ($1, '2026-09-01', '2027-06-30', true)`, [YEAR])
  for (const s of SUBJECTS) await pg.query('insert into subjects values ($1, $2, $3, $4, true)', [s.id, s.short, s.long, s.hue])
  for (const g of initialGradeSubjects()) await pg.query('insert into grade_subjects values ($1, $2, $3, $4, $5, true)', [YEAR, g.gradeId, g.subjectId, g.order, g.optional])
  const group = async (grade: string) => (await one<{ id: string }>('insert into class_groups (year_id, grade_id, label) values ($1, $2, $3) returning id', [YEAR, grade, 'A']))!.id
  const eso = await group('2ESO')
  const cm = await group('3EP')
  const user = async (u: string, name: string, roles: string[]) => {
    const id = (await one<{ id: string }>('insert into users (email, display_name) values ($1, $2) returning id', [mail(u), name]))!.id
    for (const r of roles) await pg.query('insert into user_roles (user_id, role) values ($1, $2)', [id, r])
    return id
  }
  const marta = await user('marta', 'Marta Riera', ['teacher'])
  const xavier = await user('xavier', 'Xavier Duran', ['teacher'])
  const anna = await user('anna', 'Anna Vila', ['teacher'])
  await user('admin', 'Administració', ['admin'])
  await user('dir', 'Direcció', ['admin', 'direction'])
  await pg.query("insert into teaching_assignments values ($1, 'MAT', $2), ($1, 'CAT', $3), ($4, 'CAT', $5), ($4, 'MAT', $5)", [eso, marta, xavier, cm, anna])
  const student = async (u: string, groupId: string, name = u) => {
    const s = (await one<{ id: string }>("insert into students (school_ref, given_name, family_name, school_email) values ($1, $3, 'Prova', $2) returning id", [u, mail(u), name]))!.id
    await pg.query('insert into enrollments (student_id, group_id) values ($1, $2)', [s, groupId])
  }
  for (let i = 1; i <= 16; i++) await student(`e${String(i).padStart(2, '0')}`, eso, i === 2 ? 'Biel' : undefined)
  for (let i = 1; i <= 3; i++) await student(`p${i}`, cm)
  for (const s of FEEDBACK_SCALES) await pg.query('insert into feedback_scales values ($1, $2, $3, $4)', [s.id, s.name, s.naLabel, JSON.stringify(s.options)])
  for (const f of INITIAL_FEEDBACK_FORMS)
    await pg.query("insert into feedback_forms (id, template_id, stage, version, status, scale_id, definition) values ($1, $2, $3, $4, 'published', $5, $6)", [
      f.id, f.templateId, f.stage, f.version, f.scaleId, JSON.stringify({ dimensions: f.dimensions, items: f.items, open: f.open }),
    ])
  const formIds = Object.fromEntries(INITIAL_FEEDBACK_FORMS.map((f) => [f.stage, f.id]))
  await pg.query("insert into feedback_campaigns (id, year_id, label, stages, starts_on, ends_on, status, form_ids) values ($1, $2, 'Recollida de prova', $3, '2026-11-02', '2026-11-20', 'PROGRAMADA', $4)", [
    CID, YEAR, ['CM', 'ESO'], JSON.stringify(formIds),
  ])
  // Verificador fals: el testimoni és el correu. El real comprova la signatura de Google.
  app = buildApp({ db, verify: async (t) => ({ sub: `sub-${t}`, email: t, name: t }), draftKey: randomBytes(32), yearId: YEAR })
})

afterAll(async () => {
  await app.close()
  await pg.close()
})

describe('servidor d’«Et veig»', () => {
  it('només entra qui és al cens o té un rol', async () => {
    expect((await call(null, 'GET', '/api/me')).status).toBe(401)
    expect((await call('algu.nou', 'GET', '/api/me')).status).toBe(403)
    expect((await call('e01', 'GET', '/api/me')).body).toMatchObject({ student: { gradeId: '2ESO', group: 'A' } })
  })

  it('obrir la recollida congela les assignacions; només administració o direcció', async () => {
    expect((await toStatus('marta', 'OBERTA')).status).toBe(403)
    expect((await toStatus('admin', 'OBERTA')).status).toBe(204)
    const c = await one<{ assignments: unknown[]; teacher_ids: string[] }>('select assignments, teacher_ids from feedback_campaigns where id = $1', [CID])
    expect(c!.assignments).toHaveLength(4)
    expect(c!.teacher_ids).toHaveLength(3)
  })

  it('l’alumne veu cada docent seu una sola vegada i no pot valorar qui no li fa classe (criteri 1)', async () => {
    const home = (await call('e01', 'GET', '/api/et-veig/home')).body as { targets: { email: string }[] }
    expect(home.targets.map((t) => t.email).sort()).toEqual([mail('marta'), mail('xavier')])
    expect((await call('e01', 'POST', `/api/et-veig/${CID}/submit/${mail('anna')}`, { answers: full() })).status).toBe(403)
  })

  it('l’esborrany es desa xifrat i es recupera', async () => {
    expect((await call('e01', 'PUT', `/api/et-veig/${CID}/drafts/${mail('marta')}`, { answers: { [ESO.items[0].id]: '4', mantenir: 'secret-de-prova' } })).status).toBe(204)
    const row = await one<{ payload: Uint8Array }>('select payload from feedback_drafts')
    expect(Buffer.from(row!.payload).toString('latin1')).not.toContain('secret-de-prova')
    const home = (await call('e01', 'GET', '/api/et-veig/home')).body as { targets: { email: string; status: string; draft?: Answers }[] }
    expect(home.targets.find((t) => t.email === mail('marta'))).toMatchObject({ status: 'esborrany', draft: { mantenir: 'secret-de-prova' } })
  })

  it('el lliurament no guarda cap identificador d’alumne i no es pot repetir (criteris 2 i 3)', async () => {
    expect((await call('e01', 'POST', `/api/et-veig/${CID}/submit/${mail('marta')}`, { answers: { [ESO.items[0].id]: '4' } })).status).toBe(400)
    expect((await call('e01', 'POST', `/api/et-veig/${CID}/submit/${mail('marta')}`, { answers: full({ millorar: 'El Biel parla massa' }) })).status).toBe(204)
    const cols = (await pg.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'feedback_answers'")).rows.map((r) => r.column_name)
    expect(cols.some((c) => /student|user|enrollment/.test(c))).toBe(false)
    const fks = (await pg.query<{ t: string }>("select ccu.table_name as t from information_schema.table_constraints tc join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name where tc.table_name = 'feedback_answers' and tc.constraint_type = 'FOREIGN KEY'")).rows.map((r) => r.t)
    expect(fks).not.toContain('students')
    expect((await one<{ n: number }>('select count(*)::int as n from feedback_drafts'))!.n).toBe(0)
    expect((await one<{ flags: string[] }>('select flags from feedback_comments'))!.flags.join()).toMatch(/Biel/)
    expect((await call('e01', 'POST', `/api/et-veig/${CID}/submit/${mail('marta')}`, { answers: full() })).status).toBe(409)
    expect((await call('e01', 'PUT', `/api/et-veig/${CID}/drafts/${mail('marta')}`, { answers: full() })).status).toBe(409)
  })

  it('autoavaluació docent: només de les etapes on fa classe', async () => {
    expect((await call('marta', 'PUT', `/api/et-veig/${CID}/self/ESO`, { answers: full(), submit: true })).status).toBe(204)
    expect((await call('marta', 'PUT', `/api/et-veig/${CID}/self/CM`, { answers: full(), submit: true })).status).toBe(403)
    expect((await call('marta', 'PUT', `/api/et-veig/${CID}/self/ESO`, { answers: full() })).status).toBe(409)
  })

  it('cap resultat abans de temps, cap comentari sense moderar i llindar de 15 al servidor (criteris 4, 5 i 10)', async () => {
    expect((await call('dir', 'GET', `/api/et-veig/${CID}/reports/${mail('marta')}`)).status).toBe(403)
    // Marta: 14 respostes en total (per sota del llindar). Xavier: 16, amb un comentari.
    for (let i = 2; i <= 14; i++) expect((await call(`e${String(i).padStart(2, '0')}`, 'POST', `/api/et-veig/${CID}/submit/${mail('marta')}`, { answers: full() })).status).toBe(204)
    for (let i = 1; i <= 16; i++) {
      const extra: Answers = i === 1 ? { mantenir: 'Les explicacions amb exemples' } : {}
      expect((await call(`e${String(i).padStart(2, '0')}`, 'POST', `/api/et-veig/${CID}/submit/${mail('xavier')}`, { answers: full(extra) })).status).toBe(204)
    }
    for (const s of ['TANCADA', 'MODERACIO']) expect((await toStatus('admin', s)).status).toBe(204)
    expect((await toStatus('admin', 'INFORMES_GENERATS')).status).toBe(409)
    const comments = (await pg.query<{ id: string; original: string }>('select id, original from feedback_comments')).rows
    const biel = comments.find((c) => c.original.includes('Biel'))!
    const good = comments.find((c) => c.original.includes('exemples'))!
    expect((await call('admin', 'POST', `/api/et-veig/comments/${good.id}/moderation`, { status: 'acceptat' })).status).toBe(403)
    expect((await call('dir', 'POST', `/api/et-veig/comments/${biel.id}/moderation`, { status: 'editat', text: 'Un company parla massa' })).status).toBe(204)
    expect((await call('dir', 'POST', `/api/et-veig/comments/${good.id}/moderation`, { status: 'acceptat' })).status).toBe(204)
    expect((await toStatus('dir', 'INFORMES_GENERATS')).status).toBe(204)

    // Informes generats: la direcció els veu; els docents encara no.
    expect((await call('marta', 'GET', `/api/et-veig/${CID}/reports/${mail('marta')}`)).status).toBe(403)
    const m = (await call('dir', 'GET', `/api/et-veig/${CID}/reports/${mail('marta')}`)).body as { stages: { n: number; suppressed: boolean; items: unknown[]; comments: unknown[]; dims: { dist: { valid: number } }[] }[] }
    expect(m.stages[0]).toMatchObject({ n: 14, suppressed: true, items: [], comments: [] })
    expect(m.stages[0].dims.every((d) => d.dist.valid === 0)).toBe(true)
    expect((await one<{ n: number }>('select count(*)::int as n from feedback_report_views'))!.n).toBe(1)
  })

  it('publicats: cada docent veu només el seu informe; l’administració sense direcció, cap (criteri 5)', async () => {
    expect((await toStatus('dir', 'PUBLICADA')).status).toBe(204)
    const x = (await call('xavier', 'GET', `/api/et-veig/${CID}/reports/${mail('xavier')}`)).body as { stages: { n: number; suppressed: boolean; comments: { texts: string[] }[]; dims: { dist: { valid: number } }[] }[] }
    expect(x.stages[0]).toMatchObject({ n: 16, suppressed: false })
    expect(x.stages[0].dims.every((d) => d.dist.valid > 0)).toBe(true)
    expect(x.stages[0].comments.flatMap((c) => c.texts)).toEqual(['Les explicacions amb exemples'])
    expect((await call('marta', 'GET', `/api/et-veig/${CID}/reports/${mail('xavier')}`)).status).toBe(403)
    expect((await call('admin', 'GET', `/api/et-veig/${CID}/reports/${mail('xavier')}`)).status).toBe(403)
    expect((await call('admin', 'GET', `/api/et-veig/${CID}/center`)).status).toBe(403)
    const centre = (await call('dir', 'GET', `/api/et-veig/${CID}/center`)).body as unknown as { stage: string; teachers: { email: string; fav: object }[] }[]
    const t = centre.find((v) => v.stage === 'ESO')!.teachers
    expect(t.find((r) => r.email === mail('marta'))!.fav).toEqual({})
    expect(Object.keys(t.find((r) => r.email === mail('xavier'))!.fav).length).toBeGreaterThan(0)
  })
})
