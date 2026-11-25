// SPDX-License-Identifier: AGPL-3.0-or-later
import type {
  AnalysisSettings,
  AuthorStats,
  BulkInsertion,
  DocumentAnalysis,
  HistoryCoverage,
  NormalizedOp,
  RawDocumentHistory,
  TimelinePoint,
  WritingSession,
} from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { countWords, parseDocumentHistory } from './parser';
import { reconstructDocument, resolveAuthorResolver } from './reconstructor';

// Prudent minimum credit for isolated edits or session start (thinking/typing first words)
const SESSION_BASE_CREDIT_MS = 20_000;

export function computeSessions(
  operations: NormalizedOp[],
  sessionGapMinutes: number,
  bulkThresholdChars: number,
  getAuthor: (userId: string) => { userId: string; name: string; color: string }
): WritingSession[] {
  const validOps = operations
    .filter((op) => op.timestamp > 0)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);

  if (validOps.length === 0) return [];

  const gapMs = Math.max(1, sessionGapMinutes) * 60_000;
  const groups: NormalizedOp[][] = [];
  let currentGroup: NormalizedOp[] = [validOps[0]];

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
    // Active span avoids double-counting simultaneous multi-author edits because ops are sorted globally
    const rawSpanMs = Math.max(0, endTime - startTime);
    const activeMs = rawSpanMs + SESSION_BASE_CREDIT_MS;
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
        if ((op.text?.trim().length ?? 0) >= bulkThresholdChars) {
          bulkInsertionsCount++;
        }
      } else {
        charsDeleted += op.charCount;
      }
    }

    const wordsDeletedApprox = Math.round(charsDeleted / 6);
    const wordsAddedApprox = wordsInserted - wordsDeletedApprox;

    return {
      index: idx + 1,
      startTime,
      endTime,
      durationMinutes,
      durationSeconds,
      operationCount: ops.length,
      charsInserted,
      charsDeleted,
      wordsAddedApprox,
      bulkInsertionsCount,
      authors: Array.from(authorIds).map((uid) => getAuthor(uid)),
    };
  });
}

function computeAuthorActiveSeconds(
  ops: NormalizedOp[],
  sessionGapMinutes: number
): { activeSeconds: number; sessionCount: number } {
  const valid = ops
    .filter((o) => o.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
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

  return {
    activeSeconds: Math.round(totalMs / 1000),
    sessionCount: sessions,
  };
}

export function analyzeDocumentHistory(
  history: RawDocumentHistory,
  partialSettings?: Partial<AnalysisSettings>
): DocumentAnalysis {
  const settings: AnalysisSettings = {
    ...DEFAULT_SETTINGS,
    ...partialSettings,
  };

  const getAuthor = resolveAuthorResolver(history.userMap || {});
  const parsed = parseDocumentHistory(history);
  const recon = reconstructDocument(
    parsed.baselineText,
    parsed.operations,
    settings.bulkThresholdChars,
    getAuthor
  );

  const sessions = computeSessions(
    parsed.operations,
    settings.sessionGapMinutes,
    settings.bulkThresholdChars,
    getAuthor
  );

  const totalActiveSeconds = sessions.reduce((acc, s) => acc + s.durationSeconds, 0);
  const totalActiveMinutes = Math.round((totalActiveSeconds / 60) * 10) / 10;

  const timedOps = parsed.operations.filter((o) => o.timestamp > 0);
  const firstEditTime = timedOps.length > 0 ? timedOps[0].timestamp : null;
  const lastEditTime =
    timedOps.length > 0 ? timedOps[timedOps.length - 1].timestamp : null;
  const elapsedSpanMinutes =
    firstEditTime !== null && lastEditTime !== null
      ? Math.max(0, Math.round((lastEditTime - firstEditTime) / 60_000))
      : 0;

  // Composition of final non-whitespace characters
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

  const totalNonWsFinal =
    progressiveFinalChars + bulkFinalChars + templateFinalChars;
  const authoredNonWsFinal = progressiveFinalChars + bulkFinalChars;

  const progressivePct =
    totalNonWsFinal > 0
      ? Math.round((progressiveFinalChars / totalNonWsFinal) * 100)
      : 0;
  const templatePct =
    totalNonWsFinal > 0
      ? Math.round((templateFinalChars / totalNonWsFinal) * 100)
      : 0;
  const bulkPct =
    totalNonWsFinal > 0
      ? Math.max(0, 100 - progressivePct - templatePct)
      : 0;

  // Build timeline points (downsampled to <= 120 points while always preserving bulk insertion points!)
  const bulkByOpId = new Map<number, BulkInsertion>();
  for (const b of recon.bulkInsertions) {
    bulkByOpId.set(b.opId, b);
  }

  const findSessionIdx = (ts: number): number => {
    for (const s of sessions) {
      if (ts >= s.startTime && ts <= s.endTime) return s.index;
    }
    return 1;
  };

  const stride = Math.max(1, Math.ceil(recon.opTimelineStates.length / 100));
  const timeline: TimelinePoint[] = [];

  if (parsed.baselineText.trim().length > 0) {
    const baseClean = parsed.baselineText.replace(/\n+$/, '');
    timeline.push({
      index: 0,
      revisionId: Math.max(0, history.firstRev - 1),
      timestamp: firstEditTime ?? Date.now(),
      sessionIndex: 1,
      wordCount: countWords(baseClean),
      charCount: baseClean.length,
    });
  }

  for (let i = 0; i < recon.opTimelineStates.length; i++) {
    const st = recon.opTimelineStates[i];
    const bulk = bulkByOpId.get(st.op.id);
    const keep =
      Boolean(bulk) ||
      i === 0 ||
      i === recon.opTimelineStates.length - 1 ||
      i % stride === 0;

    if (keep) {
      timeline.push({
        index: timeline.length,
        revisionId: st.op.revisionId,
        timestamp: st.op.timestamp,
        sessionIndex: findSessionIdx(st.op.timestamp),
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
  }

  // Author breakdown
  const opsByAuthor = new Map<string, NormalizedOp[]>();
  for (const op of parsed.operations) {
    const list = opsByAuthor.get(op.userId) ?? [];
    list.push(op);
    opsByAuthor.set(op.userId, list);
  }

  const totalOps = parsed.operations.length;
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
        if (op.type === 'insert') {
          if ((op.text?.trim().length ?? 0) >= settings.bulkThresholdChars) {
            bulkCharsInserted += op.charCount;
          } else {
            progressiveCharsInserted += op.charCount;
          }
        }
      }

      const survivingFinalChars = survivingByAuthor.get(userId) ?? 0;

      return {
        userId,
        name: info.name,
        color: info.color,
        operationCount: authorOps.length,
        operationSharePct:
          totalOps > 0 ? Math.round((authorOps.length / totalOps) * 100) : 0,
        activeMinutes: Math.round((activeSeconds / 60) * 10) / 10,
        sessionCount: aSessions,
        progressiveCharsInserted,
        bulkCharsInserted,
        charsDeleted: recon.deletedCharsByAuthor.get(userId) ?? 0,
        survivingFinalChars,
        survivingSharePct:
          authoredNonWsFinal > 0
            ? Math.round((survivingFinalChars / authoredNonWsFinal) * 100)
            : 0,
      };
    })
    .sort((a, b) => b.survivingFinalChars - a.survivingFinalChars || b.operationCount - a.operationCount);

  // Coverage / quality indicators
  const coverageNotes: string[] = [];
  const hasTemplateBaseline = parsed.baselineText.trim().length > 0;
  if (hasTemplateBaseline) {
    coverageNotes.push(
      `El document parteix d'una plantilla o còpia inicial (revisió ${history.firstRev}) identificada per separat.`
    );
  }
  if (recon.clampedOperations > 0) {
    coverageNotes.push(
      `S'han ajustat ${recon.clampedOperations} posicions associades a elements especials (taules, imatges o capçaleres).`
    );
  }
  if (parsed.operations.length <= 3 && countWords(recon.finalPlainText) > 80) {
    coverageNotes.push(
      'L’historial registrat té molt poques revisions per a la llargada del text (possible còpia d’un altre fitxer o sincronització fora de línia).'
    );
  }

  let coverageLevel: HistoryCoverage['level'] = 'alta';
  let coverageLabel = 'Historial complet';
  if (parsed.operations.length === 0 && !hasTemplateBaseline) {
    coverageLevel = 'limitada';
    coverageLabel = 'Sense edicions registrades';
  } else if (
    (parsed.operations.length <= 2 && countWords(recon.finalPlainText) > 100) ||
    recon.clampedOperations > parsed.operations.length * 0.15
  ) {
    coverageLevel = 'parcial';
    coverageLabel = 'Cobertura parcial';
  } else if (hasTemplateBaseline) {
    coverageLabel = 'Complet (amb plantilla base)';
  }

  return {
    docId: history.docId,
    title: history.title || 'Document sense títol',
    tabId: history.tabId,
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
    totalOperations: parsed.operations.length,

    progressiveFinalChars,
    bulkFinalChars,
    templateFinalChars,
    progressivePct,
    bulkPct,
    templatePct,

    bulkInsertions: recon.bulkInsertions,
    allCandidateInsertions: recon.allCandidateInsertions,
    sessions,
    timeline,
    authors,
    paragraphs: recon.paragraphs,
    replayCheckpoints: recon.replayCheckpoints,
    finalPlainText: recon.finalPlainText,
    coverage: {
      level: coverageLevel,
      label: coverageLabel,
      notes: coverageNotes,
      hasTemplateBaseline,
      clampedOperations: recon.clampedOperations,
      totalRawEntries: parsed.totalRawEntries,
    },
  };
}
