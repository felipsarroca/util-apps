import { useEffect, useRef, useState } from 'react'
import { resolveSession } from './data/api'
import { checkGoogleProfile, decodeGoogleCredential, GOOGLE_CLIENT_ID, loadGoogleIdentity } from './data/auth'
import { SCHOOL } from './domain/catalog'
import type { Session } from './domain/types'
import { asset, GoogleLogo, Icon } from './ui/common'

const DEMO: { email: string; em: string; label: string; hint: string }[] = [
  { email: 'pau.serra@ramonpont.cat', em: '🧒', label: 'Alumne de 3r', hint: 'Cicle mitjà' },
  { email: 'laia.puig@ramonpont.cat', em: '👧', label: 'Alumna de 5è', hint: 'Cicle superior, amb objectiu anterior' },
  { email: 'marc.vidal@ramonpont.cat', em: '🧑', label: 'Alumne de 2n d’ESO', hint: 'Amb optativa de francès' },
  { email: 'tutoria.2eso@ramonpont.cat', em: '📋', label: 'Marta Riera', hint: 'Matemàtiques ESO i tutora de 2n' },
  { email: 'sergi.prat@ramonpont.cat', em: '🏃', label: 'Sergi Prat', hint: 'Especialista d’EF: tres etapes' },
  { email: 'direccio.demo@ramonpont.cat', em: '🧭', label: 'Equip Directiu', hint: 'Visió de centre i moderació' },
  { email: 'admin.demo@ramonpont.cat', em: '🛡️', label: 'Administració', hint: 'Configuració, sense resultats' },
  { email: 'nou.usuari@ramonpont.cat', em: '❔', label: 'Compte no registrat', hint: 'De l’escola, però fora del cens' },
]

export function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [showDemo, setShowDemo] = useState(!GOOGLE_CLIENT_ID)
  const gRef = useRef<HTMLDivElement>(null)

  const tryLogin = (raw: string, profile?: { name?: string; picture?: string }) => {
    const r = resolveSession(raw, profile)
    if ('error' in r) setError(r.error)
    else onLogin(r)
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
            tryLogin(p.email, { name: p.name, picture: p.picture })
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
    <main className="login">
      <div className="login-card">
        <section className="login-brand">
          <div className="login-logo">
            <img src={asset('logo-escola-ramon-pont.png')} alt="" />
            {SCHOOL.name}
          </div>
          <div>
            <h1 className="login-title">
              La teva <span>veu</span>
            </h1>
            <p className="login-sub">La teva mirada ens ajuda a millorar</p>
          </div>
          <ul className="login-steps">
            <li><span aria-hidden="true">💭</span><p><b>Em miro</b> · penso en com aprenc i què puc millorar</p></li>
            <li><span aria-hidden="true">👀</span><p><b>Et veig</b> · explico com visc les classes</p></li>
            <li><span aria-hidden="true">🔐</span>Només amb el compte de l’escola</li>
          </ul>
        </section>

        <section className="login-form">
          <h2>Hola! Identifica’t</h2>
          <span className="domain-pill">
            <Icon name="shield" /> Només comptes @{SCHOOL.domain}
          </span>

          {GOOGLE_CLIENT_ID ? (
            <div ref={gRef} style={{ minHeight: 44 }} />
          ) : (
            <button className="google-btn" onClick={() => setShowDemo(true)} aria-describedby="g-note">
              <GoogleLogo /> Continua amb Google
            </button>
          )}
          {!GOOGLE_CLIENT_ID && (
            <p id="g-note" className="muted" style={{ fontSize: '.85rem' }}>
              Mode de demostració: l’inici de sessió de Google s’activarà quan l’escola autoritzi l’aplicació. Ara pots provar-la amb comptes fictícis.
            </p>
          )}

          {error && (
            <div className="notice bad" role="alert">
              <Icon name="alert" />
              <div>{error}</div>
            </div>
          )}

          {showDemo && (
            <div className="demo-box">
              <h3>Comptes de prova (dades fictícies)</h3>
              <div className="demo-accounts">
                {DEMO.map((d) => (
                  <button key={d.email} className="demo-acc" onClick={() => tryLogin(d.email)}>
                    <span className="em" aria-hidden="true">{d.em}</span>
                    <span>
                      <b>{d.label}</b>
                      <small>{d.hint}</small>
                    </span>
                  </button>
                ))}
              </div>
              <div className="or">o escriu un correu</div>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault()
                  tryLogin(email)
                }}
              >
                <label className="sr-only" htmlFor="demo-email">Correu</label>
                <input id="demo-email" className="input" style={{ flex: 1, minWidth: 180 }} type="email" placeholder={`nom@${SCHOOL.domain}`} value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }} />
                <button className="btn primary" disabled={!email.trim()}>Entra</button>
              </form>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
