// Lliurament d'informes: previsualització del correu, llista del que no es pot enviar (per desar-ho o imprimir-ho)
// i lliurament de l'informe «Així et veiem» a cada docent.

import { useState, type ReactNode } from 'react'
import { STAGES } from '../domain/catalog'
import type { TeacherReport } from '../domain/feedback'
import { APP_LINK, renderMail, senderOf, TEACHER_SENDER, type RenderedMail } from '../domain/mail'
import type { FeedbackStatus, MailSettings, StageId } from '../domain/types'
import { FeedbackReportPages } from '../report/FeedbackReport'
import { Icon, Modal, useToast } from '../ui/common'
import { PrintPortal } from './shared'

export type OutputMode = 'save' | 'print'

/** Capçalera i cos del correu tal com el veurà qui el rep. */
export function MailPreview({ mail, from, replyTo, picker }: { mail: RenderedMail; from: { name: string; email: string }; replyTo: string; picker?: ReactNode }) {
  return (
    <div className="mail-preview">
      <dl className="mail-head">
        <dt>De</dt>
        <dd>{from.name} &lt;{from.email || 'compte pendent'}&gt;</dd>
        <dt>Respon a</dt>
        <dd>{replyTo}</dd>
        <dt>Assumpte</dt>
        <dd><b>{mail.subject}</b></dd>
        <dt>Adjunt</dt>
        <dd><Icon name="file" /> {mail.attachment}</dd>
      </dl>
      {picker}
      <iframe className="mail-frame" title="Previsualització del correu" sandbox="" srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0">${mail.html}</body>`} />
    </div>
  )
}

export interface PaperItem {
  id: string
  name: string
  sub?: string
  reason: string
  /** Fals si no hi ha cap informe per desar (p. ex. sense resposta). */
  printable: boolean
}

/**
 * Informes que no s'enviaran per correu: surten sols, es poden triar un per un o tots alhora, i desar en PDF o imprimir.
 * Els dos botons obren el diàleg d'impressió del navegador; «Desa en PDF» hi deixa preparat el nom del fitxer.
 */
export function PaperList({ title, items, onOutput }: { title: string; items: PaperItem[]; onOutput: (ids: string[], mode: OutputMode) => void }) {
  const printable = items.filter((x) => x.printable)
  const [sel, setSel] = useState<Set<string>>(() => new Set(printable.map((x) => x.id)))
  if (!items.length) return null
  const picked = printable.filter((x) => sel.has(x.id)).map((x) => x.id)
  const toggle = (id: string, on: boolean) => setSel((p) => {
    const n = new Set(p)
    if (on) n.add(id)
    else n.delete(id)
    return n
  })
  return (
    <section className="paper-list">
      <div className="row">
        <h3><Icon name="print" /> {title} ({items.length})</h3>
        <span className="spacer" />
        <button className="btn small ghost" disabled={picked.length === printable.length} onClick={() => setSel(new Set(printable.map((x) => x.id)))}>Tots</button>
        <button className="btn small ghost" disabled={!picked.length} onClick={() => setSel(new Set())}>Cap</button>
      </div>
      <ul>
        {items.map((x) => (
          <li key={x.id}>
            <label className="check">
              <input type="checkbox" disabled={!x.printable} checked={x.printable && sel.has(x.id)} onChange={(e) => toggle(x.id, e.target.checked)} />
              <span><b>{x.name}</b>{x.sub && <small className="muted"> · {x.sub}</small>}</span>
            </label>
            <span className={`badge ${x.printable ? 'warn' : 'bad'}`}>{x.reason}</span>
          </li>
        ))}
      </ul>
      <div className="row">
        <small className="muted" style={{ flex: '1 1 16rem' }}>«Desa en PDF» obre el diàleg del navegador amb el nom del fitxer preparat: a <b>Destinació</b>, tria «Desa com a PDF».</small>
        <button className="btn small" disabled={!picked.length} onClick={() => onOutput(picked, 'save')}><Icon name="download" /> Desa en PDF ({picked.length})</button>
        <button className="btn primary small" disabled={!picked.length} onClick={() => onOutput(picked, 'print')}><Icon name="print" /> Imprimeix ({picked.length})</button>
      </div>
    </section>
  )
}

const EMAIL = /^[^\s@;,]+@[^\s@;,]+\.[a-z]{2,}$/i
export const isValidEmail = (x: string) => EMAIL.test(x.trim())

const PUBLISHED: FeedbackStatus[] = ['PUBLICADA', 'ARXIVADA']

const STAGE_WORDS: Record<StageId, string> = { CM: 'cicle mitjà', CS: 'cicle superior', ESO: 'ESO' }

/** «cicle superior i ESO» */
export const stagesText = (stages: StageId[]) => {
  const names = stages.map((st) => STAGE_WORDS[st])
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} i ${names[names.length - 1]}` : names[0] ?? ''
}

export interface TeacherRow { email: string; name: string; stages: StageId[]; n: number }

/**
 * Lliurament de l'informe «Així et veiem» per correu a cada docent seleccionat (Equip Directiu).
 * Mostra el correu personalitzat, qui el rebrà i, a part, els informes que no es poden enviar.
 */
export function TeacherDelivery({ campaign, rows, mail, loadReports, canEdit, onEdit, onClose }: {
  campaign: { label: string; year: string; status: FeedbackStatus }
  rows: TeacherRow[]
  mail: MailSettings
  loadReports: (emails: string[]) => Promise<TeacherReport[]>
  canEdit: boolean
  onEdit: () => void
  onClose: () => void
}) {
  const published = PUBLISHED.includes(campaign.status)
  const reason = (t: TeacherRow) => (!t.stages.length ? 'Sense informe' : !isValidEmail(t.email) ? 'Correu no vàlid' : !t.n ? 'Sense valoracions' : '')
  const sendable = rows.filter((t) => !reason(t))
  const paper: PaperItem[] = rows.filter((t) => reason(t)).map((t) => ({ id: t.email, name: t.name, sub: t.email, reason: reason(t), printable: !!t.stages.length }))
  const [who, setWho] = useState(sendable[0]?.email ?? '')
  const [batch, setBatch] = useState<{ reports: TeacherReport[]; title?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, showToast] = useToast()
  const varsOf = (t: TeacherRow) => ({ docent: t.name.split(' ')[0], docent_complet: t.name, etapes: stagesText(t.stages), recollida: campaign.label, curs_escolar: campaign.year, enllac: APP_LINK })
  const shown = sendable.find((t) => t.email === who) ?? sendable[0]
  const preview = shown && renderMail('teachers', mail, varsOf(shown))
  const output = async (emails: string[], mode: OutputMode) => {
    setBusy(true)
    try {
      const reports = await loadReports(emails)
      const one = reports.length === 1 ? reports[0].teacher.name : `${reports.length} docents`
      setBatch({ reports, title: mode === 'save' ? `Així et veiem – ${one} – ${campaign.label}` : undefined })
    } catch (e) {
      showToast((e as Error).message)
    }
    setBusy(false)
  }
  return (
    <Modal title="Lliurament de «Així et veiem» al professorat" onClose={onClose} wide>
      <p>Cada docent rep el seu informe en PDF al seu correu de l’escola, amb un missatge personal. Res no s’envia fins a l’aprovació final.</p>
      {!published && (
        <div className="notice warn">
          <Icon name="alert" />
          <div>Els informes encara no s’han publicat als docents. Publica la recollida (<b>Et veig… › Recollides › Publica als docents</b>) abans d’enviar-los.</div>
        </div>
      )}
      {preview && shown && (
        <div className="delivery-grid">
          <MailPreview
            mail={preview}
            from={senderOf('teachers', mail)}
            replyTo={TEACHER_SENDER.email}
            picker={
              <div className="row">
                <label className="field" style={{ flex: 1 }}>
                  <span>Previsualitza el correu de</span>
                  <select className="select" value={shown.email} onChange={(e) => setWho(e.target.value)}>
                    {sendable.map((t) => <option key={t.email} value={t.email}>{t.name}</option>)}
                  </select>
                </label>
                {canEdit && <button className="btn small" onClick={onEdit}><Icon name="edit" /> Edita el text</button>}
              </div>
            }
          />
          <div className="table-wrap" style={{ maxHeight: 440, overflow: 'auto', alignSelf: 'start' }}>
            <table className="t">
              <thead><tr><th>Docent</th><th>Informe</th></tr></thead>
              <tbody>
                {sendable.map((t) => (
                  <tr key={t.email}>
                    <td><b>{t.name}</b><br /><small className="muted">{t.email}</small></td>
                    <td>{t.stages.map((st) => STAGES[st].short).join(' · ')}<br /><small className="muted">{t.n} valoracions</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!canEdit && <p className="muted" style={{ fontSize: '.88rem' }}>El text del missatge el pot canviar l’administració a <b>Centre › Correu › Professorat</b>.</p>}
      <PaperList title="No s’enviaran per correu" items={paper} onOutput={output} />
      <div className="notice">
        <Icon name="cloud" />
        <div>
          <b>L’enviament real necessita el servidor de correu de l’escola.</b> Quan estigui connectat, aquí hi haurà «Envia’m una prova» i «Aprova i envia {sendable.length} correus», amb el registre de cada missatge. Els que fallin tornaran a sortir a la llista de dalt per desar-los o imprimir-los.
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {busy && <span className="muted">Preparant…</span>}
        <button className="btn" onClick={onClose}>Tanca</button>
        <button className="btn ev" disabled title="Disponible amb el servidor de correu connectat"><Icon name="mail" /> Envia’m una prova</button>
      </div>
      {batch && (
        <PrintPortal title={batch.title} onDone={() => setBatch(null)}>
          {batch.reports.map((r) => <FeedbackReportPages key={r.teacher.email} report={r} />)}
        </PrintPortal>
      )}
      {toast}
    </Modal>
  )
}
