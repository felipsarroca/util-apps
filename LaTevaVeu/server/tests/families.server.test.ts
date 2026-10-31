// Responsables afegits o corregits a mà: es desen a la base de dades i només ho pot fer qui gestiona les famílies.
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DemoState } from '../../src/data/seed'
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
const op = (user: string, name: string, ...args: unknown[]) => call(user, 'POST', '/api/ops', { name, args })
const guardians = async (ref: string) => ((await call('admin', 'GET', '/api/state')).body as { state: DemoState }).state.students.find((s) => s.id === ref)!.guardians

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

describe('responsables a mà', () => {
  it('se n’afegeixen i se’n corregeixen el nom i el correu', async () => {
    expect((await op('marta', 'saveGuardian', 'e03', null, { name: 'Maria Serra', email: 'maria@exemple.cat', validated: true })).status).toBe(403)
    expect((await op('admin', 'saveGuardian', 'e03', null, { name: '  Maria   Serra ', email: 'Maria@Exemple.cat', validated: true })).status).toBe(200)
    expect((await op('dir', 'saveGuardian', 'e03', null, { name: 'Joan Font', email: 'joan@exemple.cat', validated: false })).status).toBe(200)
    // El servidor els torna per ordre alfabètic.
    expect(await guardians('e03')).toEqual([
      { name: 'Joan Font', email: 'joan@exemple.cat', validated: false },
      { name: 'Maria Serra', email: 'maria@exemple.cat', validated: true },
    ])
    expect((await op('admin', 'saveGuardian', 'e03', 'joan@exemple.cat', { name: 'Joan Font Roca', email: 'joan.font@exemple.cat', validated: true })).status).toBe(200)
    expect(await guardians('e03')).toEqual([
      { name: 'Joan Font Roca', email: 'joan.font@exemple.cat', validated: true },
      { name: 'Maria Serra', email: 'maria@exemple.cat', validated: true },
    ])
    const rows = (await db.query<{ email: string }>("select g.email from student_guardians sg join guardians g on g.id = sg.guardian_id join students s on s.id = sg.student_id where s.school_ref = 'e03' order by 1")).rows
    expect(rows.map((r) => r.email)).toEqual(['joan.font@exemple.cat', 'maria@exemple.cat'])
  })

  it('rebutja correus no vàlids, repetits o noms buits', async () => {
    expect((await op('admin', 'saveGuardian', 'e03', null, { name: 'X', email: 'no-és-correu', validated: true })).status).toBe(409)
    expect((await op('admin', 'saveGuardian', 'e03', null, { name: 'Altra', email: 'maria@exemple.cat', validated: true })).status).toBe(409)
    expect((await op('admin', 'saveGuardian', 'e03', null, { name: ' ', email: 'nou@exemple.cat', validated: true })).status).toBe(409)
    expect((await op('admin', 'saveGuardian', 'e03', 'ningu@exemple.cat', { name: 'Nou', email: 'nou@exemple.cat', validated: true })).status).toBe(409)
  })
})
