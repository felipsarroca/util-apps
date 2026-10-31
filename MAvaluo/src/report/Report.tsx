// Informe A4 de l'autoavaluació. Es pagina per blocs mesurats (cap bloc no es talla ni es retalla)
// i s'imprimeix amb el diàleg del navegador («Desa com a PDF»), que conserva tot l'Unicode.

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { gradeById, SCHOOL } from '../domain/catalog'
import { keyOf, NA, scaleLabel, subjectsForStudent } from '../domain/engine'
import type { Campaign, Scale, Section, Student, StudentResponse, Subject, TemplateVersion } from '../domain/types'
import type { DemoState } from '../data/seed'
import { asset, fmtDate } from '../ui/common'

export interface ReportModel {
  student: Student
  campaign: Campaign
  template: TemplateVersion
  subjects: Subject[]
  response?: StudentResponse
  scales: Scale[]
  previousGoal?: string
}

export function buildReportModel(s: DemoState, studentId: string, campaignId: string): ReportModel | null {
  const student = s.students.find((x) => x.id === studentId)
  const campaign = s.campaigns.find((c) => c.id === campaignId)
  const template = campaign && s.templates.find((t) => t.id === campaign.templateVersionId)
  if (!student || !campaign || !template) return null
  const response = s.responses.find((r) => r.studentId === studentId && r.campaignId === campaignId)
  const sources = template.sections.flatMap((x) => x.questions).filter((q) => q.type === 'goalReview').map((q) => q.sourceQuestionId!)
  const prev = s.responses
    .filter((r) => r.studentId === studentId && r.campaignId !== campaignId && r.submittedAt && (!response?.submittedAt || r.submittedAt < response.submittedAt))
    .sort((a, b) => (b.submittedAt! > a.submittedAt! ? 1 : -1))
    .find((r) => sources.some((k) => r.answers[k]))
  return {
    student, campaign, template, response, scales: s.scales,
    subjects: subjectsForStudent(campaign.subjectsSnapshot, student, s.subjects),
    previousGoal: prev && sources.map((k) => prev.answers[k]).find(Boolean),
  }
}

interface Block {
  id: string
  node: ReactNode
  keepWithNext?: boolean
}

const Empty = () => <span className="rp-empty">Sense resposta</span>

function OptionRow({ scale, value }: { scale: Scale; value?: string }) {
  return (
    <>
      {scale.options.map((o) => (
        <span key={o.value} className={`rp-o${value === o.value ? ' sel' : ''}`}>{o.short ?? o.label}</span>
      ))}
      {scale.allowNA && <span className={`rp-o${value === NA ? ' sel' : ''}`}>No escau</span>}
    </>
  )
}

function sectionBlocks(sec: Section, m: ReportModel): Block[] {
  const a = m.response?.answers ?? {}
  const blocks: Block[] = []
  const title = (
    <div className="rp-sec-title">
      <span aria-hidden="true">{sec.emoji}</span>
      {sec.title}
    </div>
  )
  const qs = sec.questions.filter((q) => q.active || a[keyOf(q.id)])
  const scaleQs = qs.filter((q) => q.type === 'scale')
  let titled = false
  const withTitle = (node: ReactNode): ReactNode => {
    if (titled) return node
    titled = true
    return (
      <div style={{ display: 'grid', gap: '2.4mm' }}>
        {title}
        {node}
      </div>
    )
  }
  if (scaleQs.length) {
    blocks.push({
      id: `${sec.id}-scale`,
      node: withTitle(
        <table className="rp-habits">
          <tbody>
            {scaleQs.map((q) => {
              const scale = m.scales.find((x) => x.id === q.scaleId)
              return (
                <tr key={q.id}>
                  <td>{q.pdfLabel ?? q.text}</td>
                  <td className="opts">{scale ? <OptionRow scale={scale} value={a[keyOf(q.id)]} /> : null}</td>
                </tr>
              )
            })}
          </tbody>
        </table>,
      ),
    })
  }
  for (const q of qs) {
    if (q.type === 'goalReview') {
      if (!m.previousGoal) continue
      const scale = m.scales.find((x) => x.id === q.scaleId)
      blocks.push({
        id: q.id,
        node: withTitle(
          <div className="rp-text">
            <div className="lbl">Objectiu de l’avaluació anterior</div>
            <div className="val">«{m.previousGoal}»</div>
            <div className="lbl" style={{ marginTop: '2mm' }}>{q.pdfLabel ?? q.text}</div>
            <div className="val">{scaleLabel(scale, a[keyOf(q.id)]) || <Empty />}</div>
          </div>,
        ),
      })
    }
    if (q.type === 'shortText' || q.type === 'longText') {
      const v = a[keyOf(q.id)]
      blocks.push({
        id: q.id,
        node: withTitle(
          <div className="rp-text">
            <div className="lbl">{q.pdfLabel ?? q.text}</div>
            <div className="val">{v?.trim() ? v : <Empty />}</div>
          </div>,
        ),
      })
    }
    if (q.type === 'subjects') {
      // Les targetes van de dues en dues; una observació llarga ocupa tota l'amplada.
      const cards = m.subjects.map((subj) => {
        const obs = q.subjectComment ? a[keyOf(q.id, subj.id, 'obs')] : undefined
        return {
          wide: (obs?.length ?? 0) > 150,
          node: (
            <div key={subj.id} className={`rp-subj${(obs?.length ?? 0) > 150 ? ' wide' : ''}`} style={{ ['--h' as string]: `hsl(${subj.hue} 50% 40%)` }}>
              <h3>{subj.long}</h3>
              {q.criteria!.map((c) => {
                const scale = m.scales.find((x) => x.id === c.scaleId)
                const v = a[keyOf(q.id, subj.id, c.id)]
                return (
                  <div className="rp-crit" key={c.id}>
                    <span>{c.label}</span>
                    <b>{v ? `${scaleLabel(scale, v)}${scale?.options.find((o) => o.value === v)?.short && scale.id === 'result4' ? ` (${scaleLabel(scale, v, true)})` : ''}` : <Empty />}</b>
                  </div>
                )
              })}
              {q.subjectComment && obs?.trim() && (
                <div className="rp-obs">
                  <i>{q.subjectComment.prompt}</i>
                  {obs}
                </div>
              )}
            </div>
          ),
        }
      })
      const rows: ReactNode[][] = []
      let cur: ReactNode[] = []
      for (const c of cards) {
        if (c.wide) {
          if (cur.length) rows.push(cur)
          rows.push([c.node])
          cur = []
        } else {
          cur.push(c.node)
          if (cur.length === 2) {
            rows.push(cur)
            cur = []
          }
        }
      }
      if (cur.length) rows.push(cur)
      const legend = q.criteria!.some((c) => c.scaleId === 'result4') ? (
        <div className="rp-scale-legend">
          <span>Resultat que preveu l’alumne:</span>
          {m.scales.find((x) => x.id === 'result4')!.options.map((o) => (
            <span key={o.value}>
              <b>{o.short}</b> {o.label}
            </span>
          ))}
        </div>
      ) : null
      rows.forEach((r, i) =>
        blocks.push({
          id: `${q.id}-row${i}`,
          node: i === 0 ? withTitle(<>{legend}<div className="rp-subjects">{r}</div></>) : <div className="rp-subjects">{r}</div>,
        }),
      )
    }
  }
  return blocks
}

function useBlocks(m: ReportModel, acknowledgement: boolean): Block[] {
  return useMemo(() => {
    const grade = gradeById(m.student.gradeId)
    const blocks: Block[] = [
      {
        id: 'head',
        node: (
          <div className="rp-head">
            <img src={asset('logo-escola-ramon-pont.png')} alt="" />
            <div>
              <div className="school">{SCHOOL.name}</div>
              <h1>La veu de l’alumnat · Autoavaluació</h1>
            </div>
            <div className="meta">
              <b>
                {m.student.name} {m.student.surname}
              </b>
              {grade.name} · Grup {m.student.group}
              <br />
              {m.campaign.label} · {m.campaign.year}
            </div>
          </div>
        ),
      },
      {
        id: 'note',
        node: (
          <p className="rp-note">
            Aquest informe recull la <b>valoració personal</b> que l’alumne o alumna ha fet del seu treball{m.response?.submittedAt ? ` el ${fmtDate(m.response.submittedAt)}` : ''}. No és una qualificació oficial: és una eina per conversar i acompanyar-lo en el seu aprenentatge.
          </p>
        ),
      },
    ]
    if (!m.response?.submittedAt) {
      blocks.push({ id: 'draft', node: <p className="rp-note" style={{ background: '#fff1d6' }}>Autoavaluació no lliurada: es mostren les respostes desades fins ara.</p> })
    }
    for (const sec of m.template.sections) blocks.push(...sectionBlocks(sec, m))
    if (acknowledgement)
      blocks.push({
        id: 'ack',
        node: (
          <div className="rp-ack">
            <div className="scissors">✂ Retalleu i retorneu aquesta part al tutor o tutora</div>
            <div>
              <b>Acusament de lectura</b> · {m.student.name} {m.student.surname} · {grade.name} {m.student.group} · {m.campaign.label}
            </div>
            <div className="lines">
              <div className="ln">Nom i cognoms del pare, mare o tutor/a legal</div>
              <div className="ln">DNI/NIE</div>
              <div className="ln">Signatura</div>
              <div className="ln">Data</div>
            </div>
          </div>
        ),
      })
    return blocks
  }, [m, acknowledgement])
}

const PAGE_MM = 297 - 14 - 16 // alçada útil
const GAP_MM = 4.2
const CONT_MM = 9 // capçalera de continuació

function usePagination(blocks: Block[]): { pages: number[][]; measureRef: React.RefObject<HTMLDivElement | null> } {
  const measureRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<number[][]>([blocks.map((_, i) => i)])
  useLayoutEffect(() => {
    const el = measureRef.current
    if (!el) return
    const ruler = el.querySelector<HTMLElement>('[data-ruler]')!
    const pxPerMm = ruler.offsetHeight / 100
    const heights = [...el.querySelectorAll<HTMLElement>('[data-block]')].map((b) => b.offsetHeight / pxPerMm)
    const out: number[][] = []
    let cur: number[] = []
    let used = 0
    heights.forEach((h, i) => {
      const cap = out.length === 0 ? PAGE_MM : PAGE_MM - CONT_MM
      const need = (cur.length ? GAP_MM : 0) + h
      if (cur.length && used + need > cap) {
        out.push(cur)
        cur = []
        used = 0
      }
      used += (cur.length ? GAP_MM : 0) + h
      cur.push(i)
    })
    if (cur.length) out.push(cur)
    // Evita deixar un títol d'apartat sol al final d'una pàgina.
    for (let p = 0; p < out.length - 1; p++) {
      const last = out[p][out[p].length - 1]
      if (blocks[last]?.keepWithNext && out[p].length > 1) out[p + 1].unshift(out[p].pop()!)
    }
    // Els tipus de lletra poden arribar després: es torna a mesurar quan estan carregats.
    setPages((prev) => (JSON.stringify(prev) === JSON.stringify(out) ? prev : out))
  }, [blocks])
  const [, force] = useState(0)
  useLayoutEffect(() => {
    let alive = true
    document.fonts?.ready.then(() => alive && force((x) => x + 1))
    return () => {
      alive = false
    }
  }, [])
  return { pages, measureRef }
}

export function ReportPages({ model, duplex = false, acknowledgement = true }: { model: ReportModel; duplex?: boolean; acknowledgement?: boolean }) {
  const blocks = useBlocks(model, acknowledgement)
  const { pages, measureRef } = usePagination(blocks)
  const grade = gradeById(model.student.gradeId)
  const ref = `${model.campaign.id}·${model.student.id}·r${model.response?.revision ?? 0}·${model.template.id}`
  const name = `${model.student.name} ${model.student.surname}`
  const all = duplex && pages.length % 2 === 1 ? [...pages, null] : pages
  return (
    <>
      <div className="measure" ref={measureRef} aria-hidden="true">
        <div data-ruler style={{ height: '100mm', position: 'absolute', width: 1 }} />
        <div className="page-body" style={{ fontFamily: "'Nunito', 'Segoe UI', Arial, sans-serif", fontSize: '10pt', lineHeight: 1.38 }}>
          {blocks.map((b) => (
            <div key={b.id} data-block>
              {b.node}
            </div>
          ))}
        </div>
      </div>
      {all.map((p, pi) =>
        p === null ? (
          <div key="blank" className="page blank" />
        ) : (
          <div key={pi} className="page">
            <div className="page-body">
              {pi > 0 && (
                <div className="rp-cont">
                  <span>
                    <b>{name}</b> · {grade.name} {model.student.group}
                  </span>
                  <span>{model.campaign.label} · continuació</span>
                </div>
              )}
              {p.map((bi) => (
                <div key={blocks[bi].id}>{blocks[bi].node}</div>
              ))}
            </div>
            <div className="page-foot">
              <span>
                {name} · {model.campaign.label} {model.campaign.year}
              </span>
              <span>Ref. {ref}</span>
              <span>
                Pàgina {pi + 1} de {pages.length}
              </span>
            </div>
          </div>
        ),
      )}
    </>
  )
}

/** Escala les pàgines A4 a l'amplada disponible a la pantalla (en imprimir, mida real). */
export function SheetViewer({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [h, setH] = useState<number | undefined>()
  useLayoutEffect(() => {
    const o = outer.current!, i = inner.current!
    const update = () => {
      const pageW = (i.firstElementChild as HTMLElement | null)?.offsetWidth || 794
      const sc = Math.min(1, (o.clientWidth - 4) / pageW)
      setScale(sc)
      setH(i.offsetHeight * sc)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(o)
    ro.observe(i)
    return () => ro.disconnect()
  }, [])
  return (
    <div className="sheet-scaler" ref={outer} style={{ height: h }}>
      <div ref={inner} className="sheet-stack" style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: scale < 1 ? `${100 / scale}%` : undefined, marginLeft: scale < 1 ? `${-(100 / scale - 100) / 2}%` : undefined }}>
        {children}
      </div>
    </div>
  )
}
