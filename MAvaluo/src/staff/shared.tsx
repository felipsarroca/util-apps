import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { templateById, visibleStudents } from '../data/api'
import type { DemoState } from '../data/seed'
import { gradeById } from '../domain/catalog'
import { buildSteps, progress, subjectsForStudent } from '../domain/engine'
import type { Campaign, CampaignStatus, GradeId, ResponseStatus, Session, Student, StudentResponse } from '../domain/types'
import { buildReportModel, ReportPages } from '../report/Report'

export const STATUS_FLOW: CampaignStatus[] = ['ESBORRANY', 'PROGRAMADA', 'OBERTA', 'TANCADA', 'EN_REVISIO', 'INFORMES_GENERATS', 'VALIDADA', 'DISTRIBUIDA', 'ARXIVADA']

export const CAMPAIGN_LABEL: Record<CampaignStatus, string> = {
  ESBORRANY: 'Esborrany',
  PROGRAMADA: 'Programada',
  OBERTA: 'Oberta',
  TANCADA: 'Tancada',
  EN_REVISIO: 'En revisió',
  INFORMES_GENERATS: 'Informes generats',
  VALIDADA: 'Validada',
  DISTRIBUIDA: 'Distribuïda',
  ARXIVADA: 'Arxivada',
}

export const CAMPAIGN_TONE: Record<CampaignStatus, string> = {
  ESBORRANY: '', PROGRAMADA: 'info', OBERTA: 'ok', TANCADA: 'warn', EN_REVISIO: 'warn', INFORMES_GENERATS: 'brand', VALIDADA: 'brand', DISTRIBUIDA: 'ok', ARXIVADA: '',
}

export const RESP_LABEL: Record<ResponseStatus, string> = {
  NO_INICIADA: 'No iniciada',
  EN_CURS: 'En curs',
  LLIURADA: 'Lliurada',
  VALIDADA: 'Validada',
  INCIDENCIA: 'Incidència',
}
export const RESP_TONE: Record<ResponseStatus, string> = { NO_INICIADA: '', EN_CURS: 'warn', LLIURADA: 'ok', VALIDADA: 'ok', INCIDENCIA: 'bad' }

/** Recollida de referència d'un curs: la més recent de l'any que no està arxivada. */
export function currentCampaign(s: DemoState, gradeId: GradeId): Campaign | undefined {
  return s.campaigns
    .filter((c) => c.gradeId === gradeId && c.year === s.year && c.status !== 'ARXIVADA')
    .sort((a, b) => (a.start < b.start ? 1 : -1))[0]
}

export interface TrackRow {
  student: Student
  campaign?: Campaign
  response?: StudentResponse
  status: ResponseStatus
  ratio: number
}

export function trackingRows(s: DemoState, session: Session, campaignFor: (g: GradeId) => Campaign | undefined = (g) => currentCampaign(s, g)): TrackRow[] {
  return visibleStudents(s, session).map((student) => {
    const campaign = campaignFor(student.gradeId)
    const response = campaign && s.responses.find((r) => r.campaignId === campaign.id && r.studentId === student.id)
    let ratio = 0
    if (campaign && response) {
      const t = templateById(s, campaign.templateVersionId)!
      const subjects = subjectsForStudent(campaign.subjectsSnapshot, student, s.subjects)
      const prevGoal = buildReportModel(s, student.id, campaign.id)?.previousGoal
      ratio = progress(buildSteps(t, { stage: t.stage, subjects, previousGoal: prevGoal }), response.answers).ratio
    }
    return { student, campaign, response, status: response?.status ?? 'NO_INICIADA', ratio }
  })
}

export const fullName = (s: Student) => `${s.surname}, ${s.name}`
export const groupLabel = (s: Student) => `${gradeById(s.gradeId).name} ${s.group}`

/**
 * Imprimeix un conjunt d'informes. Es renderitzen fora de la pantalla, es paginen
 * i s'obre el diàleg d'impressió del navegador (permet «Desa com a PDF»).
 */
export function PrintJob({ state, items, duplex, onDone }: { state: DemoState; items: { studentId: string; campaignId: string }[]; duplex: boolean; onDone: () => void }) {
  return (
    <PrintPortal onDone={onDone}>
      {items.map((it) => {
        const m = buildReportModel(state, it.studentId, it.campaignId)
        return m ? <ReportPages key={`${it.studentId}-${it.campaignId}`} model={m} duplex={duplex} /> : null
      })}
    </PrintPortal>
  )
}

/** Imprimeix qualsevol conjunt de pàgines A4 (es preparen fora de la pantalla). */
export function PrintPortal({ children, onDone }: { children: ReactNode; onDone: () => void }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    document.body.classList.add('printing')
    const t = window.setTimeout(() => setReady(true), 400)
    return () => {
      window.clearTimeout(t)
      document.body.classList.remove('printing')
    }
  }, [])
  useEffect(() => {
    if (!ready) return
    const after = () => onDone()
    window.addEventListener('afterprint', after, { once: true })
    window.print()
    // Alguns navegadors no emeten afterprint: es tanca igualment.
    const t = window.setTimeout(onDone, 1500)
    return () => {
      window.removeEventListener('afterprint', after)
      window.clearTimeout(t)
    }
  }, [ready, onDone])
  return createPortal(<div className="print-root">{children}</div>, document.body)
}
