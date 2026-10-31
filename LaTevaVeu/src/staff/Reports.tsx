import { useMemo, useState } from 'react'
import { logAudit, useDemoState, visibleGrades } from '../data/api'
import { gradeById, GRADES } from '../domain/catalog'
import { gradeAndGroup, groupName } from '../domain/groups'
import { renderMail } from '../domain/mail'
import type { Session } from '../domain/types'
import { buildReportModel, ReportPages, SheetViewer } from '../report/Report'
import { Icon, Modal, useToast } from '../ui/common'
import { CAMPAIGN_LABEL, CAMPAIGN_TONE, fullName, PrintJob, RESP_LABEL, RESP_TONE, trackingRows } from './shared'
import { PageHead } from './StaffApp'

export function ReportsScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const grades = visibleGrades(s, session)
  const campaigns = s.campaigns
    .filter((c) => grades.includes(c.gradeId) && c.status !== 'ESBORRANY' && c.status !== 'PROGRAMADA')
    .sort((a, b) => gradeById(a.gradeId).order - gradeById(b.gradeId).order || (a.start < b.start ? 1 : -1))
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '')
  const campaign = s.campaigns.find((c) => c.id === campaignId)
  const rows = useMemo(
    () => (campaign ? trackingRows(s, session, (g) => (g === campaign.gradeId ? campaign : undefined)).filter((r) => r.student.gradeId === campaign.gradeId) : []),
    [s, session, campaign],
  )
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [noSend, setNoSend] = useState<Set<string>>(new Set())
  const [duplex, setDuplex] = useState(true)
  const [preview, setPreview] = useState<string | null>(null)
  const [printItems, setPrintItems] = useState<string[] | null>(null)
  const [prepare, setPrepare] = useState(false)
  const [toast, showToast] = useToast()

  const delivered = rows.filter((r) => r.status === 'LLIURADA' || r.status === 'VALIDADA')
  const hasMail = (id: string) => !!rows.find((r) => r.student.id === id)?.student.guardians.some((g) => g.validated) && !noSend.has(id)
  const selected = rows.filter((r) => sel.has(r.student.id))
  const toggle = (id: string) => setSel((p) => {
    const n = new Set(p)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  const print = (ids: string[]) => {
    if (!ids.length) return showToast('No hi ha cap informe per imprimir.')
    logAudit(session, 'Impressió d’informes', `${campaign!.gradeId} · ${campaign!.label}: ${ids.length} informes${duplex ? ' (doble cara)' : ''}`)
    setPrintItems(ids)
  }
  const model = preview && campaign ? buildReportModel(s, preview, campaign.id) : null
  const open = campaign?.status === 'OBERTA'

  return (
    <>
      <PageHead title="Informes i famílies" sub="Previsualitza, imprimeix en un sol PDF i prepara el lliurament a les famílies." />
      {!campaigns.length ? (
        <div className="card empty"><span className="em" aria-hidden="true">📭</span>Encara no hi ha cap recollida oberta o tancada.</div>
      ) : (
        <>
          <div className="toolbar">
            <label className="field" style={{ minWidth: 280 }}>
              <span>Recollida</span>
              <select className="select" value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setSel(new Set()) }}>
                {GRADES.filter((g) => grades.includes(g.id)).map((g) => (
                  <optgroup key={g.id} label={g.name}>
                    {campaigns.filter((c) => c.gradeId === g.id).map((c) => (
                      <option key={c.id} value={c.id}>{g.name} · {c.label} ({CAMPAIGN_LABEL[c.status].toLowerCase()})</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <span className="spacer" />
            <label className="toggle">
              <input type="checkbox" checked={duplex} onChange={(e) => setDuplex(e.target.checked)} />
              Doble cara (cada informe en cara nova)
            </label>
          </div>
          {campaign && (
            <div className="row">
              <span className={`badge ${CAMPAIGN_TONE[campaign.status]}`}>{CAMPAIGN_LABEL[campaign.status]}</span>
              <span className="muted">{delivered.length} lliurades de {rows.length} · {rows.filter((r) => !hasMail(r.student.id)).length} sense correu familiar validat</span>
            </div>
          )}
          {open && (
            <div className="notice warn">
              <Icon name="alert" />
              <div>La recollida encara és oberta: pots previsualitzar i imprimir per revisar, però l’enviament a les famílies només s’activa quan estigui tancada.</div>
            </div>
          )}
          <div className="toolbar">
            <button className="btn small" onClick={() => setSel(new Set(delivered.map((r) => r.student.id)))}>Selecciona les lliurades</button>
            <button className="btn small" onClick={() => setSel(new Set())} disabled={!sel.size}>Treu la selecció</button>
            <span className="spacer" />
            <button className="btn small" onClick={() => print(delivered.filter((r) => !hasMail(r.student.id)).map((r) => r.student.id))}>
              <Icon name="print" /> PDF dels que no tenen correu
            </button>
            <button className="btn primary small" disabled={!sel.size} onClick={() => print(selected.map((r) => r.student.id))}>
              <Icon name="print" /> PDF únic dels seleccionats ({sel.size})
            </button>
            <button className="btn gold small" disabled={!sel.size || open} onClick={() => setPrepare(true)} title={open ? 'Tanca la recollida abans d’enviar.' : undefined}>
              <Icon name="mail" /> Prepara l’enviament
            </button>
          </div>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Selecciona-ho tot"
                      checked={sel.size > 0 && sel.size === rows.length}
                      onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.student.id)) : new Set())}
                      style={{ width: 18, height: 18, accentColor: 'var(--brand)' }}
                    />
                  </th>
                  <th>Alumne</th>
                  <th>Resposta</th>
                  <th>Informe</th>
                  <th>Correu familiar</th>
                  <th>Canal</th>
                  <th>Enviament</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .sort((a, b) => a.student.group.localeCompare(b.student.group) || a.student.surname.localeCompare(b.student.surname))
                  .map((r) => {
                    const id = r.student.id
                    const validated = r.student.guardians.filter((g) => g.validated)
                    return (
                      <tr key={id}>
                        <td><input type="checkbox" checked={sel.has(id)} onChange={() => toggle(id)} aria-label={`Selecciona ${fullName(r.student)}`} style={{ width: 18, height: 18, accentColor: 'var(--brand)' }} /></td>
                        <td className="student-cell"><b>{fullName(r.student)}</b><small>{groupName(r.student.gradeId, r.student.group)}</small></td>
                        <td><span className={`badge ${RESP_TONE[r.status]}`}>{RESP_LABEL[r.status]}</span></td>
                        <td>
                          <button className="btn small" disabled={!r.response} onClick={() => setPreview(id)}><Icon name="eye" /> Veure</button>
                        </td>
                        <td>
                          {validated.length ? (
                            <span className="badge ok" title={validated.map((g) => g.email).join(', ')}>{validated.length === 1 ? '1 validat' : `${validated.length} validats`}</span>
                          ) : r.student.guardians.length ? (
                            <span className="badge warn">Pendent de validar</span>
                          ) : (
                            <span className="badge bad">Sense correu</span>
                          )}
                        </td>
                        <td>
                          <label className="check" style={{ fontWeight: 600, fontSize: '.88rem' }}>
                            <input type="checkbox" checked={noSend.has(id)} disabled={!validated.length} onChange={() => setNoSend((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })} />
                            {hasMail(id) ? 'Correu' : 'Paper'}
                            <span className="sr-only">Marca «no enviar per correu»</span>
                          </label>
                        </td>
                        <td><span className="badge plain">No enviat</span></td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: '.85rem' }}>
            La casella de «Canal» marca l’alumne com a «no enviar per correu»: el seu informe es lliurarà en paper.
          </p>
        </>
      )}

      {model && (
        <Modal title={`Informe de ${model.student.name} ${model.student.surname}`} onClose={() => setPreview(null)} wide>
          <div className="row">
            <span className="muted">Versió del qüestionari: {model.template.name} v{model.template.version} · revisió de resposta {model.response?.revision ?? 0}</span>
            <span className="spacer" />
            <button className="btn primary small" onClick={() => print([model.student.id])}><Icon name="print" /> Imprimeix o desa en PDF</button>
          </div>
          <SheetViewer><ReportPages model={model} /></SheetViewer>
        </Modal>
      )}

      {prepare && campaign && (
        <Modal title="Preparació de l’enviament" onClose={() => setPrepare(false)} wide>
          <p>Comprova exactament qui rebrà cada informe. Res no s’envia fins a l’aprovació final.</p>
          {selected[0] && (() => {
            const st = selected[0].student
            const mail = renderMail('families', s.mail, {
              alumne: st.name, alumne_complet: fullName(st), curs: gradeAndGroup(st.gradeId, st.group), recollida: campaign.label, curs_escolar: campaign.year,
            })
            return (
              <dl className="mail-head">
                <dt>De</dt>
                <dd>{s.mail.senderName} &lt;{s.mail.sender || 'compte pendent'}&gt;</dd>
                <dt>Respon a</dt>
                <dd>{s.mail.replyTo === 'tutor' ? 'el tutor o tutora del grup' : s.mail.replyToEmail}</dd>
                <dt>Assumpte</dt>
                <dd>{mail.subject}{selected.length > 1 ? ' (exemple del primer alumne)' : ''}</dd>
              </dl>
            )
          })()}
          {!s.mail.sender && (
            <div className="notice warn">
              <Icon name="alert" />
              <div>Encara no s’ha indicat el compte que envia. L’administració ho fa a <b>Centre › Correu</b>, on també es pot revisar el text del missatge.</div>
            </div>
          )}
          <div className="table-wrap" style={{ maxHeight: 360, overflow: 'auto' }}>
            <table className="t">
              <thead><tr><th>Alumne</th><th>Destinataris</th><th>Informe</th></tr></thead>
              <tbody>
                {selected.map((r) => (
                  <tr key={r.student.id}>
                    <td><b>{fullName(r.student)}</b></td>
                    <td>
                      {hasMail(r.student.id)
                        ? r.student.guardians.filter((g) => g.validated).map((g) => <div key={g.email}>{g.name} · <span className="muted">{g.email}</span></div>)
                        : <span className="badge warn">En paper</span>}
                    </td>
                    <td>{r.response ? `Revisió ${r.response.revision}` : <span className="badge bad">Sense resposta</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="notice">
            <Icon name="cloud" />
            <div>
              <b>L’enviament real necessita el servidor de l’escola.</b> Quan estigui connectat, aquí hi haurà «Envia’m una prova» i «Aprova i envia»: cua al servidor, clau idempotent per alumne, destinatari i versió del PDF (sense duplicats) i registre de cada intent.
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setPrepare(false)}>Tanca</button>
            <button className="btn gold" disabled title="Disponible amb el servidor connectat"><Icon name="mail" /> Envia’m una prova</button>
          </div>
        </Modal>
      )}
      {printItems && campaign && (
        <PrintJob state={s} items={printItems.map((studentId) => ({ studentId, campaignId: campaign.id }))} duplex={duplex && printItems.length > 1} onDone={() => setPrintItems(null)} />
      )}
      {toast}
    </>
  )
}
