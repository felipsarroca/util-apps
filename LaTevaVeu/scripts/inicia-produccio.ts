// Posa en marxa una base de dades de producció buida: esquema, permisos del servidor,
// configuració inicial (sense cap persona) i el primer administrador.
// La cadena de connexió (propietari) es llegeix de DATABASE_URL; no l'escriguis enlloc.
//
// Ús: DATABASE_URL="$(…)" npx vite-node scripts/inicia-produccio.ts -- <correu> "<Nom>" <curs> <inici> <final>
//   p. ex. … -- felip.sarroca@ramonpont.cat "Felip Sarroca" 2026-2027 2026-09-01 2027-06-30
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { baseStatements, staffStatements } from '../server/seed'

const [email, name, year, starts, ends] = process.argv.slice(2).filter((a) => a !== '--')
if (!email || !name || !/^\d{4}-\d{4}$/.test(year ?? '') || !starts || !ends) throw new Error('Ús: <correu> "<Nom>" <curs AAAA-AAAA> <inici AAAA-MM-DD> <final AAAA-MM-DD>')
const url = process.env.DATABASE_URL
if (!url) throw new Error('Falta la variable d’entorn DATABASE_URL.')

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } })
await client.connect()
try {
  const { rows } = await client.query("select count(*)::int as n from information_schema.tables where table_schema = 'public'")
  if (rows[0].n > 0) throw new Error('La base de dades no és buida: no s’hi aplica res.')
  await client.query('begin')
  await client.query(readFileSync('db/schema.sql', 'utf8'))
  // El servidor treballa amb el rol latevaveu_app (SET ROLE): sense contrasenya pròpia ni permisos d'esquema.
  await client.query("do $$ begin if not exists (select from pg_roles where rolname = 'latevaveu_app') then create role latevaveu_app nologin; end if; end $$")
  await client.query('grant latevaveu_app to current_user')
  await client.query(readFileSync('db/permisos.sql', 'utf8'))
  for (const [sql, params] of [...baseStatements(year, starts, ends), ...staffStatements(randomUUID(), email, name, ['admin'])]) await client.query(sql, params)
  await client.query('commit')
  console.log(`Base de dades a punt. Curs ${year}; administrador: ${email}.`)
} catch (e) {
  await client.query('rollback').catch(() => {})
  throw e
} finally {
  await client.end()
}
