// Correus de les famílies: importació en CSV i validació. Ho gestiona l'administració o l'Equip Directiu.

import { useState } from 'react'
import { importGuardians, removeGuardian, saveGuardian, setGuardianValidated, useDemoState } from '../data/api'
import { GRADES } from '../domain/catalog'
import { EMAIL, parseGuardiansCsv, type GuardianImport } from '../domain/csv'
import { groupName } from '../domain/groups'
import type { GradeId, Guardian, Session, Student } from '../domain/types'
import { Icon, Modal, useToast } from '../ui/common'
import { ClickeduHelp } from './ClickeduHelp'
import { fullName } from './shared'
import { PageHead } from './StaffApp'

const SAMPLE = [
  'id_alumne;nom_responsable;correu_responsable',
  'ALU0001;Maria Serra;maria.serra@exemple.cat',
  'ALU0001;Joan Font;joan.font@exemple.cat',
  'ALU0002;Rosa Puig;rosa.puig@exemple',
  'ALU9999;Pere Roca;pere.roca@exemple.cat',
].join('\n')

/** Clickedu exporta en ISO-8859-1 (Windows-1252); si el fitxer no és UTF-8 vàlid, es llegeix així perquè els accents surtin bé. */
async function readCsv(f: File): Promise<string> {
  const buf = await f.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder('windows-1252').decode(buf)
  }
}

type Status = '' | 'validat' | 'pendent' | 'sense'

const STATUS: Record<Exclude<Status, ''>, { label: string; note: string }> = {
  validat: { label: 'Amb correu validat', note: 'Rebran l’informe per correu' },
  pendent: { label: 'Pendents de validar', note: 'Tenen correu, però no validat' },
  sense: { label: 'Sense correu', note: 'L’informe es lliurarà en paper' },
}

/** Validat: almenys un correu validat. Pendent: té correus, però cap de validat. */
const statusOf = (st: Student): Exclude<Status, ''> => (st.guardians.some((g) => g.validated) ? 'validat' : st.guardians.length ? 'pendent' : 'sense')

export function FamiliesScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const [grade, setGrade] = useState<GradeId | ''>('')
  const [status, setStatus] = useState<Status>('')
  const [importing, setImporting] = useState(false)
  const [help, setHelp] = useState(false)
  // Responsable que s'edita (original: null quan se n'afegeix un).
  const [editing, setEditing] = useState<{ st: Student; original: Guardian | null } | null>(null)
  const [toast, showToast] = useToast()
  const inGrade = s.students
    .filter((x) => !grade || x.gradeId === grade)
    .sort((a, b) => GRADES.findIndex((g) => g.id === a.gradeId) - GRADES.findIndex((g) => g.id === b.gradeId) || a.group.localeCompare(b.group) || a.surname.localeCompare(b.surname))
  // Els comptadors són del curs triat; l'estat només filtra la taula.
  const count = (k: Exclude<Status, ''>) => inGrade.filter((x) => statusOf(x) === k).length
  const students = inGrade.filter((x) => !status || statusOf(x) === status)
  const act = (fn: () => void, msg: string) => {
    try {
      fn()
      showToast(msg)
    } catch (e) {
      showToast((e as Error).message)
    }
  }
  return (
    <>
      <PageHead title="Famílies" sub="Correus dels responsables de cada alumne, per enviar-los l’informe «Així em veig». Ho gestiona l’administració o l’Equip Directiu.">
        <button className="btn" onClick={() => setHelp(true)}>
          <Icon name="info" /> Com s’obté de Clickedu
        </button>
        <button className="btn primary" onClick={() => setImporting(true)}>
          <Icon name="upload" /> Importa des de CSV
        </button>
      </PageHead>
      <div className="kpis">
        {(Object.keys(STATUS) as Exclude<Status, ''>[]).map((k) => (
          <button
            key={k}
            className={`card kpi kpi-btn ${k}`}
            aria-pressed={status === k}
            title={status === k ? 'Torna a mostrar-los tots' : `Mostra només: ${STATUS[k].label.toLowerCase()}`}
            onClick={() => setStatus(status === k ? '' : k)}
          >
            <span className="l">{STATUS[k].label}</span>
            <span className="v">{count(k)}</span>
            <span className="s">{STATUS[k].note}</span>
          </button>
        ))}
      </div>
      <div className="notice">
        <Icon name="cloud" />
        <div>Només s’envia als correus <b>validats</b>. L’enviament real es farà des del servidor de l’escola, amb una prova prèvia i el registre de cada enviament; mentrestant, els informes es lliuren en PDF o en paper.</div>
      </div>
      <div className="toolbar">
        <label className="field">
          <span>Curs</span>
          <select className="select" value={grade} onChange={(e) => setGrade(e.target.value as GradeId | '')}>
            <option value="">Tots els cursos</option>
            {GRADES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Estat</span>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="">Tots</option>
            {(Object.keys(STATUS) as Exclude<Status, ''>[]).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
          </select>
        </label>
        <span className="muted toolbar-count">{students.length} {students.length === 1 ? 'alumne' : 'alumnes'}</span>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Alumne</th><th>Grup</th><th>Responsables</th></tr></thead>
          <tbody>
            {!students.length && (
              <tr><td colSpan={3} className="muted">Cap alumne amb aquest estat{grade ? ' en aquest curs' : ''}.</td></tr>
            )}
            {students.map((st) => (
              <tr key={st.id}>
                <td className="student-cell"><b>{fullName(st)}</b><small>{st.id}</small></td>
                <td>{groupName(st.gradeId, st.group)}</td>
                <td>
                  <div className="fam-list">
                    {!st.guardians.length && (
                      <div className="fam-row">
                        <span><span className="badge bad">Sense correu</span></span>
                        <AddButton st={st} onAdd={() => setEditing({ st, original: null })} />
                      </div>
                    )}
                    {st.guardians.map((g, i) => (
                      <div key={g.email} className="fam-row">
                        <span><b>{g.name}</b> <span className="muted">{g.email}</span></span>
                        <label className="toggle" title="Correu comprovat amb la família">
                          <input type="checkbox" checked={g.validated} onChange={(e) => act(() => setGuardianValidated(session, st.id, g.email, e.target.checked), e.target.checked ? 'Correu validat.' : 'Correu pendent de validar.')} />
                          {g.validated ? 'Validat' : 'Pendent'}
                        </label>
                        <button className="btn icon small ghost" onClick={() => setEditing({ st, original: g })} aria-label={`Edita ${g.email}`} title="Edita el nom o el correu">
                          <Icon name="edit" />
                        </button>
                        <button className="btn icon small ghost" onClick={() => act(() => removeGuardian(session, st.id, g.email), 'Correu eliminat.')} aria-label={`Treu ${g.email}`} title="Treu aquest correu">
                          <Icon name="trash" />
                        </button>
                        {/* El botó d'afegir va a la darrera fila; a les altres, un espai igual perquè les icones quedin alineades. */}
                        {i === st.guardians.length - 1 ? <AddButton st={st} onAdd={() => setEditing({ st, original: null })} /> : <span className="fam-gap" aria-hidden />}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {importing && <ImportFamilies session={session} onClose={() => setImporting(false)} onHelp={() => setHelp(true)} onDone={(n) => { setImporting(false); showToast(`Correus actualitzats per a ${n} alumnes.`) }} />}
      {help && <ClickeduHelp onClose={() => setHelp(false)} />}
      {editing && (
        <GuardianForm
          student={editing.st}
          original={editing.original}
          onClose={() => setEditing(null)}
          onSave={(g) => {
            saveGuardian(session, editing.st.id, editing.original?.email ?? null, g)
            setEditing(null)
            showToast(editing.original ? 'Responsable actualitzat.' : 'Responsable afegit.')
          }}
        />
      )}
      {toast}
    </>
  )
}

/** Afegir un responsable (com a màxim 4 per alumne). */
function AddButton({ st, onAdd }: { st: Student; onAdd: () => void }) {
  if (st.guardians.length >= 4) return <span className="fam-gap" aria-hidden />
  const label = st.guardians.length ? 'Afegeix un altre responsable' : 'Afegeix un responsable'
  return (
    <button className="btn icon small ghost" onClick={onAdd} aria-label={`${label}: ${fullName(st)}`} title={label}>
      <Icon name="plus" />
    </button>
  )
}

function ImportFamilies({ session, onClose, onDone, onHelp }: { session: Session; onClose: () => void; onDone: (n: number) => void; onHelp: () => void }) {
  const s = useDemoState()
  const [text, setText] = useState('')
  const [result, setResult] = useState<GuardianImport | null>(null)
  // Propostes acceptades (per número de fila): noms de Clickedu semblants al d'un alumne del cens.
  const [accepted, setAccepted] = useState<Set<number>>(new Set())
  const analyse = (t: string) => {
    setResult(parseGuardiansCsv(t, s.students))
    setAccepted(new Set())
  }
  const proposals = result ? result.issues.filter((x) => x.proposal) : []
  const others = result ? result.issues.filter((x) => !x.proposal) : []
  const rows = result ? [...result.rows, ...proposals.filter((x) => accepted.has(x.line)).map((x) => x.proposal!)].sort((a, b) => a.line - b.line) : []
  const students = new Set(rows.map((r) => r.studentId)).size
  const toggle = (line: number, on: boolean) => setAccepted((prev) => {
    const next = new Set(prev)
    if (on) next.add(line)
    else next.delete(line)
    return next
  })
  return (
    <Modal title="Importa els correus de les famílies" onClose={onClose} wide>
      {!result ? (
        <>
          <div className="notice">
            <Icon name="info" />
            <div>
              El més senzill és carregar directament el <b>llistat de pares i mares de Clickedu</b> (<span className="muted">llistat_responsables_….csv</span>), tal com surt de Clickedu: l’app troba cada alumne pel nom i el curs.{' '}
              <button className="btn small ghost" onClick={onHelp}>Com s’obté?</button>
            </div>
          </div>
          <p>
            També s’accepta un fitxer propi. Un sol fitxer per a tots els cursos, de 3r de primària a 4t d’ESO. Cal la columna <b>id_alumne</b> (o <b>correu_alumne</b>) i els correus de la família en un d’aquests formats:
          </p>
          <ul>
            <li>Una fila per responsable: <b>nom_responsable</b> i <b>correu_responsable</b>. Un alumne pot tenir diverses files.</li>
            <li>Una fila per alumne amb diverses columnes: <b>correu_familia_1</b>, <b>correu_familia_2</b>… (o <b>correu_pare</b>, <b>correu_mare</b>). Una cel·la pot portar dos correus separats per un espai.</li>
          </ul>
          <p>
            Separador «;» o «,». Res no es desa fins que confirmis.
          </p>
          <div className="row">
            <label className="btn">
              <Icon name="upload" /> Tria un fitxer
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const t = await readCsv(f); setText(t); analyse(t) } }} />
            </label>
            <button className="btn ghost" onClick={() => setText(SAMPLE)}>Carrega un exemple</button>
          </div>
          <textarea className="textarea" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="També pots enganxar aquí el contingut del CSV" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.85rem' }} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary" disabled={!text.trim()} onClick={() => analyse(text)}>Analitza</button>
          </div>
        </>
      ) : (
        <>
          <div className="row">
            <span className="badge ok">{rows.length} correus correctes ({students} {students === 1 ? 'alumne' : 'alumnes'})</span>
            {proposals.length > 0 && <span className="badge warn">{proposals.length} {proposals.length === 1 ? 'proposta' : 'propostes'} per revisar</span>}
            <span className="badge bad">{others.length} {others.length === 1 ? 'incidència' : 'incidències'}</span>
          </div>
          {proposals.length > 0 && (
            <div className="notice">
              <Icon name="info" />
              <div>
                <p style={{ marginTop: 0 }}>Aquests noms no coincideixen del tot amb el cens. Marca els que siguin el mateix alumne:</p>
                <div className="fam-proposals">
                  {proposals.map((x) => (
                    <label key={x.line} className="check">
                      <input type="checkbox" checked={accepted.has(x.line)} onChange={(e) => toggle(x.line, e.target.checked)} />
                      <span>Fila {x.line}: {x.msg} <span className="muted">({x.proposal!.guardian.email})</span></span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          {others.length > 0 && (
            <div className="notice warn">
              <Icon name="alert" />
              <div>
                <p style={{ marginTop: 0 }}>No s’importen. Revisa-les a Clickedu o al cens:</p>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', maxHeight: 160, overflow: 'auto' }}>
                  {others.map((x, i) => <li key={i}>Fila {x.line}: {x.msg}</li>)}
                </ul>
              </div>
            </div>
          )}
          <div className="table-wrap" style={{ maxHeight: 280, overflow: 'auto' }}>
            <table className="t">
              <thead><tr><th>Fila</th><th>Alumne</th><th>Responsable</th><th>Correu</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line}><td>{r.line}</td><td>{r.studentName}</td><td>{r.guardian.name}</td><td>{r.guardian.email}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">Per a cada alumne del fitxer, els correus importats <b>substitueixen</b> els que tenia i es marquen com a validats, perquè provenen de les dades oficials de l’escola. Els alumnes que no surten al fitxer no canvien.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setResult(null)}>Torna</button>
            <button className="btn primary" disabled={!rows.length} onClick={() => onDone(importGuardians(session, rows))}>
              Importa {rows.length} correus
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

/** Afegir o corregir a mà el nom i el correu d'un pare, una mare o un tutor legal. */
function GuardianForm({ student, original, onClose, onSave }: { student: Student; original: Guardian | null; onClose: () => void; onSave: (g: Guardian) => void }) {
  const [name, setName] = useState(original?.name ?? '')
  const [email, setEmail] = useState(original?.email ?? '')
  const [validated, setValidated] = useState(original?.validated ?? true)
  const [error, setError] = useState<string | null>(null)
  const clean = email.trim().toLowerCase()
  const problem = !name.trim()
    ? 'Escriu el nom.'
    : !EMAIL.test(clean)
      ? 'El correu no és vàlid.'
      : student.guardians.some((g) => g.email === clean && g.email !== original?.email)
        ? 'Aquest correu ja és d’un altre responsable de l’alumne.'
        : null
  const save = () => {
    try {
      onSave({ name, email: clean, validated })
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <Modal title={original ? 'Edita el responsable' : 'Afegeix un responsable'} onClose={onClose}>
      <p className="muted">
        {fullName(student)} · {groupName(student.gradeId, student.group)}
      </p>
      <label className="field">
        <span>Nom i cognoms</span>
        <input className="input" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="p. ex. Maria Serra Puig" />
      </label>
      <label className="field">
        <span>Correu electrònic</span>
        <input className="input" type="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="p. ex. maria.serra@exemple.cat" />
      </label>
      <label className="check">
        <input type="checkbox" checked={validated} onChange={(e) => setValidated(e.target.checked)} />
        <span>Correu comprovat amb la família (validat)</span>
      </label>
      <small className="muted">Només els correus validats reben l’informe. Si el canvies, desmarca-ho fins que la família te’l confirmi.</small>
      {(error || (problem && (name || email))) && <p className="notice bad">{error ?? problem}</p>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cancel·la</button>
        <button className="btn primary" disabled={!!problem} onClick={save}>
          <Icon name="check" /> Desa
        </button>
      </div>
    </Modal>
  )
}
