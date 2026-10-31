// «Et veig»: l'alumne valora, una sola vegada, cada docent que li fa classe.
// Primària: una afirmació per pantalla (cicle mitjà) o per dimensió; ESO: una dimensió per pantalla.

import { useEffect, useMemo, useRef, useState } from 'react'
import { feedbackHome, saveFeedbackDraft, submitFeedback, useDemoState, type FeedbackHome, type FeedbackTarget } from '../data/api'
import { missingItems } from '../domain/feedback'
import { fetchHome, postSubmit, putDraft, useRemote } from '../data/remote'
import type { Answers, FeedbackItem, Scale, Session, StageId } from '../domain/types'
import { fmtDate, Icon, initials, Modal, SpeakButton, useToast } from '../ui/common'
import { BigScale, SegScale, TextAnswer } from './Questions'

const hueOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7)

export function TeacherAvatar({ t, size = 52 }: { t: { email: string; name: string }; size?: number }) {
  return (
    <span className="t-avatar" style={{ width: size, height: size, background: `hsl(${hueOf(t.email)} 42% 36%)` }} aria-hidden="true">
      {initials(t.name)}
    </span>
  )
}

/** D'on surten les dades: el navegador (demostració) o el servidor (mode connectat). */
interface EtVeigSource {
  home: FeedbackHome | null
  scale?: Scale
  saveDraft: (campaignId: string, teacherEmail: string, answers: Answers) => void | Promise<void>
  submit: (campaignId: string, teacherEmail: string, answers: Answers) => void | Promise<void>
  /** Torna a demanar l'estat després d'un lliurament. */
  refresh?: () => void
}

export function EtVeigStudent({ session, stage, onExit }: { session: Session; stage: StageId; onExit: () => void }) {
  const s = useDemoState()
  const home = feedbackHome(s, session)
  const source: EtVeigSource = {
    home,
    scale: home ? s.scales.find((x) => x.id === home.form.scaleId) : undefined,
    saveDraft: (c, t, a) => saveFeedbackDraft(session, c, t, a),
    submit: (c, t, a) => submitFeedback(session, c, t, a),
  }
  return <EtVeigView source={source} stage={stage} onExit={onExit} />
}

/** Mode connectat: les dades i els lliuraments passen pel servidor. */
export function EtVeigRemote({ onExit }: { onExit?: () => void }) {
  const r = useRemote(fetchHome)
  if (r.loading && !r.data) return <main className="stu-main"><section className="card hello"><p>Carregant…</p></section></main>
  if (r.error)
    return (
      <main className="stu-main">
        <section className="card hello">
          <div className="notice bad" role="alert"><Icon name="alert" /><div>{r.error}</div></div>
          <div className="row">
            <button className="btn" onClick={r.reload}>Torna-ho a provar</button>
          </div>
        </section>
      </main>
    )
  const home = r.data ?? null
  return <EtVeigView source={{ home, scale: home?.scale, saveDraft: putDraft, submit: postSubmit, refresh: r.reload }} stage={home?.stage ?? 'ESO'} onExit={onExit} />
}

function EtVeigView({ source, stage, onExit }: { source: EtVeigSource; stage: StageId; onExit?: () => void }) {
  const { home } = source
  const [current, setCurrent] = useState<string | null>(null)
  const [toast, showToast] = useToast()
  if (!home || !source.scale) {
    return (
      <main className="stu-main">
        <section className="card hello">
          <p>Ara no hi ha cap valoració del professorat oberta.</p>
          {onExit && <button className="btn" onClick={onExit}>Torna a l’inici</button>}
        </section>
      </main>
    )
  }
  const target = home.targets.find((t) => t.email === current)
  if (target && target.status !== 'lliurat')
    return (
      <TeacherForm
        key={target.email}
        source={source}
        scale={source.scale}
        stage={stage}
        home={home}
        target={target}
        onBack={() => {
          setCurrent(null)
          source.refresh?.()
        }}
        onDone={() => {
          setCurrent(null)
          source.refresh?.()
          showToast(`Gràcies! La valoració de ${target.name} s’ha lliurat.`)
          window.scrollTo({ top: 0 })
        }}
      />
    )
  return (
    <>
      <TeacherList home={home} stage={stage} onPick={setCurrent} onExit={onExit} />
      {toast}
    </>
  )
}

function TeacherList({ home, stage, onPick, onExit }: { home: FeedbackHome; stage: StageId; onPick: (email: string) => void; onExit?: () => void }) {
  const done = home.targets.filter((t) => t.status === 'lliurat').length
  const total = home.targets.length
  const all = done === total
  return (
    <main className="stu-main etveig">
      <section className="card hello">
        <div className="mod-kicker ev">
          <span aria-hidden="true">👀</span> Et veig
        </div>
        <h1>{all ? 'Ho has fet tot! Gràcies.' : 'La meva mirada al professorat'}</h1>
        <p className="step-intro">
          {stage === 'CM'
            ? 'Explica com et sents a les classes de cada mestre. No hi ha respostes bones ni dolentes.'
            : 'Explica com vius les classes de cada docent i què t’ajuda a aprendre. Serveix perquè l’escola millori com ensenya.'}
        </p>
        <div className="notice">
          <Icon name="shield" />
          <div>
            Les teves respostes s’ajunten amb les dels companys. El docent veu els resultats del grup, <b>mai les teves respostes</b>. Un cop lliurada la valoració d’un docent, ja no es pot canviar.
          </div>
        </div>
        <div className="progress">
          <div className="progress-top">
            <span>
              {done} de {total} {stage === 'CM' ? 'mestres' : 'docents'} fets
            </span>
            <span>Oberta fins al {fmtDate(home.campaign.end)}</span>
          </div>
          <div className="progress-bar ev" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
            <div style={{ width: `${(done / total) * 100}%` }} />
          </div>
        </div>
        <div className="t-grid">
          {home.targets.map((t) => (
            <TeacherCard key={t.email} t={t} onPick={() => onPick(t.email)} />
          ))}
        </div>
        {!all && <p className="muted" style={{ fontSize: '.9rem' }}>Pots fer-ne uns quants avui i continuar un altre dia: el que comencis es desa sol.</p>}
        {onExit && (
          <div className="row">
            <button className="btn" onClick={onExit}>
              <Icon name="arrowL" /> Torna a l’inici
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

function TeacherCard({ t, onPick }: { t: FeedbackTarget; onPick: () => void }) {
  const done = t.status === 'lliurat'
  return (
    <button className={`t-card${done ? ' done' : ''}`} onClick={onPick} disabled={done} aria-label={`${t.name}, ${t.subjects.map((x) => x.short).join(', ')}. ${done ? 'Lliurat' : t.status === 'esborrany' ? 'A mitges' : 'Per fer'}`}>
      <TeacherAvatar t={t} />
      <span className="t-info">
        <b>{t.name}</b>
        <small>{t.subjects.map((x) => x.short).join(' · ')}</small>
      </span>
      {done ? <span className="badge ok">Fet</span> : t.status === 'esborrany' ? <span className="badge warn">A mitges</span> : <span className="t-go"><Icon name="arrowR" /></span>}
    </button>
  )
}

type FStep = { kind: 'item'; item: FeedbackItem; index: number } | { kind: 'dim'; dimId: string } | { kind: 'open' }

function TeacherForm({ source, scale, stage, home, target, onBack, onDone }: { source: EtVeigSource; scale: Scale; stage: StageId; home: FeedbackHome; target: FeedbackTarget; onBack: () => void; onDone: () => void }) {
  const { form, campaign } = home
  const [busy, setBusy] = useState(false)
  const steps: FStep[] = useMemo(
    () => [
      ...(stage === 'CM' ? form.items.map((item, index) => ({ kind: 'item' as const, item, index })) : form.dimensions.map((d) => ({ kind: 'dim' as const, dimId: d.id }))),
      { kind: 'open' as const },
    ],
    [form, stage],
  )
  const [answers, setAnswers] = useState<Answers>(() => target.draft ?? {})
  const [i, setI] = useState(() => {
    const k = steps.findIndex((st) => (st.kind === 'item' ? !target.draft?.[st.item.id] : st.kind === 'dim' ? form.items.some((x) => x.dimensionId === st.dimId && !target.draft?.[x.id]) : true))
    return Math.max(0, k)
  })
  const [confirm, setConfirm] = useState(false)
  const [flag, setFlag] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toast, showToast] = useToast()
  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<Answers | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const flush = () => {
    if (!pending.current) return
    const answers = pending.current
    pending.current = null
    Promise.resolve()
      .then(() => source.saveDraft(campaign.id, target.email, answers))
      .then(
        () => setSaved(true),
        (e: Error) => showToast(e.message),
      )
  }
  useEffect(() => {
    const onHide = () => flush()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      window.clearTimeout(timer.current)
      flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = (n: number) => {
    setI(Math.max(0, Math.min(steps.length - 1, n)))
    setFlag(false)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const set = (key: string, value: string) => {
    const next = { ...answers, [key]: value }
    setAnswers(next)
    pending.current = next
    setSaved(false)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 700)
    // Cicle mitjà: en triar una opció es passa sol a la pantalla següent.
    if (stage === 'CM' && steps[i].kind === 'item') window.setTimeout(() => go(i + 1), 420)
  }

  const step = steps[i]
  const answered = form.items.filter((x) => answers[x.id]).length
  const missing = missingItems(form, answers)
  const stepMissing = step.kind === 'item' ? (answers[step.item.id] ? [] : [step.item]) : step.kind === 'dim' ? form.items.filter((x) => x.dimensionId === step.dimId && !answers[x.id]) : []

  const next = () => {
    if (stepMissing.length && !flag) {
      setFlag(true)
      showToast(stepMissing.length === 1 ? 'Et falta una resposta. Si no ho saps, tria «No ho puc valorar».' : `Et falten ${stepMissing.length} respostes.`)
      return
    }
    go(i + 1)
  }

  const submit = async () => {
    window.clearTimeout(timer.current)
    pending.current = null
    setBusy(true)
    try {
      await source.submit(campaign.id, target.email, answers)
      onDone()
    } catch (e) {
      showToast((e as Error).message)
      setConfirm(false)
      setBusy(false)
    }
  }

  const dim = step.kind === 'dim' ? form.dimensions.find((d) => d.id === step.dimId)! : step.kind === 'item' ? form.dimensions.find((d) => d.id === step.item.dimensionId) : undefined
  let n = 0

  return (
    <main className="stu-main etveig" ref={topRef}>
      <div className="t-banner">
        <TeacherAvatar t={target} size={44} />
        <span className="t-info">
          <small>Estàs valorant</small>
          <b>{target.name}</b>
          <small>{target.subjects.map((x) => x.long).join(' · ')}</small>
        </span>
        <span className="spacer" />
        <span className={`save-state ${saved ? 'saved' : ''}`} aria-live="polite">
          {saved && (
            <>
              <Icon name="check" /> Desat
            </>
          )}
        </span>
      </div>
      <div className="progress" aria-label="Progrés">
        <div className="progress-top">
          <span>
            {answered} de {form.items.length} respostes
          </span>
          <span>
            Pantalla {i + 1} de {steps.length}
          </span>
        </div>
        <div className="progress-bar ev">
          <div style={{ width: `${(answered / form.items.length) * 100}%` }} />
        </div>
      </div>

      <section className="card step-card" key={i} aria-label={dim?.name ?? 'Comentaris'}>
        {step.kind === 'item' && (
          <>
            <div className="step-kicker ev">
              <span className="em" aria-hidden="true">{dim?.emoji}</span> {step.index + 1} de {form.items.length}
            </div>
            <div className="row" style={{ justifyContent: 'center' }}>
              <SpeakButton text={`${step.item.student} ${scale.options.map((o) => o.label).join(', ')}`} label="Escolta" />
            </div>
            <p className="statement">{step.item.student}</p>
            <BigScale name={step.item.id} scale={scale} value={answers[step.item.id]} label={step.item.student} onChange={(v) => set(step.item.id, v)} />
          </>
        )}
        {step.kind === 'dim' && dim && (
          <>
            <div>
              <div className="step-kicker ev">
                <span className="em" aria-hidden="true">{dim.emoji}</span> {form.dimensions.indexOf(dim) + 1} de {form.dimensions.length}
              </div>
              <h2 className="step-title">{dim.name}</h2>
            </div>
            <div className="qlist">
              {form.items
                .filter((x) => x.dimensionId === dim.id)
                .map((item) => {
                  const v = answers[item.id]
                  const miss = flag && !v
                  return (
                    <fieldset key={item.id} className={`qrow inline${v ? ' done' : ''}${miss ? ' missing' : ''}`}>
                      <legend className="sr-only">{item.student}</legend>
                      <div className="qtext" aria-hidden="true">
                        <span className="qnum">{v ? '✓' : ++n}</span>
                        <span style={{ flex: 1 }}>{item.student}</span>
                        {stage === 'CS' && <SpeakButton text={item.student} label="" />}
                      </div>
                      <SegScale name={item.id} scale={scale} value={v} label={item.student} onChange={(x) => set(item.id, x)} />
                    </fieldset>
                  )
                })}
            </div>
          </>
        )}
        {step.kind === 'open' && (
          <>
            <div>
              <div className="step-kicker ev">
                <span className="em" aria-hidden="true">💬</span> Per acabar
              </div>
              <h2 className="step-title">Vols afegir-hi alguna cosa?</h2>
            </div>
            <p className="step-intro">És opcional. Escriu sobre les classes, no sobre companys. No posis noms ni detalls que permetin saber qui ets.</p>
            {form.open.map((q) => (
              <TextAnswer key={q.id} q={{ id: q.id, type: 'shortText', text: q.text, required: false, maxLength: q.maxLength, active: true }} ctx={{ stage, scales: [scale], answers, set }} />
            ))}
            {missing.length > 0 && (
              <div className="notice warn">
                <Icon name="alert" />
                <div>
                  Et {missing.length === 1 ? 'falta 1 afirmació' : `falten ${missing.length} afirmacions`} per respondre.{' '}
                  <button className="link-btn" onClick={() => go(steps.findIndex((st) => (st.kind === 'item' ? st.item.id === missing[0].id : st.kind === 'dim' && st.dimId === missing[0].dimensionId)))}>
                    Vés-hi
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <div className="stu-nav no-print">
        <button className="btn" onClick={() => (i === 0 ? onBack() : go(i - 1))}>
          <Icon name="arrowL" /> {i === 0 ? 'Llista' : 'Enrere'}
        </button>
        <span className="hint">{step.kind === 'open' ? '' : stepMissing.length ? 'Tria una opció' : 'Molt bé! 👍'}</span>
        {step.kind === 'open' ? (
          <button className="btn primary ev" disabled={missing.length > 0} onClick={() => setConfirm(true)}>
            Lliura <Icon name="check" />
          </button>
        ) : (
          <button className="btn primary ev" onClick={next}>
            Següent <Icon name="arrowR" />
          </button>
        )}
      </div>

      {confirm && (
        <Modal title={`Lliures la valoració de ${target.name}?`} onClose={() => setConfirm(false)}>
          <p>Un cop lliurada, s’ajuntarà amb la dels companys i ja no la podràs canviar.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirm(false)}>Encara no</button>
            <button className="btn primary ev" onClick={submit} disabled={busy}>
              {busy ? 'Lliurant…' : 'Sí, lliura-la'}
            </button>
          </div>
        </Modal>
      )}
      {toast}
    </main>
  )
}
