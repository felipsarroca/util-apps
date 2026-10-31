import { useState } from 'react'
import { addStaff, importCensus, isDirection, removeStaff, setDirection, setElective, useDemoState, type CensusRow } from '../data/api'
import { gradeShort, GRADES, SCHOOL } from '../domain/catalog'
import { detectColumns, normalizeGrade, parseCsv } from '../domain/csv'
import type { GradeId, Session } from '../domain/types'
import { fmtShort, Icon, Modal, useToast } from '../ui/common'
import { fullName } from './shared'
import { PageHead } from './StaffApp'

type Tab = 'access' | 'census' | 'issues'

export function PeopleScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const [tab, setTab] = useState<Tab>('access')
  const issues = s.audit.filter((a) => a.action === 'Incidència d’identitat')
  return (
    <>
      <PageHead title="Alumnat i accessos" sub={`Només hi poden entrar comptes @${SCHOOL.domain}. Tenir un compte de l’escola no dona accés a cap dada: cal constar al cens o tenir un permís.`} />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'access'} className={`tab${tab === 'access' ? ' cur' : ''}`} onClick={() => setTab('access')}>Professorat i administració</button>
        <button role="tab" aria-selected={tab === 'census'} className={`tab${tab === 'census' ? ' cur' : ''}`} onClick={() => setTab('census')}>Cens de l’alumnat</button>
        <button role="tab" aria-selected={tab === 'issues'} className={`tab${tab === 'issues' ? ' cur' : ''}`} onClick={() => setTab('issues')}>Incidències d’identitat {issues.length > 0 && <span className="badge warn plain">{issues.length}</span>}</button>
      </div>
      {tab === 'access' && <Access session={session} />}
      {tab === 'census' && <Census session={session} />}
      {tab === 'issues' && (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Data</th><th>Compte</th><th>Missatge de l’alumne</th></tr></thead>
            <tbody>
              {issues.map((a, i) => (
                <tr key={i}><td className="muted">{fmtShort(a.at)}</td><td>{a.actor}</td><td>{a.detail}</td></tr>
              ))}
            </tbody>
          </table>
          {!issues.length && <div className="empty"><span className="em" aria-hidden="true">✅</span>Cap alumne ha indicat que les seves dades siguin incorrectes.</div>}
        </div>
      )}
    </>
  )
}

function Access({ session }: { session: Session }) {
  const s = useDemoState()
  const [adding, setAdding] = useState(false)
  const [toast, showToast] = useToast()
  const dir = isDirection(session)
  const toggleDir = (email: string, on: boolean) => {
    try {
      setDirection(session, email, on)
      showToast(on ? 'Afegit a l’Equip Directiu' : 'Tret de l’Equip Directiu')
    } catch (e) {
      showToast((e as Error).message)
    }
  }
  return (
    <>
      <div className="row">
        <p className="muted" style={{ flex: 1 }}>
          El professorat només veu els grups que té assignats. L’administració ho veu tot i cada acció queda registrada. Els resultats d’«Et veig» només els veu l’<b>Equip Directiu</b>
          {dir ? '.' : ': només un membre de l’Equip Directiu pot afegir-hi o treure’n persones.'}
        </p>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" /> Dona accés</button>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Persona</th><th>Rol</th><th>Grups</th><th>Equip Directiu</th><th /></tr></thead>
          <tbody>
            {s.staff.map((p) => (
              <tr key={p.email}>
                <td className="student-cell"><b>{p.name}</b><small>{p.email}</small></td>
                <td>{p.role === 'admin' ? <span className="badge brand">Administració</span> : <span className="badge info">Professorat</span>}</td>
                <td>{p.role === 'admin' ? 'Tots' : p.groups.map((g) => g.replace(/^(\d(?:EP|ESO))-(.+)$/, (_, gr: string, x: string) => `${gradeShort(gr as GradeId)} ${x}`)).join(', ') || '—'}</td>
                <td>
                  <label className="toggle" title={!dir ? 'Només ho pot canviar l’Equip Directiu' : p.email === session.email ? 'No pots canviar la teva pròpia pertinença' : undefined}>
                    <input type="checkbox" checked={!!p.direction} disabled={!dir || p.email === session.email} onChange={(e) => toggleDir(p.email, e.target.checked)} />
                    <span className="sr-only">{p.name} forma part de l’Equip Directiu</span>
                    {p.direction ? 'Sí' : 'No'}
                  </label>
                </td>
                <td className="actions">
                  <button className="btn small danger" disabled={p.email === session.email || (!!p.direction && !dir)} onClick={() => { try { removeStaff(session, p.email); showToast('Accés retirat') } catch (e) { showToast((e as Error).message) } }}>Retira l’accés</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && <AddStaff onClose={() => setAdding(false)} onOk={(email, name, role, groups) => { try { addStaff(session, email, name, role, groups); setAdding(false); showToast('Accés concedit') } catch (e) { showToast((e as Error).message) } }} />}
      {toast}
    </>
  )
}

function AddStaff({ onClose, onOk }: { onClose: () => void; onOk: (email: string, name: string, role: 'admin' | 'teacher', groups: string[]) => void }) {
  const s = useDemoState()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'admin' | 'teacher'>('teacher')
  const [groups, setGroups] = useState<string[]>([])
  const allGroups = GRADES.flatMap((g) => [...new Set(s.students.filter((x) => x.gradeId === g.id).map((x) => x.group))].sort().map((x) => `${g.id}-${x}`))
  const okDomain = email.trim().toLowerCase().endsWith(`@${SCHOOL.domain}`)
  return (
    <Modal title="Dona accés a una persona" onClose={onClose}>
      <label className="field"><span>Correu de l’escola</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`nom.cognom@${SCHOOL.domain}`} aria-invalid={!!email && !okDomain} /></label>
      {email && !okDomain && <p className="notice bad">Ha de ser un compte @{SCHOOL.domain}.</p>}
      <label className="field"><span>Nom</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="row">
        <label className="check"><input type="radio" name="role" checked={role === 'teacher'} onChange={() => setRole('teacher')} /> Professorat</label>
        <label className="check"><input type="radio" name="role" checked={role === 'admin'} onChange={() => setRole('admin')} /> Administració</label>
      </div>
      {role === 'teacher' && (
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <span>Grups</span>
          <div className="row">
            {allGroups.map((g) => (
              <label key={g} className="check"><input type="checkbox" checked={groups.includes(g)} onChange={(e) => setGroups((p) => (e.target.checked ? [...p, g] : p.filter((x) => x !== g)))} />{gradeShort(g.split('-')[0] as GradeId)} {g.split('-')[1]}</label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cancel·la</button>
        <button className="btn primary" disabled={!okDomain || !name.trim() || (role === 'teacher' && !groups.length)} onClick={() => onOk(email, name.trim(), role, groups)}>Dona accés</button>
      </div>
    </Modal>
  )
}

const SAMPLE = `id_alumne;nom;cognoms;correu;curs;grup
ALU9001;Txell;Bosch Mas;txell.bosch@ramonpont.cat;3r ESO;A
ALU9002;Pere;Roca Coll;pere.roca@gmail.com;3r ESO;A
ALU9003;Sara;Font Prat;sara.font@ramonpont.cat;Tercer;A
ALU9004;Biel;Sala Costa;biel.sala@ramonpont.cat;5è de primària;A`

function Census({ session }: { session: Session }) {
  const s = useDemoState()
  const [grade, setGrade] = useState<GradeId>('2ESO')
  const [csv, setCsv] = useState<string | null>(null)
  const [rows, setRows] = useState<CensusRow[] | null>(null)
  const [toast, showToast] = useToast()
  const students = s.students.filter((x) => x.gradeId === grade).sort((a, b) => a.group.localeCompare(b.group) || a.surname.localeCompare(b.surname))
  const electives = s.gradeSubjects.filter((g) => g.gradeId === grade && g.optional && g.active)

  const analyse = (text: string) => {
    const data = parseCsv(text)
    if (data.length < 2) return showToast('El fitxer no té dades.')
    const map = detectColumns(data[0])
    const seenId = new Set<string>(), seenMail = new Set<string>()
    setRows(
      data.slice(1).map((r) => {
        const get = (i: number) => (i >= 0 ? r[i] ?? '' : '')
        const email = get(map.email).toLowerCase()
        const id = get(map.id)
        const gradeId = normalizeGrade(get(map.grade))
        const issues: string[] = []
        if (!id) issues.push('Falta l’identificador')
        if (!get(map.name)) issues.push('Falta el nom')
        if (!email.endsWith(`@${SCHOOL.domain}`)) issues.push(`El correu no és @${SCHOOL.domain}`)
        if (!gradeId) issues.push(`Curs no reconegut: «${get(map.grade)}»`)
        if (seenId.has(id)) issues.push('Identificador repetit al fitxer')
        if (seenMail.has(email)) issues.push('Correu repetit al fitxer')
        const other = s.students.find((x) => x.email === email && x.id !== id)
        if (other) issues.push(`El correu ja és de ${fullName(other)} (${other.id})`)
        seenId.add(id)
        seenMail.add(email)
        return { id, name: get(map.name), surname: get(map.surname), email, gradeId, group: get(map.group) || 'A', issues }
      }),
    )
  }

  return (
    <>
      <div className="toolbar">
        <label className="field">
          <span>Curs</span>
          <select className="select" value={grade} onChange={(e) => setGrade(e.target.value as GradeId)}>
            {GRADES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <span className="spacer" />
        <button className="btn" onClick={() => setCsv('')}><Icon name="upload" /> Importa un CSV</button>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Alumne</th><th>Grup</th><th>Correu</th>
              {electives.map((e) => <th key={e.subjectId}>{s.subjects.find((x) => x.id === e.subjectId)?.short}</th>)}
            </tr>
          </thead>
          <tbody>
            {students.map((st) => (
              <tr key={st.id}>
                <td className="student-cell"><b>{fullName(st)}</b><small>{st.id}</small></td>
                <td>{st.group}</td>
                <td className="muted">{st.email}</td>
                {electives.map((e) => (
                  <td key={e.subjectId}>
                    <input type="checkbox" checked={st.electives.includes(e.subjectId)} onChange={(ev) => setElective(session, st.id, e.subjectId, ev.target.checked)} aria-label={`${fullName(st)} cursa ${e.subjectId}`} style={{ width: 18, height: 18, accentColor: 'var(--brand)' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {electives.length > 0 && <p className="muted" style={{ fontSize: '.85rem' }}>Marca les optatives que cursa cada alumne: només li apareixeran aquestes.</p>}

      {csv !== null && (
        <Modal title="Importació del cens" onClose={() => { setCsv(null); setRows(null) }} wide>
          {!rows ? (
            <>
              <p>Columnes necessàries, en qualsevol ordre: <b>identificador, nom, cognoms, correu, curs</b> i, opcionalment, <b>grup</b>. Separador «;» o «,». Res no es desa fins que confirmis.</p>
              <div className="row">
                <label className="btn"><Icon name="upload" /> Tria un fitxer<input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const t = await f.text(); setCsv(t); analyse(t) } }} /></label>
                <button className="btn ghost" onClick={() => setCsv(SAMPLE)}>Carrega un exemple</button>
              </div>
              <textarea className="textarea" rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="També pots enganxar aquí el contingut del CSV" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.85rem' }} />
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn primary" disabled={!csv.trim()} onClick={() => analyse(csv)}>Analitza</button>
              </div>
            </>
          ) : (
            <>
              <div className="row">
                <span className="badge ok">{rows.filter((r) => !r.issues.length).length} correctes</span>
                <span className="badge bad">{rows.filter((r) => r.issues.length).length} amb incidències</span>
              </div>
              <div className="table-wrap" style={{ maxHeight: 340, overflow: 'auto' }}>
                <table className="t">
                  <thead><tr><th>ID</th><th>Alumne</th><th>Correu</th><th>Curs</th><th>Comprovació</th></tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.id || '—'}</td>
                        <td>{r.surname}, {r.name}</td>
                        <td>{r.email}</td>
                        <td>{r.gradeId ? `${gradeShort(r.gradeId)} ${r.group}` : '—'}</td>
                        <td>{r.issues.length ? <span style={{ color: 'var(--bad)', fontWeight: 700 }}>{r.issues.join(' · ')}</span> : <span className="badge ok">Correcte</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">Les files amb incidències no s’importaran. Corregeix-les al fitxer i torna-ho a provar.</p>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setRows(null)}>Torna</button>
                <button className="btn primary" disabled={!rows.some((r) => !r.issues.length)} onClick={() => { const n = importCensus(session, rows); setCsv(null); setRows(null); showToast(`${n} alumnes importats`) }}>
                  Importa {rows.filter((r) => !r.issues.length).length} alumnes
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
      {toast}
    </>
  )
}
