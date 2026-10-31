// Escriu a la base de dades només el que una operació ha canviat de l'estat (abans → després).
// S'executa dins de la mateixa transacció que ha llegit l'estat.
import type { DemoState } from '../src/data/seed'
import { GRADES } from '../src/domain/catalog'
import type { Guardian, StaffMember, Student } from '../src/domain/types'
import type { Queryable } from './db'
import { invalid } from './errors'
import type { Ids } from './state'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Elements nous, canviats i eliminats d'una llista, per clau. */
function diff<T>(prev: T[], next: T[], key: (x: T) => string) {
  const before = new Map(prev.map((x) => [key(x), x]))
  const after = new Map(next.map((x) => [key(x), x]))
  return {
    added: next.filter((x) => !before.has(key(x))),
    changed: next.filter((x) => before.has(key(x)) && !same(before.get(key(x)), x)).map((x) => ({ before: before.get(key(x))!, after: x })),
    removed: prev.filter((x) => !after.has(key(x))),
  }
}

export async function persist(q: Queryable, yearId: string, ids: Ids, prev: DemoState, next: DemoState, actorId: string) {
  const groupId = (gradeId: string, label: string) => {
    const id = ids.groupByKey.get(`${gradeId}-${label}`)
    if (!id) throw invalid(`El grup ${gradeId} ${label} no existeix.`)
    return id
  }

  // 1. Grups: canvis de nom (mateixa posició) i grups nous. Les baixes, al final.
  const dropGroups: string[] = []
  for (const g of GRADES) {
    const p = prev.classGroups[g.id] ?? []
    const n = next.classGroups[g.id] ?? []
    if (same(p, n)) continue
    if (p.length === n.length) {
      for (let i = 0; i < p.length; i++) {
        if (p[i] === n[i] || n.includes(p[i]) || p.includes(n[i])) continue
        const id = ids.groupByKey.get(`${g.id}-${p[i]}`)!
        await q.query('update class_groups set label = $2 where id = $1', [id, n[i]])
        ids.groupByKey.delete(`${g.id}-${p[i]}`)
        ids.groupByKey.set(`${g.id}-${n[i]}`, id)
      }
    }
    for (const label of n.filter((x) => !ids.groupByKey.has(`${g.id}-${x}`))) {
      const id = (await q.query<{ id: string }>('insert into class_groups (year_id, grade_id, label) values ($1, $2, $3) returning id', [yearId, g.id, label])).rows[0].id
      ids.groupByKey.set(`${g.id}-${label}`, id)
    }
    for (const label of p.filter((x) => !n.includes(x) && ids.groupByKey.has(`${g.id}-${x}`))) dropGroups.push(ids.groupByKey.get(`${g.id}-${label}`)!)
  }

  // 2. Personal: usuaris, rols i grups de tutoria.
  const userId = async (email: string, name: string) => {
    const found = ids.userByEmail.get(email)
    if (found) {
      await q.query('update users set display_name = $2, active = true where id = $1', [found, name])
      return found
    }
    const id = (await q.query<{ id: string }>('insert into users (email, display_name) values ($1, $2) returning id', [email, name])).rows[0].id
    ids.userByEmail.set(email, id)
    return id
  }
  const staff = diff(prev.staff, next.staff, (s) => s.email)
  const writeStaff = async (s: StaffMember) => {
    const id = await userId(s.email, s.name)
    const want = [s.role, ...(s.direction ? ['direction'] : [])]
    await q.query('delete from user_roles where user_id = $1 and not (role = any($2))', [id, want])
    for (const r of want) await q.query('insert into user_roles (user_id, role, granted_by) values ($1, $2, $3) on conflict do nothing', [id, r, actorId])
    await q.query('delete from teacher_group_assignments where user_id = $1', [id])
    for (const k of s.groups) {
      const [gradeId, ...rest] = k.split('-')
      await q.query('insert into teacher_group_assignments values ($1, $2) on conflict do nothing', [id, groupId(gradeId, rest.join('-'))])
    }
  }
  for (const s of staff.added) await writeStaff(s)
  for (const { after } of staff.changed) await writeStaff(after)
  for (const s of staff.removed) {
    const id = ids.userByEmail.get(s.email)
    if (!id) continue
    await q.query('delete from user_roles where user_id = $1', [id])
    await q.query('delete from teacher_group_assignments where user_id = $1', [id])
  }

  // 3. Alumnat: dades del cens, grup, optatives i responsables.
  const students = diff(prev.students, next.students, (s) => s.id)
  const writeGuardians = async (studentId: string, list: Guardian[]) => {
    await q.query('delete from student_guardians where student_id = $1', [studentId])
    for (const g of list) {
      const found = (await q.query<{ id: string }>('select id from guardians where lower(email) = $1 limit 1', [g.email.toLowerCase()])).rows[0]
      const gid = found
        ? (await q.query<{ id: string }>('update guardians set full_name = $2 where id = $1 returning id', [found.id, g.name])).rows[0].id
        : (await q.query<{ id: string }>('insert into guardians (full_name, email) values ($1, $2) returning id', [g.name, g.email.toLowerCase()])).rows[0].id
      await q.query('insert into student_guardians (student_id, guardian_id, validated_at, validated_by) values ($1, $2, $3, $4) on conflict do nothing', [
        studentId, gid, g.validated ? new Date() : null, g.validated ? actorId : null,
      ])
    }
  }
  const writeElectives = async (enrollmentId: string, list: string[]) => {
    await q.query('delete from student_subjects where enrollment_id = $1', [enrollmentId])
    for (const s of list) await q.query('insert into student_subjects values ($1, $2) on conflict do nothing', [enrollmentId, s])
  }
  for (const s of students.added) {
    // Un alumne que ja era al cens (d'un altre curs o donat de baixa) es reactiva.
    const old = (await q.query<{ id: string }>('select id from students where school_ref = $1', [s.id])).rows[0]
    const sid = old
      ? (await q.query<{ id: string }>('update students set given_name = $2, family_name = $3, school_email = $4, active = true where id = $1 returning id', [old.id, s.name, s.surname, s.email])).rows[0].id
      : (await q.query<{ id: string }>('insert into students (school_ref, given_name, family_name, school_email) values ($1, $2, $3, $4) returning id', [s.id, s.name, s.surname, s.email])).rows[0].id
    await q.query('update enrollments set active = false where student_id = $1', [sid])
    const eid = (
      await q.query<{ id: string }>(
        'insert into enrollments (student_id, group_id) values ($1, $2) on conflict (student_id, group_id) do update set active = true returning id',
        [sid, groupId(s.gradeId, s.group)],
      )
    ).rows[0].id
    ids.studentByRef.set(s.id, sid)
    ids.enrollmentByRef.set(s.id, eid)
    await writeElectives(eid, s.electives)
    await writeGuardians(sid, s.guardians)
  }
  for (const { before, after } of students.changed as { before: Student; after: Student }[]) {
    const sid = ids.studentByRef.get(after.id)!
    if (before.name !== after.name || before.surname !== after.surname || before.email !== after.email)
      await q.query('update students set given_name = $2, family_name = $3, school_email = $4 where id = $1', [sid, after.name, after.surname, after.email])
    if (before.gradeId !== after.gradeId || before.group !== after.group)
      await q.query('update enrollments set group_id = $2 where id = $1', [ids.enrollmentByRef.get(after.id), groupId(after.gradeId, after.group)])
    if (!same(before.electives, after.electives)) await writeElectives(ids.enrollmentByRef.get(after.id)!, after.electives)
    if (!same(before.guardians, after.guardians)) await writeGuardians(sid, after.guardians)
  }
  for (const s of students.removed) await q.query('update students set active = false where school_ref = $1', [s.id])

  // 4. Matèries (noves i canvis de nom) i matèries de cada curs.
  const subs = diff(prev.subjects, next.subjects, (x) => x.id)
  for (const x of [...subs.added, ...subs.changed.map((c) => c.after)]) {
    if (!/^[A-Z0-9_]{1,12}$/.test(x.id)) throw invalid('Identificador de matèria no vàlid.')
    await q.query(
      `insert into subjects (id, short_name, long_name, hue, active) values ($1, $2, $3, $4, $5)
         on conflict (id) do update set short_name = excluded.short_name, long_name = excluded.long_name, active = excluded.active`,
      [x.id, x.short, x.long, x.hue, x.active],
    )
  }
  const gs = diff(prev.gradeSubjects, next.gradeSubjects, (x) => `${x.gradeId}|${x.subjectId}`)
  for (const x of [...gs.added, ...gs.changed.map((c) => c.after)])
    await q.query(
      `insert into grade_subjects values ($1, $2, $3, $4, $5, $6)
         on conflict (year_id, grade_id, subject_id) do update set sort = excluded.sort, optional = excluded.optional, active = excluded.active`,
      [yearId, x.gradeId, x.subjectId, x.order, x.optional, x.active],
    )

  // 5. Qüestionaris d'«Em miro» (les versions publicades són immutables a la base de dades).
  const tpl = diff(prev.templates, next.templates, (t) => t.id)
  for (const t of [...tpl.added, ...tpl.changed.map((c) => c.after)]) {
    if (!/^[\w-]{1,60}$/.test(t.id)) throw invalid('Identificador de qüestionari no vàlid.')
    await q.query('insert into questionnaire_templates (id, name, stage) values ($1, $2, $3) on conflict (id) do update set name = excluded.name', [t.templateId, t.name, t.stage])
    await q.query(
      `insert into template_versions (id, template_id, version, status, definition, change_note, published_at, published_by) values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do update set status = excluded.status, definition = excluded.definition, change_note = excluded.change_note, published_at = excluded.published_at, published_by = excluded.published_by`,
      [t.id, t.templateId, t.version, t.status, JSON.stringify({ sections: t.sections }), t.changeNote ?? null, t.publishedAt ?? null, t.status === 'published' ? actorId : null],
    )
  }
  for (const t of tpl.removed) await q.query("delete from template_versions where id = $1 and status = 'draft'", [t.id])

  // 6. Recollides d'«Em miro».
  const camp = diff(prev.campaigns, next.campaigns, (c) => c.id)
  for (const c of camp.added) {
    if (!UUID.test(c.id)) throw invalid('Identificador de recollida no vàlid.')
    await q.query(
      `insert into campaigns (id, year_id, grade_id, label, template_version_id, subjects_snapshot, starts_on, ends_on, status, responsible_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [c.id, yearId, c.gradeId, c.label, c.templateVersionId, JSON.stringify(c.subjectsSnapshot), c.start, c.end, c.status, actorId],
    )
  }
  for (const { after: c } of camp.changed)
    await q.query('update campaigns set label = $2, template_version_id = $3, starts_on = $4, ends_on = $5, status = $6 where id = $1', [c.id, c.label, c.templateVersionId, c.start, c.end, c.status])

  // 7. Respostes de l'alumnat; cada lliurament queda a l'historial de revisions.
  const resp = diff(prev.responses, next.responses, (r) => `${r.campaignId}|${r.studentId}`)
  for (const r of [...resp.added, ...resp.changed.map((c) => c.after)]) {
    const eid = ids.enrollmentByRef.get(r.studentId)
    if (!eid) throw invalid('Aquest alumne no és al cens.')
    const id = (
      await q.query<{ id: string }>(
        `insert into responses (campaign_id, enrollment_id, status, answers, revision, updated_at, submitted_at) values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (campaign_id, enrollment_id) do update set status = excluded.status, answers = excluded.answers, revision = excluded.revision, updated_at = excluded.updated_at, submitted_at = excluded.submitted_at
           returning id`,
        [r.campaignId, eid, r.status, JSON.stringify(r.answers), r.revision, r.updatedAt, r.submittedAt ?? null],
      )
    ).rows[0].id
    const before = prev.responses.find((x) => x.campaignId === r.campaignId && x.studentId === r.studentId)
    if (r.revision > (before?.revision ?? 0))
      await q.query('insert into response_revisions (response_id, revision, answers, saved_by) values ($1, $2, $3, $4) on conflict do nothing', [id, r.revision, JSON.stringify(r.answers), actorId])
  }

  // 8. Qui fa classe a qui.
  const asg = diff(prev.assignments, next.assignments, (a) => `${a.gradeId}|${a.group}|${a.subjectId}`)
  for (const a of asg.removed) {
    const gid = ids.groupByKey.get(`${a.gradeId}-${a.group}`)
    if (gid) await q.query('delete from teaching_assignments where group_id = $1 and subject_id = $2', [gid, a.subjectId])
  }
  for (const a of [...asg.added, ...asg.changed.map((c) => c.after)]) {
    const tid = ids.userByEmail.get(a.teacherEmail)
    if (!tid) throw invalid(`${a.teacherEmail} no té accés a l’aplicació.`)
    await q.query('insert into teaching_assignments values ($1, $2, $3) on conflict (group_id, subject_id) do update set teacher_id = excluded.teacher_id', [groupId(a.gradeId, a.group), a.subjectId, tid])
  }

  // 9. Apartats actius.
  if (!same(prev.modules, next.modules))
    await q.query("insert into app_settings values ('modules', $1) on conflict (key) do update set value = excluded.value", [JSON.stringify(next.modules)])
  if (!same(prev.mail, next.mail))
    await q.query("insert into app_settings values ('mail', $1) on conflict (key) do update set value = excluded.value", [JSON.stringify(next.mail)])

  // 10. Preguntes d'«Et veig» (versionades com els qüestionaris).
  const forms = diff(prev.feedbackForms, next.feedbackForms, (f) => f.id)
  for (const f of [...forms.added, ...forms.changed.map((c) => c.after)]) {
    if (!/^[\w-]{1,60}$/.test(f.id)) throw invalid('Identificador de preguntes no vàlid.')
    await q.query(
      `insert into feedback_forms (id, template_id, stage, version, status, scale_id, definition, change_note, published_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (id) do update set status = excluded.status, scale_id = excluded.scale_id, definition = excluded.definition, change_note = excluded.change_note, published_at = excluded.published_at`,
      [f.id, f.templateId, f.stage, f.version, f.status, f.scaleId, JSON.stringify({ dimensions: f.dimensions, items: f.items, open: f.open }), f.changeNote ?? null, f.publishedAt ?? null],
    )
  }
  for (const f of forms.removed) await q.query("delete from feedback_forms where id = $1 and status = 'draft'", [f.id])

  // 11. Recollides d'«Et veig»: aquí només se'n creen i se n'actualitza el qüestionari mentre no s'han obert.
  //     Els canvis d'estat passen per server/etveig.ts, que congela, barreja i esborra el que toca.
  const fc = diff(prev.feedbackCampaigns, next.feedbackCampaigns, (c) => c.id)
  for (const c of fc.added) {
    if (!UUID.test(c.id)) throw invalid('Identificador de recollida no vàlid.')
    await q.query("insert into feedback_campaigns (id, year_id, label, stages, starts_on, ends_on, status, form_ids) values ($1, $2, $3, $4, $5, $6, 'PROGRAMADA', $7)", [
      c.id, yearId, c.label, c.stages, c.start, c.end, JSON.stringify(c.formIds),
    ])
  }
  for (const { after: c } of fc.changed)
    await q.query("update feedback_campaigns set form_ids = $2 where id = $1 and status in ('ESBORRANY', 'PROGRAMADA')", [c.id, JSON.stringify(c.formIds)])

  // 12. Grups eliminats (ja sense alumnes, assignacions ni tutoria).
  for (const id of dropGroups) {
    await q.query('delete from teacher_group_assignments where group_id = $1', [id])
    await q.query('delete from teaching_assignments where group_id = $1', [id])
    await q.query('delete from class_groups where id = $1', [id])
  }

  // 13. Registre: les entrades noves, en ordre cronològic.
  const k = prev.audit.length ? next.audit.indexOf(prev.audit[0]) : next.audit.length
  const fresh = (k < 0 ? next.audit.slice(0, next.audit.length - prev.audit.length) : next.audit.slice(0, k)).reverse()
  for (const a of fresh) await q.query('insert into audit_log (actor_id, action, detail) values ($1, $2, $3)', [actorId, a.action, JSON.stringify({ text: a.detail })])
}
