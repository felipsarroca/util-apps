// Informe A4 «Així et veiem»: retorn agregat i confidencial de l'alumnat a un docent.
// Mai no mostra respostes individuals ni cap resultat per sota del llindar de 15 respostes.

import { useMemo, type ReactNode } from 'react'
import { gradeShort, SCHOOL, STAGES } from '../domain/catalog'
import { nearestLabel, QUADRANTS, THRESHOLD, type Dist, type Quadrant, type StageReport, type TeacherReport } from '../domain/feedback'
import { CONTEXT_TAGS, type GradeId, type Scale } from '../domain/types'
import { asset } from '../ui/common'
import { PagedDoc, type Block } from './Report'

const pct = (x: number) => `${Math.round(x * 100)} %`

/** Barra apilada de la distribució. Tons de clar a fosc: es llegeix també en blanc i negre. */
export function DistBar({ dist, scale, wide }: { dist: Dist; scale: Scale; wide?: boolean }) {
  const n = scale.options.length
  return (
    <span className={`fb-bar${wide ? ' wide' : ''}`} role="img" aria-label={scale.options.map((o, i) => `${o.label}: ${dist.valid ? Math.round((dist.counts[i] / dist.valid) * 100) : 0} %`).join(', ')}>
      {dist.counts.map((c, i) => (
        <span key={i} className={`fb-seg s${n}-${i + 1}`} style={{ width: `${dist.valid ? (c / dist.valid) * 100 : 0}%` }}>
          {dist.valid && c / dist.valid >= 0.12 ? Math.round((c / dist.valid) * 100) : ''}
        </span>
      ))}
    </span>
  )
}

export function BarLegend({ scale }: { scale: Scale }) {
  const n = scale.options.length
  return (
    <span className="fb-legend">
      {scale.options.map((o, i) => (
        <span key={o.value}>
          <i className={`fb-seg s${n}-${i + 1}`} />
          {o.label}
        </span>
      ))}
    </span>
  )
}

const groupName = (key: string) => {
  const [g, grp] = key.split('-')
  return `${gradeShort(g as GradeId)} ${grp}`
}

function stageBlocks(r: StageReport, multi: boolean): Block[] {
  const blocks: Block[] = []
  const title = (
    <div className="rp-sec-title fb">
      {multi ? STAGES[r.stage].name : 'Resultats'}
      <span className="fb-part">
        {r.n} respostes de {r.eligible} alumnes{r.eligible ? ` (${pct(r.n / r.eligible)})` : ''}
      </span>
    </div>
  )
  if (r.suppressed) {
    blocks.push({
      id: `${r.stage}-sup`,
      node: (
        <div style={{ display: 'grid', gap: '2.4mm' }}>
          {title}
          <div className="fb-callout">
            <b>Mostra insuficient.</b> Hi ha {r.n} respostes, menys de les {THRESHOLD} necessàries per protegir la confidencialitat de l’alumnat. No es mostren resultats ni comentaris d’aquesta etapa.
            {r.self && ' La teva autoavaluació consta com a lliurada.'}
          </div>
        </div>
      ),
    })
    return blocks
  }

  // 1. Com ho veu l'alumnat
  blocks.push({
    id: `${r.stage}-dims`,
    node: (
      <div style={{ display: 'grid', gap: '2.4mm' }}>
        {title}
        <div className="fb-h">Com ho veu l’alumnat</div>
        <table className="fb-dims">
          <tbody>
            {r.dims.map((d) => (
              <tr key={d.dim.id}>
                <td className="nm">
                  <span aria-hidden="true">{d.dim.emoji}</span> {d.dim.name}
                </td>
                <td className="bar">
                  <DistBar dist={d.dist} scale={r.scale} wide />
                </td>
                <td className="fav">
                  <b>{pct(d.dist.fav)}</b>
                  <small>favorable</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="fb-note-row">
          <BarLegend scale={r.scale} />
          <span>«Favorable»: {r.scale.options.length === 4 ? 'Sovint o Sempre' : r.scale.options[r.scale.options.length - 1].label}</span>
        </div>
      </div>
    ),
  })

  // 2. Mirall: autoavaluació i alumnat
  blocks.push({
    id: `${r.stage}-mirror`,
    node: r.self ? (
      <div className="fb-mirror">
        <div className="fb-h">El mirall: la teva mirada i la de l’alumnat</div>
        <div className="fb-mirror-grid">
          <div className="fb-scale-axis">
            <span />
            <span className="ax">
              {r.scale.options.map((o) => (
                <i key={o.value}>{o.label}</i>
              ))}
            </span>
          </div>
          {r.dims.map((d) => (
            <div key={d.dim.id} className="fb-mrow">
              <span className="nm">{d.dim.name}</span>
              <span className="track">
                {d.self !== undefined && d.dist.valid > 0 && (
                  <span className="gap" style={{ left: `${Math.min(d.self, d.dist.mean) * 100}%`, width: `${Math.abs(d.self - d.dist.mean) * 100}%` }} />
                )}
                {d.dist.valid > 0 && <span className="dot st" style={{ left: `${d.dist.mean * 100}%` }} title="Alumnat" />}
                {d.self !== undefined && <span className="dot me" style={{ left: `${d.self * 100}%` }} title="Tu" />}
              </span>
            </div>
          ))}
          <div className="fb-note-row">
            <span><i className="dot st inline" /> Mitjana de l’alumnat</span>
            <span><i className="dot me inline" /> La teva autoavaluació</span>
          </div>
        </div>
        <div className="fb-quads">
          {(Object.keys(QUADRANTS) as Quadrant[]).map((q) => {
            const ds = r.dims.filter((d) => d.quadrant === q)
            return (
              <div key={q} className={`fb-quad q-${q}`}>
                <b>{QUADRANTS[q].title}</b>
                <small>{QUADRANTS[q].help}</small>
                <span>{ds.length ? ds.map((d) => d.dim.name).join(' · ') : '—'}</span>
              </div>
            )
          })}
        </div>
      </div>
    ) : (
      <div className="fb-callout soft">
        <b>Sense autoavaluació en aquesta recollida.</b> Quan la facis, l’informe hi afegirà el contrast entre la teva mirada i la de l’alumnat.
      </div>
    ),
  })

  // 3. Detall per afirmació (un bloc per dimensió, perquè la paginació no talli res)
  r.form.dimensions.forEach((dim, i) => {
    const rows = r.items.filter((x) => x.item.dimensionId === dim.id)
    blocks.push({
      id: `${r.stage}-items-${dim.id}`,
      node: (
        <div style={{ display: 'grid', gap: '1.6mm' }}>
          {i === 0 && <div className="fb-h">Detall per afirmació</div>}
          <table className="fb-items">
            <tbody>
              <tr className="dimrow">
                <td colSpan={3}>
                  <span aria-hidden="true">{dim.emoji}</span> {dim.name}
                </td>
              </tr>
              {rows.map(({ item, dist }) => (
                <tr key={item.id}>
                  <td>{item.student}</td>
                  <td className="bar"><DistBar dist={dist} scale={r.scale} /></td>
                  <td className="fav">{dist.valid ? pct(dist.fav) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    })
  })

  // 4. Per grup
  if (r.groups.length > 1) {
    blocks.push({
      id: `${r.stage}-groups`,
      node: (
        <div style={{ display: 'grid', gap: '1.8mm' }}>
          <div className="fb-h">Per grup <small>(% favorable; només grups amb {THRESHOLD} respostes o més)</small></div>
          <table className="fb-groups">
            <thead>
              <tr>
                <th>Grup</th>
                {r.form.dimensions.map((d) => (
                  <th key={d.id} title={d.name}>{d.name.split(' ')[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.groups.map((g) => (
                <tr key={g.key}>
                  <td>
                    <b>{groupName(g.key)}</b>
                    {g.context.length > 0 && <small className="ctx">{g.context.map((c) => CONTEXT_TAGS.find((t) => t.id === c)?.label).join(' · ')}</small>}
                  </td>
                  {g.shown ? r.form.dimensions.map((d) => <td key={d.id} className="num">{pct(g.fav[d.id])}</td>) : <td colSpan={r.form.dimensions.length} className="muted-cell">No es mostra: menys de {THRESHOLD} respostes</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    })
  }

  // 5. Evolució
  if (r.previous) {
    blocks.push({
      id: `${r.stage}-evo`,
      node: (
        <div style={{ display: 'grid', gap: '1.8mm' }}>
          <div className="fb-h">Evolució respecte de la {r.previous.label.charAt(0).toLowerCase() + r.previous.label.slice(1)}</div>
          <div className="fb-evo">
            {r.dims.map((d) => {
              const before = r.previous!.fav[d.dim.id]
              if (before === undefined) return null
              const diff = Math.round((d.dist.fav - before) * 100)
              return (
                <div key={d.dim.id}>
                  <span>{d.dim.name}</span>
                  <b>
                    {pct(before)} → {pct(d.dist.fav)}
                  </b>
                  <em className={diff >= 5 ? 'up' : diff <= -5 ? 'down' : ''}>{diff >= 5 ? `▲ +${diff}` : diff <= -5 ? `▼ ${diff}` : '= estable'}</em>
                </div>
              )
            })}
          </div>
        </div>
      ),
    })
  }

  // 6. Comentaris moderats
  r.comments.forEach((c, i) =>
    blocks.push({
      id: `${r.stage}-com-${i}`,
      node: (
        <div className="fb-comments">
          <div className="fb-h">{c.question}</div>
          {c.texts.length ? (
            <ul>
              {c.texts.slice(0, 14).map((t, k) => (
                <li key={k}>{t}</li>
              ))}
            </ul>
          ) : (
            <p className="rp-empty">Cap comentari publicat.</p>
          )}
          {c.texts.length > 14 && <small>I {c.texts.length - 14} comentaris més en la mateixa línia.</small>}
        </div>
      ),
    }),
  )
  return blocks
}

export function FeedbackReportPages({ report, duplex = false }: { report: TeacherReport; duplex?: boolean }) {
  const blocks = useMemo(() => {
    const r = report
    const groups = [...new Set(r.stages.flatMap((s) => s.groups.map((g) => groupName(g.key))))]
    const head: ReactNode = (
      <div className="rp-head fb-head">
        <img src={asset('logo-escola-ramon-pont.png')} alt="" />
        <div>
          <div className="school">{SCHOOL.name} · La teva veu · Et veig</div>
          <h1>Així et veiem</h1>
          <div className="rp-sub">La mirada conjunta de l’alumnat sobre les classes de {r.teacher.name}</div>
        </div>
        <div className="meta">
          <b>{r.teacher.name}</b>
          {r.campaign.label} · {r.campaign.year}
          <br />
          {groups.join(', ')}
        </div>
      </div>
    )
    const out: Block[] = [
      { id: 'head', node: head },
      {
        id: 'note',
        node: (
          <p className="rp-note">
            Aquest informe recull de manera <b>agregada i confidencial</b> com viu l’alumnat les teves classes. No inclou cap resposta individual i només mostra resultats quan hi ha {THRESHOLD} respostes o més. No és una nota ni una avaluació professional: és un retorn per reflexionar i millorar.
          </p>
        ),
      },
    ]
    for (const st of r.stages) out.push(...stageBlocks(st, r.stages.length > 1))
    out.push({
      id: 'close',
      node: (
        <div className="fb-close">
          <div className="fb-h">Per reflexionar</div>
          <p>Què et sorprèn d’aquest retorn? Quina fortalesa vols mantenir? Quina petita acció provaràs en les properes setmanes?</p>
          <div className="lines">
            <div className="ln" />
            <div className="ln" />
            <div className="ln" />
          </div>
          <small>Aquest espai és teu: les notes que hi escriguis no formen part de l’informe.</small>
        </div>
      ),
    })
    return out
  }, [report])
  return (
    <PagedDoc
      blocks={blocks}
      duplex={duplex}
      cont={[<><b>Així et veiem</b> · {report.teacher.name}</>, `${report.campaign.label} · continuació`]}
      foot={[`Així et veiem · ${report.teacher.name} · ${report.campaign.label} ${report.campaign.year}`, 'Document confidencial']}
    />
  )
}

export const selfLabel = (scale: Scale, v?: number) => (v === undefined ? '—' : nearestLabel(scale, v))
