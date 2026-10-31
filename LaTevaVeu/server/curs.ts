// Curs escolar nou: es crea el curs següent amb la mateixa configuració, l'alumnat passa al curs
// següent amb el mateix grup i el de 4t d'ESO surt de l'escola. El curs anterior es conserva sencer.
import { nextGrade, nextYear } from '../src/domain/catalog'
import type { GradeId } from '../src/domain/types'
import type { Actor } from './auth'
import { conflict, forbidden } from './errors'
import type { Ctx } from './etveig'
import { LOCK } from './ops'

export interface NewYearResult {
  year: string
  promoted: number
  graduated: number
}

export async function startNewYear(ctx: Ctx, actor: Actor, year: unknown): Promise<NewYearResult> {
  if (!actor.roles.has('admin')) throw forbidden('El curs nou només el pot començar l’administració.')
  const out = await ctx.db.tx(async (q) => {
    await q.query('select pg_advisory_xact_lock($1)', [LOCK])
    const old = ctx.yearId
    const next = nextYear(old)
    // El navegador diu quin curs vol començar: si no és el següent (doble clic, pestanya antiga), no es fa res.
    if (year !== next) throw conflict(`El curs actual és ${old}: només es pot començar el ${next}.`)
    if ((await q.query('select 1 from academic_years where id = $1', [next])).rows.length) throw conflict(`El curs ${next} ja existeix.`)
    const [y1, y2] = next.split('-')
    await q.query('insert into academic_years (id, starts_on, ends_on, current) values ($1, $2, $3, false)', [next, `${y1}-09-01`, `${y2}-06-30`])
    await q.query('insert into grade_subjects (year_id, grade_id, subject_id, sort, optional, active) select $2, grade_id, subject_id, sort, optional, active from grade_subjects where year_id = $1', [old, next])
    await q.query('insert into class_groups (year_id, grade_id, label) select $2, grade_id, label from class_groups where year_id = $1', [old, next])
    // Les assignacions del professorat es mantenen per curs i grup: l'administració les ajusta si cal.
    const same = 'join class_groups og on og.id = x.group_id and og.year_id = $1 join class_groups ng on ng.year_id = $2 and ng.grade_id = og.grade_id and ng.label = og.label'
    await q.query(`insert into teacher_group_assignments (user_id, group_id) select x.user_id, ng.id from teacher_group_assignments x ${same}`, [old, next])
    await q.query(`insert into teaching_assignments (group_id, subject_id, teacher_id) select ng.id, x.subject_id, x.teacher_id from teaching_assignments x ${same}`, [old, next])

    const enrolled = (
      await q.query<{ student_id: string; grade_id: GradeId; label: string }>(
        `select e.student_id, g.grade_id, g.label from enrollments e join class_groups g on g.id = e.group_id and g.year_id = $1
          join students s on s.id = e.student_id and s.active where e.active`,
        [old],
      )
    ).rows
    let promoted = 0
    let graduated = 0
    for (const r of enrolled) {
      const g = nextGrade(r.grade_id)
      if (!g) {
        await q.query('update students set active = false where id = $1', [r.student_id])
        graduated++
        continue
      }
      const gid = (
        await q.query<{ id: string }>(
          'insert into class_groups (year_id, grade_id, label) values ($1, $2, $3) on conflict (year_id, grade_id, label) do update set label = excluded.label returning id',
          [next, g, r.label],
        )
      ).rows[0].id
      await q.query('insert into enrollments (student_id, group_id) values ($1, $2)', [r.student_id, gid])
      promoted++
    }
    // Primer es desmarca el curs actual: només n'hi pot haver un.
    await q.query('update academic_years set current = false where current')
    await q.query('update academic_years set current = true where id = $1', [next])
    await q.query('insert into audit_log (actor_id, action, detail) values ($1, $2, $3)', [actor.userId, 'Curs nou', JSON.stringify({ from: old, to: next, promoted, graduated })])
    return { year: next, promoted, graduated }
  })
  ctx.yearId = out.year
  return out
}
