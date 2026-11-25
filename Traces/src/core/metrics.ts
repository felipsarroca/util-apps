// SPDX-License-Identifier: AGPL-3.0-or-later
import type {
  AnalysisSettings,
  AuthorStats,
  BulkInsertion,
  DocumentAnalysis,
  HistoryCoverage,
  NormalizedOp,
  ParagraphBlock,
  RawDocumentHistory,
  RevisionSignal,
  SheetPaste,
  SlideStat,
  StoredSummary,
  TimelinePoint,
  WorkDay,
  WritingSession,
} from '../types';
import { DEFAULT_SETTINGS } from '../types';
import {
  countWords,
  parseDocumentHistory,
  parsePresentationHistory,
  resolveSlideId,
  TEMPLATE_USER,
  type PresentationStructure,
} from './parser';
import {
  reconstructDocument,
  resolveAuthorResolver,
  type PlacementResolver,
  type ResolvedAuthor,
} from './reconstructor';
import { parseSheetsHistory, rangeLabel } from './sheetsParser';

// Crèdit mínim per a edicions aïllades o l'inici d'una sessió (pensar i escriure les primeres paraules)
const SESSION_BASE_CREDIT_MS = 20_000;
/** Cel·les mínimes perquè un enganxat de Sheets aparegui a la llista de blocs. */
const SHEETS_PASTE_MIN_CELLS = 3;

type TimedOp = Pick<NormalizedOp, 'id' | 'timestamp' | 'userId' | 'type' | 'charCount' | 'wordCount'>;

export function computeSessions(
  operations: TimedOp[],
  sessionGapMinutes: number,
  isBulk: (op: TimedOp) => boolean,
  getAuthor: (userId: string) => ResolvedAuthor
): WritingSession[] {
  const validOps = operations
    .filter((op) => op.timestamp > 0)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);

  if (validOps.length === 0) return [];

  const gapMs = Math.max(1, sessionGapMinutes) * 60_000;
  const groups: TimedOp[][] = [];
  let currentGroup: TimedOp[] = [validOps[0]];

  for (let i = 1; i < validOps.length; i++) {
    const prev = validOps[i - 1];
    const curr = validOps[i];
    if (curr.timestamp - prev.timestamp > gapMs) {
      groups.push(currentGroup);
      currentGroup = [curr];
    } else {
      currentGroup.push(curr);
    }
  }
  groups.push(currentGroup);

  return groups.map((ops, idx) => {
    const startTime = ops[0].timestamp;
    const endTime = ops[ops.length - 1].timestamp;
    // Les operacions estan ordenades globalment: dos autors simultanis no dupliquen temps
    const activeMs = Math.max(0, endTime - startTime) + SESSION_BASE_CREDIT_MS;
    const durationSeconds = Math.round(activeMs / 1000);
    const durationMinutes = Math.max(0.3, Math.round((activeMs / 60_000) * 10) / 10);

    let charsInserted = 0;
    let charsDeleted = 0;
    let wordsInserted = 0;
    let bulkInsertionsCount = 0;
    const authorIds = new Set<string>();

    for (const op of ops) {
      authorIds.add(op.userId);
      if (op.type === 'insert') {
        charsInserted += op.charCount;
        wordsInserted += op.wordCount;
        if (isBulk(op)) bulkInsertionsCount++;
      } else {
        charsDeleted += op.charCount;
      }
    }

    return {
      index: idx + 1,
      startTime,
      endTime,
      durationMinutes,
      durationSeconds,
      operationCount: ops.length,
      charsInserted,
      charsDeleted,
      wordsAddedApprox: wordsInserted - Math.round(charsDeleted / 6),
      bulkInsertionsCount,
      authors: Array.from(authorIds).map((uid) => getAuthor(uid)),
    };
  });
}

function computeAuthorActiveSeconds(
  ops: TimedOp[],
  sessionGapMinutes: number
): { activeSeconds: number; sessionCount: number } {
  const valid = ops.filter((o) => o.timestamp > 0).sort((a, b) => a.timestamp - b.timestamp);
  if (valid.length === 0) return { activeSeconds: 0, sessionCount: 0 };

  const gapMs = Math.max(1, sessionGapMinutes) * 60_000;
  let totalMs = SESSION_BASE_CREDIT_MS;
  let sessions = 1;

  for (let i = 1; i < valid.length; i++) {
    const delta = valid[i].timestamp - valid[i - 1].timestamp;
    if (delta > gapMs) {
      sessions++;
      totalMs += SESSION_BASE_CREDIT_MS;
    } else {
      totalMs += Math.max(0, delta);
    }
  }

  return { activeSeconds: Math.round(totalMs / 1000), sessionCount: sessions };
}

function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function computeWorkDays(sessions: WritingSession[]): WorkDay[] {
  const byDay = new Map<number, WorkDay>();
  for (const s of sessions) {
    const key = startOfLocalDay(s.startTime);
    const day = byDay.get(key) ?? { dayStart: key, activeSeconds: 0, sessions: 0, bulkCount: 0 };
    day.activeSeconds += s.durationSeconds;
    day.sessions += 1;
    day.bulkCount += s.bulkInsertionsCount;
    byDay.set(key, day);
  }
  return Array.from(byDay.values()).sort((a, b) => a.dayStart - b.dayStart);
}

/** Posició de cada instant sobre l'eix de temps actiu (0..1), amb les sessions juxtaposades. */
function makeActiveAxis(sessions: WritingSession[]): (ts: number) => { x: number; session: number } {
  const total = sessions.reduce((a, s) => a + s.durationSeconds, 0) || 1;
  const offsets: number[] = [];
  let acc = 0;
  for (const s of sessions) {
    offsets.push(acc);
    acc += s.durationSeconds;
  }
  return (ts: number) => {
    if (sessions.length === 0) return { x: 0, session: 1 };
    let idx = sessions.findIndex((s) => ts <= s.endTime);
    if (idx < 0) idx = sessions.length - 1;
    const s = sessions[idx];
    const within = Math.min(s.durationSeconds, Math.max(0, (ts - s.startTime) / 1000));
    return { x: Math.min(1, (offsets[idx] + within) / total), session: s.index };
  };
}

function computeRevisionSignal(
  typedChars: number,
  bulkChars: number,
  deletedChars: number,
  progressiveFinalWords: number
): RevisionSignal {
  const base = Math.max(1, typedChars + bulkChars);
  const deletionPct = Math.min(100, Math.round((deletedChars / base) * 1000) / 10);
  const level: RevisionSignal['level'] = deletionPct < 4 ? 'poques' : deletionPct < 15 ? 'normals' : 'moltes';
  return {
    typedChars,
    deletedChars,
    deletionPct,
    level,
    fewCorrections: progressiveFinalWords >= 150 && deletionPct < 2,
  };
}

function progressiveWordsFromParagraphs(paragraphs: ParagraphBlock[]): number {
  let words = 0;
  for (const p of paragraphs) {
    let s = '';
    for (const seg of p.segments) s += seg.origin === 'progressive' ? seg.text : ' ';
    words += countWords(s);
  }
  return words;
}

export function analyzeDocumentHistory(
  history: RawDocumentHistory,
  partialSettings?: Partial<AnalysisSettings>
): DocumentAnalysis {
  const settings: AnalysisSettings = { ...DEFAULT_SETTINGS, ...partialSettings };
  const kind = history.kind ?? 'document';
  if (kind === 'spreadsheet') return analyzeSpreadsheet(history, settings);

  const getAuthor = resolveAuthorResolver(history.userMap || {});

  let structure: PresentationStructure | null = null;
  let parsed;
  let placement: PlacementResolver | undefined;

  if (kind === 'presentation') {
    const res = parsePresentationHistory(history);
    parsed = res.stream;
    structure = res.structure;
    const objectOrder = new Map<string, number>();
    let k = 0;
    for (const id of structure.objects.keys()) objectOrder.set(id, k++);
    const st = structure;
    placement = (objectId: string) => {
      const info = st.objects.get(objectId);
      if (!info) return null;
      const slideId = resolveSlideId(info.parentId, st);
      const slideIdx = st.slideOrder.indexOf(slideId);
      if (slideIdx < 0) return null;
      const isNotes = info.parentId.endsWith(':notes');
      return {
        order: slideIdx * 100_000 + (isNotes ? 50_000 : 0) + (objectOrder.get(objectId) ?? 0),
        slideNumber: slideIdx + 1,
        isNotes,
      };
    };
  } else {
    parsed = parseDocumentHistory(history);
    const tabs = parsed.tabs;
    if (tabs && tabs.length > 1) {
      placement = (objectId: string) => {
        const i = tabs.findIndex((t) => t.id === objectId);
        return { order: i < 0 ? 999 : i, tabName: tabs[i]?.name || objectId };
      };
    }
  }

  const recon = reconstructDocument(
    parsed.baselineByObject,
    parsed.operations,
    settings.bulkThresholdChars,
    getAuthor,
    placement
  );

  const activeOps = parsed.operations.filter((o) => !o.isTemplate);
  const isBulkOp = (op: TimedOp) =>
    op.type === 'insert' &&
    !recon.movedOpIds.has(op.id) &&
    ((op as NormalizedOp).text?.trim().length ?? 0) >= settings.bulkThresholdChars;

  const sessions = computeSessions(activeOps, settings.sessionGapMinutes, isBulkOp, getAuthor);
  const totalActiveSeconds = sessions.reduce((acc, s) => acc + s.durationSeconds, 0);
  const totalActiveMinutes = Math.round((totalActiveSeconds / 60) * 10) / 10;

  const timedOps = activeOps.filter((o) => o.timestamp > 0);
  const firstEditTime =
    timedOps.length > 0 ? timedOps.reduce((m, o) => Math.min(m, o.timestamp), Infinity) : null;
  const lastEditTime =
    timedOps.length > 0 ? timedOps.reduce((m, o) => Math.max(m, o.timestamp), 0) : null;
  const elapsedSpanMinutes =
    firstEditTime !== null && lastEditTime !== null
      ? Math.max(0, Math.round((lastEditTime - firstEditTime) / 60_000))
      : 0;

  // Composició del text final (sense espais)
  let progressiveFinalChars = 0;
  let bulkFinalChars = 0;
  let templateFinalChars = 0;
  const survivingByAuthor = new Map<string, number>();

  for (const ch of recon.finalChars) {
    if (!/\S/.test(ch.ch)) continue;
    if (ch.opId === 0) {
      templateFinalChars++;
    } else if (ch.insertedLength >= settings.bulkThresholdChars) {
      bulkFinalChars++;
      survivingByAuthor.set(ch.userId, (survivingByAuthor.get(ch.userId) ?? 0) + 1);
    } else {
      progressiveFinalChars++;
      survivingByAuthor.set(ch.userId, (survivingByAuthor.get(ch.userId) ?? 0) + 1);
    }
  }

  const totalNonWsFinal = progressiveFinalChars + bulkFinalChars + templateFinalChars;
  const authoredNonWsFinal = progressiveFinalChars + bulkFinalChars;
  const progressivePct = totalNonWsFinal > 0 ? Math.round((progressiveFinalChars / totalNonWsFinal) * 100) : 0;
  const templatePct = totalNonWsFinal > 0 ? Math.round((templateFinalChars / totalNonWsFinal) * 100) : 0;
  const bulkPct = totalNonWsFinal > 0 ? Math.max(0, 100 - progressivePct - templatePct) : 0;

  const progressiveFinalWords = progressiveWordsFromParagraphs(recon.paragraphs);
  const ownWordsPerMinute =
    totalActiveSeconds >= 30 ? Math.round(progressiveFinalWords / (totalActiveSeconds / 60)) : 0;

  // Correccions: text escrit pas a pas vs text esborrat (sense comptar els moviments interns)
  let typedChars = 0;
  let bulkCharsAll = 0;
  let deletedAll = 0;
  for (const op of activeOps) {
    if (op.type === 'insert') {
      if (recon.movedOpIds.has(op.id)) continue;
      if ((op.text?.trim().length ?? 0) >= settings.bulkThresholdChars) bulkCharsAll += op.charCount;
      else typedChars += op.charCount;
    } else {
      deletedAll += op.charCount;
    }
  }
  const revision = computeRevisionSignal(
    typedChars,
    bulkCharsAll,
    Math.max(0, deletedAll - recon.movedChars),
    progressiveFinalWords
  );

  // Línia de temps (≤ ~120 punts, sempre amb els punts d'inserció en bloc)
  const bulkByOpId = new Map<number, BulkInsertion>();
  for (const b of recon.bulkInsertions) bulkByOpId.set(b.opId, b);
  const axis = makeActiveAxis(sessions);

  const realStates = recon.opTimelineStates.filter((st) => !st.op.isTemplate);
  const stride = Math.max(1, Math.ceil(realStates.length / 100));
  const timeline: TimelinePoint[] = [];

  const baselineWords = recon.replayCheckpoints[0]?.userId === TEMPLATE_USER ? recon.replayCheckpoints[0] : null;
  if (baselineWords) {
    timeline.push({
      index: 0,
      revisionId: 0,
      timestamp: firstEditTime ?? Date.now(),
      sessionIndex: 1,
      activeX: 0,
      wordCount: baselineWords.wordCount,
      charCount: baselineWords.charCount,
    });
  }

  for (let i = 0; i < realStates.length; i++) {
    const st = realStates[i];
    const bulk = bulkByOpId.get(st.op.id);
    const keep = Boolean(bulk) || i === 0 || i === realStates.length - 1 || i % stride === 0;
    if (!keep) continue;
    const pos = axis(st.op.timestamp);
    timeline.push({
      index: timeline.length,
      revisionId: st.op.revisionId,
      timestamp: st.op.timestamp,
      sessionIndex: pos.session,
      activeX: pos.x,
      wordCount: st.wordCount,
      charCount: st.charCount,
      bulkInsertion: bulk
        ? {
            opId: bulk.opId,
            wordCount: bulk.wordCount,
            charCount: bulk.charCount,
            status: bulk.status,
            authorName: bulk.authorName,
          }
        : undefined,
    });
  }

  // Autors
  const opsByAuthor = new Map<string, NormalizedOp[]>();
  for (const op of activeOps) {
    const list = opsByAuthor.get(op.userId) ?? [];
    list.push(op);
    opsByAuthor.set(op.userId, list);
  }

  const slidesByAuthor = new Map<string, Set<number>>();
  for (const p of recon.paragraphs) {
    if (p.slideNumber === undefined) continue;
    for (const seg of p.segments) {
      if (seg.origin === 'template' || !/\S/.test(seg.text)) continue;
      const set = slidesByAuthor.get(seg.authorId) ?? new Set<number>();
      set.add(p.slideNumber);
      slidesByAuthor.set(seg.authorId, set);
    }
  }

  const totalOps = activeOps.length;
  const authors: AuthorStats[] = Array.from(opsByAuthor.entries())
    .map(([userId, authorOps]) => {
      const info = getAuthor(userId);
      const { activeSeconds, sessionCount: aSessions } = computeAuthorActiveSeconds(
        authorOps,
        settings.sessionGapMinutes
      );

      let progressiveCharsInserted = 0;
      let bulkCharsInserted = 0;
      for (const op of authorOps) {
        if (op.type !== 'insert' || recon.movedOpIds.has(op.id)) continue;
        if ((op.text?.trim().length ?? 0) >= settings.bulkThresholdChars) bulkCharsInserted += op.charCount;
        else progressiveCharsInserted += op.charCount;
      }

      const survivingFinalChars = survivingByAuthor.get(userId) ?? 0;
      return {
        userId,
        name: info.name,
        color: info.color,
        operationCount: authorOps.length,
        operationSharePct: totalOps > 0 ? Math.round((authorOps.length / totalOps) * 100) : 0,
        activeMinutes: Math.round((activeSeconds / 60) * 10) / 10,
        sessionCount: aSessions,
        progressiveCharsInserted,
        bulkCharsInserted,
        charsDeleted: recon.deletedCharsByAuthor.get(userId) ?? 0,
        survivingFinalChars,
        survivingSharePct:
          authoredNonWsFinal > 0 ? Math.round((survivingFinalChars / authoredNonWsFinal) * 100) : 0,
        slidesTouched: structure ? (slidesByAuthor.get(userId)?.size ?? 0) : undefined,
      };
    })
    .sort((a, b) => b.survivingFinalChars - a.survivingFinalChars || b.operationCount - a.operationCount);

  // Diapositives
  let slides: SlideStat[] | undefined;
  let imagesInserted: number | undefined;
  if (structure) {
    const st = structure;
    const imagesBySlide = new Map<number, number>();
    imagesInserted = 0;
    for (const img of st.images) {
      if (img.isTemplate) continue;
      const info = st.objects.get(img.objectId);
      const slideIdx = info ? st.slideOrder.indexOf(resolveSlideId(info.parentId, st)) : -1;
      if (slideIdx < 0) continue;
      imagesInserted++;
      imagesBySlide.set(slideIdx + 1, (imagesBySlide.get(slideIdx + 1) ?? 0) + 1);
    }
    slides = st.slideOrder.map((slideId, i) => {
      const n = i + 1;
      const paras = recon.paragraphs.filter((p) => p.slideNumber === n);
      const titlePara = paras.find((p) => !p.isNotes);
      const byAuthor = new Map<string, number>();
      for (const p of paras) {
        for (const seg of p.segments) {
          if (seg.origin === 'template') continue;
          const c = seg.text.replace(/\s+/g, '').length;
          if (c > 0) byAuthor.set(seg.authorId, (byAuthor.get(seg.authorId) ?? 0) + c);
        }
      }
      return {
        slideId,
        number: n,
        title: (titlePara?.plainText.trim() ?? '').slice(0, 70),
        words: paras.reduce((a, p) => a + countWords(p.plainText), 0),
        bulkCount: recon.bulkInsertions.filter((b) => b.slideNumber === n).length,
        images: imagesBySlide.get(n) ?? 0,
        authors: Array.from(byAuthor.entries())
          .map(([uid, chars]) => ({ ...getAuthor(uid), chars }))
          .sort((a, b) => b.chars - a.chars),
      };
    });
  }

  const coverage = buildCoverage(history, parsed.operations.length, parsed.totalRawEntries, parsed.unrecognizedEntries, {
    tabs: parsed.tabs?.length ?? 0,
    hasTemplateBaseline:
      parsed.baselineByObject.size > 0 ||
      parsed.operations.some((o) => o.isTemplate && (o.text?.trim().length ?? 0) > 0),
    clamped: recon.clampedOperations,
    finalWords: countWords(recon.finalPlainText),
  });

  const workDays = computeWorkDays(sessions);
  const lastDay = workDays[workDays.length - 1];

  return {
    docId: history.docId,
    title: history.title || 'Document sense títol',
    kind,
    tabId: history.tabId,
    docTabs: parsed.tabs && parsed.tabs.length > 1 ? parsed.tabs : undefined,
    isDemo: Boolean(history.isDemo),
    demoId: history.demoId,
    analyzedAt: Date.now(),
    settings,

    totalActiveMinutes,
    totalActiveSeconds,
    elapsedSpanMinutes,
    firstEditTime,
    lastEditTime,
    sessionCount: sessions.length,
    finalWordCount: countWords(recon.finalPlainText),
    finalCharCount: recon.finalPlainText.length,
    totalOperations: activeOps.length,
    mainAuthorName: authors[0]?.name ?? '—',

    progressiveFinalChars,
    bulkFinalChars,
    templateFinalChars,
    progressivePct,
    bulkPct,
    templatePct,
    progressiveFinalWords,
    ownWordsPerMinute,
    movedInsertionsCount: recon.movedOpIds.size,
    movedChars: recon.movedChars,
    revision,
    workDays,
    lastDaySharePct:
      lastDay && totalActiveSeconds > 0 ? Math.round((lastDay.activeSeconds / totalActiveSeconds) * 100) : 0,

    bulkInsertions: recon.bulkInsertions,
    allCandidateInsertions: recon.allCandidateInsertions,
    sessions,
    timeline,
    authors,
    paragraphs: recon.paragraphs,
    replayCheckpoints: recon.replayCheckpoints,
    finalPlainText: recon.finalPlainText,
    coverage,
    slides,
    imagesInserted,
  };
}

function buildCoverage(
  history: RawDocumentHistory,
  opCount: number,
  totalRawEntries: number,
  unrecognized: number,
  info: { hasTemplateBaseline: boolean; clamped: number; finalWords: number; tabs?: number }
): HistoryCoverage {
  const notes: string[] = [];
  const kind = history.kind ?? 'document';
  const formatUnrecognized = totalRawEntries >= 3 && unrecognized >= totalRawEntries * 0.5;

  if (formatUnrecognized) {
    notes.push(
      'Google ha canviat el format intern de l’historial i Traces no l’entén del tot. Actualitzeu Traces a la versió més recent.'
    );
  }
  if (info.hasTemplateBaseline) {
    notes.push('El fitxer parteix d’una plantilla o còpia inicial, que es compta a part.');
  }
  if (info.clamped > 0) {
    notes.push(`S’han ajustat ${info.clamped} posicions per elements especials (taules, imatges o capçaleres).`);
  }
  if (kind === 'document' && (info.tabs ?? 0) > 1) {
    notes.push(`S’han analitzat les ${info.tabs} pestanyes del document.`);
  }
  if (opCount <= 3 && info.finalWords > 80) {
    notes.push(
      'Hi ha molt poques edicions per a la llargada del text (possible còpia d’un altre fitxer o treball fora de línia).'
    );
  }

  let level: HistoryCoverage['level'] = 'alta';
  let label = 'Historial complet';
  if (formatUnrecognized || (opCount === 0 && !info.hasTemplateBaseline)) {
    level = 'limitada';
    label = formatUnrecognized ? 'Format no reconegut' : 'Sense edicions registrades';
  } else if ((opCount <= 2 && info.finalWords > 100) || info.clamped > opCount * 0.15) {
    level = 'parcial';
    label = 'Historial parcial';
  } else if (info.hasTemplateBaseline) {
    label = 'Complet (amb plantilla)';
  }

  return {
    level,
    label,
    notes,
    hasTemplateBaseline: info.hasTemplateBaseline,
    clampedOperations: info.clamped,
    totalRawEntries,
    formatUnrecognized,
  };
}

/* ─────────────────────────────── Sheets ─────────────────────────────── */

function analyzeSpreadsheet(history: RawDocumentHistory, settings: AnalysisSettings): DocumentAnalysis {
  const getAuthor = resolveAuthorResolver(history.userMap || {});
  const parsed = parseSheetsHistory(history);
  const active = parsed.ops.filter((o) => !o.isTemplate && o.timestamp > 0);

  const timed: TimedOp[] = active.map((o) => ({
    id: o.id,
    timestamp: o.timestamp,
    userId: o.userId,
    type: 'insert',
    charCount: o.cells,
    wordCount: o.cells,
  }));
  const pasteIds = new Set(
    active.filter((o) => o.kind === 'pasted' && o.cells >= SHEETS_PASTE_MIN_CELLS).map((o) => o.id)
  );
  const sessions = computeSessions(timed, settings.sessionGapMinutes, (op) => pasteIds.has(op.id), getAuthor);
  const totalActiveSeconds = sessions.reduce((acc, s) => acc + s.durationSeconds, 0);

  let cellsTyped = 0;
  let cellsPasted = 0;
  let formulasTyped = 0;
  let formulasPasted = 0;
  let fills = 0;
  const pastes: SheetPaste[] = [];
  const sheetName = (id: string) => parsed.sheetNames.get(id) ?? (id === '0' ? 'Full 1' : id || 'Full');

  for (const o of active) {
    if (o.kind === 'typed') {
      cellsTyped += o.cells;
      formulasTyped += o.formulas;
    } else if (o.kind === 'pasted') {
      cellsPasted += o.cells;
      formulasPasted += o.formulas;
      if (o.cells >= SHEETS_PASTE_MIN_CELLS) {
        const a = getAuthor(o.userId);
        pastes.push({
          opId: o.id,
          timestamp: o.timestamp,
          userId: o.userId,
          authorName: a.name,
          authorColor: a.color,
          sheetName: sheetName(o.sheetId),
          rangeLabel: rangeLabel(o.range),
          cells: o.cells,
          formulas: o.formulas,
          preview: o.texts.filter((t) => t.trim()).slice(0, 6).join(' · '),
        });
      }
    } else if (o.kind === 'fill') {
      fills++;
    }
  }

  const total = cellsTyped + cellsPasted + parsed.templateCells;
  const progressivePct = total > 0 ? Math.round((cellsTyped / total) * 100) : 0;
  const templatePct = total > 0 ? Math.round((parsed.templateCells / total) * 100) : 0;
  const bulkPct = total > 0 ? Math.max(0, 100 - progressivePct - templatePct) : 0;

  // Línia de temps: cel·les escrites acumulades
  const axis = makeActiveAxis(sessions);
  const sorted = active.slice().sort((a, b) => a.timestamp - b.timestamp);
  const stride = Math.max(1, Math.ceil(sorted.length / 100));
  const timeline: TimelinePoint[] = [];
  let cumulative = 0;
  sorted.forEach((o, i) => {
    cumulative += o.cells;
    const isPaste = pasteIds.has(o.id);
    if (!isPaste && i !== 0 && i !== sorted.length - 1 && i % stride !== 0) return;
    const pos = axis(o.timestamp);
    timeline.push({
      index: timeline.length,
      revisionId: o.revisionId,
      timestamp: o.timestamp,
      sessionIndex: pos.session,
      activeX: pos.x,
      wordCount: cumulative,
      charCount: cumulative,
      bulkInsertion: isPaste
        ? { opId: o.id, wordCount: o.cells, charCount: o.cells, status: 'conservat', authorName: getAuthor(o.userId).name }
        : undefined,
    });
  });

  // Autors
  const byAuthor = new Map<string, typeof active>();
  for (const o of active) {
    const l = byAuthor.get(o.userId) ?? [];
    l.push(o);
    byAuthor.set(o.userId, l);
  }
  const written = cellsTyped + cellsPasted;
  const authors: AuthorStats[] = Array.from(byAuthor.entries())
    .map(([userId, list]) => {
      const info = getAuthor(userId);
      const tOps: TimedOp[] = list.map((o) => ({
        id: o.id,
        timestamp: o.timestamp,
        userId,
        type: 'insert',
        charCount: o.cells,
        wordCount: o.cells,
      }));
      const { activeSeconds, sessionCount } = computeAuthorActiveSeconds(tOps, settings.sessionGapMinutes);
      const typed = list.filter((o) => o.kind === 'typed').reduce((a, o) => a + o.cells, 0);
      const pasted = list.filter((o) => o.kind === 'pasted').reduce((a, o) => a + o.cells, 0);
      return {
        userId,
        name: info.name,
        color: info.color,
        operationCount: list.length,
        operationSharePct: active.length > 0 ? Math.round((list.length / active.length) * 100) : 0,
        activeMinutes: Math.round((activeSeconds / 60) * 10) / 10,
        sessionCount,
        progressiveCharsInserted: typed,
        bulkCharsInserted: pasted,
        charsDeleted: 0,
        survivingFinalChars: typed + pasted,
        survivingSharePct: written > 0 ? Math.round(((typed + pasted) / written) * 100) : 0,
        cellsTyped: typed,
        cellsPasted: pasted,
        formulas: list.reduce((a, o) => a + o.formulas, 0),
      };
    })
    .sort((a, b) => b.survivingFinalChars - a.survivingFinalChars || b.operationCount - a.operationCount);

  const firstEditTime = sorted.length ? sorted[0].timestamp : null;
  const lastEditTime = sorted.length ? sorted[sorted.length - 1].timestamp : null;
  const workDays = computeWorkDays(sessions);
  const lastDay = workDays[workDays.length - 1];

  const coverage = buildCoverage(history, active.length, parsed.totalRawEntries, parsed.unrecognizedEntries, {
    hasTemplateBaseline: parsed.templateCells > 0,
    clamped: 0,
    finalWords: 0,
  });

  return {
    docId: history.docId,
    title: history.title || 'Full de càlcul sense títol',
    kind: 'spreadsheet',
    isDemo: Boolean(history.isDemo),
    demoId: history.demoId,
    analyzedAt: Date.now(),
    settings,
    totalActiveMinutes: Math.round((totalActiveSeconds / 60) * 10) / 10,
    totalActiveSeconds,
    elapsedSpanMinutes:
      firstEditTime && lastEditTime ? Math.round((lastEditTime - firstEditTime) / 60_000) : 0,
    firstEditTime,
    lastEditTime,
    sessionCount: sessions.length,
    finalWordCount: written,
    finalCharCount: 0,
    totalOperations: active.length,
    mainAuthorName: authors[0]?.name ?? '—',
    progressiveFinalChars: cellsTyped,
    bulkFinalChars: cellsPasted,
    templateFinalChars: parsed.templateCells,
    progressivePct,
    bulkPct,
    templatePct,
    progressiveFinalWords: cellsTyped,
    ownWordsPerMinute: 0,
    movedInsertionsCount: 0,
    movedChars: 0,
    revision: { typedChars: cellsTyped, deletedChars: 0, deletionPct: 0, level: 'normals', fewCorrections: false },
    workDays,
    lastDaySharePct:
      lastDay && totalActiveSeconds > 0 ? Math.round((lastDay.activeSeconds / totalActiveSeconds) * 100) : 0,
    bulkInsertions: [],
    allCandidateInsertions: [],
    sessions,
    timeline,
    authors,
    paragraphs: [],
    replayCheckpoints: [],
    finalPlainText: '',
    coverage,
    sheet: {
      sheetNames: Array.from(parsed.sheetNames.values()),
      cellsTyped,
      cellsPasted,
      cellsTemplate: parsed.templateCells,
      formulasTyped,
      formulasPasted,
      fills,
      pastes,
    },
  };
}

/* ──────────────────────────── Termini de lliurament ──────────────────────────── */

export interface DeadlineStats {
  deadline: number;
  last24hPct: number;
  lateSeconds: number;
  daysBefore: number;
  startedDaysBefore: number | null;
}

export function computeDeadlineStats(analysis: DocumentAnalysis, deadline: number): DeadlineStats {
  const total = analysis.totalActiveSeconds || 1;
  let last24 = 0;
  let late = 0;
  const days = new Set<number>();
  for (const s of analysis.sessions) {
    if (s.startTime > deadline) late += s.durationSeconds;
    else {
      days.add(startOfLocalDay(s.startTime));
      if (s.endTime >= deadline - 24 * 3600_000) last24 += s.durationSeconds;
    }
  }
  return {
    deadline,
    last24hPct: Math.round((last24 / total) * 100),
    lateSeconds: late,
    daysBefore: days.size,
    startedDaysBefore:
      analysis.firstEditTime !== null
        ? Math.max(0, Math.floor((deadline - analysis.firstEditTime) / (24 * 3600_000)))
        : null,
  };
}

/** Grup (tasca) a partir del títol de la còpia de Classroom: «Nom Alumne - Títol de la tasca». */
export function guessAssignmentGroup(title: string): string {
  const parts = title.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) return parts.slice(1).join(' - ').trim() || title;
  return title;
}

export function toStoredSummary(analysis: DocumentAnalysis, url?: string): StoredSummary {
  return {
    docId: analysis.docId,
    title: analysis.title,
    kind: analysis.kind,
    group: guessAssignmentGroup(analysis.title),
    mainAuthor: analysis.mainAuthorName,
    authors: analysis.authors.length,
    activeSeconds: analysis.totalActiveSeconds,
    sessions: analysis.sessionCount,
    days: analysis.workDays.length,
    words: analysis.finalWordCount,
    progressivePct: analysis.progressivePct,
    bulkPct: analysis.bulkPct,
    bulkCount: analysis.kind === 'spreadsheet' ? (analysis.sheet?.pastes.length ?? 0) : analysis.bulkInsertions.length,
    deletionPct: analysis.revision.deletionPct,
    lastDaySharePct: analysis.lastDaySharePct,
    firstEdit: analysis.firstEditTime,
    lastEdit: analysis.lastEditTime,
    coverage: analysis.coverage.level,
    analyzedAt: analysis.analyzedAt,
    url,
  };
}
