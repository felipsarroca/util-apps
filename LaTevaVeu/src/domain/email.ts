// Comprovació del correu de l'escola. Sense dependències del navegador: la fa servir també el servidor.
import { SCHOOL } from './catalog'

export type DomainCheck = { ok: true; email: string } | { ok: false; reason: string }

export function checkSchoolEmail(raw: string): DomainCheck {
  const email = String(raw ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: 'Escriu una adreça de correu completa.' }
  if (email.split('@')[1] !== SCHOOL.domain)
    return { ok: false, reason: `Només s’hi pot entrar amb el compte de l’escola (@${SCHOOL.domain}). Tanca la sessió de l’altre compte i torna-ho a provar.` }
  return { ok: true, email }
}
