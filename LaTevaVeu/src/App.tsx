import { useEffect, useState } from 'react'
import { connectOps, resetDemo } from './data/api'
import { GOOGLE_CLIENT_ID } from './data/auth'
import { gradeAndGroup } from './domain/groups'
import type { DemoState } from './data/seed'
import { gradeById } from './domain/catalog'
import type { Session, StageId } from './domain/types'
import { Login } from './Login'
import { GuideScreen } from './staff/Guide'
import { AboutPage } from './About'
import { StaffApp } from './staff/StaffApp'
import { StudentApp } from './student/StudentApp'
import { APP_ICON, Footer, Icon, initials, stopSpeaking, useFitScale } from './ui/common'
import { useDemoState } from './data/api'
import { API_URL, DEMO_URL, DEV_AUTH, loadRemoteState, OP_FAILED, SESSION_EXPIRED, setToken } from './data/remote'
import { useToast } from './ui/common'

const SESSION_KEY = 'mavaluo:session'
const PREFS_KEY = 'mavaluo:prefs'
/** Dispositius compartits: la sessió d'alumne es tanca sola després d'aquest temps d'inactivitat. */
const STUDENT_IDLE_MS = 20 * 60 * 1000

function loadSession(): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

function loadPrefs(): { big: boolean; readable: boolean } {
  try {
    return { big: false, readable: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }
  } catch {
    return { big: false, readable: false }
  }
}

export default function App() {
  useFitScale()
  const [session, setSession] = useState<Session | null>(loadSession)
  const [prefs, setPrefs] = useState(loadPrefs)
  const s = useDemoState()
  // Mode connectat: les dades arriben del servidor cada vegada que s'obre l'app (no es guarden al navegador).
  const [ready, setReady] = useState(() => !API_URL || !session || !!session.pending)
  const [toast, showToast] = useToast()
  // La guia del personal s'obre a …/#/guia.
  const [guide, setGuide] = useState(() => location.hash === '#/guia')
  // La presentació del projecte s'obre a …/#/projecte, sense haver d'entrar.
  const [about, setAbout] = useState(() => location.hash === '#/projecte')
  useEffect(() => {
    const on = () => {
      setGuide(location.hash === '#/guia')
      setAbout(location.hash === '#/projecte')
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  // Tot el personal hi té accés: hi ha un recorregut per a la tutoria i un per a l'administració.
  const canGuide = !!session && !session.pending && session.role !== 'student'
  const showGuide = guide && canGuide

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('big-text', prefs.big)
    root.classList.toggle('dyslexic', prefs.readable)
    window.dispatchEvent(new Event('resize'))
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      /* ignorat */
    }
  }, [prefs])

  const login = (s: Session) => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
    } catch {
      /* ignorat */
    }
    setSession(s)
    setReady(true)
  }
  const logout = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignorat */
    }
    setToken(null)
    connectOps(null)
    stopSpeaking()
    setSession(null)
  }

  // Mode connectat: si el servidor rebutja el testimoni (caducat), cal tornar a entrar.
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED, logout)
    return () => window.removeEventListener(SESSION_EXPIRED, logout)
  })

  useEffect(() => {
    if (ready || !session) return
    let alive = true
    loadRemoteState().then(
      (fresh) => alive && login({ ...fresh, picture: session.picture }),
      () => alive && logout(),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // Si el servidor rebutja un canvi, es diu per què (l'app ja ha tornat a l'estat real).
  useEffect(() => {
    const on = (e: Event) => showToast(`No s’ha desat: ${(e as CustomEvent<string>).detail}`)
    window.addEventListener(OP_FAILED, on)
    return () => window.removeEventListener(OP_FAILED, on)
  }, [showToast])

  // Tancament automàtic per inactivitat (alumnat).
  useEffect(() => {
    if (session?.role !== 'student') return
    let t = window.setTimeout(logout, STUDENT_IDLE_MS)
    const reset = () => {
      window.clearTimeout(t)
      t = window.setTimeout(logout, STUDENT_IDLE_MS)
    }
    const evs = ['pointerdown', 'keydown', 'scroll']
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => {
      window.clearTimeout(t)
      evs.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [session])

  const student = session?.studentId ? s.students.find((x) => x.id === session.studentId) : undefined
  const subtitle = session ? userKind(session, s) : ''
  return (
    <>
      {session && (
        <header className="topbar no-print">
          <a className="brandmark" href="#" onClick={(e) => e.preventDefault()} aria-label="La teva veu">
            <img src={APP_ICON} alt="" />
            <span>
              <b>La teva veu</b>
              <small>Escola Ramon Pont</small>
            </span>
          </a>
          {!GOOGLE_CLIENT_ID && !API_URL && <span className="demo-flag" title="Les dades són fictícies i es desen només en aquest navegador">Demostració</span>}
          {DEV_AUTH && <span className="demo-flag" title="Servidor local de proves amb dades fictícies">Servidor de proves</span>}
          <span className="spacer" />
          {session.role === 'student' && (
            <>
              <button className={`btn small${prefs.big ? ' primary' : ''}`} onClick={() => setPrefs((p) => ({ ...p, big: !p.big }))} aria-pressed={prefs.big} title="Lletra més gran">
                A<span style={{ fontSize: '1.25em' }}>A</span>
              </button>
              <button className={`btn small${prefs.readable ? ' primary' : ''}`} onClick={() => setPrefs((p) => ({ ...p, readable: !p.readable }))} aria-pressed={prefs.readable} title="Lletra de lectura fàcil">
                <Icon name="text" /> <span className="sr-only">Lectura fàcil</span>
              </button>
            </>
          )}
          {session.role === 'admin' && !GOOGLE_CLIENT_ID && !API_URL && (
            <button className="btn small ghost" onClick={() => { if (confirm('Vols restaurar les dades fictícies inicials?')) resetDemo() }} title="Restaura les dades de demostració">
              <Icon name="history" /> <span className="sr-only">Restaura la demostració</span>
            </button>
          )}
          {canGuide && (
            <button className={`btn small${showGuide ? ' primary' : ''}`} onClick={() => (location.hash = showGuide ? '' : '#/guia')} title="Guia de l’app, pas a pas">
              <Icon name="book" /> <span className="guide-btn-text">Guia</span>
            </button>
          )}
          <div className="who">
            <span className="avatar" aria-hidden="true">{session.picture ? <img src={session.picture} alt="" /> : initials(student ? `${student.name} ${student.surname}` : session.name)}</span>
            <span className="who-text">
              <b>{student ? `${student.name} ${student.surname}` : session.name}</b>
              <small>{subtitle}</small>
            </span>
          </div>
          <button className="btn small" onClick={logout}>
            <Icon name="logout" /> Surt
          </button>
        </header>
      )}

      {!session && about && <AboutPage onClose={() => (location.hash = '')} onDemo={!API_URL || DEV_AUTH ? () => (location.hash = '#/demo') : DEMO_URL ? () => location.assign(DEMO_URL ?? '') : undefined} />}
      {!session && !about && <Login key={location.hash} onLogin={login} />}
      {session?.pending && <Pending session={session} onLogout={logout} />}
      {session && !session.pending && !ready && <p className="stu-main muted">Carregant…</p>}
      {session && !session.pending && ready && session.role === 'student' && <StudentApp session={session} />}
      {showGuide && ready && <GuideScreen onClose={() => (location.hash = '')} />}
      {session && !session.pending && ready && session.role !== 'student' && !showGuide && <StaffApp session={session} />}
      {toast}
      <Footer />
    </>
  )
}

/** Etapa d'un docent tal com es diu a l'escola: primària (CM i CS) o secundària. */
const STAGE_KIND: Record<StageId, 'EP' | 'ESO'> = { CM: 'EP', CS: 'EP', ESO: 'ESO' }

/**
 * Tipus d'usuari que es mostra sota el nom: «Alumnat ESO · 2n d'ESO A», «Professorat EP i ESO»,
 * «Equip Directiu · Administració»… L'etapa del professorat surt dels grups que tutoritza i de qui fa classe a qui.
 */
function userKind(session: Session, s: DemoState): string {
  if (session.pending) return 'Compte pendent de verificació'
  if (session.role === 'student') {
    const st = s.students.find((x) => x.id === session.studentId)
    return st ? `Alumnat ${gradeById(st.gradeId).stage} · ${gradeAndGroup(st.gradeId, st.group)}` : 'Alumnat'
  }
  const grades = [...(session.groups ?? []).map((k) => k.split('-')[0]), ...s.assignments.filter((a) => a.teacherEmail === session.email).map((a) => a.gradeId)]
  const kinds = (['EP', 'ESO'] as const).filter((k) => grades.some((g) => STAGE_KIND[gradeById(g as never)?.stage] === k))
  const teacher = kinds.length ? `Professorat ${kinds.join(' i ')}` : session.role === 'teacher' ? 'Professorat' : ''
  const parts = [session.direction && 'Equip Directiu', session.role === 'admin' && 'Administració', teacher].filter(Boolean)
  return parts.join(' · ')
}

function Pending({ session, onLogout }: { session: Session; onLogout: () => void }) {
  return (
    <main className="stu-main">
      <section className="card hello">
        <h1>
          Encara no tens accés <span aria-hidden="true">🔒</span>
        </h1>
        <p className="step-intro">
          Has entrat correctament amb <b>{session.email}</b>, però aquest compte encara no consta al cens de l’alumnat ni té cap permís assignat. Per protegir les dades de tothom, no es mostra cap informació.
        </p>
        <div className="notice">
          <Icon name="info" />
          <div>Si ets alumne o alumna de l’escola, digues-ho al teu tutor o tutora: l’administració afegirà el teu compte. Si ets docent, demana accés a l’administració.</div>
        </div>
        <div className="row">
          <button className="btn" onClick={onLogout}>
            <Icon name="logout" /> Surt i prova un altre compte
          </button>
        </div>
      </section>
    </main>
  )
}
