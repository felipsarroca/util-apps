// Punt d'entrada del servidor. Totes les dades sensibles arriben per variables d'entorn.
import pg from 'pg'
import { buildApp } from './app'
import { googleVerifier } from './auth'
import { draftKey } from './crypto'
import { pgDb } from './db'

const need = (k: string) => {
  const v = process.env[k]
  if (!v) throw new Error(`Falta la variable d'entorn ${k}.`)
  return v
}

const pool = new pg.Pool({ connectionString: need('DATABASE_URL'), ssl: { rejectUnauthorized: true }, max: 5 })
const app = buildApp({
  db: pgDb(pool),
  verify: googleVerifier(need('GOOGLE_CLIENT_ID'), process.env.SCHOOL_DOMAIN ?? 'ramonpont.cat'),
  draftKey: draftKey(need('DRAFT_KEY')),
  yearId: need('ACADEMIC_YEAR'),
  allowedOrigin: process.env.ALLOWED_ORIGIN,
  logger: true,
})

await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 8080) })
