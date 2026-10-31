// Executa fitxers SQL contra la base de dades de DATABASE_URL (p. ex. db/schema.sql i db/dades-prova.sql).
// La cadena de connexió es llegeix només de l'entorn: no l'escriguis en cap fitxer.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) throw new Error('Falta la variable d’entorn DATABASE_URL.')
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } })
await client.connect()
try {
  for (const file of process.argv.slice(2)) {
    await client.query(readFileSync(file, 'utf8'))
    console.log(`Aplicat: ${file}`)
  }
} finally {
  await client.end()
}
