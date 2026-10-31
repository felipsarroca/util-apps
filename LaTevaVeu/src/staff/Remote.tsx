// Personal en mode connectat: recollides d'«Et veig», autoavaluació docent, moderació i informes,
// servits pel servidor. La resta de la gestió (cens, assignacions, preguntes) encara es fa a la demostració.
import { useState } from 'react'
import { fetchCampaigns, fetchCenter, fetchComments, fetchReport, fetchSelfTasks, fetchTeacherStatus, postModeration, postStatus, putSelf, useRemote, type RemoteCampaign, type RemoteComment } from '../data/remote'
import { THRESHOLD, type TeacherReport } from '../domain/feedback'
import { STAGES } from '../domain/catalog'
import type { FeedbackStatus, Session } from '../domain/types'
import { CenterReportPages, FeedbackReportPages } from '../report/FeedbackReport'
import { SheetViewer } from '../report/Report'
import { fmtDate, Icon, Modal, useToast } from '../ui/common'
import { FB_LABEL, FB_TONE, NEXT, SelfAssessView } from './EtVeig'
import { RemoteFamilies } from './RemoteFamilies'
import { PrintPortal } from './shared'
import { PageHead, SPACES } from './StaffApp'

const RESULTS_DIRECTION: FeedbackStatus[] = ['INFORMES_GENERATS', 'PUBLICADA', 'ARXIVADA']
const RESULTS_TEACHER: FeedbackStatus[] = ['PUBLICADA', 'ARXIVADA']
const FLOW = Object.keys(FB_LABEL) as FeedbackStatus[]

type Screen = { kind: 'list' } | { kind: 'self' } | { kind: 'families' } | { kind: 'moderate'; c: RemoteCampaign } | { kind: 'report'; c: RemoteCampaign; teacher: string } | { kind: 'center'; c: RemoteCampaign } | { kind: 'teachers'; c: RemoteCampaign }

export function RemoteStaff({ session }: { session: Session }) {
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })
  const back = () => setScreen({ kind: 'list' })
  // L'Equip Directiu i l'administració no s'autoavaluen si no fan classe: el servidor els torna una llista buida.
  const teaches = session.role !== 'admin' || !!session.direction
  const manage = session.role === 'admin' || !!session.direction
  const sp = SPACES['et-veig']
  return (
    <div className="staff space-ev">
      <nav className="side no-print" aria-label="Seccions">
        <div className="space-title">
          <b>
            {sp.emoji} {sp.name}
          </b>
          <small>{sp.tagline}</small>
        </div>
        <div className="side-label">Seguiment</div>
        <button className={`nav-btn${screen.kind !== 'self' && screen.kind !== 'families' ? ' cur' : ''}`} onClick={back}>
          <Icon name="calendar" /> Recollides
        </button>
        {teaches && (
          <button className={`nav-btn${screen.kind === 'self' ? ' cur' : ''}`} onClick={() => setScreen({ kind: 'self' })}>
            <Icon name="edit" /> La meva autoavaluació
          </button>
        )}
        {manage && (
          <>
            <div className="side-label">Centre</div>
            <button className={`nav-btn${screen.kind === 'families' ? ' cur' : ''}`} onClick={() => setScreen({ kind: 'families' })}>
              <Icon name="mail" /> Famílies
            </button>
          </>
        )}
      </nav>
      <main className="staff-main">
        {screen.kind === 'list' && <Campaigns session={session} go={setScreen} />}
        {screen.kind === 'self' && <SelfRemote />}
        {screen.kind === 'families' && <RemoteFamilies />}
        {screen.kind === 'moderate' && <Moderation c={screen.c} onBack={back} />}
        {screen.kind === 'report' && <Report c={screen.c} teacher={screen.teacher} onBack={back} />}
        {screen.kind === 'center' && <Center c={screen.c} onBack={back} go={setScreen} />}
        {screen.kind === 'teachers' && <Teachers session={session} c={screen.c} onBack={back} go={setScreen} />}
      </main>
    </div>
  )
}

function SelfRemote() {
  const r = useRemote(fetchSelfTasks)
  if (!r.data) return <Loading error={r.error} reload={r.reload} />
  return (
    <SelfAssessView
      tasks={r.data}
      save={async (t, answers, context, submit) => {
        await putSelf(t.campaign.id, t.stage, answers, context, submit)
        if (submit) r.reload()
      }}
    />
  )
}

function Loading({ error, reload }: { error?: string; reload: () => void }) {
  if (!error) return <p className="muted">Carregant…</p>
  return (
    <div className="notice bad" role="alert">
      <Icon name="alert" />
      <div>
        {error}{' '}
        <button className="link-btn" onClick={reload}>Torna-ho a provar</button>
      </div>
    </div>
  )
}

function Campaigns({ session, go }: { session: Session; go: (s: Screen) => void }) {
  const r = useRemote(fetchCampaigns)
  const [ask, setAsk] = useState<{ c: RemoteCampaign; to: FeedbackStatus; label: string } | null>(null)
  const [toast, showToast] = useToast()
  const manage = session.role === 'admin' || !!session.direction
  const change = async () => {
    if (!ask) return
    try {
      await postStatus(ask.c.id, ask.to)
      showToast(`«${ask.c.label}» ara és en estat «${FB_LABEL[ask.to]}».`)
      r.reload()
    } catch (e) {
      showToast((e as Error).message)
    }
    setAsk(null)
  }
  return (
    <>
      <PageHead title="Recollides d’«Et veig»" sub="Mode connectat: les dades són al servidor de l’escola." />
      {!r.data ? (
        <Loading error={r.error} reload={r.reload} />
      ) : !r.data.length ? (
        <p className="muted">No hi ha cap recollida aquest curs.</p>
      ) : (
        <div className="cards-list" style={{ gridTemplateColumns: '1fr' }}>
          {r.data.map((c) => {
            const next = NEXT[c.status]
            return (
              <section key={c.id} className="card panel">
                <div className="row">
                  <h2>{c.label}</h2>
                  <span className="muted" style={{ fontWeight: 700 }}>{c.year} · {c.stages.map((st) => STAGES[st].short).join(' · ')}</span>
                  <span className="spacer" />
                  <span className={`badge ${FB_TONE[c.status]}`}>{FB_LABEL[c.status]}</span>
                </div>
                <div className="status-steps" aria-label="Cicle de la recollida">
                  {FLOW.map((st, i) => (
                    <span key={st} className={i < FLOW.indexOf(c.status) ? 'past' : st === c.status ? 'cur' : ''}>{FB_LABEL[st]}</span>
                  ))}
                </div>
                <p className="muted">Del {fmtDate(c.start)} al {fmtDate(c.end)}</p>
                <div className="row">
                  {manage && next && (
                    <button className="btn primary small ev" onClick={() => setAsk({ c, ...next })}>
                      {next.label}
                    </button>
                  )}
                  {manage && !['ESBORRANY', 'PROGRAMADA'].includes(c.status) && (
                    <button className="btn small" onClick={() => go({ kind: 'teachers', c })}>
                      <Icon name="users" /> Professorat
                    </button>
                  )}
                  {session.direction && c.status === 'MODERACIO' && (
                    <button className="btn small" onClick={() => go({ kind: 'moderate', c })}>
                      <Icon name="edit" /> Modera els comentaris
                    </button>
                  )}
                  {session.direction && RESULTS_DIRECTION.includes(c.status) && (
                    <button className="btn small" onClick={() => go({ kind: 'center', c })}>
                      <Icon name="chart" /> Visió de centre
                    </button>
                  )}
                  {!session.direction && RESULTS_TEACHER.includes(c.status) && (
                    <button className="btn small" onClick={() => go({ kind: 'report', c, teacher: session.email })}>
                      <Icon name="file" /> El meu informe
                    </button>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
      {ask && (
        <Modal title={`${ask.label}?`} onClose={() => setAsk(null)}>
          <p>
            «{ask.c.label}» passarà de «{FB_LABEL[ask.c.status]}» a «{FB_LABEL[ask.to]}». No es pot desfer.
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setAsk(null)}>Cancel·la</button>
            <button className="btn primary ev" onClick={change}>{ask.label}</button>
          </div>
        </Modal>
      )}
      {toast}
    </>
  )
}

function Moderation({ c, onBack }: { c: RemoteCampaign; onBack: () => void }) {
  const r = useRemote(() => fetchComments(c.id), c.id)
  const [toast, showToast] = useToast()
  const pending = r.data?.filter((x) => x.status === 'pendent').length ?? 0
  const act = async (x: RemoteComment, status: 'acceptat' | 'editat' | 'descartat', text?: string) => {
    try {
      await postModeration(x.id, status, text)
      r.reload()
    } catch (e) {
      showToast((e as Error).message)
    }
  }
  return (
    <>
      <PageHead title="Moderació dels comentaris" sub={`${c.label} · ${pending} pendents`}>
        <button className="btn" onClick={onBack}><Icon name="arrowL" /> Recollides</button>
      </PageHead>
      {!r.data ? (
        <Loading error={r.error} reload={r.reload} />
      ) : !r.data.length ? (
        <p className="muted">No hi ha comentaris en aquesta recollida.</p>
      ) : (
        <div className="cards-list">
          {r.data.map((x) => (
            <CommentCard key={x.id} x={x} onAct={(st, text) => act(x, st, text)} />
          ))}
        </div>
      )}
      {toast}
    </>
  )
}

function CommentCard({ x, onAct }: { x: RemoteComment; onAct: (status: 'acceptat' | 'editat' | 'descartat', text?: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(x.published ?? x.original)
  return (
    <section className="card panel">
      <div className="row">
        <b>{x.teacherName}</b>
        <span className="muted">{STAGES[x.stage].short}</span>
        <span className="spacer" />
        <span className={`badge ${x.status === 'pendent' ? 'warn' : x.status === 'descartat' ? '' : 'ok'}`}>{x.status}</span>
      </div>
      {x.flags.length > 0 && (
        <div className="notice warn">
          <Icon name="alert" />
          <div>{x.flags.join(' · ')}</div>
        </div>
      )}
      {editing ? (
        <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label="Text editat" />
      ) : (
        <p>«{x.status === 'editat' ? x.published : x.original}»</p>
      )}
      <div className="row">
        {editing ? (
          <>
            <button className="btn small" onClick={() => setEditing(false)}>Cancel·la</button>
            <button className="btn primary small ev" disabled={!text.trim()} onClick={() => { onAct('editat', text); setEditing(false) }}>Desa l’edició</button>
          </>
        ) : (
          <>
            <button className="btn primary small ev" onClick={() => onAct('acceptat')}>Accepta</button>
            <button className="btn small" onClick={() => setEditing(true)}>Edita</button>
            <button className="btn small" onClick={() => onAct('descartat')}>Descarta</button>
          </>
        )}
      </div>
    </section>
  )
}

function Report({ c, teacher, onBack }: { c: RemoteCampaign; teacher: string; onBack: () => void }) {
  const r = useRemote(() => fetchReport(c.id, teacher), `${c.id}|${teacher}`)
  const [printing, setPrinting] = useState(false)
  return (
    <>
      <PageHead title="Així et veiem" sub={r.data ? `${r.data.teacher.name} · ${c.label}` : c.label}>
        <button className="btn" onClick={onBack}><Icon name="arrowL" /> Recollides</button>
        {r.data && (
          <button className="btn primary ev" onClick={() => setPrinting(true)}>
            <Icon name="print" /> Imprimeix o desa en PDF
          </button>
        )}
      </PageHead>
      {!r.data ? (
        <Loading error={r.error} reload={r.reload} />
      ) : (
        <SheetViewer>
          <FeedbackReportPages report={r.data} />
        </SheetViewer>
      )}
      {printing && r.data && (
        <PrintPortal onDone={() => setPrinting(false)}>
          <FeedbackReportPages report={r.data} />
        </PrintPortal>
      )}
    </>
  )
}

function Center({ c, onBack, go }: { c: RemoteCampaign; onBack: () => void; go: (s: Screen) => void }) {
  const r = useRemote(() => fetchCenter(c.id), c.id)
  const [printing, setPrinting] = useState(false)
  const teachers = [...new Map((r.data ?? []).flatMap((v) => v.teachers).map((t) => [t.email, t])).values()].sort((a, b) => a.name.localeCompare(b.name, 'ca'))
  return (
    <>
      <PageHead title="Visió de centre" sub={c.label}>
        <button className="btn" onClick={onBack}><Icon name="arrowL" /> Recollides</button>
        {r.data && (
          <button className="btn primary ev" onClick={() => setPrinting(true)}>
            <Icon name="print" /> Imprimeix o desa en PDF
          </button>
        )}
      </PageHead>
      {!r.data ? (
        <Loading error={r.error} reload={r.reload} />
      ) : (
        <>
          <div className="row">
            <span className="muted">Informe d’un docent:</span>
            {teachers.map((t) => (
              <button key={t.email} className="btn small" onClick={() => go({ kind: 'report', c, teacher: t.email })}>
                {t.name}
              </button>
            ))}
          </div>
          <SheetViewer>
            <CenterReportPages view={r.data} campaign={c} />
          </SheetViewer>
        </>
      )}
      {printing && r.data && (
        <PrintPortal onDone={() => setPrinting(false)}>
          <CenterReportPages view={r.data} campaign={c} />
        </PrintPortal>
      )}
    </>
  )
}

function Teachers({ session, c, onBack, go }: { session: Session; c: RemoteCampaign; onBack: () => void; go: (s: Screen) => void }) {
  const r = useRemote(() => fetchTeacherStatus(c.id), c.id)
  const [onlyPending, setOnlyPending] = useState(false)
  const [batch, setBatch] = useState<TeacherReport[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, showToast] = useToast()
  const reports = !!session.direction && RESULTS_DIRECTION.includes(c.status)
  const rows = r.data ?? []
  const pending = rows.filter((t) => t.selfDone < t.stages.length)
  const shown = onlyPending ? pending : rows
  const printAll = async () => {
    setBusy(true)
    try {
      setBatch(await Promise.all(rows.filter((t) => t.stages.length).map((t) => fetchReport(c.id, t.email))))
    } catch (e) {
      showToast((e as Error).message)
    }
    setBusy(false)
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
      <PageHead title="Professorat" sub={`${c.label} · Qui ha fet l’autoavaluació i quantes valoracions ha rebut cada docent. Mai es mostra qui ha valorat ni què ha respost.`}>
        <button className="btn" onClick={onBack}><Icon name="arrowL" /> Recollides</button>
        {reports && (
          <button className="btn primary ev" disabled={busy || !rows.length} onClick={printAll}>
            <Icon name="print" /> {busy ? 'Preparant…' : 'Tots els informes en PDF'}
          </button>
        )}
      </PageHead>
      {!r.data ? (
        <Loading error={r.error} reload={r.reload} />
      ) : (
        <>
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
          <div className="toolbar">
            <label className="check">
              <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> Només autoavaluació pendent
            </label>
          </div>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr><th>Docent</th><th>Etapes</th><th className="num">Valoracions</th><th>Llindar ({THRESHOLD})</th><th>Autoavaluació</th>{reports && <th />}</tr>
              </thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.email}>
                    <td><b>{t.name}</b><br /><small className="muted">{t.email}</small></td>
                    <td>{t.stages.map((st) => STAGES[st].short).join(' · ')}</td>
                    <td className="num">{t.n} / {t.eligible}</td>
                    <td>{t.n >= THRESHOLD ? <span className="badge ok">Assolit</span> : <span className="badge warn">Encara no</span>}</td>
                    <td>{t.selfDone === t.stages.length ? <span className="badge ok">Feta</span> : <span className="badge bad">Pendent{t.stages.length > 1 ? ` (${t.selfDone}/${t.stages.length})` : ''}</span>}</td>
                    {reports && (
                      <td className="actions">
                        <button className="btn small" disabled={!t.stages.length} onClick={() => go({ kind: 'report', c, teacher: t.email })}>
                          <Icon name="eye" /> Informe
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {batch && (
        <PrintPortal onDone={() => setBatch(null)}>
          {batch.map((x) => <FeedbackReportPages key={x.teacher.email} report={x} />)}
        </PrintPortal>
      )}
      {toast}
    </>
  )
}
