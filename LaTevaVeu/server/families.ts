// Correus de les famílies al servidor: llista, importació CSV i validació.
// Només l'administració i l'Equip Directiu. El CSV es torna a validar aquí: el navegador no és de fiar.
import { parseGuardiansCsv } from '../src/domain/csv'
import type { GradeId, Student } from '../src/domain/types'
import type { Actor } from './auth'
import type { Queryable } from './db'
import { forbidden, invalid, notFound } from './errors'
import type { Ctx } from './etveig'

export interface FamilyRow {
  /** Identificador del cens (school_ref), el mateix que porta el CSV. */
  ref: string
  name: string
  surname: string
  email: string
  gradeId: GradeId
  group: string
  guardians: { name: string; email: string; validated: boolean }[]
}

function requireManager(actor: Actor) {
  if (!actor.roles.has('admin') && !actor.roles.has('direction')) throw forbidden('Els correus de les famílies els gestiona l’administració o l’Equip Directiu.')
}

const audit = (q: Queryable, actor: Actor, detail: object) =>
  q.query('insert into audit_log (actor_id, action, detail) values ($1, $2, $3)', [actor.userId, 'Correus de les famílies', JSON.stringify(detail)])

async function rows(q: Queryable, yearId: string): Promise<FamilyRow[]> {
  const res = await q.query<{ ref: string; name: string; surname: string; email: string; grade_id: GradeId; label: string; guardians: FamilyRow['guardians'] | null }>(
    `select s.school_ref as ref, s.given_name as name, s.family_name as surname, lower(s.school_email) as email, g.grade_id, g.label,
            (select json_agg(json_build_object('name', gu.full_name, 'email', lower(gu.email), 'validated', sg.validated_at is not null) order by gu.full_name)
               from student_guardians sg join guardians gu on gu.id = sg.guardian_id where sg.student_id = s.id) as guardians
       from students s join enrollments e on e.student_id = s.id and e.active
       join class_groups g on g.id = e.group_id and g.year_id = $1
      where s.active order by g.grade_id, g.label, s.family_name, s.given_name`,
    [yearId],
  )
  return res.rows.map((r) => ({ ref: r.ref, name: r.name, surname: r.surname, email: r.email, gradeId: r.grade_id, group: r.label, guardians: r.guardians ?? [] }))
}

export async function listFamilies(ctx: Ctx, actor: Actor) {
  requireManager(actor)
  return rows(ctx.db, ctx.yearId)
}

/** Per a cada alumne del fitxer, els correus importats substitueixen els anteriors i queden validats. */
export async function importFamilies(ctx: Ctx, actor: Actor, csv: string, filename?: string) {
  requireManager(actor)
  if (typeof csv !== 'string' || !csv.trim()) throw invalid('El fitxer és buit.')
  const census = await rows(ctx.db, ctx.yearId)
  const asStudents: Student[] = census.map((r) => ({ id: r.ref, name: r.name, surname: r.surname, email: r.email, gradeId: r.gradeId, group: r.group, electives: [], guardians: [] }))
  const parsed = parseGuardiansCsv(csv, asStudents)
  const refs = [...new Set(parsed.rows.map((r) => r.studentId))]
  await ctx.db.tx(async (q) => {
    const imp = (
      await q.query<{ id: string }>('insert into contact_imports (imported_by, filename, row_count) values ($1, $2, $3) returning id', [actor.userId, filename?.slice(0, 200) ?? null, parsed.rows.length + parsed.issues.length])
    ).rows[0]
    for (const x of parsed.issues) await q.query('insert into import_issues (import_id, row_number, issue) values ($1, $2, $3)', [imp.id, x.line, x.msg])
    for (const ref of refs) {
      const sid = (await q.query<{ id: string }>('select id from students where school_ref = $1', [ref])).rows[0].id
      await q.query('delete from student_guardians where student_id = $1', [sid])
      for (const r of parsed.rows.filter((x) => x.studentId === ref)) {
        // Un mateix responsable pot ser-ho de diversos germans: es reaprofita pel correu.
        const found = (await q.query<{ id: string }>('select id from guardians where lower(email) = $1 limit 1', [r.guardian.email])).rows[0]
        const gid = found
          ? (await q.query<{ id: string }>('update guardians set full_name = $2 where id = $1 returning id', [found.id, r.guardian.name])).rows[0].id
          : (await q.query<{ id: string }>('insert into guardians (full_name, email) values ($1, $2) returning id', [r.guardian.name, r.guardian.email])).rows[0].id
        await q.query('insert into student_guardians (student_id, guardian_id, validated_at, validated_by) values ($1, $2, now(), $3)', [sid, gid, actor.userId])
      }
    }
    await audit(q, actor, { import: imp.id, emails: parsed.rows.length, students: refs.length, issues: parsed.issues.length })
  })
  return { students: refs.length, emails: parsed.rows.length, issues: parsed.issues }
}

async function link(q: Queryable, ref: string, email: string) {
  const r = (
    await q.query<{ student_id: string; guardian_id: string }>(
      'select sg.student_id, sg.guardian_id from student_guardians sg join students s on s.id = sg.student_id join guardians g on g.id = sg.guardian_id where s.school_ref = $1 and lower(g.email) = lower($2)',
      [ref, email],
    )
  ).rows[0]
  if (!r) throw notFound()
  return r
}

export async function setGuardianValidated(ctx: Ctx, actor: Actor, ref: string, email: string, validated: boolean) {
  requireManager(actor)
  await ctx.db.tx(async (q) => {
    const l = await link(q, ref, email)
    await q.query('update student_guardians set validated_at = $3, validated_by = $4 where student_id = $1 and guardian_id = $2', [l.student_id, l.guardian_id, validated ? new Date() : null, validated ? actor.userId : null])
    await audit(q, actor, { student: ref, email, validated })
  })
}

export async function removeGuardian(ctx: Ctx, actor: Actor, ref: string, email: string) {
  requireManager(actor)
  await ctx.db.tx(async (q) => {
    const l = await link(q, ref, email)
    await q.query('delete from student_guardians where student_id = $1 and guardian_id = $2', [l.student_id, l.guardian_id])
    await audit(q, actor, { student: ref, email, removed: true })
  })
}
