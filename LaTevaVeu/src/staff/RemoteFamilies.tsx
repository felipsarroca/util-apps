// Correus de les famílies en mode connectat. La previsualització es fa al navegador; el servidor ho torna a validar.
import { useState } from 'react'
import { fetchFamilies, postFamiliesImport, postGuardianRemove, postGuardianValidated, useRemote, type RemoteFamily } from '../data/remote'
import { GRADES } from '../domain/catalog'
import { parseGuardiansCsv, type GuardianImport } from '../domain/csv'
import { groupName } from '../domain/groups'
import type { GradeId, Student } from '../domain/types'
import { Icon, Modal, useToast } from '../ui/common'
import { PageHead } from './StaffApp'

export function RemoteFamilies() {
  const r = useRemote(fetchFamilies)
  const [grade, setGrade] = useState<GradeId | ''>('')
  const [importing, setImporting] = useState(false)
  const [toast, showToast] = useToast()
  const all = r.data ?? []
  const students = all.filter((x) => !grade || x.gradeId === grade)
  const ok = students.filter((x) => x.guardians.some((g) => g.validated)).length
  const pending = students.filter((x) => x.guardians.length && !x.guardians.some((g) => g.validated)).length
  const act = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn()
      showToast(msg)
      r.reload()
    } catch (e) {
      showToast((e as Error).message)
    }
  }
  return (
    <>
      <PageHead title="Famílies" sub="Correus dels responsables de cada alumne, per enviar-los l’informe «Així em veig». Mode connectat: les dades són al servidor de l’escola.">
        <button className="btn primary" disabled={!r.data} onClick={() => setImporting(true)}>
          <Icon name="upload" /> Importa des de CSV
        </button>
      </PageHead>
      {!r.data ? (
        <p className="muted">{r.error ?? 'Carregant…'}</p>
      ) : (
        <>
          <div className="kpis">
            <div className="card kpi"><span className="l">Amb correu validat</span><span className="v">{ok}</span><span className="s">Rebran l’informe per correu</span></div>
            <div className="card kpi"><span className="l">Pendents de validar</span><span className="v">{pending}</span><span className="s">Tenen correu, però no validat</span></div>
            <div className="card kpi"><span className="l">Sense correu</span><span className="v">{students.length - ok - pending}</span><span className="s">L’informe es lliurarà en paper</span></div>
          </div>
          <div className="toolbar">
            <label className="field">
              <span>Curs</span>
              <select className="select" value={grade} onChange={(e) => setGrade(e.target.value as GradeId | '')}>
                <option value="">Tots els cursos</option>
                {GRADES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          </div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Alumne</th><th>Grup</th><th>Responsables</th></tr></thead>
              <tbody>
                {students.map((st) => (
                  <tr key={st.ref}>
                    <td className="student-cell"><b>{st.surname}, {st.name}</b><small>{st.ref}</small></td>
                    <td>{groupName(st.gradeId, st.group)}</td>
                    <td>
                      {!st.guardians.length && <span className="badge bad">Sense correu</span>}
                      <div className="fam-list">
                        {st.guardians.map((g) => (
                          <div key={g.email} className="fam-row">
                            <span><b>{g.name}</b> <span className="muted">{g.email}</span></span>
                            <label className="toggle" title="Correu comprovat amb la família">
                              <input type="checkbox" checked={g.validated} onChange={(e) => act(() => postGuardianValidated(st.ref, g.email, e.target.checked), e.target.checked ? 'Correu validat.' : 'Correu pendent de validar.')} />
                              {g.validated ? 'Validat' : 'Pendent'}
                            </label>
                            <button className="btn icon small ghost" onClick={() => act(() => postGuardianRemove(st.ref, g.email), 'Correu eliminat.')} aria-label={`Treu ${g.email}`}>
                              <Icon name="trash" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {importing && (
        <ImportRemote
          census={all}
          onClose={() => setImporting(false)}
          onDone={(msg) => {
            setImporting(false)
            showToast(msg)
            r.reload()
          }}
        />
      )}
      {toast}
    </>
  )
}

function ImportRemote({ census, onClose, onDone }: { census: RemoteFamily[]; onClose: () => void; onDone: (msg: string) => void }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<string>()
  const [result, setResult] = useState<GuardianImport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  // El CSV identifica l'alumne pel codi del cens.
  const students: Student[] = census.map((x) => ({ id: x.ref, name: x.name, surname: x.surname, email: x.email, gradeId: x.gradeId, group: x.group, electives: [], guardians: [] }))
  const analyse = (t: string) => setResult(parseGuardiansCsv(t, students))
  const send = async () => {
    setBusy(true)
    try {
      const r = await postFamiliesImport(text, file)
      onDone(`Correus actualitzats per a ${r.students} ${r.students === 1 ? 'alumne' : 'alumnes'}.`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <Modal title="Importa els correus de les famílies" onClose={onClose} wide>
      {!result ? (
        <>
          <p>Una fila per responsable, amb les columnes <b>id_alumne</b> (o <b>correu_alumne</b>), <b>nom_responsable</b> i <b>correu_responsable</b>. Res no es desa fins que confirmis.</p>
          <div className="row">
            <label className="btn">
              <Icon name="upload" /> Tria un fitxer
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const t = await f.text(); setFile(f.name); setText(t); analyse(t) } }} />
            </label>
          </div>
          <textarea className="textarea" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="També pots enganxar aquí el contingut del CSV" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.85rem' }} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary" disabled={!text.trim()} onClick={() => analyse(text)}>Analitza</button>
          </div>
        </>
      ) : (
        <>
          <div className="row">
            <span className="badge ok">{result.rows.length} correus correctes</span>
            <span className="badge bad">{result.issues.length} amb errors</span>
          </div>
          {result.issues.length > 0 && (
            <div className="notice warn">
              <Icon name="alert" />
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {result.issues.slice(0, 12).map((x, i) => <li key={i}>Fila {x.line}: {x.msg}</li>)}
                {result.issues.length > 12 && <li>I {result.issues.length - 12} errors més.</li>}
              </ul>
            </div>
          )}
          <p className="muted">Per a cada alumne del fitxer, els correus importats <b>substitueixen</b> els que tenia i queden validats. Les files amb errors no s’importen i queden registrades.</p>
          {error && <div className="notice bad"><Icon name="alert" /><div>{error}</div></div>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setResult(null)}>Torna</button>
            <button className="btn primary" disabled={busy || !result.rows.length} onClick={send}>
              {busy ? 'Important…' : `Importa ${result.rows.length} correus`}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
