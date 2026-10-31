// Còpies de seguretat dins de la mateixa base de dades: totes les dades de treball en un sol JSON.
// Es fan cada dia (tasca programada), abans de començar un curs nou, abans d'importar correus de les
// famílies, abans de restaurar-ne una i quan l'administració ho demana. Restaurar torna totes les dades
// a l'estat de la còpia en una sola transacció: o es fa tot o no es fa res.
// No es copien ni es toquen el registre d'operacions (audit_log, només creix), els recordatoris enviats
// (ja han sortit) ni les mateixes còpies.
import type { Actor } from './auth'
import type { Queryable } from './db'
import { conflict, forbidden, notFound } from './errors'
import type { Ctx } from './etveig'
import { LOCK } from './ops'

/** Taules copiades, de pares a fills (ordre de les claus foranes). */
export const BACKUP_TABLES = [
  'users', 'user_roles', 'academic_years', 'grades', 'class_groups', 'teacher_group_assignments', 'students', 'enrollments',
  'guardians', 'student_guardians', 'contact_imports', 'import_issues', 'subjects', 'grade_subjects', 'student_subjects',
  'answer_scales', 'questionnaire_templates', 'template_versions', 'campaigns', 'responses', 'response_revisions', 'generated_reports',
  'delivery_batches', 'delivery_recipients', 'delivery_attempts', 'app_settings', 'teaching_assignments', 'feedback_scales', 'feedback_forms',
  'feedback_campaigns', 'feedback_drafts', 'feedback_participation', 'feedback_participation_counts', 'feedback_answers', 'feedback_comments',
  'teacher_self_assessments', 'feedback_report_views',
] as const

/**
 * No s'esborren mai, es posen com a la còpia: el registre d'operacions apunta als usuaris i les versions
 * publicades (que no es poden esborrar) apunten a les escales i als qüestionaris.
 */
const UPSERT = new Set(['users', 'grades', 'answer_scales', 'questionnaire_templates', 'feedback_scales'])
/** Les versions publicades són immutables: només es reemplacen els esborranys. */
const IMMUTABLE = new Set(['template_versions', 'feedback_forms'])
/** Columnes amb identitat generada: cal conservar-ne el valor. */
const IDENTITY = new Set(['feedback_report_views'])

/** Es conserven les còpies dels darrers dies i, com a mínim, les més recents. */
export const KEEP_DAYS = 30
export const KEEP_MIN = 10

export interface BackupInfo {
  id: number
  at: string
  reason: string
  by: string | null
  year: string | null
  rows: number
  bytes: number
}

function requireAdmin(actor: Actor) {
  if (!actor.roles.has('admin')) throw forbidden('Les còpies de seguretat només les gestiona l’administració.')
}

/** Fa una còpia completa amb la connexió (i la transacció) de qui la crida. Retorna l'identificador. */
export async function createBackup(q: Queryable, reason: string, actorId: string | null, yearId: string | null): Promise<number> {
  const parts = BACKUP_TABLES.map((t) => `'${t}', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from ${t} x)`).join(', ')
  const id = (
    await q.query<{ id: number }>(
      `with d as (select jsonb_build_object(${parts}) as data)
       insert into backups (reason, created_by, year_id, rows, bytes, data)
       select $1, $2, $3, (select coalesce(sum(jsonb_array_length(value)), 0) from jsonb_each(d.data)), octet_length(d.data::text), d.data from d
       returning id`,
      [reason, actorId, yearId],
    )
  ).rows[0].id
  await q.query(
    `delete from backups where at < now() - make_interval(days => $1) and id not in (select id from backups order by at desc, id desc limit $2)`,
    [KEEP_DAYS, KEEP_MIN],
  )
  return Number(id)
}

/** Torna totes les dades a l'estat de la còpia. S'ha de cridar dins d'una transacció. */
async function restoreInto(q: Queryable, id: number) {
  const cols = async (t: string) =>
    (await q.query<{ c: string }>("select column_name as c from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position", [t])).rows.map((r) => r.c)
  for (const t of [...BACKUP_TABLES].reverse()) {
    if (UPSERT.has(t)) continue
    await q.query(IMMUTABLE.has(t) ? `delete from ${t} where status = 'draft'` : `delete from ${t}`)
  }
  for (const t of BACKUP_TABLES) {
    const src = `from jsonb_populate_recordset(null::${t}, (select coalesce(data->'${t}', '[]'::jsonb) from backups where id = $1))`
    if (UPSERT.has(t)) {
      const c = await cols(t)
      await q.query(`insert into ${t} (${c.join(', ')}) select ${c.join(', ')} ${src} on conflict (id) do update set ${c.filter((x) => x !== 'id').map((x) => `${x} = excluded.${x}`).join(', ')}`, [id])
    } else {
      await q.query(`insert into ${t} ${IDENTITY.has(t) ? 'overriding system value ' : ''}select * ${src} on conflict do nothing`, [id])
    }
  }
}

export async function listBackups(ctx: Ctx, actor: Actor): Promise<BackupInfo[]> {
  requireAdmin(actor)
  const rows = (
    await ctx.db.query<{ id: number; at: Date; reason: string; by: string | null; year_id: string | null; rows: number; bytes: number }>(
      'select b.id, b.at, b.reason, u.display_name as by, b.year_id, b.rows, b.bytes from backups b left join users u on u.id = b.created_by order by b.at desc, b.id desc',
    )
  ).rows
  return rows.map((r) => ({ id: Number(r.id), at: new Date(r.at).toISOString(), reason: r.reason, by: r.by, year: r.year_id, rows: Number(r.rows), bytes: Number(r.bytes) }))
}

export async function backupNow(ctx: Ctx, actor: Actor) {
  requireAdmin(actor)
  const id = await ctx.db.tx(async (q) => {
    await q.query('select pg_advisory_xact_lock($1)', [LOCK])
    return createBackup(q, 'Feta a mà', actor.userId, ctx.yearId)
  })
  return { id }
}

/** Restaura una còpia. Abans en fa una de l'estat actual, per poder desfer la restauració. */
export async function restoreBackup(ctx: Ctx, actor: Actor, id: number) {
  requireAdmin(actor)
  return ctx.db.tx(async (q) => {
    await q.query('select pg_advisory_xact_lock($1)', [LOCK])
    const b = (await q.query<{ at: Date }>('select at from backups where id = $1', [id])).rows[0]
    if (!b) throw notFound()
    const when = new Intl.DateTimeFormat('ca', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date(b.at))
    const safety = await createBackup(q, `Abans de restaurar la còpia del ${when}`, actor.userId, ctx.yearId)
    try {
      await restoreInto(q, id)
    } catch (e) {
      console.error('Restauració fallida:', e instanceof Error ? e.message : e)
      throw conflict('No s’ha pogut restaurar la còpia: no s’ha canviat res.')
    }
    await q.query('insert into audit_log (actor_id, action, detail) values ($1, $2, $3)', [actor.userId, 'Còpia restaurada', JSON.stringify({ backup: id, at: new Date(b.at).toISOString(), safety })])
    return { restored: id, safety }
  })
}
