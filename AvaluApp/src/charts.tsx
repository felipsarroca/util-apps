import { type ReactNode, useRef, useState } from 'react'
import { DownloadIcon } from './icons'
import { downloadElementPng } from './export'
import {
  LEVELS,
  PASS_MARK,
  type EvaluationData,
  type EvaluationId,
  classMean,
  evaluationLabel,
  formatGrade,
  formatNumber,
  gradeLevel,
  studentMean,
  subjectStats,
} from './data'

export function Panel({
  children,
  exportName,
  subtitle,
  title,
}: {
  children: ReactNode
  exportName?: string
  subtitle: string
  title: string
}) {
  const panelRef = useRef<HTMLElement>(null)
  const [exporting, setExporting] = useState(false)

  const exportPanel = async () => {
    if (!panelRef.current || !exportName) return
    setExporting(true)
    try {
      await downloadElementPng(panelRef.current, `AvaluApp-${exportName}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <article className="panel" data-export-name={exportName} ref={panelRef}>
      <header>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {exportName && (
          <button
            aria-label={`Descarrega ${title} com a imatge`}
            className="chart-download"
            data-html2canvas-ignore="true"
            disabled={exporting}
            onClick={() => void exportPanel()}
            title="Descarrega el gràfic en PNG"
            type="button"
          >
            <DownloadIcon />
            <span>{exporting ? 'Generant…' : 'PNG'}</span>
          </button>
        )}
      </header>
      {children}
    </article>
  )
}

export function HorizontalBars({
  benchmark,
  data,
  integer = false,
  max,
  tone = 'forest',
}: {
  benchmark?: number | null
  data: Array<{ label: string; value: number }>
  integer?: boolean
  max: number
  tone?: 'forest' | 'coral'
}) {
  return (
    <div>
      <div className="horizontal-bars">
        {data.map((item) => (
          <div className="bar-row" key={item.label}>
            <span title={item.label}>{item.label}</span>
            <div className="bar-track">
              {benchmark !== undefined && benchmark !== null && (
                <i
                  className="benchmark"
                  style={{ left: `${(benchmark / max) * 100}%` }}
                />
              )}
              <b
                className={
                  benchmark !== undefined && benchmark !== null
                    ? item.value >= benchmark
                      ? 'above-benchmark'
                      : 'below-benchmark'
                    : tone
                }
                style={{ width: `${Math.max((item.value / max) * 100, 1)}%` }}
              />
            </div>
            <strong>
              {integer ? item.value : formatNumber(item.value)}
            </strong>
          </div>
        ))}
      </div>
      {benchmark !== undefined && benchmark !== null && (
        <div className="benchmark-legend">
          <span><i className="green" /> Per sobre de la mitjana</span>
          <span><i className="red" /> Per sota de la mitjana</span>
          <span><i className="gold" /> Mitjana global: {formatNumber(benchmark)}</span>
        </div>
      )}
    </div>
  )
}

export function GroupedSubjectChart({
  data,
  evaluations,
  metric,
}: {
  data: EvaluationData
  evaluations: EvaluationId[]
  metric: 'mean' | 'fails'
}) {
  const colors = ['#467b9e', '#d89a2b', '#23735b']
  const allStats = evaluations.map((evaluation) => ({
    evaluation,
    stats: subjectStats(data, evaluation),
  }))
  const max =
    metric === 'mean'
      ? 4
      : Math.max(
          ...allStats.flatMap(({ stats }) => stats.map((item) => item.fails)),
          1,
        )

  return (
    <div className="grouped-subject-chart">
      {data.subjects.map((subject, subjectIndex) => (
        <div className="grouped-subject-row" key={subject}>
          <span title={subject}>{subject}</span>
          <div className="grouped-bars">
            {allStats.map(({ evaluation, stats }, colorIndex) => {
              const value =
                metric === 'mean'
                  ? (stats[subjectIndex]?.mean ?? 0)
                  : stats[subjectIndex]?.fails ?? 0
              return (
                <div key={evaluation}>
                  <b
                    style={{
                      background: colors[colorIndex],
                      width: `${Math.max((value / max) * 100, 1)}%`,
                    }}
                  />
                  <small>
                    {evaluationLabel(evaluation)} ·{' '}
                    {metric === 'mean' ? formatNumber(value) : value}
                  </small>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function EvolutionChart({
  data,
  evaluations = data.evaluations,
}: {
  data: EvaluationData
  evaluations?: EvaluationId[]
}) {
  const points = evaluations.map((evaluation) => ({
    evaluation,
    value: classMean(data, evaluation),
  }))
  return (
    <LineSvg
      labels={points.map((point) => evaluationLabel(point.evaluation))}
      lines={[
        {
          color: '#23735b',
          name: 'Mitjana del grup',
          values: points.map((point) => point.value),
        },
      ]}
    />
  )
}

export function StudentEvolution({
  data,
  evaluations = data.evaluations,
  showGroup = true,
  studentName,
}: {
  data: EvaluationData
  evaluations?: EvaluationId[]
  showGroup?: boolean
  studentName: string
}) {
  const student = data.students.find((item) => item.name === studentName)
  if (!student) return null
  const studentValues = evaluations.map((item) => studentMean(student, item))
  const groupValues = evaluations.map((item) => classMean(data, item))
  const lowest = Math.min(
    ...[...studentValues, ...(showGroup ? groupValues : [])].filter(
      (value): value is number => value !== null,
    ),
    1.5,
  )
  // L'eix comença a 1,5 tret que algun valor quedi per sota.
  const min = Math.max(0, Math.floor(lowest * 2) / 2)
  const lines = [
    { color: '#1f77b4', name: student.name, values: studentValues },
  ]
  if (showGroup) {
    lines.push({ color: '#ff7f0e', name: 'Mitjana del grup', values: groupValues })
  }
  return (
    <LineSvg
      labels={evaluations.map(evaluationLabel)}
      lines={lines}
      max={4}
      min={min}
      tickStep={0.5}
    />
  )
}

export function LineSvg({
  labels,
  lines,
  max = 4,
  min = 0,
  tickStep = 1,
}: {
  labels: string[]
  lines: Array<{
    color: string
    name: string
    values: Array<number | null>
  }>
  max?: number
  min?: number
  tickStep?: number
}) {
  const width = 640
  const height = 280
  const left = 64
  const right = 22
  const top = 24
  const bottom = 42
  const x = (index: number) =>
    labels.length === 1
      ? width / 2
      : left + (index * (width - left - right)) / (labels.length - 1)
  const y = (value: number) =>
    top + ((max - value) / (max - min)) * (height - top - bottom)
  const ticks = Array.from(
    { length: Math.round((max - min) / tickStep) + 1 },
    (_, index) => min + index * tickStep,
  )

  return (
    <div className="svg-chart">
      <svg aria-label="Gràfic d'evolució" viewBox={`0 0 ${width} ${height}`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className={tick === 2 ? 'threshold-grid' : 'grid-line'}
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text textAnchor="end" x={left - 8} y={y(tick) + 4}>
              {formatNumber(tick)}
            </text>
          </g>
        ))}
        {labels.map((label, index) => (
          <text
            className="axis-label"
            key={label}
            textAnchor="middle"
            x={x(index)}
            y={height - 12}
          >
            {label}
          </text>
        ))}
        {lines.map((line, lineIndex) => {
          const available = line.values
            .map((value, index) => ({ index, value }))
            .filter(
              (point): point is { index: number; value: number } =>
                point.value !== null,
            )
          const path = available
            .map(
              (point, index) =>
                `${index === 0 ? 'M' : 'L'} ${x(point.index)} ${y(point.value)}`,
            )
            .join(' ')
          return (
            <g key={line.name}>
              <path d={path} fill="none" stroke={line.color} strokeWidth="4" />
              {available.map((point) => (
                <g key={point.index}>
                  <circle
                    cx={x(point.index)}
                    cy={y(point.value)}
                    fill="white"
                    r="6"
                    stroke={line.color}
                    strokeWidth="4"
                  />
                  <text
                    className="point-label"
                    textAnchor="middle"
                    x={x(point.index)}
                    y={y(point.value) + (lineIndex === 0 ? -13 : 21)}
                  >
                    {formatNumber(point.value)}
                  </text>
                </g>
              ))}
            </g>
          )
        })}
      </svg>
      <div className="chart-legend">
        {lines.map((line) => (
          <span key={line.name}>
            <i style={{ background: line.color }} />
            {line.name}
          </span>
        ))}
      </div>
    </div>
  )
}

export function DivergingBars({
  data,
}: {
  data: Array<{ label: string; value: number }>
}) {
  const visible =
    data.length > 30
      ? [...data.slice(0, 15), ...data.slice(-15)]
      : data
  const max = Math.max(...visible.map((item) => Math.abs(item.value)), 0.1)
  return (
    <div className="diverging-bars">
      {visible.length < data.length && (
        <p className="chart-note">
          Es mostren els 15 canvis més negatius i els 15 més positius
          ({data.length - visible.length} alumnes amb canvis intermedis no hi surten).
        </p>
      )}
      {visible.map((item) => (
        <div className="diverging-row" key={item.label}>
          <span>{item.label}</span>
          <div className="diverging-track">
            <i />
            <b
              className={item.value >= 0 ? 'positive' : 'negative'}
              style={{
                left:
                  item.value >= 0
                    ? '50%'
                    : `${50 - (Math.abs(item.value) / max) * 50}%`,
                width: `${(Math.abs(item.value) / max) * 50}%`,
              }}
            />
          </div>
          <strong className={item.value >= 0 ? 'up' : 'down'}>
            {item.value >= 0 ? '+' : ''}
            {formatNumber(item.value)}
          </strong>
        </div>
      ))}
    </div>
  )
}

export function EmptyComparison() {
  return (
    <div className="empty-comparison">
      <span>↗</span>
      <strong>Encara no hi ha una avaluació anterior</strong>
      <p>
        Quan el fitxer contingui dues o més avaluacions, aquí apareixerà la
        millora o l'empitjorament de cada alumne.
      </p>
    </div>
  )
}

export function StudentRanking({
  benchmark,
  onSelect,
  students,
}: {
  onSelect?: (name: string) => void
  benchmark: number | null
  students: Array<{
    name: string
    mean: number | null
    fails: number
    gradesCount: number
  }>
}) {
  const benchmarkPosition =
    benchmark === null ? null : Math.min(Math.max((benchmark / 4) * 100, 0), 100)

  return (
    <div className="student-ranking">
      <div className="ranking-guide">
        <span>Nota mitjana sobre 4</span>
        {benchmark !== null && (
          <span className="ranking-benchmark-label">
            <i />
            Mitjana del grup: {formatNumber(benchmark)}
          </span>
        )}
      </div>
      <div className="ranking-list">
        {students.map((student, index) => {
          const gradePosition =
            student.mean === null
              ? 0
              : Math.min(Math.max((student.mean / 4) * 100, 0), 100)
          const isAbove =
            student.mean !== null &&
            benchmark !== null &&
            student.mean >= benchmark

          return (
            <div
              className={`ranking-row ${index < 3 ? `ranking-top-${index + 1}` : ''}`}
              key={student.name}
            >
              <span className="rank-number" aria-label={`Posició ${index + 1}`}>
                {index + 1}
              </span>
              {onSelect ? (
                <button
                  className="ranking-name name-link"
                  onClick={() => onSelect(student.name)}
                  title={`Obre la fitxa de ${student.name}`}
                  type="button"
                >
                  {student.name}
                </button>
              ) : (
                <strong className="ranking-name">{student.name}</strong>
              )}
              <div
                aria-label={`Mitjana de ${student.name}: ${formatNumber(student.mean)}`}
                className="ranking-track"
              >
                <span
                  className={`ranking-fill ${isAbove ? 'above' : 'below'}`}
                  style={{ width: `${gradePosition}%` }}
                />
                {benchmarkPosition !== null && (
                  <i
                    aria-hidden="true"
                    className="ranking-benchmark"
                    style={{ left: `${benchmarkPosition}%` }}
                  />
                )}
              </div>
              <span className={`rank-grade ${isAbove ? 'above' : 'below'}`}>
                <small>Mitjana</small>
                {formatNumber(student.mean)}
              </span>
              <span className={`rank-fails ${student.fails === 0 ? 'none' : ''}`}>
                {student.fails === 0
                  ? 'Cap suspens'
                  : `${student.fails} ${student.fails === 1 ? 'suspens' : 'suspensos'}`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FailDistribution({
  students,
}: {
  students: Array<{
    name: string
    mean: number | null
    fails: number
    gradesCount: number
  }>
}) {
  const groups = [
    { color: '#467b9e', label: '0 suspensos', min: 0, max: 0 },
    { color: '#ef9b35', label: '1–2 suspensos', min: 1, max: 2 },
    { color: '#65a65e', label: '3–5 suspensos', min: 3, max: 5 },
    { color: '#d56350', label: '6–8 suspensos', min: 6, max: 8 },
    { color: '#8d68b4', label: '9 o més suspensos', min: 9, max: Infinity },
  ].map((group) => ({
    ...group,
    count: students.filter(
      (student) => student.fails >= group.min && student.fails <= group.max,
    ).length,
  }))
  const total = Math.max(students.length, 1)
  const totalFails = students.reduce(
    (accumulatedFails, student) => accumulatedFails + student.fails,
    0,
  )
  let accumulated = 0
  const groupsWithPosition = groups.map((group) => {
      const start = (accumulated / total) * 100
      accumulated += group.count
      const end = (accumulated / total) * 100
      return {
        ...group,
        end,
        labelAngle: ((start + end) / 2 / 100) * 360,
        start,
      }
    })
  const gradient = groupsWithPosition
    .map((group) => `${group.color} ${group.start}% ${group.end}%`)
    .join(', ')

  return (
    <div className="fail-distribution">
      <div
        aria-label={`Gràfic circular: ${totalFails} suspensos entre ${students.length} alumnes`}
        className="donut-chart"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="donut-segment-labels" aria-hidden="true">
          {groupsWithPosition
            .filter((group) => group.count > 0)
            .map((group, index) => {
              const angle = ((group.labelAngle - 90) * Math.PI) / 180
              const isNarrow = group.count / total < 0.1
              const labelRadius = isNarrow ? (index % 2 === 0 ? 31 : 43) : 37
              const x = 50 + Math.cos(angle) * labelRadius
              const y = 50 + Math.sin(angle) * labelRadius
              const shortLabel =
                group.max === Infinity
                  ? '9+ susp.'
                  : group.min === group.max
                    ? `${group.min} susp.`
                    : `${group.min}–${group.max} susp.`

              return (
                <span
                  className="donut-segment-label"
                  key={group.label}
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <strong>{shortLabel}</strong>
                  <small>
                    {group.count} {group.count === 1 ? 'alumne' : 'alumnes'}
                  </small>
                </span>
              )
            })}
        </div>
        <div className="donut-summary">
          <span className="donut-total">
            <strong>{totalFails}</strong>
            <small>suspensos</small>
          </span>
          <i aria-hidden="true" />
          <span className="donut-total">
            <strong>{students.length}</strong>
            <small>alumnes</small>
          </span>
        </div>
      </div>
      <div className="donut-legend">
        {groupsWithPosition.map((group) => (
          <div key={group.label}>
            <i style={{ background: group.color }} />
            <span>
              <strong>{group.label}</strong>
              <small>
                {group.count} alumnes ·{' '}
                {formatNumber((group.count / total) * 100, 1)}%
              </small>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RadarChart({
  labels,
  primary,
  primaryLabel = 'Alumne',
  secondary,
}: {
  labels: string[]
  primary: Array<number | null>
  primaryLabel?: string
  secondary?: Array<number | null>
}) {
  const size = 420
  const center = size / 2
  const radius = 145
  const point = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2
    const distance = (value / 4) * radius
    return [
      center + Math.cos(angle) * distance,
      center + Math.sin(angle) * distance,
    ]
  }
  const polygon = (values: Array<number | null>) =>
    labels
      .map((_, index) => point(index, values[index] ?? 0).join(','))
      .join(' ')

  return (
    <div className="radar-wrap">
      <svg aria-label="Gràfic de radar per matèries" viewBox={`0 0 ${size} ${size}`}>
        {[1, 2, 3, 4].map((level) => (
          <polygon
            className="radar-grid"
            key={level}
            points={labels
              .map((_, index) => point(index, level).join(','))
              .join(' ')}
          />
        ))}
        {labels.map((label, index) => {
          const [lineX, lineY] = point(index, 4)
          const [textX, textY] = point(index, 4.55)
          return (
            <g key={label}>
              <line
                className="radar-axis"
                x1={center}
                x2={lineX}
                y1={center}
                y2={lineY}
              />
              <text
                className="radar-label"
                textAnchor="middle"
                x={textX}
                y={textY + 4}
              >
                {label.length > 10 ? `${label.slice(0, 9)}…` : label}
              </text>
            </g>
          )
        })}
        {secondary && (
          <polygon className="radar-secondary" points={polygon(secondary)} />
        )}
        <polygon className="radar-primary" points={polygon(primary)} />
        {labels.map((label, index) =>
          primary[index] === null || primary[index] === undefined ? null : (
            <circle
              className="radar-dot"
              cx={point(index, primary[index] ?? 0)[0]}
              cy={point(index, primary[index] ?? 0)[1]}
              key={label}
              r="4"
            />
          ),
        )}
        <circle className="radar-threshold" cx={center} cy={center} r={(PASS_MARK / 4) * radius} />
      </svg>
      <div className="chart-legend">
        <span>
          <i style={{ background: '#1f77b4' }} />
          {primaryLabel}
        </span>
        {secondary && (
          <span>
            <i style={{ background: '#ff7f0e' }} />
            Mitjana del grup
          </span>
        )}
        <span>
          <i className="dashed" />
          Llindar d'assoliment (1,96)
        </span>
      </div>
    </div>
  )
}

export function MultiRadarChart({
  evaluations,
  labels,
  student,
}: {
  evaluations: EvaluationId[]
  labels: string[]
  student: EvaluationData['students'][number]
}) {
  const size = 420
  const center = size / 2
  const radius = 145
  const colors = ['#467b9e', '#d89a2b', '#23735b']
  const point = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2
    const distance = (value / 4) * radius
    return [
      center + Math.cos(angle) * distance,
      center + Math.sin(angle) * distance,
    ]
  }

  return (
    <div className="radar-wrap">
      <svg
        aria-label="Comparativa de perfil per matèries"
        viewBox={`0 0 ${size} ${size}`}
      >
        {[1, 2, 3, 4].map((level) => (
          <polygon
            className="radar-grid"
            key={level}
            points={labels
              .map((_, index) => point(index, level).join(','))
              .join(' ')}
          />
        ))}
        {labels.map((label, index) => {
          const [lineX, lineY] = point(index, 4)
          const [textX, textY] = point(index, 4.55)
          return (
            <g key={label}>
              <line
                className="radar-axis"
                x1={center}
                x2={lineX}
                y1={center}
                y2={lineY}
              />
              <text
                className="radar-label"
                textAnchor="middle"
                x={textX}
                y={textY + 4}
              >
                {label.length > 10 ? `${label.slice(0, 9)}…` : label}
              </text>
            </g>
          )
        })}
        {evaluations.map((evaluation, colorIndex) => (
          <polygon
            fill={`${colors[colorIndex]}22`}
            key={evaluation}
            points={(student.evaluations[evaluation] ?? [])
              .map((value, index) => point(index, value ?? 0).join(','))
              .join(' ')}
            stroke={colors[colorIndex]}
            strokeWidth="3"
          />
        ))}
      </svg>
      <div className="chart-legend">
        {evaluations.map((evaluation, index) => (
          <span key={evaluation}>
            <i style={{ background: colors[index] }} />
            {evaluationLabel(evaluation)} avaluació
          </span>
        ))}
      </div>
    </div>
  )
}

export function SubjectEvolutionExplorer({
  data,
  evaluations,
  studentName,
}: {
  data: EvaluationData
  evaluations: EvaluationId[]
  studentName: string
}) {
  const [subjectIndex, setSubjectIndex] = useState(0)
  const student = data.students.find((item) => item.name === studentName)
  if (!student) return null
  const selectedSubject = data.subjects[subjectIndex]

  return (
    <div className="subject-explorer">
      <div className="subject-selector" aria-label="Selecciona una matèria">
        {data.subjects.map((subject, index) => (
          <button
            className={index === subjectIndex ? 'active' : ''}
            key={subject}
            onClick={() => setSubjectIndex(index)}
            type="button"
          >
            {subject}
          </button>
        ))}
      </div>
      <div className="subject-chart">
        <div className="subject-chart-heading">
          <span>Matèria seleccionada</span>
          <strong>{selectedSubject}</strong>
        </div>
        <LineSvg
          labels={evaluations.map(evaluationLabel)}
          lines={[
            {
              color: '#23735b',
              name: student.name,
              values: evaluations.map(
                (item) => student.evaluations[item]?.[subjectIndex] ?? null,
              ),
            },
            {
              color: '#d89a2b',
              name: 'Mitjana del grup',
              values: evaluations.map(
                (item) => subjectStats(data, item)[subjectIndex]?.mean ?? null,
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}

export function GradeBadge({
  showLevel = false,
  value,
}: {
  showLevel?: boolean
  value: number | null
}) {
  if (value === null) return <span className="grade-badge empty">—</span>
  const level = gradeLevel(value)
  return (
    <span
      className={`grade-badge ${level?.tone ?? ''}`}
      title={level ? `${level.code} · ${level.name}` : undefined}
    >
      {formatGrade(value)}
      {showLevel && level && <small>{level.code}</small>}
    </span>
  )
}

export function LevelLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`level-legend ${compact ? 'compact' : ''}`}>
      {LEVELS.map((level) => (
        <span key={level.code}>
          <b className={`grade-badge ${level.tone}`}>{level.code}</b>
          {compact ? level.range : `${level.name} (${level.range})`}
        </span>
      ))}
    </div>
  )
}

/** Barres apilades amb el nombre d'alumnes de cada nivell per matèria. */
export function LevelDistribution({
  data,
  evaluation,
}: {
  data: EvaluationData
  evaluation: EvaluationId
}) {
  const stats = subjectStats(data, evaluation).filter((item) => item.count > 0)
  return (
    <div className="level-distribution">
      {stats.map((item) => (
        <div className="level-row" key={item.subject}>
          <span title={item.subject}>{item.subject}</span>
          <div className="level-track">
            {item.levels.map((count, index) =>
              count > 0 ? (
                <b
                  className={LEVELS[index].tone}
                  key={LEVELS[index].code}
                  style={{ width: `${(count / item.count) * 100}%` }}
                  title={`${LEVELS[index].code}: ${count}`}
                >
                  {count}
                </b>
              ) : null,
            )}
          </div>
          <strong>{formatNumber(item.count > 0 ? ((item.count - item.fails) / item.count) * 100 : null, 0)} %</strong>
        </div>
      ))}
      <div className="level-distribution-foot">
        <LevelLegend compact />
        <small>% = percentatge d'alumnes que assoleixen la matèria</small>
      </div>
    </div>
  )
}

export function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="delta neutral">—</span>
  return (
    <span
      className={`delta ${
        value > 0.005 ? 'up' : value < -0.005 ? 'down' : 'neutral'
      }`}
    >
      {value > 0.005 ? '↑ ' : value < -0.005 ? '↓ ' : ''}
      {value > 0 ? '+' : ''}
      {formatNumber(value)}
    </span>
  )
}
