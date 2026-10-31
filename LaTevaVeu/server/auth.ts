// Identificació: el navegador envia el testimoni d'identitat de Google (Authorization: Bearer …)
// i el servidor en comprova la signatura, l'emissor, l'audiència, el domini i el correu verificat.
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { GradeId } from '../src/domain/types'
import type { Db } from './db'
import { forbidden, unauthorized } from './errors'

export interface Identity {
  sub: string
  email: string
  name: string
}

export type Verifier = (token: string) => Promise<Identity>

export function googleVerifier(clientId: string, domain: string): Verifier {
  const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
  return async (token) => {
    let payload
    try {
      ;({ payload } = await jwtVerify(token, jwks, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: clientId }))
    } catch {
      throw unauthorized('La sessió no és vàlida o ha caducat.')
    }
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : ''
    if (payload.hd !== domain || payload.email_verified !== true || !email.endsWith(`@${domain}`) || !payload.sub) throw unauthorized('Només es pot entrar amb un compte verificat de l’escola.')
    return { sub: payload.sub, email, name: typeof payload.name === 'string' ? payload.name : email }
  }
}

export type Role = 'admin' | 'teacher' | 'direction'

export interface Actor {
  userId: string
  email: string
  name: string
  roles: Set<Role>
  /** Només per a l'alumnat. */
  student?: { id: string; gradeId: GradeId; group: string; electives: string[] }
}

/**
 * Converteix la identitat de Google en un usuari del centre. Tenir un compte de l'escola
 * no dona accés: cal ser al cens de l'alumnat o tenir un rol assignat.
 */
export async function resolveActor(db: Db, id: Identity, yearId: string): Promise<Actor> {
  return db.tx(async (q) => {
    let [user] = (await q.query<{ id: string; google_sub: string | null; display_name: string }>('select id, google_sub, display_name from users where lower(email) = $1 and active', [id.email])).rows
    // El mateix correu amb un altre identificador de Google vol dir un compte recreat: no s'accepta sense revisió.
    if (user?.google_sub && user.google_sub !== id.sub) throw forbidden('Aquest compte ha canviat. Cal que l’administració el revisi.')
    const [student] = (
      await q.query<{ id: string; user_id: string | null; name: string; grade_id: GradeId; label: string; enrollment_id: string }>(
        `select s.id, s.user_id, s.given_name || ' ' || s.family_name as name, g.grade_id, g.label, e.id as enrollment_id
           from students s join enrollments e on e.student_id = s.id and e.active
           join class_groups g on g.id = e.group_id and g.year_id = $2
          where lower(s.school_email) = $1 and s.active`,
        [id.email, yearId],
      )
    ).rows
    if (!user && student) {
      ;[user] = (await q.query<{ id: string; google_sub: string; display_name: string }>('insert into users (google_sub, email, display_name) values ($1, $2, $3) returning id, google_sub, display_name', [id.sub, id.email, id.name])).rows
    }
    if (!user) throw forbidden('Encara no tens accés. Si ets de l’escola, avisa la persona administradora.')
    await q.query('update users set google_sub = coalesce(google_sub, $2), last_login_at = now() where id = $1', [user.id, id.sub])
    if (student && student.user_id !== user.id) await q.query('update students set user_id = $2 where id = $1', [student.id, user.id])
    const roles = new Set((await q.query<{ role: Role }>('select role from user_roles where user_id = $1', [user.id])).rows.map((r) => r.role))
    // L'alumnat apareix amb el nom del cens.
    const actor: Actor = { userId: user.id, email: id.email, name: student?.name ?? user.display_name, roles }
    if (student) {
      const electives = (await q.query<{ subject_id: string }>('select subject_id from student_subjects where enrollment_id = $1', [student.enrollment_id])).rows.map((r) => r.subject_id)
      actor.student = { id: student.id, gradeId: student.grade_id, group: student.label, electives }
    } else if (!roles.size) throw forbidden('Encara no tens accés. Si ets de l’escola, avisa la persona administradora.')
    return actor
  })
}
