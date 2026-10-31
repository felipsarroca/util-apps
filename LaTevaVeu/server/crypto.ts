// Xifratge dels esborranys d'«Et veig» (AES-256-GCM). La clau és un secret del servidor
// (DRAFT_KEY, 32 bytes en base64) i no es desa mai a la base de dades.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export function draftKey(base64: string): Buffer {
  const key = Buffer.from(base64, 'base64')
  if (key.length !== 32) throw new Error('DRAFT_KEY ha de tenir 32 bytes en base64.')
  return key
}

/** `aad` lliga el xifrat a la recollida, l'alumne i el docent: no es pot moure a una altra fila. */
export function seal(key: Buffer, data: unknown, aad: string): Buffer {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  c.setAAD(Buffer.from(aad))
  const body = Buffer.concat([c.update(JSON.stringify(data), 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), body])
}

export function open<T>(key: Buffer, payload: Uint8Array, aad: string): T {
  const buf = Buffer.from(payload)
  const d = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12))
  d.setAAD(Buffer.from(aad))
  d.setAuthTag(buf.subarray(12, 28))
  return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8')) as T
}
