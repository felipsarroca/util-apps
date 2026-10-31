import { useMemo, useState, type ReactNode } from 'react'
import { isDirection, useDemoState, visibleGrades } from '../data/api'
import { gradeShort, GRADES } from '../domain/catalog'
import type { GradeId, ResponseStatus, Session } from '../domain/types'
import { buildReportModel, ReportPages, SheetViewer } from '../report/Report'
import { fmtDate, fmtShort, Icon, Modal, readSection, useSection, type Section } from '../ui/common'
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
type Need = 'admin' | 'dir' | 'manage' | 'tutor' | 'teaches' | 'results'
type Kind = 'use' | 'config'

/**
 * Tres espais ben separats: l'autoavaluació de l'alumnat (Em miro), la valoració del professorat
 * (Et veig) i les dades comunes del centre. Cada espai té el seu color, les seves pantalles d'ús i la
 * seva configuració.
 */
const NAV: { id: Screen; label: string; icon: string; need: Need; space: Section; kind: Kind }[] = [
  { id: 'dashboard', label: 'Tauler', icon: 'home', need: 'tutor', space: 'em-miro', kind: 'use' },
  { id: 'tracking', label: 'Respostes', icon: 'list', need: 'tutor', space: 'em-miro', kind: 'use' },
  { id: 'reports', label: 'Així em veig i famílies', icon: 'file', need: 'tutor', space: 'em-miro', kind: 'use' },
  { id: 'campaigns', label: 'Recollides', icon: 'calendar', need: 'tutor', space: 'em-miro', kind: 'use' },
  { id: 'templates', label: 'Qüestionaris', icon: 'edit', need: 'admin', space: 'em-miro', kind: 'config' },
  { id: 'self', label: 'La meva autoavaluació', icon: 'edit', need: 'teaches', space: 'et-veig', kind: 'use' },
  { id: 'myreports', label: 'Així et veiem', icon: 'eye', need: 'results', space: 'et-veig', kind: 'use' },
  { id: 'center', label: 'Visió de centre', icon: 'chart', need: 'dir', space: 'et-veig', kind: 'use' },
  { id: 'fbcampaigns', label: 'Recollides i moderació', icon: 'calendar', need: 'manage', space: 'et-veig', kind: 'use' },
  { id: 'fbforms', label: 'Preguntes', icon: 'list', need: 'admin', space: 'et-veig', kind: 'config' },
  { id: 'assign', label: 'Qui fa classe a qui', icon: 'users', need: 'admin', space: 'et-veig', kind: 'config' },
  { id: 'people', label: 'Alumnat i accessos', icon: 'users', need: 'admin', space: 'centre', kind: 'config' },
  { id: 'subjects', label: 'Matèries', icon: 'book', need: 'admin', space: 'centre', kind: 'config' },
  { id: 'modules', label: 'Apartats', icon: 'settings', need: 'admin', space: 'centre', kind: 'config' },
  { id: 'audit', label: 'Registre', icon: 'history', need: 'admin', space: 'centre', kind: 'config' },
]

export const SPACES: Record<Section, { name: string; emoji: string; tagline: string; cls: string }> = {
  'em-miro': { name: 'Em miro', emoji: '💭', tagline: 'Autoavaluació de l’alumnat', cls: 'space-em' },
  'et-veig': { name: 'Et veig', emoji: '👀', tagline: 'L’alumnat valora el professorat', cls: 'space-ev' },
  centre: { name: 'Centre', emoji: '🏫', tagline: 'Dades comunes: alumnat, matèries i accessos', cls: 'space-ce' },
}

export function StaffApp({ session }: { session: Session }) {
  const s = useDemoState()
  const isAdmin = session.role === 'admin'
  const dir = isDirection(session)
  const teaches = s.assignments.some((a) => a.teacherEmail === session.email) || s.feedbackCampaigns.some((c) => c.teachers.includes(session.email))
  const tutor = isAdmin || (session.groups?.length ?? 0) > 0
  const allowed: Record<Need, boolean> = { admin: isAdmin, dir, manage: isAdmin || dir, tutor, teaches, results: teaches || dir }
  const nav = NAV.filter((n) => allowed[n.need])
  const spaces = (Object.keys(SPACES) as Section[]).filter((sp) => nav.some((n) => n.space === sp))
  // L'adreça …/#/em-miro, …/#/et-veig o …/#/centre obre l'espai; sense apartat, la pantalla d'inici.
  const screenFor = (sec: Section | null): Screen | null => (sec && nav.find((n) => n.space === sec)?.id) || (spaces.length === 1 ? nav[0].id : null)
  const [screen, setScreenState] = useState<Screen | null>(() => screenFor(readSection()))
  const setSection = useSection((sec) => setScreenState(screenFor(sec)))
  const setScreen = (id: Screen | null) => {
    setScreenState(id)
    setSection(id ? nav.find((n) => n.id === id)!.space : null)
  }
  const space = screen ? nav.find((n) => n.id === screen)!.space : null
  const pendingIdentity = s.audit.filter((a) => a.action === 'Incidència d’identitat').length
  if (!space) return <SpaceChooser session={session} spaces={spaces} nav={nav} go={(sp) => setScreen(nav.find((n) => n.space === sp)!.id)} />
  const items = nav.filter((n) => n.space === space)
  return (
    <div className={`staff ${SPACES[space].cls}`}>
      <nav className="side no-print" aria-label="Seccions">
        {spaces.length > 1 && (
          <div className="space-switch" role="tablist" aria-label="Espais">
            {spaces.map((sp) => (
              <button key={sp} role="tab" aria-selected={sp === space} className={`sp-tab ${SPACES[sp].cls}${sp === space ? ' cur' : ''}`} onClick={() => setScreen(nav.find((n) => n.space === sp)!.id)} title={SPACES[sp].tagline}>
                <span aria-hidden="true">{SPACES[sp].emoji}</span> {SPACES[sp].name}
              </button>
            ))}
          </div>
        )}
        <div className="space-title">
          <b>
            {SPACES[space].emoji} {SPACES[space].name}
          </b>
          <small>{SPACES[space].tagline}</small>
        </div>
        {items.map((n, i) => {
          const header = n.kind !== items[i - 1]?.kind ? <div className="side-label">{n.kind === 'use' ? 'Seguiment' : 'Configuració'}</div> : null
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
        {spaces.length > 1 && (
          <button className="nav-btn side-home" onClick={() => setScreen(null)}>
            <Icon name="home" /> Inici
          </button>
        )}
      </nav>
      <main className="staff-main">
        {!s.modules.emMiro && space === 'em-miro' && <ModuleOff name="Em miro" />}
        {!s.modules.etVeig && space === 'et-veig' && <ModuleOff name="Et veig" />}
        {screen === 'dashboard' && tutor && <Dashboard session={session} go={setScreen} />}
        {screen === 'tracking' && tutor && <Tracking session={session} />}
        {screen === 'reports' && tutor && <ReportsScreen session={session} />}
        {screen === 'campaigns' && tutor && <CampaignsScreen session={session} />}
        {screen === 'self' && teaches && <SelfAssessScreen session={session} />}
        {screen === 'myreports' && (teaches || dir) && <MyReportsScreen session={session} />}
        {screen === 'center' && dir && <CenterScreen session={session} />}
        {screen === 'fbcampaigns' && (isAdmin || dir) && <FeedbackCampaignsScreen session={session} />}
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

const SPACE_TEXT: Record<Section, string> = {
  'em-miro': 'L’alumnat pensa en com aprèn. La tutoria en fa el seguiment i en treu l’informe «Així em veig» per a les famílies.',
  'et-veig': 'L’alumnat explica com viu les classes de cada docent. Cada docent rep el seu informe «Així et veiem»; ningú no veu respostes individuals.',
  centre: 'Cens de l’alumnat, accessos del personal, matèries, apartats actius i registre d’operacions.',
}

/** Pantalla d'inici del personal: cada espai, amb el que hi pot fer aquesta persona. */
function SpaceChooser({ session, spaces, nav, go }: { session: Session; spaces: Section[]; nav: typeof NAV; go: (s: Section) => void }) {
  const s = useDemoState()
  const off = (sp: Section) => (sp === 'em-miro' && !s.modules.emMiro) || (sp === 'et-veig' && !s.modules.etVeig)
  return (
    <main className="staff-main spaces-home">
      <PageHead title={`${greeting()}, ${session.name.split(' ')[0]}`} sub="Tria on vols treballar. Cada espai és independent." />
      <div className="space-cards">
        {spaces.map((sp) => (
          <button key={sp} className={`space-card ${SPACES[sp].cls}`} onClick={() => go(sp)}>
            <span className="sc-head">
              <span className="sc-emoji" aria-hidden="true">{SPACES[sp].emoji}</span>
              <span>
                <b>{SPACES[sp].name}</b>
                <small>{SPACES[sp].tagline}</small>
              </span>
            </span>
            {off(sp) && <span className="badge warn">Desactivat per a l’alumnat</span>}
            <span className="sc-text">{SPACE_TEXT[sp]}</span>
            <span className="sc-list">
              {nav
                .filter((n) => n.space === sp)
                .map((n) => (
                  <span key={n.id} className={n.kind === 'config' ? 'cfg' : ''}>
                    <Icon name={n.icon} /> {n.label}
                  </span>
                ))}
            </span>
            <span className="sc-go">
              Entra <Icon name="arrowR" />
            </span>
          </button>
        ))}
      </div>
    </main>
  )
}

function ModuleOff({ name }: { name: string }) {
  return (
    <div className="notice warn">
      <Icon name="alert" />
      <div>
        L’apartat «{name}» està desactivat: l’alumnat no el veu. Es pot tornar a activar a <b>Centre › Apartats</b>.
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

function Dashboard({ session, go }: { session: Session; go: (s: Screen | null) => void }) {
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
      <PageHead title={`${greeting()}, ${session.name.split(' ')[0]}`} sub={`Resum de les autoavaluacions de l’alumnat · ${scope}`} />
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
