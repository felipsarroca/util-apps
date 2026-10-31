// Còpies de seguretat, recordatoris i tasca diària, contra PostgreSQL real (PGlite).
import { generateKeyPairSync, createVerify, randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DemoState } from '../../src/data/seed'
import { buildApp, daily } from '../app'
import type { Db } from '../db'
import { buildMime, encodeHeader, gmailMailer, type Mailer, type OutMail } from '../gmail'
import { memoryDb } from '../pglite'
import { pendingReminders, sendReminders, mailSettings } from '../reminders'
import { applySeed, PROVA } from '../seed'

const mail = (u: string) => `${u}@ramonpont.cat`

let db: Db
let close: () => Promise<unknown>
let app: ReturnType<typeof buildApp>
const outbox: OutMail[] = []
const fakeMailer: Mailer = { from: 'direccio@ramonpont.cat', send: async (m) => void outbox.push(m) }

const call = async (user: string, method: 'GET' | 'POST', url: string, payload?: object) => {
  const r = await app.inject({ method, url, payload, headers: { authorization: `Bearer ${mail(user)}` } })
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : undefined }
}
const state = async (user: string) => (await call(user, 'GET', '/api/state')).body as { state: DemoState }
const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]

beforeAll(async () => {
  const mem = await memoryDb()
  db = mem.db
  close = () => mem.pg.close()
  await applySeed(db)
  app = buildApp({ db, verify: async (t) => ({ sub: `sub-${t}`, email: t, name: t }), draftKey: randomBytes(32), yearId: PROVA.year, mailer: fakeMailer })
})

afterAll(async () => {
  await app.close()
  await close()
})

describe('còpies de seguretat', () => {
  it('només l’administració en fa, en veu i en restaura', async () => {
    expect((await call('marta', 'GET', '/api/centre/copies')).status).toBe(403)
    expect((await call('marta', 'POST', '/api/centre/copies')).status).toBe(403)
    expect((await call('admin', 'POST', '/api/centre/copies')).status).toBe(200)
    const list = (await call('admin', 'GET', '/api/centre/copies')).body
    expect(list[0]).toMatchObject({ reason: 'Feta a mà', year: PROVA.year })
    expect(list[0].by).toBeTruthy()
    expect(list[0].rows).toBeGreaterThan(50)
    expect((await call('marta', 'POST', `/api/centre/copies/${list[0].id}/restaura`, { confirm: list[0].id })).status).toBe(403)
    // Cal repetir l'identificador.
    expect((await call('admin', 'POST', `/api/centre/copies/${list[0].id}/restaura`, {})).status).toBe(400)
  })

  it('restaurar torna les dades a l’estat de la còpia, en conserva una de l’estat anterior i no toca el registre', async () => {
    const { id } = (await call('admin', 'POST', '/api/centre/copies')).body
    const before = (await state('admin')).state
    const victim = before.students[0]
    // Canvis després de la còpia: un alumne donat de baixa, una resposta, un esborrany xifrat i el correu.
    expect((await call('admin', 'POST', '/api/ops', { name: 'removeStudents', args: [[victim.id]] })).status).toBe(200)
    await db.query("insert into feedback_drafts (campaign_id, student_id, teacher_id, payload) select $1, s.id, u.id, '\\x0102ff'::bytea from students s, users u where s.school_ref = 'e05' and u.email = $2", [PROVA.campaignId, mail('marta')])
    await db.query("insert into app_settings values ('mail', '{\"senderName\":\"Canviat\"}') on conflict (key) do update set value = excluded.value")
    const auditBefore = Number((await one<{ n: string }>('select count(*) as n from audit_log')).n)

    const r = await call('admin', 'POST', `/api/centre/copies/${id}/restaura`, { confirm: id })
    expect(r.status).toBe(200)
    const after = (await state('admin')).state
    expect(after.students.map((s) => s.id)).toEqual(before.students.map((s) => s.id))
    expect(after.mail.senderName).toBe(before.mail.senderName)
    expect(await one('select 1 from feedback_drafts')).toBeUndefined()
    // El registre només creix: hi queda la restauració.
    expect(Number((await one<{ n: string }>('select count(*) as n from audit_log')).n)).toBe(auditBefore + 1)
    expect(await one<{ action: string }>('select action from audit_log order by id desc limit 1')).toEqual({ action: 'Còpia restaurada' })

    // La còpia de seguretat feta abans de restaurar porta els canvis i permet tornar-hi (també l'esborrany binari).
    const safety = await one<{ reason: string }>('select reason from backups where id = $1', [r.body.safety])
    expect(safety.reason).toMatch(/^Abans de restaurar la còpia del /)
    expect((await call('admin', 'POST', `/api/centre/copies/${r.body.safety}/restaura`, { confirm: r.body.safety })).status).toBe(200)
    expect((await state('admin')).state.students.some((s) => s.id === victim.id)).toBe(false)
    expect(await one<{ hex: string }>("select encode(payload, 'hex') as hex from feedback_drafts")).toEqual({ hex: '0102ff' })

    // I es torna a l'estat inicial.
    expect((await call('admin', 'POST', `/api/centre/copies/${id}/restaura`, { confirm: id })).status).toBe(200)
    expect((await state('admin')).state.students.length).toBe(before.students.length)
  })

  it('importar correus de les famílies en fa una abans', async () => {
    const n = Number((await one<{ n: string }>('select count(*) as n from backups')).n)
    expect((await call('admin', 'POST', '/api/centre/families/import', { csv: 'id_alumne;nom_responsable;correu_responsable\ne01;Maria Serra;maria.serra@exemple.cat' })).status).toBe(200)
    expect(Number((await one<{ n: string }>('select count(*) as n from backups')).n)).toBe(n + 1)
    expect(await one<{ reason: string }>('select reason from backups order by id desc limit 1')).toEqual({ reason: 'Abans d’importar correus de les famílies' })
  })
})

describe('recordatoris', () => {
  it('l’alumnat sense lliurar i el professorat sense autoavaluació, una sola vegada', async () => {
    const assignments = [
      { gradeId: '2ESO', group: 'A', subjectId: 'MAT', teacherEmail: mail('marta') },
      { gradeId: '2ESO', group: 'A', subjectId: 'CAT', teacherEmail: mail('xavier') },
      { gradeId: '3EP', group: 'A', subjectId: 'CAT', teacherEmail: mail('anna') },
    ]
    await db.query("update feedback_campaigns set status = 'OBERTA', assignments = $2 where id = $1", [PROVA.campaignId, JSON.stringify(assignments)])
    await db.query("insert into teacher_self_assessments (campaign_id, teacher_id, stage, answers, submitted_at) select $1, id, 'ESO', '{}', now() from users where email = $2", [PROVA.campaignId, mail('xavier')])
    // Una alumna ja ha lliurat.
    await db.query(
      "insert into responses (campaign_id, enrollment_id, status) select $1, e.id, 'LLIURADA' from enrollments e join students s on s.id = e.student_id where s.school_ref = 'e02'",
      [PROVA.emCampaignId],
    )
    const settings = await mailSettings(db)
    // Massa d'hora: la recollida es tanca el 20 i falten més de 2 dies.
    expect(await pendingReminders(db, PROVA.year, '2026-11-17', 2)).toEqual([])
    const list = await pendingReminders(db, PROVA.year, '2026-11-18', 2)
    const students = list.filter((x) => x.kind === 'students')
    const teachers = list.filter((x) => x.kind === 'teachers')
    expect(students.length).toBe(15)
    expect(students.some((x) => x.email === mail('e02'))).toBe(false)
    expect(teachers.map((x) => x.email).sort()).toEqual([mail('anna'), mail('marta')])
    expect(teachers.find((x) => x.email === mail('anna'))!.vars.etapes).toBe('cicle mitjà')

    // Sense permís: no s'envia res i no es marca res.
    const broken: Mailer = { from: 'x', send: async () => Promise.reject(new Error('sense permís')) }
    expect(await sendReminders(db, broken, settings, list.slice(0, 2))).toEqual({ sent: 0, failed: 2 })

    outbox.length = 0
    expect(await sendReminders(db, fakeMailer, settings, list)).toEqual({ sent: 17, failed: 0 })
    const m = outbox.find((x) => x.to === mail('anna'))!
    expect(m.subject).toBe('Recordatori: la teva autoavaluació d’«Et veig…» · Recollida de prova')
    expect(m.text).toContain('Hola, Anna')
    expect(m.text).toContain('divendres 20 de novembre')
    expect(m.fromName).toBe('Equip Directiu · Escola Ramon Pont')
    expect(m.replyTo).toBe('direccio@ramonpont.cat')
    expect(outbox.find((x) => x.to === mail('e01'))!.subject).toBe('Recordatori: «Em miro» es tanca el divendres 20 de novembre')
    // Ja s'han enviat: ningú no en rep cap més.
    expect(await pendingReminders(db, PROVA.year, '2026-11-19', 2)).toEqual([])
  })

  it('la pantalla en mostra l’estat i la prova arriba a qui la demana; només l’administració', async () => {
    expect((await call('marta', 'GET', '/api/centre/recordatoris')).status).toBe(403)
    const st = (await call('admin', 'GET', '/api/centre/recordatoris')).body
    expect(st).toMatchObject({ configured: true, sender: 'direccio@ramonpont.cat', enabled: false, daysBefore: 2 })
    expect(st.sent.map((x: { n: number }) => x.n).sort()).toEqual([15, 2])
    outbox.length = 0
    expect((await call('admin', 'POST', '/api/centre/recordatoris/prova')).body).toEqual({ to: mail('admin') })
    expect(outbox.map((x) => x.to)).toEqual([mail('admin'), mail('admin')])
    expect(outbox[0].subject).toMatch(/^\[Prova\] /)
  })

  it('la tasca diària només l’executa l’activador de Neon: una còpia al dia i recordatoris si estan activats', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/tasques/diaries' })).statusCode).toBe(403)
    const run = async () => JSON.parse((await app.inject({ method: 'POST', url: '/api/tasques/diaries', headers: { 'x-neon-trigger-invocation-id': 'inv-1' } })).body)
    const first = await run()
    expect(first.backup).toEqual(expect.any(Number))
    expect(first.reminders).toBe('aturats')
    expect((await run()).backup).toBeNull()
    await db.query("insert into app_settings values ('mail', '{\"reminders\":{\"enabled\":true,\"daysBefore\":2}}') on conflict (key) do update set value = excluded.value")
    const ctx = { db, key: randomBytes(32), yearId: PROVA.year }
    expect((await daily(ctx, undefined)).reminders).toBe('sense correu')
    expect((await daily(ctx, fakeMailer)).reminders).toEqual({ sent: 0, failed: 0 })
  })
})

describe('Gmail', () => {
  it('codifica les capçaleres amb accents i fa un missatge amb text i format', () => {
    expect(encodeHeader('Hola')).toBe('Hola')
    const h = encodeHeader('Recordatori: «Em miro» es tanca el divendres 20 de novembre')
    expect(h.split('\r\n ').every((w) => /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/.test(w) && w.length <= 75)).toBe(true)
    const decoded = h.split('\r\n ').map((w) => Buffer.from(w.slice(10, -2), 'base64').toString('utf8')).join('')
    expect(decoded).toBe('Recordatori: «Em miro» es tanca el divendres 20 de novembre')
    const mime = buildMime('direccio@ramonpont.cat', { to: 'a@ramonpont.cat', subject: 'Prova', text: 'Hola, Àlex', html: '<p>Hola</p>', fromName: 'Equip Directiu', replyTo: 'direccio@ramonpont.cat' })
    expect(mime).toContain('From: Equip Directiu <direccio@ramonpont.cat>')
    expect(mime).toContain('Reply-To: direccio@ramonpont.cat')
    expect(mime).toContain(Buffer.from('Hola, Àlex').toString('base64'))
    expect(mime).toMatch(/multipart\/alternative/)
  })

  it('demana el permís a Google en nom de direcció (només gmail.send) i envia el missatge', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const sa = Buffer.from(JSON.stringify({ client_email: 'latevaveu@projecte.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) })).toString('base64')
    const calls: { url: string; body: string; auth?: string }[] = []
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body), auth: (init.headers as Record<string, string>).authorization })
      return new Response(JSON.stringify(url.includes('token') ? { access_token: 'tok', expires_in: 3600 } : { id: 'm1' }), { status: 200 })
    }) as unknown as typeof fetch
    const mailer = gmailMailer(sa, 'direccio@ramonpont.cat', fake)
    await mailer.send({ to: 'a@ramonpont.cat', subject: 'x', text: 'y', html: 'z', fromName: 'Equip Directiu' })
    await mailer.send({ to: 'b@ramonpont.cat', subject: 'x', text: 'y', html: 'z', fromName: 'Equip Directiu' })
    // El testimoni es reaprofita.
    expect(calls.map((c) => c.url)).toEqual(['https://oauth2.googleapis.com/token', 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'])
    const jwt = new URLSearchParams(calls[0].body).get('assertion')!.split('.')
    const claims = JSON.parse(Buffer.from(jwt[1], 'base64url').toString())
    expect(claims).toMatchObject({ iss: 'latevaveu@projecte.iam.gserviceaccount.com', sub: 'direccio@ramonpont.cat', scope: 'https://www.googleapis.com/auth/gmail.send' })
    expect(createVerify('RSA-SHA256').update(`${jwt[0]}.${jwt[1]}`).verify(publicKey, Buffer.from(jwt[2], 'base64url'))).toBe(true)
    expect(calls[1].auth).toBe('Bearer tok')
    expect(Buffer.from(JSON.parse(calls[1].body).raw, 'base64url').toString()).toContain('To: a@ramonpont.cat')
  })
})
