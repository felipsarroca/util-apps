// Operacions d'«Em miro» i de la gestió del centre. Cada una s'executa amb les mateixes regles que la
// demostració (src/data/api.ts) sobre l'estat llegit de la base de dades, dins d'una transacció exclusiva,
// i només s'escriu el que ha canviat. La sessió la construeix el servidor: el navegador no la tria.
import { ForbiddenError, runWithState, SERVER_OPS } from '../src/data/api'
import type { Actor } from './auth'
import { forbidden, HttpError, invalid } from './errors'
import type { Ctx } from './etveig'
import { persist } from './persist'
import { loadState, scopeState, sessionOf } from './state'

export type OpName = keyof typeof SERVER_OPS

/** L'alumnat només pot respondre i avisar d'una incidència amb les seves dades. */
const STUDENT_OPS: OpName[] = ['saveDraft', 'submitResponse', 'logAudit']

/** Un sol escriptor alhora: cada operació llegeix i escriu un estat coherent. */
export const LOCK = 7_040_601

export async function stateFor(ctx: Ctx, actor: Actor) {
  const { state } = await loadState(ctx.db, ctx.yearId)
  const session = sessionOf(actor, state)
  if (session.pending) throw forbidden()
  return { session, state: scopeState(state, session) }
}

export async function runOp(ctx: Ctx, actor: Actor, name: string, args: unknown) {
  if (!Object.hasOwn(SERVER_OPS, name)) throw invalid('Operació desconeguda.')
  if (!Array.isArray(args) || args.length > 6) throw invalid('Paràmetres no vàlids.')
  const fn = SERVER_OPS[name as OpName] as (...a: unknown[]) => unknown
  return ctx.db.tx(async (q) => {
    await q.query('select pg_advisory_xact_lock($1)', [LOCK])
    const { state, ids } = await loadState(q, ctx.yearId)
    const session = sessionOf(actor, state)
    if (session.pending || (session.role === 'student' && !STUDENT_OPS.includes(name as OpName))) throw forbidden()
    let out: { state: typeof state; result: unknown }
    try {
      out = runWithState(state, () => fn(session, ...args))
    } catch (e) {
      if (e instanceof HttpError) throw e
      if (e instanceof ForbiddenError) throw forbidden(e.message)
      // Les regles de la demostració expliquen el motiu en català: es retorna tal qual.
      throw new HttpError(409, e instanceof Error && !(e instanceof TypeError) ? e.message : 'Paràmetres no vàlids.')
    }
    await persist(q, ctx.yearId, ids, state, out.state, actor.userId)
    return { result: out.result ?? null, state: scopeState(out.state, session) }
  })
}
