// Permisos de la base de dades: el registre d'operacions només creix i l'usuari de l'aplicació no el pot tocar.
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db'
import { memoryDb } from '../pglite'

let db: Db
let close: () => Promise<unknown>

beforeAll(async () => {
  const mem = await memoryDb()
  db = mem.db
  close = () => mem.pg.close()
  await db.query('create role latevaveu_app')
  await mem.pg.exec(readFileSync(new URL('../../db/permisos.sql', import.meta.url), 'utf8'))
  await db.query("insert into audit_log (action, detail) values ('Prova', '{}')")
})

afterAll(async () => {
  await close()
})

const can = async (table: string, priv: string) =>
  (await db.query<{ ok: boolean }>('select has_table_privilege($1, $2, $3) as ok', ['latevaveu_app', table, priv])).rows[0].ok

describe('permisos de la base de dades', () => {
  it('ningú no pot modificar ni esborrar el registre', async () => {
    await expect(db.query("update audit_log set action = 'Canviat'")).rejects.toThrow(/registre/)
    await expect(db.query('delete from audit_log')).rejects.toThrow(/registre/)
    await expect(db.query('truncate audit_log')).rejects.toThrow(/registre/)
    expect((await db.query<{ action: string }>('select action from audit_log')).rows).toEqual([{ action: 'Prova' }])
  })

  it('l’usuari de l’aplicació treballa amb les dades però al registre només hi afegeix', async () => {
    expect(await can('audit_log', 'INSERT')).toBe(true)
    expect(await can('audit_log', 'SELECT')).toBe(true)
    expect(await can('audit_log', 'UPDATE')).toBe(false)
    expect(await can('audit_log', 'DELETE')).toBe(false)
    expect(await can('responses', 'UPDATE')).toBe(true)
    expect(await can('student_subjects', 'DELETE')).toBe(true)
  })
})
