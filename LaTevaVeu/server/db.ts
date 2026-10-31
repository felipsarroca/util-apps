// Accés a PostgreSQL. En producció és un Pool de `pg` contra Neon; a les proves, PGlite.
import type { Pool } from 'pg'

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}

export interface Db extends Queryable {
  /** Executa `fn` dins d'una transacció: tot o res. */
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>
}

export function pgDb(pool: Pool): Db {
  return {
    query: async <T,>(sql: string, params?: unknown[]) => ({ rows: (await pool.query(sql, params)).rows as T[] }),
    async tx(fn) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const out = await fn({ query: async <T,>(sql: string, params?: unknown[]) => ({ rows: (await client.query(sql, params)).rows as T[] }) })
        await client.query('commit')
        return out
      } catch (e) {
        await client.query('rollback')
        throw e
      } finally {
        client.release()
      }
    },
  }
}
