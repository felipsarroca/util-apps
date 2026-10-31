// Adapta l'API Fastify a un gestor fetch(Request) → Response (Neon Functions i altres entorns WinterTC).
import type { FastifyInstance, HTTPMethods } from 'fastify'

const SKIP = new Set(['content-length', 'transfer-encoding', 'connection'])

export function toFetch(app: FastifyInstance) {
  const ready = app.ready()
  return {
    async fetch(request: Request): Promise<Response> {
      await ready
      const u = new URL(request.url)
      const res = await app.inject({
        method: request.method as HTTPMethods,
        url: u.pathname + u.search,
        headers: Object.fromEntries(request.headers),
        payload: ['GET', 'HEAD'].includes(request.method) ? undefined : Buffer.from(await request.arrayBuffer()),
      })
      const headers = new Headers()
      for (const [k, v] of Object.entries(res.headers)) {
        if (v === undefined || SKIP.has(k)) continue
        for (const x of Array.isArray(v) ? v : [v]) headers.append(k, String(x))
      }
      const empty = res.statusCode === 204 || res.statusCode === 304 || request.method === 'HEAD'
      return new Response(empty ? null : new Uint8Array(res.rawPayload), { status: res.statusCode, headers })
    },
  }
}
