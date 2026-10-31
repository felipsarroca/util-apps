import { useState } from 'react'
import { createCampaign, setCampaignStatus, templateById, updateCampaign, useDemoState, visibleGrades } from '../data/api'
import { gradeById, GRADES } from '../domain/catalog'
import type { Campaign, CampaignStatus, GradeId, Session } from '../domain/types'
import { fmtDate, Icon, Modal, useToast } from '../ui/common'
import { CAMPAIGN_LABEL, STATUS_FLOW } from './shared'
import { PageHead } from './StaffApp'

const NEXT_ACTION: Partial<Record<CampaignStatus, { to: CampaignStatus; label: string }>> = {
  ESBORRANY: { to: 'PROGRAMADA', label: 'Programa' },
  PROGRAMADA: { to: 'OBERTA', label: 'Obre a l’alumnat' },
  OBERTA: { to: 'TANCADA', label: 'Tanca' },
  TANCADA: { to: 'EN_REVISIO', label: 'Passa a revisió' },
  EN_REVISIO: { to: 'INFORMES_GENERATS', label: 'Marca informes generats' },
  INFORMES_GENERATS: { to: 'VALIDADA', label: 'Valida' },
  VALIDADA: { to: 'DISTRIBUIDA', label: 'Marca com a distribuïda' },
  DISTRIBUIDA: { to: 'ARXIVADA', label: 'Arxiva' },
}

export function CampaignsScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const isAdmin = session.role === 'admin'
  const grades = visibleGrades(s, session)
  const [creating, setCreating] = useState(false)
  const [extend, setExtend] = useState<Campaign | null>(null)
  const [confirm, setConfirm] = useState<{ c: Campaign; to: CampaignStatus; label: string } | null>(null)
  const [toast, showToast] = useToast()
  const list = s.campaigns.filter((c) => grades.includes(c.gradeId)).sort((a, b) => gradeById(a.gradeId).order - gradeById(b.gradeId).order || (a.start < b.start ? 1 : -1))

  const run = (fn: () => void, ok: string) => {
    try {
      fn()
      showToast(ok)
    } catch (e) {
      showToast((e as Error).message)
    }
  }

  return (
    <>
      <PageHead title="Recollides" sub="Cada recollida fixa el curs, el període, la versió del qüestionari i les matèries en el moment de crear-la.">
        {isAdmin && (
          <button className="btn primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> Nova recollida
          </button>
        )}
      </PageHead>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Curs</th>
              <th>Recollida</th>
              <th>Període</th>
              <th>Qüestionari</th>
              <th>Estat</th>
              {isAdmin && <th />}
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const t = templateById(s, c.templateVersionId)
              const idx = STATUS_FLOW.indexOf(c.status)
              const next = NEXT_ACTION[c.status]
              return (
                <tr key={c.id}>
                  <td><b>{gradeById(c.gradeId).name}</b></td>
                  <td>{c.label} <span className="muted">· {c.year}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(c.start)} – {fmtDate(c.end)}</td>
                  <td className="muted">{t ? `${t.name} v${t.version}` : '—'}</td>
                  <td>
                    <div className="status-steps" aria-label={`Estat: ${CAMPAIGN_LABEL[c.status]}`}>
                      {STATUS_FLOW.filter((x) => x !== 'ESBORRANY').map((x, i) => (
                        <span key={x} className={x === c.status ? 'cur' : i + 1 < idx ? 'past' : ''} title={CAMPAIGN_LABEL[x]}>
                          {x === c.status ? CAMPAIGN_LABEL[x] : CAMPAIGN_LABEL[x].slice(0, 1)}
                        </span>
                      ))}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="actions">
                      <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        {(c.status === 'OBERTA' || c.status === 'PROGRAMADA') && (
                          <button className="btn small" onClick={() => setExtend(c)}>Canvia dates</button>
                        )}
                        {c.status === 'TANCADA' && (
                          <button className="btn small" onClick={() => setConfirm({ c, to: 'OBERTA', label: 'Reobre' })}>Reobre</button>
                        )}
                        {next && (
                          <button className={`btn small${c.status === 'PROGRAMADA' || c.status === 'OBERTA' ? ' primary' : ''}`} onClick={() => setConfirm({ c, to: next.to, label: next.label })}>
                            {next.label}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!isAdmin && <p className="muted">Les recollides les obre i les tanca l’administració.</p>}

      {confirm && (
        <ConfirmStatus
          c={confirm.c}
          to={confirm.to}
          label={confirm.label}
          onClose={() => setConfirm(null)}
          onOk={(reason) => {
            run(() => setCampaignStatus(session, confirm.c.id, confirm.to, reason), `${gradeById(confirm.c.gradeId).name}: ${CAMPAIGN_LABEL[confirm.to].toLowerCase()}`)
            setConfirm(null)
          }}
        />
      )}
      {extend && (
        <ExtendDates
          c={extend}
          onClose={() => setExtend(null)}
          onOk={(start, end, reason) => {
            run(() => updateCampaign(session, extend.id, { start, end }, `dates ${start} → ${end}. Motiu: ${reason}`), 'Dates actualitzades')
            setExtend(null)
          }}
        />
      )}
      {creating && (
        <NewCampaign
          onClose={() => setCreating(false)}
          onOk={(gs, label, start, end) => {
            run(() => gs.forEach((g) => createCampaign(session, g, label, start, end)), gs.length === 1 ? 'Recollida creada' : `${gs.length} recollides creades`)
            setCreating(false)
          }}
        />
      )}
      {toast}
    </>
  )
}

function ConfirmStatus({ c, to, label, onClose, onOk }: { c: Campaign; to: CampaignStatus; label: string; onClose: () => void; onOk: (reason?: string) => void }) {
  const [reason, setReason] = useState('')
  const reopen = to === 'OBERTA' && c.status === 'TANCADA'
  return (
    <Modal title={`${label}: ${gradeById(c.gradeId).name} · ${c.label}`} onClose={onClose}>
      {to === 'OBERTA' && <p>L’alumnat de {gradeById(c.gradeId).name} podrà respondre l’autoavaluació a partir d’ara.</p>}
      {to === 'TANCADA' && <p>L’alumnat ja no podrà modificar les respostes. Les autoavaluacions a mitges es conserven, però no comptaran com a lliurades.</p>}
      {reopen && (
        <label className="field">
          <span>Motiu de la reobertura (queda registrat)</span>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cancel·la</button>
        <button className="btn primary" disabled={reopen && !reason.trim()} onClick={() => onOk(reason.trim() || undefined)}>{label}</button>
      </div>
    </Modal>
  )
}

function ExtendDates({ c, onClose, onOk }: { c: Campaign; onClose: () => void; onOk: (s: string, e: string, r: string) => void }) {
  const [start, setStart] = useState(c.start)
  const [end, setEnd] = useState(c.end)
  const [reason, setReason] = useState('')
  const bad = end < start
  return (
    <Modal title={`Dates de ${gradeById(c.gradeId).name} · ${c.label}`} onClose={onClose}>
      <div className="row">
        <label className="field" style={{ flex: 1 }}><span>Inici</span><input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="field" style={{ flex: 1 }}><span>Tancament</span><input type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      {bad && <p className="notice bad">La data de tancament ha de ser posterior a la d’inici.</p>}
      <label className="field"><span>Motiu del canvi (queda registrat)</span><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ampliació per sortida de colònies" /></label>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cancel·la</button>
        <button className="btn primary" disabled={bad || !reason.trim()} onClick={() => onOk(start, end, reason.trim())}>Desa</button>
      </div>
    </Modal>
  )
}

function NewCampaign({ onClose, onOk }: { onClose: () => void; onOk: (g: GradeId[], label: string, s: string, e: string) => void }) {
  const [gs, setGs] = useState<GradeId[]>([])
  const [label, setLabel] = useState('2a avaluació')
  const [start, setStart] = useState('2027-03-01')
  const [end, setEnd] = useState('2027-03-12')
  return (
    <Modal title="Nova recollida" onClose={onClose}>
      <p className="muted">Es farà servir la darrera versió publicada del qüestionari de cada etapa i les matèries actuals de cada curs.</p>
      <label className="field"><span>Nom</span><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <span>Cursos</span>
        <div className="row">
          {GRADES.map((g) => (
            <label key={g.id} className="check">
              <input type="checkbox" checked={gs.includes(g.id)} onChange={(e) => setGs((p) => (e.target.checked ? [...p, g.id] : p.filter((x) => x !== g.id)))} />
              {g.name}
            </label>
          ))}
        </div>
        <div className="row">
          <button type="button" className="link-btn" onClick={() => setGs(GRADES.map((g) => g.id))}>Tots</button>
          <button type="button" className="link-btn" onClick={() => setGs(GRADES.filter((g) => g.stage !== 'ESO').map((g) => g.id))}>Primària</button>
          <button type="button" className="link-btn" onClick={() => setGs(GRADES.filter((g) => g.stage === 'ESO').map((g) => g.id))}>ESO</button>
        </div>
      </fieldset>
      <div className="row">
        <label className="field" style={{ flex: 1 }}><span>Inici</span><input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="field" style={{ flex: 1 }}><span>Tancament</span><input type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cancel·la</button>
        <button className="btn primary" disabled={!gs.length || !label.trim() || end < start} onClick={() => onOk(gs, label.trim(), start, end)}>Crea {gs.length > 1 ? `${gs.length} recollides` : 'la recollida'}</button>
      </div>
    </Modal>
  )
}
