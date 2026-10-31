// Correus de l'aplicació: configuració del remitent, text per defecte i format.
// Sense dependències del navegador: el servidor farà servir el mateix format per enviar.
// El text de les famílies parteix del correu de VeuAlumnat.
import { SCHOOL } from './catalog'
import type { MailSettings, MailTemplate, StageId } from './types'

export type MailKind = 'families' | 'teachers' | 'remindStudents' | 'remindTeachers'

/** Enllaç curt a l'app, per als correus. */
export const APP_LINK = 'https://ja.cat/tensveu'

/** Els correus al professorat surten sempre del compte de direcció (decisió de l'escola), i les respostes hi tornen. */
export const TEACHER_SENDER = { name: `Equip Directiu · ${SCHOOL.name}`, email: `direccio@${SCHOOL.domain}` }

/** Qui envia cada tipus de correu: les famílies, el compte configurat; el professorat i els recordatoris, sempre direcció. */
export function senderOf(kind: MailKind, m: MailSettings): { name: string; email: string } {
  return kind === 'families' ? { name: m.senderName, email: m.sender } : TEACHER_SENDER
}

const STAGE_WORDS: Record<StageId, string> = { CM: 'cicle mitjà', CS: 'cicle superior', ESO: 'ESO' }

/** «cicle superior i ESO» */
export const stagesText = (stages: StageId[]) => {
  const names = stages.map((st) => STAGE_WORDS[st])
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} i ${names[names.length - 1]}` : names[0] ?? ''
}

/** Dies d'antelació possibles per als recordatoris. */
export const REMINDER_DAYS = [1, 2, 3, 4, 5]

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
    { key: 'docent_complet', label: 'Nom i cognoms', example: 'Marta Ribas Vila' },
    { key: 'etapes', label: 'Etapes', example: 'cicle superior i ESO' },
    { key: 'recollida', label: 'Recollida', example: 'Recollida de tardor' },
    { key: 'curs_escolar', label: 'Curs escolar', example: '2026-2027' },
    { key: 'enllac', label: 'Enllaç a l’app', example: APP_LINK },
    { key: 'escola', label: 'Escola', example: SCHOOL.name },
  ],
  remindStudents: [
    { key: 'alumne', label: 'Nom de l’alumne', example: 'Laia' },
    { key: 'recollida', label: 'Recollida', example: '1a avaluació' },
    { key: 'data_final', label: 'Darrer dia', example: 'divendres 13 de novembre' },
    { key: 'enllac', label: 'Enllaç a l’app', example: APP_LINK },
    { key: 'escola', label: 'Escola', example: SCHOOL.name },
  ],
  remindTeachers: [
    { key: 'docent', label: 'Nom del docent', example: 'Marta' },
    { key: 'etapes', label: 'Etapes', example: 'cicle superior i ESO' },
    { key: 'recollida', label: 'Recollida', example: 'Recollida de tardor' },
    { key: 'data_final', label: 'Darrer dia', example: 'divendres 13 de novembre' },
    { key: 'enllac', label: 'Enllaç a l’app', example: APP_LINK },
    { key: 'escola', label: 'Escola', example: SCHOOL.name },
  ],
}

/** `attachment`: nom del PDF adjunt, amb marcadors (buit: sense adjunt). `foot`: peu del correu amb format. */
export const MAIL_KINDS: Record<MailKind, { title: string; kicker: string; attachment: string; foot: string; who: string }> = {
  families: {
    title: 'Famílies', kicker: 'Així em veig', attachment: 'Així em veig – {alumne_complet}.pdf', foot: 'Trobareu l’informe adjunt en PDF.',
    who: 'Cada responsable validat de l’alumne, amb l’informe «Així em veig» en PDF adjunt.',
  },
  teachers: {
    title: 'Professorat', kicker: 'Així et veiem', attachment: 'Així et veiem – {docent_complet} – {recollida}.pdf', foot: 'Trobaràs el teu informe adjunt en PDF. És confidencial: no el reenviïs.',
    who: 'Cada docent, amb el seu informe «Així et veiem» en PDF adjunt, un cop l’Equip Directiu l’ha publicat. Només el rep la persona interessada. S’envia sempre des de direccio@ramonpont.cat.',
  },
  remindStudents: {
    title: 'Recordatori a l’alumnat', kicker: 'Em miro', attachment: '', foot: 'Missatge automàtic de La teva veu. Si ja has lliurat l’autoavaluació, no cal que facis res.',
    who: 'Cada alumne que encara no ha lliurat l’autoavaluació d’una recollida oberta, uns dies abans que es tanqui. Una sola vegada per recollida, des de direccio@ramonpont.cat, al seu correu de l’escola.',
  },
  remindTeachers: {
    title: 'Recordatori al professorat', kicker: 'Et veig…', attachment: '', foot: 'Missatge automàtic de La teva veu. Si ja has lliurat l’autoavaluació, no cal que facis res.',
    who: 'Cada docent que encara no ha lliurat la seva autoavaluació d’una recollida d’«Et veig…» oberta, uns dies abans que es tanqui. Una sola vegada per recollida, des de direccio@ramonpont.cat.',
  },
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

Gràcies per la teva dedicació i per obrir les teves classes a la mirada de l’alumnat. Et fem arribar el teu informe «Així et veiem» de la {recollida} (curs {curs_escolar}): recull, de manera anònima i agregada, com viuen les teves classes els teus alumnes ({etapes}).

Et proposem llegir-lo amb calma i amb una mirada positiva:

- Comença per allò que l’alumnat valora més: són les teves fortaleses.
- Tria una o dues idees per continuar creixent. No cal canviar-ho tot.
- Compara-ho amb la teva autoavaluació: les coincidències i les sorpreses són les que més ensenyen.

> L’informe és confidencial: només el reps tu i el pot consultar l’Equip Directiu. Mai no mostra qui ha respost ni què ha dit cada alumne.

L’informe va adjunt en PDF i també el pots consultar quan vulguis a La teva veu, a «Et veig… › Així et veiem»:
{enllac}

Si en vols parlar, l’Equip Directiu t’acompanyarà amb molt de gust.

Una salutació cordial,
{escola}`,
  },
  remindStudents: {
    subject: 'Recordatori: «Em miro» es tanca el {data_final}',
    body: `Hola, {alumne},

Encara no has lliurat la teva autoavaluació «Em miro» de la {recollida}. Es tanca el {data_final}.

Només necessites uns minuts. Entra a La teva veu amb el teu compte de l’escola:
{enllac}

> Si ja l’has començada, el que has escrit està desat: només cal que l’acabis i la lliuris.

Gràcies per dedicar-hi una estona!

{escola}`,
  },
  remindTeachers: {
    subject: 'Recordatori: la teva autoavaluació d’«Et veig…» · {recollida}',
    body: `Hola, {docent},

Et recordem que encara tens pendent la teva autoavaluació d’«Et veig…» de la {recollida} ({etapes}). La recollida es tanca el {data_final}.

La teva mirada és tan important com la de l’alumnat: quan rebis l’informe «Així et veiem», podràs comparar com veus les teves classes amb com les viuen els teus alumnes.

Hi pots accedir a La teva veu, a «Et veig… › La meva autoavaluació»:
{enllac}

Gràcies per la teva dedicació.

Una salutació cordial,
{escola}`,
  },
}

/**
 * Text per defecte anterior de l'avís al professorat, que deia que l'informe no s'adjuntava.
 * Si encara és el desat, es canvia pel text nou (ara l'informe va adjunt).
 */
const LEGACY_TEACHERS_BODY = `Hola, {docent},

Ja tens disponible el teu informe «Així et veiem» de la {recollida}. Recull, de manera anònima i agregada, com viu les teves classes l’alumnat.

El trobaràs a La teva veu, a «Et veig… › Així et veiem»:
{enllac}

> L’informe és confidencial: només el podeu veure tu i l’Equip Directiu. Per això no s’adjunta al correu.

Et proposem que el llegeixis amb calma i que hi busquis una o dues idees per continuar millorant.

Una salutació cordial,
{escola}`

export const DEFAULT_MAIL: MailSettings = {
  sender: '',
  senderName: SCHOOL.name,
  replyTo: 'tutor',
  replyToEmail: '',
  families: DEFAULT_TEMPLATES.families,
  teachers: DEFAULT_TEMPLATES.teachers,
  remindStudents: DEFAULT_TEMPLATES.remindStudents,
  remindTeachers: DEFAULT_TEMPLATES.remindTeachers,
  reminders: { enabled: false, daysBefore: 2 },
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
  if (!REMINDER_DAYS.includes(m.reminders.daysBefore)) return 'Tria quants dies abans s’envien els recordatoris.'
  for (const kind of Object.keys(MAIL_KINDS) as MailKind[]) {
    const t = m[kind]
    const name = MAIL_KINDS[kind].title
    if (!t.subject.trim() || t.subject.length > MAIL_LIMITS.subject) return `Revisa l’assumpte del correu «${name}».`
    if (!t.body.trim() || t.body.length > MAIL_LIMITS.body) return `Revisa el text del correu «${name}».`
    const allowed = new Set(MAIL_FIELDS[kind].map((f) => f.key))
    const unknown = [...`${t.subject}\n${t.body}`.matchAll(/\{([^{}\s]+)\}/g)].map((x) => x[1]).find((k) => !allowed.has(k))
    if (unknown) return `El marcador {${unknown}} no existeix al correu «${MAIL_KINDS[kind].title}».`
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
    teachers: (() => {
      const t = tpl(m.teachers, DEFAULT_TEMPLATES.teachers)
      return t.body === LEGACY_TEACHERS_BODY ? { ...t, body: DEFAULT_TEMPLATES.teachers.body } : t
    })(),
    remindStudents: tpl(m.remindStudents, DEFAULT_TEMPLATES.remindStudents),
    remindTeachers: tpl(m.remindTeachers, DEFAULT_TEMPLATES.remindTeachers),
    reminders: {
      enabled: m.reminders?.enabled === true,
      daysBefore: REMINDER_DAYS.includes(Number(m.reminders?.daysBefore)) ? Number(m.reminders.daysBefore) : DEFAULT_MAIL.reminders.daysBefore,
    },
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
  /** Nom del PDF adjunt (buit: sense adjunt). */
  attachment: string
}

/** Data llarga en català per als correus: «divendres 13 de novembre». */
export function longDate(isoDay: string): string {
  return new Intl.DateTimeFormat('ca', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${isoDay}T12:00:00Z`)).replace(',', '')
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
  const foot = MAIL_KINDS[kind].foot
  const html =
    '<div style="background:#f5f2ed;padding:24px 12px;font-family:Arial,sans-serif;color:#252525;font-size:15px">' +
    '<div style="max-width:600px;margin:auto;background:#fff;border:1px solid #ddd7ce;border-radius:12px;overflow:hidden">' +
    `<div style="background:#8a2216;color:#fff;padding:18px 24px"><div style="font-size:19px;font-weight:bold">${esc(SCHOOL.name)}</div>` +
    `<div style="font-size:12px;letter-spacing:.06em;opacity:.9">${esc(kicker)}</div></div>` +
    `<div style="padding:22px 24px">${body}</div>` +
    `<div style="background:#f8f6f2;color:#646464;font-size:12px;padding:12px 24px">${esc(foot)}</div>` +
    '</div></div>'
  const attachment = fill(MAIL_KINDS[kind].attachment, all).replace(/[\\/:*?"<>|]+/g, '-')
  return { subject, text, html, attachment }
}

/** Valors d'exemple per a la previsualització. */
export const exampleVars = (kind: MailKind) => Object.fromEntries(MAIL_FIELDS[kind].map((f) => [f.key, f.example]))
