// Identificació. El requisit d'entrada és un compte de Google del domini @ramonpont.cat.
// Aquesta comprovació al navegador és només la primera barrera: en producció, el servidor
// ha de verificar la signatura del testimoni de Google (aud, iss, exp, hd i email_verified)
// i enllaçar el compte a una matrícula o a un permís abans de donar accés a cap dada.

import { SCHOOL } from '../domain/catalog'

export const GOOGLE_CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined

export type DomainCheck = { ok: true; email: string } | { ok: false; reason: string }

export function checkSchoolEmail(raw: string): DomainCheck {
  const email = raw.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: 'Escriu una adreça de correu completa.' }
  if (email.split('@')[1] !== SCHOOL.domain)
    return { ok: false, reason: `Només s’hi pot entrar amb el compte de l’escola (@${SCHOOL.domain}). Tanca la sessió de l’altre compte i torna-ho a provar.` }
  return { ok: true, email }
}

export interface GoogleProfile {
  email: string
  name: string
  picture?: string
  hd?: string
  emailVerified: boolean
}

/** Descodifica (sense verificar) el testimoni d'identitat de Google per mostrar el perfil. */
export function decodeGoogleCredential(credential: string): GoogleProfile | null {
  try {
    const payload = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(decodeURIComponent(escape(atob(payload))))
    return { email: json.email, name: json.name ?? json.email, picture: json.picture, hd: json.hd, emailVerified: !!json.email_verified }
  } catch {
    return null
  }
}

export function checkGoogleProfile(p: GoogleProfile): DomainCheck {
  if (!p.emailVerified) return { ok: false, reason: 'El compte de Google no té el correu verificat.' }
  if (p.hd !== SCHOOL.domain) return checkSchoolEmail(p.email).ok ? { ok: false, reason: 'El compte no pertany al Google Workspace de l’escola.' } : checkSchoolEmail(p.email)
  return checkSchoolEmail(p.email)
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: Record<string, unknown>) => void
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
          disableAutoSelect: () => void
        }
      }
    }
  }
}

let gisLoading: Promise<void> | null = null
export function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('No s’ha pogut carregar l’inici de sessió de Google.'))
    document.head.appendChild(s)
  })
  return gisLoading
}
