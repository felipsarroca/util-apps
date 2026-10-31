// Dades FICTÍCIES per al mode de demostració. Cap nom ni correu correspon a persones reals.

import { GRADES, SUBJECTS, initialGradeSubjects } from '../domain/catalog'
import { buildSteps, keyOf, requiredKeys, subjectsForStudent } from '../domain/engine'
import { INITIAL_SCALES, INITIAL_TEMPLATES } from '../domain/templates'
import type { Answers, AuditEntry, Campaign, GradeId, GradeSubject, Scale, StaffMember, Student, StudentResponse, Subject, TemplateVersion } from '../domain/types'

export interface DemoState {
  version: number
  year: string
  subjects: Subject[]
  gradeSubjects: GradeSubject[]
  scales: Scale[]
  templates: TemplateVersion[]
  students: Student[]
  staff: StaffMember[]
  campaigns: Campaign[]
  responses: StudentResponse[]
  audit: AuditEntry[]
}

export const DEMO_VERSION = 3

const FIRST = ['Pau', 'Laia', 'Marc', 'Júlia', 'Arnau', 'Aina', 'Pol', 'Martina', 'Biel', 'Ona', 'Jan', 'Clàudia', 'Nil', 'Èlia', 'Roc', 'Mariona', 'Iu', 'Abril', 'Quim', 'Noa', 'Àlex', 'Txell', 'Oriol', 'Fatima', 'Yusuf', 'Ainhoa', 'Lucas', 'Mei', 'Hugo', 'Zoe']
const LAST = ['Serra', 'Puig', 'Vidal', 'Soler', 'Ferrer', 'Roca', 'Font', 'Casals', 'Pujol', 'Riera', 'Camps', 'Bosch', 'Mas', 'Sala', 'Prat', 'Valls', 'Coll', 'Duran', 'Badia', 'Costa', 'El Amrani', 'Lin', 'Pérez', 'Torrent']

// Generador pseudoaleatori determinista: la demostració és igual a tots els ordinadors.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '')

const SAMPLE_TEXT: Record<string, string[]> = {
  'cm-r1': ['multiplicar per 3 i per 4 sense mirar la taula', 'escriure un conte amb principi, nus i final', 'fer servir el diccionari'],
  'cm-r2': ['la lletra lligada', 'llegir en veu alta sense pressa', 'les restes portant-ne'],
  'cs-evid': ['El mural dels planetes, perquè vam buscar la informació nosaltres', 'La redacció sobre el meu avi, perquè la vaig revisar dues vegades'],
  'cs-dif': ['Les fraccions em costaven. Vaig demanar ajuda i vaig fer exercicis a casa.', 'Parlar en anglès davant la classe. Vaig assajar amb la meva germana.'],
  'cs-obj': ['Repassar cada dia 10 minuts les taules de multiplicar', 'Llegir mitja hora abans d’anar a dormir', 'Apuntar els deures a l’agenda cada dia'],
  'eso-accio': ['Faré un horari d’estudi setmanal i el penjaré a l’habitació.', 'Preguntaré els dubtes el mateix dia a classe en lloc d’esperar a l’examen.', 'Revisaré les feines abans de lliurar-les fent servir una llista de control.'],
  obs: ['Fer més exercicis a casa', 'Preguntar quan no entengui', 'Repassar el vocabulari cada setmana', 'Llegir l’enunciat amb calma', ''],
}

const LONG_OBS =
  'He de ser més constant. Moltes setmanes deixo la feina per a l’últim dia i després no tinc temps de preguntar els dubtes. ' +
  'Em proposo fer una mica cada dia, demanar ajuda al professor quan una cosa no m’entri i fer esquemes del que hem treballat a classe, perquè quan ho escric amb les meves paraules ho entenc molt millor. ' +
  'També vull participar més: a vegades sé la resposta però no aixeco la mà per vergonya. '

function fakeAnswers(t: TemplateVersion, subjects: Subject[], scales: Scale[], r: () => number, completeness: number, longText: boolean, prevGoal?: string): Answers {
  const answers: Answers = {}
  const steps = buildSteps(t, { stage: t.stage, subjects, previousGoal: prevGoal })
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const allQ = t.sections.flatMap((s) => s.questions)
  for (const step of steps) {
    for (const { key } of requiredKeys(step)) {
      if (r() > completeness) continue
      const [qid, subjectId, part] = key.split('|')
      const qn = allQ.find((x) => x.id === qid)!
      if (qn.type === 'shortText' || qn.type === 'longText') {
        answers[key] = longText && qn.type === 'longText' ? LONG_OBS + LONG_OBS : pick(SAMPLE_TEXT[qid] ?? ['—'])
        continue
      }
      const scaleId = subjectId ? qn.criteria!.find((c) => c.id === part)!.scaleId : qn.scaleId!
      const sc = scales.find((s) => s.id === scaleId)!
      const n = sc.options.length
      // Tendència a valors mitjans-alts, com en les autoavaluacions reals.
      const v = Math.min(n, Math.max(1, Math.round(n * 0.55 + (r() - 0.4) * n * 0.9)))
      answers[key] = sc.allowNA && r() < 0.04 ? 'NA' : String(v)
    }
    if (step.kind === 'subject' && step.question.subjectComment && r() < completeness) {
      const k = keyOf(step.question.id, step.subject.id, 'obs')
      const txt = longText && step.subjectIndex < 3 ? LONG_OBS : pick(SAMPLE_TEXT.obs)
      if (txt) answers[k] = txt
    }
  }
  return answers
}

export function createDemoState(): DemoState {
  const r = rng(20261030)
  const year = '2026-2027'
  const gradeSubjects = initialGradeSubjects()
  const students: Student[] = []
  const groupsByGrade: Record<GradeId, string[]> = {
    '3EP': ['A'], '4EP': ['A'], '5EP': ['A'], '6EP': ['A'], '1ESO': ['A'], '2ESO': ['A', 'B'], '3ESO': ['A'], '4ESO': ['A'],
  }
  let n = 0
  const used = new Set<string>()
  for (const g of GRADES) {
    for (const group of groupsByGrade[g.id]) {
      for (let i = 0; i < 8; i++) {
        let name: string, surname: string, email: string
        do {
          name = FIRST[Math.floor(r() * FIRST.length)]
          surname = `${LAST[Math.floor(r() * LAST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`
          email = `${slug(name)}.${slug(surname.split(' ')[0])}@ramonpont.cat`
        } while (used.has(email))
        used.add(email)
        const optional = gradeSubjects.filter((gs) => gs.gradeId === g.id && gs.optional).map((gs) => gs.subjectId)
        const electives = g.stage === 'ESO' ? optional.filter(() => r() < (g.id === '4ESO' ? 0.45 : 0.4)) : optional.filter(() => r() < 0.3)
        const fam = r()
        students.push({
          id: `ALU${String(++n).padStart(4, '0')}`,
          name,
          surname,
          email,
          gradeId: g.id,
          group,
          electives,
          guardians:
            fam < 0.12
              ? []
              : [
                  { name: `Responsable de ${name}`, email: `familia.${slug(name)}${n}@exemple.cat`, validated: fam > 0.2 },
                  ...(fam > 0.6 ? [{ name: `Segon responsable de ${name}`, email: `familia2.${slug(name)}${n}@exemple.cat`, validated: true }] : []),
                ],
        })
      }
    }
  }

  // Comptes de demostració fàcils de reconèixer (substitueixen el primer alumne d'alguns grups).
  const named: [GradeId, string, string, string, string[]][] = [
    ['3EP', 'Pau', 'Serra Font', 'pau.serra@ramonpont.cat', []],
    ['5EP', 'Laia', 'Puig Roca', 'laia.puig@ramonpont.cat', ['REL']],
    ['2ESO', 'Marc', 'Vidal Soler', 'marc.vidal@ramonpont.cat', ['FRA']],
  ]
  for (const [gradeId, name, surname, email, electives] of named) {
    const s = students.find((x) => x.gradeId === gradeId && x.group === 'A')!
    Object.assign(s, { name, surname, email, electives })
  }

  const templateFor = (gid: GradeId) => {
    const stage = GRADES.find((g) => g.id === gid)!.stage
    return INITIAL_TEMPLATES.find((t) => t.stage === stage)!
  }
  const campaigns: Campaign[] = []
  const responses: StudentResponse[] = []
  const now = '2026-10-30T09:00:00Z'

  for (const g of GRADES) {
    // Preavaluació tancada a cicle superior: proporciona l'objectiu anterior.
    if (g.stage === 'CS') {
      const prev: Campaign = {
        id: `C-${g.id}-PRE`, year, gradeId: g.id, label: 'Preavaluació', templateVersionId: templateFor(g.id).id,
        start: '2026-09-28', end: '2026-10-09', status: 'ARXIVADA', subjectsSnapshot: gradeSubjects.filter((x) => x.gradeId === g.id),
      }
      campaigns.push(prev)
      for (const s of students.filter((x) => x.gradeId === g.id)) {
        const subj = subjectsForStudent(prev.subjectsSnapshot, s, SUBJECTS)
        responses.push({ campaignId: prev.id, studentId: s.id, status: 'VALIDADA', answers: fakeAnswers(templateFor(g.id), subj, INITIAL_SCALES, r, 1, false), updatedAt: '2026-10-08T10:00:00Z', submittedAt: '2026-10-08T10:00:00Z', revision: 1 })
      }
    }
    const c: Campaign = {
      id: `C-${g.id}-1T`, year, gradeId: g.id, label: '1a avaluació', templateVersionId: templateFor(g.id).id,
      start: '2026-10-26', end: '2026-11-13', status: g.id === '4ESO' ? 'TANCADA' : 'OBERTA', subjectsSnapshot: gradeSubjects.filter((x) => x.gradeId === g.id),
    }
    campaigns.push(c)
    for (const s of students.filter((x) => x.gradeId === g.id)) {
      if (named.some((x) => x[3] === s.email)) continue // els comptes de prova comencen en blanc
      const roll = r()
      const status = c.status === 'TANCADA' ? (roll < 0.9 ? 'LLIURADA' : 'NO_INICIADA') : roll < 0.5 ? 'LLIURADA' : roll < 0.75 ? 'EN_CURS' : 'NO_INICIADA'
      if (status === 'NO_INICIADA') continue
      const subj = subjectsForStudent(c.subjectsSnapshot, s, SUBJECTS)
      const prevGoal = responses.find((x) => x.studentId === s.id && x.campaignId.endsWith('PRE'))?.answers['cs-obj']
      const long = s.gradeId === '2ESO' && s.group === 'A' && responses.filter((x) => x.campaignId === c.id).length === 1
      responses.push({
        campaignId: c.id, studentId: s.id, status,
        answers: fakeAnswers(templateFor(g.id), subj, INITIAL_SCALES, r, status === 'LLIURADA' ? 1 : 0.45, long, prevGoal),
        updatedAt: now, submittedAt: status === 'LLIURADA' ? now : undefined, revision: 1,
      })
    }
  }

  const staff: StaffMember[] = [
    { email: 'admin.demo@ramonpont.cat', name: 'Administració (demo)', role: 'admin', groups: [] },
    { email: 'tutoria.2eso@ramonpont.cat', name: 'Tutoria de 2n d’ESO (demo)', role: 'teacher', groups: ['2ESO-A', '2ESO-B'] },
    { email: 'tutoria.5ep@ramonpont.cat', name: 'Tutoria de 5è (demo)', role: 'teacher', groups: ['5EP-A'] },
  ]

  return {
    version: DEMO_VERSION, year, subjects: SUBJECTS.map((s) => ({ ...s })), gradeSubjects, scales: INITIAL_SCALES, templates: INITIAL_TEMPLATES,
    students, staff, campaigns, responses,
    audit: [{ at: now, actor: 'sistema', action: 'Inicialització', detail: 'Dades fictícies de demostració carregades.' }],
  }
}
