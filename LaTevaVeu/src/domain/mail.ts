// Correus de l'aplicació: configuració del remitent, text per defecte i format.
// Sense dependències del navegador: el servidor farà servir el mateix format per enviar.
// El text de les famílies parteix del correu de VeuAlumnat.
import { SCHOOL } from './catalog'
import type { MailSettings, MailTemplate } from './types'

export type MailKind = 'families' | 'teachers'

/** Marcadors que es poden fer servir a cada missatge, amb un exemple per a la previsualització. */
export const MAIL_FIELDS: Record<MailKind, { key: string; label: string; example: string }[]> = {
  families: [
    { key: 'alumne', label: 'Nom de l’alumne', example: 'Laia' },
    { key: 'alumne_complet', label: 'Nom i cognoms', example: 'Laia Puig Soler' },
    { key: 'curs', label: 'Curs i grup', example: '5è A' },
    { key: 'recollida', label: 'Recollida', example: '1a avaluació' },
    { key: 'curs_escolar', label: 'Curs escolar', example: '2026-2027' },
    { key: 'escola', label: 'Escola', example: SCHOOL.name },
  ],
  teachers: [
    { key: 'docent', label: 'Nom del docent', example: 'Marta' },
    { key: 'recollida', label: 'Recollida', example: 'Recollida de tardor' },
    { key: 'curs_escolar', label: 'Curs escolar', example: '2026-2027' },
    { key: 'enllac', label: 'Enllaç a l’app', example: 'https://ja.cat/tensveu' },
    { key: 'escola', label: 'Escola', example: SCHOOL.name },
  ],
}

export const MAIL_KINDS: Record<MailKind, { title: string; kicker: string; attachment: boolean; who: string }> = {
  families: { title: 'Famílies', kicker: 'Així em veig', attachment: true, who: 'Cada responsable validat de l’alumne, amb l’informe «Així em veig» en PDF adjunt.' },
  teachers: { title: 'Professorat', kicker: 'Així et veiem', attachment: false, who: 'Cada docent, quan el seu informe «Així et veiem» és disponible. L’informe és confidencial: no s’adjunta, es consulta a l’app.' },
}

export const DEFAULT_TEMPLATES: Record<MailKind, MailTemplate> = {
  families: {
    subject: '«Així em veig» · {alumne_complet} · {recollida}',
    body: `Benvolguda família,

{alumne} ha dedicat una estona a pensar com està aprenent: ha valorat cada matèria i s’ha proposat què pot fer per millorar. Us adjuntem l’informe «Així em veig» amb la seva reflexió ({recollida}, curs {curs_escolar}).

Us proposem que el llegiu junts. Aquestes preguntes us poden ajudar a començar la conversa:

- De quina matèria n’estàs més satisfet o satisfeta? Per què?
- Quin dels teus compromisos et sembla més important?
- Com et podem ajudar des de casa a complir-lo?

> Recordeu que és la seva valoració personal: no substitueix l’informe d’avaluació del centre.

Si teniu cap dubte, podeu respondre aquest missatge.

Gràcies per fer-li costat en aquest camí.

Una salutació cordial,
{escola}`,
  },
  teachers: {
    subject: '«Així et veiem» · {recollida}',
    body: `Hola, {docent},

Ja tens disponible el teu informe «Així et veiem» de la {recollida}. Recull, de manera anònima i agregada, com viu les teves classes l’alumnat.

El trobaràs a La teva veu, a «Et veig… › Així et veiem»:
{enllac}

> L’informe és confidencial: només el podeu veure tu i l’Equip Directiu. Per això no s’adjunta al correu.

Et proposem que el llegeixis amb calma i que hi busquis una o dues idees per continuar millorant.

Una salutació cordial,
{escola}`,
  },
}

export const DEFAULT_MAIL: MailSettings = {
  sender: '',
  senderName: SCHOOL.name,
  replyTo: 'tutor',
  replyToEmail: '',
  families: DEFAULT_TEMPLATES.families,
  teachers: DEFAULT_TEMPLATES.teachers,
}

export const MAIL_LIMITS = { subject: 200, body: 4000, name: 80 }

/** Retorna el motiu si la configuració no és vàlida. */
export function validateMail(m: MailSettings): string | null {
  const domain = `@${SCHOOL.domain}`
  const isMail = (x: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)
  if (m.sender && (!isMail(m.sender) || !m.sender.endsWith(domain))) return `El compte que envia ha de ser de l’escola (${domain}).`
  if (!m.senderName.trim() || m.senderName.length > MAIL_LIMITS.name) return 'Escriu el nom del remitent (com a màxim 80 caràcters).'
  if (m.replyTo !== 'tutor' && m.replyTo !== 'fixed') return 'Tria on han d’anar les respostes.'
  if (m.replyTo === 'fixed' && !isMail(m.replyToEmail)) return 'Escriu l’adreça que ha de rebre les respostes.'
  for (const kind of Object.keys(MAIL_KINDS) as MailKind[]) {
    const t = m[kind]
    const name = MAIL_KINDS[kind].title.toLowerCase()
    if (!t.subject.trim() || t.subject.length > MAIL_LIMITS.subject) return `Revisa l’assumpte del correu al ${name}.`
    if (!t.body.trim() || t.body.length > MAIL_LIMITS.body) return `Revisa el text del correu al ${name}.`
    const allowed = new Set(MAIL_FIELDS[kind].map((f) => f.key))
    const unknown = [...`${t.subject}\n${t.body}`.matchAll(/\{([^{}\s]+)\}/g)].map((x) => x[1]).find((k) => !allowed.has(k))
    if (unknown) return `El marcador {${unknown}} no existeix al correu al ${name}.`
  }
  return null
}

/** Normalitza el que arriba del formulari (o d'un estat antic sense correu). */
export function cleanMail(raw: Partial<MailSettings> | undefined): MailSettings {
  const m = { ...DEFAULT_MAIL, ...raw }
  const tpl = (t: Partial<MailTemplate> | undefined, d: MailTemplate): MailTemplate => ({ subject: String(t?.subject ?? d.subject).trim(), body: String(t?.body ?? d.body).replace(/\r\n?/g, '\n').trim() })
  return {
    sender: String(m.sender).trim().toLowerCase(),
    senderName: String(m.senderName).trim(),
    replyTo: m.replyTo,
    replyToEmail: m.replyTo === 'fixed' ? String(m.replyToEmail).trim().toLowerCase() : '',
    families: tpl(m.families, DEFAULT_TEMPLATES.families),
    teachers: tpl(m.teachers, DEFAULT_TEMPLATES.teachers),
  }
}

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{([^{}\s]+)\}/g, (all, k: string) => vars[k] ?? all)

type Block = { kind: 'p' | 'note'; text: string } | { kind: 'list'; items: string[] }

/** Paràgrafs separats per una línia en blanc; «- » fa una llista i «> », una nota destacada. */
function blocks(body: string): Block[] {
  return body
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): Block => {
      const lines = chunk.split('\n')
      if (lines.every((l) => /^\s*[-·•]\s+/.test(l))) return { kind: 'list', items: lines.map((l) => l.replace(/^\s*[-·•]\s+/, '')) }
      if (lines.every((l) => /^\s*>\s?/.test(l))) return { kind: 'note', text: lines.map((l) => l.replace(/^\s*>\s?/, '')).join('\n') }
      return { kind: 'p', text: chunk }
    })
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const linkify = (s: string) => esc(s).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#8a2216">${u}</a>`).replace(/\n/g, '<br>')

export interface RenderedMail {
  subject: string
  text: string
  html: string
}

/** Omple els marcadors i en fa la versió de text i la versió amb format (estil de l'escola). */
export function renderMail(kind: MailKind, settings: MailSettings, vars: Record<string, string>): RenderedMail {
  const all = { escola: SCHOOL.name, ...vars }
  const t = settings[kind]
  const subject = fill(t.subject, all).replace(/\s+/g, ' ').trim()
  const bs = blocks(fill(t.body, all))
  const text = bs.map((b) => (b.kind === 'list' ? b.items.map((x) => `· ${x}`).join('\n') : b.text)).join('\n\n')
  const p = 'margin:0 0 14px;line-height:1.55'
  const body = bs
    .map((b) =>
      b.kind === 'list'
        ? `<ul style="margin:0 0 16px;padding-left:20px;line-height:1.6">${b.items.map((x) => `<li>${linkify(x)}</li>`).join('')}</ul>`
        : b.kind === 'note'
          ? `<p style="${p};background:#f8f6f2;border-left:4px solid #b8860b;padding:10px 14px;color:#4a4540">${linkify(b.text)}</p>`
          : `<p style="${p}">${linkify(b.text)}</p>`,
    )
    .join('')
  const kicker = `LA TEVA VEU · ${MAIL_KINDS[kind].kicker.toUpperCase()}`
  const foot = MAIL_KINDS[kind].attachment ? 'Trobareu l’informe adjunt en PDF.' : 'Aquest missatge s’ha enviat des de La teva veu.'
  const html =
    '<div style="background:#f5f2ed;padding:24px 12px;font-family:Arial,sans-serif;color:#252525;font-size:15px">' +
    '<div style="max-width:600px;margin:auto;background:#fff;border:1px solid #ddd7ce;border-radius:12px;overflow:hidden">' +
    `<div style="background:#8a2216;color:#fff;padding:18px 24px"><div style="font-size:19px;font-weight:bold">${esc(SCHOOL.name)}</div>` +
    `<div style="font-size:12px;letter-spacing:.06em;opacity:.9">${esc(kicker)}</div></div>` +
    `<div style="padding:22px 24px">${body}</div>` +
    `<div style="background:#f8f6f2;color:#646464;font-size:12px;padding:12px 24px">${esc(foot)}</div>` +
    '</div></div>'
  return { subject, text, html }
}

/** Valors d'exemple per a la previsualització. */
export const exampleVars = (kind: MailKind) => Object.fromEntries(MAIL_FIELDS[kind].map((f) => [f.key, f.example]))
