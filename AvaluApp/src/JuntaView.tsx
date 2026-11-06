import { useMemo, useState } from 'react'
import {
  type Alert,
  type EvaluationData,
  type EvaluationId,
  type StudentInsight,
  EXCELLENCE_MEAN,
  RELEVANT_CHANGE,
  RISK_FAILS,
  classMean,
  evaluationLabel,
  formatGrade,
  formatNumber,
  formatSigned,
  gradeLevel,
  groupInsights,
  juntaSummaryText,
  subjectStats,
} from './data'
import { LevelLegend } from './charts'
import { shortSubject } from './junta'
import { emptyNotes, type NotesMap, type StudentNotes } from './settings'

type Filter = 'tots' | 'atencio' | 'milloren' | 'excel' | 'sense'
type Sort = 'llista' | 'nom' | 'mitjana' | 'suspensos' | 'variacio'

const filters: Array<{ id: Filter; label: string; test: (item: StudentInsight) => boolean }> = [
  { id: 'tots', label: 'Tot el grup', test: () => true },
  { id: 'atencio', label: 'Necessiten seguiment', test: (item) => item.needsAttention },
  {
    id: 'milloren',
    label: 'Milloren',
    test: (item) => (item.delta ?? 0) >= RELEVANT_CHANGE || item.recovered.length > 0,
  },
  {
    id: 'excel',
    label: 'Excel·lents',
    test: (item) => item.alerts.some((alert) => alert.kind === 'excel'),
  },
  {
    id: 'sense',
    label: 'Sense suspensos',
    test: (item) => item.mean !== null && item.failSubjects.length === 0,
  },
]


function AlertTag({ alert }: { alert: Alert }) {
  return (
    <span className={`alert-tag tone-${alert.tone}`} title={alert.detail}>
      {alert.label}
    </span>
  )
}

export function JuntaView({
  data,
  evaluation,
  notes,
  onNote,
  onOpenStudent,
  previous,
}: {
  data: EvaluationData
  evaluation: EvaluationId
  notes: NotesMap
  onNote: (name: string, notes: StudentNotes) => void
  onOpenStudent: (name: string) => void
  previous?: EvaluationId
}) {
  const [filter, setFilter] = useState<Filter>('tots')
  const [sort, setSort] = useState<Sort>('llista')
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)

  const insights = useMemo(
    () => groupInsights(data, evaluation, previous),
    [data, evaluation, previous],
  )
  const subjects = useMemo(() => subjectStats(data, evaluation), [data, evaluation])
  const summary = useMemo(
    () => juntaSummaryText(data, evaluation, previous),
    [data, evaluation, previous],
  )

  const counts = Object.fromEntries(
    filters.map((item) => [item.id, insights.filter(item.test).length]),
  ) as Record<Filter, number>

  const normalise = (text: string) =>
    text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const activeFilter = filters.find((item) => item.id === filter) ?? filters[0]
  const rows = insights
    .filter(activeFilter.test)
    .filter((item) => normalise(item.name).includes(normalise(query.trim())))
  const sorted =
    sort === 'llista'
      ? rows
      : [...rows].sort((a, b) => {
          if (sort === 'nom') return a.name.localeCompare(b.name, 'ca')
          if (sort === 'mitjana') return (b.mean ?? -1) - (a.mean ?? -1)
          if (sort === 'suspensos') {
            return b.failSubjects.length - a.failSubjects.length || (a.mean ?? 0) - (b.mean ?? 0)
          }
          return (a.delta ?? 99) - (b.delta ?? 99)
        })

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }

  const groupMean = classMean(data, evaluation)
  const previousMean = previous ? classMean(data, previous) : null

  return (
    <div className="junta">
      <section className="junta-top">
        <article className="panel junta-summary">
          <header>
            <div>
              <h2>Resum per a l'acta</h2>
              <p>
                Text generat a partir de les dades de la {evaluationLabel(evaluation)} avaluació
                {previous ? ` comparada amb la ${evaluationLabel(previous)}` : ''}. Copia'l i
                completa'l amb els acords.
              </p>
            </div>
            <button className="chart-download" onClick={() => void copySummary()} type="button">
              <span>{copied ? 'Copiat ✓' : 'Copia el text'}</span>
            </button>
          </header>
          <pre>{summary}</pre>
        </article>

        <div className="junta-kpis">
          <article className="metric blue">
            <span>Mitjana del grup</span>
            <strong>{formatNumber(groupMean)}</strong>
            <small>
              {previous && groupMean !== null && previousMean !== null
                ? `${formatSigned(groupMean - previousMean)} respecte de la ${evaluationLabel(previous)}`
                : 'sobre 4'}
            </small>
          </article>
          <button
            className={`metric coral kpi-button ${filter === 'atencio' ? 'active' : ''}`}
            onClick={() => setFilter(filter === 'atencio' ? 'tots' : 'atencio')}
            type="button"
          >
            <span>Necessiten seguiment</span>
            <strong>{counts.atencio}</strong>
            <small>
              {RISK_FAILS}+ suspensos, suspensos repetits o nous, o baixada
            </small>
          </button>
          <button
            className={`metric forest kpi-button ${filter === 'milloren' ? 'active' : ''}`}
            onClick={() => setFilter(filter === 'milloren' ? 'tots' : 'milloren')}
            disabled={!previous}
            type="button"
          >
            <span>Milloren</span>
            <strong>{previous ? counts.milloren : '—'}</strong>
            <small>
              {previous
                ? `mitjana +${formatNumber(RELEVANT_CHANGE)} o recuperen matèries`
                : 'cal una avaluació anterior'}
            </small>
          </button>
          <button
            className={`metric gold kpi-button ${filter === 'excel' ? 'active' : ''}`}
            onClick={() => setFilter(filter === 'excel' ? 'tots' : 'excel')}
            type="button"
          >
            <span>Rendiment excel·lent</span>
            <strong>{counts.excel}</strong>
            <small>sense suspensos i mitjana ≥ {formatNumber(EXCELLENCE_MEAN, 1)}</small>
          </button>
        </div>
      </section>

      <article className="panel junta-grid-panel">
        <header>
          <div>
            <h2>Graella de la sessió</h2>
            <p>
              Fes clic en un nom per obrir-ne la fitxa. Les fletxes indiquen canvis de nivell
              {previous ? ` respecte de la ${evaluationLabel(previous)}` : ''}.
            </p>
          </div>
        </header>

        <div className="junta-toolbar">
          <div className="junta-filters" role="group" aria-label="Filtra l'alumnat">
            {filters.map((item) => (
              <button
                aria-pressed={filter === item.id}
                className={filter === item.id ? 'active' : ''}
                key={item.id}
                onClick={() => setFilter(item.id)}
                type="button"
              >
                {item.label} <b>{counts[item.id]}</b>
              </button>
            ))}
          </div>
          <div className="junta-search">
            <input
              aria-label="Cerca un alumne"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca un alumne…"
              type="search"
              value={query}
            />
            <select
              aria-label="Ordena"
              onChange={(event) => setSort(event.target.value as Sort)}
              value={sort}
            >
              <option value="llista">Ordre de la llista</option>
              <option value="nom">Nom</option>
              <option value="suspensos">Més suspensos</option>
              <option value="mitjana">Mitjana més alta</option>
              <option value="variacio">Més baixada</option>
            </select>
          </div>
        </div>

        <div className="junta-table-wrap">
          <table className="junta-table">
            <thead>
              <tr>
                <th className="sticky-col">Alumne</th>
                {data.subjects.map((subject) => (
                  <th className="subject-col" key={subject} title={subject}>
                    <span>{shortSubject(subject)}</span>
                  </th>
                ))}
                <th>Mitj.</th>
                {previous && <th>Var.</th>}
                <th>Susp.</th>
                <th className="alerts-col">Indicadors</th>
                <th className="notes-col">Acords de la junta</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => {
                const studentNotes = notes[item.name] ?? emptyNotes
                return (
                  <tr className={item.needsAttention ? 'attention' : ''} key={item.name}>
                    <th className="sticky-col">
                      <button
                        className="name-link"
                        onClick={() => onOpenStudent(item.name)}
                        title={`Obre la fitxa de ${item.name}`}
                        type="button"
                      >
                        {item.name}
                      </button>
                      {studentNotes.familia.trim() && (
                        <small className="has-message" title="Té missatge per a la família">
                          ✉
                        </small>
                      )}
                    </th>
                    {data.subjects.map((subject, index) => {
                      const grade = item.grades[index] ?? null
                      const before = item.previousGrades?.[index] ?? null
                      const level = gradeLevel(grade)
                      const change =
                        grade !== null && before !== null
                          ? Math.sign(
                              ['NA', 'AS', 'AN', 'AE'].indexOf(level?.code ?? '') -
                                ['NA', 'AS', 'AN', 'AE'].indexOf(gradeLevel(before)?.code ?? ''),
                            )
                          : 0
                      return (
                        <td
                          className={`grade-cell ${level?.tone ?? 'empty'}`}
                          key={subject}
                          title={`${subject}: ${formatGrade(grade)}${level ? ` (${level.code})` : ''}${
                            before !== null ? ` · abans ${formatGrade(before)}` : ''
                          }`}
                        >
                          {formatGrade(grade)}
                          {change !== 0 && (
                            <i className={change > 0 ? 'up' : 'down'}>{change > 0 ? '▲' : '▼'}</i>
                          )}
                        </td>
                      )
                    })}
                    <td className="mean-cell">{formatNumber(item.mean)}</td>
                    {previous && (
                      <td
                        className={`delta-cell ${
                          (item.delta ?? 0) >= RELEVANT_CHANGE
                            ? 'up'
                            : (item.delta ?? 0) <= -RELEVANT_CHANGE
                              ? 'down'
                              : ''
                        }`}
                      >
                        {formatSigned(item.delta)}
                      </td>
                    )}
                    <td className={`fails-cell ${item.failSubjects.length >= RISK_FAILS ? 'risk' : ''}`}>
                      {item.mean === null ? '—' : item.failSubjects.length}
                    </td>
                    <td className="alerts-col">
                      <div className="alert-tags">
                        {item.alerts
                          .filter((alert) => alert.kind !== 'incomplet' || item.mean === null)
                          .map((alert) => (
                            <AlertTag alert={alert} key={alert.kind + alert.label} />
                          ))}
                      </div>
                    </td>
                    <td className="notes-col">
                      <textarea
                        aria-label={`Acords per a ${item.name}`}
                        onChange={(event) =>
                          onNote(item.name, { ...studentNotes, acords: event.target.value })
                        }
                        placeholder="Acords, mesures, entrevista…"
                        rows={1}
                        value={studentNotes.acords}
                      />
                    </td>
                  </tr>
                )
              })}
              {sorted.length === 0 && (
                <tr>
                  <td className="junta-empty" colSpan={data.subjects.length + 6}>
                    Cap alumne coincideix amb el filtre.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <th className="sticky-col">Mitjana</th>
                {subjects.map((item) => (
                  <td key={item.subject}>{formatNumber(item.mean, 1)}</td>
                ))}
                <td className="mean-cell">{formatNumber(groupMean)}</td>
                {previous && <td />}
                <td />
                <td colSpan={2} />
              </tr>
              <tr>
                <th className="sticky-col">Suspensos</th>
                {subjects.map((item) => (
                  <td className={item.fails > 0 ? 'foot-fails' : ''} key={item.subject}>
                    {item.fails}
                  </td>
                ))}
                <td />
                {previous && <td />}
                <td className="fails-cell">
                  {subjects.reduce((total, item) => total + item.fails, 0)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="junta-legend">
          <LevelLegend compact />
          <span className="junta-legend-arrows">
            <i className="up">▲</i> puja de nivell · <i className="down">▼</i> baixa de nivell
          </span>
        </div>
      </article>
    </div>
  )
}

/* ---------- Acta en PDF (pàgines apaïsades fora de pantalla) ---------- */

const ROWS_PER_PAGE = 28

export function JuntaPrintPages({
  data,
  evaluation,
  heading,
  notes,
  previous,
}: {
  data: EvaluationData
  evaluation: EvaluationId
  heading: string
  notes: NotesMap
  previous?: EvaluationId
}) {
  const insights = groupInsights(data, evaluation, previous)
  const subjects = subjectStats(data, evaluation)
  const summary = juntaSummaryText(data, evaluation, previous)
  const chunks: StudentInsight[][] = []
  for (let index = 0; index < insights.length; index += ROWS_PER_PAGE) {
    chunks.push(insights.slice(index, index + ROWS_PER_PAGE))
  }
  const withNotes = insights.filter((item) => notes[item.name]?.acords.trim())

  return (
    <>
      {chunks.map((chunk, pageIndex) => (
        <article className="acta-page" key={pageIndex}>
          <header className="acta-header">
            <div>
              <span>Junta d'avaluació</span>
              <h2>{heading}</h2>
            </div>
            <strong>
              {evaluationLabel(evaluation)} avaluació
              {chunks.length > 1 ? ` · ${pageIndex + 1}/${chunks.length}` : ''}
            </strong>
          </header>
          <table className="junta-table acta-table">
            <thead>
              <tr>
                <th>Alumne</th>
                {data.subjects.map((subject) => (
                  <th key={subject}>{shortSubject(subject)}</th>
                ))}
                <th>Mitj.</th>
                {previous && <th>Var.</th>}
                <th>Susp.</th>
                <th>Indicadors</th>
              </tr>
            </thead>
            <tbody>
              {chunk.map((item) => (
                <tr key={item.name}>
                  <th>{item.name}</th>
                  {data.subjects.map((subject, index) => {
                    const grade = item.grades[index] ?? null
                    return (
                      <td className={`grade-cell ${gradeLevel(grade)?.tone ?? 'empty'}`} key={subject}>
                        {formatGrade(grade)}
                      </td>
                    )
                  })}
                  <td className="mean-cell">{formatNumber(item.mean)}</td>
                  {previous && <td>{formatSigned(item.delta)}</td>}
                  <td className="fails-cell">{item.mean === null ? '—' : item.failSubjects.length}</td>
                  <td className="acta-alerts">
                    {item.alerts
                      .filter((alert) => alert.kind !== 'incomplet')
                      .map((alert) => alert.label)
                      .join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
            {pageIndex === chunks.length - 1 && (
              <tfoot>
                <tr>
                  <th>Mitjana</th>
                  {subjects.map((item) => (
                    <td key={item.subject}>{formatNumber(item.mean, 1)}</td>
                  ))}
                  <td className="mean-cell">{formatNumber(classMean(data, evaluation))}</td>
                  {previous && <td />}
                  <td className="fails-cell">
                    {subjects.reduce((total, item) => total + item.fails, 0)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
          <LevelLegend compact />
        </article>
      ))}
      <article className="acta-page">
        <header className="acta-header">
          <div>
            <span>Junta d'avaluació</span>
            <h2>{heading}</h2>
          </div>
          <strong>Resum i acords</strong>
        </header>
        <div className="acta-columns">
          <pre>{summary}</pre>
          <section>
            <h3>Acords per alumne</h3>
            {withNotes.length === 0 ? (
              <p className="acta-empty">No s'ha anotat cap acord.</p>
            ) : (
              <dl>
                {withNotes.map((item) => (
                  <div key={item.name}>
                    <dt>{item.name}</dt>
                    <dd>{notes[item.name]?.acords}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>
      </article>
    </>
  )
}
