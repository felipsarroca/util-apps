import { useEffect, useRef, useState, type ReactNode } from 'react'

const base = (import.meta.env.BASE_URL || './').replace(/\/?$/, '/')
export const asset = (p: string) => `${base}assets/${p}`

// ---------- Icones (traç, 24×24) ----------
const P: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  file: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 5v16',
  users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3',
  arrowL: 'M15 18l-6-6 6-6',
  arrowR: 'M9 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  print: 'M7 9V3h10v6M7 18H4v-7h16v7h-3M7 14h10v7H7z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  plus: 'M12 5v14M5 12h14',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  cloud: 'M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z',
  speaker: 'M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  text: 'M4 6h16M4 12h10M4 18h13',
  chart: 'M3 20h18M6 16v-5M11 16V6M16 16v-8M21 16v-3',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
}

export function Icon({ name, title }: { name: keyof typeof P | string; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={P[name] ?? P.info} />
    </svg>
  )
}

export function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

// ---------- Peu corporatiu ----------
export function Footer() {
  const lic = 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ca'
  return (
    <footer className="felip-app-footer">
      <a className="felip-license-image-link" href={lic} target="_blank" rel="noopener noreferrer" aria-label="Llicència Creative Commons BY-NC-SA 4.0">
        <img className="felip-license-image" src={asset('CC_BY-NC-SA.png')} alt="Creative Commons BY-NC-SA" />
      </a>
      <div className="felip-footer-text">
        <p>
          Aplicació creada per{' '}
          <a href="https://ja.cat/felipsarroca" target="_blank" rel="noopener noreferrer">
            Felip Sarroca
          </a>{' '}
          amb assistència de la IA
        </p>
        <p>
          Obra sota llicència{' '}
          <a href={lic} target="_blank" rel="noopener noreferrer">
            CC BY-NC-SA 4.0
          </a>
        </p>
      </div>
    </footer>
  )
}

// ---------- Escalat en pantalles d'ordinador petites ----------
// Mateix criteri que edu-apps/Equacions: disseny de referència 1440 × 800 px útils.
// En portàtils (p. ex. 1366 × 768, o 1920 × 1080 al 125-150 %) es redueix tot uniformement.
// En tauletes i mòbils (< 1200 px d'amplada) no s'escala: hi ha la disposició responsiva.
const BASE_W = 1440, BASE_H = 800, MIN_ZOOM = 0.8, MIN_DESKTOP_W = 1200

export function fitScale() {
  const w = window.innerWidth, h = window.innerHeight
  let z = Math.min(1, w / BASE_W, h / BASE_H)
  z = Math.max(MIN_ZOOM, Math.floor(z * 20) / 20)
  if (w < MIN_DESKTOP_W || document.documentElement.classList.contains('big-text')) z = 1
  const root = document.documentElement
  root.style.setProperty('--ui-zoom', String(z))
  root.classList.toggle('h-700', h / z <= 700)
}

export function useFitScale() {
  useEffect(() => {
    fitScale()
    window.addEventListener('resize', fitScale)
    // Canvi de monitor o d'escalat del sistema: canvia devicePixelRatio.
    let mq: MediaQueryList | null = null
    const watchDpr = () => {
      mq?.removeEventListener('change', onDpr)
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      mq.addEventListener('change', onDpr)
    }
    const onDpr = () => {
      fitScale()
      watchDpr()
    }
    watchDpr()
    return () => {
      window.removeEventListener('resize', fitScale)
      mq?.removeEventListener('change', onDpr)
    }
  }, [])
}

// ---------- Avisos i diàlegs ----------
export function useToast(): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null)
  const t = useRef<number | undefined>(undefined)
  const show = (m: string) => {
    setMsg(m)
    window.clearTimeout(t.current)
    t.current = window.setTimeout(() => setMsg(null), 3200)
  }
  return [
    msg ? (
      <div className="toast" role="status" aria-live="polite">
        {msg}
      </div>
    ) : null,
    show,
  ]
}

export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="row">
          <h2>{title}</h2>
          <span className="spacer" />
          <button className="btn icon small ghost" onClick={onClose} aria-label="Tanca">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------- Lectura en veu alta (síntesi del navegador, sense serveis externs) ----------
export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(text: string, onEnd?: () => void) {
  if (!canSpeak()) return
  const s = window.speechSynthesis
  s.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ca-ES'
  const voice = s.getVoices().find((v) => v.lang.toLowerCase().startsWith('ca'))
  if (voice) u.voice = voice
  u.rate = 0.92
  u.onend = () => onEnd?.()
  u.onerror = () => onEnd?.()
  s.speak(u)
}

export function SpeakButton({ text, label = 'Escolta' }: { text: string; label?: string }) {
  const [on, setOn] = useState(false)
  useEffect(() => () => {
    if (canSpeak()) window.speechSynthesis.cancel()
  }, [text])
  if (!canSpeak()) return null
  return (
    <button
      type="button"
      className={`btn small speak${on ? ' on' : ''}`}
      onClick={() => {
        if (on) {
          window.speechSynthesis.cancel()
          setOn(false)
        } else {
          setOn(true)
          speak(text, () => setOn(false))
        }
      }}
      aria-pressed={on}
      aria-label={label ? undefined : on ? 'Atura la lectura' : 'Escolta la frase'}
    >
      <Icon name="speaker" />
      {label && (on ? 'Atura' : label)}
    </button>
  )
}

export const initials = (name: string) =>
  name
    .replace(/[^\p{L}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

export const fmtDate = (iso: string, withTime = false) => {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}), timeZone: 'Europe/Madrid' })
}

export const fmtShort = (iso: string) =>
  new Date(iso).toLocaleString('ca-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
