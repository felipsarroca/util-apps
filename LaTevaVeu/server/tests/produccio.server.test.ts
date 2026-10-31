// Posada en marxa: base de dades nova amb la configuració inicial i el primer administrador,
// servidor treballant amb el rol latevaveu_app (com a Neon Functions) i gestor fetch(Request).
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import type { Db } from '../db'
import { toFetch } from '../fetch'
import { memoryDb } from '../pglite'
import { baseStatements, staffStatements } from '../seed'

const ORIGIN = 'https://felipsarroca.github.io'
let db: Db
let close: () => Promise<unknown>
let app: ReturnType<typeof buildApp>
let handler: ReturnType<typeof toFetch>

beforeAll(async () => {
  const mem = await memoryDb()
  db = mem.db
  close = () => mem.pg.close()
  // El mateix que scripts/inicia-produccio.ts.
  await db.query('create role latevaveu_app nologin')
  await db.query('grant latevaveu_app to current_user')
  await mem.pg.exec(readFileSync(new URL('../../db/permisos.sql', import.meta.url), 'utf8'))
  for (const [sql, params] of [...baseStatements('2026-2027', '2026-09-01', '2027-06-30'), ...staffStatements(randomUUID(), 'Felip.Sarroca@ramonpont.cat', 'Felip Sarroca', ['admin'])])
    await db.query(sql, params)
  // A partir d'aquí, com el servidor desplegat: només els permisos de latevaveu_app.
  await db.query('set role latevaveu_app')
  app = buildApp({ db, verify: async (t) => ({ sub: `sub-${t}`, email: t, name: t }), draftKey: randomBytes(32), yearId: '2026-2027', allowedOrigin: ORIGIN })
  handler = toFetch(app)
})

afterAll(async () => {
  await app.close()
  await close()
})

const req = (path: string, init: RequestInit & { as?: string } = {}) =>
  handler.fetch(new Request(`https://funcio.example${path}`, { ...init, headers: { origin: ORIGIN, ...(init.as ? { authorization: `Bearer ${init.as}` } : {}), ...init.headers } }))

describe('posada en marxa a Neon', () => {
  it('el primer administrador entra; ningú més', async () => {
    const me = await req('/api/me', { as: 'felip.sarroca@ramonpont.cat' })
    expect(me.status).toBe(200)
    expect(me.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(await me.json()).toMatchObject({ email: 'felip.sarroca@ramonpont.cat', roles: ['admin'] })
    expect((await req('/api/me', { as: 'algu@ramonpont.cat' })).status).toBe(403)
    expect((await req('/api/me')).status).toBe(401)
  })

  it('l’administrador rep la configuració inicial sense cap persona inventada', async () => {
    const r = await req('/api/state', { as: 'felip.sarroca@ramonpont.cat' })
    expect(r.status).toBe(200)
    const { session, state } = (await r.json()) as { session: { role: string }; state: { templates: unknown[]; subjects: unknown[]; students: unknown[] } }
    expect(session.role).toBe('admin')
    expect(state.templates.length).toBeGreaterThan(0)
    expect(state.subjects.length).toBeGreaterThan(0)
    expect(state.students).toEqual([])
  })

  it('respon a la comprovació prèvia del navegador (CORS) i als errors amb JSON', async () => {
    const pre = await req('/api/me', { method: 'OPTIONS' })
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-headers')).toContain('authorization')
    const bad = await req('/api/no-existeix', { as: 'felip.sarroca@ramonpont.cat' })
    expect(bad.status).toBe(404)
  })

  it('el rol del servidor no pot reescriure el registre d’operacions', async () => {
    await expect(db.query("update audit_log set action = 'x'")).rejects.toThrow()
  })
})
