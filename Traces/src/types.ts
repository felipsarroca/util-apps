// SPDX-License-Identifier: AGPL-3.0-or-later

/** Tipus de fitxer de Google que Traces sap analitzar. */
export type DocKind = 'document' | 'presentation' | 'spreadsheet';

export interface RawUserInfo {
  name: string;
  color?: string;
  photo?: string | null;
  anonymous?: boolean;
}

export interface RawTileInfo {
  start: number;
  end: number;
  endMillis?: number;
  users?: string[];
  systemRevs?: number[];
  expandable?: boolean;
}

export interface RawOperation {
  ty: string;
  ibi?: number;
  s?: string;
  si?: number;
  ei?: number;
  mts?: RawOperation[];
  [key: string]: unknown;
}

/**
 * Entrada del registre intern de revisions.
 * A Docs, el primer element és una operació amb `ty`; a Presentacions i Sheets
 * és una ordre numèrica en forma de vector ([codi, dades]).
 */
export type RawChangelogEntry = [
  RawOperation | unknown[],
  number,           // timestamp (ms)
  string,           // userId
  number?,          // revisionId
  string?,          // sessionId
  number?,          // sessionRevisionIndex
  ...unknown[]
];

export interface DocTabInfo {
  id: string;
  name: string;
}

export interface RawDocumentHistory {
  docId: string;
  title: string;
  kind?: DocKind;
  tabId?: string;
  firstRev: number;
  lastRev: number;
  fetchedAt: number;
  isDemo?: boolean;
  demoId?: string;
  userMap: Record<string, RawUserInfo>;
  chunkedSnapshot?: unknown[];
  changelog: RawChangelogEntry[];
}

export interface AnalysisSettings {
  bulkThresholdChars: number;
  sessionGapMinutes: number;
  autoAnalyzeOnSwitch: boolean;
  /** Mostra les opcions tècniques (llindars, CSV, JSON). */
  showAdvanced: boolean;
  /** Fa lloc al panell estrenyent el document en lloc de tapar-lo. */
  pushDocument: boolean;
}

export const DEFAULT_SETTINGS: AnalysisSettings = {
  bulkThresholdChars: 100,
  sessionGapMinutes: 5,
  autoAnalyzeOnSwitch: true,
  showAdvanced: false,
  pushDocument: true,
};

export type AtomicOpType = 'insert' | 'delete';

export interface NormalizedOp {
  id: number;
  revisionId: number;
  timestamp: number;
  userId: string;
  sessionId: string;
  type: AtomicOpType;
  /** Objecte de text on s'aplica: '' a Docs; caixa de text a Presentacions; pestanya a Docs amb pestanyes. */
  objectId: string;
  index: number;      // 1-based start index
  endIndex?: number;  // 1-based inclusive end index (for deletes)
  text?: string;      // inserted text (for inserts)
  charCount: number;
  wordCount: number;
  isSuggestion: boolean;
  /** Forma part del contingut inicial (creació o còpia del fitxer). */
  isTemplate?: boolean;
}

export type RetentionStatus = 'conservat' | 'reelaborat' | 'eliminat';

export interface BulkInsertion {
  opId: number;
  revisionId: number;
  timestamp: number;
  userId: string;
  authorName: string;
  authorColor: string;
  originalText: string;
  charCount: number;
  wordCount: number;
  survivingChars: number;
  retentionRatio: number; // 0..1
  status: RetentionStatus;
  paragraphNumber: number | null; // 1-based paragraph in final document (null if deleted)
  /** Diapositiva on s'ha inserit (Presentacions). */
  slideNumber?: number | null;
  previewSnippet: string;
}

export interface TextSegment {
  text: string;
  origin: 'template' | 'progressive' | 'bulk';
  bulkOpId?: number;
  authorId: string;
  authorName: string;
  authorColor: string;
  timestamp: number;
  /** El text va ser retallat i enganxat (o duplicat) dins del mateix fitxer. */
  moved?: boolean;
}

export interface ParagraphBlock {
  paragraphNumber: number;
  segments: TextSegment[];
  plainText: string;
  hasBulk: boolean;
  /** Presentacions: diapositiva (1-based) i si és a les notes de l'orador. */
  slideNumber?: number;
  isNotes?: boolean;
  /** Docs amb pestanyes: nom de la pestanya. */
  tabName?: string;
}

export interface ReplayCheckpoint {
  stepIndex: number;
  revisionId: number;
  timestamp: number;
  userId: string;
  authorName: string;
  wordCount: number;
  charCount: number;
  text: string;
  isBulkStep: boolean;
  deltaSummary: string;
}

export interface WritingSession {
  index: number; // 1-based
  startTime: number;
  endTime: number;
  durationMinutes: number;
  durationSeconds: number;
  operationCount: number;
  charsInserted: number;
  charsDeleted: number;
  wordsAddedApprox: number;
  bulkInsertionsCount: number;
  authors: {
    userId: string;
    name: string;
    color: string;
  }[];
}

export interface TimelinePoint {
  index: number;
  revisionId: number;
  timestamp: number;
  sessionIndex: number;
  /** Posició sobre l'eix de temps actiu (0..1). */
  activeX: number;
  wordCount: number;
  charCount: number;
  bulkInsertion?: {
    opId: number;
    wordCount: number;
    charCount: number;
    status: RetentionStatus;
    authorName: string;
  };
}

export interface AuthorStats {
  userId: string;
  name: string;
  color: string;
  operationCount: number;
  operationSharePct: number;
  activeMinutes: number;
  sessionCount: number;
  progressiveCharsInserted: number;
  bulkCharsInserted: number;
  charsDeleted: number;
  survivingFinalChars: number;
  survivingSharePct: number;
  /** Presentacions: diapositives on aquest autor té text al resultat final. */
  slidesTouched?: number;
  /** Sheets: cel·les escrites a mà, enganxades i fórmules. */
  cellsTyped?: number;
  cellsPasted?: number;
  formulas?: number;
}

export interface HistoryCoverage {
  level: 'alta' | 'parcial' | 'limitada';
  label: string;
  notes: string[];
  hasTemplateBaseline: boolean;
  clampedOperations: number;
  totalRawEntries: number;
  /** El format intern no s'ha reconegut: probablement Google l'ha canviat. */
  formatUnrecognized?: boolean;
}

/** Dia amb activitat d'edició. */
export interface WorkDay {
  dayStart: number;       // mitjanit local del dia (ms)
  activeSeconds: number;
  sessions: number;
  bulkCount: number;
}

/** Indicador de revisió: quant text escrit s'ha esborrat o corregit. */
export interface RevisionSignal {
  typedChars: number;
  deletedChars: number;
  deletionPct: number;   // 0..100
  level: 'poques' | 'normals' | 'moltes';
  /** Text llarg escrit pas a pas gairebé sense correccions ni pauses. */
  fewCorrections: boolean;
}

export interface SlideStat {
  slideId: string;
  number: number;          // 1-based
  title: string;
  words: number;
  bulkCount: number;
  images: number;
  authors: { userId: string; name: string; color: string; chars: number }[];
}

export interface SheetPaste {
  opId: number;
  timestamp: number;
  userId: string;
  authorName: string;
  authorColor: string;
  sheetName: string;
  rangeLabel: string;
  cells: number;
  formulas: number;
  preview: string;
}

export interface SheetStats {
  sheetNames: string[];
  cellsTyped: number;
  cellsPasted: number;
  cellsTemplate: number;
  formulasTyped: number;
  formulasPasted: number;
  fills: number;
  pastes: SheetPaste[];
}

export interface DocumentAnalysis {
  docId: string;
  title: string;
  kind: DocKind;
  tabId?: string;
  /** Pestanyes del document (Docs), totes analitzades. */
  docTabs?: DocTabInfo[];
  isDemo: boolean;
  demoId?: string;
  analyzedAt: number;
  settings: AnalysisSettings;

  // Global KPIs
  totalActiveMinutes: number;
  totalActiveSeconds: number;
  elapsedSpanMinutes: number;
  firstEditTime: number | null;
  lastEditTime: number | null;
  sessionCount: number;
  finalWordCount: number;
  finalCharCount: number;
  totalOperations: number;
  mainAuthorName: string;

  // Composition of final text (excluding whitespace-only structural trailing newline)
  progressiveFinalChars: number;
  bulkFinalChars: number;
  templateFinalChars: number;
  progressivePct: number;
  bulkPct: number;
  templatePct: number;

  /** Paraules del text final escrites pas a pas i ritme per minut actiu. */
  progressiveFinalWords: number;
  ownWordsPerMinute: number;

  /** Fragments retallats i enganxats (o duplicats) dins del mateix fitxer. */
  movedInsertionsCount: number;
  movedChars: number;

  revision: RevisionSignal;
  workDays: WorkDay[];
  /** % del temps actiu concentrat en l'últim dia de treball. */
  lastDaySharePct: number;

  // Detailed collections
  bulkInsertions: BulkInsertion[];
  allCandidateInsertions: BulkInsertion[]; // >= 25 chars so instant UI slider/chips work seamlessly
  sessions: WritingSession[];
  timeline: TimelinePoint[];
  authors: AuthorStats[];
  paragraphs: ParagraphBlock[];
  replayCheckpoints: ReplayCheckpoint[];
  finalPlainText: string;
  coverage: HistoryCoverage;

  /** Presentacions */
  slides?: SlideStat[];
  imagesInserted?: number;
  /** Sheets */
  sheet?: SheetStats;
}

/** Resum compacte que es desa per a la taula de la classe (sense text de l'alumne). */
export interface StoredSummary {
  docId: string;
  title: string;
  kind: DocKind;
  group: string;
  mainAuthor: string;
  authors: number;
  activeSeconds: number;
  sessions: number;
  days: number;
  words: number;
  progressivePct: number;
  bulkPct: number;
  bulkCount: number;
  deletionPct: number;
  lastDaySharePct: number;
  firstEdit: number | null;
  lastEdit: number | null;
  coverage: HistoryCoverage['level'];
  analyzedAt: number;
  url?: string;
}
