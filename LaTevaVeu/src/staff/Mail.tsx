// Correu: des de quin compte s'envien els informes, on van les respostes i el text de cada missatge.

import { useRef, useState } from 'react'
import { setMail, useDemoState } from '../data/api'
import { SCHOOL } from '../domain/catalog'
import { DEFAULT_TEMPLATES, exampleVars, longDate, MAIL_FIELDS, MAIL_KINDS, MAIL_LIMITS, REMINDER_DAYS, renderMail, senderOf, TEACHER_SENDER, validateMail, cleanMail, type MailKind } from '../domain/mail'
import { fetchReminders, postRemindNow, postRemindTest, useRemote } from '../data/remote'
import type { MailSettings, Session } from '../domain/types'
import { Icon, useToast } from '../ui/common'
import { PageHead } from './StaffApp'

export function MailScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const [draft, setDraft] = useState<MailSettings>(s.mail)
  const [kind, setKind] = useState<MailKind>('families')
  const [toast, showToast] = useToast()
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const dirty = JSON.stringify(cleanMail(draft)) !== JSON.stringify(s.mail)
  const problem = validateMail(cleanMail(draft))
  const tpl = draft[kind]
  const setTpl = (patch: Partial<MailSettings[MailKind]>) => setDraft((d) => ({ ...d, [kind]: { ...d[kind], ...patch } }))
  const preview = renderMail(kind, cleanMail(draft), exampleVars(kind))
  const replyTo = kind !== 'families' ? TEACHER_SENDER.email : draft.replyTo === 'tutor' ? 'el tutor o tutora del grup' : draft.replyToEmail || '—'
  const from = senderOf(kind, draft)

  // Insereix el marcador on hi ha el cursor del text.
  const insert = (key: string) => {
    const el = bodyRef.current
    const token = `{${key}}`
    if (!el) return setTpl({ body: tpl.body + token })
    const [a, b] = [el.selectionStart, el.selectionEnd]
    setTpl({ body: tpl.body.slice(0, a) + token + tpl.body.slice(b) })
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + token.length, a + token.length)
    })
  }

  const save = () => {
    try {
      setMail(session, draft)
      setDraft(cleanMail(draft))
      showToast('Configuració del correu desada.')
    } catch (e) {
      showToast((e as Error).message)
    }
  }

  return (
    <>
      <PageHead title="Correu" sub="Des de quin compte s’envien els informes, on arriben les respostes i què diu cada missatge.">
        <button className="btn" disabled={!dirty} onClick={() => setDraft(s.mail)}>Desfés els canvis</button>
        <button className="btn primary" disabled={!dirty || !!problem} onClick={save}>
          <Icon name="check" /> Desa
        </button>
      </PageHead>

      <div className="notice">
        <Icon name="cloud" />
        <div>
          L’enviament real el farà el servidor de l’escola, sempre amb una prova prèvia i registre de cada missatge. Aquí es deixa decidit des d’on s’envia i amb quin text, perquè tothom ho pugui revisar abans.
        </div>
      </div>

      <section className="card panel">
        <h2>Remitent dels correus a les famílies</h2>
        <p className="muted">Els correus al professorat («Així et veiem») surten sempre de <b>{TEACHER_SENDER.email}</b>, en nom de l’Equip Directiu, i les respostes hi tornen.</p>
        <div className="mail-grid">
          <label className="field">
            <span>Compte que envia</span>
            <input
              className="input"
              type="email"
              placeholder={`p. ex. latevaveu@${SCHOOL.domain}`}
              value={draft.sender}
              onChange={(e) => setDraft({ ...draft, sender: e.target.value })}
            />
            <small className="muted">
              Recomanat: un compte de l’escola dedicat a l’app, no el d’una persona. Així els enviaments no depenen de qui hi ha al càrrec i queden tots junts a la safata d’enviats.
            </small>
          </label>
          <label className="field">
            <span>Nom que veu qui el rep</span>
            <input className="input" maxLength={MAIL_LIMITS.name} value={draft.senderName} onChange={(e) => setDraft({ ...draft, senderName: e.target.value })} />
          </label>
        </div>
        <fieldset className="mail-reply">
          <legend>Si una família respon el correu, la resposta arriba a…</legend>
          <label className="radio">
            <input type="radio" name="reply" checked={draft.replyTo === 'tutor'} onChange={() => setDraft({ ...draft, replyTo: 'tutor' })} />
            <span><b>El tutor o la tutora del grup</b> <small className="muted">(recomanat: és qui coneix l’alumne)</small></span>
          </label>
          <label className="radio">
            <input type="radio" name="reply" checked={draft.replyTo === 'fixed'} onChange={() => setDraft({ ...draft, replyTo: 'fixed' })} />
            <span><b>Una adreça fixa</b></span>
          </label>
          {draft.replyTo === 'fixed' && (
            <input className="input" type="email" aria-label="Adreça per a les respostes" placeholder={`p. ex. secretaria@${SCHOOL.domain}`} value={draft.replyToEmail} onChange={(e) => setDraft({ ...draft, replyToEmail: e.target.value })} />
          )}
        </fieldset>
        {!draft.sender && (
          <div className="notice warn">
            <Icon name="alert" />
            <div>Encara no s’ha indicat el compte que envia. Fins que no hi sigui, no es podrà enviar cap correu.</div>
          </div>
        )}
      </section>

      <section className="card panel">
        <h2>Recordatoris automàtics</h2>
        <p className="muted">
          Uns dies abans que es tanqui una recollida, La teva veu envia un recordatori a l’alumnat que encara no ha lliurat «Em miro» i al professorat que no ha lliurat l’autoavaluació d’«Et veig…».
          Cada persona en rep <b>un sol</b> per recollida, des de <b>{TEACHER_SENDER.email}</b>. El text es pot canviar a les pestanyes de sota.
        </p>
        <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
          <label className="check">
            <input type="checkbox" checked={draft.reminders.enabled} onChange={(e) => setDraft({ ...draft, reminders: { ...draft.reminders, enabled: e.target.checked } })} />
            <span><b>Envia’ls automàticament</b></span>
          </label>
          <label className="field inline">
            <span>Quan falten</span>
            <select className="input" value={draft.reminders.daysBefore} onChange={(e) => setDraft({ ...draft, reminders: { ...draft.reminders, daysBefore: Number(e.target.value) } })}>
              {REMINDER_DAYS.map((d) => (
                <option key={d} value={d}>{d === 1 ? '1 dia' : `${d} dies`}</option>
              ))}
            </select>
            <span>per tancar la recollida</span>
          </label>
        </div>
        {session.remote ? <ReminderStatus dirty={dirty} /> : <p className="muted"><small>A la demostració no s’envia cap correu.</small></p>}
      </section>

      <div className="tabs" role="tablist">
        {(Object.keys(MAIL_KINDS) as MailKind[]).map((k) => (
          <button key={k} role="tab" aria-selected={kind === k} className={`tab${kind === k ? ' cur' : ''}`} onClick={() => setKind(k)}>
            {MAIL_KINDS[k].title} · «{MAIL_KINDS[k].kicker}»
          </button>
        ))}
      </div>

      <div className="mail-edit">
        <section className="card panel">
          <p className="muted"><b>Qui el rep:</b> {MAIL_KINDS[kind].who}</p>
          <label className="field">
            <span>Assumpte</span>
            <input className="input" maxLength={MAIL_LIMITS.subject} value={tpl.subject} onChange={(e) => setTpl({ subject: e.target.value })} />
          </label>
          <label className="field">
            <span>Text</span>
            <textarea ref={bodyRef} className="textarea mail-body" rows={18} maxLength={MAIL_LIMITS.body} value={tpl.body} onChange={(e) => setTpl({ body: e.target.value })} />
          </label>
          <div className="mail-fields">
            <small className="muted">Insereix:</small>
            {MAIL_FIELDS[kind].map((f) => (
              <button key={f.key} className="btn small" title={`Exemple: ${f.example}`} onClick={() => insert(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          <small className="muted">
            Deixa una línia en blanc entre paràgrafs. Les línies que comencen amb «- » es mostren com a llista i les que comencen amb «&gt; », com a nota destacada.
          </small>
          <div className="row">
            <button
              className="link-btn"
              disabled={tpl.subject === DEFAULT_TEMPLATES[kind].subject && tpl.body === DEFAULT_TEMPLATES[kind].body}
              onClick={() => setTpl(DEFAULT_TEMPLATES[kind])}
            >
              Recupera el text original
            </button>
          </div>
        </section>

        <section className="card panel">
          <h2>Previsualització</h2>
          <dl className="mail-head">
            <dt>De</dt>
            <dd>{from.name || '—'} &lt;{from.email || 'compte pendent'}&gt;</dd>
            <dt>Respon a</dt>
            <dd>{replyTo}</dd>
            <dt>Assumpte</dt>
            <dd><b>{preview.subject}</b></dd>
            {preview.attachment && (
              <>
                <dt>Adjunt</dt>
                <dd><Icon name="file" /> {preview.attachment}</dd>
              </>
            )}
          </dl>
          <iframe className="mail-frame" title="Previsualització del correu" sandbox="" srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0">${preview.html}</body>`} />
          <small className="muted">Amb dades d’exemple. Cada missatge es personalitza amb les dades reals.</small>
        </section>
      </div>

      {problem && dirty && (
        <div className="notice bad" role="alert">
          <Icon name="alert" />
          <div>{problem}</div>
        </div>
      )}
      {toast}
    </>
  )
}

/** Mode connectat: si el servidor pot enviar, qui els rebria avui i què s'ha enviat. */
function ReminderStatus({ dirty }: { dirty: boolean }) {
  const st = useRemote(fetchReminders)
  const [busy, setBusy] = useState(false)
  const [toast, showToast] = useToast()
  const run = async (fn: () => Promise<string>) => {
    setBusy(true)
    try {
      showToast(await fn())
      st.reload()
    } catch (e) {
      showToast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (st.loading) return <p className="muted">Comprovant el servidor…</p>
  if (st.error || !st.data) return <p className="notice bad">{st.error}</p>
  const d = st.data
  const total = d.pending.reduce((n, p) => n + p.n, 0)
  const who = (k: 'students' | 'teachers', n: number) => (k === 'students' ? `${n} ${n === 1 ? 'alumne' : 'alumnes'}` : `${n} ${n === 1 ? 'docent' : 'docents'}`)
  return (
    <div className="reminder-status">
      {!d.configured && (
        <div className="notice warn">
          <Icon name="alert" />
          <div>El servidor encara no té permís per enviar des de {d.sender}. Fins que l’Equip Directiu no autoritzi l’enviament a Google Workspace (vegeu el README), els recordatoris no surten.</div>
        </div>
      )}
      <h3>Avui ({longDate(d.today)}) els rebrien</h3>
      {d.pending.length ? (
        <ul>
          {d.pending.map((p) => (
            <li key={`${p.kind}${p.campaign}`}>
              {who(p.kind, p.n)} · {p.kind === 'students' ? 'Em miro' : 'Et veig…'} · {p.campaign} <small className="muted">(es tanca el {longDate(p.end)})</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Ningú: no hi ha cap recollida oberta que es tanqui en {d.daysBefore === 1 ? '1 dia' : `${d.daysBefore} dies`} o menys amb lliuraments pendents.</p>
      )}
      {!!d.sent.length && (
        <>
          <h3>Enviats</h3>
          <ul>
            {d.sent.map((x) => (
              <li key={`${x.kind}${x.campaign}`}>
                {who(x.kind, x.n)} · {x.campaign} <small className="muted">(darrer: {new Date(x.last).toLocaleString('ca', { dateStyle: 'short', timeStyle: 'short' })})</small>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" disabled={!d.configured || busy || dirty} onClick={() => run(async () => `Prova enviada a ${(await postRemindTest()).to}.`)}>
          <Icon name="mail" /> Envia’m una prova
        </button>
        <button className="btn" disabled={!d.configured || busy || dirty || !total} onClick={() => run(async () => {
          const r = await postRemindNow()
          return r.failed ? `${r.sent} enviats; ${r.failed} no s’han pogut enviar (es tornaran a provar).` : `${r.sent} recordatoris enviats.`
        })}>
          <Icon name="mail" /> Envia ara els pendents ({total})
        </button>
        {dirty && <small className="muted">Desa els canvis abans d’enviar.</small>}
      </div>
      {toast}
    </div>
  )
}
