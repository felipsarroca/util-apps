import { useEffect, useMemo, useRef, useState } from 'react'
import { feedbackHome, logAudit, saveDraft, studentHome, submitResponse, useDemoState, type FeedbackHome } from '../data/api'
import { gradeById, STAGES } from '../domain/catalog'
import { buildSteps, findMissing, progress, requiredKeys, stepComplete, type Step } from '../domain/engine'
import type { Answers, Session } from '../domain/types'
import { fmtDate, Icon, Modal, readSection, useSection, useToast, type Section } from '../ui/common'
import { EtVeigStudent } from './EtVeig'
import { StepBody } from './Questions'

type View = 'home' | 'form' | 'done' | 'etveig'

const ESTIMATE: Record<string, string> = { CM: '5 minuts', CS: '8 minuts', ESO: '12 minuts' }

export function StudentApp({ session }: { session: Session }) {
  const s = useDemoState()
  const home = studentHome(s, session)
  const fb = feedbackHome(s, session)
  const [toast, showToast] = useToast()
  // L'adreça …/#/em-miro o …/#/et-veig obre directament l'apartat, si està disponible.
  const viewFor = (sec: Section | null): View => (sec === 'et-veig' && fb ? 'etveig' : sec === 'em-miro' && home?.campaign && home.template ? 'form' : 'home')
  const [view, setViewState] = useState<View>(() => viewFor(readSection()))
  const setSection = useSection((sec) => setViewState(viewFor(sec)))
  const setView = (v: View) => {
    setViewState(v)
    setSection(v === 'etveig' ? 'et-veig' : v === 'home' ? null : 'em-miro')
  }

  if (!home) return <p className="stu-main">No s’ha trobat la teva matrícula.</p>
  const grade = gradeById(home.student.gradeId)
  const stage = grade.stage

  return (
    <div className={`stu stage-${stage}`}>
      {view === 'home' && <StudentHome home={home} fb={fb} session={session} onStart={() => setView('form')} onEtVeig={() => setView('etveig')} toast={showToast} />}
      {view === 'etveig' && <EtVeigStudent session={session} stage={stage} onExit={() => setView('home')} />}
      {view === 'form' && home.campaign && home.template && (
        <Questionnaire
          key={home.campaign.id}
          session={session}
          stage={stage}
          home={home}
          onExit={() => setView('home')}
          onDone={() => setView('done')}
        />
      )}
      {view === 'done' && (
        <main className="stu-main">
          <section className="card done-hero" aria-live="polite">
            <div className="big" aria-hidden="true">🎉</div>
            <h1>Ja està! Gràcies, {home.student.name}.</h1>
            <p className="step-intro" style={{ maxWidth: 520 }}>
              La teva autoavaluació s’ha lliurat correctament. El teu tutor o tutora la podrà llegir. Fins al {fmtDate(home.campaign!.end)} encara la pots revisar si cal.
            </p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={() => setView('home')}>Torna a l’inici</button>
            </div>
            <p className="muted" style={{ fontSize: '.9rem' }}>Si fas servir un ordinador compartit, recorda tancar la sessió.</p>
          </section>
        </main>
      )}
      {toast}
    </div>
  )
}

function StudentHome({ home, fb, session, onStart, onEtVeig, toast }: { home: NonNullable<ReturnType<typeof studentHome>>; fb: FeedbackHome | null; session: Session; onStart: () => void; onEtVeig: () => void; toast: (m: string) => void }) {
  const { student, campaign, response, template } = home
  const grade = gradeById(student.gradeId)
  const [wrong, setWrong] = useState(false)
  const [note, setNote] = useState('')
  const steps = useMemo(
    () => (template ? buildSteps(template, { stage: grade.stage, subjects: home.subjects, previousGoal: home.previousGoal }) : []),
    [template, grade.stage, home.subjects, home.previousGoal],
  )
  const pr = progress(steps, response?.answers ?? {})
  const delivered = response?.status === 'LLIURADA' || response?.status === 'VALIDADA'

  return (
    <main className="stu-main">
      <section className="card hello">
        <h1>
          Hola, {student.name}! <span aria-hidden="true">👋</span>
        </h1>
        <div className="identity">
          <span style={{ fontSize: '2rem' }} aria-hidden="true">🎒</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <b>
              {student.name} {student.surname}
            </b>
            <div className="muted" style={{ fontWeight: 700 }}>
              {grade.name} · Grup {student.group}
            </div>
          </div>
          <button className="link-btn" onClick={() => setWrong(true)}>
            Aquestes dades no són correctes
          </button>
        </div>

        {!campaign && !fb && (
          <div className="notice">
            <Icon name="info" />
            <div>
              <b>Ara no tens res pendent.</b>
              <br />
              Quan s’obri una autoavaluació o una valoració del professorat, la trobaràs aquí.
            </div>
          </div>
        )}

        {campaign && (
          <div className="campaign-box mod em">
            <div className="mod-kicker em">
              <span aria-hidden="true">💭</span> Em miro
              <span className="mod-desc">Penso en com aprenc, què faig bé i què puc millorar</span>
            </div>
            <div className="row">
              <h2>
                {campaign.label} <span className="muted" style={{ fontWeight: 700, fontSize: '.85em' }}>· {campaign.year}</span>
              </h2>
              <span className="spacer" />
              {delivered ? <span className="badge ok">Lliurada</span> : response ? <span className="badge warn">A mitges</span> : <span className="badge info">Per començar</span>}
            </div>
            <p className="muted" style={{ fontWeight: 700 }}>
              Oberta fins al {fmtDate(campaign.end)} · Uns {ESTIMATE[grade.stage]}
            </p>
            {response && !delivered && (
              <div className="progress">
                <div className="progress-top">
                  <span>Ja has respost {pr.done} de {pr.total} preguntes</span>
                  <span>{Math.round(pr.ratio * 100)} %</span>
                </div>
                <div className="progress-bar">
                  <div style={{ width: `${pr.ratio * 100}%` }} />
                </div>
              </div>
            )}
            {delivered && (
              <p>
                L’has lliurada el {fmtDate(response!.submittedAt!, true)}. Si vols canviar alguna resposta, ho pots fer fins que es tanqui.
              </p>
            )}
            <div className="row">
              <button className="btn primary large" onClick={onStart}>
                {delivered ? 'Revisa les respostes' : response ? 'Continua on ho havies deixat' : 'Comença'}
                <Icon name="arrowR" />
              </button>
            </div>
          </div>
        )}

        {fb && <EtVeigCard fb={fb} onOpen={onEtVeig} />}

        {campaign && !delivered && (
          <div className="tips">
            <div className="tip"><span className="em" aria-hidden="true">💾</span>Es desa tot sol. Pots parar i continuar un altre dia.</div>
            <div className="tip"><span className="em" aria-hidden="true">🤔</span>No és un examen: no hi ha respostes bones ni dolentes.</div>
            <div className="tip"><span className="em" aria-hidden="true">{grade.stage === 'ESO' ? '🎯' : '🔊'}</span>{grade.stage === 'ESO' ? 'Sigues sincer: t’ajudarà a millorar.' : 'Prem «Escolta» si vols que et llegeixi la pregunta.'}</div>
          </div>
        )}

        {home.history.length > 0 && (
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Les meves autoavaluacions anteriors</summary>
            <ul>
              {home.history.map((h) => (
                <li key={h.campaign.id}>
                  {h.campaign.label} ({h.campaign.year}) · lliurada el {fmtDate(h.response.submittedAt!)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {wrong && (
        <Modal title="Les meves dades no són correctes" onClose={() => setWrong(false)}>
          <p>Explica què està malament (per exemple, el curs o el grup). Ho rebrà l’administració de l’escola, que ho corregirà. Tu no has de canviar res.</p>
          <textarea className="textarea" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sóc del grup B, no del grup A." />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setWrong(false)}>Cancel·la</button>
            <button
              className="btn primary"
              disabled={!note.trim()}
              onClick={() => {
                logAudit(session, 'Incidència d’identitat', `${student.id}: ${note.trim()}`)
                setWrong(false)
                setNote('')
                toast('Gràcies! L’administració revisarà les teves dades.')
              }}
            >
              Envia
            </button>
          </div>
        </Modal>
      )}
      <p className="muted" style={{ textAlign: 'center', fontSize: '.85rem' }}>{STAGES[grade.stage].name}</p>
    </main>
  )
}

function EtVeigCard({ fb, onOpen }: { fb: FeedbackHome; onOpen: () => void }) {
  const done = fb.targets.filter((t) => t.status === 'lliurat').length
  const total = fb.targets.length
  const started = fb.targets.some((t) => t.status !== 'pendent')
  return (
    <div className="campaign-box mod ev">
      <div className="mod-kicker ev">
        <span aria-hidden="true">👀</span> Et veig
        <span className="mod-desc">Explico com visc les classes i què m’ajuda a aprendre</span>
      </div>
      <div className="row">
        <h2>{fb.campaign.label}</h2>
        <span className="spacer" />
        {done === total ? <span className="badge ok">Fet</span> : started ? <span className="badge warn">{done} de {total}</span> : <span className="badge info">Per començar</span>}
      </div>
      <p className="muted" style={{ fontWeight: 700 }}>
        Oberta fins al {fmtDate(fb.campaign.end)} · {total} {total === 1 ? 'docent' : 'docents'} per valorar
      </p>
      <div className="row">
        <button className={`btn large ${done === total ? '' : 'primary ev'}`} onClick={onOpen}>
          {done === total ? 'Mira el que has fet' : started ? 'Continua' : 'Comença'}
          <Icon name="arrowR" />
        </button>
      </div>
    </div>
  )
}

function Questionnaire({ session, stage, home, onExit, onDone }: { session: Session; stage: 'CM' | 'CS' | 'ESO'; home: NonNullable<ReturnType<typeof studentHome>>; onExit: () => void; onDone: () => void }) {
  const s = useDemoState()
  const template = home.template!
  const campaign = home.campaign!
  const steps: Step[] = useMemo(
    () => buildSteps(template, { stage, subjects: home.subjects, previousGoal: home.previousGoal }),
    [template, stage, home.subjects, home.previousGoal],
  )
  const [answers, setAnswers] = useState<Answers>(() => home.response?.answers ?? {})
  const firstOpen = useMemo(() => {
    const i = steps.findIndex((st) => st.kind !== 'review' && !stepComplete(st, home.response?.answers ?? {}))
    return i < 0 ? steps.length - 1 : i
  }, [steps, home.response])
  const [i, setI] = useState(home.response?.status === 'LLIURADA' ? steps.length - 1 : firstOpen)
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [confirm, setConfirm] = useState(false)
  const [toast, showToast] = useToast()
  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<Answers | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const flush = () => {
    if (!pending.current) return
    try {
      saveDraft(session, campaign.id, pending.current)
      setSaveState('saved')
    } catch (e) {
      setSaveState('error')
      showToast((e as Error).message)
    }
    pending.current = null
  }
  // Desa en sortir o en tancar la pestanya.
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

  const set = (key: string, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [key]: value }
      pending.current = next
      return next
    })
    setSaveState('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 700)
    // Cicle mitjà: en triar una opció gran es passa sol a la pregunta següent.
    const st = steps[i]
    const nextAnswers = { ...answers, [key]: value }
    const choiceOnly = st.kind === 'question' ? st.question.type === 'scale' : st.kind === 'subject' && !st.question.subjectComment
    if (stage === 'CM' && choiceOnly && stepComplete(st, nextAnswers)) {
      window.setTimeout(() => go(i + 1), 450)
    }
  }

  const go = (n: number) => {
    const target = Math.max(0, Math.min(steps.length - 1, n))
    setI(target)
    setFlagged(new Set())
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => document.getElementById('step-heading')?.focus({ preventScroll: true }), 60)
  }

  const step = steps[i]
  const pr = progress(steps, answers)
  const missing = findMissing(steps, answers)
  const subjectSteps = steps.map((st, idx) => ({ st, idx })).filter((x) => x.st.kind === 'subject')

  const next = () => {
    const req = requiredKeys(step).filter((r) => !answers[r.key]?.trim())
    if (req.length && step.kind !== 'review') {
      // No es bloqueja: s'avisa i es deixa continuar (es podrà completar a la revisió final).
      setFlagged(new Set(req.map((r) => r.key)))
      showToast(req.length === 1 ? 'Et falta una resposta. La pots fer ara o més tard.' : `Et falten ${req.length} respostes. Les pots fer ara o més tard.`)
      if (flagged.size) go(i + 1)
      return
    }
    go(i + 1)
  }

  const submit = () => {
    flush()
    try {
      submitResponse(session, campaign.id, answers)
      onDone()
    } catch (e) {
      showToast((e as Error).message)
    }
  }

  const reviewSections = useMemo(() => {
    const map = new Map<string, { title: string; emoji?: string; first: number; total: number; done: number }>()
    steps.forEach((st, idx) => {
      if (st.kind === 'review') return
      const sec = st.section
      const e = map.get(sec.id) ?? { title: sec.title, emoji: sec.emoji, first: idx, total: 0, done: 0 }
      const keys = requiredKeys(st)
      e.total += keys.length
      e.done += keys.filter((r) => answers[r.key]?.trim()).length
      map.set(sec.id, e)
    })
    return [...map.values()]
  }, [steps, answers])

  return (
    <main className="stu-main" ref={topRef}>
      <div className="progress" aria-label="Progrés">
        <div className="progress-top">
          <span>
            {step.kind === 'review' ? 'Revisió final' : `Pas ${i + 1} de ${steps.length - 1}`} · {Math.round(pr.ratio * 100)} % respost
          </span>
          <span className={`save-state ${saveState}`} aria-live="polite">
            {saveState === 'saving' && 'Desant…'}
            {saveState === 'saved' && (
              <>
                <Icon name="check" /> Desat
              </>
            )}
            {saveState === 'error' && 'No s’ha pogut desar'}
          </span>
        </div>
        <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pr.ratio * 100)}>
          <div style={{ width: `${pr.ratio * 100}%` }} />
        </div>
      </div>

      {step.kind === 'subject' && subjectSteps.length > 1 && (
        <nav className="subj-strip no-print" aria-label="Matèries">
          {subjectSteps.map(({ st, idx }) =>
            st.kind === 'subject' ? (
              <button key={idx} className={`subj-chip${idx === i ? ' cur' : ''}${stepComplete(st, answers) ? ' done' : ''}`} onClick={() => go(idx)} aria-current={idx === i ? 'step' : undefined}>
                {st.subject.short}
              </button>
            ) : null,
          )}
        </nav>
      )}

      <section className="card step-card" key={i} aria-labelledby="step-heading">
        <h1 id="step-heading" tabIndex={-1} className="sr-only">
          {step.kind === 'review' ? 'Revisió final' : step.kind === 'subject' ? step.subject.long : step.section.title}
        </h1>
        {step.kind !== 'review' ? (
          <StepBody step={step} ctx={{ stage, scales: s.scales, answers, set, flagged, previousGoal: home.previousGoal }} />
        ) : (
          <>
            <div className="step-kicker">
              <span className="em" aria-hidden="true">🔎</span> Abans d’enviar
            </div>
            <h2 className="step-title">{missing.length ? 'Gairebé ho tens!' : 'Ho tens tot! Revisa-ho i envia-ho.'}</h2>
            {missing.length > 0 && (
              <div className="notice warn">
                <Icon name="alert" />
                <div>
                  Et {missing.length === 1 ? 'falta 1 resposta' : `falten ${missing.length} respostes`}. Toca un apartat per completar-lo.
                </div>
              </div>
            )}
            <div className="review-list">
              {reviewSections.map((r) => (
                <button key={r.title} className="review-item" onClick={() => go(r.first)}>
                  <span className="em" aria-hidden="true">{r.emoji}</span>
                  <b>{r.title}</b>
                  {r.done === r.total ? <span className="badge ok">Complet</span> : <span className="badge warn">{r.total - r.done} per fer</span>}
                  <Icon name="arrowR" />
                </button>
              ))}
            </div>
            {missing.length > 0 && (
              <button className="btn" onClick={() => go(missing[0].step)}>
                Vés a la primera resposta pendent
              </button>
            )}
          </>
        )}
      </section>

      <div className="stu-nav no-print">
        <button className="btn" onClick={() => (i === 0 ? onExit() : go(i - 1))}>
          <Icon name="arrowL" />
          {i === 0 ? 'Inici' : 'Enrere'}
        </button>
        <span className="hint">{step.kind === 'review' ? '' : stepComplete(step, answers) ? 'Molt bé! 👍' : stage === 'ESO' ? 'Tria una opció a cada fila' : 'Tria una resposta'}</span>
        {step.kind === 'review' ? (
          <button className="btn primary" disabled={missing.length > 0} onClick={() => setConfirm(true)}>
            Envia <Icon name="check" />
          </button>
        ) : (
          <button className="btn primary" onClick={next}>
            Següent <Icon name="arrowR" />
          </button>
        )}
      </div>

      {confirm && (
        <Modal title="Vols enviar l’autoavaluació?" onClose={() => setConfirm(false)}>
          <p>La rebrà el teu tutor o tutora. Fins al {fmtDate(campaign.end)} encara la podràs modificar.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirm(false)}>Encara no</button>
            <button className="btn primary" onClick={submit}>
              Sí, envia-la
            </button>
          </div>
        </Modal>
      )}
      {toast}
    </main>
  )
}
