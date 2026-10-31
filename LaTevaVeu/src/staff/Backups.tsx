// Còpies de seguretat: llista, còpia a mà i restauració amb confirmació. Només l'administració.
// Amb servidor, les còpies són a la base de dades; a la demostració, al navegador.

import { useState } from 'react'
import { demoBackupNow, demoBackups, demoRestore } from '../data/api'
import { fetchBackups, postBackup, postRestore, useRemote, type RemoteBackup } from '../data/remote'
import type { Session } from '../domain/types'
import { Icon, Modal, useToast } from '../ui/common'
import { PageHead } from './StaffApp'

const when = (iso: string) => new Date(iso).toLocaleString('ca', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} kB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

export function BackupsScreen({ session }: { session: Session }) {
  const remote = !!session.remote
  const list = useRemote<RemoteBackup[]>(() => (remote ? fetchBackups() : Promise.resolve(demoBackups())))
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<RemoteBackup | null>(null)
  const [typed, setTyped] = useState('')
  const [toast, showToast] = useToast()

  const run = async (fn: () => Promise<unknown> | unknown, ok: string) => {
    setBusy(true)
    try {
      await fn()
      showToast(ok)
      list.reload()
    } catch (e) {
      showToast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const backupNow = () => run(() => (remote ? postBackup() : demoBackupNow(session)), 'Còpia feta.')
  const restore = (b: RemoteBackup) => {
    setConfirm(null)
    setTyped('')
    void run(() => (remote ? postRestore(b.id) : demoRestore(session, b.id)), `Dades restaurades a la còpia del ${when(b.at)}.`)
  }

  return (
    <>
      <PageHead title="Còpies de seguretat" sub="Una còpia completa de les dades cada dia i abans de cada canvi gran. Si alguna cosa surt malament, es pot tornar enrere.">
        <button className="btn primary" disabled={busy} onClick={backupNow}>
          <Icon name="download" /> Fes una còpia ara
        </button>
      </PageHead>

      <div className="notice">
        <Icon name="shield" />
        <div>
          {remote ? (
            <>
              Es fa una còpia <b>cada dia</b> de manera automàtica i també <b>abans de començar un curs nou</b>, <b>abans d’importar correus de les famílies</b> i <b>abans de restaurar-ne una</b>.
              Es conserven les dels darrers 30 dies (i, com a mínim, les 10 més recents). Restaurar no esborra el registre d’operacions ni torna a enviar recordatoris.
            </>
          ) : (
            <>A la demostració, les còpies es desen en aquest navegador (les 5 més recents). Amb el servidor de l’escola, es fan soles cada dia i abans de cada canvi gran.</>
          )}
        </div>
      </div>

      <section className="card panel">
        {list.loading && <p className="muted">Carregant…</p>}
        {list.error && <p className="notice bad">{list.error}</p>}
        {list.data && !list.data.length && <p className="muted">Encara no hi ha cap còpia.</p>}
        {!!list.data?.length && (
          <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Data</th>
                <th>Motiu</th>
                <th>Curs</th>
                <th className="num">Files</th>
                <th className="num">Mida</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.map((b) => (
                <tr key={b.id}>
                  <td>{when(b.at)}</td>
                  <td>
                    {b.reason}
                    {b.by && <small className="muted"> · {b.by}</small>}
                  </td>
                  <td>{b.year ?? '—'}</td>
                  <td className="num">{b.rows.toLocaleString('ca')}</td>
                  <td className="num">{size(b.bytes)}</td>
                  <td className="num">
                    <button className="btn small" disabled={busy} onClick={() => setConfirm(b)}>
                      <Icon name="history" /> Restaura
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>

      {confirm && (
        <Modal title="Restaurar una còpia" onClose={() => setConfirm(null)}>
          <p>
            Totes les dades tornaran a com eren el <b>{when(confirm.at)}</b> ({confirm.reason.toLowerCase()}): alumnat, grups, famílies, recollides, respostes, «Et veig…» i configuració.
            El que s’hagi fet després es perdrà.
          </p>
          <div className="notice">
            <Icon name="info" />
            <div>Abans de restaurar es fa una còpia de les dades actuals: si t’equivoques, la pots restaurar i tornar a on eres.</div>
          </div>
          <label className="field">
            <span>Per confirmar-ho, escriu <b>RESTAURA</b></span>
            <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirm(null)}>Cancel·la</button>
            <button className="btn danger" disabled={typed.trim().toUpperCase() !== 'RESTAURA' || busy} onClick={() => restore(confirm)}>
              <Icon name="history" /> Restaura la còpia
            </button>
          </div>
        </Modal>
      )}
      {toast}
    </>
  )
}
