// Proves del servidor d'«Em miro» i de la gestió del centre (PostgreSQL en memòria amb l'esquema complet).
// Les operacions fan servir les regles de src/data/api.ts; aquí es comprova que els permisos els decideix
// el servidor, que l'estat surt retallat i que el que s'escriu a la base de dades és correcte.
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DemoState } from '../../src/data/seed'
import { buildSteps, requiredKeys } from '../../src/domain/engine'
import { subjectsForStudent } from '../../src/domain/engine'
import type { Answers } from '../../src/domain/types'
import { buildApp } from '../app'
import type { Db } from '../db'
import { memoryDb } from '../pglite'
import { applySeed, PROVA } from '../seed'

const mail = (u: string) => `${u}@ramonpont.cat`
const EM = PROVA.emCampaignId

let db: Db
let close: () => Promise<unknown>
let app: ReturnType<typeof buildApp>

const call = async (user: string, method: 'GET' | 'POST', url: string, payload?: object) => {
  const r = await app.inject({ method, url, payload, headers: { authorization: `Bearer ${mail(user)}` } })
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : undefined }
}
const state = async (user: string) => (await call(user, 'GET', '/api/state')).body as { session: { role: string; studentId?: string; groups?: string[] }; state: DemoState }
const op = (user: string, name: string, ...args: unknown[]) => call(user, 'POST', '/api/ops', { name, args })
const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]

beforeAll(async () => {
  const mem = await memoryDb()
  db = mem.db
  close = () => mem.pg.close()
  await applySeed(db)
  app = buildApp({ db, verify: async (t) => ({ sub: `sub-${t}`, email: t, name: t }), draftKey: randomBytes(32), yearId: PROVA.year })
})

afterAll(async () => {
  await app.close()
  await close()
})

/** Respostes completes per a la recollida oberta, calculades amb el mateix motor que l'app. */
function fullAnswers(s: DemoState): Answers {
  const c = s.campaigns.find((x) => x.id === EM)!
  const t = s.templates.find((x) => x.id === c.templateVersionId)!
  const steps = buildSteps(t, { stage: t.stage, subjects: subjectsForStudent(c.subjectsSnapshot, s.students[0], s.subjects) })
  const qs = t.sections.flatMap((x) => x.questions)
  const out: Answers = {}
  for (const step of steps)
    for (const { key } of requiredKeys(step)) {
      const [qid, , part] = key.split('|')
      const qn = qs.find((x) => x.id === qid)!
      if (qn.type === 'shortText' || qn.type === 'longText') out[key] = 'Text de prova'
      else out[key] = s.scales.find((x) => x.id === (part ? qn.criteria!.find((c) => c.id === part)!.scaleId : qn.scaleId))!.options[0].value
    }
  return out
}

describe('servidor d’«Em miro»', () => {
  it('l’alumne rep només les seves dades', async () => {
    const { session, state: s } = await state('e01')
    expect(session).toMatchObject({ role: 'student', studentId: 'e01' })
    expect(s.students.map((x) => x.id)).toEqual(['e01'])
    expect(s.students[0].guardians).toEqual([])
    expect(s.staff).toEqual([])
    expect(s.campaigns.map((c) => c.id)).toEqual([EM])
    expect(s.audit).toEqual([])
    expect((await call('nobody', 'GET', '/api/state')).status).toBe(403)
  })

  it('l’alumne desa, no pot lliurar a mitges i lliura amb historial', async () => {
    const { state: s } = await state('e01')
    const answers = fullAnswers(s)
    const [firstKey] = Object.keys(answers)
    expect((await op('e01', 'saveDraft', EM, { [firstKey]: answers[firstKey] })).status).toBe(200)
    expect(await one('select status, revision from responses')).toEqual({ status: 'EN_CURS', revision: 0 })
    const half = await op('e01', 'submitResponse', EM, { [firstKey]: answers[firstKey] })
    expect(half.status).toBe(409)
    expect(half.body.error).toMatch(/pendents/)
    const ok = await op('e01', 'submitResponse', EM, answers)
    expect(ok.status).toBe(200)
    expect(ok.body.state.responses[0]).toMatchObject({ studentId: 'e01', status: 'LLIURADA', revision: 1 })
    expect((await one<{ n: number }>('select count(*)::int as n from response_revisions'))!.n).toBe(1)
    // Un alumne no pot fer res més que respondre, ni respondre per un altre curs.
    expect((await op('e01', 'addClassGroup', '2ESO', 'B')).status).toBe(403)
    expect((await op('p1', 'saveDraft', EM, {})).status).toBe(403)
  })

  it('la tutoria veu els seus grups; la resta del personal, no', async () => {
    const m = await state('marta')
    expect(m.session.groups).toEqual(['2ESO-A'])
    expect(m.state.students).toHaveLength(16)
    expect(m.state.responses.map((r) => r.studentId)).toEqual(['e01'])
    expect(m.state.audit.map((a) => a.action)).toEqual(['Lliurament'])
    const x = await state('xavier')
    expect(x.state.students).toEqual([])
    expect(x.state.responses).toEqual([])
    expect((await op('xavier', 'setCampaignStatus', EM, 'TANCADA')).status).toBe(403)
    expect((await op('marta', 'setCampaignStatus', EM, 'TANCADA')).status).toBe(200)
    expect((await one<{ status: string }>('select status from campaigns where id = $1', [EM]))!.status).toBe('TANCADA')
    expect((await op('marta', 'saveDraft', EM, {})).status).toBe(403)
  })

  it('grups: crear, moure alumnes, reanomenar i treure', async () => {
    expect((await op('marta', 'addClassGroup', '2ESO', 'B')).status).toBe(403)
    expect((await op('admin', 'addClassGroup', '2ESO', 'B')).status).toBe(200)
    expect((await op('admin', 'addClassGroup', '2ESO', 'b')).status).toBe(409)
    expect((await op('admin', 'setStudentGroup', 'e02', 'B')).status).toBe(200)
    expect((await op('admin', 'renameClassGroup', '2ESO', 'B', 'Línia 2')).status).toBe(200)
    expect(await one("select label from class_groups g join enrollments e on e.group_id = g.id join students s on s.id = e.student_id where s.school_ref = 'e02'")).toEqual({ label: 'Línia 2' })
    expect((await op('admin', 'removeClassGroup', '2ESO', 'Línia 2')).status).toBe(409)
    await op('admin', 'setStudentGroup', 'e02', 'A')
    const r = await op('admin', 'removeClassGroup', '2ESO', 'Línia 2')
    expect(r.status).toBe(200)
    expect(r.body.state.classGroups['2ESO']).toEqual(['A'])
    expect((await one<{ n: number }>("select count(*)::int as n from class_groups where grade_id = '2ESO'"))!.n).toBe(1)
  })

  it('cens: només s’importen les files vàlides, també al servidor', async () => {
    const rows = [
      { id: 'n01', name: 'Nova', surname: 'Alumna', email: 'n01@ramonpont.cat', gradeId: '3EP', group: 'A', issues: [] },
      { id: 'n02', name: 'Fora', surname: 'Domini', email: 'n02@gmail.com', gradeId: '3EP', group: 'A', issues: [] },
      { id: 'n03', name: 'Sense', surname: 'Grup', email: 'n03@ramonpont.cat', gradeId: '3EP', group: 'Z', issues: [] },
    ]
    const r = await op('admin', 'importCensus', rows)
    expect(r.body.result).toBe(1)
    expect(await one("select school_ref from students where school_ref like 'n0%'")).toEqual({ school_ref: 'n01' })
    expect((await op('admin', 'setElective', 'n01', 'XXX', true)).status).toBe(409)
    const el = await op('admin', 'setElective', 'n01', 'REL', true)
    expect(el.status).toBe(200)
    expect((await one<{ n: number }>("select count(*)::int as n from student_subjects where subject_id = 'REL'"))!.n).toBe(1)
  })

  it('personal i Equip Directiu', async () => {
    expect((await op('admin', 'addStaff', 'nova@ramonpont.cat', 'Nova Docent', 'teacher', ['3EP-A'])).status).toBe(200)
    expect((await state('nova')).session).toMatchObject({ role: 'teacher', groups: ['3EP-A'] })
    expect((await op('admin', 'setDirection', 'nova@ramonpont.cat', true)).status).toBe(403)
    expect((await op('dir', 'setDirection', 'nova@ramonpont.cat', true)).status).toBe(200)
    expect((await one<{ n: number }>("select count(*)::int as n from user_roles r join users u on u.id = r.user_id where u.email = 'nova@ramonpont.cat'"))!.n).toBe(2)
    expect((await op('admin', 'removeStaff', 'nova@ramonpont.cat')).status).toBe(403)
    expect((await op('dir', 'removeStaff', 'nova@ramonpont.cat')).status).toBe(200)
    expect((await call('nova', 'GET', '/api/state')).status).toBe(403)
  })

  it('recollides, qüestionaris, assignacions i apartats', async () => {
    const created = await op('admin', 'createCampaign', '3EP', 'Prova CM', '2026-12-01', '2026-12-15')
    expect(created.status).toBe(200)
    const c = (created.body.state as DemoState).campaigns.find((x) => x.label === 'Prova CM')!
    expect(await one('select grade_id, status from campaigns where id = $1', [c.id])).toEqual({ grade_id: '3EP', status: 'PROGRAMADA' })
    const draft = (await op('admin', 'newDraftFrom', 'tpl-cm-v1')).body.result as { id: string; sections: unknown[] }
    expect(draft.id).toBe('tpl-cm-v2')
    expect((await op('admin', 'saveTemplateDraft', { ...draft, name: 'Autoavaluació 3r i 4t', changeNote: 'canvi' })).status).toBe(200)
    expect((await op('admin', 'publishTemplate', 'tpl-cm-v2', 'Nova versió')).status).toBe(200)
    expect(await one("select status from template_versions where id = 'tpl-cm-v2'")).toEqual({ status: 'published' })
    expect((await op('admin', 'saveTemplateDraft', { ...draft, status: 'draft' })).status).toBe(409)
    expect((await op('admin', 'adoptTemplateInScheduled', 'tpl-cm-v2')).body.result).toBe(1)
    expect(await one('select template_version_id from campaigns where id = $1', [c.id])).toEqual({ template_version_id: 'tpl-cm-v2' })
    expect((await op('admin', 'setAssignment', '3EP', 'A', 'ANG', mail('xavier'))).status).toBe(200)
    expect((await op('admin', 'setAssignment', '3EP', 'A', 'ANG', 'ningu@ramonpont.cat')).status).toBe(409)
    expect((await one<{ n: number }>("select count(*)::int as n from teaching_assignments where subject_id = 'ANG'"))!.n).toBe(1)
    expect((await op('admin', 'setModules', { emMiro: false })).status).toBe(200)
    expect(await one("select value from app_settings where key = 'modules'")).toEqual({ value: { emMiro: false, etVeig: true } })
    expect((await op('xavier', 'createFeedbackCampaign', 'Recollida de maig', ['ESO'], '2027-05-10', '2027-05-21')).status).toBe(403)
    expect((await op('dir', 'createFeedbackCampaign', 'Recollida de maig', ['ESO'], '2027-05-10', '2027-05-21')).status).toBe(200)
    const fb = (await call('dir', 'GET', '/api/et-veig/campaigns')).body as { label: string; status: string }[]
    expect(fb.find((c) => c.label === 'Recollida de maig')).toMatchObject({ status: 'PROGRAMADA' })
    expect((await op('admin', 'nopes')).status).toBe(400)
    const actions = (await db.query<{ action: string }>('select action from audit_log order by id')).rows.map((r) => r.action)
    expect(actions).toEqual(expect.arrayContaining(['Lliurament', 'Estat de recollida', 'Grups', 'Importació de cens', 'Permisos', 'Nova recollida', 'Publicació de qüestionari', 'Assignació docent', 'Apartats']))
  })
})
