// Grups de cada curs: per defecte un per curs (una sola línia), sense lletra.

import { Fragment, useState } from 'react'
import { addClassGroup, removeClassGroup, renameClassGroup, startNewYearLocal, useDemoState, type NewYearResult } from '../data/api'
import { postNewYear } from '../data/remote'
import { gradeShort, GRADES, nextGrade, nextYear, STAGES, TUTORIA } from '../domain/catalog'
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
  const tutorOf = (gradeId: GradeId, group: string) => {
    const email = s.assignments.find((a) => a.subjectId === TUTORIA && a.gradeId === gradeId && a.group === group)?.teacherEmail
    return email ? s.staff.find((m) => m.email === email)?.name ?? email : undefined
  }
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
          El tutor o tutora de cada grup és qui fa la matèria Tutoria: es tria a Et veig… › Qui fa classe a qui o a la columna Tutoria d’Alumnat i accessos. Afegeix un grup si s’obre una segona línia o un grup específic. En canviar-ne el nom, el canvi s’aplica a l’alumnat, a les assignacions i als grups del professorat. Només es pot treure un grup que no tingui alumnes.
        </div>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr><th>Curs</th><th>Etapa</th><th>Grups</th><th>Tutoria</th><th /></tr>
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
                  <td>
                    {groups.length === 0 && <span className="muted">—</span>}
                    {groups.map((grp) => {
                      const t = tutorOf(g.id, grp)
                      return (
                        <div key={grp} className="tutor-line">
                          {groups.length > 1 && <b>{grp}: </b>}
                          {t ?? <span className="muted">Sense tutor/a</span>}
                        </div>
                      )
                    })}
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
            showToast(`Curs ${r.year} començat: ${r.promoted} alumnes han passat de curs, ${r.repeated} ${r.repeated === 1 ? 'repeteix' : 'repeteixen'} i ${r.graduated} han acabat 4t d’ESO.`)
          }}
          onError={(m) => showToast(m)}
        />
      )}
      {toast}
    </>
  )
}

/** Pas al curs escolar següent: resum del que passarà i confirmació escrita. */
function NewYear({ session, onClose, onDone, onError }: { session: Session; onClose: () => void; onDone: (r: NewYearResult) => void; onError: (m: string) => void }) {
  const s = useDemoState()
  const year = nextYear(s.year)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [repeat, setRepeat] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<GradeId | null>(null)
  const of = (g: GradeId) => s.students.filter((x) => x.gradeId === g).sort((a, b) => a.surname.localeCompare(b.surname, 'ca'))
  const reps = (g: GradeId) => of(g).filter((x) => repeat.has(x.id)).length
  const toggle = (id: string, on: boolean) =>
    setRepeat((p) => {
      const n = new Set(p)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  const go = async () => {
    setBusy(true)
    try {
      onDone(session.remote ? await postNewYear(year, [...repeat]) : startNewYearLocal(session, [...repeat]))
    } catch (e) {
      onError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <Modal title={`Comença el curs ${year}`} onClose={onClose} wide>
      <p>
        Es fa una sola vegada, a l’estiu. Es conserva tota la informació del centre (personal, cens, famílies, grups, matèries, tutories, qui fa classe a qui, qüestionaris i configuració);
        les valoracions i els informes es queden al curs {s.year}. Marca abans els <b>repetidors</b>: es queden al seu curs.
      </p>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Ara a</th><th>Alumnes</th><th>Repetidors</th><th>La resta passa a</th></tr></thead>
          <tbody>
            {GRADES.map((g) => {
              const to = nextGrade(g.id)
              const list = of(g.id)
              return (
                <Fragment key={g.id}>
                  <tr>
                    <td>{g.name}</td>
                    <td>{list.length}</td>
                    <td>
                      <button className="btn small" disabled={!list.length} onClick={() => setOpen(open === g.id ? null : g.id)} aria-expanded={open === g.id}>
                        {reps(g.id) ? `${reps(g.id)} ${reps(g.id) === 1 ? 'repeteix' : 'repeteixen'}` : 'Marca’ls'}
                      </button>
                    </td>
                    <td>{to ? gradeShort(to) : <b>Acaben l’escola: es donen de baixa</b>}</td>
                  </tr>
                  {open === g.id && (
                    <tr>
                      <td colSpan={4}>
                        <div className="repeat-list">
                          {list.map((x) => (
                            <label key={x.id} className="check">
                              <input type="checkbox" checked={repeat.has(x.id)} onChange={(e) => toggle(x.id, e.target.checked)} /> {x.surname}, {x.name}
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul className="role-help">
        <li>Cada alumne conserva el grup (A, B…). Els repetidors es queden al seu curs; els de 4t d’ESO que no repeteixen es donen de baixa (no s’esborra res).</li>
        <li>Les optatives es buiden: cal marcar les del curs nou a Alumnat i accessos › Cens.</li>
        <li><b>Després:</b> importa el cens de 3r de primària (l’alumnat que entra), dona de baixa qui marxa de l’escola i revisa les tutories i qui fa classe a qui.</li>
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
