// Correus de les famílies: importació en CSV i validació. Ho gestiona l'administració o l'Equip Directiu.

import { useState } from 'react'
import { importGuardians, removeGuardian, setGuardianValidated, useDemoState } from '../data/api'
import { GRADES } from '../domain/catalog'
import { parseGuardiansCsv, type GuardianImport } from '../domain/csv'
import { groupName } from '../domain/groups'
import type { GradeId, Session } from '../domain/types'
import { Icon, Modal, useToast } from '../ui/common'
import { fullName } from './shared'
import { PageHead } from './StaffApp'

const SAMPLE = [
  'id_alumne;nom_responsable;correu_responsable',
  'ALU0001;Maria Serra;maria.serra@exemple.cat',
  'ALU0001;Joan Font;joan.font@exemple.cat',
  'ALU0002;Rosa Puig;rosa.puig@exemple',
  'ALU9999;Pere Roca;pere.roca@exemple.cat',
].join('\n')

export function FamiliesScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const [grade, setGrade] = useState<GradeId | ''>('')
  const [importing, setImporting] = useState(false)
  const [toast, showToast] = useToast()
  const students = s.students
    .filter((x) => !grade || x.gradeId === grade)
    .sort((a, b) => GRADES.findIndex((g) => g.id === a.gradeId) - GRADES.findIndex((g) => g.id === b.gradeId) || a.group.localeCompare(b.group) || a.surname.localeCompare(b.surname))
  const ok = students.filter((x) => x.guardians.some((g) => g.validated)).length
  const pending = students.filter((x) => x.guardians.length && !x.guardians.some((g) => g.validated)).length
  const none = students.filter((x) => !x.guardians.length).length
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
        <button className="btn primary" onClick={() => setImporting(true)}>
          <Icon name="upload" /> Importa des de CSV
        </button>
      </PageHead>
      <div className="kpis">
        <div className="card kpi"><span className="l">Amb correu validat</span><span className="v">{ok}</span><span className="s">Rebran l’informe per correu</span></div>
        <div className="card kpi"><span className="l">Pendents de validar</span><span className="v">{pending}</span><span className="s">Tenen correu, però no validat</span></div>
        <div className="card kpi"><span className="l">Sense correu</span><span className="v">{none}</span><span className="s">L’informe es lliurarà en paper</span></div>
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
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Alumne</th><th>Grup</th><th>Responsables</th></tr></thead>
          <tbody>
            {students.map((st) => (
              <tr key={st.id}>
                <td className="student-cell"><b>{fullName(st)}</b><small>{st.id}</small></td>
                <td>{groupName(st.gradeId, st.group)}</td>
                <td>
                  {!st.guardians.length && <span className="badge bad">Sense correu</span>}
                  <div className="fam-list">
                    {st.guardians.map((g) => (
                      <div key={g.email} className="fam-row">
                        <span><b>{g.name}</b> <span className="muted">{g.email}</span></span>
                        <label className="toggle" title="Correu comprovat amb la família">
                          <input type="checkbox" checked={g.validated} onChange={(e) => act(() => setGuardianValidated(session, st.id, g.email, e.target.checked), e.target.checked ? 'Correu validat.' : 'Correu pendent de validar.')} />
                          {g.validated ? 'Validat' : 'Pendent'}
                        </label>
                        <button className="btn icon small ghost" onClick={() => act(() => removeGuardian(session, st.id, g.email), 'Correu eliminat.')} aria-label={`Treu ${g.email}`}>
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
      {importing && <ImportFamilies session={session} onClose={() => setImporting(false)} onDone={(n) => { setImporting(false); showToast(`Correus actualitzats per a ${n} alumnes.`) }} />}
      {toast}
    </>
  )
}

function ImportFamilies({ session, onClose, onDone }: { session: Session; onClose: () => void; onDone: (n: number) => void }) {
  const s = useDemoState()
  const [text, setText] = useState('')
  const [result, setResult] = useState<GuardianImport | null>(null)
  const analyse = (t: string) => setResult(parseGuardiansCsv(t, s.students))
  const students = result ? new Set(result.rows.map((r) => r.studentId)).size : 0
  return (
    <Modal title="Importa els correus de les famílies" onClose={onClose} wide>
      {!result ? (
        <>
          <p>
            Un sol fitxer per a tots els cursos, de 3r de primària a 4t d’ESO. Cal la columna <b>id_alumne</b> (o <b>correu_alumne</b>) i els correus de la família en un d’aquests formats:
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
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const t = await f.text(); setText(t); analyse(t) } }} />
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
            <span className="badge ok">{result.rows.length} correus correctes ({students} {students === 1 ? 'alumne' : 'alumnes'})</span>
            <span className="badge bad">{result.issues.length} amb errors</span>
          </div>
          {result.issues.length > 0 && (
            <div className="notice warn">
              <Icon name="alert" />
              <div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {result.issues.slice(0, 12).map((x, i) => <li key={i}>Fila {x.line}: {x.msg}</li>)}
                </ul>
                {result.issues.length > 12 && <p>I {result.issues.length - 12} errors més.</p>}
              </div>
            </div>
          )}
          <div className="table-wrap" style={{ maxHeight: 280, overflow: 'auto' }}>
            <table className="t">
              <thead><tr><th>Fila</th><th>Alumne</th><th>Responsable</th><th>Correu</th></tr></thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.line}><td>{r.line}</td><td>{r.studentName}</td><td>{r.guardian.name}</td><td>{r.guardian.email}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">Per a cada alumne del fitxer, els correus importats <b>substitueixen</b> els que tenia i es marquen com a validats, perquè provenen de les dades oficials de l’escola. Els alumnes que no surten al fitxer no canvien.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setResult(null)}>Torna</button>
            <button className="btn primary" disabled={!result.rows.length} onClick={() => onDone(importGuardians(session, result.rows))}>
              Importa {result.rows.length} correus
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
