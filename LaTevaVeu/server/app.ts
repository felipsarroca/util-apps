// API HTTP de La teva veu. Cada petició s'identifica amb el testimoni de Google i
// cada operació comprova els permisos al servidor.
import Fastify, { type FastifyRequest } from 'fastify'
import type { Answers, FeedbackStatus, ModerationStatus, StageId } from '../src/domain/types'
import { resolveActor, type Actor, type Verifier } from './auth'
import type { Db } from './db'
import { HttpError, unauthorized } from './errors'
import * as etVeig from './etveig'

export interface AppOptions {
  db: Db
  verify: Verifier
  draftKey: Buffer
  yearId: string
  /** Origen autoritzat del frontend (p. ex. https://felipsarroca.github.io). */
  allowedOrigin?: string
  logger?: boolean
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
  })

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message })
    const status = (err as { statusCode?: number }).statusCode
    if (status && status < 500) return reply.code(status).send({ error: 'Petició no vàlida.' })
    app.log.error(err)
    return reply.code(500).send({ error: 'Hi ha hagut un error al servidor.' })
  })

  const actorOf = async (req: FastifyRequest): Promise<Actor> => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')
    if (!m) throw unauthorized()
    return resolveActor(o.db, await o.verify(m[1]), o.yearId)
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

  app.post<{ Params: P; Body: { status: FeedbackStatus } }>('/api/et-veig/:campaignId/status', async (req, reply) => {
    await etVeig.setFeedbackStatus(ctx, await actorOf(req), req.params.campaignId, req.body?.status)
    return reply.code(204).send()
  })

  app.post<{ Params: P; Body: { status: Exclude<ModerationStatus, 'pendent'>; text?: string } }>('/api/et-veig/comments/:id/moderation', async (req, reply) => {
    if (!['acceptat', 'editat', 'descartat'].includes(req.body?.status)) throw new HttpError(400, 'Estat de moderació no vàlid.')
    await etVeig.moderateComment(ctx, await actorOf(req), req.params.id, req.body.status, req.body.text)
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
