import { useMemo, useState, type ReactNode } from 'react'
import { isDirection, useDemoState, visibleGrades } from '../data/api'
import { gradeShort, GRADES } from '../domain/catalog'
import type { GradeId, ResponseStatus, Session } from '../domain/types'
import { buildReportModel, ReportPages, SheetViewer } from '../report/Report'
import { fmtDate, fmtShort, Icon, Modal } from '../ui/common'
import { CampaignsScreen } from './Campaigns'
import { EditorScreen } from './Editor'
import { CenterScreen, FeedbackCampaignsScreen, MyReportsScreen, SelfAssessScreen } from './EtVeig'
import { PeopleScreen } from './People'
import { ReportsScreen } from './Reports'
import { CAMPAIGN_LABEL, CAMPAIGN_TONE, currentCampaign, fullName, PrintJob, RESP_LABEL, RESP_TONE, trackingRows } from './shared'
import { AssignmentsScreen, FeedbackFormsScreen, ModulesScreen } from './Settings'
import { SubjectsScreen } from './Subjects'

type Screen =
  | 'dashboard' | 'tracking' | 'reports' | 'campaigns'
  | 'self' | 'myreports' | 'center' | 'fbcampaigns' | 'fbforms'
  | 'templates' | 'subjects' | 'assign' | 'people' | 'modules' | 'audit'

/** Qui veu cada entrada: administració, Equip Directiu, tutoria (grups d'«Em miro»), qui fa classe o qui pot veure resultats. */
type Need = 'admin' | 'dir' | 'tutor' | 'teaches' | 'results'
const NAV: { id: Screen; label: string; icon: string; need: Need; group: string }[] = [
  { id: 'dashboard', label: 'Tauler', icon: 'home', need: 'tutor', group: 'Em miro' },
  { id: 'tracking', label: 'Respostes', icon: 'list', need: 'tutor', group: 'Em miro' },
  { id: 'reports', label: 'Així em veig i famílies', icon: 'file', need: 'tutor', group: 'Em miro' },
  { id: 'campaigns', label: 'Recollides', icon: 'calendar', need: 'tutor', group: 'Em miro' },
  { id: 'self', label: 'La meva autoavaluació', icon: 'edit', need: 'teaches', group: 'Et veig' },
  { id: 'myreports', label: 'Així et veiem', icon: 'eye', need: 'results', group: 'Et veig' },
  { id: 'center', label: 'Visió de centre', icon: 'chart', need: 'dir', group: 'Et veig' },
  { id: 'fbcampaigns', label: 'Recollides i moderació', icon: 'calendar', need: 'admin', group: 'Et veig' },
  { id: 'fbforms', label: 'Preguntes', icon: 'list', need: 'admin', group: 'Et veig' },
  { id: 'templates', label: 'Qüestionaris d’Em miro', icon: 'edit', need: 'admin', group: 'Configuració' },
  { id: 'subjects', label: 'Matèries', icon: 'book', need: 'admin', group: 'Configuració' },
  { id: 'assign', label: 'Assignacions docents', icon: 'users', need: 'admin', group: 'Configuració' },
  { id: 'people', label: 'Alumnat i accessos', icon: 'users', need: 'admin', group: 'Configuració' },
  { id: 'modules', label: 'Apartats', icon: 'settings', need: 'admin', group: 'Configuració' },
  { id: 'audit', label: 'Registre', icon: 'history', need: 'admin', group: 'Configuració' },
]

export function StaffApp({ session }: { session: Session }) {
  const s = useDemoState()
  const isAdmin = session.role === 'admin'
  const dir = isDirection(session)
  const teaches = s.assignments.some((a) => a.teacherEmail === session.email) || s.feedbackCampaigns.some((c) => c.teachers.includes(session.email))
  const tutor = isAdmin || (session.groups?.length ?? 0) > 0
  const allowed: Record<Need, boolean> = { admin: isAdmin, dir, tutor, teaches, results: teaches || dir }
  const nav = NAV.filter((n) => allowed[n.need])
  const [screen, setScreen] = useState<Screen>(() => nav[0]?.id ?? 'dashboard')
  const pendingIdentity = s.audit.filter((a) => a.action === 'Incidència d’identitat').length
  return (
    <div className="staff">
      <nav className="side no-print" aria-label="Seccions">
        {nav.map((n, i) => {
          const header = n.group !== nav[i - 1]?.group ? <div className="side-label">{n.group}</div> : null
          return (
            <span key={n.id} style={{ display: 'contents' }}>
              {header}
              <button className={`nav-btn${screen === n.id ? ' cur' : ''}`} onClick={() => setScreen(n.id)} aria-current={screen === n.id ? 'page' : undefined}>
                <Icon name={n.icon} />
                {n.label}
                {n.id === 'people' && pendingIdentity > 0 && <span className="count">{pendingIdentity}</span>}
              </button>
            </span>
          )
        })}
      </nav>
      <main className="staff-main">
        {!s.modules.emMiro && nav.find((n) => n.id === screen)?.group === 'Em miro' && <ModuleOff name="Em miro" />}
        {!s.modules.etVeig && nav.find((n) => n.id === screen)?.group === 'Et veig' && <ModuleOff name="Et veig" />}
        {screen === 'dashboard' && tutor && <Dashboard session={session} go={setScreen} />}
        {screen === 'tracking' && tutor && <Tracking session={session} />}
        {screen === 'reports' && tutor && <ReportsScreen session={session} />}
        {screen === 'campaigns' && tutor && <CampaignsScreen session={session} />}
        {screen === 'self' && teaches && <SelfAssessScreen session={session} />}
        {screen === 'myreports' && (teaches || dir) && <MyReportsScreen session={session} />}
        {screen === 'center' && dir && <CenterScreen session={session} />}
        {screen === 'fbcampaigns' && isAdmin && <FeedbackCampaignsScreen session={session} />}
        {screen === 'fbforms' && isAdmin && <FeedbackFormsScreen session={session} />}
        {screen === 'templates' && isAdmin && <EditorScreen session={session} />}
        {screen === 'subjects' && isAdmin && <SubjectsScreen session={session} />}
        {screen === 'assign' && isAdmin && <AssignmentsScreen session={session} />}
        {screen === 'people' && isAdmin && <PeopleScreen session={session} />}
        {screen === 'modules' && isAdmin && <ModulesScreen session={session} />}
        {screen === 'audit' && isAdmin && <Audit />}
      </main>
    </div>
  )
}

function ModuleOff({ name }: { name: string }) {
  return (
    <div className="notice warn">
      <Icon name="alert" />
      <div>
        L’apartat «{name}» està desactivat: l’alumnat no el veu. Es pot tornar a activar a <b>Configuració › Apartats</b>.
      </div>
    </div>
  )
}

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <span className="spacer" />
      {children}
    </header>
  )
}

function greeting() {
  const h = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Madrid' }))
  return h < 14 ? 'Bon dia' : h < 20 ? 'Bona tarda' : 'Bon vespre'
}

function Dashboard({ session, go }: { session: Session; go: (s: Screen) => void }) {
  const s = useDemoState()
  const rows = useMemo(() => trackingRows(s, session), [s, session])
  const grades = visibleGrades(s, session)
  const open = grades.map((g) => currentCampaign(s, g)).filter((c) => c?.status === 'OBERTA')
  const count = (st: ResponseStatus[]) => rows.filter((r) => st.includes(r.status)).length
  const delivered = count(['LLIURADA', 'VALIDADA'])
  const noFamily = rows.filter((r) => !r.student.guardians.some((g) => g.validated)).length
  const pct = rows.length ? Math.round((delivered / rows.length) * 100) : 0
  const scope = session.role === 'admin' ? 'tota l’escola' : (session.groups ?? []).map((g) => g.replace('-', ' ').replace(/^(\d)(EP|ESO)/, (_, n, e) => gradeShort(`${n}${e}` as GradeId))).join(', ')

  return (
    <>
      <PageHead title={`${greeting()}, ${session.name.split(' ')[0]}`} sub={`Em miro · resum de les autoavaluacions · ${scope}`} />
      <div className="kpis">
        <div className="card kpi accent">
          <span className="l">Participació</span>
          <span className="v">{pct} %</span>
          <span className="s">{delivered} de {rows.length} alumnes han lliurat</span>
        </div>
        <div className="card kpi">
          <span className="l">Recollides obertes</span>
          <span className="v">{open.length}</span>
          <span className="s">{open.length ? `Tanquen a partir del ${fmtDate(open.map((c) => c!.end).sort()[0])}` : 'Cap en aquest moment'}</span>
        </div>
        <div className="card kpi">
          <span className="l">A mitges</span>
          <span className="v">{count(['EN_CURS'])}</span>
          <span className="s">Han començat i no han lliurat</span>
        </div>
        <div className="card kpi">
          <span className="l">Sense començar</span>
          <span className="v">{count(['NO_INICIADA'])}</span>
          <span className="s">Encara no hi han entrat</span>
        </div>
        <div className="card kpi">
          <span className="l">Sense correu familiar validat</span>
          <span className="v">{noFamily}</span>
          <span className="s">Informe en paper</span>
        </div>
      </div>

      <div className="grid-2">
        <section className="card panel">
          <div className="row">
            <h2>Participació per grup</h2>
            <span className="spacer" />
            <button className="btn small" onClick={() => go('tracking')}>
              Veure respostes <Icon name="arrowR" />
            </button>
          </div>
          <div className="legend">
            <span><i style={{ background: 'var(--ok)' }} />Lliurades</span>
            <span><i style={{ background: '#d9a520' }} />En curs</span>
            <span><i style={{ background: '#ece7df' }} />Sense començar</span>
          </div>
          <div className="bars">
            {GRADES.filter((g) => grades.includes(g.id)).flatMap((g) => {
              const groups = [...new Set(rows.filter((r) => r.student.gradeId === g.id).map((r) => r.student.group))].sort()
              return groups.map((grp) => {
                const rs = rows.filter((r) => r.student.gradeId === g.id && r.student.group === grp)
                const ok = rs.filter((r) => r.status === 'LLIURADA' || r.status === 'VALIDADA').length
                const run = rs.filter((r) => r.status === 'EN_CURS').length
                const c = rs[0]?.campaign
                return (
                  <div className="bar-row" key={g.id + grp}>
                    <b>
                      {gradeShort(g.id)} {grp}
                    </b>
                    <div className="stack" role="img" aria-label={`${ok} lliurades, ${run} en curs, ${rs.length - ok - run} sense començar`}>
                      <span className="s-ok" style={{ width: `${(ok / rs.length) * 100}%` }} />
                      <span className="s-run" style={{ width: `${(run / rs.length) * 100}%` }} />
                    </div>
                    <span style={{ textAlign: 'right' }}>
                      {ok}/{rs.length} {c && c.status !== 'OBERTA' && <span className={`badge plain ${CAMPAIGN_TONE[c.status]}`} style={{ fontSize: '.68rem' }}>{CAMPAIGN_LABEL[c.status]}</span>}
                    </span>
                  </div>
                )
              })
            })}
          </div>
        </section>
        <section className="card panel">
          <h2>Activitat recent</h2>
          <div className="feed">
            {s.audit
              .filter((a) => session.role === 'admin' || a.action === 'Lliurament')
              .slice(0, 12)
              .map((a, i) => (
                <div className="feed-item" key={i}>
                  <time>{fmtShort(a.at)}</time>
                  <b>{a.action}</b>
                  <span>{session.role === 'admin' ? `${a.detail} · ${a.actor}` : a.detail}</span>
                </div>
              ))}
          </div>
        </section>
      </div>
    </>
  )
}

function Tracking({ session }: { session: Session }) {
  const s = useDemoState()
  const rows = useMemo(() => trackingRows(s, session), [s, session])
  const grades = visibleGrades(s, session)
  const [grade, setGrade] = useState<string>(grades.length === 1 ? grades[0] : '')
  const [status, setStatus] = useState<string>('')
  const [q, setQ] = useState('')
  const [view, setView] = useState<{ studentId: string; campaignId: string } | null>(null)
  const [printing, setPrinting] = useState(false)
  const filtered = rows
    .filter((r) => (!grade || `${r.student.gradeId}` === grade.split('-')[0]) && (!grade.includes('-') || r.student.group === grade.split('-')[1]))
    .filter((r) => !status || r.status === status)
    .filter((r) => !q || `${r.student.name} ${r.student.surname}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.student.gradeId.localeCompare(b.student.gradeId) || a.student.group.localeCompare(b.student.group) || a.student.surname.localeCompare(b.student.surname))
  const groupOptions = GRADES.filter((g) => grades.includes(g.id)).flatMap((g) => {
    const gs = [...new Set(rows.filter((r) => r.student.gradeId === g.id).map((r) => r.student.group))].sort()
    return [{ v: g.id, l: g.name }, ...(gs.length > 1 ? gs.map((x) => ({ v: `${g.id}-${x}`, l: `   ${gradeShort(g.id)} ${x}` })) : [])]
  })
  const model = view && buildReportModel(s, view.studentId, view.campaignId)

  return (
    <>
      <PageHead title="Respostes" sub="Estat de l’autoavaluació de cada alumne a la recollida actual del seu curs." />
      <div className="toolbar">
        <label className="sr-only" htmlFor="f-grade">Curs</label>
        <select id="f-grade" className="select" value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">Tots els cursos</option>
          {groupOptions.map((o) => (
            <option key={o.v} value={o.v}>{o.l}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="f-status">Estat</label>
        <select id="f-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tots els estats</option>
          {(['NO_INICIADA', 'EN_CURS', 'LLIURADA'] as ResponseStatus[]).map((x) => (
            <option key={x} value={x}>{RESP_LABEL[x]}</option>
          ))}
        </select>
        <input className="input" type="search" placeholder="Cerca un alumne…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca un alumne" style={{ minWidth: 200 }} />
        <span className="spacer" />
        <span className="muted" style={{ fontWeight: 700 }}>{filtered.length} alumnes</span>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Alumne</th>
              <th>Curs</th>
              <th>Recollida</th>
              <th>Estat</th>
              <th>Progrés</th>
              <th>Última activitat</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.student.id}>
                <td className="student-cell">
                  <b>{fullName(r.student)}</b>
                  <small>{r.student.email}</small>
                </td>
                <td>{gradeShort(r.student.gradeId)} {r.student.group}</td>
                <td>{r.campaign ? <>{r.campaign.label} <span className={`badge plain ${CAMPAIGN_TONE[r.campaign.status]}`}>{CAMPAIGN_LABEL[r.campaign.status]}</span></> : '—'}</td>
                <td>
                  <span className={`badge ${RESP_TONE[r.status]}`}>{RESP_LABEL[r.status]}</span>
                </td>
                <td>
                  <span className="mini-bar"><span style={{ width: `${r.ratio * 100}%` }} /></span>
                  <span className="muted">{Math.round(r.ratio * 100)} %</span>
                </td>
                <td className="muted">{r.response ? fmtShort(r.response.updatedAt) : '—'}</td>
                <td className="actions">
                  <button className="btn small" disabled={!r.response || !r.campaign} onClick={() => setView({ studentId: r.student.id, campaignId: r.campaign!.id })}>
                    <Icon name="eye" /> Veure
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="empty">
            <span className="em" aria-hidden="true">🔍</span>Cap alumne coincideix amb els filtres.
          </div>
        )}
      </div>
      {model && (
        <Modal title={`${model.student.name} ${model.student.surname} · ${model.campaign.label}`} onClose={() => setView(null)} wide>
          <div className="row no-print">
            <span className={`badge ${RESP_TONE[model.response?.status ?? 'NO_INICIADA']}`}>{RESP_LABEL[model.response?.status ?? 'NO_INICIADA']}</span>
            <span className="spacer" />
            <button className="btn primary small" onClick={() => setPrinting(true)}>
              <Icon name="print" /> Imprimeix o desa en PDF
            </button>
          </div>
          <SheetViewer>
            <ReportPages model={model} />
          </SheetViewer>
        </Modal>
      )}
      {printing && view && <PrintJob state={s} items={[view]} duplex={false} onDone={() => setPrinting(false)} />}
    </>
  )
}

function Audit() {
  const s = useDemoState()
  return (
    <>
      <PageHead title="Registre d’operacions" sub="Traça de les accions rellevants: permisos, canvis de configuració, lliuraments i incidències." />
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Data</th>
              <th>Persona</th>
              <th>Acció</th>
              <th>Detall</th>
            </tr>
          </thead>
          <tbody>
            {s.audit.map((a, i) => (
              <tr key={i}>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtShort(a.at)}</td>
                <td>{a.actor}</td>
                <td><b>{a.action}</b></td>
                <td>{a.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
