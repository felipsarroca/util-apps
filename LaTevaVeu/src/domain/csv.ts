// Importació de cens en CSV, amb detecció flexible de capçaleres i de cursos.

import { gradeShort } from './catalog'
import type { ClassGroups } from './groups'
import type { GradeId, GradeSubject, Guardian, Student, Subject } from './types'

export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '')
  const first = clean.split(/\r?\n/)[0] ?? ''
  const delim = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : first.includes('\t') ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (q) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === delim) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim())) rows.push(row)
  return rows.map((r) => r.map((x) => x.trim()))
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const ORD: Record<string, string> = { primer: '1', segon: '2', tercer: '3', quart: '4', cinque: '5', sise: '6', '1r': '1', '2n': '2', '3r': '3', '4t': '4', '5e': '5', '6e': '6' }

/** «1r ESO», «1r.ESO», «Primer d'ESO», «3r de primària», «5è EP» → id del curs. */
export function normalizeGrade(raw: string): GradeId | null {
  // Codis compactes, com els de l'aplicació: 2ESO, 3EP.
  const code = /^\s*([1-6])(eso|ep)\s*$/i.exec(raw)
  if (code) return normalizeGrade(`${code[1]} ${code[2]}`)
  const n = norm(raw)
  const eso = /\beso\b/.test(n)
  const prim = /\b(ep|primaria|prim)\b/.test(n)
  let num: string | undefined
  for (const tok of n.split(' ')) {
    if (ORD[tok]) { num = ORD[tok]; break }
    if (/^[1-6]$/.test(tok)) { num = tok; break }
    const m = tok.match(/^([1-6])(r|n|t|e|o)?$/)
    if (m) { num = m[1]; break }
  }
  if (!num) return null
  if (eso) return +num <= 4 ? (`${num}ESO` as GradeId) : null
  if (prim) return +num >= 3 ? (`${num}EP` as GradeId) : null
  // Sense etapa: només és inequívoc quan el número existeix en una sola etapa (3r i 4t són ambigus).
  if (+num <= 2) return `${num}ESO` as GradeId
  if (+num >= 5) return `${num}EP` as GradeId
  return null
}

export interface ColumnMap { id: number; name: number; surname: number; email: number; grade: number; group: number }

export function detectColumns(header: string[]): ColumnMap {
  const h = header.map(norm)
  const find = (...keys: string[]) => h.findIndex((x) => keys.some((k) => x === k || x.includes(k)))
  return {
    id: find('id alumne', 'id', 'identificador', 'ralc', 'codi'),
    email: find('correu', 'email', 'mail'),
    surname: find('cognoms', 'cognom'),
    name: h.findIndex((x) => (x === 'nom' || x.startsWith('nom ')) && !x.includes('responsable')),
    grade: find('curs', 'nivell'),
    group: find('grup', 'classe'),
  }
}

// ---------- Assignacions docents ----------

export interface AssignmentRow { line: number; gradeId: GradeId; group: string; subjectId: string; teacherEmail: string }
export interface AssignmentImport { rows: AssignmentRow[]; issues: { line: number; msg: string }[]; empty: number }

/**
 * Importació de la plantilla d'assignacions (curs, grup, codi_materia, correu_docent).
 * Les files sense correu es compten com a pendents; les que tenen errors no s'apliquen.
 */
export function parseAssignmentsCsv(
  text: string,
  ctx: { gradeSubjects: GradeSubject[]; subjects: Subject[]; staffEmails: string[]; classGroups?: ClassGroups },
): AssignmentImport {
  const [header = [], ...data] = parseCsv(text)
  const h = header.map(norm)
  const col = (...keys: string[]) => h.findIndex((x) => keys.some((k) => x === k || x.includes(k)))
  const c = { grade: col('curs', 'nivell'), group: col('grup'), code: col('codi materia', 'codi'), subject: h.findIndex((x) => x === 'materia'), email: col('correu docent', 'correu', 'email') }
  const out: AssignmentImport = { rows: [], issues: [], empty: 0 }
  if (c.grade < 0 || c.email < 0 || (c.code < 0 && c.subject < 0)) {
    out.issues.push({ line: 1, msg: 'Falten columnes: calen curs, codi_materia (o materia) i correu_docent; el grup només cal si el curs en té més d’un.' })
    return out
  }
  const seen = new Set<string>()
  data.forEach((r, i) => {
    const line = i + 2
    const email = (r[c.email] ?? '').toLowerCase()
    if (!email) return void out.empty++
    const gradeId = normalizeGrade(r[c.grade] ?? '')
    if (!gradeId) return void out.issues.push({ line, msg: `Curs no reconegut: «${r[c.grade] ?? ''}».` })
    // Sense columna o sense valor, el grup és l'únic (o el primer) del curs.
    const raw0 = (c.group >= 0 ? r[c.group] ?? '' : '').trim()
    const configured = ctx.classGroups?.[gradeId]
    const group = configured ? (raw0 ? configured.find((g) => g.toLowerCase() === raw0.toLowerCase()) : configured[0]) : raw0.toUpperCase() || 'A'
    if (!group) return void out.issues.push({ line, msg: `El grup «${raw0}» no existeix en aquest curs. Crea’l primer a Centre › Grups.` })
    const raw = c.code >= 0 && r[c.code] ? r[c.code] : (r[c.subject] ?? '')
    const subj = ctx.subjects.find((s) => s.id.toLowerCase() === raw.toLowerCase() || norm(s.long) === norm(raw) || norm(s.short) === norm(raw))
    if (!subj) return void out.issues.push({ line, msg: `Matèria desconeguda: «${raw}». Crea-la primer a Matèries.` })
    if (!ctx.gradeSubjects.some((g) => g.gradeId === gradeId && g.subjectId === subj.id && g.active))
      return void out.issues.push({ line, msg: `${subj.short} no està activa en aquest curs. Activa-la primer a Matèries.` })
    if (!ctx.staffEmails.includes(email)) return void out.issues.push({ line, msg: `${email} no té accés a l’aplicació. Dona-li accés primer.` })
    const key = `${gradeId}|${group}|${subj.id}`
    if (seen.has(key)) return void out.issues.push({ line, msg: `${subj.short} de ${gradeId} ${group} surt repetida: només s’aplica la primera.` })
    seen.add(key)
    out.rows.push({ line, gradeId, group, subjectId: subj.id, teacherEmail: email })
  })
  return out
}

// ---------- Correus de les famílies ----------

export interface GuardianRow { line: number; studentId: string; studentName: string; guardian: Guardian }
/** Una incidència pot portar una proposta (un nom de Clickedu semblant al d'un alumne del cens) que es pot acceptar. */
export interface GuardianImport { rows: GuardianRow[]; issues: { line: number; msg: string; proposal?: GuardianRow }[] }

const EMAIL = /^[^\s@;,]+@[^\s@;,]+\.[a-z]{2,}$/i

/**
 * Identificador (o correu) de l'alumne i els correus de la família. Serveixen els dos formats habituals:
 * una fila per responsable (nom_responsable;correu_responsable) o una fila per alumne amb diverses columnes
 * de correu (correu_familia_1;correu_familia_2…), i una cel·la pot portar més d'un correu. Els errors no s'apliquen.
 */
export function parseGuardiansCsv(text: string, students: Student[]): GuardianImport {
  const [header = [], ...data] = parseCsv(text)
  const h = header.map(norm)
  // Llistat de Clickedu: sense capçalera (la primera fila ja porta correus) o amb la columna «Nom alumne».
  const clickedu = header.some((x) => x.includes('@')) || (h.some((x) => x.includes('alumn') && !x.includes('correu') && !x.includes('mail')) && !h.some((x) => /^(id|id alumne|identificador|ralc)$/.test(x)))
  if (clickedu) return parseClickeduCsv(parseCsv(text), students)
  const isStudent = (x: string) => x.includes('alumn')
  const all = (test: (x: string) => boolean) => h.flatMap((x, i) => (test(x) ? [i] : []))
  const c = {
    id: h.findIndex((x) => ['id alumne', 'identificador', 'ralc', 'id'].some((k) => x === k || x.includes(k))),
    studentEmail: h.findIndex((x) => (x.includes('correu') || x.includes('mail')) && isStudent(x)),
    names: all((x) => x.includes('nom') && /respons|famil|tutor|pare|mare/.test(x)),
    emails: all((x) => (x.includes('correu') || x.includes('mail')) && !isStudent(x)),
  }
  const out: GuardianImport = { rows: [], issues: [] }
  if ((c.id < 0 && c.studentEmail < 0) || !c.emails.length) {
    out.issues.push({ line: 1, msg: 'Falten columnes: calen id_alumne (o correu_alumne) i almenys una columna de correu de la família.' })
    return out
  }
  const seen = new Set<string>()
  data.forEach((r, i) => {
    const line = i + 2
    if (r.every((x) => !x.trim())) return
    const id = c.id >= 0 ? (r[c.id] ?? '').trim() : ''
    const se = c.studentEmail >= 0 ? (r[c.studentEmail] ?? '').trim().toLowerCase() : ''
    const st = students.find((x) => (id && x.id === id) || (se && x.email === se))
    if (!st) return void out.issues.push({ line, msg: `No hi ha cap alumne al cens amb ${id ? `l’identificador ${id}` : `el correu ${se || '(buit)'}`}.` })
    const found = c.emails.flatMap((col, k) =>
      (r[col] ?? '').split(/[\s;,/]+/).filter(Boolean).map((email) => ({ email: email.toLowerCase(), name: (r[c.names[k] ?? c.names[0]] ?? '').trim() || 'Família' })),
    )
    if (!found.length) return void out.issues.push({ line, msg: `${st.name} ${st.surname}: no hi ha cap correu de la família.` })
    for (const { email, name } of found) {
      if (!EMAIL.test(email)) {
        out.issues.push({ line, msg: `Correu no vàlid: «${email}».` })
        continue
      }
      if (email === st.email) {
        out.issues.push({ line, msg: 'És el correu de l’alumne, no el de la família.' })
        continue
      }
      const key = `${st.id}|${email}`
      if (seen.has(key)) {
        out.issues.push({ line, msg: `${email} surt repetit per al mateix alumne.` })
        continue
      }
      seen.add(key)
      out.rows.push({ line, studentId: st.id, studentName: `${st.name} ${st.surname}`, guardian: { name, email, validated: true } })
    }
  })
  return out
}

// ---------- Llistat de pares i mares de Clickedu ----------

/** Nom com a conjunt de paraules sense accents: «Ben Hamed, Tasnim» i «Tasnim Ben Hamed» són el mateix. */
const nameKey = (s: string) => norm(s).split(' ').filter(Boolean).sort().join(' ')

function distance(a: string, b: string) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const old = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = old
    }
  }
  return prev[b.length]
}

/** «Ben Hamed, Adil» → «Adil Ben Hamed». */
const naturalName = (s: string) => {
  const [last, first] = s.split(',').map((x) => x.trim())
  return first ? `${first} ${last}` : s.trim()
}

/**
 * Alumne del cens que correspon a un nom escrit a Clickedu, dins del seu curs. Primer, el mateix nom (en qualsevol
 * ordre i sense accents); després, un nom que conté l'altre (un cognom de més o de menys); i, finalment, el més
 * semblant si la diferència és petita (una lletra) i no n'hi ha cap altre d'igual de proper.
 */
export function matchStudent(written: string, candidates: Student[]): { student?: Student; suggestion?: Student } {
  const key = nameKey(written)
  if (!key) return {}
  const keys = candidates.map((st) => ({ st, key: nameKey(`${st.name} ${st.surname}`) }))
  const exact = keys.filter((x) => x.key === key)
  if (exact.length === 1) return { student: exact[0].st }
  if (exact.length > 1) return {}
  const words = key.split(' ')
  // Cada paraula d'un nom és a l'altre, o n'és la inicial («Rita A.» i «Rita Amina»).
  const fits = (short: string[], long: string[]) => {
    const rest = [...long]
    return short.every((t) => {
      const i = rest.indexOf(t) >= 0 ? rest.indexOf(t) : t.length === 1 ? rest.findIndex((x) => x.startsWith(t)) : -1
      return i >= 0 && !!rest.splice(i, 1).length
    })
  }
  const contains = keys.filter((x) => {
    const w = x.key.split(' ')
    return fits(w, words) || fits(words, w)
  })
  if (contains.length === 1) return { student: contains[0].st }
  const ranked = keys.map((x) => ({ ...x, d: distance(x.key, key) })).sort((a, b) => a.d - b.d)
  const [best, next] = ranked
  if (best && best.d <= Math.max(2, Math.floor(key.length / 12)) && (!next || next.d > best.d)) return { student: best.st }
  // Proposta només si comparteixen almenys dues paraules (normalment, els cognoms).
  // Sense partícules («el», «de», «la»): no identifiquen ningú.
  const shared = (k: string) => new Set(k.split(' ').filter((t) => t.length > 2 && words.includes(t))).size
  const proposal = keys.filter((x) => shared(x.key) >= 2).sort((a, b) => shared(b.key) - shared(a.key))
  return { suggestion: proposal.length && (proposal.length === 1 || shared(proposal[0].key) > shared(proposal[1].key)) ? proposal[0].st : undefined }
}

/**
 * Llistat de pares i mares exportat de Clickedu (Administració › Gestió d'usuaris › Llistats). Columnes habituals:
 * número, curs («Tercer de Primària»), nom de l'alumne, nom i cognoms del responsable i correu, amb capçalera o
 * sense. No porta el correu ni l'identificador de l'alumne: es busca pel nom dins del seu curs.
 */
function parseClickeduCsv(rows: string[][], students: Student[]): GuardianImport {
  const out: GuardianImport = { rows: [], issues: [] }
  const hasHeader = !rows[0]?.some((x) => x.includes('@'))
  const data = hasHeader ? rows.slice(1) : rows
  const width = Math.max(0, ...data.map((r) => r.length))
  const share = (col: number, test: (v: string) => boolean) => {
    const vals = data.map((r) => r[col] ?? '').filter(Boolean)
    return vals.length ? vals.filter(test).length / vals.length : 0
  }
  let course = -1, student = -1, guardian = -1, email = -1
  if (hasHeader) {
    const h = rows[0].map(norm)
    course = h.findIndex((x) => /^(curs|classe|nivell|grup)( alumne)?$/.test(x))
    student = h.findIndex((x) => x.includes('alumn'))
    guardian = h.findIndex((x, i) => i !== student && (x === 'nom i cognoms' || /respons|pare|mare|tutor|famil/.test(x)))
    email = h.findIndex((x) => x.includes('correu') || x.includes('mail'))
  }
  const cols = [...Array(width).keys()]
  if (email < 0) email = cols.find((c) => share(c, (v) => v.includes('@')) > 0.5) ?? -1
  if (course < 0) course = cols.find((c) => c !== email && share(c, (v) => !!normalizeGrade(v)) > 0.8) ?? -1
  if (student < 0 || guardian < 0) {
    // Les dues columnes de noms: la de l'alumne és la que coincideix més amb el cens.
    const names = cols.filter((c) => c !== email && c !== course && share(c, (v) => /[a-z]{2}/i.test(v) && !/^\d{4}-\d{4}$/.test(v)) > 0.8)
    const census = new Set(students.map((x) => nameKey(`${x.name} ${x.surname}`)))
    const hits = (c: number) => share(c, (v) => census.has(nameKey(v)))
    if (student < 0) student = [...names].sort((a, b) => hits(b) - hits(a))[0] ?? -1
    if (guardian < 0) guardian = names.find((c) => c !== student) ?? -1
  }
  if (student < 0 || email < 0) {
    out.issues.push({ line: 1, msg: 'No es troben les columnes del nom de l’alumne i del correu. A Clickedu, marca Nom alumne, Nom i cognoms i Correu electrònic.' })
    return out
  }
  const seen = new Set<string>()
  data.forEach((r, i) => {
    const line = i + (hasHeader ? 2 : 1)
    const written = r[student] ?? ''
    if (!written.trim()) return
    const grade = course >= 0 ? normalizeGrade(r[course] ?? '') : null
    const pool = grade ? students.filter((x) => x.gradeId === grade) : students
    const { student: found, suggestion } = matchStudent(written, pool)
    const mail = (r[email] ?? '').trim().toLowerCase()
    const name = (guardian >= 0 ? naturalName(r[guardian] ?? '') : '') || 'Família'
    if (!found) {
      const where = grade ? ` a ${gradeShort(grade)}` : ''
      const k = suggestion ? `${suggestion.id}|${mail}` : ''
      // El mateix responsable repetit en una altra fila: ja surt a la primera.
      if (k && seen.has(k)) return
      const proposal = suggestion && EMAIL.test(mail) ? { line, studentId: suggestion.id, studentName: `${suggestion.name} ${suggestion.surname}`, guardian: { name, email: mail, validated: true } } : undefined
      if (proposal) seen.add(k)
      return void out.issues.push({ line, msg: `No es troba «${written}»${where} al cens${suggestion ? `: potser és ${suggestion.name} ${suggestion.surname}` : ''}.`, proposal })
    }
    const st = found
    if (!mail) return void out.issues.push({ line, msg: `${st.name} ${st.surname}: la família no té correu a Clickedu.` })
    if (!EMAIL.test(mail)) return void out.issues.push({ line, msg: `Correu no vàlid: «${mail}».` })
    const k = `${st.id}|${mail}`
    if (seen.has(k)) return
    seen.add(k)
    out.rows.push({ line, studentId: st.id, studentName: `${st.name} ${st.surname}`, guardian: { name, email: mail, validated: true } })
  })
  return out
}
