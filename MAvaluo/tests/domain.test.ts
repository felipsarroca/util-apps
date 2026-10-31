// Proves del motor i de les regles d'accés (criteris d'acceptació del pla mestre).
import { beforeEach, describe, expect, it } from 'vitest'
import { checkSchoolEmail } from '../src/data/auth'
import { createDemoState } from '../src/data/seed'
import { SUBJECTS } from '../src/domain/catalog'
import { normalizeGrade, parseCsv } from '../src/domain/csv'
import { buildSteps, findMissing, keyOf, subjectsForStudent, validateTemplate } from '../src/domain/engine'
import { INITIAL_SCALES, INITIAL_TEMPLATES } from '../src/domain/templates'

const mem = new Map<string, string>()
globalThis.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 } as Storage

const api = await import('../src/data/api')

describe('domini @ramonpont.cat', () => {
  it('accepta només el domini exacte de l’escola', () => {
    expect(checkSchoolEmail(' Nom.Cognom@RamonPont.cat ').ok).toBe(true)
    expect(checkSchoolEmail('nom@gmail.com').ok).toBe(false)
    expect(checkSchoolEmail('nom@alumnes.ramonpont.cat').ok).toBe(false)
    expect(checkSchoolEmail('nom@ramonpont.cat.fals.com').ok).toBe(false)
    expect(checkSchoolEmail('ramonpont.cat').ok).toBe(false)
  })
  it('un compte del domini fora del cens queda pendent i sense dades (criteri 1)', () => {
    const s = api.resolveSession('desconegut@ramonpont.cat')
    expect('error' in s).toBe(false)
    if ('error' in s) return
    expect(s.pending).toBe(true)
    expect(s.studentId).toBeUndefined()
  })
  it('rebutja un compte extern encara que figuri al cens amb un altre domini', () => {
    expect('error' in api.resolveSession('pau.serra@gmail.com')).toBe(true)
  })
})

describe('motor de qüestionaris', () => {
  const st = createDemoState()
  it('les plantilles inicials són vàlides', () => {
    for (const t of INITIAL_TEMPLATES) expect(validateTemplate(t, INITIAL_SCALES)).toEqual([])
  })
  it('les optatives no cursades no apareixen (criteri 6)', () => {
    const marc = st.students.find((x) => x.email === 'marc.vidal@ramonpont.cat')!
    const subj = subjectsForStudent(st.gradeSubjects, marc, SUBJECTS).map((x) => x.id)
    expect(subj).toContain('FRA')
    expect(subj).not.toContain('CLA')
    expect(subj).not.toContain('REL')
  })
  it('cicle mitjà: una pregunta per pantalla; ESO: blocs', () => {
    const cm = buildSteps(INITIAL_TEMPLATES[0], { stage: 'CM', subjects: SUBJECTS.slice(0, 2) })
    expect(cm.filter((x) => x.kind === 'question').length).toBe(6)
    const eso = buildSteps(INITIAL_TEMPLATES[2], { stage: 'ESO', subjects: SUBJECTS.slice(0, 3) })
    expect(eso.filter((x) => x.kind === 'section').length).toBe(4)
    expect(eso.filter((x) => x.kind === 'subject').length).toBe(3)
  })
  it('l’objectiu anterior només apareix si existeix', () => {
    const t = INITIAL_TEMPLATES[1]
    const without = buildSteps(t, { stage: 'CS', subjects: [] })
    const withGoal = buildSteps(t, { stage: 'CS', subjects: [], previousGoal: 'Llegir cada dia' })
    expect(withGoal.length).toBe(without.length + 1)
  })
  it('detecta les respostes obligatòries pendents i ignora les opcionals', () => {
    const t = INITIAL_TEMPLATES[2]
    const steps = buildSteps(t, { stage: 'ESO', subjects: [SUBJECTS[0]] })
    const all = findMissing(steps, {})
    expect(all.some((m) => m.key === keyOf('eso-mat-q', 'CAT', 'obs'))).toBe(false)
    expect(all.length).toBe(14 + 3 + 1)
  })
  it('una versió amb escala inexistent no es pot publicar', () => {
    const t = structuredClone(INITIAL_TEMPLATES[2])
    t.sections[0].questions[0].scaleId = 'no-existeix'
    expect(validateTemplate(t, INITIAL_SCALES).length).toBeGreaterThan(0)
  })
})

describe('permisos i versions', () => {
  beforeEach(() => api.resetDemo())
  const sess = (email: string) => {
    const s = api.resolveSession(email)
    if ('error' in s) throw new Error(s.error)
    return s
  }
  it('un tutor només veu els seus grups (criteri 3)', () => {
    const t = sess('tutoria.2eso@ramonpont.cat')
    const state = createDemoState()
    const visible = api.visibleStudents(state, t)
    expect(visible.length).toBeGreaterThan(0)
    expect(visible.every((x) => x.gradeId === '2ESO')).toBe(true)
  })
  it('un alumne no pot desar en la recollida d’un altre curs (criteri 2)', () => {
    const pau = sess('pau.serra@ramonpont.cat')
    expect(() => api.saveDraft(pau, 'C-2ESO-1T', {})).toThrow()
  })
  it('l’esborrany es conserva i el lliurament exigeix les obligatòries (criteri 7)', () => {
    const marc = sess('marc.vidal@ramonpont.cat')
    api.saveDraft(marc, 'C-2ESO-1T', { 'eso-t1': '3' })
    expect(() => api.submitResponse(marc, 'C-2ESO-1T', { 'eso-t1': '3' })).toThrow()
  })
  it('un alumne no pot fer accions d’administració', () => {
    const marc = sess('marc.vidal@ramonpont.cat')
    expect(() => api.publishTemplate(marc, 'tpl-eso-v1', 'x')).toThrow()
    expect(() => api.addStaff(marc, 'a@ramonpont.cat', 'A', 'admin', [])).toThrow()
  })
  it('una versió publicada no es pot modificar (criteri 4)', () => {
    const admin = sess('admin.demo@ramonpont.cat')
    expect(() => api.saveTemplateDraft(admin, { ...INITIAL_TEMPLATES[2], name: 'canvi' })).toThrow()
    const d = api.newDraftFrom(admin, 'tpl-eso-v1')
    expect(d.version).toBe(2)
    expect(d.status).toBe('draft')
  })
  it('no es pot donar accés a un compte de fora del domini', () => {
    const admin = sess('admin.demo@ramonpont.cat')
    expect(() => api.addStaff(admin, 'algu@gmail.com', 'X', 'teacher', [])).toThrow()
  })
})

describe('importació CSV', () => {
  it('llegeix punt i coma i cometes', () => {
    expect(parseCsv('a;b\n"x;1";"di ""hola"""')).toEqual([['a', 'b'], ['x;1', 'di "hola"']])
  })
  it('normalitza els cursos i no endevina els ambigus (criteri 10)', () => {
    expect(normalizeGrade('1r.ESO')).toBe('1ESO')
    expect(normalizeGrade('Primer d’ESO')).toBe('1ESO')
    expect(normalizeGrade('5è de primària')).toBe('5EP')
    expect(normalizeGrade('3r EP')).toBe('3EP')
    expect(normalizeGrade('Tercer')).toBeNull()
    expect(normalizeGrade('6è ESO')).toBeNull()
  })
})
