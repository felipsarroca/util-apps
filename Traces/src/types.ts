// SPDX-License-Identifier: AGPL-3.0-or-later

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

export type RawChangelogEntry = [
  RawOperation,
  number,           // timestamp (ms)
  string,           // userId
  number?,          // revisionId
  string?,          // sessionId
  number?,          // sessionRevisionIndex
  ...unknown[]
];

export interface RawDocumentHistory {
  docId: string;
  title: string;
  tabId?: string;
  firstRev: number;
  lastRev: number;
  fetchedAt: number;
  isDemo?: boolean;
  demoId?: string;
  userMap: Record<string, RawUserInfo>;
  chunkedSnapshot?: RawOperation[][];
  changelog: RawChangelogEntry[];
}

export interface AnalysisSettings {
  bulkThresholdChars: number;
  sessionGapMinutes: number;
  autoAnalyzeOnSwitch: boolean;
}

export const DEFAULT_SETTINGS: AnalysisSettings = {
  bulkThresholdChars: 100,
  sessionGapMinutes: 5,
  autoAnalyzeOnSwitch: true,
};

export type AtomicOpType = 'insert' | 'delete';

export interface NormalizedOp {
  id: number;
  revisionId: number;
  timestamp: number;
  userId: string;
  sessionId: string;
  type: AtomicOpType;
  index: number;      // 1-based start index
  endIndex?: number;  // 1-based inclusive end index (for deletes)
  text?: string;      // inserted text (for inserts)
  charCount: number;
  wordCount: number;
  isSuggestion: boolean;
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
}

export interface ParagraphBlock {
  paragraphNumber: number;
  segments: TextSegment[];
  plainText: string;
  hasBulk: boolean;
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
}

export interface HistoryCoverage {
  level: 'alta' | 'parcial' | 'limitada';
  label: string;
  notes: string[];
  hasTemplateBaseline: boolean;
  clampedOperations: number;
  totalRawEntries: number;
}

export interface DocumentAnalysis {
  docId: string;
  title: string;
  tabId?: string;
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

  // Composition of final text (excluding whitespace-only structural trailing newline)
  progressiveFinalChars: number;
  bulkFinalChars: number;
  templateFinalChars: number;
  progressivePct: number;
  bulkPct: number;
  templatePct: number;

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
}
