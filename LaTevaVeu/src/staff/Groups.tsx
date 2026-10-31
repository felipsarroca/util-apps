// Grups de cada curs: per defecte un per curs (una sola línia), sense lletra.

import { useState } from 'react'
import { addClassGroup, removeClassGroup, renameClassGroup, startNewYearLocal, useDemoState } from '../data/api'
import { postNewYear } from '../data/remote'
import { gradeShort, GRADES, nextGrade, nextYear, STAGES } from '../domain/catalog'
import { groupName } from '../domain/groups'
import type { GradeId, Session } from '../domain/types'
import { Icon, Modal, useToast } from '../ui/common'
import { PageHead } from './StaffApp'

export function GroupsScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const [toast, showToast] = useToast()
  const [adding, setAdding] = useState<GradeId | null>(null)
  const [renaming, setRenaming] = useState<{ gradeId: GradeId; from: string } | null>(null)
  const [newYear, setNewYear] = useState(false)
  const run = (fn: () => void, ok: string) => {
    try {
      fn()
      showToast(ok)
      return true
    } catch (e) {
      showToast((e as Error).message)
      return false
    }
  }
  return (
    <>
      <PageHead title="Grups" sub={`Curs ${s.year}. Els grups de cada curs. Si un curs només té un grup, a tot arreu es mostra sense lletra («2n ESO»).`}>
        {session.role === 'admin' && (
          <button className="btn" onClick={() => setNewYear(true)}>
            <Icon name="calendar" /> Curs nou ({nextYear(s.year)})
          </button>
        )}
      </PageHead>
      <div className="notice">
        <Icon name="info" />
        <div>
          Afegeix un grup si s’obre una segona línia o un grup específic. En canviar-ne el nom, el canvi s’aplica a l’alumnat, a les assignacions i als grups del professorat. Només es pot treure un grup que no tingui alumnes.
        </div>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr><th>Curs</th><th>Etapa</th><th>Grups</th><th /></tr>
          </thead>
          <tbody>
            {GRADES.map((g) => {
              const groups = s.classGroups[g.id] ?? []
              return (
                <tr key={g.id}>
                  <td><b>{g.name}</b></td>
                  <td className="muted">{STAGES[g.stage].short}</td>
                  <td>
                    <div className="row" style={{ gap: '.4rem' }}>
                      {groups.map((grp) => {
                        const n = s.students.filter((x) => x.gradeId === g.id && x.group === grp).length
                        return (
                          <span key={grp} className="group-chip">
                            <b>{groups.length > 1 ? grp : 'Grup únic'}</b>
                            <small>{n} alumnes</small>
                            {groups.length > 1 && (
                              <>
                                <button className="btn icon small ghost" onClick={() => setRenaming({ gradeId: g.id, from: grp })} aria-label={`Canvia el nom de ${groupName(g.id, grp)}`} title="Canvia el nom">
                                  <Icon name="edit" />
                                </button>
                                <button className="btn icon small ghost" disabled={n > 0} onClick={() => run(() => removeClassGroup(session, g.id, grp), 'Grup eliminat.')} aria-label={`Treu ${groupName(g.id, grp)}`} title={n > 0 ? 'Té alumnes: no es pot treure' : 'Treu el grup'}>
                                  <Icon name="trash" />
                                </button>
                              </>
                            )}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td className="actions">
                    <button className="btn small" onClick={() => setAdding(g.id)}>
                      <Icon name="plus" /> Afegeix un grup
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {adding && (
        <NameDialog
          title={`Nou grup a ${GRADES.find((g) => g.id === adding)!.name}`}
          hint={(s.classGroups[adding] ?? []).length === 1 ? `El grup actual passarà a mostrar-se com a «${s.classGroups[adding][0]}». Si cal, canvia-li el nom després.` : undefined}
          initial={String.fromCharCode(65 + (s.classGroups[adding] ?? []).length)}
          onClose={() => setAdding(null)}
          onOk={(label) => run(() => addClassGroup(session, adding, label), 'Grup afegit.') && setAdding(null)}
        />
      )}
      {renaming && (
        <NameDialog
          title={`Nom del grup ${renaming.from}`}
          initial={renaming.from}
          onClose={() => setRenaming(null)}
          onOk={(label) => run(() => renameClassGroup(session, renaming.gradeId, renaming.from, label), 'Nom canviat.') && setRenaming(null)}
        />
      )}
      {newYear && (
        <NewYear
          session={session}
          onClose={() => setNewYear(false)}
          onDone={(r) => {
            setNewYear(false)
            showToast(`Curs ${r.year} començat: ${r.promoted} alumnes han passat de curs i ${r.graduated} han acabat 4t d’ESO.`)
          }}
          onError={(m) => showToast(m)}
        />
      )}
      {toast}
    </>
  )
}

/** Pas al curs escolar següent: resum del que passarà i confirmació escrita. */
function NewYear({ session, onClose, onDone, onError }: { session: Session; onClose: () => void; onDone: (r: { year: string; promoted: number; graduated: number }) => void; onError: (m: string) => void }) {
  const s = useDemoState()
  const year = nextYear(s.year)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const count = (g: GradeId) => s.students.filter((x) => x.gradeId === g).length
  const go = async () => {
    setBusy(true)
    try {
      onDone(session.remote ? await postNewYear(year) : startNewYearLocal(session))
    } catch (e) {
      onError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <Modal title={`Comença el curs ${year}`} onClose={onClose} wide>
      <p>Es fa una sola vegada, a l’estiu, abans de preparar les campanyes del curs nou. El curs {s.year} es conserva sencer (respostes i informes), però l’app passa a treballar amb el {year}.</p>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Ara a</th><th>Alumnes</th><th>Passaran a</th></tr></thead>
          <tbody>
            {GRADES.map((g) => {
              const to = nextGrade(g.id)
              return (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>{count(g.id)}</td>
                  <td>{to ? gradeShort(to) : <b>Acaben l’escola: es donen de baixa</b>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul className="role-help">
        <li>Cada alumne conserva el grup (A, B…) en el curs següent. Els grups, les matèries de cada curs i les assignacions del professorat es copien al curs nou.</li>
        <li>Les optatives es buiden: cal marcar les del curs nou a Alumnat i accessos › Cens.</li>
        <li><b>Després:</b> importa el cens de 3r de primària (l’alumnat que entra), dona de baixa qui marxa i mou els repetidors amb la selecció del cens.</li>
      </ul>
      <label className="field">
        <span>Per confirmar-ho, escriu <b>{year}</b></span>
        <input className="input" value={typed} onChange={(e) => setTyped(e.target.value.trim())} inputMode="numeric" />
      </label>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cancel·la</button>
        <button className="btn primary" disabled={typed !== year || busy} onClick={go}>{busy ? 'Un moment…' : `Comença el curs ${year}`}</button>
      </div>
    </Modal>
  )
}

function NameDialog({ title, hint, initial, onClose, onOk }: { title: string; hint?: string; initial: string; onClose: () => void; onOk: (label: string) => void }) {
  const [label, setLabel] = useState(initial)
  return (
    <Modal title={title} onClose={onClose}>
      {hint && <p className="muted">{hint}</p>}
      <label className="field">
        <span>Nom del grup (p. ex. «B» o «Línia 2»)</span>
        <input className="input" value={label} maxLength={12} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cancel·la</button>
        <button className="btn primary" disabled={!label.trim()} onClick={() => onOk(label)}>Desa</button>
      </div>
    </Modal>
  )
}
