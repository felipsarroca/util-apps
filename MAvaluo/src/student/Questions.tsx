// Components de pregunta. Es fan servir al flux de l'alumne i a la previsualització de l'editor.

import { useId } from 'react'
import { keyOf, NA, type Step } from '../domain/engine'
import type { Answers, Question, Scale, StageId } from '../domain/types'
import { SpeakButton } from '../ui/common'

interface Ctx {
  stage: StageId
  scales: Scale[]
  answers: Answers
  set: (key: string, value: string) => void
  /** Claus obligatòries que s'han intentat saltar (es marquen discretament). */
  flagged?: Set<string>
  previousGoal?: string
}

const scaleOf = (scales: Scale[], id?: string) => scales.find((s) => s.id === id)

/** Opcions segmentades accessibles (grup de botons d'opció natius). */
export function SegScale({ name, scale, value, onChange, label }: { name: string; scale: Scale; value?: string; onChange: (v: string) => void; label: string }) {
  const id = useId()
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {scale.options.map((o) => (
        <div className="seg-opt" key={o.value}>
          <input type="radio" id={`${id}-${o.value}`} name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <label htmlFor={`${id}-${o.value}`}>
            {o.emoji && <span className="em" aria-hidden="true">{o.emoji}</span>}
            {o.label}
          </label>
        </div>
      ))}
      {scale.allowNA && (
        <div className="seg-opt na">
          <input type="radio" id={`${id}-na`} name={name} value={NA} checked={value === NA} onChange={() => onChange(NA)} />
          <label htmlFor={`${id}-na`}>{scale.naLabel ?? 'No escau'}</label>
        </div>
      )}
    </div>
  )
}

/** Opcions grans amb emoji (cicle mitjà i seguiment d'objectius). */
export function BigScale({ name, scale, value, onChange, label }: { name: string; scale: Scale; value?: string; onChange: (v: string) => void; label: string }) {
  const id = useId()
  return (
    <div className="big-options" role="radiogroup" aria-label={label}>
      {scale.options.map((o) => (
        <div className="big-opt" key={o.value}>
          <input type="radio" id={`${id}-${o.value}`} name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <label htmlFor={`${id}-${o.value}`}>
            {o.emoji && <span className="em" aria-hidden="true">{o.emoji}</span>}
            <span>{o.label}</span>
          </label>
        </div>
      ))}
      {scale.allowNA && (
        <div className="big-opt na">
          <input type="radio" id={`${id}-na`} name={name} value={NA} checked={value === NA} onChange={() => onChange(NA)} />
          <label htmlFor={`${id}-na`}>
            <span className="em" aria-hidden="true">🤷</span>
            <span>{scale.naLabel ?? 'No escau'}</span>
          </label>
        </div>
      )}
    </div>
  )
}

export function TextAnswer({ q, ctx }: { q: Question; ctx: Ctx }) {
  const id = useId()
  const k = keyOf(q.id)
  const v = ctx.answers[k] ?? ''
  const max = q.maxLength ?? 400
  const missing = ctx.flagged?.has(k) && !v.trim()
  return (
    <div className="text-q">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <label htmlFor={id} style={{ flex: 1 }}>
          {q.text}
          {!q.required && <span className="muted" style={{ fontWeight: 600, fontSize: '.85em' }}> (opcional)</span>}
        </label>
        {ctx.stage !== 'ESO' && <SpeakButton text={`${q.text}. ${q.help ?? ''}`} />}
      </div>
      {q.help && <p className="help" id={`${id}-h`}>{q.help}</p>}
      <textarea
        id={id}
        className="textarea"
        rows={q.type === 'longText' ? 5 : ctx.stage === 'CM' ? 3 : 2}
        maxLength={max}
        value={v}
        aria-describedby={q.help ? `${id}-h` : undefined}
        aria-invalid={missing || undefined}
        onChange={(e) => ctx.set(k, e.target.value)}
        placeholder={ctx.stage === 'CM' ? 'Escriu aquí…' : ''}
        style={missing ? { borderColor: 'var(--bad)' } : undefined}
      />
      <div className={`counter${v.length > max * 0.9 ? ' near' : ''}`}>
        {v.length} / {max} caràcters
      </div>
    </div>
  )
}

function ScaleRow({ q, n, ctx }: { q: Question; n: number; ctx: Ctx }) {
  const scale = scaleOf(ctx.scales, q.scaleId)
  const k = keyOf(q.id)
  const v = ctx.answers[k]
  if (!scale) return null
  const missing = ctx.flagged?.has(k) && !v
  return (
    <fieldset className={`qrow inline${v ? ' done' : ''}${missing ? ' missing' : ''}`}>
      <legend className="sr-only">{q.text}</legend>
      <div className="qtext" aria-hidden="true">
        <span className="qnum">{v ? '✓' : n}</span>
        <span style={{ flex: 1 }}>{q.text}</span>
        {ctx.stage === 'CS' && <SpeakButton text={q.text} label="" />}
      </div>
      {q.help && <p className="muted" style={{ fontSize: '.9rem' }}>{q.help}</p>}
      <SegScale name={k} scale={scale} value={v} label={q.text} onChange={(x) => ctx.set(k, x)} />
    </fieldset>
  )
}

export function StepBody({ step, ctx }: { step: Step; ctx: Ctx }) {
  if (step.kind === 'question') {
    const q = step.question
    if (q.type === 'scale') {
      const scale = scaleOf(ctx.scales, q.scaleId)!
      const k = keyOf(q.id)
      return (
        <>
          <div className="step-kicker">
            <span className="em" aria-hidden="true">{step.section.emoji}</span>
            {step.section.title} · {step.indexInSection + 1} de {step.section.questions.filter((x) => x.active).length}
          </div>
          <div className="row" style={{ justifyContent: 'center' }}>
            <SpeakButton text={`${q.text} ${scale.options.map((o) => o.label).join(', ')}`} label="Escolta la pregunta" />
          </div>
          <p className="statement" id={`st-${q.id}`}>{q.text}</p>
          <BigScale name={k} scale={scale} value={ctx.answers[k]} label={q.text} onChange={(v) => ctx.set(k, v)} />
        </>
      )
    }
    if (q.type === 'goalReview') return <GoalReview q={q} ctx={ctx} section={step.section} />
    return (
      <>
        <div className="step-kicker">
          <span className="em" aria-hidden="true">{step.section.emoji}</span>
          {step.section.title}
        </div>
        <TextAnswer q={q} ctx={ctx} />
      </>
    )
  }

  if (step.kind === 'section') {
    const { section } = step
    let n = 0
    return (
      <>
        <div>
          <div className="step-kicker">
            <span className="em" aria-hidden="true">{section.emoji}</span>
            {ctx.stage === 'ESO' ? 'Bloc' : 'Apartat'}
          </div>
          <h2 className="step-title">{section.title}</h2>
        </div>
        {section.intro && <p className="step-intro">{section.intro}</p>}
        <div className="qlist">
          {step.questions.map((q) =>
            q.type === 'scale' ? (
              <ScaleRow key={q.id} q={q} n={++n} ctx={ctx} />
            ) : q.type === 'goalReview' ? (
              <GoalReview key={q.id} q={q} ctx={ctx} section={section} inline />
            ) : q.type === 'info' ? (
              <p key={q.id} className="notice">{q.text}</p>
            ) : (
              <TextAnswer key={q.id} q={q} ctx={ctx} />
            ),
          )}
        </div>
      </>
    )
  }

  if (step.kind === 'subject') {
    const { question: q, subject } = step
    return (
      <>
        <div className="subj-head">
          <div className="subj-dot" style={{ background: `hsl(${subject.hue} 55% 38%)` }} aria-hidden="true">
            {subject.short.slice(0, 2)}
          </div>
          <div>
            <small>
              {ctx.stage === 'ESO' ? 'Matèria' : 'Àrea'} {step.subjectIndex + 1} de {step.subjectCount}
            </small>
            <h2>{subject.long}</h2>
          </div>
        </div>
        <div className="qlist">
          {q.criteria!.map((c) => {
            const k = keyOf(q.id, subject.id, c.id)
            const scale = scaleOf(ctx.scales, c.scaleId)!
            const v = ctx.answers[k]
            const missing = ctx.flagged?.has(k) && !v
            return ctx.stage === 'CM' ? (
              <div key={c.id} className="qlist">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <p className="step-title" style={{ fontSize: '1.3rem' }}>{c.prompt}</p>
                  <SpeakButton text={`${subject.long}. ${c.prompt} ${scale.options.map((o) => o.label).join(', ')}`} />
                </div>
                <BigScale name={k} scale={scale} value={v} label={`${subject.short}: ${c.prompt}`} onChange={(x) => ctx.set(k, x)} />
              </div>
            ) : (
              <fieldset key={c.id} className={`qrow crit${v ? ' done' : ''}${missing ? ' missing' : ''}`}>
                <legend className="sr-only">{`${subject.short}: ${c.prompt}`}</legend>
                <div className="qtext" aria-hidden="true">
                  <span className="qnum">{v ? '✓' : '·'}</span>
                  {c.prompt}
                </div>
                <SegScale name={k} scale={scale} value={v} label={`${subject.short}: ${c.prompt}`} onChange={(x) => ctx.set(k, x)} />
              </fieldset>
            )
          })}
          {q.subjectComment && (
            <TextAnswer
              q={{ id: `${q.id}|${subject.id}|obs`, type: 'shortText', text: q.subjectComment.prompt, required: q.subjectComment.required, maxLength: q.subjectComment.maxLength, active: true, help: 'Pots escriure-hi una idea concreta. No cal que sigui llarg.' }}
              ctx={ctx}
            />
          )}
        </div>
      </>
    )
  }
  return null
}

function GoalReview({ q, ctx, section, inline }: { q: Question; ctx: Ctx; section: { title: string; emoji?: string; intro?: string }; inline?: boolean }) {
  const scale = scaleOf(ctx.scales, q.scaleId)!
  const k = keyOf(q.id)
  return (
    <div className="qlist">
      {!inline && (
        <div className="step-kicker">
          <span className="em" aria-hidden="true">{section.emoji}</span>
          {section.title}
        </div>
      )}
      {section.intro && !inline && <p className="step-intro">{section.intro}</p>}
      <div className="goal-quote">«{ctx.previousGoal}»</div>
      <p className="step-title" style={{ fontSize: '1.2rem' }}>{q.text}</p>
      <BigScale name={k} scale={scale} value={ctx.answers[k]} label={q.text} onChange={(v) => ctx.set(k, v)} />
    </div>
  )
}
