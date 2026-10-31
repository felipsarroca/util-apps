// Dades FICTÍCIES per al mode de demostració. Cap nom ni correu correspon a persones reals.

import { GRADES, SUBJECTS, initialGradeSubjects } from '../domain/catalog'
import { buildSteps, keyOf, requiredKeys, subjectsForStudent } from '../domain/engine'
import { flagComment, stageOfGrade, teachersForStudent } from '../domain/feedback'
import { FEEDBACK_SCALES, INITIAL_FEEDBACK_FORMS } from '../domain/feedbackForms'
import { INITIAL_SCALES, INITIAL_TEMPLATES } from '../domain/templates'
import type {
  Answers, AuditEntry, Campaign, FeedbackAnswer, FeedbackCampaign, FeedbackComment, FeedbackDraft, FeedbackForm, GradeId, GradeSubject, Modules,
  Participation, Scale, SelfAssessment, StaffMember, StageId, Student, StudentResponse, Subject, TeachingAssignment, TemplateVersion,
} from '../domain/types'

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
  modules: Modules
  assignments: TeachingAssignment[]
  feedbackForms: FeedbackForm[]
  feedbackCampaigns: FeedbackCampaign[]
  feedbackDrafts: FeedbackDraft[]
  participation: Participation[]
  feedbackAnswers: FeedbackAnswer[]
  feedbackComments: FeedbackComment[]
  selfAssessments: SelfAssessment[]
}

export const DEMO_VERSION = 6

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
  // 18 alumnes per grup; 2n B en té 12 per mostrar com s'amaguen els grups per sota del llindar de 15.
  const size = (g: GradeId, group: string) => (g === '2ESO' && group === 'B' ? 12 : 18)
  let n = 0
  const used = new Set<string>()
  for (const g of GRADES) {
    for (const group of groupsByGrade[g.id]) {
      for (let i = 0; i < size(g.id, group); i++) {
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

  const staff = initialStaff()
  const assignments = initialAssignments(gradeSubjects)
  const fb = feedbackDemo(r, students, staff, assignments, gradeSubjects)

  return {
    version: DEMO_VERSION, year, subjects: SUBJECTS.map((s) => ({ ...s })), gradeSubjects, scales: [...INITIAL_SCALES, ...FEEDBACK_SCALES], templates: INITIAL_TEMPLATES,
    students, staff, campaigns, responses,
    audit: [{ at: now, actor: 'sistema', action: 'Inicialització', detail: 'Dades fictícies de demostració carregades.' }],
    modules: { emMiro: true, etVeig: true },
    assignments,
    feedbackForms: INITIAL_FEEDBACK_FORMS,
    ...fb,
  }
}

// ---------- Professorat i assignacions (fictici) ----------

const T = (user: string, name: string, groups: string[] = []): StaffMember => ({ email: `${user}@ramonpont.cat`, name, role: 'teacher', groups })

function initialStaff(): StaffMember[] {
  return [
    { email: 'admin.demo@ramonpont.cat', name: 'Administració (demo)', role: 'admin', groups: [] },
    { email: 'direccio.demo@ramonpont.cat', name: 'Montserrat Badia (direcció)', role: 'admin', groups: [], direction: true },
    T('anna.vila', 'Anna Vila', ['3EP-A']),
    T('jordi.mas', 'Jordi Mas', ['4EP-A']),
    T('tutoria.5ep', 'Laura Ferrer', ['5EP-A']),
    T('pere.costa', 'Pere Costa', ['6EP-A']),
    T('emma.soler', 'Emma Soler'),
    T('sergi.prat', 'Sergi Prat'),
    T('rosa.bosch', 'Rosa Bosch'),
    T('tutoria.2eso', 'Marta Riera', ['2ESO-A', '2ESO-B']),
    T('xavier.duran', 'Xavier Duran'),
    T('carme.sala', 'Carme Sala'),
    T('david.coll', 'David Coll'),
    T('helena.roca', 'Helena Roca'),
    T('albert.pujol', 'Albert Pujol'),
    T('nuria.casals', 'Núria Casals'),
    T('lluis.font', 'Lluís Font'),
    T('jaume.valls', 'Jaume Valls'),
  ]
}

const TUTOR: Partial<Record<GradeId, string>> = { '3EP': 'anna.vila', '4EP': 'jordi.mas', '5EP': 'tutoria.5ep', '6EP': 'pere.costa' }
const PRIMARY_SPECIALIST: Record<string, string> = { ANG: 'emma.soler', EF: 'sergi.prat', REL: 'rosa.bosch' }
const ESO_BY_SUBJECT: Record<string, string> = {
  MAT: 'tutoria.2eso', CAT: 'xavier.duran', CAST: 'carme.sala', ANG: 'david.coll', SOC: 'helena.roca', ECO: 'helena.roca', REC: 'helena.roca',
  BIO: 'albert.pujol', FQ: 'albert.pujol', TEC: 'nuria.casals', EPVA: 'nuria.casals', MUS: 'nuria.casals',
  FRA: 'lluis.font', VAL: 'lluis.font', CLA: 'lluis.font', LLA: 'jaume.valls', EF: 'sergi.prat', REL: 'rosa.bosch',
}
export const DEMO_GROUPS: Record<GradeId, string[]> = { '3EP': ['A'], '4EP': ['A'], '5EP': ['A'], '6EP': ['A'], '1ESO': ['A'], '2ESO': ['A', 'B'], '3ESO': ['A'], '4ESO': ['A'] }

/** Qui fa cada matèria: tutors a primària amb especialistes d'anglès, educació física i religió. */
function initialAssignments(gradeSubjects: GradeSubject[]): TeachingAssignment[] {
  const out: TeachingAssignment[] = []
  for (const gs of gradeSubjects) {
    const user = stageOfGrade(gs.gradeId) === 'ESO' ? ESO_BY_SUBJECT[gs.subjectId] : PRIMARY_SPECIALIST[gs.subjectId] ?? TUTOR[gs.gradeId]
    if (!user) continue
    for (const group of DEMO_GROUPS[gs.gradeId]) out.push({ teacherEmail: `${user}@ramonpont.cat`, gradeId: gs.gradeId, group, subjectId: gs.subjectId })
  }
  return out
}

// ---------- Et veig: dues recollides de mostra ----------

const KEEP: Record<StageId, string[]> = {
  CM: ['Els jocs per aprendre', 'Que ens explica contes', 'Que riu amb nosaltres', 'Quan fem experiments', 'Que m’ajuda quan no ho sé fer'],
  CS: ['Explica amb exemples de la vida real', 'Ens deixa treballar en grup', 'És molt pacient quan no ho entenem', 'Les sortides i els projectes', 'Que ens escolta'],
  ESO: [
    'Els exemples de la vida real fan que tot s’entengui millor.', 'Que corregeixi les feines amb comentaris i no només amb una nota.', 'El bon ambient que hi ha a classe.',
    'Que ens deixi preguntar sense fer-nos sentir malament.', 'Els esquemes que fa a la pissarra.', 'Els projectes en grup.', 'Que expliqui què entrarà a l’examen amb temps.',
  ],
}
const IMPROVE: Record<StageId, string[]> = {
  CM: [],
  CS: ['Més temps per acabar les feines', 'Més jocs', 'Que no parli tan ràpid', 'Més activitats a l’ordinador'],
  ESO: [
    'Que expliqui una mica més a poc a poc quan hi ha temari nou.', 'Que ens retorni els exàmens corregits abans.', 'Fer més exercicis a classe abans dels exàmens.',
    'Que hi hagi més ordre quan treballem en grup.', 'Que ens digui amb més temps quan hem de lliurar les feines.', 'Més exemples resolts pas a pas.',
  ],
}
// Comentaris que la moderació ha de marcar (insult, nom propi o dades que identifiquen qui escriu).
const FLAGGED = ['És un pesat quan repeteix les coses.', 'El Biel sempre parla i no deixa sentir l’explicació.', 'Jo sóc la que seu a primera fila i no veig la pissarra.', 'Les classes són horribles alguns dies.']

const stableRng = (seed: string) => {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return rng(h >>> 0)
}

function feedbackDemo(r: () => number, students: Student[], staff: StaffMember[], assignments: TeachingAssignment[], gradeSubjects: GradeSubject[]) {
  const forms = INITIAL_FEEDBACK_FORMS
  const formIds = { CM: 'fb-cm-v1', CS: 'fb-cs-v1', ESO: 'fb-eso-v2' }
  const teachers = [...new Set(assignments.map((a) => a.teacherEmail))]
  const prev: FeedbackCampaign = { id: 'FV-2526-MAIG', year: '2025-2026', label: 'Recollida de maig', stages: ['CM', 'CS', 'ESO'], start: '2026-05-11', end: '2026-05-22', status: 'PUBLICADA', formIds, assignments, teachers }
  const cur: FeedbackCampaign = { id: 'FV-2627-TARDOR', year: '2026-2027', label: 'Recollida de tardor', stages: ['CM', 'CS', 'ESO'], start: '2026-10-26', end: '2026-11-20', status: 'OBERTA', formIds, assignments, teachers }

  // Perfil de cada docent per dimensió (0-1): fa que els informes de mostra siguin variats.
  const profile = (email: string, dim: string, campaignId: string) => {
    let base = 0.5 + stableRng(email + dim)() * 0.4
    if (email.startsWith('tutoria.2eso') && dim === 'aval') base = 0.42 // punt cec per a la demostració
    if (email.startsWith('tutoria.2eso') && (dim === 'sup' || dim === 'act')) base = 0.8 // fortalesa oculta
    return Math.min(0.95, base + (campaignId === cur.id ? 0.03 : 0))
  }
  const names = [...new Set([...students.map((s) => s.name), ...staff.map((s) => s.name.split(' ')[0])])]
  const named = new Set(['pau.serra@ramonpont.cat', 'laia.puig@ramonpont.cat', 'marc.vidal@ramonpont.cat'])

  const participation: Participation[] = []
  const answers: FeedbackAnswer[] = []
  const comments: FeedbackComment[] = []
  const drafts: FeedbackDraft[] = []
  let aid = 0
  let flaggedLeft = FLAGGED.length

  for (const c of [prev, cur]) {
    for (const s of students) {
      if (c === cur && named.has(s.email)) continue // els comptes de prova comencen en blanc
      const roll = r()
      const share = c === prev ? (roll < 0.92 ? 1 : 0) : roll < 0.45 ? 1 : roll < 0.62 ? 0.5 : 0
      if (!share) continue
      const stage = stageOfGrade(s.gradeId)
      const form = forms.find((f) => f.id === c.formIds[stage])!
      const nOpt = stage === 'CM' ? 3 : 4
      const targets = teachersForStudent(s, c.assignments, gradeSubjects, SUBJECTS, staff)
      const half = Math.ceil(targets.length / 2)
      targets.forEach((t, i) => {
        const groupBias = (stableRng(t.email + s.gradeId + s.group)() - 0.5) * 0.16
        const out: Answers = {}
        for (const q of form.items) {
          if (r() < 0.03) out[q.id] = 'NA'
          else out[q.id] = String(Math.min(nOpt, Math.max(1, Math.round((profile(t.email, q.dimensionId, c.id) + groupBias + (r() - 0.5) * 0.7) * (nOpt - 1)) + 1)))
        }
        if (share < 1 && i >= half) {
          if (i === half) drafts.push({ campaignId: c.id, studentId: s.id, teacherEmail: t.email, answers: Object.fromEntries(Object.entries(out).slice(0, 5)), updatedAt: '2026-10-29T10:00:00Z' })
          return
        }
        const day = c === prev ? '2026-05-14' : '2026-10-28'
        participation.push({ campaignId: c.id, studentId: s.id, teacherEmail: t.email, day })
        answers.push({ id: `fa${(++aid).toString(36)}`, campaignId: c.id, formId: form.id, teacherEmail: t.email, stage, gradeId: s.gradeId, group: s.group, day, v: form.items.map((x) => (out[x.id] === 'NA' ? '0' : out[x.id])).join('') })
        for (const q of form.open) {
          const pool = q.id === 'mantenir' ? KEEP[stage] : IMPROVE[stage]
          if (!pool.length || r() > (q.id === 'mantenir' ? 0.3 : 0.25)) continue
          let text = pool[Math.floor(r() * pool.length)]
          if (c === cur && stage === 'ESO' && flaggedLeft > 0 && r() < 0.1) text = FLAGGED[--flaggedLeft]
          const flags = flagComment(text, names)
          comments.push({
            id: `fc${(++aid).toString(36)}`, campaignId: c.id, teacherEmail: t.email, stage, questionId: q.id, original: text, flags,
            status: c === prev ? (flags.length ? 'descartat' : 'acceptat') : 'pendent',
            published: c === prev && !flags.length ? text : undefined,
          })
        }
      })
    }
  }

  // Autoavaluacions: al maig les van fer tots menys un docent (l'informe ha de funcionar igual).
  const selfAssessments: SelfAssessment[] = []
  for (const c of [prev, cur]) {
    for (const t of teachers) {
      if (c === prev && t.startsWith('jordi.mas')) continue
      if (c === cur && !['xavier.duran', 'helena.roca', 'sergi.prat'].some((x) => t.startsWith(x))) continue
      for (const stage of c.stages.filter((st) => c.assignments.some((a) => a.teacherEmail === t && stageOfGrade(a.gradeId) === st))) {
        const form = forms.find((f) => f.id === c.formIds[stage])!
        const nOpt = stage === 'CM' ? 3 : 4
        const rr = stableRng(t + stage + c.id)
        const out: Answers = {}
        for (const q of form.items) {
          let p = profile(t, q.dimensionId, c.id) + (rr() - 0.55) * 0.34
          if (t.startsWith('tutoria.2eso') && q.dimensionId === 'aval') p = 0.9
          if (t.startsWith('tutoria.2eso') && q.dimensionId === 'sup') p = 0.45
          out[q.id] = String(Math.min(nOpt, Math.max(1, Math.round(p * (nOpt - 1)) + 1)))
        }
        const context: Record<string, string[]> = t.startsWith('tutoria.2eso') && stage === 'ESO' ? { '2ESO-B': ['gestio'], '4ESO-A': ['nova'] } : {}
        selfAssessments.push({ campaignId: c.id, teacherEmail: t, stage, answers: out, context, updatedAt: c.start + 'T16:00:00Z', submittedAt: c.start + 'T16:00:00Z' })
      }
    }
  }

  return { feedbackCampaigns: [prev, cur], participation, feedbackAnswers: answers, feedbackComments: comments, feedbackDrafts: drafts, selfAssessments }
}
