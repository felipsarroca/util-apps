// Punt d'entrada per a Neon Functions: la mateixa API (buildApp) darrere d'un gestor fetch(Request).
// APP_DATABASE_URL és la connexió directa del propietari de la base de dades (la posa
// scripts/desplega-servidor.sh; la que injecta Neon no porta contrasenya). Cada connexió passa al rol
// latevaveu_app amb SET ROLE, de manera que el servidor només té els permisos de db/permisos.sql.
// Variables pròpies: APP_DATABASE_URL, GOOGLE_CLIENT_ID, DRAFT_KEY, ACADEMIC_YEAR, ALLOWED_ORIGIN i SCHOOL_DOMAIN.
import pg from 'pg'
import { buildApp } from './app'
import { googleVerifier } from './auth'
import { draftKey } from './crypto'
import { toFetch } from './fetch'
import { pgDb } from './db'

const need = (k: string) => {
  const v = process.env[k]
  if (!v) throw new Error(`Falta la variable d'entorn ${k}.`)
  return v
}

// Connexió directa (sense agrupador): SET ROLE dura tota la sessió i no es perd entre consultes.
const pool = new pg.Pool({ connectionString: need('APP_DATABASE_URL'), max: 5 })
pool.on('connect', (c) => void c.query('set role latevaveu_app'))
// Neon tanca les connexions inactives: sense aquest oient, l'error del Pool aturaria el procés.
pool.on('error', (e) => console.warn('Connexió a la base de dades tancada:', e.message))

const app = buildApp({
  db: pgDb(pool),
  verify: googleVerifier(need('GOOGLE_CLIENT_ID'), process.env.SCHOOL_DOMAIN ?? 'ramonpont.cat'),
  draftKey: draftKey(need('DRAFT_KEY')),
  yearId: need('ACADEMIC_YEAR'),
  allowedOrigin: process.env.ALLOWED_ORIGIN,
  logger: true,
  // Neon recull la sortida d'errors: així els errors inesperats queden als registres de la funció.
  onError: (e) => console.error('Error del servidor:', e instanceof Error ? `${e.message}
${e.stack}` : e),
})
export default toFetch(app)
