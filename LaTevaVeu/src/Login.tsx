import { useEffect, useRef, useState } from 'react'
import { resetDemo, resolveSession } from './data/api'
import { API_URL, DEV_AUTH, remoteLogin } from './data/remote'
import { checkGoogleProfile, decodeGoogleCredential, GOOGLE_CLIENT_ID, loadGoogleIdentity } from './data/auth'
import { SCHOOL } from './domain/catalog'
import type { Session } from './domain/types'
import { APP_ICON, asset, GoogleLogo, Icon, Modal } from './ui/common'

type Profile = { email: string; em: string; label: string; hint: string; group: string }

const DEMO: Profile[] = [
  { email: 'pau.serra@ramonpont.cat', em: '🧒', label: 'Alumne de 3r', hint: 'Cicle mitjà', group: 'Alumnat' },
  { email: 'laia.puig@ramonpont.cat', em: '👧', label: 'Alumna de 5è', hint: 'Cicle superior, amb objectiu anterior', group: 'Alumnat' },
  { email: 'marc.vidal@ramonpont.cat', em: '🧑', label: 'Alumne de 2n d’ESO', hint: 'Amb optativa de francès', group: 'Alumnat' },
  { email: 'tutoria.2eso@ramonpont.cat', em: '📋', label: 'Marta Riera', hint: 'Tutora de 2n i docent de matemàtiques', group: 'Professorat' },
  { email: 'sergi.prat@ramonpont.cat', em: '🏃', label: 'Sergi Prat', hint: 'Especialista d’EF a tres etapes', group: 'Professorat' },
  { email: 'direccio.demo@ramonpont.cat', em: '🧭', label: 'Equip Directiu', hint: 'Visió de centre i moderació', group: 'Direcció i administració' },
  { email: 'admin.demo@ramonpont.cat', em: '🛡️', label: 'Administració', hint: 'Configuració, sense resultats', group: 'Direcció i administració' },
  { email: 'nou.usuari@ramonpont.cat', em: '❔', label: 'Compte no registrat', hint: 'De l’escola, però fora del cens', group: 'Altres casos' },
]

// Comptes del servidor local de proves (server/seed.ts): només amb VITE_DEV_AUTH=1.
const DEV: Profile[] = [
  { email: 'e01@ramonpont.cat', em: '🧑', label: 'Alumne de 2n d’ESO', hint: 'S’autoavalua i valora la Marta i el Xavier', group: 'Alumnat' },
  { email: 'p1@ramonpont.cat', em: '🧒', label: 'Alumne de 3r', hint: 'Cicle mitjà', group: 'Alumnat' },
  { email: 'marta@ramonpont.cat', em: '📋', label: 'Marta Riera', hint: 'Tutora de 2n d’ESO A', group: 'Professorat' },
  { email: 'xavier@ramonpont.cat', em: '📘', label: 'Xavier Duran', hint: 'Docent d’ESO', group: 'Professorat' },
  { email: 'dir@ramonpont.cat', em: '🧭', label: 'Equip Directiu', hint: 'Moderació i resultats', group: 'Direcció i administració' },
  { email: 'admin@ramonpont.cat', em: '🛡️', label: 'Administració', hint: 'Obre i tanca recollides', group: 'Direcció i administració' },
]

/** La demostració funciona sense servidor; amb servidor real només s'hi pot entrar amb Google. */
const DEMO_AVAILABLE = !API_URL || DEV_AUTH

export function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [error, setError] = useState<string | null>(null)
  // …/#/demo obre directament la tria de perfil (des de la pàgina del projecte).
  const [demo, setDemoState] = useState(() => DEMO_AVAILABLE && location.hash === '#/demo')
  const setDemo = (on: boolean) => {
    setDemoState(on)
    if (!on && location.hash === '#/demo') history.replaceState(null, '', location.pathname + location.search)
  }
  const gRef = useRef<HTMLDivElement>(null)

  const tryLogin = (raw: string, profile?: { name?: string; picture?: string }, token?: string): string | null => {
    if (API_URL) {
      // Mode connectat: qui decideix si es pot entrar és el servidor.
      if (!token) return 'Cal entrar amb el compte de Google de l’escola.'
      remoteLogin(token, profile?.picture).then(onLogin, (e: Error) => setError(e.message))
      return null
    }
    const r = resolveSession(raw, profile)
    if ('error' in r) return r.error
    onLogin(r)
    return null
  }

  // Inici de sessió real amb Google (només si s'ha configurat l'identificador de client).
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !gRef.current) return
    let alive = true
    loadGoogleIdentity()
      .then(() => {
        if (!alive || !gRef.current) return
        window.google!.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          hd: SCHOOL.domain,
          ux_mode: 'popup',
          callback: (res: { credential: string }) => {
            const p = decodeGoogleCredential(res.credential)
            if (!p) return setError('No s’ha pogut llegir la resposta de Google.')
            const check = checkGoogleProfile(p)
            if (!check.ok) return setError(check.reason)
            setError(tryLogin(p.email, { name: p.name, picture: p.picture }, res.credential))
          },
        })
        window.google!.accounts.id.renderButton(gRef.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'ca', width: 320 })
      })
      .catch((e: Error) => setError(e.message))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <header className="topbar login-school">
        <img src={asset('logo-escola-ramon-pont.png')} alt="" />
        <span>
          <b>{SCHOOL.name}</b>
          <small>Terrassa</small>
        </span>
      </header>
      <main className="login">
        <div className="login-card">
          <section className="login-brand">
            <div>
              <h1 className="login-title">
                <img src={APP_ICON} alt="" className="login-app-icon" />
                <span className="login-title-text">
                  La teva <span>veu</span>
                </span>
              </h1>
              <p className="login-sub">La teva mirada ens ajuda a millorar</p>
            </div>
            <ul className="login-steps">
              <li><span aria-hidden="true">💭</span><p><b>Em miro</b> · m’autoavaluo: penso en com aprenc i què puc millorar</p></li>
              <li><span aria-hidden="true">👀</span><p><b>Et veig…</b> · valoro el professorat: explico com visc les classes</p></li>
              <li><span aria-hidden="true">🔐</span><p>Només amb el compte de l’escola</p></li>
            </ul>
          </section>

          <section className="login-form">
            <h2>Hola! Identifica’t</h2>
            <span className="domain-note">
              <Icon name="shield" /> Només comptes @{SCHOOL.domain}
            </span>

            {GOOGLE_CLIENT_ID ? (
              <div ref={gRef} style={{ minHeight: 44 }} />
            ) : (
              <>
                <button className="google-btn" disabled aria-describedby="g-note">
                  <GoogleLogo /> Continua amb Google
                </button>
                <p id="g-note" className="muted" style={{ fontSize: '.85rem' }}>
                  L’inici de sessió amb Google s’activarà quan l’escola autoritzi l’aplicació.
                </p>
              </>
            )}

            {error && (
              <div className="notice bad" role="alert">
                <Icon name="alert" />
                <div>{error}</div>
              </div>
            )}

            <div className="login-extra">
              {DEMO_AVAILABLE && (
                <div className="demo-cta">
                  <button className="btn small" onClick={() => setDemo(true)}>
                    <span aria-hidden="true">🧪</span> Prova la demostració
                  </button>
                  <small>Amb dades fictícies, sense compte</small>
                </div>
              )}
              <div className="demo-cta">
                <a className="btn small about-btn" href="#/projecte">
                  <span aria-hidden="true">💡</span> Per què La teva veu?
                </a>
                <small>El sentit del projecte</small>
              </div>
            </div>
          </section>
        </div>
        {demo && <DemoDialog onClose={() => setDemo(false)} tryLogin={tryLogin} />}
      </main>
    </>
  )
}

/** Tria de perfil per provar l'app amb dades fictícies desades només en aquest navegador. */
function DemoDialog({ onClose, tryLogin }: { onClose: () => void; tryLogin: (email: string, profile?: undefined, token?: string) => string | null }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reset, setReset] = useState<'ask' | 'done' | null>(null)
  const accounts = DEV_AUTH ? DEV : DEMO
  const groups = [...new Set(accounts.map((a) => a.group))]
  const enter = (raw: string) => setError(tryLogin(raw, undefined, DEV_AUTH ? raw.trim().toLowerCase() : undefined))
  return (
    <Modal title="Prova la demostració" onClose={onClose} wide>
      <p className="muted">
        {DEV_AUTH
          ? 'Servidor local de proves: les dades són fictícies i desapareixen en aturar-lo.'
          : 'Tria amb quin perfil vols entrar. Les dades són fictícies i es desen només en aquest navegador: pots respondre, crear recollides o afegir alumnes, i ningú més ho veurà.'}
      </p>
      {groups.map((g) => (
        <div key={g} className="demo-group">
          <h3>{g}</h3>
          <div className="demo-accounts">
            {accounts
              .filter((a) => a.group === g)
              .map((d) => (
                <button key={d.email} className="demo-acc" onClick={() => enter(d.email)}>
                  <span className="em" aria-hidden="true">{d.em}</span>
                  <span>
                    <b>{d.label}</b>
                    <small>{d.hint}</small>
                  </span>
                </button>
              ))}
          </div>
        </div>
      ))}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          enter(email)
        }}
      >
        <label className="sr-only" htmlFor="demo-email">Correu</label>
        <input id="demo-email" className="input" style={{ flex: 1, minWidth: 180 }} type="email" placeholder={`O escriu un correu: nom@${SCHOOL.domain}`} value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }} />
        <button className="btn primary" disabled={!email.trim()}>Entra</button>
      </form>
      {error && (
        <div className="notice bad" role="alert">
          <Icon name="alert" />
          <div>{error}</div>
        </div>
      )}
      {!DEV_AUTH && (
        <div className="row demo-reset">
          {reset === 'ask' ? (
            <>
              <span>Es perdran els canvis que hagis fet en aquest navegador.</span>
              <button className="btn small" onClick={() => setReset(null)}>Cancel·la</button>
              <button className="btn small primary" onClick={() => { resetDemo(); setReset('done') }}>Restaura</button>
            </>
          ) : reset === 'done' ? (
            <span className="muted">Dades de demostració restaurades.</span>
          ) : (
            <button className="link-btn" onClick={() => setReset('ask')}>Restaura les dades fictícies inicials</button>
          )}
        </div>
      )}
    </Modal>
  )
}
