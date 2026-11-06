import {
  type EvaluationData,
  type EvaluationId,
  classMean,
  evaluationLabel,
  familySummary,
  formatNumber,
  gradeLevel,
  studentInsight,
  studentMean,
  subjectStats,
} from './data'
import { GradeBadge, LevelLegend, RadarChart, StudentEvolution } from './charts'
import type { ReportSettings, StudentNotes } from './settings'

const levelIndex = (value: number | null) => {
  const level = gradeLevel(value)
  return level ? ['NA', 'AS', 'AN', 'AE'].indexOf(level.code) : null
}

function Trend({ before, now }: { before: number | null; now: number | null }) {
  const a = levelIndex(before)
  const b = levelIndex(now)
  if (a === null || b === null) return <span className="trend neutral">—</span>
  if (b > a) return <span className="trend up">▲ Millora</span>
  if (b < a) return <span className="trend down">▼ Baixa</span>
  return <span className="trend neutral">= Es manté</span>
}

/** Informe d'una pàgina A4 per a l'alumne i la seva família. */
export function FamilyReportPage({
  data,
  evaluation,
  notes,
  settings,
  studentName,
}: {
  data: EvaluationData
  evaluation: EvaluationId
  notes: StudentNotes
  settings: ReportSettings
  studentName: string
}) {
  const student = data.students.find((item) => item.name === studentName)
  if (!student) return null
  const evaluations = data.evaluations.filter((item) => item <= evaluation)
  const previous = evaluations.filter((item) => item < evaluation).at(-1)
  const insight = studentInsight(data, student, evaluation, previous)
  const classSubjects = subjectStats(data, evaluation)
  const groupMean = classMean(data, evaluation)
  const strengths = insight.strengths.slice(0, 4)
  const toImprove = Array.from(
    new Set([...insight.failSubjects, ...insight.worsenedSubjects]),
  ).slice(0, 5)
  const meta = [settings.grup, settings.curs && `Curs ${settings.curs}`]
    .filter(Boolean)
    .join(' · ')

  return (
    <article
      className={`family-report-page ${data.subjects.length > 11 ? "dense" : ""}`}
      data-student-name={studentName}
    >
      <header className="family-header">
        <div>
          <span>{settings.centre || 'Informe d’avaluació'}</span>
          <h2>{student.name}</h2>
          {meta && <p>{meta}</p>}
        </div>
        <div className="family-evaluation">
          <small>Resultats de la</small>
          <strong>{evaluationLabel(evaluation)} avaluació</strong>
        </div>
      </header>

      <section className="family-summary">
        <div className="family-mean">
          <small>Mitjana</small>
          <strong>{formatNumber(insight.mean)}</strong>
          <span>sobre 4 · {gradeLevel(insight.mean)?.code ?? '—'}</span>
        </div>
        <p>{familySummary(insight, data.subjects.length)}</p>
      </section>

      <table className="family-table">
        <thead>
          <tr>
            <th>Matèria</th>
            {evaluations.map((item) => (
              <th key={item}>{evaluationLabel(item)} aval.</th>
            ))}
            {previous && <th>Tendència</th>}
            {settings.showGroupMean && <th>Mitjana del grup</th>}
          </tr>
        </thead>
        <tbody>
          {data.subjects.map((subject, index) => {
            const now = student.evaluations[evaluation]?.[index] ?? null
            const before = previous ? (student.evaluations[previous]?.[index] ?? null) : null
            return (
              <tr key={subject}>
                <td>{subject}</td>
                {evaluations.map((item) => (
                  <td key={item}>
                    <GradeBadge showLevel value={student.evaluations[item]?.[index] ?? null} />
                  </td>
                ))}
                {previous && (
                  <td>
                    <Trend before={before} now={now} />
                  </td>
                )}
                {settings.showGroupMean && (
                  <td className="family-group-mean">
                    {formatNumber(classSubjects[index]?.mean ?? null)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
            <tr>
              <td>Mitjana global</td>
              {evaluations.map((item) => (
                <td key={item}>
                  <strong>{formatNumber(studentMean(student, item))}</strong>
                </td>
              ))}
              {previous && <td />}
              {settings.showGroupMean && (
                <td className="family-group-mean">{formatNumber(groupMean)}</td>
              )}
            </tr>
        </tfoot>
      </table>

      <div className="family-columns">
        <div className="family-boxes">
          <section className="family-box strengths">
            <h3>Punts forts</h3>
            {strengths.length > 0 ? (
              <ul>
                {strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>Cal continuar treballant per consolidar els aprenentatges.</p>
            )}
          </section>
          <section className="family-box improve">
            <h3>Cal reforçar</h3>
            {toImprove.length > 0 ? (
              <ul>
                {toImprove.map((item) => (
                  <li key={item}>
                    {item}
                    {insight.failSubjects.includes(item) ? ' (no assolida)' : ' (baixa de nivell)'}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Cap matèria pendent. Continua amb aquesta constància!</p>
            )}
          </section>
        </div>
        <section className="family-chart">
          <h3>{evaluations.length > 1 ? 'Evolució de la mitjana' : 'Perfil per matèries'}</h3>
          {evaluations.length > 1 ? (
            <StudentEvolution
              data={data}
              evaluations={evaluations}
              showGroup={settings.showGroupMean}
              studentName={studentName}
            />
          ) : (
            <RadarChart
              labels={data.subjects}
              primary={student.evaluations[evaluation] ?? []}
              primaryLabel={student.name}
              secondary={
                settings.showGroupMean
                  ? classSubjects.map((item) => item.mean)
                  : undefined
              }
            />
          )}
        </section>
      </div>

      <section className="family-message">
        <h3>Valoració del tutor o tutora</h3>
        {notes.familia.trim() ? (
          <p>{notes.familia}</p>
        ) : (
          <div className="family-lines" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        )}
      </section>

      <footer className="family-footer">
        <LevelLegend />
        {settings.showSignatures && (
          <div className="family-signatures">
            <div>
              <i />
              <span>{settings.tutor ? `${settings.tutor} · tutor/a` : 'Signatura del tutor/a'}</span>
            </div>
            <div>
              <i />
              <span>Signatura de la família</span>
            </div>
          </div>
        )}
      </footer>
    </article>
  )
}

export function ReportSettingsPanel({
  onChange,
  settings,
}: {
  onChange: (settings: ReportSettings) => void
  settings: ReportSettings
}) {
  const field = (key: 'centre' | 'grup' | 'tutor' | 'curs', label: string, placeholder: string) => (
    <label>
      {label}
      <input
        onChange={(event) => onChange({ ...settings, [key]: event.target.value })}
        placeholder={placeholder}
        type="text"
        value={settings[key]}
      />
    </label>
  )
  return (
    <div className="report-settings">
      <div className="report-settings-fields">
        {field('centre', 'Centre', 'Nom del centre')}
        {field('grup', 'Grup', 'p. ex. 3r d’ESO A')}
        {field('tutor', 'Tutor/a', 'Nom que signa')}
        {field('curs', 'Curs escolar', '2026-2027')}
      </div>
      <div className="report-settings-toggles">
        <label>
          <input
            checked={settings.showGroupMean}
            onChange={(event) => onChange({ ...settings, showGroupMean: event.target.checked })}
            type="checkbox"
          />
          Mostra la mitjana del grup
        </label>
        <label>
          <input
            checked={settings.showSignatures}
            onChange={(event) => onChange({ ...settings, showSignatures: event.target.checked })}
            type="checkbox"
          />
          Espai per a signatures
        </label>
      </div>
      <p className="report-settings-note">
        Aquestes dades de capçalera es recorden en aquest navegador. Els noms i les
        qualificacions no es desen mai.
      </p>
    </div>
  )
}
