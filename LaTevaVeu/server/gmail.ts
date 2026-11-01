// Enviament de correus amb l'API de Gmail des dels comptes de l'escola (direccio@ramonpont.cat i, per a
// les famílies, el que triï l'escola). Fa servir un compte de servei de Google Cloud amb delegació a tot
// el domini, autoritzat per l'administració de Google Workspace només per a l'abast gmail.send: pot enviar
// en nom de qualsevol usuari del domini, però no pot llegir el correu de ningú. Cada missatge diu de quin
// compte surt; el servidor només n'accepta de l'escola. La clau del compte de servei arriba per una variable d'entorn (en base64)
// i no s'escriu mai en cap fitxer.
import { createSign } from 'node:crypto'

export interface OutMail {
  /** Compte de l'escola que l'envia (ha de ser un usuari amb bústia de Gmail, no un grup). */
  from: string
  to: string
  subject: string
  text: string
  html: string
  fromName: string
  replyTo?: string
}

export interface Mailer {
  send(m: OutMail): Promise<void>
}

interface ServiceAccount {
  client_email: string
  private_key: string
  token_uri?: string
}

const SCOPE = 'https://www.googleapis.com/auth/gmail.send'
const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url')

/** Capçalera amb caràcters no ASCII (RFC 2047), en trossos curts perquè cap línia no sigui massa llarga. */
export function encodeHeader(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return s
  const words: string[] = []
  let cur = ''
  for (const ch of s) {
    if (Buffer.byteLength(cur + ch) > 45) {
      words.push(cur)
      cur = ''
    }
    cur += ch
  }
  if (cur) words.push(cur)
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w).toString('base64')}?=`).join('\r\n ')
}

const lines76 = (s: string) => Buffer.from(s).toString('base64').replace(/.{76}/g, '$&\r\n')

/** Missatge MIME amb versió de text i versió amb format. */
export function buildMime(m: OutMail): string {
  const boundary = `latevaveu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  const head = [
    `From: ${encodeHeader(m.fromName)} <${m.from}>`,
    `To: ${m.to}`,
    ...(m.replyTo ? [`Reply-To: ${m.replyTo}`] : []),
    `Subject: ${encodeHeader(m.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
  const part = (type: string, body: string) => [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', lines76(body)].join('\r\n')
  return [...head, '', part('text/plain', m.text), part('text/html', `<!doctype html><html><body style="margin:0">${m.html}</body></html>`), `--${boundary}--`, ''].join('\r\n')
}

export function gmailMailer(serviceAccountB64: string, domain: string, fetchFn: typeof fetch = fetch): Mailer {
  const sa = JSON.parse(Buffer.from(serviceAccountB64, 'base64').toString('utf8')) as ServiceAccount
  if (!sa.client_email || !sa.private_key) throw new Error('La clau del compte de servei no és vàlida.')
  const tokenUri = sa.token_uri ?? 'https://oauth2.googleapis.com/token'
  // Un testimoni per compte: Google el dona en nom de qui envia.
  const cache = new Map<string, { token: string; until: number }>()

  const token = async (from: string) => {
    const now = Math.floor(Date.now() / 1000)
    const cached = cache.get(from)
    if (cached && cached.until > now + 60) return cached.token
    const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: sa.client_email, sub: from, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }))}`
    const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key)
    const res = await fetchFn(tokenUri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(signature)}` }),
    })
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string }
    // Sense delegació autoritzada, Google respon «unauthorized_client».
    if (!res.ok || !body.access_token) throw new Error(`Google no ha donat permís per enviar des de ${from} (${body.error ?? res.status}).`)
    cache.set(from, { token: body.access_token, until: now + (body.expires_in ?? 3600) })
    return body.access_token
  }

  return {
    async send(m) {
      const from = m.from.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+$/.test(from) || !from.endsWith(`@${domain}`)) throw new Error(`Només es pot enviar des d’un compte de l’escola (@${domain}).`)
      const res = await fetchFn('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { authorization: `Bearer ${await token(from)}`, 'content-type': 'application/json' },
        body: JSON.stringify({ raw: b64url(buildMime({ ...m, from })) }),
      })
      if (!res.ok) throw new Error(`Gmail no ha acceptat el missatge (${res.status}).`)
    },
  }
}
