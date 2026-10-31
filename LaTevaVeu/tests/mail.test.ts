// Proves de la configuració i del format dels correus.
import { describe, expect, it } from 'vitest'
import { createDemoState } from '../src/data/seed'
import { cleanMail, DEFAULT_MAIL, renderMail, validateMail } from '../src/domain/mail'
import type { Session } from '../src/domain/types'

const mem = new Map<string, string>()
globalThis.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 } as Storage

const api = await import('../src/data/api')
const login = (email: string) => api.resolveSession(email) as Session

describe('correu: configuració', () => {
  it('el text per defecte és vàlid encara que no hi hagi compte remitent', () => {
    expect(validateMail(DEFAULT_MAIL)).toBeNull()
  })
  it('el compte que envia ha de ser de l’escola', () => {
    expect(validateMail(cleanMail({ sender: 'latevaveu@ramonpont.cat' }))).toBeNull()
    expect(validateMail(cleanMail({ sender: 'algu@gmail.com' }))).toMatch(/de l’escola/)
    expect(validateMail(cleanMail({ sender: 'x@ramonpont.cat.fals.com' }))).toMatch(/de l’escola/)
  })
  it('amb adreça fixa per a les respostes, cal escriure-la', () => {
    expect(validateMail(cleanMail({ replyTo: 'fixed', replyToEmail: '' }))).toMatch(/respostes/)
    expect(validateMail(cleanMail({ replyTo: 'fixed', replyToEmail: 'secretaria@ramonpont.cat' }))).toBeNull()
  })
  it('rebutja marcadors que no existeixen', () => {
    const m = cleanMail({ families: { subject: 'Hola {docent}', body: 'Text' } })
    expect(validateMail(m)).toMatch(/\{docent\}/)
  })
  it('només l’administració ho pot canviar, i queda al registre', () => {
    expect(() => api.setMail(login('tutoria.2eso@ramonpont.cat'), { sender: 'latevaveu@ramonpont.cat' })).toThrow()
    const { state: s } = api.runWithState(createDemoState(), () => api.setMail(login('admin.demo@ramonpont.cat'), { sender: 'LaTevaVeu@ramonpont.cat ' }))
    expect(s.mail.sender).toBe('latevaveu@ramonpont.cat')
    expect(s.audit[0].action).toBe('Correu')
    expect(() => api.setMail(login('admin.demo@ramonpont.cat'), { sender: 'algu@gmail.com' })).toThrow(/de l’escola/)
  })
})

describe('correu: format', () => {
  const vars = { alumne: 'Laia', alumne_complet: 'Laia Puig <Soler>', recollida: '1a avaluació', curs_escolar: '2026-2027' }
  it('omple els marcadors a l’assumpte i al text', () => {
    const m = renderMail('families', DEFAULT_MAIL, vars)
    expect(m.subject).toBe('«Així em veig» · Laia Puig <Soler> · 1a avaluació')
    expect(m.text).toContain('Laia ha dedicat una estona')
    expect(m.text).toContain('· Quin dels teus compromisos')
    expect(m.text).not.toMatch(/\{\w+\}/)
  })
  it('a la versió amb format escapa les dades i fa la llista i la nota', () => {
    const m = renderMail('families', DEFAULT_MAIL, { ...vars, alumne: '<b>Laia</b>' })
    expect(m.html).toContain('&lt;b&gt;Laia&lt;/b&gt;')
    expect(m.html).not.toContain('<b>Laia</b>')
    expect(m.html).toContain('<ul')
    expect(m.html).toContain('border-left:4px solid')
  })
  it('l’avís al professorat no adjunta res i porta l’enllaç', () => {
    const m = renderMail('teachers', DEFAULT_MAIL, { docent: 'Marta', recollida: 'Recollida de tardor', enllac: 'https://ja.cat/tensveu' })
    expect(m.html).toContain('<a href="https://ja.cat/tensveu"')
    expect(m.html).not.toContain('adjunt en PDF')
  })
})
