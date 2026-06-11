import {
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './App.css'
import licenseImage from './assets/CC_BY-NC-SA.png'
import {
  downloadElementPng,
  downloadElementsPdf,
  downloadSvgPagesPdf,
} from './export'
import {
  classMean,
  type EvaluationData,
  type EvaluationId,
  formatNumber,
  parseWorkbook,
  studentMean,
  studentStats,
  subjectStats,
  validGrades,
} from './data'

type View = 'group' | 'student'

const evaluationLabel = (evaluation: EvaluationId) => `${evaluation}a`

function Icon({
  children,
  size = 20,
}: {
  children: ReactNode
  size?: number
}) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {children}
    </svg>
  )
}

const UploadIcon = () => (
  <Icon size={28}>
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
  </Icon>
)

const ShieldIcon = () => (
  <Icon>
    <path d="M12 3 5 6v5c0 4.8 2.9 8.1 7 10 4.1-1.9 7-5.2 7-10V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
)

const DownloadIcon = () => (
  <Icon>
    <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
    <path d="M5 19h14" />
  </Icon>
)

const ChartIcon = () => (
  <Icon>
    <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />
  </Icon>
)

const FileIcon = () => (
  <Icon>
    <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M14 3v5h5M8 13h8M8 17h6" />
  </Icon>
)

const InfoIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6" />
    <path d="M12 7.5h.01" />
  </Icon>
)

const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </Icon>
)

const CropIcon = () => (
  <Icon>
    <path d="M7 3v14a2 2 0 0 0 2 2h12M3 7h14a2 2 0 0 1 2 2v12" />
  </Icon>
)

const RenameIcon = () => (
  <Icon>
    <path d="M4 7h10M4 12h8M4 17h6" />
    <path d="m16 15 4-4 2 2-4 4-3 1 1-3Z" />
  </Icon>
)

const UserShieldIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19c.7-3.3 2.5-5 5.5-5 1.2 0 2.2.3 3 .8" />
    <path d="m17 13 4 1.7v2.8c0 2-1.4 3.5-4 4.5-2.6-1-4-2.5-4-4v-2.8L17 13Z" />
  </Icon>
)

function App() {
  const [data, setData] = useState<EvaluationData | null>(null)
  const [view, setView] = useState<View>('group')
  const [evaluation, setEvaluation] = useState<EvaluationId>(1)
  const [selectedEvaluations, setSelectedEvaluations] = useState<EvaluationId[]>([1])
  const [selectedStudent, setSelectedStudent] = useState('')
  const [showDownloads, setShowDownloads] = useState(false)
  const [showFileHelp, setShowFileHelp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!showFileHelp) return

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowFileHelp(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [showFileHelp])

  const loadFile = async (file?: File) => {
    if (!file) return
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setError("Cal seleccionar un fitxer d'Excel amb extensió .xlsx o .xls.")
      return
    }

    setLoading(true)
    setError('')
    try {
      const parsed = await parseWorkbook(file)
      const latest = parsed.evaluations.at(-1) ?? 1
      setData(parsed)
      setEvaluation(latest)
      setSelectedEvaluations([latest])
      setSelectedStudent(parsed.students[0]?.name ?? '')
      setView('group')
      setShowDownloads(false)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No s'ha pogut interpretar el fitxer.",
      )
    } finally {
      setLoading(false)
    }
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void loadFile(event.target.files?.[0])
    event.target.value = ''
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    void loadFile(event.dataTransfer.files?.[0])
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button
          aria-label="Torna a la pantalla inicial"
          className="brand"
          onClick={() => setData(null)}
          type="button"
        >
          <span className="brand-mark">
            <img
              alt=""
              className="brand-icon"
              src={`${import.meta.env.BASE_URL}favicon.svg`}
            />
          </span>
          <span>
            <strong>AvaluApp</strong>
            <small>Anàlisi d'avaluacions</small>
          </span>
        </button>

        {data && (
          <nav aria-label="Seccions principals" className="main-nav">
            <button
              className={!showDownloads && view === 'group' ? 'active' : ''}
              onClick={() => {
                setView('group')
                setShowDownloads(false)
              }}
              type="button"
            >
              <ChartIcon />
              <span><strong>Grup</strong><small>Visió global</small></span>
            </button>
            <button
              className={!showDownloads && view === 'student' ? 'active' : ''}
              onClick={() => {
                setView('student')
                setShowDownloads(false)
              }}
              type="button"
            >
              <UserShieldIcon />
              <span><strong>Alumnat</strong><small>Fitxa individual</small></span>
            </button>
            <button
              className={showDownloads ? 'active downloads' : ''}
              onClick={() => {
                setView('group')
                setShowDownloads(true)
              }}
              type="button"
            >
              <DownloadIcon />
              <span><strong>Descàrregues</strong><small>PNG i PDF</small></span>
            </button>
          </nav>
        )}

        <button
          className="header-upload"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <UploadIcon />
          <span>{data ? 'Canvia el fitxer' : 'Carrega un Excel'}</span>
        </button>
        <input
          accept=".xlsx,.xls"
          className="visually-hidden"
          onChange={onFileChange}
          ref={inputRef}
          type="file"
        />
      </header>

      <main>
        {!data ? (
          <Welcome
            dragging={dragging}
            error={error}
            loading={loading}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onHelp={() => setShowFileHelp(true)}
            onOpen={() => inputRef.current?.click()}
          />
        ) : (
          <Dashboard
            data={data}
            evaluation={evaluation}
            selectedEvaluations={selectedEvaluations}
            selectedStudent={selectedStudent}
            setEvaluation={setEvaluation}
            setSelectedEvaluations={setSelectedEvaluations}
            setSelectedStudent={setSelectedStudent}
            showDownloads={showDownloads}
            view={view}
          />
        )}
      </main>

      {showFileHelp && <FileHelpModal onClose={() => setShowFileHelp(false)} />}

      <footer className="felip-app-footer">
        <a
          aria-label="Llicència Creative Commons BY-NC-SA 4.0"
          className="felip-license-image-link"
          href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ca"
          rel="noopener noreferrer"
          target="_blank"
        >
          <img
            alt="Creative Commons BY-NC-SA"
            className="felip-license-image"
            src={licenseImage}
          />
        </a>
        <div className="felip-footer-text">
          <p>
            Aplicació creada per{' '}
            <a
              href="https://ja.cat/felipsarroca"
              rel="noopener noreferrer"
              target="_blank"
            >
              Felip Sarroca
            </a>{' '}
            amb assistència de la IA
          </p>
          <p>
            Obra sota llicència{' '}
            <a
              href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ca"
              rel="noopener noreferrer"
              target="_blank"
            >
              CC BY-NC-SA 4.0
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

function Welcome({
  dragging,
  error,
  loading,
  onDragEnter,
  onDragLeave,
  onDrop,
  onHelp,
  onOpen,
}: {
  dragging: boolean
  error: string
  loading: boolean
  onDragEnter: () => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onHelp: () => void
  onOpen: () => void
}) {
  return (
    <section className="welcome">
      <div className="welcome-copy">
        <span className="eyebrow">Dades clares. Decisions informades.</span>
        <h1>Entén l'evolució del grup en pocs segons</h1>
        <p>
          Carrega el resum d'avaluació i obtén automàticament indicadors,
          comparatives i fitxes individuals. Sense enviar cap dada fora del
          navegador.
        </p>
        <div className="privacy-note">
          <span className="privacy-icon">
            <ShieldIcon />
          </span>
          <span>
            <strong>Processament local i privat</strong>
            El fitxer no es desa ni es transmet a cap servidor.
          </span>
        </div>
      </div>

      <div
        className={`drop-zone ${dragging ? 'dragging' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault()
          onDragEnter()
        }}
        onDragLeave={onDragLeave}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        <span className="upload-orbit">
          <UploadIcon />
        </span>
        <h2>{loading ? 'Llegint el fitxer…' : 'Carrega el fitxer Excel'}</h2>
        <p>Arrossega'l aquí o selecciona'l des de l'ordinador</p>
        <button disabled={loading} onClick={onOpen} type="button">
          Selecciona un fitxer
        </button>
        <small>Formats admesos: .xlsx i .xls</small>
        <button className="file-help-trigger" onClick={onHelp} type="button">
          <InfoIcon />
          Com ha de ser el fitxer?
        </button>
        {error && <div className="error-message">{error}</div>}
      </div>

    </section>
  )
}

function FileHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="file-help-title"
        aria-modal="true"
        className="file-help-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">Ajuda per preparar les dades</span>
            <h2 id="file-help-title">Com ha de ser el fitxer Excel?</h2>
          </div>
          <button
            aria-label="Tanca les instruccions"
            className="modal-close"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>

        <p className="modal-intro">
          AvaluApp admet fitxers <strong>.xlsx</strong> i <strong>.xls</strong>.
          Abans de carregar-los, prepara'ls seguint aquests quatre passos.
        </p>

        <div className="modal-steps">
          <article className="instruction-card blue">
            <span className="instruction-icon"><FileIcon /></span>
            <div>
              <small>Pas 1</small>
              <strong>Descarrega les notes</strong>
              <p>Descarrega l'Excel de notes directament des de Clickedu.</p>
            </div>
          </article>
          <article className="instruction-card coral">
            <span className="instruction-icon"><CropIcon /></span>
            <div>
              <small>Pas 2</small>
              <strong>Elimina el que sobra</strong>
              <p>Deixa només les files i columnes de l'alumnat i les matèries.</p>
            </div>
          </article>
          <article className="instruction-card gold">
            <span className="instruction-icon"><RenameIcon /></span>
            <div>
              <small>Pas 3</small>
              <strong>Reanomena les matèries</strong>
              <p>Escriu noms clars: per exemple, CL passa a «Comp. Lectora».</p>
            </div>
          </article>
          <article className="instruction-card green">
            <span className="instruction-icon"><UserShieldIcon /></span>
            <div>
              <small>Pas 4</small>
              <strong>Anonimitza l'alumnat</strong>
              <p>Canvia «Pedrosa, Jaume» per «Jaume P.» abans de carregar-lo.</p>
            </div>
          </article>
        </div>

        <div className="file-format-example">
          <div>
            <h3>Estructura orientativa</h3>
            <p>Una fila per alumne i avaluació, amb una columna per matèria.</p>
          </div>
          <div className="example-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Alumne</th>
                  <th>Avaluació</th>
                  <th>Català</th>
                  <th>Matemàtiques</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Jaume P.</td>
                  <td>1a</td>
                  <td>2,3</td>
                  <td>3.1</td>
                </tr>
                <tr>
                  <td>Jaume P.</td>
                  <td>2a</td>
                  <td>2,8</td>
                  <td>3.4</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="format-note">
            Pots utilitzar decimals amb coma o punt. Les cel·les buides
            s'ignoren i les qualificacions s'interpreten en una escala de 0 a 4.
          </p>
        </div>

        <footer className="modal-actions">
          <button onClick={onClose} type="button">
            Entès, ja puc preparar-lo
          </button>
        </footer>
      </section>
    </div>
  )
}

function Dashboard({
  data,
  evaluation,
  selectedEvaluations,
  selectedStudent,
  setEvaluation,
  setSelectedEvaluations,
  setSelectedStudent,
  showDownloads,
  view,
}: {
  data: EvaluationData
  evaluation: EvaluationId
  selectedEvaluations: EvaluationId[]
  selectedStudent: string
  setEvaluation: (evaluation: EvaluationId) => void
  setSelectedEvaluations: (evaluations: EvaluationId[]) => void
  setSelectedStudent: (student: string) => void
  showDownloads: boolean
  view: View
}) {
  return (
    <section className="dashboard">
      <div className="dashboard-heading">
        <div>
          <span className="file-pill">{data.fileName}</span>
          <h1>
            {showDownloads
              ? 'Centre de descàrregues'
              : view === 'group'
                ? 'Visió general del grup'
                : 'Fitxa individual'}
          </h1>
          <p>
            {showDownloads
              ? 'Exporta informes i gràfiques amb els formats de la carpeta.'
              : `${data.students.length} alumnes · ${data.subjects.length} matèries · ${data.evaluations.length} avaluacions`}
          </p>
        </div>
        <div className="dashboard-controls">
          <div className="filters">
            {!showDownloads && view === 'student' && (
              <label>
                Alumne
                <select
                  onChange={(event) => setSelectedStudent(event.target.value)}
                  value={selectedStudent}
                >
                  {data.students.map((student) => (
                    <option key={student.name}>{student.name}</option>
                  ))}
                </select>
              </label>
            )}
            <EvaluationSelector
              available={data.evaluations}
              selected={selectedEvaluations}
              onChange={(items) => {
                setSelectedEvaluations(items)
                setEvaluation(items.at(-1) ?? evaluation)
              }}
            />
          </div>
        </div>
      </div>

      {data.warnings.length > 0 && (
        <div className="warning">
          <strong>Fitxer processat amb avisos</strong>
          {data.warnings.join(' ')}
        </div>
      )}

      {showDownloads && (
        <>
          <ExportToolbar
            data={data}
            evaluation={evaluation}
            selectedEvaluations={selectedEvaluations}
            selectedStudent={selectedStudent}
            view={view}
          />
          <DownloadCenter
            availableEvaluations={data.evaluations}
            evaluation={evaluation}
            selectedEvaluations={selectedEvaluations}
            studentName={selectedStudent}
            studentsCount={data.students.length}
            view="group"
          />
        </>
      )}

      <div className={showDownloads ? 'report-offstage' : ''} id="current-report">
        {view === 'group' ? (
          <GroupView
            data={data}
            evaluation={evaluation}
            selectedEvaluations={selectedEvaluations}
          />
        ) : (
          <StudentView
            data={data}
            evaluation={evaluation}
            selectedEvaluations={selectedEvaluations}
            studentName={selectedStudent}
          />
        )}
      </div>

      <div aria-hidden="true" className="export-pages">
        {data.students.map((student) => (
          <div key={student.name}>
            <StudentPrintPage
              data={data}
              evaluation={evaluation}
              selectedEvaluations={selectedEvaluations}
              studentName={student.name}
            />
            <StudentChartPrintPage
              data={data}
              evaluation={evaluation}
              kind="radar"
              selectedEvaluations={selectedEvaluations}
              studentName={student.name}
            />
            <StudentChartPrintPage
              data={data}
              evaluation={evaluation}
              kind="evolution"
              selectedEvaluations={selectedEvaluations}
              studentName={student.name}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function EvaluationSelector({
  available,
  onChange,
  selected,
}: {
  available: EvaluationId[]
  onChange: (evaluations: EvaluationId[]) => void
  selected: EvaluationId[]
}) {
  const toggle = (evaluation: EvaluationId) => {
    const next =
      selected.length === 1 && !selected.includes(evaluation)
        ? [evaluation]
        : selected.includes(evaluation)
          ? selected.filter((item) => item !== evaluation)
          : [...selected, evaluation].sort()
    if (next.length > 0) onChange(next)
  }

  return (
    <div className="evaluation-picker">
      <span>Què vols veure?</span>
      <div className="mode-buttons">
        <button
          className={selected.length === 1 ? 'active' : ''}
          onClick={() => onChange([selected.at(-1) ?? available.at(-1) ?? 1])}
          type="button"
        >
          Una avaluació
        </button>
        <button
          className={selected.length > 1 ? 'active' : ''}
          disabled={available.length < 2}
          onClick={() => onChange(available)}
          type="button"
        >
          Comparativa
        </button>
      </div>
      <div className="evaluation-chips">
        {available.map((item) => (
          <button
            aria-pressed={selected.includes(item)}
            className={selected.includes(item) ? 'selected' : ''}
            key={item}
            onClick={() => toggle(item)}
            type="button"
          >
            <span>{item}</span>
            {evaluationLabel(item)} avaluació
          </button>
        ))}
      </div>
    </div>
  )
}

function ExportToolbar({
  data,
  evaluation,
  selectedEvaluations,
  selectedStudent,
  view,
}: {
  data: EvaluationData
  evaluation: EvaluationId
  selectedEvaluations: EvaluationId[]
  selectedStudent: string
  view: View
}) {
  const [exporting, setExporting] = useState('')

  const exportCurrent = async () => {
    const report = document.getElementById('current-report')
    if (!report) return
    setExporting('current')
    try {
      const name =
        view === 'group'
          ? `AvaluApp-grup-${selectedEvaluations.map(evaluationLabel).join('-')}`
          : `AvaluApp-${selectedStudent}-${selectedEvaluations.map(evaluationLabel).join('-')}`
      const pages =
        view === 'student'
          ? Array.from(
              document.querySelectorAll<HTMLElement>('.student-print-page'),
            ).filter((page) => page.dataset.studentName === selectedStudent)
          : Array.from(report.children).filter(
              (element): element is HTMLElement => element instanceof HTMLElement,
            )
      await downloadElementsPdf(pages.length > 0 ? pages : [report], name)
    } finally {
      setExporting('')
    }
  }

  const exportAllStudents = async () => {
    const reports = Array.from(
      document.querySelectorAll<HTMLElement>('.student-print-page'),
    )
    setExporting('all')
    try {
      await downloadElementsPdf(
        reports,
        `AvaluApp-fitxes-alumnat-${evaluationLabel(evaluation)}`,
      )
    } finally {
      setExporting('')
    }
  }

  return (
    <div className="export-toolbar">
      <button
        id="export-current-pdf"
        className="export-button primary"
        disabled={Boolean(exporting)}
        onClick={() => void exportCurrent()}
        type="button"
      >
        <DownloadIcon />
        {exporting === 'current' ? 'Generant…' : 'PDF de la vista'}
      </button>
      <button
        id="export-all-students-pdf"
        className="export-button"
        disabled={Boolean(exporting)}
        onClick={() => void exportAllStudents()}
        type="button"
      >
        <FileIcon />
        {exporting === 'all' ? 'Generant…' : `PDF de ${data.students.length} alumnes`}
      </button>
    </div>
  )
}

function DownloadCenter({
  availableEvaluations,
  evaluation,
  selectedEvaluations,
  studentName,
  studentsCount,
  view,
}: {
  availableEvaluations: EvaluationId[]
  evaluation: EvaluationId
  selectedEvaluations: EvaluationId[]
  studentName: string
  studentsCount: number
  view: View
}) {
  const [exporting, setExporting] = useState('')
  const comparison = selectedEvaluations.length > 1
  const exportChart = async (name: string, fileName: string) => {
    const element = document.querySelector<HTMLElement>(
      `[data-export-name="${name}"]`,
    )
    if (!element) return
    setExporting(name)
    try {
      await downloadElementPng(element, fileName)
    } finally {
      setExporting('')
    }
  }
  const exportStudentCharts = async (kind: 'radar' | 'evolution') => {
    const pages = Array.from(
      document.querySelectorAll<HTMLElement>(
        `.student-chart-print-page[data-kind="${kind}"]`,
      ),
    )
    setExporting(kind)
    try {
      await downloadSvgPagesPdf(
        pages,
        kind === 'radar'
          ? `8-grafica-radar-alumnat-${evaluationLabel(evaluation)}`
          : '9-evolucio-alumnat-respecte-classe',
        kind === 'radar'
          ? 'Perfil per matèries comparat amb la classe'
          : 'Evolució acadèmica comparada amb la classe',
      )
    } finally {
      setExporting('')
    }
  }

  const chartOptions =
    view === 'group'
      ? [
          {
            color: 'blue',
            detail: 'PNG · Rànquing de mitjanes per matèria',
            file: `1-materies-nota-mitjana-${evaluationLabel(evaluation)}`,
            icon: <FileIcon />,
            label: `Mitjana de la ${evaluationLabel(evaluation)} avaluació`,
            name: `mitjana-materies-${evaluationLabel(evaluation)}`,
          },
          {
            color: 'gold',
            detail: 'PNG · Comparació entre avaluacions',
            file: '2-materies-evolucio-mitjanes',
            icon: <RenameIcon />,
            label: 'Evolució de les matèries',
            name: `comparativa-mitjanes-${selectedEvaluations.join('-')}`,
          },
          {
            color: 'coral',
            detail: 'PNG · Suspensos ordenats per matèria',
            file: `3-materies-suspensos-${evaluationLabel(evaluation)}`,
            icon: <CropIcon />,
            label: `Suspensos de la ${evaluationLabel(evaluation)}`,
            name: `suspensos-materies-${evaluationLabel(evaluation)}`,
          },
          {
            color: 'green',
            detail: 'PNG · Comparació de suspensos',
            file: '4-materies-evolucio-suspensos',
            icon: <RenameIcon />,
            label: 'Evolució dels suspensos',
            name: `comparativa-suspensos-${selectedEvaluations.join('-')}`,
          },
          {
            color: 'coral',
            detail: 'PNG · Millora o empitjorament individual',
            file: `5-alumnat-variacio-${evaluationLabel(evaluation)}`,
            icon: <DownloadIcon />,
            label: 'Canvi individual',
            name: `canvi-individual-${evaluationLabel(evaluation)}`,
          },
          {
            color: 'blue',
            detail: 'PNG · Mitjana i posició de cada alumne',
            file: `6-alumnat-nota-mitjana-${evaluationLabel(evaluation)}`,
            icon: <UserShieldIcon />,
            label: 'Situació de l’alumnat',
            name: `situacio-alumnat-${evaluationLabel(evaluation)}`,
          },
          {
            color: 'gold',
            detail: 'PNG · Blocs segons el nombre de suspensos',
            file: `7-alumnat-distribucio-suspensos-${evaluationLabel(evaluation)}`,
            icon: <DownloadIcon />,
            label: 'Distribució de suspensos',
            name: `distribucio-suspensos-${evaluationLabel(evaluation)}`,
          },
        ]
      : []

  return (
    <section className="download-center">
      <header>
        <div className="download-center-icon">
          <DownloadIcon />
        </div>
        <div>
          <span>Catàleg d'exportació</span>
          <h2>Documents i gràfiques preparats per compartir</h2>
          <p>Els formats segueixen l'ordre i el contingut dels fitxers de referència.</p>
        </div>
      </header>
      <div className="download-options">
        <button
          onClick={() => document.getElementById('export-current-pdf')?.click()}
          type="button"
        >
          <span className="download-option-icon blue"><FileIcon /></span>
          <span>
            <strong>
              {view === 'group' ? 'Informe del grup' : `Fitxa de ${studentName}`}
            </strong>
            <small>PDF · Vista i comparatives seleccionades</small>
          </span>
          <b>Baixa</b>
        </button>
        <button
          onClick={() =>
            document.getElementById('export-all-students-pdf')?.click()
          }
          type="button"
        >
          <span className="download-option-icon coral"><UserShieldIcon /></span>
          <span>
            <strong>Dossier de tot l'alumnat</strong>
            <small>PDF · {studentsCount} fitxes individuals</small>
          </span>
          <b>Baixa</b>
        </button>
        <div className="download-info-card">
          <span className="download-option-icon gold"><DownloadIcon /></span>
          <span>
            <strong>Gràfiques individuals</strong>
            <small>PNG · Mitjanes, suspensos, radar i evolució</small>
          </span>
          <b>Icona PNG</b>
        </div>
      </div>
      {view === 'group' && (
        <>
          <div className="download-section-title">
            <strong>Gràfiques generals</strong>
            <span>
              {comparison
                ? 'Les comparatives utilitzen les avaluacions seleccionades.'
                : 'Selecciona dues o tres avaluacions per activar totes les comparatives.'}
            </span>
          </div>
          <div className="download-gallery">
            {chartOptions.map((option, index) => {
              const unavailable =
                option.name.startsWith('comparativa-') && !comparison
              const changeUnavailable =
                option.name.startsWith('canvi-') &&
                !availableEvaluations.some((item) => item < evaluation)
              return (
                <button
                  disabled={
                    Boolean(exporting) || unavailable || changeUnavailable
                  }
                  key={option.file}
                  onClick={() =>
                    void exportChart(option.name, option.file)
                  }
                  type="button"
                >
                  <span className={`download-order ${option.color}`}>{index + 1}</span>
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </span>
                  <b>
                    {exporting === option.name
                      ? 'Generant…'
                      : unavailable || changeUnavailable
                        ? 'No disponible'
                        : 'PNG'}
                  </b>
                </button>
              )
            })}
          </div>
          <div className="download-section-title">
            <strong>Informes individuals de tot l’alumnat</strong>
            <span>Una pàgina clara per alumne, preparada per imprimir.</span>
          </div>
          <div className="download-options student-pdf-options">
            <button
              disabled={Boolean(exporting)}
              onClick={() => void exportStudentCharts('radar')}
              type="button"
            >
              <span className="download-order green">8</span>
              <span>
                <strong>Radars de cada alumne</strong>
                <small>PDF · {studentsCount} pàgines per matèries</small>
              </span>
              <b>{exporting === 'radar' ? 'Generant…' : 'PDF'}</b>
            </button>
            <button
              disabled={Boolean(exporting)}
              onClick={() => void exportStudentCharts('evolution')}
              type="button"
            >
              <span className="download-order blue">9</span>
              <span>
                <strong>Evolució respecte de la classe</strong>
                <small>PDF · {studentsCount} pàgines comparatives</small>
              </span>
              <b>{exporting === 'evolution' ? 'Generant…' : 'PDF'}</b>
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function GroupView({
  data,
  evaluation,
  selectedEvaluations,
}: {
  data: EvaluationData
  evaluation: EvaluationId
  selectedEvaluations: EvaluationId[]
}) {
  const subjects = useMemo(
    () => subjectStats(data, evaluation),
    [data, evaluation],
  )
  const students = useMemo(
    () => studentStats(data, evaluation),
    [data, evaluation],
  )
  const overallMean = classMean(data, evaluation)
  const totalFails = students.reduce((total, student) => total + student.fails, 0)
  const noFails = students.filter((student) => student.fails === 0).length
  const previousEvaluation = selectedEvaluations
    .filter((item) => item < evaluation)
    .at(-1)

  const changes = previousEvaluation
    ? data.students
        .map((student) => {
          const current = studentMean(student, evaluation)
          const previous = studentMean(student, previousEvaluation)
          return {
            label: student.name,
            value:
              current !== null && previous !== null ? current - previous : null,
          }
        })
        .filter(
          (item): item is { label: string; value: number } => item.value !== null,
        )
        .sort((a, b) => a.value - b.value)
    : []

  return (
    <>
      {selectedEvaluations.length > 1 && (
        <>
          <div className="comparison-banner">
            <div>
              <span>Comparativa activa</span>
              <strong>
                {selectedEvaluations.map(evaluationLabel).join(' · ')} avaluacions
              </strong>
            </div>
            <p>
              Els gràfics següents comparen les avaluacions seleccionades amb la
              mateixa escala.
            </p>
          </div>
          <EvaluationSummaryStrip
            data={data}
            evaluations={selectedEvaluations}
          />
        </>
      )}
      <div className="metric-grid">
        <Metric
          detail="amb qualificacions"
          label="Alumnes"
          tone="forest"
          value={students.length.toString()}
        />
        <Metric
          detail={`sobre 4 · ${evaluationLabel(evaluation)} avaluació`}
          label="Mitjana del grup"
          tone="blue"
          value={formatNumber(overallMean)}
        />
        <Metric
          detail="notes inferiors a 2"
          label="Suspensos"
          tone="coral"
          value={totalFails.toString()}
        />
        <Metric
          detail={`${formatNumber((noFails / students.length) * 100, 1)}% del grup`}
          label="Sense suspensos"
          tone="gold"
          value={noFails.toString()}
        />
      </div>

      {selectedEvaluations.length > 1 && (
        <div className="content-grid comparison-grid">
          <Panel
            exportName={`comparativa-mitjanes-${selectedEvaluations.join('-')}`}
            subtitle="Mitjana de cada matèria a les avaluacions seleccionades"
            title="Comparativa de rendiment per matèries"
          >
            <GroupedSubjectChart
              data={data}
              evaluations={selectedEvaluations}
              metric="mean"
            />
          </Panel>
          <Panel
            exportName={`comparativa-suspensos-${selectedEvaluations.join('-')}`}
            subtitle="Evolució del nombre de suspensos per matèria"
            title="Comparativa de suspensos"
          >
            <GroupedSubjectChart
              data={data}
              evaluations={selectedEvaluations}
              metric="fails"
            />
          </Panel>
        </div>
      )}

      <div className="content-grid">
        <Panel
          exportName={`mitjana-materies-${evaluationLabel(evaluation)}`}
          subtitle={`Mitjana per matèria · ${evaluationLabel(evaluation)} avaluació`}
          title="Rànquing de matèries segons la nota mitjana"
        >
          <HorizontalBars
            benchmark={overallMean}
            data={subjects
              .filter((subject) => subject.mean !== null)
              .sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0))
              .map((subject) => ({
                label: subject.subject,
                value: subject.mean ?? 0,
              }))}
            max={4}
          />
        </Panel>

        <Panel
          exportName={`suspensos-materies-${evaluationLabel(evaluation)}`}
          subtitle="Nombre de qualificacions inferiors a 2"
          title="Suspensos per matèria"
        >
          <HorizontalBars
            data={subjects
              .sort((a, b) => b.fails - a.fails)
              .map((subject) => ({
                label: subject.subject,
                value: subject.fails,
              }))}
            integer
            max={Math.max(...subjects.map((subject) => subject.fails), 1)}
            tone="coral"
          />
        </Panel>
      </div>

      <div className="content-grid">
        <Panel
          exportName="evolucio-mitjana-grup"
          subtitle="Comparació de les mitjanes disponibles"
          title="Evolució del grup"
        >
          <EvolutionChart data={data} evaluations={selectedEvaluations} />
        </Panel>

        {previousEvaluation ? (
          <Panel
            exportName={`canvi-individual-${evaluationLabel(evaluation)}`}
            subtitle={`${evaluationLabel(evaluation)} respecte de ${evaluationLabel(previousEvaluation)}`}
            title="Canvi individual"
          >
            <DivergingBars data={changes} />
          </Panel>
        ) : (
          <Panel
            subtitle="Disponible a partir de la segona avaluació"
            title="Canvi individual"
          >
            <EmptyComparison />
          </Panel>
        )}
      </div>

      <Panel
        exportName={`situacio-alumnat-${evaluationLabel(evaluation)}`}
        subtitle={`Ordenació segons la mitjana de la ${evaluationLabel(evaluation)} avaluació`}
        title="Situació de l'alumnat"
      >
        <StudentRanking
          benchmark={overallMean}
          students={[...students].sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0))}
        />
      </Panel>

      <Panel
        exportName={`distribucio-suspensos-${evaluationLabel(evaluation)}`}
        subtitle={`Blocs de suspensos · ${evaluationLabel(evaluation)} avaluació`}
        title="Distribució de l'alumnat segons els suspensos"
      >
        <FailDistribution students={students} />
      </Panel>
    </>
  )
}

function StudentView({
  data,
  evaluation,
  selectedEvaluations,
  studentName,
}: {
  data: EvaluationData
  evaluation: EvaluationId
  selectedEvaluations: EvaluationId[]
  studentName: string
}) {
  const student = data.students.find((item) => item.name === studentName)
  if (!student) return null

  const grades = student.evaluations[evaluation] ?? []
  const values = validGrades(grades)
  const average = studentMean(student, evaluation)
  const groupAverage = classMean(data, evaluation)
  const fails = values.filter((grade) => grade < 2).length
  const previousEvaluation = selectedEvaluations
    .filter((item) => item < evaluation)
    .at(-1)
  const previousAverage = previousEvaluation
    ? studentMean(student, previousEvaluation)
    : null
  const variation =
    average !== null && previousAverage !== null ? average - previousAverage : null
  const classSubjects = subjectStats(data, evaluation)

  return (
    <>
      <div className="student-banner">
        <div className="student-avatar">
          {student.name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)}
        </div>
        <div>
          <span>Fitxa acadèmica</span>
          <h2>{student.name}</h2>
        </div>
      </div>

      <div className="metric-grid">
        <Metric
          detail={`${evaluationLabel(evaluation)} avaluació`}
          label="Mitjana personal"
          tone="forest"
          value={formatNumber(average)}
        />
        <Metric
          detail={average !== null && groupAverage !== null && average >= groupAverage ? 'per sobre del grup' : 'per sota del grup'}
          label="Diferència amb el grup"
          tone="blue"
          value={
            average !== null && groupAverage !== null
              ? `${average - groupAverage >= 0 ? '+' : ''}${formatNumber(average - groupAverage)}`
              : '—'
          }
        />
        <Metric
          detail="qualificacions inferiors a 2"
          label="Suspensos"
          tone="coral"
          value={fails.toString()}
        />
        <Metric
          detail={
            previousEvaluation
              ? `respecte de ${evaluationLabel(previousEvaluation)}`
              : 'encara sense comparativa'
          }
          label="Variació"
          tone="gold"
          value={
            variation === null
              ? '—'
              : `${variation >= 0 ? '+' : ''}${formatNumber(variation)}`
          }
        />
      </div>

      <div className="content-grid student-charts">
        <Panel
          exportName={`radar-${student.name}-${evaluationLabel(evaluation)}`}
          subtitle={
            selectedEvaluations.length > 1
              ? 'Comparació de les avaluacions seleccionades'
              : `${student.name} i mitjana del grup`
          }
          title="Perfil per matèries"
        >
          {selectedEvaluations.length > 1 ? (
            <MultiRadarChart
              evaluations={selectedEvaluations}
              labels={data.subjects}
              student={student}
            />
          ) : (
            <RadarChart
              labels={data.subjects}
              primary={grades}
              secondary={classSubjects.map((subject) => subject.mean)}
            />
          )}
        </Panel>
        <Panel
          exportName={`evolucio-${student.name}`}
          subtitle="Mitjana personal comparada amb el grup"
          title="Evolució durant el curs"
        >
          <StudentEvolution
            data={data}
            evaluations={selectedEvaluations}
            studentName={studentName}
          />
        </Panel>
      </div>

      <Panel
        exportName={`evolucio-materies-${student.name}`}
        subtitle="Tria una matèria per veure'n l'evolució i comparar-la amb el grup"
        title="Evolució per matèria"
      >
        <SubjectEvolutionExplorer
          data={data}
          evaluations={selectedEvaluations}
          studentName={studentName}
        />
      </Panel>

      <Panel
        subtitle={
          selectedEvaluations.length > 1
            ? `Comparació de ${selectedEvaluations.map(evaluationLabel).join(', ')}`
            : `Detall de la ${evaluationLabel(evaluation)} avaluació`
        }
        title="Qualificacions per matèria i avaluació"
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Matèria</th>
                {selectedEvaluations.map((item) => (
                  <th key={item}>{evaluationLabel(item)}</th>
                ))}
                <th>Última mitjana del grup</th>
                {selectedEvaluations.length > 1 && <th>Evolució</th>}
              </tr>
            </thead>
            <tbody>
              {data.subjects.map((subject, index) => {
                const subjectMean = classSubjects[index]?.mean ?? null
                const firstGrade =
                  student.evaluations[selectedEvaluations[0]]?.[index] ?? null
                const lastGrade =
                  student.evaluations[selectedEvaluations.at(-1) ?? evaluation]?.[
                    index
                  ] ?? null
                const change =
                  firstGrade !== null && lastGrade !== null
                    ? lastGrade - firstGrade
                    : null
                return (
                  <tr key={subject}>
                    <td>{subject}</td>
                    {selectedEvaluations.map((item) => (
                      <td key={item}>
                        <GradeBadge
                          value={student.evaluations[item]?.[index] ?? null}
                        />
                      </td>
                    ))}
                    <td>{formatNumber(subjectMean)}</td>
                    {selectedEvaluations.length > 1 && (
                      <td>
                        <Delta value={change} />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}

function Metric({
  detail,
  label,
  tone,
  value,
}: {
  detail: string
  label: string
  tone: string
  value: string
}) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function EvaluationSummaryStrip({
  data,
  evaluations,
}: {
  data: EvaluationData
  evaluations: EvaluationId[]
}) {
  return (
    <div className="evaluation-summary-strip">
      {evaluations.map((item, index) => {
        const students = studentStats(data, item)
        const fails = students.reduce(
          (total, student) => total + student.fails,
          0,
        )
        const noFails = students.filter((student) => student.fails === 0).length
        const previous = evaluations[index - 1]
        const variation =
          previous === undefined
            ? null
            : (classMean(data, item) ?? 0) - (classMean(data, previous) ?? 0)
        return (
          <article key={item}>
            <span>{evaluationLabel(item)} avaluació</span>
            <strong>{formatNumber(classMean(data, item))}</strong>
            <small>
              {fails} suspensos · {noFails} alumnes sense suspensos
            </small>
            {variation !== null && (
              <b className={variation >= 0 ? 'up' : 'down'}>
                {variation >= 0 ? '↑' : '↓'} {variation >= 0 ? '+' : ''}
                {formatNumber(variation)}
              </b>
            )}
          </article>
        )
      })}
    </div>
  )
}

function StudentPrintPage({
  data,
  evaluation,
  selectedEvaluations,
  studentName,
}: {
  data: EvaluationData
  evaluation: EvaluationId
  selectedEvaluations: EvaluationId[]
  studentName: string
}) {
  const student = data.students.find((item) => item.name === studentName)
  if (!student) return null
  const grades = student.evaluations[evaluation] ?? []
  const average = studentMean(student, evaluation)
  const groupAverage = classMean(data, evaluation)
  const fails = validGrades(grades).filter((grade) => grade < 2).length
  const classSubjects = subjectStats(data, evaluation)

  return (
    <article className="student-print-page" data-student-name={studentName}>
      <header className="print-header">
        <div className="brand-mark">A</div>
        <div>
          <span>AvaluApp · Informe individual</span>
          <h2>{student.name}</h2>
        </div>
        <strong>{selectedEvaluations.map(evaluationLabel).join(' · ')}</strong>
      </header>
      <div className="print-metrics">
        <div><span>Mitjana personal</span><strong>{formatNumber(average)}</strong></div>
        <div><span>Mitjana del grup</span><strong>{formatNumber(groupAverage)}</strong></div>
        <div><span>Suspensos</span><strong>{fails}</strong></div>
      </div>
      <div className="print-charts">
        <section>
          <h3>Perfil per matèries</h3>
          {selectedEvaluations.length > 1 ? (
            <MultiRadarChart
              evaluations={selectedEvaluations}
              labels={data.subjects}
              student={student}
            />
          ) : (
            <RadarChart
              labels={data.subjects}
              primary={grades}
              secondary={classSubjects.map((subject) => subject.mean)}
            />
          )}
        </section>
        <section>
          <h3>Evolució comparada</h3>
          <StudentEvolution
            data={data}
            evaluations={selectedEvaluations}
            studentName={studentName}
          />
        </section>
      </div>
      <div className="print-grade-grid">
        {data.subjects.map((subject, index) => (
          <div key={subject}>
            <span>{subject}</span>
            <GradeBadge value={grades[index] ?? null} />
          </div>
        ))}
      </div>
    </article>
  )
}

function StudentChartPrintPage({
  data,
  evaluation,
  kind,
  selectedEvaluations,
  studentName,
}: {
  data: EvaluationData
  evaluation: EvaluationId
  kind: 'radar' | 'evolution'
  selectedEvaluations: EvaluationId[]
  studentName: string
}) {
  const student = data.students.find((item) => item.name === studentName)
  if (!student) return null
  const classSubjects = subjectStats(data, evaluation)

  return (
    <article
      className="student-chart-print-page"
      data-kind={kind}
      data-student-name={studentName}
    >
      <header className="chart-print-header">
        <h2>{studentName}</h2>
      </header>
      <div className="chart-print-content">
        <h3>
          {kind === 'radar'
            ? 'Perfil per matèries comparat amb la classe'
            : 'Evolució acadèmica comparada amb la classe'}
        </h3>
        {kind === 'radar' ? (
          selectedEvaluations.length > 1 ? (
            <MultiRadarChart
              evaluations={selectedEvaluations}
              labels={data.subjects}
              student={student}
            />
          ) : (
            <RadarChart
              labels={data.subjects}
              primary={student.evaluations[evaluation] ?? []}
              secondary={classSubjects.map((subject) => subject.mean)}
            />
          )
        ) : (
          <StudentEvolution
            data={data}
            evaluations={data.evaluations}
            studentName={studentName}
          />
        )}
      </div>
    </article>
  )
}

function Panel({
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

function HorizontalBars({
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

function GroupedSubjectChart({
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

function EvolutionChart({
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

function StudentEvolution({
  data,
  evaluations = data.evaluations,
  studentName,
}: {
  data: EvaluationData
  evaluations?: EvaluationId[]
  studentName: string
}) {
  const student = data.students.find((item) => item.name === studentName)
  if (!student) return null
  return (
    <LineSvg
      labels={evaluations.map(evaluationLabel)}
      max={4}
      min={1.5}
      tickStep={0.5}
      lines={[
        {
          color: '#1f77b4',
          name: student.name,
          values: evaluations.map((item) => studentMean(student, item)),
        },
        {
          color: '#ff7f0e',
          name: 'Mitjana del grup',
          values: evaluations.map((item) => classMean(data, item)),
        },
      ]}
    />
  )
}

function LineSvg({
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
  const left = 48
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
            <text x={left - 12} y={y(tick) + 4}>
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

function DivergingBars({
  data,
}: {
  data: Array<{ label: string; value: number }>
}) {
  const visible =
    data.length > 18
      ? [...data.slice(0, 9), ...data.slice(-9)]
      : data
  const max = Math.max(...visible.map((item) => Math.abs(item.value)), 0.1)
  return (
    <div className="diverging-bars">
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

function EmptyComparison() {
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

function StudentRanking({
  benchmark,
  students,
}: {
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
              <strong className="ranking-name">{student.name}</strong>
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

function FailDistribution({
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

function RadarChart({
  labels,
  primary,
  secondary,
}: {
  labels: string[]
  primary: Array<number | null>
  secondary: Array<number | null>
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
    values
      .map((value, index) => point(index, value ?? 0).join(','))
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
        <polygon
          className="radar-secondary"
          points={polygon(secondary)}
        />
        <polygon className="radar-primary" points={polygon(primary)} />
      </svg>
      <div className="chart-legend">
        <span>
          <i style={{ background: '#1f77b4' }} />
          Alumne
        </span>
        <span>
          <i style={{ background: '#ff7f0e' }} />
          Mitjana del grup
        </span>
      </div>
    </div>
  )
}

function MultiRadarChart({
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

function SubjectEvolutionExplorer({
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

function GradeBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="grade-badge empty">—</span>
  const tone = value < 2 ? 'fail' : value < 3 ? 'pass' : 'high'
  return <span className={`grade-badge ${tone}`}>{formatNumber(value, 1)}</span>
}

function Delta({ value }: { value: number | null }) {
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

export default App
