// Proves del servidor d'«Et veig» contra un PostgreSQL real (PGlite) amb l'esquema complet.
// Comproven els criteris d'acceptació del pla mestre v2 (§10) al servidor, no a la interfície.
import type { PGlite } from '@electric-sql/pglite'
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { INITIAL_FEEDBACK_FORMS } from '../../src/domain/feedbackForms'
import type { Answers } from '../../src/domain/types'
import { buildApp } from '../app'
import pg from 'pg'
import { pgDb, type Db } from '../db'
import { memoryDb } from '../pglite'
import { applySeed, PROVA, seedScript } from '../seed'

const { year: YEAR, campaignId: CID } = PROVA
const ESO = INITIAL_FEEDBACK_FORMS.find((f) => f.stage === 'ESO')!
const mail = (u: string) => `${u}@ramonpont.cat`
const full = (extra: Answers = {}): Answers => ({ ...Object.fromEntries(ESO.items.map((i) => [i.id, '3'])), ...extra })

let db: Db
let done: () => Promise<unknown>
let app: ReturnType<typeof buildApp>

const call = async (user: string | null, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) => {
  const r = await app.inject({ method, url, payload, headers: user ? { authorization: `Bearer ${mail(user)}` } : {} })
  return { status: r.statusCode, body: r.body ? (JSON.parse(r.body) as Record<string, unknown>) : undefined }
}
const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]
const toStatus = (user: string, status: string) => call(user, 'POST', `/api/et-veig/${CID}/status`, { status })

beforeAll(async () => {
  // Amb TEST_DATABASE_URL, les proves s'executen contra un PostgreSQL real (p. ex. una branca de Neon
  // amb l'esquema i les dades de prova ja carregats). Si no, en memòria.
  const url = process.env.TEST_DATABASE_URL
  if (url) {
    const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: true }, max: 3 })
    db = pgDb(pool)
    done = () => pool.end()
  } else {
    const mem = await memoryDb()
    db = mem.db
    done = () => mem.pg.close()
    await applySeed(db)
  }
  // Verificador fals: el testimoni és el correu. El real comprova la signatura de Google.
  app = buildApp({ db, verify: async (t) => ({ sub: `sub-${t}`, email: t, name: t }), draftKey: randomBytes(32), yearId: YEAR })
})

afterAll(async () => {
  await app.close()
  await done()
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
    const cols = (await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'feedback_answers'")).rows.map((r) => r.column_name)
    expect(cols.some((c) => /student|user|enrollment/.test(c))).toBe(false)
    const fks = (await db.query<{ t: string }>("select ccu.table_name as t from information_schema.table_constraints tc join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name where tc.table_name = 'feedback_answers' and tc.constraint_type = 'FOREIGN KEY'")).rows.map((r) => r.t)
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

  it('la llista d’autoavaluacions mostra només les pròpies i el seu estat', async () => {
    const tasks = (await call('marta', 'GET', '/api/et-veig/self')).body as unknown as { campaign: { id: string }; stage: string; groups: string[]; self?: { submittedAt?: string } }[]
    expect(tasks.map((t) => t.stage)).toEqual(['ESO'])
    expect(tasks[0].campaign.id).toBe(CID)
    expect(tasks[0].groups.length).toBeGreaterThan(0)
    expect(tasks[0].self?.submittedAt).toBeTruthy()
    const other = (await call('xavier', 'GET', '/api/et-veig/self')).body as unknown as { self?: unknown }[]
    expect(other.every((t) => !t.self)).toBe(true)
    expect((await call('e01', 'GET', '/api/et-veig/self')).status).toBe(403)
    expect((await call('dir', 'GET', '/api/et-veig/no-es-un-id/center')).status).toBe(404)
  })

  it('cap resultat abans de temps, cap comentari sense moderar i llindar de 15 al servidor (criteris 4, 5 i 10)', async () => {
    expect((await call('dir', 'GET', `/api/et-veig/${CID}/reports/${mail('marta')}`)).status).toBe(403)
    // Marta: 14 respostes en total (per sota del llindar). Xavier: 16, amb un comentari.
    for (let i = 2; i <= 14; i++) expect((await call(`e${String(i).padStart(2, '0')}`, 'POST', `/api/et-veig/${CID}/submit/${mail('marta')}`, { answers: full() })).status).toBe(204)
    for (let i = 1; i <= 16; i++) {
      const extra: Answers = i === 1 ? { mantenir: 'Les explicacions amb exemples' } : {}
      expect((await call(`e${String(i).padStart(2, '0')}`, 'POST', `/api/et-veig/${CID}/submit/${mail('xavier')}`, { answers: full(extra) })).status).toBe(204)
    }
    const before = (await db.query<{ id: string }>('select id from feedback_answers')).rows.map((r) => r.id)
    expect((await toStatus('admin', 'TANCADA')).status).toBe(204)
    // En tancar, les respostes es tornen a escriure: les mateixes, en un altre ordre.
    const after = (await db.query<{ id: string }>('select id from feedback_answers')).rows.map((r) => r.id)
    expect([...after].sort()).toEqual([...before].sort())
    expect(await one('select grade_id, group_label, students, participants from feedback_participation_counts where grade_id = $1', ['2ESO'])).toEqual({ grade_id: '2ESO', group_label: 'A', students: 16, participants: 16 })
    expect((await toStatus('admin', 'MODERACIO')).status).toBe(204)
    expect((await toStatus('admin', 'INFORMES_GENERATS')).status).toBe(409)
    expect((await call('admin', 'GET', `/api/et-veig/${CID}/comments`)).status).toBe(403)
    const comments = (await call('dir', 'GET', `/api/et-veig/${CID}/comments`)).body as unknown as { id: string; original: string; teacherName: string }[]
    expect(comments).toHaveLength(2)
    expect((await call('e01', 'GET', '/api/et-veig/campaigns')).status).toBe(403)
    expect((await call('marta', 'GET', '/api/et-veig/campaigns')).body).toMatchObject([{ id: CID, status: 'MODERACIO' }])
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
    // Publicada: ja no queda constància de qui ha participat, només els recomptes.
    expect((await one<{ n: number }>('select count(*)::int as n from feedback_participation'))!.n).toBe(0)
    const x = (await call('xavier', 'GET', `/api/et-veig/${CID}/reports/${mail('xavier')}`)).body as { stages: { n: number; suppressed: boolean; comments: { texts: string[] }[]; dims: { dist: { valid: number } }[] }[] }
    expect(x.stages[0]).toMatchObject({ n: 16, suppressed: false })
    expect(x.stages[0].dims.every((d) => d.dist.valid > 0)).toBe(true)
    expect(x.stages[0].comments.flatMap((c) => c.texts)).toEqual(['Les explicacions amb exemples'])
    expect((await call('marta', 'GET', `/api/et-veig/${CID}/reports/${mail('xavier')}`)).status).toBe(403)
    expect((await call('admin', 'GET', `/api/et-veig/${CID}/reports/${mail('xavier')}`)).status).toBe(403)
    expect((await call('admin', 'GET', `/api/et-veig/${CID}/center`)).status).toBe(403)
    const centre = (await call('dir', 'GET', `/api/et-veig/${CID}/center`)).body as unknown as { stage: string; students: number; participants: number; teachers: { email: string; fav: object }[] }[]
    expect(centre.find((v) => v.stage === 'ESO')).toMatchObject({ students: 16, participants: 16 })
    const t = centre.find((v) => v.stage === 'ESO')!.teachers
    expect(t.find((r) => r.email === mail('marta'))!.fav).toEqual({})
    expect(Object.keys(t.find((r) => r.email === mail('xavier'))!.fav).length).toBeGreaterThan(0)
  })
})

describe('dades de prova', () => {
  it('el fitxer SQL carrega les mateixes dades que les proves', async () => {
    const { pg: other } = await memoryDb()
    await other.exec(seedScript())
    const n = async (p: PGlite, t: string) => (await p.query<{ n: number }>(`select count(*)::int as n from ${t}`)).rows[0].n
    for (const t of ['users', 'students', 'enrollments', 'teaching_assignments', 'feedback_forms']) expect(await n(other, t)).toBeGreaterThan(0)
    expect(await n(other, 'students')).toBe(19)
    await other.close()
  })
})
