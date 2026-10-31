// Pantalles d'«Et veig» per al professorat, l'Equip Directiu i l'administració.

import { useMemo, useState } from 'react'
import {
  acceptUnflagged, centerView, createFeedbackCampaign, isDirection, logReportView, moderateComment, RESULTS_VISIBLE_DIRECTION, RESULTS_VISIBLE_TEACHER,
  saveSelfAssessment, selfAssessmentTasks, setFeedbackStatus, teacherReport, useDemoState,
} from '../data/api'
import { GRADES, STAGES } from '../domain/catalog'
import { groupName, groupNameOfKey } from '../domain/groups'
import { eligibleStudents, groupKey, stageOfGrade, stagesOfTeacher, teachersForStudent, THRESHOLD } from '../domain/feedback'
import type { TeacherReport } from '../domain/feedback'
import { CONTEXT_TAGS, type Answers, type FeedbackCampaign, type FeedbackStatus, type SelfTask, type Session, type StageId } from '../domain/types'
import { BarLegend, CenterReportPages, DistBar, FeedbackReportPages, heat } from '../report/FeedbackReport'
import { SheetViewer } from '../report/Report'
import { SegScale } from '../student/Questions'
import { TeacherAvatar } from '../student/EtVeig'
import { fmtDate, Icon, Modal, useToast } from '../ui/common'
import { PageHead } from './StaffApp'
import { PrintPortal } from './shared'

export const FB_LABEL: Record<FeedbackStatus, string> = {
  ESBORRANY: 'Esborrany', PROGRAMADA: 'Programada', OBERTA: 'Oberta', TANCADA: 'Tancada', MODERACIO: 'Moderació',
  INFORMES_GENERATS: 'Informes generats', PUBLICADA: 'Publicada', ARXIVADA: 'Arxivada',
}
export const FB_TONE: Record<FeedbackStatus, string> = {
  ESBORRANY: '', PROGRAMADA: 'info', OBERTA: 'ok', TANCADA: 'warn', MODERACIO: 'warn', INFORMES_GENERATS: 'brand', PUBLICADA: 'ok', ARXIVADA: '',
}
const FLOW: FeedbackStatus[] = ['ESBORRANY', 'PROGRAMADA', 'OBERTA', 'TANCADA', 'MODERACIO', 'INFORMES_GENERATS', 'PUBLICADA', 'ARXIVADA']
export const NEXT: Partial<Record<FeedbackStatus, { to: FeedbackStatus; label: string }>> = {
  ESBORRANY: { to: 'PROGRAMADA', label: 'Programa-la' },
  PROGRAMADA: { to: 'OBERTA', label: 'Obre-la ara' },
  OBERTA: { to: 'TANCADA', label: 'Tanca la recollida' },
  TANCADA: { to: 'MODERACIO', label: 'Passa a moderació' },
  MODERACIO: { to: 'INFORMES_GENERATS', label: 'Genera els informes' },
  INFORMES_GENERATS: { to: 'PUBLICADA', label: 'Publica als docents' },
  PUBLICADA: { to: 'ARXIVADA', label: 'Arxiva' },
}

const pct = (x: number) => `${Math.round(x * 100)} %`
const stageNames = (c: FeedbackCampaign) => c.stages.map((st) => STAGES[st].short).join(' · ')

// ---------- Autoavaluació docent ----------

export function SelfAssessScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const tasks: SelfTask[] = selfAssessmentTasks(s, session).map((t) => ({
    ...t,
    scale: s.scales.find((x) => x.id === t.form.scaleId)!,
    groups: [...new Set(t.campaign.assignments.filter((a) => a.teacherEmail === session.email && stageOfGrade(a.gradeId) === t.stage).map((a) => groupKey(a.gradeId, a.group)))],
  }))
  return <SelfAssessView tasks={tasks} save={(t, answers, context, submit) => saveSelfAssessment(session, t.campaign.id, t.stage, answers, context, submit)} />
}

export type SaveSelf = (task: SelfTask, answers: Answers, context: Record<string, string[]>, submit: boolean) => void | Promise<void>

/** Llista i formulari de l'autoavaluació docent: el mateix per a la demostració i per al mode connectat. */
export function SelfAssessView({ tasks, save }: { tasks: SelfTask[]; save: SaveSelf }) {
  const [open, setOpen] = useState<string | null>(null)
  const task = tasks.find((t) => `${t.campaign.id}|${t.stage}` === open)
  if (task) return <SelfForm key={open} task={task} save={save} onBack={() => setOpen(null)} />
  return (
    <>
      <PageHead title="La meva autoavaluació" sub="Una per etapa on fas classe. Fes-la abans de veure els resultats: l’informe hi contrastarà la mirada de l’alumnat." />
      {!tasks.length && (
        <div className="card empty">
          <span className="em" aria-hidden="true">🗓️</span>Ara no hi ha cap recollida d’«Et veig» oberta en què participis.
        </div>
      )}
      <div className="cards-list">
        {tasks.map((t) => {
          const state = t.self?.submittedAt ? 'Lliurada' : t.self ? 'Esborrany' : 'Pendent'
          return (
            <section key={`${t.campaign.id}|${t.stage}`} className="card panel ev-card">
              <div className="row">
                <div className="mod-kicker ev">
                  <span aria-hidden="true">👀</span> {t.campaign.label} · {t.campaign.year}
                </div>
                <span className="spacer" />
                <span className={`badge ${t.self?.submittedAt ? 'ok' : t.self ? 'warn' : 'info'}`}>{state}</span>
              </div>
              <h2>{STAGES[t.stage].name}</h2>
              <p className="muted">
                {t.form.items.length} afirmacions · {t.campaign.status === 'OBERTA' ? `l’alumnat respon fins al ${fmtDate(t.campaign.end)}` : 'recollida tancada: encara pots lliurar-la fins a la moderació'}
              </p>
              <div className="row">
                <button className={`btn ${t.self?.submittedAt ? '' : 'primary ev'}`} onClick={() => setOpen(`${t.campaign.id}|${t.stage}`)}>
                  {t.self?.submittedAt ? 'Consulta-la' : t.self ? 'Continua' : 'Comença'} <Icon name="arrowR" />
                </button>
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}

function SelfForm({ task, save, onBack }: { task: SelfTask; save: SaveSelf; onBack: () => void }) {
  const { campaign, stage, form, self, scale, groups } = task
  const [answers, setAnswers] = useState<Answers>(self?.answers ?? {})
  const [context, setContext] = useState<Record<string, string[]>>(self?.context ?? {})
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, showToast] = useToast()
  const locked = !!self?.submittedAt
  const missing = form.items.filter((i) => !answers[i.id]).length
  const doSave = async (submit: boolean) => {
    setBusy(true)
    try {
      await save(task, answers, context, submit)
      showToast(submit ? 'Autoavaluació lliurada. Gràcies!' : 'Esborrany desat.')
      if (submit) setConfirm(false)
    } catch (e) {
      showToast((e as Error).message)
    }
    setBusy(false)
  }
  const toggleTag = (g: string, tag: string) =>
    setContext((c) => {
      const cur = c[g] ?? []
      return { ...c, [g]: cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag] }
    })
  return (
    <>
      <PageHead title={`Autoavaluació · ${STAGES[stage].name}`} sub={`${campaign.label} · ${campaign.year}`}>
        <button className="btn" onClick={onBack}>
          <Icon name="arrowL" /> Tornar
        </button>
      </PageHead>
      <div className="notice">
        <Icon name="info" />
        <div>
          Respon pensant en el conjunt dels teus grups d’aquesta etapa: són les mateixes afirmacions que respon l’alumnat, en primera persona. Si algun grup és diferent, marca-ho a <b>Context dels grups</b>: apareixerà al costat dels seus resultats.
        </div>
      </div>
      {locked && (
        <div className="notice ok">
          <Icon name="check" />
          <div>Lliurada el {fmtDate(self!.submittedAt!, true)}. Ja no es pot modificar.</div>
        </div>
      )}
      {form.dimensions.map((d) => (
        <section key={d.id} className="card panel">
          <h2>
            <span aria-hidden="true">{d.emoji}</span> {d.name}
          </h2>
          <div className="qlist">
            {form.items
              .filter((i) => i.dimensionId === d.id)
              .map((i) => (
                <fieldset key={i.id} className={`qrow inline self-row${answers[i.id] ? ' done' : ''}`} disabled={locked}>
                  <legend className="sr-only">{i.teacher}</legend>
                  <div className="qtext" aria-hidden="true">
                    <span style={{ flex: 1 }}>{i.teacher}</span>
                  </div>
                  <SegScale name={`self-${i.id}`} scale={scale} value={answers[i.id]} label={i.teacher} onChange={(v) => setAnswers((a) => ({ ...a, [i.id]: v }))} />
                </fieldset>
              ))}
          </div>
        </section>
      ))}
      <section className="card panel">
        <h2>Context dels grups <span className="muted" style={{ fontWeight: 700, fontSize: '.85rem' }}>(opcional)</span></h2>
        <p className="muted">Les etiquetes no valoren res: expliquen per què un grup pot ser diferent.</p>
        <div className="ctx-grid">
          {groups.map((g) => (
            <fieldset key={g} className="ctx-group" disabled={locked}>
              <legend>{groupNameOfKey(g)}</legend>
              {CONTEXT_TAGS.map((t) => (
                <label key={t.id} className="check">
                  <input type="checkbox" checked={context[g]?.includes(t.id) ?? false} onChange={() => toggleTag(g, t.id)} />
                  {t.label}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      </section>
      {!locked && (
        <div className="row sticky-actions">
          <span className="muted" style={{ fontWeight: 700 }}>{missing ? `Falten ${missing} afirmacions` : 'Ho tens tot'}</span>
          <span className="spacer" />
          <button className="btn" disabled={busy} onClick={() => doSave(false)}>Desa l’esborrany</button>
          <button className="btn primary ev" disabled={missing > 0 || busy} onClick={() => setConfirm(true)}>
            Lliura <Icon name="check" />
          </button>
        </div>
      )}
      {confirm && (
        <Modal title="Lliures l’autoavaluació?" onClose={() => setConfirm(false)}>
          <p>Un cop lliurada no es podrà modificar. Es farà servir per contrastar-la amb la mirada de l’alumnat a l’informe «Així et veiem».</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirm(false)}>Encara no</button>
            <button className="btn primary ev" disabled={busy} onClick={() => doSave(true)}>Sí, lliura-la</button>
          </div>
        </Modal>
      )}
      {toast}
    </>
  )
}

// ---------- Així et veiem ----------

export function MyReportsScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const dir = isDirection(session)
  const visible = dir ? RESULTS_VISIBLE_DIRECTION : RESULTS_VISIBLE_TEACHER
  const campaigns = s.feedbackCampaigns
    .filter((c) => visible.includes(c.status) && (dir || c.teachers.includes(session.email)))
    .sort((a, b) => (a.start < b.start ? 1 : -1))
  const [cid, setCid] = useState(campaigns[0]?.id ?? '')
  const campaign = campaigns.find((c) => c.id === cid)
  const teachers = campaign ? [...campaign.teachers].map((e) => ({ email: e, name: s.staff.find((x) => x.email === e)?.name ?? e })).sort((a, b) => a.name.localeCompare(b.name, 'ca')) : []
  const [teacher, setTeacher] = useState(dir ? '' : session.email)
  const pending = s.feedbackCampaigns.filter((c) => !visible.includes(c.status) && c.teachers.includes(session.email) && ['OBERTA', 'TANCADA', 'MODERACIO', 'INFORMES_GENERATS'].includes(c.status))
  return (
    <>
      <PageHead title="Així et veiem" sub={dir ? 'Informes de tots els docents. Cada consulta queda registrada.' : 'La mirada conjunta de l’alumnat sobre les teves classes. Només tu i l’Equip Directiu el podeu veure.'} />
      {!dir &&
        pending.map((c) => (
          <div key={c.id} className="notice">
            <Icon name="info" />
            <div>
              <b>{c.label}</b>: {c.status === 'OBERTA' ? `l’alumnat respon fins al ${fmtDate(c.end)}.` : 'la recollida s’ha tancat.'} L’informe es publicarà quan l’Equip Directiu hagi revisat els comentaris.
            </div>
          </div>
        ))}
      {!campaigns.length ? (
        <div className="card empty">
          <span className="em" aria-hidden="true">📭</span>Encara no hi ha cap informe publicat.
        </div>
      ) : (
        <>
          <div className="toolbar">
            <label className="sr-only" htmlFor="fb-c">Recollida</label>
            <select id="fb-c" className="select" value={cid} onChange={(e) => setCid(e.target.value)}>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} · {c.year}
                </option>
              ))}
            </select>
            {dir && (
              <>
                <label className="sr-only" htmlFor="fb-t">Docent</label>
                <select id="fb-t" className="select" value={teacher} onChange={(e) => setTeacher(e.target.value)}>
                  <option value="">Tria un docent…</option>
                  {teachers.map((t) => (
                    <option key={t.email} value={t.email}>{t.name}</option>
                  ))}
                </select>
              </>
            )}
          </div>
          {campaign && teacher && <ReportView key={`${cid}-${teacher}`} session={session} campaignId={cid} teacherEmail={teacher} />}
          {dir && !teacher && <p className="muted">Tria un docent per veure el seu informe, o consulta la <b>Visió de centre</b>.</p>}
        </>
      )}
    </>
  )
}

export function ReportView({ session, campaignId, teacherEmail }: { session: Session; campaignId: string; teacherEmail: string }) {
  const s = useDemoState()
  const report = useMemo(() => {
    try {
      return teacherReport(session, campaignId, teacherEmail)
    } catch {
      return null
    }
    // L'informe es recalcula quan canvien les dades (p. ex. després de moderar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, campaignId, teacherEmail, s])
  const [printing, setPrinting] = useState(false)
  if (!report) return <div className="notice bad"><Icon name="alert" /><div>No tens permís per veure aquest informe.</div></div>
  if (!report.stages.length) return <p className="muted">Aquest docent no té dades en aquesta recollida.</p>
  return (
    <>
      <div className="row no-print">
        <div className="report-kpis">
          {report.stages.map((st) => (
            <span key={st.stage} className={`badge ${st.suppressed ? 'warn' : 'ok'}`}>
              {STAGES[st.stage].short}: {st.n} respostes{st.suppressed ? ' (mostra insuficient)' : ''}
            </span>
          ))}
        </div>
        <span className="spacer" />
        <button
          className="btn primary small ev"
          onClick={() => {
            logReportView(session, campaignId, teacherEmail, 'Descàrrega')
            setPrinting(true)
          }}
        >
          <Icon name="print" /> Imprimeix o desa en PDF
        </button>
      </div>
      <SheetViewer>
        <FeedbackReportPages report={report} />
      </SheetViewer>
      {printing && (
        <PrintPortal onDone={() => setPrinting(false)}>
          <FeedbackReportPages report={report} />
        </PrintPortal>
      )}
    </>
  )
}

// ---------- Visió de centre (Equip Directiu) ----------

export function CenterScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const campaigns = s.feedbackCampaigns.filter((c) => RESULTS_VISIBLE_DIRECTION.includes(c.status)).sort((a, b) => (a.start < b.start ? 1 : -1))
  const [cid, setCid] = useState(campaigns[0]?.id ?? '')
  const [open, setOpen] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const view = useMemo(() => {
    try {
      return cid ? centerView(session, cid) : []
    } catch {
      return []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, session, s])
  const campaign = campaigns.find((c) => c.id === cid)
  const running = s.feedbackCampaigns.filter((c) => ['OBERTA', 'TANCADA', 'MODERACIO'].includes(c.status))
  if (!campaigns.length) return <PageHead title="Visió de centre" sub="Encara no hi ha cap recollida amb informes generats." />
  const teacherCount = new Set(view.flatMap((v) => v.teachers.map((t) => t.email))).size
  const selfDone = view.flatMap((v) => v.teachers).filter((t) => t.self).length
  const selfTotal = view.flatMap((v) => v.teachers).length
  return (
    <>
      <PageHead title="Visió de centre" sub="Mirada agregada de l’alumnat sobre la docència. Ordenat alfabèticament: no hi ha rànquings ni notes úniques.">
        <select className="select" style={{ width: 'auto' }} value={cid} onChange={(e) => setCid(e.target.value)} aria-label="Recollida">
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.label} · {c.year}</option>
          ))}
        </select>
        <button className="btn primary ev" disabled={!view.length} onClick={() => setPrinting(true)}>
          <Icon name="print" /> Imprimeix o desa en PDF
        </button>
      </PageHead>
      {running.map((c) => (
        <div key={c.id} className="notice">
          <Icon name="info" />
          <div>
            <b>{c.label}</b> és en estat «{FB_LABEL[c.status]}». Els resultats apareixeran aquí quan es generin els informes.
          </div>
        </div>
      ))}
      <div className="kpis">
        <div className="card kpi accent ev">
          <span className="l">Participació</span>
          <span className="v">{pct(view.reduce((a, v) => a + v.participants, 0) / Math.max(1, view.reduce((a, v) => a + v.students, 0)))}</span>
          <span className="s">{view.reduce((a, v) => a + v.participants, 0)} alumnes hi han participat</span>
        </div>
        {view.map((v) => (
          <div key={v.stage} className="card kpi">
            <span className="l">{STAGES[v.stage].name}</span>
            <span className="v">{pct(v.participants / Math.max(1, v.students))}</span>
            <span className="s">{v.participants} de {v.students} alumnes</span>
          </div>
        ))}
        <div className="card kpi">
          <span className="l">Autoavaluacions docents</span>
          <span className="v">{selfDone}/{selfTotal}</span>
          <span className="s">{teacherCount} docents en aquesta recollida</span>
        </div>
      </div>

      {view.map((v) => {
        const sorted = [...v.dims].filter((d) => d.dist.valid).sort((a, b) => b.dist.fav - a.dist.fav)
        return (
          <section key={v.stage} className="card panel">
            <div className="row">
              <h2>{STAGES[v.stage].name}</h2>
              <span className="spacer" />
              <BarLegend scale={v.scale} />
            </div>
            <div className="grid-2 center-grid">
              <div className="center-dims">
                {v.dims.map((d) => (
                  <div key={d.dim.id} className="center-dim">
                    <span className="nm">
                      <span aria-hidden="true">{d.dim.emoji}</span> {d.dim.name}
                    </span>
                    <DistBar dist={d.dist} scale={v.scale} wide />
                    <b>{pct(d.dist.fav)}</b>
                    <small className={d.prevFav === undefined ? 'muted' : d.dist.fav - d.prevFav >= 0.05 ? 'up' : d.dist.fav - d.prevFav <= -0.05 ? 'down' : 'muted'}>
                      {d.prevFav === undefined ? '' : `${d.dist.fav - d.prevFav >= 0 ? '+' : ''}${Math.round((d.dist.fav - d.prevFav) * 100)}`}
                    </small>
                  </div>
                ))}
              </div>
              <div className="center-sw">
                <div className="sw ok">
                  <b>Fortaleses de l’etapa</b>
                  {sorted.slice(0, 2).map((d) => <span key={d.dim.id}>{d.dim.emoji} {d.dim.name} · {pct(d.dist.fav)}</span>)}
                </div>
                <div className="sw warn">
                  <b>Reptes de l’etapa</b>
                  {sorted.slice(-2).reverse().map((d) => <span key={d.dim.id}>{d.dim.emoji} {d.dim.name} · {pct(d.dist.fav)}</span>)}
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table className="t heat">
                <thead>
                  <tr>
                    <th>Docent</th>
                    <th className="num">Respostes</th>
                    {v.form.dimensions.map((d) => (
                      <th key={d.id} className="num" title={d.name}>
                        <span aria-hidden="true">{d.emoji}</span> {d.name.split(' ')[0]}
                      </th>
                    ))}
                    <th>Autoavaluació</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {v.teachers.map((t) => (
                    <tr key={t.email}>
                      <td>
                        <span className="row" style={{ gap: '.5rem', flexWrap: 'nowrap' }}>
                          <TeacherAvatar t={t} size={28} />
                          <b>{t.name}</b>
                        </span>
                      </td>
                      <td className="num">{t.n}</td>
                      {t.suppressed ? (
                        <td colSpan={v.form.dimensions.length} className="muted">Mostra insuficient (menys de {THRESHOLD})</td>
                      ) : (
                        v.form.dimensions.map((d) => (
                          <td key={d.id} className="num heat-cell" style={{ background: heat(t.fav[d.id]) }}>
                            {pct(t.fav[d.id])}
                          </td>
                        ))
                      )}
                      <td>{t.self ? <span className="badge ok">Feta</span> : <span className="badge">No</span>}</td>
                      <td className="actions">
                        <button className="btn small" onClick={() => { logReportView(session, cid, t.email, 'Consulta'); setOpen(t.email) }}>
                          <Icon name="eye" /> Informe
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ fontSize: '.85rem' }}>Percentatge de valoracions favorables («Sovint» o «Sempre»; a cicle mitjà, «Sí!»). La variació respecte de la recollida anterior es mostra en punts.</p>
          </section>
        )
      })}
      {open && campaign && (
        <Modal title={`Així et veiem · ${s.staff.find((x) => x.email === open)?.name}`} onClose={() => setOpen(null)} wide>
          <ReportView session={session} campaignId={cid} teacherEmail={open} />
        </Modal>
      )}
      {printing && campaign && (
        <PrintPortal onDone={() => setPrinting(false)}>
          <CenterReportPages view={view} campaign={campaign} />
        </PrintPortal>
      )}
    </>
  )
}

/** Estat de cada docent d'una recollida: valoracions rebudes (només el recompte) i autoavaluació lliurada. */
function teacherRows(s: ReturnType<typeof useDemoState>, c: FeedbackCampaign) {
  return [...c.teachers]
    .map((email) => {
      const stages = stagesOfTeacher(c, email)
      const n = s.participation.filter((p) => p.campaignId === c.id && p.teacherEmail === email).length
      const eligible = stages.reduce((a, st) => a + eligibleStudents(s, c, email, st).length, 0)
      const selfs = stages.map((st) => s.selfAssessments.find((x) => x.campaignId === c.id && x.teacherEmail === email && x.stage === st))
      return { email, name: s.staff.find((x) => x.email === email)?.name ?? email, n, eligible, stages, selfDone: selfs.filter((x) => x?.submittedAt).length }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ca'))
}

// ---------- Seguiment del professorat (Equip Directiu) ----------

export function TeachersScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const campaigns = s.feedbackCampaigns.filter((c) => !['ESBORRANY', 'PROGRAMADA'].includes(c.status)).sort((a, b) => (a.start < b.start ? 1 : -1))
  const [cid, setCid] = useState(campaigns[0]?.id ?? '')
  const [onlyPending, setOnlyPending] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [batch, setBatch] = useState<TeacherReport[] | null>(null)
  const [toast, showToast] = useToast()
  const c = campaigns.find((x) => x.id === cid)
  if (!c) return <PageHead title="Professorat" sub="Encara no s’ha obert cap recollida d’Et veig." />
  const visible = RESULTS_VISIBLE_DIRECTION.includes(c.status)
  const rows = teacherRows(s, c)
  const pending = rows.filter((t) => t.selfDone < t.stages.length)
  const shown = onlyPending ? pending : rows
  const reportable = rows.filter((t) => t.stages.length)
  const printAll = () => {
    const reports = reportable.map((t) => {
      logReportView(session, c.id, t.email, 'Descàrrega')
      return teacherReport(session, c.id, t.email)
    })
    setBatch(reports)
  }
  const copyPending = async () => {
    try {
      await navigator.clipboard.writeText(pending.map((t) => t.email).join(', '))
      showToast(`${pending.length} adreces copiades: enganxa-les al correu de recordatori.`)
    } catch {
      showToast('No s’han pogut copiar les adreces.')
    }
  }
  return (
    <>
      <PageHead title="Professorat" sub="Qui ha fet l’autoavaluació, quantes valoracions ha rebut cada docent i el seu informe. Mai es mostra qui ha valorat ni què ha respost cada alumne.">
        <select className="select" style={{ width: 'auto' }} value={cid} onChange={(e) => setCid(e.target.value)} aria-label="Recollida">
          {campaigns.map((x) => <option key={x.id} value={x.id}>{x.label} · {x.year}</option>)}
        </select>
        <button className="btn primary ev" disabled={!visible || !reportable.length} onClick={printAll} title={visible ? undefined : 'Disponible quan es generin els informes'}>
          <Icon name="print" /> Tots els informes en PDF
        </button>
      </PageHead>
      <div className="kpis">
        <div className="card kpi accent ev">
          <span className="l">Autoavaluacions fetes</span>
          <span className="v">{rows.length - pending.length}/{rows.length}</span>
          <span className="s">{pending.length ? `${pending.length} docents pendents` : 'Tothom l’ha feta'}</span>
        </div>
        <div className="card kpi">
          <span className="l">Llindar assolit</span>
          <span className="v">{rows.filter((t) => t.n >= THRESHOLD).length}/{rows.length}</span>
          <span className="s">Docents amb {THRESHOLD} valoracions o més</span>
        </div>
        <div className="card kpi">
          <span className="l">Estat</span>
          <span className="v" style={{ fontSize: '1.15rem' }}>{FB_LABEL[c.status]}</span>
          <span className="s">Del {fmtDate(c.start)} al {fmtDate(c.end)}</span>
        </div>
      </div>
      {pending.length > 0 && (
        <div className="notice warn">
          <Icon name="alert" />
          <div>
            <b>Autoavaluació pendent:</b> {pending.map((t) => t.name).join(', ')}.
            <div className="row" style={{ marginTop: '.4rem' }}>
              <button className="btn small" style={{ whiteSpace: 'normal', textAlign: 'left' }} onClick={copyPending}><Icon name="mail" /> Copia les adreces per enviar un recordatori</button>
            </div>
          </div>
        </div>
      )}
      {!visible && (
        <div className="notice">
          <Icon name="info" />
          <div>Els informes de cada docent estaran disponibles quan la recollida arribi a «Informes generats». Fins llavors, aquí només es veu el seguiment.</div>
        </div>
      )}
      <div className="toolbar">
        <label className="check">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> Només autoavaluació pendent
        </label>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Docent</th>
              <th>Etapes</th>
              <th className="num">Valoracions</th>
              <th>Llindar ({THRESHOLD})</th>
              <th>Autoavaluació</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.email}>
                <td><b>{t.name}</b><br /><small className="muted">{t.email}</small></td>
                <td>{t.stages.map((st) => STAGES[st].short).join(' · ')}</td>
                <td className="num">{t.n} / {t.eligible}</td>
                <td>{t.n >= THRESHOLD ? <span className="badge ok">Assolit</span> : <span className="badge warn">Encara no</span>}</td>
                <td>{t.selfDone === t.stages.length ? <span className="badge ok">Feta</span> : <span className="badge bad">Pendent{t.stages.length > 1 ? ` (${t.selfDone}/${t.stages.length})` : ''}</span>}</td>
                <td className="actions">
                  <button className="btn small" disabled={!visible || !t.stages.length} onClick={() => { logReportView(session, c.id, t.email, 'Consulta'); setOpen(t.email) }}>
                    <Icon name="eye" /> Informe
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title={`Així et veiem · ${s.staff.find((x) => x.email === open)?.name}`} onClose={() => setOpen(null)} wide>
          <ReportView session={session} campaignId={c.id} teacherEmail={open} />
        </Modal>
      )}
      {batch && (
        <PrintPortal onDone={() => setBatch(null)}>
          {batch.map((r) => <FeedbackReportPages key={r.teacher.email} report={r} />)}
        </PrintPortal>
      )}
      {toast}
    </>
  )
}

// ---------- Recollides i moderació (administració) ----------

export function FeedbackCampaignsScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const [toast, showToast] = useToast()
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const list = [...s.feedbackCampaigns].sort((a, b) => (a.start < b.start ? 1 : -1))
  const act = (c: FeedbackCampaign, to: FeedbackStatus) => {
    try {
      setFeedbackStatus(session, c.id, to)
      showToast(`${c.label}: ${FB_LABEL[to].toLowerCase()}.`)
    } catch (e) {
      showToast((e as Error).message)
    }
  }
  const sel = list.find((c) => c.id === detail)
  return (
    <>
      <PageHead title="Recollides d’Et veig" sub="Independents de les avaluacions. Les assignacions docents es congelen en obrir cada recollida.">
        <button className="btn primary" onClick={() => setCreating(true)}>
          <Icon name="plus" /> Nova recollida
        </button>
      </PageHead>
      <div className="cards-list">
        {list.map((c) => {
          const nx = NEXT[c.status]
          const idx = FLOW.indexOf(c.status)
          const delivered = s.participation.filter((p) => p.campaignId === c.id).length
          const pendingComments = s.feedbackComments.filter((x) => x.campaignId === c.id && x.status === 'pendent').length
          return (
            <section key={c.id} className="card panel">
              <div className="row">
                <h2>{c.label}</h2>
                <span className="muted" style={{ fontWeight: 700 }}>{c.year} · {stageNames(c)}</span>
                <span className="spacer" />
                <span className={`badge ${FB_TONE[c.status]}`}>{FB_LABEL[c.status]}</span>
              </div>
              <div className="status-steps" aria-label="Cicle de la recollida">
                {FLOW.map((st, i) => (
                  <span key={st} className={i < idx ? 'past' : i === idx ? 'cur' : ''}>{FB_LABEL[st]}</span>
                ))}
              </div>
              <p className="muted">
                Del {fmtDate(c.start)} al {fmtDate(c.end)} · {c.teachers.length} docents · {delivered} valoracions lliurades
                {pendingComments > 0 && ` · ${pendingComments} comentaris per moderar`}
              </p>
              <div className="row">
                <button className="btn small" onClick={() => setDetail(c.id)}>
                  <Icon name="list" /> Seguiment{c.status === 'MODERACIO' ? ' i moderació' : ''}
                </button>
                {c.status === 'TANCADA' && <button className="btn small" onClick={() => act(c, 'OBERTA')}>Reobre</button>}
                <span className="spacer" />
                {nx && (
                  <button className="btn small primary ev" onClick={() => act(c, nx.to)}>
                    {nx.label} <Icon name="arrowR" />
                  </button>
                )}
              </div>
            </section>
          )
        })}
      </div>
      {creating && <NewFeedbackCampaign session={session} onClose={() => setCreating(false)} toast={showToast} />}
      {sel && (
        <Modal title={`${sel.label} · seguiment`} onClose={() => setDetail(null)} wide>
          <CampaignDetail session={session} campaign={sel} toast={showToast} />
        </Modal>
      )}
      {toast}
    </>
  )
}

function NewFeedbackCampaign({ session, onClose, toast }: { session: Session; onClose: () => void; toast: (m: string) => void }) {
  const [label, setLabel] = useState('Recollida de maig')
  const [stages, setStages] = useState<StageId[]>(['CM', 'CS', 'ESO'])
  const [start, setStart] = useState('2027-05-10')
  const [end, setEnd] = useState('2027-05-21')
  return (
    <Modal title="Nova recollida d’Et veig" onClose={onClose}>
      <label className="field">
        <span>Nom</span>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <span>Etapes</span>
        <div className="row">
          {(['CM', 'CS', 'ESO'] as StageId[]).map((st) => (
            <label key={st} className="check">
              <input type="checkbox" checked={stages.includes(st)} onChange={() => setStages((x) => (x.includes(st) ? x.filter((y) => y !== st) : [...x, st]))} />
              {STAGES[st].name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="row">
        <label className="field" style={{ flex: 1 }}>
          <span>Inici</span>
          <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>Final</span>
          <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cancel·la</button>
        <button
          className="btn primary"
          disabled={!label.trim() || !stages.length || end < start}
          onClick={() => {
            try {
              createFeedbackCampaign(session, label.trim(), stages, start, end)
              toast('Recollida creada i programada.')
              onClose()
            } catch (e) {
              toast((e as Error).message)
            }
          }}
        >
          Crea-la
        </button>
      </div>
    </Modal>
  )
}

function CampaignDetail({ session, campaign: c, toast }: { session: Session; campaign: FeedbackCampaign; toast: (m: string) => void }) {
  const s = useDemoState()
  const [tab, setTab] = useState<'groups' | 'teachers' | 'moderation'>(c.status === 'MODERACIO' ? 'moderation' : 'groups')
  const dir = isDirection(session)
  const groups = GRADES.filter((g) => c.stages.includes(g.stage)).flatMap((g) =>
    (s.classGroups[g.id] ?? []).map((group) => {
      const studs = s.students.filter((x) => x.gradeId === g.id && x.group === group)
      let full = 0
      let some = 0
      for (const st of studs) {
        const ts = teachersForStudent(st, c.assignments, s.gradeSubjects, s.subjects, s.staff, c.teachers)
        const done = s.participation.filter((p) => p.campaignId === c.id && p.studentId === st.id).length
        if (ts.length && done >= ts.length) full++
        else if (done) some++
      }
      return { key: `${g.id}-${group}`, gradeId: g.id, group, total: studs.length, full, some }
    }),
  )
  const teachers = teacherRows(s, c)
  const comments = s.feedbackComments
    .filter((x) => x.campaignId === c.id)
    .sort((a, b) => (a.status === 'pendent' ? 0 : 1) - (b.status === 'pendent' ? 0 : 1) || b.flags.length - a.flags.length)
  const pendingCount = comments.filter((x) => x.status === 'pendent').length
  return (
    <>
      <div className="tabs" role="tablist">
        <button className={`tab${tab === 'groups' ? ' cur' : ''}`} onClick={() => setTab('groups')} role="tab" aria-selected={tab === 'groups'}>Participació per grup</button>
        <button className={`tab${tab === 'teachers' ? ' cur' : ''}`} onClick={() => setTab('teachers')} role="tab" aria-selected={tab === 'teachers'}>Per docent</button>
        <button className={`tab${tab === 'moderation' ? ' cur' : ''}`} onClick={() => setTab('moderation')} role="tab" aria-selected={tab === 'moderation'}>
          Moderació {pendingCount > 0 && <span className="badge warn">{pendingCount}</span>}
        </button>
      </div>
      {tab === 'groups' && (
        <>
          <p className="muted">Es compta qui ha lliurat, mai què ha respost.</p>
          <div className="bars">
            {groups.map((g) => (
              <div className="bar-row" key={g.key}>
                <b>{groupName(g.gradeId, g.group)}</b>
                <div className="stack" role="img" aria-label={`${g.full} han acabat, ${g.some} a mitges, ${g.total - g.full - g.some} sense començar`}>
                  <span className="s-ok" style={{ width: `${(g.full / g.total) * 100}%` }} />
                  <span className="s-run" style={{ width: `${(g.some / g.total) * 100}%` }} />
                </div>
                <span style={{ textAlign: 'right' }}>{g.full}/{g.total}</span>
              </div>
            ))}
          </div>
          <div className="legend">
            <span><i style={{ background: 'var(--ok)' }} />Han valorat tots els seus docents</span>
            <span><i style={{ background: '#d9a520' }} />A mitges</span>
          </div>
        </>
      )}
      {tab === 'teachers' && (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Docent</th>
                <th>Etapes</th>
                <th className="num">Valoracions</th>
                <th>Llindar ({THRESHOLD})</th>
                <th>Autoavaluació</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.email}>
                  <td><b>{t.name}</b></td>
                  <td>{t.stages.map((st) => STAGES[st].short).join(' · ')}</td>
                  <td className="num">{t.n} / {t.eligible}</td>
                  <td>{t.n >= THRESHOLD ? <span className="badge ok">Assolit</span> : <span className="badge warn">Encara no</span>}</td>
                  <td>{t.selfDone === t.stages.length ? <span className="badge ok">Feta</span> : <span className="badge">{t.selfDone}/{t.stages.length}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'moderation' && (
        <Moderation session={session} campaign={c} comments={comments} dir={dir} toast={toast} />
      )}
    </>
  )
}

function Moderation({ session, campaign: c, comments, dir, toast }: { session: Session; campaign: FeedbackCampaign; comments: ReturnType<typeof useDemoState>['feedbackComments']; dir: boolean; toast: (m: string) => void }) {
  const s = useDemoState()
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [onlyPending, setOnlyPending] = useState(true)
  if (c.status !== 'MODERACIO')
    return <p className="muted">La moderació es fa quan la recollida passa a l’estat «Moderació», després de tancar-la. {comments.length} comentaris recollits fins ara.</p>
  if (!dir)
    return (
      <div className="notice">
        <Icon name="shield" />
        <div>La moderació dels comentaris la fa l’Equip Directiu. Hi ha {comments.filter((x) => x.status === 'pendent').length} comentaris pendents.</div>
      </div>
    )
  const shown = comments.filter((x) => !onlyPending || x.status === 'pendent')
  const unflagged = comments.filter((x) => x.status === 'pendent' && !x.flags.length).length
  return (
    <>
      <div className="row">
        <label className="toggle">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> Només pendents
        </label>
        <span className="spacer" />
        <button className="btn small" disabled={!unflagged} onClick={() => toast(`${acceptUnflagged(session, c.id)} comentaris acceptats.`)}>
          <Icon name="check" /> Accepta els {unflagged} sense marques
        </button>
      </div>
      <p className="muted" style={{ fontSize: '.88rem' }}>Primer apareixen els comentaris marcats automàticament. Al docent només li arriba el text acceptat o editat, mai l’original d’un comentari editat.</p>
      <div className="mod-list">
        {shown.slice(0, 80).map((x) => (
          <div key={x.id} className={`mod-item${x.flags.length ? ' flagged' : ''}`}>
            <div className="row" style={{ gap: '.4rem' }}>
              <small className="muted">{s.staff.find((t) => t.email === x.teacherEmail)?.name} · {STAGES[x.stage].short}</small>
              {x.flags.map((f) => (
                <span key={f} className="badge bad">{f}</span>
              ))}
              <span className="spacer" />
              {x.status !== 'pendent' && <span className="badge plain">{x.status}</span>}
            </div>
            {editing?.id === x.id ? (
              <textarea className="textarea" rows={2} value={editing.text} onChange={(e) => setEditing({ id: x.id, text: e.target.value })} />
            ) : (
              <p>«{x.published && x.status === 'editat' ? x.published : x.original}»</p>
            )}
            <div className="row" style={{ gap: '.4rem' }}>
              {editing?.id === x.id ? (
                <>
                  <button className="btn small" onClick={() => setEditing(null)}>Cancel·la</button>
                  <button className="btn small primary" disabled={!editing.text.trim()} onClick={() => { moderateComment(session, x.id, 'editat', editing.text); setEditing(null) }}>Desa l’edició</button>
                </>
              ) : (
                <>
                  <button className="btn small" onClick={() => moderateComment(session, x.id, 'acceptat')}><Icon name="check" /> Accepta</button>
                  <button className="btn small" onClick={() => setEditing({ id: x.id, text: x.original })}><Icon name="edit" /> Edita</button>
                  <button className="btn small danger" onClick={() => moderateComment(session, x.id, 'descartat')}><Icon name="trash" /> Descarta</button>
                </>
              )}
            </div>
          </div>
        ))}
        {!shown.length && <div className="empty"><span className="em" aria-hidden="true">✅</span>Tots els comentaris estan moderats.</div>}
      </div>
    </>
  )
}
