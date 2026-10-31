import { useEffect, useState } from 'react'
import { resetDemo } from './data/api'
import { GOOGLE_CLIENT_ID } from './data/auth'
import { gradeById } from './domain/catalog'
import type { Session } from './domain/types'
import { Login } from './Login'
import { StaffApp } from './staff/StaffApp'
import { StudentApp } from './student/StudentApp'
import { asset, Footer, Icon, initials, useFitScale } from './ui/common'
import { useDemoState } from './data/api'

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
  }
  const logout = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignorat */
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSession(null)
  }

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
  const subtitle = session?.pending
    ? 'Compte pendent de verificació'
    : student
      ? `${gradeById(student.gradeId).name} · Grup ${student.group}`
      : session?.direction
        ? 'Equip Directiu'
        : session?.role === 'admin'
          ? 'Administració'
          : 'Professorat'

  return (
    <>
      {session && (
        <header className="topbar no-print">
          <a className="brandmark" href="#" onClick={(e) => e.preventDefault()} aria-label="La teva veu">
            <img src={asset('logo-escola-ramon-pont.png')} alt="" />
            <span>
              <b>La teva veu</b>
              <small>Escola Ramon Pont</small>
            </span>
          </a>
          {!GOOGLE_CLIENT_ID && <span className="demo-flag" title="Les dades són fictícies i es desen només en aquest navegador">Demostració</span>}
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
          {session.role === 'admin' && !GOOGLE_CLIENT_ID && (
            <button className="btn small ghost" onClick={() => { if (confirm('Vols restaurar les dades fictícies inicials?')) resetDemo() }} title="Restaura les dades de demostració">
              <Icon name="history" /> <span className="sr-only">Restaura la demostració</span>
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

      {!session && <Login onLogin={login} />}
      {session?.pending && <Pending session={session} onLogout={logout} />}
      {session && !session.pending && session.role === 'student' && <StudentApp session={session} />}
      {session && !session.pending && session.role !== 'student' && <StaffApp session={session} />}
      <Footer />
    </>
  )
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
