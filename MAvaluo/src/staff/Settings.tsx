// Configuració general: apartats activables, assignacions docents i qüestionaris d'«Et veig».

import { useState } from 'react'
import { discardFeedbackDraft, newFeedbackDraft, publishFeedbackForm, saveFeedbackFormDraft, setAssignment, setModules, useDemoState } from '../data/api'
import { gradeShort, GRADES, STAGES } from '../domain/catalog'
import { subjectsForStudent } from '../domain/engine'
import { validateFeedbackForm } from '../domain/feedbackForms'
import type { FeedbackForm, Session, StageId } from '../domain/types'
import { SegScale } from '../student/Questions'
import { Icon, Modal, useToast } from '../ui/common'
import { PageHead } from './StaffApp'

// ---------- Apartats ----------

export function ModulesScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const openEm = s.campaigns.filter((c) => c.status === 'OBERTA').length
  const openEv = s.feedbackCampaigns.filter((c) => c.status === 'OBERTA')
  return (
    <>
      <PageHead title="Apartats" sub="Activa o desactiva temporalment cada apartat. Desactivar-lo l’amaga a l’alumnat sense esborrar cap dada." />
      <div className="mod-cards">
        <section className="card panel mod-card em">
          <div className="mod-kicker em">
            <span aria-hidden="true">💭</span> Em miro
          </div>
          <p>L’alumne s’autoavalua en cada avaluació. Genera l’informe individual «Així em veig».</p>
          <label className="toggle">
            <input type="checkbox" checked={s.modules.emMiro} onChange={(e) => setModules(session, { emMiro: e.target.checked })} />
            {s.modules.emMiro ? 'Actiu' : 'Desactivat'}
          </label>
          <small className="muted">{openEm} recollides obertes ara mateix.</small>
        </section>
        <section className="card panel mod-card ev">
          <div className="mod-kicker ev">
            <span aria-hidden="true">👀</span> Et veig
          </div>
          <p>L’alumne valora una vegada cada docent que li fa classe. Genera l’informe agregat «Així et veiem».</p>
          <label className="toggle">
            <input type="checkbox" checked={s.modules.etVeig} onChange={(e) => setModules(session, { etVeig: e.target.checked })} />
            {s.modules.etVeig ? 'Actiu' : 'Desactivat'}
          </label>
          <small className="muted">{openEv.length ? `Oberta: ${openEv.map((c) => c.label).join(', ')}.` : 'Cap recollida oberta ara mateix.'}</small>
        </section>
      </div>
    </>
  )
}

// ---------- Assignacions docents ----------

export function AssignmentsScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const [toast, showToast] = useToast()
  const teachers = s.staff.filter((x) => x.role === 'teacher').sort((a, b) => a.name.localeCompare(b.name, 'ca'))
  const groups = GRADES.flatMap((g) => [...new Set(s.students.filter((x) => x.gradeId === g.id).map((x) => x.group))].sort().map((group) => ({ grade: g, group })))
  const [sel, setSel] = useState(`${groups[0].grade.id}-${groups[0].group}`)
  const cur = groups.find((x) => `${x.grade.id}-${x.group}` === sel)!
  const subjects = s.gradeSubjects.filter((gs) => gs.gradeId === cur.grade.id && gs.active).sort((a, b) => a.order - b.order)
  const missing = groups.flatMap(({ grade, group }) =>
    s.gradeSubjects
      .filter((gs) => gs.gradeId === grade.id && gs.active && !s.assignments.some((a) => a.gradeId === grade.id && a.group === group && a.subjectId === gs.subjectId))
      .map((gs) => `${gradeShort(grade.id)} ${group} · ${s.subjects.find((x) => x.id === gs.subjectId)?.short}`),
  )
  const idle = teachers.filter((t) => !s.assignments.some((a) => a.teacherEmail === t.email))
  return (
    <>
      <PageHead title="Assignacions docents" sub="Qui fa cada matèria a cada grup. Defineix quins docents valora cada alumne a «Et veig»." />
      <div className="notice">
        <Icon name="info" />
        <div>Els canvis s’apliquen a les recollides que s’obrin a partir d’ara. Les recollides obertes conserven les assignacions de quan es van obrir.</div>
      </div>
      {(missing.length > 0 || idle.length > 0) && (
        <div className="notice warn">
          <Icon name="alert" />
          <div>
            {missing.length > 0 && <>Matèries sense docent: {missing.slice(0, 8).join(', ')}{missing.length > 8 ? ` i ${missing.length - 8} més` : ''}. </>}
            {idle.length > 0 && <>Docents sense cap grup: {idle.map((t) => t.name).join(', ')}.</>}
          </div>
        </div>
      )}
      <div className="tabs" role="tablist">
        {groups.map(({ grade, group }) => (
          <button key={`${grade.id}-${group}`} role="tab" aria-selected={sel === `${grade.id}-${group}`} className={`tab${sel === `${grade.id}-${group}` ? ' cur' : ''}`} onClick={() => setSel(`${grade.id}-${group}`)}>
            {gradeShort(grade.id)} {group}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Matèria</th>
              <th>Tipus</th>
              <th>Alumnes</th>
              <th>Docent</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((gs) => {
              const subj = s.subjects.find((x) => x.id === gs.subjectId)!
              const a = s.assignments.find((x) => x.gradeId === cur.grade.id && x.group === cur.group && x.subjectId === gs.subjectId)
              const studs = s.students.filter((x) => x.gradeId === cur.grade.id && x.group === cur.group && subjectsForStudent(s.gradeSubjects, x, s.subjects).some((y) => y.id === gs.subjectId)).length
              return (
                <tr key={gs.subjectId}>
                  <td><b>{subj.long}</b></td>
                  <td>{gs.optional ? <span className="badge info">Optativa</span> : <span className="badge plain">Comuna</span>}</td>
                  <td className="num">{studs}</td>
                  <td>
                    <select
                      className="select"
                      aria-label={`Docent de ${subj.short}`}
                      value={a?.teacherEmail ?? ''}
                      onChange={(e) => {
                        setAssignment(session, cur.grade.id, cur.group, gs.subjectId, e.target.value || null)
                        showToast('Assignació desada.')
                      }}
                      style={{ minWidth: 220 }}
                    >
                      <option value="">— Sense docent —</option>
                      {teachers.map((t) => (
                        <option key={t.email} value={t.email}>{t.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {toast}
    </>
  )
}

// ---------- Qüestionaris d'«Et veig» ----------

export function FeedbackFormsScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const [stage, setStage] = useState<StageId>('ESO')
  const [toast, showToast] = useToast()
  const versions = s.feedbackForms.filter((f) => f.stage === stage).sort((a, b) => b.version - a.version)
  const [vid, setVid] = useState<string | null>(null)
  const form = versions.find((f) => f.id === vid) ?? versions[0]
  const [publishing, setPublishing] = useState(false)
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState(form.dimensions[0]?.id)
  const draft = form.status === 'draft'
  const scale = s.scales.find((x) => x.id === form.scaleId)!
  const issues = validateFeedbackForm(form)
  const save = (f: FeedbackForm) => {
    try {
      saveFeedbackFormDraft(session, f)
    } catch (e) {
      showToast((e as Error).message)
    }
  }
  const setItem = (id: string, patch: Partial<FeedbackForm['items'][number]>) => save({ ...form, items: form.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
  const addItem = (dimensionId: string) => {
    let n = form.items.length + 1
    while (form.items.some((i) => i.id === `${dimensionId}${n}`)) n++
    save({ ...form, items: [...form.items, { id: `${dimensionId}${n}`, dimensionId, student: '', teacher: '' }] })
  }
  const pd = form.dimensions.find((d) => d.id === preview) ?? form.dimensions[0]
  return (
    <>
      <PageHead title="Preguntes d’Et veig" sub="Un qüestionari per etapa. Cada afirmació té una versió per a l’alumnat i una en primera persona per a l’autoavaluació del docent." />
      <div className="tabs" role="tablist">
        {(['CM', 'CS', 'ESO'] as StageId[]).map((st) => (
          <button key={st} role="tab" aria-selected={stage === st} className={`tab${stage === st ? ' cur' : ''}`} onClick={() => { setStage(st); setVid(null) }}>
            {STAGES[st].name}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <select className="select" value={form.id} onChange={(e) => setVid(e.target.value)} aria-label="Versió">
          {versions.map((v) => (
            <option key={v.id} value={v.id}>Versió {v.version} · {v.status === 'published' ? 'publicada' : 'esborrany'}</option>
          ))}
        </select>
        <span className={`badge ${draft ? 'warn' : 'ok'}`}>{draft ? 'Esborrany editable' : 'Publicada: no es pot modificar'}</span>
        <span className="muted" style={{ fontWeight: 700 }}>{form.items.length} afirmacions</span>
        <span className="spacer" />
        {!draft && (
          <button className="btn" onClick={() => setVid(newFeedbackDraft(session, form.id).id)}>
            <Icon name="copy" /> Crea una versió nova
          </button>
        )}
        {draft && (
          <>
            <button className="btn danger" onClick={() => { discardFeedbackDraft(session, form.id); setVid(null) }}>
              <Icon name="trash" /> Descarta
            </button>
            <button className="btn primary" disabled={issues.length > 0} onClick={() => setPublishing(true)}>
              Publica
            </button>
          </>
        )}
      </div>
      {draft && issues.length > 0 && (
        <div className="notice warn">
          <Icon name="alert" />
          <div>{issues.slice(0, 4).join(' ')}</div>
        </div>
      )}
      <div className="editor">
        <div className="cards-list">
          {form.dimensions.map((d) => (
            <section key={d.id} className="card ed-section">
              <div className="ed-section-head">
                <span aria-hidden="true" style={{ fontSize: '1.3rem' }}>{d.emoji}</span>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 900 }}>{d.name}</h2>
                <span className="spacer" />
                <button className="btn small ghost" onClick={() => setPreview(d.id)}><Icon name="eye" /> Previsualitza</button>
              </div>
              {form.items
                .filter((i) => i.dimensionId === d.id)
                .map((i) => (
                  <div key={i.id} className="ed-q">
                    <label className="field">
                      <span>Alumnat</span>
                      <input className="input" value={i.student} disabled={!draft} onChange={(e) => setItem(i.id, { student: e.target.value })} />
                    </label>
                    <label className="field">
                      <span>Autoavaluació del docent (primera persona)</span>
                      <input className="input" value={i.teacher} disabled={!draft} onChange={(e) => setItem(i.id, { teacher: e.target.value })} />
                    </label>
                    {draft && (
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn small danger" onClick={() => save({ ...form, items: form.items.filter((x) => x.id !== i.id) })}>
                          <Icon name="trash" /> Treu
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              {draft && (
                <button className="btn small" onClick={() => addItem(d.id)}>
                  <Icon name="plus" /> Afegeix una afirmació
                </button>
              )}
            </section>
          ))}
          <section className="card ed-section">
            <h2 style={{ fontSize: '1.05rem', fontWeight: 900 }}>Preguntes obertes (sempre opcionals i moderades)</h2>
            {form.open.map((o) => (
              <div key={o.id} className="ed-q">
                <input className="input" value={o.text} disabled={!draft} onChange={(e) => save({ ...form, open: form.open.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })} aria-label="Text de la pregunta" />
                <label className="field" style={{ maxWidth: 200 }}>
                  <span>Màxim de caràcters</span>
                  <input className="input" type="number" min={20} max={1000} value={o.maxLength} disabled={!draft} onChange={(e) => save({ ...form, open: form.open.map((x) => (x.id === o.id ? { ...x, maxLength: Number(e.target.value) } : x)) })} />
                </label>
              </div>
            ))}
          </section>
        </div>
        <aside className="preview-frame" aria-label="Previsualització">
          <b>Com ho veurà l’alumnat</b>
          {pd && (
            <section className={`card step-card stage-${stage}`}>
              <div className="step-kicker ev">
                <span className="em" aria-hidden="true">{pd.emoji}</span> {pd.name}
              </div>
              <div className="qlist">
                {form.items
                  .filter((i) => i.dimensionId === pd.id)
                  .map((i) => (
                    <fieldset key={i.id} className="qrow">
                      <legend className="sr-only">{i.student}</legend>
                      <div className="qtext" aria-hidden="true">{i.student || <i className="muted">(sense text)</i>}</div>
                      <SegScale name={`pv-${i.id}`} scale={scale} label={i.student} onChange={() => undefined} />
                    </fieldset>
                  ))}
              </div>
            </section>
          )}
        </aside>
      </div>
      {publishing && (
        <Modal title={`Publica la versió ${form.version}`} onClose={() => setPublishing(false)}>
          <p>Un cop publicada no es podrà modificar. Les recollides programades d’aquesta etapa la faran servir; les obertes conserven la seva versió.</p>
          <label className="field">
            <span>Resum dels canvis</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Afirmacions de suport reformulades" />
          </label>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setPublishing(false)}>Cancel·la</button>
            <button
              className="btn primary"
              onClick={() => {
                try {
                  publishFeedbackForm(session, form.id, note)
                  setPublishing(false)
                  showToast('Versió publicada.')
                } catch (e) {
                  showToast((e as Error).message)
                }
              }}
            >
              Publica
            </button>
          </div>
        </Modal>
      )}
      {toast}
    </>
  )
}
