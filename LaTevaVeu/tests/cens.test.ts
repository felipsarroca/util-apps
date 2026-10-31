// Cens de l'alumnat: accions en bloc, curs nou i correus de les famílies de tots els cursos.
import { describe, expect, it } from 'vitest'
import { nextGrade, nextYear } from '../src/domain/catalog'
import { parseGuardiansCsv } from '../src/domain/csv'
import type { Session } from '../src/domain/types'

const mem = new Map<string, string>()
globalThis.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 } as Storage

const api = await import('../src/data/api')
const login = (email: string) => api.resolveSession(email) as Session
const ADMIN = 'admin.demo@ramonpont.cat'

describe('cursos i anys', () => {
  it('ordre dels cursos i curs escolar següent', () => {
    expect(nextGrade('3EP')).toBe('4EP')
    expect(nextGrade('6EP')).toBe('1ESO')
    expect(nextGrade('4ESO')).toBeNull()
    expect(nextYear('2026-2027')).toBe('2027-2028')
    expect(() => nextYear('2026')).toThrow()
  })
})

describe('accions en bloc', () => {
  it('mou diversos alumnes de curs i els treu les optatives', () => {
    api.resetDemo()
    const [a, b] = api.snapshot().students.filter((x) => x.gradeId === '2ESO')
    expect(() => api.moveStudents(login('tutoria.2eso@ramonpont.cat'), [a.id], '3ESO', 'A')).toThrow()
    expect(() => api.moveStudents(login(ADMIN), [a.id], '3ESO', 'Z')).toThrow()
    const group = api.snapshot().classGroups['3ESO'][0]
    expect(api.moveStudents(login(ADMIN), [a.id, b.id], '3ESO', group)).toBe(2)
    const after = api.snapshot().students.filter((x) => [a.id, b.id].includes(x.id))
    expect(after.map((x) => [x.gradeId, x.group, x.electives.length])).toEqual([['3ESO', group, 0], ['3ESO', group, 0]])
  })

  it('dona de baixa diversos alumnes i ho deixa al registre', () => {
    api.resetDemo()
    const ids = api.snapshot().students.slice(0, 3).map((x) => x.id)
    expect(() => api.removeStudents(login('tutoria.2eso@ramonpont.cat'), ids)).toThrow()
    expect(api.removeStudents(login(ADMIN), ids)).toBe(3)
    expect(api.snapshot().students.some((x) => ids.includes(x.id))).toBe(false)
    expect(api.snapshot().audit[0].action).toBe('Baixes')
  })
})

describe('curs nou (demostració)', () => {
  it('passa tothom al curs següent i el de 4t d’ESO surt', () => {
    api.resetDemo()
    const before = api.snapshot()
    const r = api.startNewYearLocal(login(ADMIN))
    const after = api.snapshot()
    expect(r.year).toBe(nextYear(before.year))
    expect(after.year).toBe(r.year)
    expect(r.graduated).toBe(before.students.filter((x) => x.gradeId === '4ESO').length)
    expect(after.students.some((x) => x.gradeId === '3EP')).toBe(false)
    expect(after.campaigns).toEqual([])
    const one = before.students.find((x) => x.gradeId === '2ESO')!
    expect(after.students.find((x) => x.id === one.id)).toMatchObject({ gradeId: '3ESO', group: one.group })
  })
})

describe('correus de les famílies en un sol fitxer', () => {
  it('accepta una fila per alumne amb diverses columnes de correu, de tots els cursos', () => {
    api.resetDemo()
    const st = api.snapshot().students
    const a = st.find((x) => x.gradeId === '3EP')!
    const b = st.find((x) => x.gradeId === '4ESO')!
    const csv = [
      'correu_alumne;correu_familia_1;correu_familia_2',
      `${a.email};mare.a@exemple.cat;pare.a@exemple.cat`,
      `${b.email};"familia.b@exemple.cat tutor.b@exemple.cat";`,
      `${a.email.toUpperCase()};mare.a@exemple.cat;`,
      'ningu@ramonpont.cat;x@exemple.cat;',
    ].join('\n')
    const r = parseGuardiansCsv(csv, st)
    expect(r.rows.map((x) => [x.studentId, x.guardian.email])).toEqual([
      [a.id, 'mare.a@exemple.cat'],
      [a.id, 'pare.a@exemple.cat'],
      [b.id, 'familia.b@exemple.cat'],
      [b.id, 'tutor.b@exemple.cat'],
    ])
    expect(r.issues.map((x) => x.line)).toEqual([4, 5])
    expect(api.importGuardians(login(ADMIN), r.rows)).toBe(2)
  })
})

describe('matèries', () => {
  it('crea una matèria nova, l’afegeix al curs i en canvia el nom', () => {
    api.resetDemo()
    expect(() => api.saveSubject(login('tutoria.2eso@ramonpont.cat'), { short: 'Robòtica', long: 'Robòtica' })).toThrow()
    const id = api.saveSubject(login(ADMIN), { short: 'Robòtica', long: 'Robòtica i programació', gradeId: '3ESO', optional: true })
    expect(id).toBe('ROBOTICA')
    const s = api.snapshot()
    expect(s.subjects.find((x) => x.id === id)).toMatchObject({ short: 'Robòtica', long: 'Robòtica i programació', active: true })
    expect(s.gradeSubjects.find((x) => x.subjectId === id)).toMatchObject({ gradeId: '3ESO', optional: true, active: true })
    // Sense repetir noms, i el nom es pot canviar.
    expect(() => api.saveSubject(login(ADMIN), { short: 'robòtica', long: '' })).toThrow()
    expect(api.saveSubject(login(ADMIN), { id: 'MAT', short: 'Mates', long: 'Matemàtiques' })).toBe('MAT')
    expect(api.snapshot().subjects.find((x) => x.id === 'MAT')!.short).toBe('Mates')
    expect(() => api.setGradeSubject(login(ADMIN), { gradeId: '3ESO', subjectId: 'NOEXISTEIX', order: 1, optional: false, active: true })).toThrow()
  })
})
