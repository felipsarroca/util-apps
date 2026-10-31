// Importació de cens en CSV, amb detecció flexible de capçaleres i de cursos.

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
export interface GuardianImport { rows: GuardianRow[]; issues: { line: number; msg: string }[] }

const EMAIL = /^[^\s@;,]+@[^\s@;,]+\.[a-z]{2,}$/i

/**
 * Identificador (o correu) de l'alumne i els correus de la família. Serveixen els dos formats habituals:
 * una fila per responsable (nom_responsable;correu_responsable) o una fila per alumne amb diverses columnes
 * de correu (correu_familia_1;correu_familia_2…), i una cel·la pot portar més d'un correu. Els errors no s'apliquen.
 */
export function parseGuardiansCsv(text: string, students: Student[]): GuardianImport {
  const [header = [], ...data] = parseCsv(text)
  const h = header.map(norm)
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
