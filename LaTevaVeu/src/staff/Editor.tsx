import { useMemo, useState } from 'react'
import { adoptTemplateInScheduled, discardDraft, newDraftFrom, publishTemplate, saveTemplateDraft, useDemoState } from '../data/api'
import { GRADES, STAGES } from '../domain/catalog'
import { buildSteps, keyOf, subjectsForStudent, validateTemplate, type Step } from '../domain/engine'
import type { DemoState } from '../data/seed'
import type { Answers, Campaign, Question, QuestionType, Scale, Section, Session, StageId, Student, TemplateVersion } from '../domain/types'
import { ReportPages, SheetViewer, type ReportModel } from '../report/Report'
import { StepBody } from '../student/Questions'
import { fmtDate, Icon, Modal, useToast } from '../ui/common'
import { PageHead } from './StaffApp'

const TYPE_LABEL: Record<QuestionType, string> = {
  scale: 'Afirmació amb escala',
  shortText: 'Resposta curta',
  longText: 'Resposta llarga',
  subjects: 'Valoració per matèria',
  goalReview: 'Objectiu anterior',
  info: 'Text informatiu',
}

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 7)}`

function move<T>(xs: T[], i: number, d: number): T[] {
  const j = i + d
  if (j < 0 || j >= xs.length) return xs
  const out = [...xs]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

export function EditorScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const [stage, setStage] = useState<StageId>('ESO')
  const versions = s.templates.filter((t) => t.stage === stage).sort((a, b) => b.version - a.version)
  const draft = versions.find((v) => v.status === 'draft')
  const latest = versions.find((v) => v.status === 'published')
  const [viewId, setViewId] = useState<string | null>(null)
  const current = versions.find((v) => v.id === viewId) ?? draft ?? latest
  const [previewSec, setPreviewSec] = useState(0)
  const [publishing, setPublishing] = useState(false)
  const [reportTest, setReportTest] = useState<'short' | 'long' | null>(null)
  const [toast, showToast] = useToast()
  const editable = current?.status === 'draft'
  const issues = current ? validateTemplate(current, s.scales) : []
  const usedBy = (id: string) => s.campaigns.filter((c) => c.templateVersionId === id)

  const update = (fn: (t: TemplateVersion) => TemplateVersion) => {
    if (!current || !editable) return
    try {
      saveTemplateDraft(session, fn(structuredClone(current)))
    } catch (e) {
      showToast((e as Error).message)
    }
  }
  const updSection = (si: number, fn: (sec: Section) => Section) => update((t) => ({ ...t, sections: t.sections.map((x, i) => (i === si ? fn(x) : x)) }))
  const updQuestion = (si: number, qi: number, patch: Partial<Question>) => updSection(si, (sec) => ({ ...sec, questions: sec.questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)) }))

  return (
    <>
      <PageHead title="Qüestionaris" sub="Una versió publicada no canvia mai. Per modificar-la, crea’n una versió nova: les recollides ja obertes conserven la seva.">
        <div className="tabs" role="tablist">
          {(Object.keys(STAGES) as StageId[]).map((st) => (
            <button key={st} role="tab" aria-selected={stage === st} className={`tab${stage === st ? ' cur' : ''}`} onClick={() => { setStage(st); setViewId(null); setPreviewSec(0) }}>
              {STAGES[st].short}
            </button>
          ))}
        </div>
      </PageHead>

      <div className="toolbar">
        <label className="field">
          <span>Versió</span>
          <select className="select" value={current?.id} onChange={(e) => setViewId(e.target.value)}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version} · {v.status === 'draft' ? 'esborrany' : `publicada ${v.publishedAt ? fmtDate(v.publishedAt) : ''}`} {usedBy(v.id).length ? `· ${usedBy(v.id).length} recollides` : ''}
              </option>
            ))}
          </select>
        </label>
        <span className="spacer" />
        {!draft && latest && (
          <button className="btn primary" onClick={() => { const d = newDraftFrom(session, latest.id); setViewId(d.id) }}>
            <Icon name="copy" /> Crea la versió {latest.version + 1}
          </button>
        )}
        {draft && !editable && <button className="btn" onClick={() => setViewId(draft.id)}>Ves a l’esborrany v{draft.version}</button>}
        {editable && (
          <>
            <button className="btn danger" onClick={() => { discardDraft(session, current!.id); setViewId(null) }}><Icon name="trash" /> Descarta l’esborrany</button>
            <button className="btn primary" disabled={issues.length > 0} onClick={() => setPublishing(true)}><Icon name="check" /> Publica la v{current!.version}</button>
          </>
        )}
      </div>

      {current && (
        <>
          {!editable && (
            <div className="notice">
              <Icon name="info" />
              <div>
                Estàs veient la <b>v{current.version}</b>, publicada{current.changeNote ? `: «${current.changeNote}»` : ''}. És només de lectura.
                {usedBy(current.id).length > 0 && ` La fan servir ${usedBy(current.id).map((c) => `${GRADES.find((g) => g.id === c.gradeId)!.name} (${c.label})`).join(', ')}.`}
              </div>
            </div>
          )}
          {editable && issues.length > 0 && (
            <div className="notice warn">
              <Icon name="alert" />
              <div><b>Cal resoldre abans de publicar:</b><ul style={{ margin: '.3rem 0 0', paddingLeft: '1.2rem' }}>{issues.map((x) => <li key={x}>{x}</li>)}</ul></div>
            </div>
          )}

          <div className="editor">
            <div style={{ display: 'grid', gap: '1rem' }}>
              {current.sections.map((sec, si) => (
                <section key={sec.id} className="card ed-section" onFocus={() => setPreviewSec(si)} onClick={() => setPreviewSec(si)}>
                  <div className="ed-section-head">
                    <input className="input" style={{ width: 64, textAlign: 'center', fontSize: '1.2rem' }} value={sec.emoji ?? ''} disabled={!editable} onChange={(e) => updSection(si, (x) => ({ ...x, emoji: e.target.value }))} aria-label="Emoji de l’apartat" maxLength={4} />
                    <input className="input" style={{ fontWeight: 800, fontSize: '1.05rem' }} value={sec.title} disabled={!editable} onChange={(e) => updSection(si, (x) => ({ ...x, title: e.target.value }))} aria-label="Títol de l’apartat" />
                    {editable && (
                      <>
                        <button className="btn icon small" onClick={() => update((t) => ({ ...t, sections: move(t.sections, si, -1) }))} aria-label="Puja l’apartat"><Icon name="up" /></button>
                        <button className="btn icon small" onClick={() => update((t) => ({ ...t, sections: move(t.sections, si, 1) }))} aria-label="Baixa l’apartat"><Icon name="down" /></button>
                        <button className="btn icon small danger" onClick={() => update((t) => ({ ...t, sections: t.sections.filter((_, i) => i !== si) }))} aria-label="Elimina l’apartat"><Icon name="trash" /></button>
                      </>
                    )}
                  </div>
                  <textarea className="textarea" rows={2} placeholder="Instrucció per a l’alumne (opcional)" value={sec.intro ?? ''} disabled={!editable} onChange={(e) => updSection(si, (x) => ({ ...x, intro: e.target.value }))} aria-label="Instrucció de l’apartat" />
                  {sec.questions.map((q, qi) => (
                    <QuestionEditor
                      key={q.id}
                      q={q}
                      editable={editable}
                      scales={s.scales}
                      onChange={(p) => updQuestion(si, qi, p)}
                      onMove={(d) => updSection(si, (x) => ({ ...x, questions: move(x.questions, qi, d) }))}
                      onDuplicate={() => updSection(si, (x) => ({ ...x, questions: [...x.questions.slice(0, qi + 1), { ...structuredClone(q), id: uid(q.id.split('-')[0]) }, ...x.questions.slice(qi + 1)] }))}
                      onDelete={() => updSection(si, (x) => ({ ...x, questions: x.questions.filter((_, i) => i !== qi) }))}
                    />
                  ))}
                  {editable && (
                    <div className="row">
                      <button className="btn small" onClick={() => updSection(si, (x) => ({ ...x, questions: [...x.questions, { id: uid(stage.toLowerCase()), type: 'scale', text: 'Nova afirmació', scaleId: stage === 'CM' ? 'cm3' : stage === 'CS' ? 'freq4' : 'freq4na', required: true, active: true }] }))}><Icon name="plus" /> Afirmació</button>
                      <button className="btn small" onClick={() => updSection(si, (x) => ({ ...x, questions: [...x.questions, { id: uid(stage.toLowerCase()), type: 'shortText', text: 'Nova pregunta', required: false, maxLength: 200, active: true }] }))}><Icon name="plus" /> Resposta curta</button>
                      <button className="btn small" onClick={() => updSection(si, (x) => ({ ...x, questions: [...x.questions, { id: uid(stage.toLowerCase()), type: 'longText', text: 'Nova pregunta', required: false, maxLength: 400, active: true }] }))}><Icon name="plus" /> Resposta llarga</button>
                    </div>
                  )}
                </section>
              ))}
              {editable && (
                <button className="btn" onClick={() => update((t) => ({ ...t, sections: [...t.sections, { id: uid('sec'), title: 'Nou apartat', emoji: '⭐', questions: [{ id: uid(stage.toLowerCase()), type: 'scale', text: 'Nova afirmació', scaleId: stage === 'CM' ? 'cm3' : 'freq4', required: true, active: true }] }] }))}>
                  <Icon name="plus" /> Afegeix un apartat
                </button>
              )}
            </div>

            <aside className="preview-frame" aria-label="Previsualització">
              <div className="row">
                <b>Com ho veurà l’alumne</b>
                <span className="spacer" />
                <select className="select" style={{ width: 'auto', minHeight: 34 }} value={previewSec} onChange={(e) => setPreviewSec(+e.target.value)} aria-label="Apartat a previsualitzar">
                  {current.sections.map((x, i) => <option key={x.id} value={i}>{x.title}</option>)}
                </select>
              </div>
              <StudentPreview template={current} sectionIndex={previewSec} />
              <div className="row">
                <b>Prova de l’informe</b>
                <span className="spacer" />
                <button className="btn small" onClick={() => setReportTest('short')}>Respostes curtes</button>
                <button className="btn small" onClick={() => setReportTest('long')}>Respostes llargues</button>
              </div>
            </aside>
          </div>
        </>
      )}

      {publishing && current && (
        <PublishDialog
          t={current}
          onClose={() => setPublishing(false)}
          onOk={(note) => {
            publishTemplate(session, current.id, note)
            const n = adoptTemplateInScheduled(session, current.id)
            setPublishing(false)
            showToast(`v${current.version} publicada${n ? ` i assignada a ${n} recollides programades` : ''}.`)
          }}
        />
      )}
      {reportTest && current && (
        <Modal title={`Prova de l’informe · respostes ${reportTest === 'long' ? 'llargues' : 'curtes'}`} onClose={() => setReportTest(null)} wide>
          <p className="muted">Dades fictícies generades per comprovar la paginació: cap bloc no s’ha de tallar ni retallar.</p>
          <SheetViewer><ReportPages model={fakeReport(current, s, reportTest === 'long')} /></SheetViewer>
        </Modal>
      )}
      {toast}
    </>
  )
}

function QuestionEditor({ q, editable, scales, onChange, onMove, onDuplicate, onDelete }: { q: Question; editable: boolean; scales: Scale[]; onChange: (p: Partial<Question>) => void; onMove: (d: number) => void; onDuplicate: () => void; onDelete: () => void }) {
  return (
    <div className={`ed-q${q.active ? '' : ' off'}`}>
      <div className="ed-q-top">
        <span className="ed-type">{TYPE_LABEL[q.type]}</span>
        <span className="muted" style={{ fontSize: '.75rem' }}>id {q.id}</span>
        <span className="spacer" />
        <label className="toggle" style={{ fontSize: '.85rem' }}><input type="checkbox" checked={q.required} disabled={!editable} onChange={(e) => onChange({ required: e.target.checked })} />Obligatòria</label>
        <label className="toggle" style={{ fontSize: '.85rem' }}><input type="checkbox" checked={q.active} disabled={!editable} onChange={(e) => onChange({ active: e.target.checked })} />Activa</label>
        {editable && (
          <>
            <button className="btn icon small ghost" onClick={() => onMove(-1)} aria-label="Puja la pregunta"><Icon name="up" /></button>
            <button className="btn icon small ghost" onClick={() => onMove(1)} aria-label="Baixa la pregunta"><Icon name="down" /></button>
            <button className="btn icon small ghost" onClick={onDuplicate} aria-label="Duplica la pregunta"><Icon name="copy" /></button>
            <button className="btn icon small ghost danger" onClick={onDelete} aria-label="Elimina la pregunta"><Icon name="trash" /></button>
          </>
        )}
      </div>
      <input className="input" value={q.text} disabled={!editable} onChange={(e) => onChange({ text: e.target.value })} aria-label="Text de la pregunta" />
      {(q.type === 'shortText' || q.type === 'longText' || q.type === 'scale') && (
        <div className="grid3">
          <input className="input" placeholder="Ajuda (opcional)" value={q.help ?? ''} disabled={!editable} onChange={(e) => onChange({ help: e.target.value || undefined })} aria-label="Text d’ajuda" />
          {q.type === 'scale' ? (
            <select className="select" value={q.scaleId} disabled={!editable} onChange={(e) => onChange({ scaleId: e.target.value })} aria-label="Escala">
              {scales.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}: {sc.options.map((o) => o.label).join(' / ')}{sc.allowNA ? ' / No escau' : ''}</option>)}
            </select>
          ) : (
            <label className="row" style={{ gap: '.4rem' }}>
              <span className="muted" style={{ fontSize: '.85rem', whiteSpace: 'nowrap' }}>Màx. caràcters</span>
              <input className="input" type="number" min={20} max={2000} value={q.maxLength ?? 200} disabled={!editable} onChange={(e) => onChange({ maxLength: +e.target.value })} />
            </label>
          )}
          <input className="input" placeholder="Etiqueta al PDF (opcional)" value={q.pdfLabel ?? ''} disabled={!editable} onChange={(e) => onChange({ pdfLabel: e.target.value || undefined })} aria-label="Etiqueta al PDF" />
        </div>
      )}
      {q.type === 'subjects' && (
        <div style={{ display: 'grid', gap: '.4rem' }}>
          {q.criteria!.map((c, ci) => (
            <div className="grid3" key={c.id}>
              <input className="input" value={c.label} disabled={!editable} onChange={(e) => onChange({ criteria: q.criteria!.map((x, i) => (i === ci ? { ...x, label: e.target.value } : x)) })} aria-label="Nom del criteri" />
              <input className="input" value={c.prompt} disabled={!editable} onChange={(e) => onChange({ criteria: q.criteria!.map((x, i) => (i === ci ? { ...x, prompt: e.target.value } : x)) })} aria-label="Pregunta a l’alumne" />
              <select className="select" value={c.scaleId} disabled={!editable} onChange={(e) => onChange({ criteria: q.criteria!.map((x, i) => (i === ci ? { ...x, scaleId: e.target.value } : x)) })} aria-label="Escala del criteri">
                {scales.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
              </select>
            </div>
          ))}
          <label className="toggle" style={{ fontSize: '.88rem' }}>
            <input type="checkbox" checked={!!q.subjectComment} disabled={!editable} onChange={(e) => onChange({ subjectComment: e.target.checked ? { prompt: 'Què puc fer o què em cal?', required: false, maxLength: 300 } : undefined })} />
            Camp d’observació per matèria{q.subjectComment ? ` («${q.subjectComment.prompt}», ${q.subjectComment.required ? 'obligatori' : 'opcional'}, ${q.subjectComment.maxLength} caràcters)` : ''}
          </label>
          {q.subjectComment && (
            <label className="toggle" style={{ fontSize: '.88rem' }}>
              <input type="checkbox" checked={q.subjectComment.required} disabled={!editable} onChange={(e) => onChange({ subjectComment: { ...q.subjectComment!, required: e.target.checked } })} />
              Observació obligatòria a cada matèria
            </label>
          )}
        </div>
      )}
    </div>
  )
}

const demoStudent = (stage: StageId): Student => ({
  id: 'MOSTRA', name: 'Alumne', surname: 'de mostra', email: 'mostra@ramonpont.cat',
  gradeId: GRADES.find((g) => g.stage === stage)!.id, group: 'A', electives: [], guardians: [],
})

function StudentPreview({ template, sectionIndex }: { template: TemplateVersion; sectionIndex: number }) {
  const s = useDemoState()
  const [answers, setAnswers] = useState<Answers>({})
  const student = demoStudent(template.stage)
  const subjects = subjectsForStudent(s.gradeSubjects, student, s.subjects).slice(0, 3)
  const sec = template.sections[sectionIndex]
  const steps: Step[] = useMemo(
    () => (sec ? buildSteps({ ...template, sections: [sec] }, { stage: template.stage, subjects, previousGoal: 'Llegir mitja hora cada dia' }).filter((x) => x.kind !== 'review') : []),
    [template, sec, subjects],
  )
  if (!sec) return null
  return (
    <div className={`stage-${template.stage}`} style={{ display: 'grid', gap: '.8rem' }}>
      {steps.slice(0, 2).map((st, i) => (
        <section key={i} className="card step-card" style={{ padding: 18 }}>
          <StepBody step={st} ctx={{ stage: template.stage, scales: s.scales, answers, set: (k, v) => setAnswers((p) => ({ ...p, [k]: v })), previousGoal: 'Llegir mitja hora cada dia' }} />
        </section>
      ))}
      {steps.length > 2 && <p className="muted" style={{ fontSize: '.85rem' }}>… i {steps.length - 2} pantalles més d’aquest apartat.</p>}
    </div>
  )
}

/** Informe de prova amb totes les matèries del curs (optatives incloses) i respostes curtes o llargues. */
function fakeReport(t: TemplateVersion, all: DemoState, long: boolean): ReportModel {
  const s = demoStudent(t.stage)
  const scales = all.scales
  const subj = subjectsForStudent(all.gradeSubjects.map((g) => ({ ...g, optional: false })), s, all.subjects)
  const answers: Answers = {}
  const txt = long
    ? 'He après moltes coses noves aquest trimestre, però també he vist que necessito organitzar-me millor. Quan faig un esquema abans d’estudiar ho entenc tot millor i recordo més detalls. Em proposo dedicar-hi una estona cada dia, preguntar els dubtes a classe i revisar les correccions que em fa el professorat. També vull col·laborar més amb els companys i companyes d’equip, escoltar les seves idees i ajudar-los quan els costi alguna cosa. '
    : 'Fer un esquema abans d’estudiar.'
  for (const sec of t.sections)
    for (const q of sec.questions) {
      if (q.type === 'scale' || q.type === 'goalReview') answers[keyOf(q.id)] = String(1 + (q.id.length % (scales.find((x) => x.id === q.scaleId)?.options.length ?? 3)))
      if (q.type === 'shortText' || q.type === 'longText') answers[keyOf(q.id)] = txt.repeat(long ? 2 : 1).slice(0, q.maxLength ?? 400)
      if (q.type === 'subjects')
        subj.forEach((sb, i) => {
          q.criteria!.forEach((c) => (answers[keyOf(q.id, sb.id, c.id)] = String(1 + ((i + c.id.length) % (scales.find((x) => x.id === c.scaleId)?.options.length ?? 3)))))
          if (q.subjectComment) answers[keyOf(q.id, sb.id, 'obs')] = (long ? txt : 'Preguntar els dubtes.').slice(0, q.subjectComment.maxLength)
        })
    }
  const campaign: Campaign = { id: 'PROVA', year: all.year, gradeId: s.gradeId, label: 'Prova d’informe', templateVersionId: t.id, start: '2026-01-01', end: '2026-01-02', status: 'OBERTA', subjectsSnapshot: [] }
  return { student: { ...s, name: 'Alumne', surname: 'de Mostra Llarguíssim' }, campaign, template: t, subjects: subj, scales, previousGoal: 'Llegir mitja hora cada dia abans d’anar a dormir', response: { campaignId: 'PROVA', studentId: s.id, status: 'LLIURADA', answers, updatedAt: new Date().toISOString(), submittedAt: new Date().toISOString(), revision: 1 } }
}

function PublishDialog({ t, onClose, onOk }: { t: TemplateVersion; onClose: () => void; onOk: (note: string) => void }) {
  const [note, setNote] = useState('')
  const count = t.sections.reduce((n, x) => n + x.questions.filter((q) => q.active).length, 0)
  return (
    <Modal title={`Publica ${t.name} v${t.version}`} onClose={onClose}>
      <p>{t.sections.length} apartats · {count} preguntes actives. Un cop publicada, aquesta versió ja no es podrà modificar. Les recollides obertes o tancades continuaran amb la versió que tenien; les programades passaran a fer servir aquesta.</p>
      <label className="field"><span>Resum dels canvis (queda registrat)</span><textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="S’ha afegit una afirmació sobre l’ús del mòbil." /></label>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cancel·la</button>
        <button className="btn primary" disabled={!note.trim()} onClick={() => onOk(note.trim())}>Publica</button>
      </div>
    </Modal>
  )
}
