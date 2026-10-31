// Correu: des de quin compte s'envien els informes, on van les respostes i el text de cada missatge.

import { useRef, useState } from 'react'
import { setMail, useDemoState } from '../data/api'
import { SCHOOL } from '../domain/catalog'
import { DEFAULT_TEMPLATES, exampleVars, MAIL_FIELDS, MAIL_KINDS, MAIL_LIMITS, renderMail, validateMail, cleanMail, type MailKind } from '../domain/mail'
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
  const replyTo = draft.replyTo === 'tutor' ? (kind === 'families' ? 'el tutor o tutora del grup' : 'cap: missatge informatiu') : draft.replyToEmail || '—'

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
        <h2>Remitent</h2>
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
            <dd>{draft.senderName || '—'} &lt;{draft.sender || 'compte pendent'}&gt;</dd>
            <dt>Respon a</dt>
            <dd>{replyTo}</dd>
            <dt>Assumpte</dt>
            <dd><b>{preview.subject}</b></dd>
            {MAIL_KINDS[kind].attachment && (
              <>
                <dt>Adjunt</dt>
                <dd><Icon name="file" /> Així em veig – Laia Puig Soler.pdf</dd>
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
