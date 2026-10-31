// Proves d'«Et veig» (criteris d'acceptació del pla mestre v2, §10).
import { describe, expect, it } from 'vitest'
import { createDemoState } from '../src/data/seed'
import { buildCenterView, buildTeacherReport, distOf, flagComment, quadrantOf, stableShuffle, teachersForStudent, THRESHOLD } from '../src/domain/feedback'
import { parseAssignmentsCsv } from '../src/domain/csv'
import { INITIAL_FEEDBACK_FORMS, validateFeedbackForm } from '../src/domain/feedbackForms'
import type { Session } from '../src/domain/types'

const mem = new Map<string, string>()
globalThis.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 } as Storage

const api = await import('../src/data/api')
const login = (email: string) => api.resolveSession(email) as Session

describe('Et veig: qui valora qui', () => {
  const st = createDemoState()
  it('cada docent hi surt una sola vegada encara que faci diverses matèries (criteri 1)', () => {
    const pau = st.students.find((x) => x.email === 'pau.serra@ramonpont.cat')!
    const ts = teachersForStudent(pau, st.assignments, st.gradeSubjects, st.subjects, st.staff)
    expect(new Set(ts.map((t) => t.email)).size).toBe(ts.length)
    const tutor = ts.find((t) => t.email === 'anna.vila@ramonpont.cat')!
    expect(tutor.subjects.length).toBeGreaterThan(3)
    // També els especialistes de primària.
    expect(ts.map((t) => t.email)).toContain('emma.soler@ramonpont.cat')
    expect(ts.map((t) => t.email)).toContain('sergi.prat@ramonpont.cat')
  })
  it('les optatives determinen els docents d’optativa', () => {
    const marc = st.students.find((x) => x.email === 'marc.vidal@ramonpont.cat')!
    const ts = teachersForStudent(marc, st.assignments, st.gradeSubjects, st.subjects, st.staff).map((t) => t.email)
    expect(ts).toContain('lluis.font@ramonpont.cat') // francès
    expect(ts).not.toContain('rosa.bosch@ramonpont.cat') // no cursa religió
  })
  it('l’ordre és aleatori per alumne però estable', () => {
    const xs = Array.from({ length: 8 }, (_, i) => i)
    expect(stableShuffle(xs, 'a')).toEqual(stableShuffle(xs, 'a'))
    expect(stableShuffle(xs, 'a')).not.toEqual(stableShuffle(xs, 'b'))
  })
  it('els qüestionaris inicials són vàlids i ESO té com a mínim 15 afirmacions', () => {
    for (const f of INITIAL_FEEDBACK_FORMS) expect(validateFeedbackForm(f)).toEqual([])
    expect(INITIAL_FEEDBACK_FORMS.find((f) => f.stage === 'ESO')!.items.length).toBeGreaterThanOrEqual(15)
  })
})

describe('Et veig: lliurament i confidencialitat', () => {
  it('el lliurament no guarda cap identificador d’alumne i no es pot repetir (criteris 2 i 3)', () => {
    api.resetDemo()
    const marc = login('marc.vidal@ramonpont.cat')
    const home = api.feedbackHome(api.snapshot(), marc)!
    const t = home.targets[0]
    const answers = Object.fromEntries(home.form.items.map((i) => [i.id, '3']))
    expect(() => api.submitFeedback(marc, home.campaign.id, t.email, {})).toThrow()
    api.saveFeedbackDraft(marc, home.campaign.id, t.email, answers)
    api.submitFeedback(marc, home.campaign.id, t.email, { ...answers, mantenir: 'M’agraden els exemples' })
    const s = api.snapshot()
    const json = JSON.stringify(s.feedbackAnswers) + JSON.stringify(s.feedbackComments)
    const studentId = s.students.find((x) => x.email === 'marc.vidal@ramonpont.cat')!.id
    expect(json).not.toContain(studentId)
    expect(json).not.toContain('marc.vidal')
    expect(s.feedbackDrafts.some((d) => d.studentId === studentId && d.teacherEmail === t.email)).toBe(false)
    expect(s.participation.some((p) => p.studentId === studentId && p.teacherEmail === t.email)).toBe(true)
    expect(() => api.submitFeedback(marc, home.campaign.id, t.email, answers)).toThrow()
  })
  it('un alumne no pot valorar un docent que no li fa classe', () => {
    api.resetDemo()
    const marc = login('marc.vidal@ramonpont.cat')
    const home = api.feedbackHome(api.snapshot(), marc)!
    expect(() => api.saveFeedbackDraft(marc, home.campaign.id, 'anna.vila@ramonpont.cat', {})).toThrow()
  })
  it('desactivar «Et veig» l’amaga sense afectar «Em miro» (criteri 8)', () => {
    api.resetDemo()
    const admin = login('admin.demo@ramonpont.cat')
    const marc = login('marc.vidal@ramonpont.cat')
    api.setModules(admin, { etVeig: false })
    expect(api.feedbackHome(api.snapshot(), marc)).toBeNull()
    expect(api.studentHome(api.snapshot(), marc)!.campaign).toBeDefined()
    api.setModules(admin, { etVeig: true, emMiro: false })
    expect(api.feedbackHome(api.snapshot(), marc)).not.toBeNull()
    expect(api.studentHome(api.snapshot(), marc)!.campaign).toBeUndefined()
  })
})

describe('Et veig: informes i permisos', () => {
  it('un docent veu el seu informe; un altre docent i l’administració sense direcció no (criteri 5)', () => {
    api.resetDemo()
    const marta = login('tutoria.2eso@ramonpont.cat')
    const xavier = login('xavier.duran@ramonpont.cat')
    const admin = login('admin.demo@ramonpont.cat')
    const dir = login('direccio.demo@ramonpont.cat')
    expect(api.teacherReport(marta, 'FV-2526-MAIG', marta.email).stages.length).toBeGreaterThan(0)
    expect(() => api.teacherReport(xavier, 'FV-2526-MAIG', marta.email)).toThrow()
    expect(() => api.teacherReport(admin, 'FV-2526-MAIG', marta.email)).toThrow()
    expect(() => api.centerView(admin, 'FV-2526-MAIG')).toThrow()
    expect(api.teacherReport(dir, 'FV-2526-MAIG', marta.email).stages.length).toBeGreaterThan(0)
    expect(api.centerView(dir, 'FV-2526-MAIG').length).toBe(3)
    // Una recollida oberta no mostra resultats a ningú.
    expect(() => api.teacherReport(dir, 'FV-2627-TARDOR', marta.email)).toThrow()
  })
  it('només l’Equip Directiu pot canviar qui en forma part; l’administració sola no s’hi pot afegir', () => {
    api.resetDemo()
    const admin = login('admin.demo@ramonpont.cat')
    const dir = login('direccio.demo@ramonpont.cat')
    expect(() => api.setDirection(admin, admin.email, true)).toThrow()
    expect(() => api.setDirection(admin, 'tutoria.2eso@ramonpont.cat', true)).toThrow()
    expect(() => api.setDirection(dir, dir.email, false)).toThrow()
    expect(() => api.removeStaff(admin, dir.email)).toThrow()
    api.setDirection(dir, admin.email, true)
    expect(api.centerView(login(admin.email), 'FV-2526-MAIG').length).toBe(3)
    // Tornar a donar accés a una persona no li treu la pertinença a l'Equip Directiu.
    api.addStaff(dir, admin.email, 'Administració (demo)', 'admin', [])
    expect(api.isDirection(login(admin.email))).toBe(true)
    api.setDirection(dir, admin.email, false)
    expect(() => api.centerView(login(admin.email), 'FV-2526-MAIG')).toThrow()
  })
  it('aplica el llindar de 15 a docents, grups i comentaris (criteri 4)', () => {
    const st = createDemoState()
    const jaume = buildTeacherReport(st, st.scales, 'FV-2526-MAIG', 'jaume.valls@ramonpont.cat')!
    expect(jaume.stages[0].n).toBeLessThan(THRESHOLD)
    expect(jaume.stages[0].suppressed).toBe(true)
    expect(jaume.stages[0].comments).toEqual([])
    const marta = buildTeacherReport(st, st.scales, 'FV-2526-MAIG', 'tutoria.2eso@ramonpont.cat')!
    const eso = marta.stages.find((x) => x.stage === 'ESO')!
    expect(eso.suppressed).toBe(false)
    const b = eso.groups.find((g) => g.key === '2ESO-B')!
    expect(b.n).toBeLessThan(THRESHOLD)
    expect(b.shown).toBe(false)
    expect(eso.groups.some((g) => g.shown)).toBe(true)
    // Per sota del llindar, les dades s'eliminen de l'informe, no només s'amaguen.
    expect(b.fav).toEqual({})
    expect(jaume.stages[0].items).toEqual([])
    expect(jaume.stages[0].dims.every((d) => d.dist.valid === 0)).toBe(true)
    const centre = buildCenterView(st, st.scales, 'FV-2526-MAIG')
    const jv = centre.find((v) => v.stage === 'ESO')!.teachers.find((t) => t.email === 'jaume.valls@ramonpont.cat')!
    expect(jv.suppressed).toBe(true)
    expect(jv.fav).toEqual({})
  })
  it('l’informe es genera sense autoavaluació (criteri 6) i un docent de dues etapes té dos blocs (criteri 7)', () => {
    const st = createDemoState()
    const jordi = buildTeacherReport(st, st.scales, 'FV-2526-MAIG', 'jordi.mas@ramonpont.cat')!
    expect(jordi.stages[0].self).toBeUndefined()
    expect(jordi.stages[0].dims.every((d) => d.quadrant === undefined)).toBe(true)
    const sergi = buildTeacherReport(st, st.scales, 'FV-2526-MAIG', 'sergi.prat@ramonpont.cat')!
    expect(sergi.stages.map((x) => x.stage)).toEqual(['CM', 'CS', 'ESO'])
  })
  it('cap comentari arriba al docent sense moderar (criteri 10)', () => {
    api.resetDemo()
    const admin = login('admin.demo@ramonpont.cat')
    const dir = login('direccio.demo@ramonpont.cat')
    api.setFeedbackStatus(admin, 'FV-2627-TARDOR', 'TANCADA')
    api.setFeedbackStatus(admin, 'FV-2627-TARDOR', 'MODERACIO')
    expect(() => api.setFeedbackStatus(admin, 'FV-2627-TARDOR', 'INFORMES_GENERATS')).toThrow()
    expect(() => api.acceptUnflagged(admin, 'FV-2627-TARDOR')).toThrow()
    api.acceptUnflagged(dir, 'FV-2627-TARDOR')
    const flagged = api.snapshot().feedbackComments.filter((c) => c.campaignId === 'FV-2627-TARDOR' && c.status === 'pendent')
    expect(flagged.length).toBeGreaterThan(0)
    expect(flagged.every((c) => c.flags.length > 0)).toBe(true)
    for (const c of flagged) api.moderateComment(dir, c.id, 'descartat')
    api.setFeedbackStatus(admin, 'FV-2627-TARDOR', 'INFORMES_GENERATS')
    api.setFeedbackStatus(admin, 'FV-2627-TARDOR', 'PUBLICADA')
    const marta = login('tutoria.2eso@ramonpont.cat')
    const rep = api.teacherReport(marta, 'FV-2627-TARDOR', marta.email)
    const texts = rep.stages.flatMap((s) => s.comments.flatMap((c) => c.texts))
    for (const f of flagged) expect(texts).not.toContain(f.original)
  })
  it('l’autoavaluació docent és per etapa i queda bloquejada després del lliurament', () => {
    api.resetDemo()
    const sergi = login('sergi.prat@ramonpont.cat')
    const marta = login('tutoria.2eso@ramonpont.cat')
    const tasks = api.selfAssessmentTasks(api.snapshot(), marta)
    expect(tasks.map((t) => t.stage)).toEqual(['ESO'])
    const f = tasks[0].form
    const all = Object.fromEntries(f.items.map((i) => [i.id, '4']))
    expect(() => api.saveSelfAssessment(marta, tasks[0].campaign.id, 'ESO', {}, {}, true)).toThrow()
    api.saveSelfAssessment(marta, tasks[0].campaign.id, 'ESO', all, { '2ESO-B': ['gestio'] }, true)
    expect(() => api.saveSelfAssessment(marta, tasks[0].campaign.id, 'ESO', all, {}, true)).toThrow()
    expect(() => api.saveSelfAssessment(sergi, tasks[0].campaign.id, 'ESO', all, {}, false)).toThrow() // ja lliurada per en Sergi a la demo
  })
})

describe('Et veig: càlculs', () => {
  it('distribució, favorables i quadrants', () => {
    const d = distOf(['1', '2', '3', '4', '4', '0'], 4)
    expect(d.valid).toBe(5)
    expect(d.na).toBe(1)
    expect(d.fav).toBeCloseTo(3 / 5)
    expect(quadrantOf(0.8, 0.9)).toBe('confirmades')
    expect(quadrantOf(0.4, 0.9)).toBe('cecs')
    expect(quadrantOf(0.8, 0.3)).toBe('ocultes')
    expect(quadrantOf(0.4, 0.3)).toBe('reptes')
  })
  it('la moderació automàtica marca insults, noms i dades que identifiquen', () => {
    expect(flagComment('És un pesat', [])).not.toEqual([])
    expect(flagComment('El Biel parla molt', ['Biel'])).not.toEqual([])
    expect(flagComment('Jo sóc la que seu davant', [])).not.toEqual([])
    expect(flagComment('Explica molt bé amb exemples', ['Biel'])).toEqual([])
  })
})

describe('Et veig: importació d’assignacions', () => {
  it('valida curs, matèria activa i docent amb accés, i aplica només les files correctes', () => {
    api.resetDemo()
    const admin = login('admin.demo@ramonpont.cat')
    const st = createDemoState()
    const csv = [
      'curs,grup,codi_materia,materia,tipus,correu_docent,nom_docent',
      '3r de primària,A,CAT,Llengua Catalana i Literatura,comuna,emma.soler@ramonpont.cat,',
      "1r d'ESO,A,Matemàtiques,,comuna,TUTORIA.2ESO@ramonpont.cat,",
      '3r de primària,A,LLA,Llatí,optativa,emma.soler@ramonpont.cat,',
      '3r de primària,A,MAT,Matemàtiques,comuna,algu.nou@ramonpont.cat,',
      '9è,A,MAT,Matemàtiques,comuna,emma.soler@ramonpont.cat,',
      '3r de primària,A,ANG,Anglès,comuna,,',
    ].join('\n')
    const r = parseAssignmentsCsv(csv, { gradeSubjects: st.gradeSubjects, subjects: st.subjects, staffEmails: st.staff.map((x) => x.email) })
    expect(r.rows.map((x) => `${x.gradeId}${x.group}:${x.subjectId}:${x.teacherEmail}`)).toEqual(['3EPA:CAT:emma.soler@ramonpont.cat', '1ESOA:MAT:tutoria.2eso@ramonpont.cat'])
    expect(r.issues.map((x) => x.line)).toEqual([4, 5, 6])
    expect(r.empty).toBe(1)
    expect(api.importAssignments(admin, r.rows)).toBe(2)
    expect(api.snapshot().assignments.filter((a) => a.gradeId === '3EP' && a.group === 'A' && a.subjectId === 'CAT')).toEqual([{ gradeId: '3EP', group: 'A', subjectId: 'CAT', teacherEmail: 'emma.soler@ramonpont.cat' }])
    expect(() => api.importAssignments(login('tutoria.2eso@ramonpont.cat'), r.rows)).toThrow()
  })
})
