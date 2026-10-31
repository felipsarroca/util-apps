// Grups de cada curs: per defecte un per curs (una sola línia), sense lletra.

import { useState } from 'react'
import { addClassGroup, removeClassGroup, renameClassGroup, useDemoState } from '../data/api'
import { GRADES, STAGES } from '../domain/catalog'
import { groupName } from '../domain/groups'
import type { GradeId, Session } from '../domain/types'
import { Icon, Modal, useToast } from '../ui/common'
import { PageHead } from './StaffApp'

export function GroupsScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const [toast, showToast] = useToast()
  const [adding, setAdding] = useState<GradeId | null>(null)
  const [renaming, setRenaming] = useState<{ gradeId: GradeId; from: string } | null>(null)
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
      <PageHead title="Grups" sub="Els grups de cada curs. Si un curs només té un grup, a tot arreu es mostra sense lletra («2n ESO»)." />
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
      {toast}
    </>
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
