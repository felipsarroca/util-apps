// Recordatoris: uns dies abans que es tanqui una recollida oberta, un correu a cada alumne que encara no
// ha lliurat «Em miro» i a cada docent que no ha lliurat l'autoavaluació d'«Et veig…». Cada persona en rep
// com a màxim un per recollida (reminders_sent), encara que la tasca s'executi més d'un cop.
import { stagesOfTeacher } from '../src/domain/feedback'
import { APP_LINK, cleanMail, exampleVars, longDate, renderMail, senderOf, stagesText, TEACHER_SENDER, type MailKind } from '../src/domain/mail'
import type { FeedbackCampaign, MailSettings, StageId, TeachingAssignment } from '../src/domain/types'
import type { Actor } from './auth'
import type { Queryable } from './db'
import { conflict, forbidden } from './errors'
import type { Ctx } from './etveig'
import type { Mailer } from './gmail'

export type ReminderKind = 'students' | 'teachers'
const TEMPLATE: Record<ReminderKind, MailKind> = { students: 'remindStudents', teachers: 'remindTeachers' }

export interface PendingReminder {
  kind: ReminderKind
  campaignId: string
  campaign: string
  end: string
  recipientId: string
  email: string
  vars: Record<string, string>
}

/** Dia d'avui a l'escola (Europa/Madrid), AAAA-MM-DD. */
export const schoolDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d)

const day = (d: Date | string) => (typeof d === 'string' ? d.slice(0, 10) : schoolDay(d))

export async function mailSettings(q: Queryable): Promise<MailSettings> {
  return cleanMail((await q.query<{ value: Partial<MailSettings> }>("select value from app_settings where key = 'mail'")).rows[0]?.value)
}

/** Qui ha de rebre un recordatori avui i encara no l'ha rebut. */
export async function pendingReminders(q: Queryable, yearId: string, today: string, daysBefore: number): Promise<PendingReminder[]> {
  const window = 'c.status = \'OBERTA\' and $2::date between c.ends_on - $3::int and c.ends_on'
  const students = (
    await q.query<{ campaign_id: string; label: string; ends_on: Date | string; student_id: string; email: string; name: string }>(
      `select c.id as campaign_id, c.label, c.ends_on, s.id as student_id, lower(s.school_email) as email, s.given_name as name
         from campaigns c
         join class_groups g on g.year_id = c.year_id and g.grade_id = c.grade_id and (c.group_id is null or g.id = c.group_id)
         join enrollments e on e.group_id = g.id and e.active
         join students s on s.id = e.student_id and s.active
         left join responses r on r.campaign_id = c.id and r.enrollment_id = e.id
        where c.year_id = $1 and ${window}
          and coalesce(r.status, 'NO_INICIADA') in ('NO_INICIADA', 'EN_CURS')
          and not exists (select 1 from reminders_sent x where x.kind = 'students' and x.campaign_id = c.id and x.recipient_id = s.id)
        order by c.ends_on, s.family_name, s.given_name`,
      [yearId, today, daysBefore],
    )
  ).rows.map((r): PendingReminder => ({
    kind: 'students', campaignId: r.campaign_id, campaign: r.label, end: day(r.ends_on), recipientId: r.student_id, email: r.email,
    vars: { alumne: r.name, recollida: r.label, data_final: longDate(day(r.ends_on)), enllac: APP_LINK },
  }))

  const campaigns = (
    await q.query<{ id: string; label: string; ends_on: Date | string; stages: StageId[]; assignments: TeachingAssignment[] | null }>(
      `select c.id, c.label, c.ends_on, c.stages, c.assignments from feedback_campaigns c where c.year_id = $1 and ${window}`,
      [yearId, today, daysBefore],
    )
  ).rows
  const teachers: PendingReminder[] = []
  if (campaigns.length) {
    const users = new Map(
      (await q.query<{ id: string; email: string; name: string }>('select id, lower(email) as email, display_name as name from users where active')).rows.map((u) => [u.email, u]),
    )
    const done = (
      await q.query<{ campaign_id: string; teacher_id: string; stage: StageId }>(
        'select campaign_id, teacher_id, stage from teacher_self_assessments where submitted_at is not null and campaign_id = any($1)',
        [campaigns.map((c) => c.id)],
      )
    ).rows
    const sent = new Set(
      (await q.query<{ k: string }>("select campaign_id || '/' || recipient_id as k from reminders_sent where kind = 'teachers' and campaign_id = any($1)", [campaigns.map((c) => c.id)])).rows.map((r) => r.k),
    )
    for (const c of campaigns) {
      const fc = { stages: c.stages, assignments: c.assignments ?? [] } as unknown as FeedbackCampaign
      for (const email of [...new Set(fc.assignments.map((a) => a.teacherEmail))].sort()) {
        const u = users.get(email.toLowerCase())
        if (!u || sent.has(`${c.id}/${u.id}`)) continue
        const pending = stagesOfTeacher(fc, email).filter((st) => !done.some((d) => d.campaign_id === c.id && d.teacher_id === u.id && d.stage === st))
        if (!pending.length) continue
        teachers.push({
          kind: 'teachers', campaignId: c.id, campaign: c.label, end: day(c.ends_on), recipientId: u.id, email: u.email,
          vars: { docent: u.name.split(' ')[0], etapes: stagesText(pending), recollida: c.label, data_final: longDate(day(c.ends_on)), enllac: APP_LINK },
        })
      }
    }
  }
  return [...students, ...teachers]
}

export interface ReminderRun {
  sent: number
  failed: number
}

/** Envia els recordatoris pendents. Els que fallen no es marquen: es tornaran a provar. */
export async function sendReminders(q: Queryable, mailer: Mailer, settings: MailSettings, list: PendingReminder[]): Promise<ReminderRun> {
  let sent = 0
  let failed = 0
  const queue = [...list]
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const kind = TEMPLATE[r.kind]
      const m = renderMail(kind, settings, r.vars)
      try {
        await mailer.send({ to: r.email, subject: m.subject, text: m.text, html: m.html, fromName: senderOf(kind, settings).name, replyTo: TEACHER_SENDER.email })
        await q.query('insert into reminders_sent (kind, campaign_id, recipient_id) values ($1, $2, $3) on conflict do nothing', [r.kind, r.campaignId, r.recipientId])
        sent++
      } catch (e) {
        failed++
        // Sense dades personals: només el motiu.
        console.error('Recordatori no enviat:', e instanceof Error ? e.message : e)
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  return { sent, failed }
}

function requireAdmin(actor: Actor) {
  if (!actor.roles.has('admin')) throw forbidden('Els recordatoris els gestiona l’administració.')
}

/** Estat per a la pantalla de correu: si es pot enviar, qui els rebria avui i què s'ha enviat. */
export async function reminderStatus(ctx: Ctx, actor: Actor, mailer: Mailer | undefined, today = schoolDay()) {
  requireAdmin(actor)
  const settings = await mailSettings(ctx.db)
  const pending = await pendingReminders(ctx.db, ctx.yearId, today, settings.reminders.daysBefore)
  const groups = new Map<string, { kind: ReminderKind; campaign: string; end: string; n: number }>()
  for (const p of pending) {
    const k = `${p.kind}/${p.campaignId}`
    groups.set(k, { kind: p.kind, campaign: p.campaign, end: p.end, n: (groups.get(k)?.n ?? 0) + 1 })
  }
  const sent = (
    await ctx.db.query<{ kind: ReminderKind; label: string | null; n: string; last: Date }>(
      `select x.kind, coalesce(c.label, f.label) as label, count(*) as n, max(x.sent_at) as last
         from reminders_sent x left join campaigns c on c.id = x.campaign_id left join feedback_campaigns f on f.id = x.campaign_id
        group by x.kind, coalesce(c.label, f.label) order by max(x.sent_at) desc limit 20`,
    )
  ).rows
  return {
    configured: !!mailer,
    sender: mailer?.from ?? TEACHER_SENDER.email,
    enabled: settings.reminders.enabled,
    daysBefore: settings.reminders.daysBefore,
    today,
    pending: [...groups.values()],
    sent: sent.map((r) => ({ kind: r.kind, campaign: r.label ?? '—', n: Number(r.n), last: new Date(r.last).toISOString() })),
  }
}

/** L'administració els envia ara, sense esperar la tasca diària (encara que l'enviament automàtic estigui aturat). */
export async function remindNow(ctx: Ctx, actor: Actor, mailer: Mailer | undefined, today = schoolDay()) {
  requireAdmin(actor)
  if (!mailer) throw conflict('L’enviament de correus encara no està configurat al servidor.')
  const settings = await mailSettings(ctx.db)
  const out = await sendReminders(ctx.db, mailer, settings, await pendingReminders(ctx.db, ctx.yearId, today, settings.reminders.daysBefore))
  await ctx.db.query('insert into audit_log (actor_id, action, detail) values ($1, $2, $3)', [actor.userId, 'Recordatoris enviats', JSON.stringify(out)])
  return out
}

/** Prova: els dos recordatoris, amb dades d'exemple, a qui la demana. */
export async function remindTest(ctx: Ctx, actor: Actor, mailer: Mailer | undefined) {
  requireAdmin(actor)
  if (!mailer) throw conflict('L’enviament de correus encara no està configurat al servidor.')
  const settings = await mailSettings(ctx.db)
  for (const kind of ['remindStudents', 'remindTeachers'] as const) {
    const m = renderMail(kind, settings, exampleVars(kind))
    try {
      await mailer.send({ to: actor.email, subject: `[Prova] ${m.subject}`, text: m.text, html: m.html, fromName: senderOf(kind, settings).name, replyTo: TEACHER_SENDER.email })
    } catch (e) {
      throw conflict(e instanceof Error ? e.message : 'No s’ha pogut enviar la prova.')
    }
  }
  return { to: actor.email }
}
