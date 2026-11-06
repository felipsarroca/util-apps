import {
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './App.css'
import './features.css'
import licenseImage from './assets/CC_BY-NC-SA.png'
import {
  downloadElementPng,
  downloadElementsPdf,
  downloadSvgPagesPdf,
  downloadWorkbook,
} from './export'
import {
  classMean,
  evaluationLabel,
  createDemoData,
  type EvaluationData,
  type EvaluationId,
  formatNumber,
  formatSigned,
  parseWorkbook,
  PASS_MARK,
  studentInsight,
  studentMean,
  studentStats,
  subjectStats,
  validGrades,
} from './data'
import {
  ChartIcon,
  CloseIcon,
  CropIcon,
  DownloadIcon,
  FileIcon,
  InfoIcon,
  RenameIcon,
  ShieldIcon,
  UploadIcon,
  UserShieldIcon,
} from './icons'
import {
  Delta,
  DivergingBars,
  EmptyComparison,
  EvolutionChart,
  FailDistribution,
  GradeBadge,
  GroupedSubjectChart,
  HorizontalBars,
  LevelDistribution,
  LevelLegend,
  MultiRadarChart,
  Panel,
  RadarChart,
  StudentEvolution,
  StudentRanking,
  SubjectEvolutionExplorer,
} from './charts'
import { JuntaPrintPages, JuntaView } from './JuntaView'
import { juntaWorkbook } from './junta'
import { FamilyReportPage, ReportSettingsPanel } from './FamilyReport'
import {
  emptyNotes,
  hasNotes,
  loadSettings,
  type NotesMap,
  type ReportSettings,
  saveSettings,
  type StudentNotes,
} from './settings'

type View = 'group' | 'junta' | 'student' | 'downloads'

type PrintJob =
  | { kind: 'family'; names: string[]; fileName: string }
  | { kind: 'acta'; fileName: string }

/** Avaluació disponible immediatament anterior a la indicada. */
const previousOf = (data: EvaluationData, evaluation: EvaluationId) =>
  data.evaluations.filter((item) => item < evaluation).at(-1)

/**
 * Escala la interfície en pantalles d'ordinador petites (com edu-apps/Equacions):
 * el disseny de referència és de 1440 × 800 px útils (amb escalat del sistema
 * del 125 % o 150 %, un portàtil de 1366 × 768 en té molts menys). Per sota de
 * 1000 px d'amplada o amb pantalla tàctil no s'escala.
 */
function useFitScale() {
  useEffect(() => {
    const BASE_W = 1440
    const BASE_H = 800
    const MIN_ZOOM = 0.75
    const MIN_DESKTOP_W = 1000
    const finePointer = window.matchMedia('(pointer: fine)')
    const fit = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      let zoom = Math.min(1, width / BASE_W, height / BASE_H)
      zoom = Math.max(MIN_ZOOM, Math.floor(zoom * 20) / 20)
      // En tauletes, mòbils i finestres estretes s'usa la disposició responsiva.
      if (width < MIN_DESKTOP_W || !finePointer.matches) zoom = 1
      document.documentElement.style.setProperty('--ui-zoom', String(zoom))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
}

async function downloadTemplate() {
  await downloadWorkbook(
    [
      {
        name: 'Notes',
        rows: [
          ['Alumne', 'Avaluació', 'Català', 'Castellà', 'Anglès', 'Matemàtiques', 'Socials'],
          ['Jaume P.', '1a', 3, 2, 4, 1, 3],
          ['', '2a', 3, 3, 4, 2, 3],
          ['Laia M.', '1a', 2, 2, 3, 2, 1],
          ['', '2a', 3, 2, 3, 2, 2],
        ],
        widths: [16, 11, 10, 10, 10, 14, 10],
      },
    ],
    'plantilla-avaluapp',
  )
}

function App() {
  const [data, setData] = useState<EvaluationData | null>(null)
  const [view, setView] = useState<View>('group')
  const [evaluation, setEvaluation] = useState<EvaluationId>(1)
  const [selectedEvaluations, setSelectedEvaluations] = useState<EvaluationId[]>([1])
  const [selectedStudent, setSelectedStudent] = useState('')
  const [notes, setNotes] = useState<NotesMap>({})
  const [settings, setSettings] = useState<ReportSettings>(loadSettings)
  const [showFileHelp, setShowFileHelp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useFitScale()

  useEffect(() => saveSettings(settings), [settings])

  // Les anotacions només viuen en memòria: avisa abans de tancar la pestanya.
  useEffect(() => {
    if (!hasNotes(notes)) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [notes])

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

  const openData = (parsed: EvaluationData) => {
    const latest = parsed.evaluations.at(-1) ?? 1
    setData(parsed)
    setEvaluation(latest)
    setSelectedEvaluations([latest])
    setSelectedStudent(parsed.students[0]?.name ?? '')
    setView('group')
    window.scrollTo({ top: 0 })
  }

  const loadFile = async (file?: File) => {
    if (!file) return
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setError("Cal seleccionar un fitxer d'Excel amb extensió .xlsx o .xls.")
      return
    }

    setLoading(true)
    setError('')
    try {
      openData(await parseWorkbook(file))
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

  const updateNote = useCallback((name: string, value: StudentNotes) => {
    setNotes((previous) => ({ ...previous, [name]: value }))
  }, [])

  const openStudent = useCallback((name: string) => {
    setSelectedStudent(name)
    setView('student')
    window.scrollTo({ top: 0 })
  }, [])

  const navItems: Array<{ id: View; label: string; detail: string; icon: ReactNode }> = [
    { id: 'group', label: 'Grup', detail: 'Visió global', icon: <ChartIcon /> },
    { id: 'junta', label: 'Junta', detail: 'Preparació', icon: <FileIcon /> },
    { id: 'student', label: 'Alumnat', detail: 'Fitxa individual', icon: <UserShieldIcon /> },
    { id: 'downloads', label: 'Descàrregues', detail: 'PDF, PNG i Excel', icon: <DownloadIcon /> },
  ]

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
            {navItems.map((item) => (
              <button
                aria-current={view === item.id ? 'page' : undefined}
                className={view === item.id ? `active ${item.id}` : ''}
                key={item.id}
                onClick={() => {
                  setView(item.id)
                  window.scrollTo({ top: 0 })
                }}
                type="button"
              >
                {item.icon}
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              </button>
            ))}
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
            onDemo={() => openData(createDemoData())}
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
            notes={notes}
            onNote={updateNote}
            onOpenStudent={openStudent}
            selectedEvaluations={selectedEvaluations}
            selectedStudent={selectedStudent}
            setEvaluation={setEvaluation}
            setSelectedEvaluations={setSelectedEvaluations}
            setSelectedStudent={setSelectedStudent}
            setSettings={setSettings}
            settings={settings}
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
  onDemo,
  onDragEnter,
  onDragLeave,
  onDrop,
  onHelp,
  onOpen,
}: {
  dragging: boolean
  error: string
  loading: boolean
  onDemo: () => void
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
        <h1>Prepara la junta i informa les famílies en pocs minuts</h1>
        <p>
          Carrega el resum d'avaluació i obtén la graella de la junta amb alertes,
          el resum per a l'acta, les fitxes individuals i un informe clar per a
          cada família. Sense enviar cap dada fora del navegador.
        </p>
        <ul className="welcome-steps">
          <li><b>1</b> Analitza el grup i detecta qui necessita seguiment.</li>
          <li><b>2</b> Anota els acords de la junta i el missatge per a cada família.</li>
          <li><b>3</b> Baixa l'acta, la graella en Excel i els informes per a les famílies.</li>
        </ul>
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
        <div className="welcome-links">
          <button className="file-help-trigger" onClick={onHelp} type="button">
            <InfoIcon />
            Com ha de ser el fitxer?
          </button>
          <button className="file-help-trigger" onClick={onDemo} type="button">
            <ChartIcon />
            Prova-ho amb dades d'exemple
          </button>
        </div>
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
          <button className="secondary" onClick={() => void downloadTemplate()} type="button">
            Baixa una plantilla Excel
          </button>
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
  notes,
  onNote,
  onOpenStudent,
  selectedEvaluations,
  selectedStudent,
  setEvaluation,
  setSelectedEvaluations,
  setSelectedStudent,
  setSettings,
  settings,
  view,
}: {
  data: EvaluationData
  evaluation: EvaluationId
  notes: NotesMap
  onNote: (name: string, notes: StudentNotes) => void
  onOpenStudent: (name: string) => void
  selectedEvaluations: EvaluationId[]
  selectedStudent: string
  setEvaluation: (evaluation: EvaluationId) => void
  setSelectedEvaluations: (evaluations: EvaluationId[]) => void
  setSelectedStudent: (student: string) => void
  setSettings: (settings: ReportSettings) => void
  settings: ReportSettings
  view: View
}) {
  const [job, setJob] = useState<PrintJob | null>(null)
  const [progress, setProgress] = useState('')
  const [jobError, setJobError] = useState('')
  const stageRef = useRef<HTMLDivElement>(null)
  const startedJob = useRef<PrintJob | null>(null)
  const previous = previousOf(data, evaluation)
  const studentIndex = data.students.findIndex((item) => item.name === selectedStudent)

  const stepStudent = useCallback(
    (step: number) => {
      const next = data.students[(studentIndex + step + data.students.length) % data.students.length]
      if (next) setSelectedStudent(next.name)
    },
    [data.students, setSelectedStudent, studentIndex],
  )

  // Fletxes del teclat per passar d'alumne durant la junta.
  useEffect(() => {
    if (view !== 'student') return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.key === 'ArrowRight') stepStudent(1)
      if (event.key === 'ArrowLeft') stepStudent(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stepStudent, view])

  // Les pàgines dels PDF es munten només quan cal i després es capturen.
  useEffect(() => {
    if (!job || startedJob.current === job) return
    startedJob.current = job
    const run = async () => {
      await document.fonts?.ready
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const pages = Array.from(
        stageRef.current?.querySelectorAll<HTMLElement>('.family-report-page, .acta-page') ?? [],
      )
      const onProgress = (done: number, total: number) =>
        setProgress(total > 1 ? `${done} de ${total} pàgines` : '')
      await downloadElementsPdf(
        pages,
        job.fileName,
        job.kind === 'acta'
          ? { orientation: 'landscape', scale: 1.6, quality: 0.9, margin: 0, onProgress }
          : { scale: pages.length > 8 ? 1.45 : 1.8, quality: 0.86, margin: 0, onProgress },
      )
    }
    setJobError('')
    run()
      .catch(() => setJobError("No s'ha pogut generar el PDF. Torna-ho a provar."))
      .finally(() => {
        startedJob.current = null
        setJob(null)
        setProgress('')
      })
  }, [job])

  const heading = settings.grup || data.fileName.replace(/\.(xlsx|xls)$/i, '')
  const requestFamily = (names: string[]) =>
    setJob({
      kind: 'family',
      names,
      fileName:
        names.length === 1
          ? `informe-${names[0]}-${evaluationLabel(evaluation)}-avaluacio`
          : `informes-families-${evaluationLabel(evaluation)}-avaluacio`,
    })
  const requestActa = () =>
    setJob({ kind: 'acta', fileName: `acta-junta-${evaluationLabel(evaluation)}-avaluacio` })
  const exportJuntaExcel = () =>
    void downloadWorkbook(
      juntaWorkbook(data, evaluation, notes, previous),
      `junta-${evaluationLabel(evaluation)}-avaluacio`,
    )

  const titles: Record<View, [string, string]> = {
    group: ['Visió general del grup', `${data.students.length} alumnes · ${data.subjects.length} matèries · ${data.evaluations.length} avaluacions`],
    junta: ["Preparació de la junta d'avaluació", previous ? `${evaluationLabel(evaluation)} avaluació comparada amb la ${evaluationLabel(previous)}` : `${evaluationLabel(evaluation)} avaluació`],
    student: ['Fitxa individual', `Alumne ${studentIndex + 1} de ${data.students.length} · usa les fletxes ← → del teclat per canviar d'alumne`],
    downloads: ['Centre de descàrregues', "Acta i graella de la junta, informes per a les famílies i gràfiques del grup."],
  }
  const singleEvaluation = view === 'junta' || view === 'downloads'

  return (
    <section className="dashboard">
      <div className="dashboard-heading">
        <div>
          <span className="file-pill">{data.fileName}</span>
          <h1>{titles[view][0]}</h1>
          <p>{titles[view][1]}</p>
        </div>
        <div className="dashboard-controls">
          <div className="filters">
            {view === 'student' && (
              <div className="student-picker">
                <span>Alumne</span>
                <div>
                  <button aria-label="Alumne anterior" onClick={() => stepStudent(-1)} type="button">
                    ←
                  </button>
                  <select
                    aria-label="Alumne"
                    onChange={(event) => setSelectedStudent(event.target.value)}
                    value={selectedStudent}
                  >
                    {data.students.map((student) => (
                      <option key={student.name}>{student.name}</option>
                    ))}
                  </select>
                  <button aria-label="Alumne següent" onClick={() => stepStudent(1)} type="button">
                    →
                  </button>
                </div>
              </div>
            )}
            <EvaluationSelector
              available={data.evaluations}
              selected={singleEvaluation ? [evaluation] : selectedEvaluations}
              single={singleEvaluation}
              onChange={(items) => {
                setSelectedEvaluations(items)
                setEvaluation(items.at(-1) ?? evaluation)
              }}
            />
          </div>
          {view === 'junta' && (
            <div className="heading-actions">
              <button className="export-button" onClick={exportJuntaExcel} type="button">
                <FileIcon /> Excel
              </button>
              <button className="export-button primary" disabled={Boolean(job)} onClick={requestActa} type="button">
                <DownloadIcon /> {job?.kind === 'acta' ? 'Generant…' : 'Acta en PDF'}
              </button>
            </div>
          )}
        </div>
      </div>

      {data.warnings.length > 0 && (
        <div className="warning">
          <strong>Fitxer processat amb avisos</strong>
          {data.warnings.join(' ')}
        </div>
      )}

      {view === 'downloads' && (
        <DownloadCenter
          data={data}
          evaluation={evaluation}
          job={job}
          onActa={requestActa}
          onFamily={requestFamily}
          onJuntaExcel={exportJuntaExcel}
          selectedEvaluations={selectedEvaluations}
          setSettings={setSettings}
          settings={settings}
        />
      )}

      {view === 'junta' && (
        <JuntaView
          data={data}
          evaluation={evaluation}
          notes={notes}
          onNote={onNote}
          onOpenStudent={onOpenStudent}
          previous={previous}
        />
      )}

      {(view === 'group' || view === 'downloads') && (
        <div className={view === 'downloads' ? 'report-offstage' : ''} id="current-report">
          <GroupView
            data={data}
            evaluation={evaluation}
            onOpenStudent={view === 'group' ? onOpenStudent : undefined}
            selectedEvaluations={selectedEvaluations}
          />
        </div>
      )}

      {view === 'student' && (
        <StudentView
          busy={Boolean(job)}
          data={data}
          evaluation={evaluation}
          notes={notes[selectedStudent] ?? emptyNotes}
          onFamilyPdf={() => requestFamily([selectedStudent])}
          onNote={(value) => onNote(selectedStudent, value)}
          previous={previous}
          selectedEvaluations={selectedEvaluations}
          setSettings={setSettings}
          settings={settings}
          studentName={selectedStudent}
        />
      )}

      {view === 'downloads' && (
        <ChartPages
          data={data}
          evaluation={evaluation}
          selectedEvaluations={selectedEvaluations}
        />
      )}

      {job && (
        <div aria-hidden="true" className="print-stage" ref={stageRef}>
          {job.kind === 'family'
            ? job.names.map((name) => (
                <FamilyReportPage
                  data={data}
                  evaluation={evaluation}
                  key={name}
                  notes={notes[name] ?? emptyNotes}
                  settings={settings}
                  studentName={name}
                />
              ))
            : (
                <JuntaPrintPages
                  data={data}
                  evaluation={evaluation}
                  heading={heading}
                  notes={notes}
                  previous={previous}
                />
              )}
        </div>
      )}

      {!job && jobError && (
        <div className="job-toast error" role="alert">
          {jobError}
          <button aria-label="Tanca l'avís" onClick={() => setJobError('')} type="button">
            <CloseIcon />
          </button>
        </div>
      )}

      {job && (
        <div className="job-toast" role="status">
          <span className="spinner" aria-hidden="true" />
          Generant el PDF{progress ? ` · ${progress}` : '…'}
        </div>
      )}
    </section>
  )
}

const ChartPages = memo(function ChartPages({
  data,
  evaluation,
  selectedEvaluations,
}: {
  data: EvaluationData
  evaluation: EvaluationId
  selectedEvaluations: EvaluationId[]
}) {
  return (
    <div aria-hidden="true" className="export-pages">
      {data.students.map((student) => (
        <div key={student.name}>
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
  )
})

function EvaluationSelector({
  available,
  onChange,
  selected,
  single = false,
}: {
  available: EvaluationId[]
  onChange: (evaluations: EvaluationId[]) => void
  selected: EvaluationId[]
  single?: boolean
}) {
  const toggle = (evaluation: EvaluationId) => {
    if (single) {
      onChange([evaluation])
      return
    }
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
      <span>{single ? 'Avaluació' : 'Què vols veure?'}</span>
      {!single && (
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
      )}
      <div className="evaluation-chips">
        {available.map((item) => (
          <button
            aria-pressed={single ? selected.at(-1) === item : selected.includes(item)}
            className={(single ? selected.at(-1) === item : selected.includes(item)) ? 'selected' : ''}
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


function DownloadCenter({
  data,
  evaluation,
  job,
  onActa,
  onFamily,
  onJuntaExcel,
  selectedEvaluations,
  setSettings,
  settings,
}: {
  data: EvaluationData
  evaluation: EvaluationId
  job: PrintJob | null
  onActa: () => void
  onFamily: (names: string[]) => void
  onJuntaExcel: () => void
  selectedEvaluations: EvaluationId[]
  setSettings: (settings: ReportSettings) => void
  settings: ReportSettings
}) {
  const [exporting, setExporting] = useState('')
  const [familyStudent, setFamilyStudent] = useState(data.students[0]?.name ?? '')
  const busy = Boolean(exporting) || Boolean(job)
  const comparison = selectedEvaluations.length > 1
  const studentsCount = data.students.length
  const availableEvaluations = data.evaluations

  const run = async (name: string, task: () => Promise<void>) => {
    setExporting(name)
    try {
      await task()
    } finally {
      setExporting('')
    }
  }

  const exportChart = (name: string, fileName: string) => {
    const element = document.querySelector<HTMLElement>(`[data-export-name="${name}"]`)
    if (!element) return
    void run(name, () => downloadElementPng(element, fileName))
  }

  const exportGroupReport = () => {
    const report = document.getElementById('current-report')
    if (!report) return
    const pages = Array.from(report.querySelectorAll<HTMLElement>(':scope > *'))
    void run('group', () =>
      downloadElementsPdf(
        pages.length > 0 ? pages : [report],
        `AvaluApp-grup-${selectedEvaluations.map(evaluationLabel).join('-')}`,
      ),
    )
  }

  const exportStudentCharts = (kind: 'radar' | 'evolution') => {
    const pages = Array.from(
      document.querySelectorAll<HTMLElement>(`.student-chart-print-page[data-kind="${kind}"]`),
    )
    void run(kind, () =>
      downloadSvgPagesPdf(
        pages,
        kind === 'radar'
          ? `9-grafica-radar-alumnat-${evaluationLabel(evaluation)}`
          : '10-evolucio-alumnat-respecte-classe',
        kind === 'radar'
          ? 'Perfil per matèries comparat amb la classe'
          : 'Evolució acadèmica comparada amb la classe',
      ),
    )
  }

  const label = evaluationLabel(evaluation)
  const chartOptions = [
    { color: 'blue', detail: 'PNG · Rànquing de mitjanes per matèria', file: `1-materies-nota-mitjana-${label}`, label: `Mitjana de la ${label} avaluació`, name: `mitjana-materies-${label}` },
    { color: 'gold', detail: 'PNG · Comparació entre avaluacions', file: '2-materies-evolucio-mitjanes', label: 'Evolució de les matèries', name: `comparativa-mitjanes-${selectedEvaluations.join('-')}` },
    { color: 'coral', detail: 'PNG · Suspensos ordenats per matèria', file: `3-materies-suspensos-${label}`, label: `Suspensos de la ${label}`, name: `suspensos-materies-${label}` },
    { color: 'green', detail: 'PNG · Comparació de suspensos', file: '4-materies-evolucio-suspensos', label: 'Evolució dels suspensos', name: `comparativa-suspensos-${selectedEvaluations.join('-')}` },
    { color: 'coral', detail: 'PNG · Millora o empitjorament individual', file: `5-alumnat-variacio-${label}`, label: 'Canvi individual', name: `canvi-individual-${label}` },
    { color: 'blue', detail: 'PNG · Mitjana i posició de cada alumne', file: `6-alumnat-nota-mitjana-${label}`, label: 'Situació de l’alumnat', name: `situacio-alumnat-${label}` },
    { color: 'gold', detail: 'PNG · Blocs segons el nombre de suspensos', file: `7-alumnat-distribucio-suspensos-${label}`, label: 'Distribució de suspensos', name: `distribucio-suspensos-${label}` },
    { color: 'green', detail: "PNG · NA, AS, AN i AE de cada matèria", file: `8-materies-nivells-${label}`, label: "Nivells d'assoliment", name: `nivells-materies-${label}` },
  ]

  return (
    <div className="download-center-stack">
      <section className="download-center">
        <header>
          <div className="download-center-icon"><FileIcon /></div>
          <div>
            <span>Per a la sessió</span>
            <h2>Junta d'avaluació</h2>
            <p>
              Inclouen la graella de notes, els indicadors de seguiment i els acords anotats
              a la pestanya «Junta».
            </p>
          </div>
        </header>
        <div className="download-options">
          <button disabled={busy} onClick={onActa} type="button">
            <span className="download-option-icon blue"><FileIcon /></span>
            <span>
              <strong>Acta de la junta</strong>
              <small>PDF apaïsat · graella, resum i acords</small>
            </span>
            <b>{job?.kind === 'acta' ? 'Generant…' : 'PDF'}</b>
          </button>
          <button disabled={busy} onClick={onJuntaExcel} type="button">
            <span className="download-option-icon green"><RenameIcon /></span>
            <span>
              <strong>Graella de la junta</strong>
              <small>Excel · notes, indicadors, acords i missatges</small>
            </span>
            <b>XLSX</b>
          </button>
          <button disabled={busy} onClick={exportGroupReport} type="button">
            <span className="download-option-icon gold"><ChartIcon /></span>
            <span>
              <strong>Informe gràfic del grup</strong>
              <small>PDF · totes les gràfiques de la vista Grup</small>
            </span>
            <b>{exporting === 'group' ? 'Generant…' : 'PDF'}</b>
          </button>
        </div>
      </section>

      <section className="download-center family-center">
        <header>
          <div className="download-center-icon"><UserShieldIcon /></div>
          <div>
            <span>Per a l'alumnat i les famílies</span>
            <h2>Informes individuals</h2>
            <p>
              Una pàgina A4 per alumne amb les qualificacions i el nivell d'assoliment, la
              tendència, els punts forts, el que cal reforçar i el missatge del tutor o tutora.
              No hi surt cap dada d'altres alumnes.
            </p>
          </div>
        </header>
        <ReportSettingsPanel onChange={setSettings} settings={settings} />
        <div className="download-options">
          <button
            disabled={busy}
            onClick={() => onFamily(data.students.map((student) => student.name))}
            type="button"
          >
            <span className="download-option-icon coral"><UserShieldIcon /></span>
            <span>
              <strong>Informes de tot el grup</strong>
              <small>PDF · {studentsCount} pàgines, una per alumne</small>
            </span>
            <b>{job?.kind === 'family' && job.names.length > 1 ? 'Generant…' : 'PDF'}</b>
          </button>
          <div className="download-single">
            <span className="download-option-icon blue"><FileIcon /></span>
            <label>
              <strong>Informe d'un alumne</strong>
              <select onChange={(event) => setFamilyStudent(event.target.value)} value={familyStudent}>
                {data.students.map((student) => (
                  <option key={student.name}>{student.name}</option>
                ))}
              </select>
            </label>
            <button disabled={busy} onClick={() => onFamily([familyStudent])} type="button">
              {job?.kind === 'family' && job.names.length === 1 ? 'Generant…' : 'PDF'}
            </button>
          </div>
        </div>
      </section>

      <section className="download-center">
        <header>
          <div className="download-center-icon"><DownloadIcon /></div>
          <div>
            <span>Catàleg d'exportació</span>
            <h2>Gràfiques del grup</h2>
            <p>
              {comparison
                ? 'Les comparatives utilitzen les avaluacions seleccionades a la vista Grup.'
                : 'Per activar les comparatives, selecciona dues o tres avaluacions a la vista Grup.'}
            </p>
          </div>
        </header>
        <div className="download-gallery">
          {chartOptions.map((option, index) => {
            const unavailable = option.name.startsWith('comparativa-') && !comparison
            const changeUnavailable =
              option.name.startsWith('canvi-') &&
              !availableEvaluations.some((item) => item < evaluation)
            return (
              <button
                disabled={busy || unavailable || changeUnavailable}
                key={option.file}
                onClick={() => exportChart(option.name, option.file)}
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
          <strong>Dossiers de gràfiques individuals</strong>
          <span>Una pàgina per alumne, preparada per imprimir.</span>
        </div>
        <div className="download-options student-pdf-options">
          <button disabled={busy} onClick={() => exportStudentCharts('radar')} type="button">
            <span className="download-order green">9</span>
            <span>
              <strong>Radars de cada alumne</strong>
              <small>PDF · {studentsCount} pàgines per matèries</small>
            </span>
            <b>{exporting === 'radar' ? 'Generant…' : 'PDF'}</b>
          </button>
          <button disabled={busy} onClick={() => exportStudentCharts('evolution')} type="button">
            <span className="download-order blue">10</span>
            <span>
              <strong>Evolució respecte de la classe</strong>
              <small>PDF · {studentsCount} pàgines comparatives</small>
            </span>
            <b>{exporting === 'evolution' ? 'Generant…' : 'PDF'}</b>
          </button>
        </div>
      </section>
    </div>
  )
}

function StudentView({
  busy,
  data,
  evaluation,
  notes,
  onFamilyPdf,
  onNote,
  previous,
  selectedEvaluations,
  setSettings,
  settings,
  studentName,
}: {
  busy: boolean
  data: EvaluationData
  evaluation: EvaluationId
  notes: StudentNotes
  onFamilyPdf: () => void
  onNote: (notes: StudentNotes) => void
  previous?: EvaluationId
  selectedEvaluations: EvaluationId[]
  setSettings: (settings: ReportSettings) => void
  settings: ReportSettings
  studentName: string
}) {
  const [showSettings, setShowSettings] = useState(false)
  const student = data.students.find((item) => item.name === studentName)
  if (!student) return null

  const insight = studentInsight(data, student, evaluation, previous)
  const grades = student.evaluations[evaluation] ?? []
  const values = validGrades(grades)
  const average = studentMean(student, evaluation)
  const groupAverage = classMean(data, evaluation)
  const fails = values.filter((grade) => grade < PASS_MARK).length
  const variation = insight.delta
  const classSubjects = subjectStats(data, evaluation)
  const difference = average !== null && groupAverage !== null ? average - groupAverage : null

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
          <span>Fitxa acadèmica · {evaluationLabel(evaluation)} avaluació</span>
          <h2>{student.name}</h2>
          {insight.alerts.length > 0 && (
            <div className="alert-tags">
              {insight.alerts.map((alert) => (
                <span className={`alert-tag tone-${alert.tone}`} key={alert.kind + alert.label} title={alert.detail}>
                  {alert.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="student-banner-actions">
          <button
            className="export-button primary"
            disabled={busy}
            onClick={onFamilyPdf}
            type="button"
          >
            <DownloadIcon /> {busy ? 'Generant…' : 'Informe per a la família'}
          </button>
          <button
            aria-expanded={showSettings}
            className="export-button"
            onClick={() => setShowSettings(!showSettings)}
            type="button"
          >
            Dades de l'informe
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="panel settings-panel">
          <ReportSettingsPanel onChange={setSettings} settings={settings} />
        </div>
      )}

      {insight.alerts.length > 0 && (
        <ul className="insight-list">
          {insight.alerts.map((alert) => (
            <li className={`tone-${alert.tone}`} key={alert.kind + alert.label}>
              <strong>{alert.label}.</strong> {alert.detail}
            </li>
          ))}
        </ul>
      )}

      <div className="metric-grid">
        <Metric
          detail={`${evaluationLabel(evaluation)} avaluació`}
          label="Mitjana personal"
          tone="forest"
          value={formatNumber(average)}
        />
        <Metric
          detail={
            difference === null
              ? 'sense dades'
              : difference >= 0
                ? 'per sobre del grup'
                : 'per sota del grup'
          }
          label="Diferència amb el grup"
          tone="blue"
          value={formatSigned(difference)}
        />
        <Metric
          detail="qualificacions inferiors a 1,96 (NA)"
          label="Suspensos"
          tone="coral"
          value={fails.toString()}
        />
        <Metric
          detail={
            previous
              ? `respecte de la ${evaluationLabel(previous)}`
              : 'encara sense comparativa'
          }
          label="Variació"
          tone="gold"
          value={formatSigned(variation)}
        />
      </div>

      <div className="content-grid notes-grid">
        <article className="panel note-panel">
          <header>
            <div>
              <h2>Acords de la junta</h2>
              <p>Notes internes: surten a l'acta i a l'Excel, no a l'informe de la família.</p>
            </div>
          </header>
          <textarea
            onChange={(event) => onNote({ ...notes, acords: event.target.value })}
            placeholder="Mesures acordades, entrevista amb la família, derivacions, PI…"
            value={notes.acords}
          />
        </article>
        <article className="panel note-panel family">
          <header>
            <div>
              <h2>Missatge per a la família</h2>
              <p>Apareix a l'informe individual. Si es deixa buit, s'hi imprimeixen línies per escriure-hi a mà.</p>
            </div>
          </header>
          <textarea
            onChange={(event) => onNote({ ...notes, familia: event.target.value })}
            placeholder="Valoració general, actitud, propostes de millora per al trimestre vinent…"
            value={notes.familia}
          />
        </article>
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
              primaryLabel={student.name}
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
            evaluations={data.evaluations}
            studentName={studentName}
          />
        </Panel>
      </div>

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
                <th>Mitjana del grup ({evaluationLabel(evaluation)})</th>
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
                          showLevel
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
        <LevelLegend compact />
      </Panel>

      <Panel
        exportName={`evolucio-materies-${student.name}`}
        subtitle="Tria una matèria per veure'n l'evolució i comparar-la amb el grup"
        title="Evolució per matèria"
      >
        <SubjectEvolutionExplorer
          data={data}
          evaluations={data.evaluations}
          studentName={studentName}
        />
      </Panel>
    </>
  )
}

function GroupView({
  data,
  evaluation,
  onOpenStudent,
  selectedEvaluations,
}: {
  data: EvaluationData
  evaluation: EvaluationId
  onOpenStudent?: (name: string) => void
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
          detail="notes inferiors a 1,96 (NA)"
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
          subtitle="Nombre de qualificacions inferiors a 1,96 (NA)"
          title="Suspensos per matèria"
        >
          <HorizontalBars
            data={[...subjects]
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
          onSelect={onOpenStudent}
          students={[...students].sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0))}
        />
      </Panel>

      <Panel
        exportName={`nivells-materies-${evaluationLabel(evaluation)}`}
        subtitle={`Alumnes de cada nivell d'assoliment · ${evaluationLabel(evaluation)} avaluació`}
        title="Nivells d'assoliment per matèria"
      >
        <LevelDistribution data={data} evaluation={evaluation} />
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


export default App
