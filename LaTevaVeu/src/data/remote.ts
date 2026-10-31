// Mode connectat: quan hi ha VITE_API_URL, l'app parla amb el servidor (server/) en lloc de
// simular-lo al navegador. De moment cobreix «Et veig»; «Em miro» continua en mode de demostració.
import { useEffect, useRef, useState } from 'react'
import type { CenterStage, TeacherReport } from '../domain/feedback'
import type { Answers, FeedbackStatus, GradeId, ModerationStatus, Scale, SelfTask, Session, StageId } from '../domain/types'
import type { FeedbackHome } from './api'

export const API_URL: string | undefined = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || undefined
/** Només amb el servidor local de proves (npm run server:local): el testimoni és el correu. */
export const DEV_AUTH = import.meta.env.VITE_DEV_AUTH === '1'

// El testimoni de Google dura una hora i només es guarda en aquesta pestanya.
const TOKEN_KEY = 'latevaveu:token'
let token: string | null = (() => {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
})()

export function setToken(t: string | null) {
  token = t
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignorat */
  }
}

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Avís quan la sessió caduca: l'App tanca la sessió i torna a l'inici. */
export const SESSION_EXPIRED = 'latevaveu:session-expired'

async function call<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      // Perquè l'últim esborrany arribi encara que es tanqui la pestanya.
      keepalive: method !== 'GET',
    })
  } catch {
    throw new ApiError(0, 'No es pot connectar amb el servidor. Comprova la connexió i torna-ho a provar.')
  }
  if (res.status === 401) window.dispatchEvent(new Event(SESSION_EXPIRED))
  if (!res.ok) throw new ApiError(res.status, ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Hi ha hagut un error.')
  return (res.status === 204 ? undefined : await res.json()) as T
}

const enc = encodeURIComponent

// ---------- Sessió ----------

interface Me {
  email: string
  name: string
  roles: ('admin' | 'teacher' | 'direction')[]
  student?: { gradeId: GradeId; group: string }
}

/** Valida el testimoni al servidor i en treu la sessió. */
export async function remoteLogin(idToken: string, picture?: string): Promise<Session> {
  setToken(idToken)
  try {
    const me = await call<Me>('GET', '/api/me')
    const role = me.student ? 'student' : me.roles.includes('admin') ? 'admin' : 'teacher'
    return { email: me.email, name: me.name, role, picture, direction: me.roles.includes('direction'), remote: me.student ? { gradeId: me.student.gradeId, group: me.student.group } : {} }
  } catch (e) {
    setToken(null)
    throw e
  }
}

// ---------- Alumnat ----------

export interface RemoteHome extends FeedbackHome {
  stage: StageId
  scale: Scale
}

export const fetchHome = () => call<RemoteHome | null>('GET', '/api/et-veig/home')
export const putDraft = (campaignId: string, teacherEmail: string, answers: Answers) => call<void>('PUT', `/api/et-veig/${campaignId}/drafts/${enc(teacherEmail)}`, { answers })
export const postSubmit = (campaignId: string, teacherEmail: string, answers: Answers) => call<void>('POST', `/api/et-veig/${campaignId}/submit/${enc(teacherEmail)}`, { answers })

// ---------- Personal ----------

export interface RemoteCampaign {
  id: string
  year: string
  label: string
  stages: StageId[]
  start: string
  end: string
  status: FeedbackStatus
}

export interface RemoteComment {
  id: string
  teacherName: string
  stage: StageId
  questionId: string
  original: string
  published: string | null
  status: ModerationStatus
  flags: string[]
}

export const fetchCampaigns = () => call<RemoteCampaign[]>('GET', '/api/et-veig/campaigns')
export const postStatus = (campaignId: string, status: FeedbackStatus) => call<void>('POST', `/api/et-veig/${campaignId}/status`, { status })
export const fetchComments = (campaignId: string) => call<RemoteComment[]>('GET', `/api/et-veig/${campaignId}/comments`)
export const postModeration = (id: string, status: Exclude<ModerationStatus, 'pendent'>, text?: string) => call<void>('POST', `/api/et-veig/comments/${id}/moderation`, { status, text })
export const fetchSelfTasks = () => call<SelfTask[]>('GET', '/api/et-veig/self')
export const putSelf = (campaignId: string, stage: StageId, answers: Answers, context: Record<string, string[]>, submit: boolean) =>
  call<void>('PUT', `/api/et-veig/${campaignId}/self/${stage}`, { answers, context, submit })
export const fetchReport = (campaignId: string, teacherEmail: string) => call<TeacherReport>('GET', `/api/et-veig/${campaignId}/reports/${enc(teacherEmail)}`)
export const fetchCenter = (campaignId: string) => call<CenterStage[]>('GET', `/api/et-veig/${campaignId}/center`)

export interface RemoteTeacherStatus {
  email: string
  name: string
  stages: StageId[]
  n: number
  eligible: number
  selfDone: number
}
export const fetchTeacherStatus = (campaignId: string) => call<RemoteTeacherStatus[]>('GET', `/api/et-veig/${campaignId}/teachers`)

/** Carrega dades del servidor i permet tornar-les a demanar. `key` identifica què es carrega. */
export function useRemote<T>(load: () => Promise<T>, key = '') {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true })
  const [tick, setTick] = useState(0)
  const loader = useRef(load)
  useEffect(() => {
    loader.current = load
  })
  useEffect(() => {
    let alive = true
    loader.current().then(
      (data) => alive && setState({ data, loading: false }),
      (e: Error) => alive && setState({ error: e.message, loading: false }),
    )
    return () => {
      alive = false
    }
  }, [key, tick])
  return { ...state, reload: () => setTick((t) => t + 1) }
}

// ---------- Centre: correus de les famílies ----------

export interface RemoteFamily {
  ref: string
  name: string
  surname: string
  email: string
  gradeId: GradeId
  group: string
  guardians: { name: string; email: string; validated: boolean }[]
}
export interface RemoteFamilyImport {
  students: number
  emails: number
  issues: { line: number; msg: string }[]
}
export const fetchFamilies = () => call<RemoteFamily[]>('GET', '/api/centre/families')
export const postFamiliesImport = (csv: string, filename?: string) => call<RemoteFamilyImport>('POST', '/api/centre/families/import', { csv, filename })
export const postGuardianValidated = (ref: string, email: string, validated: boolean) => call<void>('POST', '/api/centre/families/validate', { ref, email, validated })
export const postGuardianRemove = (ref: string, email: string) => call<void>('POST', '/api/centre/families/remove', { ref, email })
