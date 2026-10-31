// API HTTP de La teva veu. Cada petició s'identifica amb el testimoni de Google i
// cada operació comprova els permisos al servidor.
import Fastify, { type FastifyRequest } from 'fastify'
import type { Answers, FeedbackStatus, ModerationStatus, StageId } from '../src/domain/types'
import { resolveActor, type Actor, type Verifier } from './auth'
import type { Db } from './db'
import { HttpError, unauthorized } from './errors'
import * as etVeig from './etveig'
import * as families from './families'
import * as curs from './curs'
import * as ops from './ops'

export interface AppOptions {
  db: Db
  verify: Verifier
  draftKey: Buffer
  /** Curs escolar si la base de dades no en té cap de marcat com a actual. */
  yearId: string
  /** Origen autoritzat del frontend (p. ex. https://felipsarroca.github.io). */
  allowedOrigin?: string
  logger?: boolean
  /** Rep els errors inesperats (p. ex. per escriure'ls on la plataforma els recull). */
  onError?: (err: unknown) => void
}

export function buildApp(o: AppOptions) {
  // El registre no inclou mai el cos de les peticions: hi podria haver respostes.
  const app = Fastify({ logger: o.logger ? { level: 'info', serializers: { req: (r) => ({ method: r.method, url: r.url.replace(/[^/?]+@[^/?]+/g, '…') }) } } : false, bodyLimit: 64 * 1024 })
  const ctx: etVeig.Ctx = { db: o.db, key: o.draftKey, yearId: o.yearId }

  app.addHook('onRequest', async (req, reply) => {
    if (o.allowedOrigin) {
      reply.header('access-control-allow-origin', o.allowedOrigin)
      reply.header('vary', 'origin')
      reply.header('access-control-allow-headers', 'authorization, content-type')
      reply.header('access-control-allow-methods', 'GET, POST, PUT, OPTIONS')
    }
    reply.header('cache-control', 'no-store')
    if (req.method === 'OPTIONS') return reply.code(204).send()
    // El curs actual és el que marca la base de dades: en començar-ne un de nou no cal tornar a desplegar.
    if (req.url !== '/api/health') ctx.yearId = (await o.db.query<{ id: string }>('select id from academic_years where current')).rows[0]?.id ?? o.yearId
  })

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message })
    const status = (err as { statusCode?: number }).statusCode
    if (status && status < 500) return reply.code(status).send({ error: 'Petició no vàlida.' })
    app.log.error(err)
    o.onError?.(err)
    return reply.code(500).send({ error: 'Hi ha hagut un error al servidor.' })
  })

  const actorOf = async (req: FastifyRequest): Promise<Actor> => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')
    if (!m) throw unauthorized()
    return resolveActor(o.db, await o.verify(m[1]), ctx.yearId)
  }

  type P = { campaignId: string; teacherEmail: string; stage: StageId; id: string }

  app.get('/api/health', async () => ({ ok: true }))

  app.get('/api/me', async (req) => {
    const a = await actorOf(req)
    return { email: a.email, name: a.name, roles: [...a.roles], student: a.student ? { gradeId: a.student.gradeId, group: a.student.group } : undefined }
  })

  app.get('/api/et-veig/campaigns', async (req) => etVeig.listCampaigns(ctx, await actorOf(req)))

  app.get<{ Params: P }>('/api/et-veig/:campaignId/comments', async (req) => etVeig.listComments(ctx, await actorOf(req), req.params.campaignId))

  app.get('/api/et-veig/home', async (req) => etVeig.feedbackHome(ctx, await actorOf(req)))

  app.put<{ Params: P; Body: { answers: Answers } }>('/api/et-veig/:campaignId/drafts/:teacherEmail', async (req, reply) => {
    await etVeig.saveFeedbackDraft(ctx, await actorOf(req), req.params.campaignId, req.params.teacherEmail.toLowerCase(), answersOf(req.body))
    return reply.code(204).send()
  })

  app.post<{ Params: P; Body: { answers: Answers } }>('/api/et-veig/:campaignId/submit/:teacherEmail', async (req, reply) => {
    await etVeig.submitFeedback(ctx, await actorOf(req), req.params.campaignId, req.params.teacherEmail.toLowerCase(), answersOf(req.body))
    return reply.code(204).send()
  })

  app.get('/api/et-veig/self', async (req) => etVeig.selfTasks(ctx, await actorOf(req)))

  app.put<{ Params: P; Body: { answers: Answers; context?: Record<string, string[]>; submit?: boolean } }>('/api/et-veig/:campaignId/self/:stage', async (req, reply) => {
    await etVeig.saveSelfAssessment(ctx, await actorOf(req), req.params.campaignId, req.params.stage, answersOf(req.body), req.body?.context ?? {}, !!req.body?.submit)
    return reply.code(204).send()
  })

  app.get<{ Params: P }>('/api/et-veig/:campaignId/reports/:teacherEmail', async (req) => etVeig.teacherReport(ctx, await actorOf(req), req.params.campaignId, req.params.teacherEmail.toLowerCase()))

  app.get<{ Params: P }>('/api/et-veig/:campaignId/center', async (req) => etVeig.centerView(ctx, await actorOf(req), req.params.campaignId))

  app.get<{ Params: P }>('/api/et-veig/:campaignId/teachers', async (req) => etVeig.teacherStatus(ctx, await actorOf(req), req.params.campaignId))

  app.post<{ Params: P; Body: { status: FeedbackStatus } }>('/api/et-veig/:campaignId/status', async (req, reply) => {
    await etVeig.setFeedbackStatus(ctx, await actorOf(req), req.params.campaignId, req.body?.status)
    return reply.code(204).send()
  })

  app.post<{ Params: P; Body: { status: Exclude<ModerationStatus, 'pendent'>; text?: string } }>('/api/et-veig/comments/:id/moderation', async (req, reply) => {
    if (!['acceptat', 'editat', 'descartat'].includes(req.body?.status)) throw new HttpError(400, 'Estat de moderació no vàlid.')
    await etVeig.moderateComment(ctx, await actorOf(req), req.params.id, req.body.status, req.body.text)
    return reply.code(204).send()
  })

  // ---------- Em miro i gestió del centre ----------
  // L'estat té la forma de la demostració, retallat segons qui el demana; les operacions apliquen les mateixes regles.
  app.get('/api/state', async (req) => ops.stateFor(ctx, await actorOf(req)))

  app.post<{ Body: { name?: unknown; args?: unknown } }>('/api/ops', { bodyLimit: 2 * 1024 * 1024 }, async (req) =>
    ops.runOp(ctx, await actorOf(req), typeof req.body?.name === 'string' ? req.body.name : '', req.body?.args),
  )

  // ---------- Centre: curs escolar nou ----------
  app.post<{ Body: { year?: unknown } }>('/api/centre/curs-nou', async (req) => curs.startNewYear(ctx, await actorOf(req), req.body?.year))

  // ---------- Centre: correus de les famílies ----------
  type F = { ref?: unknown; email?: unknown; validated?: unknown }
  const ref = (b: F | undefined) => {
    if (typeof b?.ref !== 'string' || typeof b.email !== 'string' || b.ref.length > 64 || b.email.length > 200) throw new HttpError(400, 'Petició no vàlida.')
    return { ref: b.ref, email: b.email }
  }

  app.get('/api/centre/families', async (req) => families.listFamilies(ctx, await actorOf(req)))

  app.post<{ Body: { csv: string; filename?: string } }>('/api/centre/families/import', { bodyLimit: 1024 * 1024 }, async (req) =>
    families.importFamilies(ctx, await actorOf(req), req.body?.csv, typeof req.body?.filename === 'string' ? req.body.filename : undefined),
  )

  app.post<{ Body: F }>('/api/centre/families/validate', async (req, reply) => {
    const r = ref(req.body)
    await families.setGuardianValidated(ctx, await actorOf(req), r.ref, r.email, req.body?.validated === true)
    return reply.code(204).send()
  })

  app.post<{ Body: F }>('/api/centre/families/remove', async (req, reply) => {
    const r = ref(req.body)
    await families.removeGuardian(ctx, await actorOf(req), r.ref, r.email)
    return reply.code(204).send()
  })

  return app
}

/** Accepta només un objecte pla de cadenes curtes: res de més. */
function answersOf(body: unknown): Answers {
  const a = (body as { answers?: unknown } | undefined)?.answers
  if (!a || typeof a !== 'object' || Array.isArray(a)) throw new HttpError(400, 'Falten les respostes.')
  const out: Answers = {}
  for (const [k, v] of Object.entries(a)) {
    if (typeof v !== 'string' || k.length > 40 || v.length > 2000) throw new HttpError(400, 'Respostes no vàlides.')
    out[k] = v
  }
  return out
}
