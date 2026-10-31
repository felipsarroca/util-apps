// PostgreSQL en memòria (PGlite) amb l'esquema complet: per a les proves i el servidor local.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import type { Db } from './db'

export async function memoryDb(): Promise<{ pg: PGlite; db: Db }> {
  const pg = new PGlite()
  await pg.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'))
  const db: Db = {
    query: async (sql, params) => ({ rows: (await pg.query(sql, params)).rows as never[] }),
    tx: (fn) => pg.transaction((t) => fn({ query: async (sql, params) => ({ rows: (await t.query(sql, params)).rows as never[] }) })),
  }
  return { pg, db }
}
