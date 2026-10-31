// Gestió de l'alumnat al servidor: canvis de curs i baixes en bloc, i pas al curs escolar següent.
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DemoState } from '../../src/data/seed'
import { nextGrade } from '../../src/domain/catalog'
import { buildApp } from '../app'
import type { Db } from '../db'
import { memoryDb } from '../pglite'
import { applySeed, PROVA } from '../seed'

const mail = (u: string) => `${u}@ramonpont.cat`

let db: Db
let close: () => Promise<unknown>
let app: ReturnType<typeof buildApp>

const call = async (user: string, method: 'GET' | 'POST', url: string, payload?: object) => {
  const r = await app.inject({ method, url, payload, headers: { authorization: `Bearer ${mail(user)}` } })
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : undefined }
}
const state = async (user: string) => (await call(user, 'GET', '/api/state')).body as { state: DemoState }
const op = (user: string, name: string, ...args: unknown[]) => call(user, 'POST', '/api/ops', { name, args })

beforeAll(async () => {
  const mem = await memoryDb()
  db = mem.db
  close = () => mem.pg.close()
  await applySeed(db)
  app = buildApp({ db, verify: async (t) => ({ sub: `sub-${t}`, email: t, name: t }), draftKey: randomBytes(32), yearId: PROVA.year })
})

afterAll(async () => {
  await app.close()
  await close()
})

describe('alumnat en bloc', () => {
  it('canvia de curs diversos alumnes alhora i només ho pot fer l’administració', async () => {
    const { state: s } = await state('admin')
    const [a, b] = s.students.filter((x) => x.gradeId === '2ESO')
    const to = s.classGroups['3ESO']?.[0] ?? 'A'
    if (!s.classGroups['3ESO']?.length) expect((await op('admin', 'addClassGroup', '3ESO', to)).status).toBe(200)
    expect((await op('marta', 'moveStudents', [a.id, b.id], '3ESO', to)).status).toBe(403)
    expect((await op('admin', 'moveStudents', [a.id, b.id], '3ESO', to)).status).toBe(200)
    const after = (await state('admin')).state.students
    expect(after.filter((x) => [a.id, b.id].includes(x.id)).map((x) => x.gradeId)).toEqual(['3ESO', '3ESO'])
    expect(after.find((x) => x.id === a.id)!.electives).toEqual([])
    // I tornen al seu curs.
    expect((await op('admin', 'moveStudents', [a.id, b.id], '2ESO', a.group)).status).toBe(200)
  })

  it('dona de baixa diversos alumnes: no surten al cens i no poden entrar', async () => {
    const { state: s } = await state('admin')
    const gone = s.students.filter((x) => x.gradeId === '2ESO').slice(-2)
    expect((await op('admin', 'removeStudents', gone.map((x) => x.id))).status).toBe(200)
    const after = (await state('admin')).state.students
    expect(after.some((x) => gone.some((g) => g.id === x.id))).toBe(false)
    expect((await call(gone[0].email.split('@')[0], 'GET', '/api/state')).status).toBe(403)
    const rows = (await db.query<{ active: boolean }>('select active from students where school_ref = any($1)', [gone.map((x) => x.id)])).rows
    expect(rows.map((r) => r.active)).toEqual([false, false])
  })
})

describe('matèries', () => {
  it('una matèria nova i un canvi de nom es desen a la base de dades', async () => {
    const r = await op('admin', 'saveSubject', { short: 'Robòtica', long: 'Robòtica i programació', gradeId: '2ESO', optional: true })
    expect(r.status).toBe(200)
    expect(r.body.result).toBe('ROBOTICA')
    expect((await op('admin', 'saveSubject', { id: 'MAT', short: 'Mates', long: 'Matemàtiques' })).status).toBe(200)
    expect((await op('marta', 'saveSubject', { short: 'Res', long: 'Res' })).status).toBe(403)
    const rows = (await db.query<{ id: string; short_name: string }>("select id, short_name from subjects where id in ('ROBOTICA', 'MAT') order by id")).rows
    expect(rows).toEqual([{ id: 'MAT', short_name: 'Mates' }, { id: 'ROBOTICA', short_name: 'Robòtica' }])
    expect((await db.query("select 1 from grade_subjects where subject_id = 'ROBOTICA' and grade_id = '2ESO' and optional")).rows.length).toBe(1)
  })
})

describe('curs nou', () => {
  it('només l’administració, i només el curs següent', async () => {
    expect((await call('marta', 'POST', '/api/centre/curs-nou', { year: '2027-2028' })).status).toBe(403)
    expect((await call('admin', 'POST', '/api/centre/curs-nou', { year: '2028-2029' })).status).toBe(409)
  })

  it('l’alumnat passa de curs amb el mateix grup, el de 4t d’ESO surt i l’app treballa amb el curs nou', async () => {
    const before = (await state('admin')).state
    const r = await call('admin', 'POST', '/api/centre/curs-nou', { year: '2027-2028' })
    expect(r.status).toBe(200)
    const grads = before.students.filter((x) => !nextGrade(x.gradeId))
    expect(r.body).toEqual({ year: '2027-2028', promoted: before.students.length - grads.length, graduated: grads.length })
    const after = (await state('admin')).state
    expect(after.year).toBe('2027-2028')
    for (const st of before.students) {
      const now = after.students.find((x) => x.id === st.id)
      if (!nextGrade(st.gradeId)) expect(now).toBeUndefined()
      else expect([now?.gradeId, now?.group]).toEqual([nextGrade(st.gradeId), st.group])
    }
    // Les campanyes del curs anterior no surten; les matèries de cada curs sí.
    expect(after.campaigns).toEqual([])
    expect(after.gradeSubjects.length).toBe(before.gradeSubjects.length)
    // Un alumne promocionat continua entrant, ara al curs nou.
    const st = after.students[0]
    const me = await call(st.email.split('@')[0], 'GET', '/api/me')
    expect(me.body.student).toEqual({ gradeId: st.gradeId, group: st.group })
    // El curs anterior es conserva.
    expect((await db.query('select 1 from campaigns where year_id = $1', [PROVA.year])).rows.length).toBeGreaterThan(0)
    // No es pot repetir.
    expect((await call('admin', 'POST', '/api/centre/curs-nou', { year: '2027-2028' })).status).toBe(409)
  })
})
