// Servidor local NOMÉS per desenvolupar: base de dades en memòria amb dades de prova i
// identificació simulada (el testimoni és el correu). No s'ha de desplegar mai.
import { randomBytes } from 'node:crypto'
import { buildApp } from './app'
import { memoryDb } from './pglite'
import { applySeed, PROVA } from './seed'

if (process.env.NODE_ENV === 'production') throw new Error('server/local.ts és només per a desenvolupament.')

const { db } = await memoryDb()
await applySeed(db)
const app = buildApp({
  db,
  verify: async (token) => {
    if (!token.endsWith(`@${PROVA.domain}`)) throw new Error('Testimoni de prova no vàlid.')
    return { sub: `prova-${token}`, email: token.toLowerCase(), name: token }
  },
  draftKey: randomBytes(32),
  yearId: PROVA.year,
  allowedOrigin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:5191',
})
const port = Number(process.env.PORT ?? 8787)
await app.listen({ host: '127.0.0.1', port })
console.log(`Servidor de prova a http://127.0.0.1:${port} (dades fictícies en memòria)`)
