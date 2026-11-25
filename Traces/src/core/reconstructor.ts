// SPDX-License-Identifier: AGPL-3.0-or-later
import type {
  BulkInsertion,
  NormalizedOp,
  ParagraphBlock,
  RawUserInfo,
  ReplayCheckpoint,
  RetentionStatus,
  TextSegment,
} from '../types';
import { countWords } from './parser';

const AUTHOR_PALETTE = [
  '#0284C7', // blau oceà
  '#0D9488', // verd maragda
  '#7C3AED', // violeta
  '#DB2777', // robí
  '#EA580C', // coure
  '#4F46E5', // indi
  '#059669', // sàlvia
  '#B45309', // ocre
];

export const MIN_CANDIDATE_INSERT_CHARS = 25;

export interface ResolvedAuthor {
  userId: string;
  name: string;
  color: string;
}

export function resolveAuthorResolver(
  userMap: Record<string, RawUserInfo>
): (userId: string) => ResolvedAuthor {
  const cache = new Map<string, ResolvedAuthor>();
  let colorCursor = 0;
  let anonIndex = 1;

  return (userId: string): ResolvedAuthor => {
    if (userId === '__plantilla__') {
      return {
        userId,
        name: 'Plantilla inicial',
        color: '#64748B',
      };
    }
    const existing = cache.get(userId);
    if (existing) return existing;

    const raw = userMap?.[userId];
    const fallbackColor = AUTHOR_PALETTE[colorCursor++ % AUTHOR_PALETTE.length];
    const name =
      raw?.name && raw.name.trim() && !raw.anonymous
        ? raw.name.trim()
        : raw?.anonymous
          ? `Usuari anònim ${anonIndex++}`
          : userId === 'desconegut'
            ? 'Autor no identificat'
            : `Editor ${anonIndex++}`;

    const resolved: ResolvedAuthor = {
      userId,
      name,
      color: raw?.color && /^#[0-9a-fA-F]{3,8}$/.test(raw.color) ? raw.color : fallbackColor,
    };
    cache.set(userId, resolved);
    return resolved;
  };
}

export interface TrackedChar {
  ch: string;
  opId: number; // 0 = baseline template snapshot
  userId: string;
  timestamp: number;
  insertedLength: number; // length of the original insert op
}

export interface ReconstructionResult {
  finalChars: TrackedChar[];
  finalPlainText: string;
  clampedOperations: number;
  paragraphs: ParagraphBlock[];
  bulkInsertions: BulkInsertion[];
  allCandidateInsertions: BulkInsertion[];
  replayCheckpoints: ReplayCheckpoint[];
  opTimelineStates: Array<{
    op: NormalizedOp;
    wordCount: number;
    charCount: number;
  }>;
  deletedCharsByAuthor: Map<string, number>;
}

function classifyRetention(ratio: number, survivingChars: number): RetentionStatus {
  if (survivingChars === 0 || ratio < 0.15) return 'eliminat';
  if (ratio >= 0.85) return 'conservat';
  return 'reelaborat';
}

function buildPreviewSnippet(text: string, maxLen = 180): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen).trimEnd()}…`;
}

export function reconstructDocument(
  baselineText: string,
  operations: NormalizedOp[],
  bulkThresholdChars: number,
  getAuthor: (userId: string) => ResolvedAuthor
): ReconstructionResult {
  // EndOfBody sentinel kept at the end, matching Google Docs 1-based OT semantics
  const buffer: TrackedChar[] = [];

  if (baselineText.length > 0) {
    for (let i = 0; i < baselineText.length; i++) {
      buffer.push({
        ch: baselineText[i],
        opId: 0,
        userId: '__plantilla__',
        timestamp: 0,
        insertedLength: baselineText.length,
      });
    }
  }

  let clampedOperations = 0;
  const candidateOps: NormalizedOp[] = [];
  const opTimelineStates: Array<{ op: NormalizedOp; wordCount: number; charCount: number }> = [];
  const deletedCharsByAuthor = new Map<string, number>();

  // Prepare checkpoints (~80 max steps for smooth, lightweight slider replay)
  const checkpointStride = Math.max(1, Math.ceil(operations.length / 80));
  const replayCheckpoints: ReplayCheckpoint[] = [];

  if (baselineText.length > 0) {
    const cleanBase = baselineText.replace(/\n+$/, '');
    replayCheckpoints.push({
      stepIndex: 0,
      revisionId: 0,
      timestamp: operations[0]?.timestamp ?? Date.now(),
      userId: '__plantilla__',
      authorName: 'Plantilla inicial',
      wordCount: countWords(cleanBase),
      charCount: cleanBase.length,
      text: cleanBase,
      isBulkStep: false,
      deltaSummary: `Plantilla base (${countWords(cleanBase)} paraules)`,
    });
  }

  // Rolling word/char count maintenance without re-joining huge strings on every single keystroke
  let currentCharCount = buffer.length;

  for (let idx = 0; idx < operations.length; idx++) {
    const op = operations[idx];

    if (op.type === 'insert') {
      const text = op.text ?? '';
      const rawPos = op.index - 1; // 1-based -> 0-based
      const insertPos = Math.max(0, Math.min(rawPos, buffer.length));
      if (insertPos !== rawPos && rawPos > buffer.length + 1) {
        clampedOperations++;
      }

      const trimmedLen = text.trim().length;
      if (trimmedLen >= MIN_CANDIDATE_INSERT_CHARS) {
        candidateOps.push(op);
      }

      const newItems: TrackedChar[] = new Array(text.length);
      for (let c = 0; c < text.length; c++) {
        newItems[c] = {
          ch: text[c],
          opId: op.id,
          userId: op.userId,
          timestamp: op.timestamp,
          insertedLength: trimmedLen,
        };
      }

      // Splice safely even for large pastes (avoid argument limit of spread operator)
      if (newItems.length < 4000) {
        buffer.splice(insertPos, 0, ...newItems);
      } else {
        const tail = buffer.splice(insertPos);
        for (let k = 0; k < newItems.length; k++) buffer.push(newItems[k]);
        for (let k = 0; k < tail.length; k++) buffer.push(tail[k]);
      }
      currentCharCount = buffer.length;
    } else {
      const rawStart = op.index - 1;
      const rawEndExclusive = op.endIndex ?? op.index; // 1-based inclusive endIndex == 0-based exclusive!
      const start = Math.max(0, Math.min(rawStart, buffer.length));
      const endExclusive = Math.max(start, Math.min(rawEndExclusive, buffer.length));

      if (rawStart < 0 || rawEndExclusive > buffer.length + 1) {
        clampedOperations++;
      }

      const removedCount = endExclusive - start;
      if (removedCount > 0) {
        buffer.splice(start, removedCount);
        deletedCharsByAuthor.set(
          op.userId,
          (deletedCharsByAuthor.get(op.userId) ?? 0) + removedCount
        );
      }
      currentCharCount = buffer.length;
    }

    const isBulkOp =
      op.type === 'insert' && (op.text?.trim().length ?? 0) >= bulkThresholdChars;
    const isCheckpoint =
      isBulkOp || idx === 0 || idx === operations.length - 1 || idx % checkpointStride === 0;

    if (isCheckpoint) {
      const currentText = buffer.map((x) => x.ch).join('').replace(/\n+$/, '');
      const wc = countWords(currentText);
      const author = getAuthor(op.userId);
      opTimelineStates.push({
        op,
        wordCount: wc,
        charCount: currentText.length,
      });

      const deltaSummary =
        op.type === 'insert'
          ? isBulkOp
            ? `Inserció en bloc (+${op.wordCount} par. / ${op.charCount} car.)`
            : `+${op.charCount} car.`
          : `Supressió (−${op.charCount} car.)`;

      replayCheckpoints.push({
        stepIndex: replayCheckpoints.length,
        revisionId: op.revisionId,
        timestamp: op.timestamp,
        userId: op.userId,
        authorName: author.name,
        wordCount: wc,
        charCount: currentText.length,
        text: currentText,
        isBulkStep: isBulkOp,
        deltaSummary,
      });
    } else {
      // Lightweight word approximation between checkpoints
      const prevWc =
        opTimelineStates.length > 0
          ? opTimelineStates[opTimelineStates.length - 1].wordCount
          : 0;
      const deltaW =
        op.type === 'insert'
          ? op.wordCount
          : -Math.max(0, Math.round(op.charCount / 6));
      opTimelineStates.push({
        op,
        wordCount: Math.max(0, prevWc + deltaW),
        charCount: currentCharCount,
      });
    }
  }

  // Strip trailing structural newline(s) from final buffer for presentation
  let effectiveLen = buffer.length;
  while (effectiveLen > 0 && buffer[effectiveLen - 1].ch === '\n') {
    effectiveLen--;
  }
  const finalChars = buffer.slice(0, effectiveLen);
  const finalPlainText = finalChars.map((c) => c.ch).join('');

  // Map each surviving character to its 1-based non-empty paragraph number & count surviving non-whitespace chars per opId
  const survivingByOpId = new Map<number, number>();
  const firstParagraphByOpId = new Map<number, number>();

  const paragraphs: ParagraphBlock[] = [];
  let rawParagraphChars: TrackedChar[] = [];
  let paragraphCounter = 0;

  const flushParagraph = (charsInPara: TrackedChar[]) => {
    const plain = charsInPara.map((c) => c.ch).join('');
    if (plain.trim().length === 0) return;

    paragraphCounter++;
    const pNum = paragraphCounter;

    // Record surviving stats per opId
    for (const item of charsInPara) {
      if (/\S/.test(item.ch)) {
        survivingByOpId.set(item.opId, (survivingByOpId.get(item.opId) ?? 0) + 1);
        if (!firstParagraphByOpId.has(item.opId)) {
          firstParagraphByOpId.set(item.opId, pNum);
        }
      }
    }

    // Group contiguous chars into clean visual segments
    const segments: TextSegment[] = [];
    let hasBulk = false;

    for (const item of charsInPara) {
      const origin: TextSegment['origin'] =
        item.opId === 0
          ? 'template'
          : item.insertedLength >= bulkThresholdChars
            ? 'bulk'
            : 'progressive';

      if (origin === 'bulk') hasBulk = true;
      const bulkOpId = origin === 'bulk' ? item.opId : undefined;
      const prev = segments[segments.length - 1];

      if (
        prev &&
        prev.origin === origin &&
        prev.bulkOpId === bulkOpId &&
        prev.authorId === item.userId
      ) {
        prev.text += item.ch;
      } else {
        const author = getAuthor(item.userId);
        segments.push({
          text: item.ch,
          origin,
          bulkOpId,
          authorId: item.userId,
          authorName: author.name,
          authorColor: author.color,
          timestamp: item.timestamp,
        });
      }
    }

    paragraphs.push({
      paragraphNumber: pNum,
      segments,
      plainText: plain,
      hasBulk,
    });
  };

  for (let i = 0; i < finalChars.length; i++) {
    const item = finalChars[i];
    if (item.ch === '\n') {
      flushParagraph(rawParagraphChars);
      rawParagraphChars = [];
    } else {
      rawParagraphChars.push(item);
    }
  }
  flushParagraph(rawParagraphChars);

  // Build candidate & thresholded bulk insertions
  const allCandidateInsertions: BulkInsertion[] = candidateOps.map((op) => {
    const rawText = op.text ?? '';
    const nonWsOriginal = rawText.replace(/\s+/g, '').length;
    const survivingNonWs = survivingByOpId.get(op.id) ?? 0;
    const ratio =
      nonWsOriginal > 0 ? Math.min(1, survivingNonWs / nonWsOriginal) : 0;
    const status = classifyRetention(ratio, survivingNonWs);
    const author = getAuthor(op.userId);

    return {
      opId: op.id,
      revisionId: op.revisionId,
      timestamp: op.timestamp,
      userId: op.userId,
      authorName: author.name,
      authorColor: author.color,
      originalText: rawText,
      charCount: rawText.trim().length,
      wordCount: op.wordCount,
      survivingChars: survivingNonWs,
      retentionRatio: ratio,
      status,
      paragraphNumber: status === 'eliminat' ? null : (firstParagraphByOpId.get(op.id) ?? null),
      previewSnippet: buildPreviewSnippet(rawText),
    };
  });

  const bulkInsertions = allCandidateInsertions.filter(
    (ins) => ins.charCount >= bulkThresholdChars
  );

  return {
    finalChars,
    finalPlainText,
    clampedOperations,
    paragraphs,
    bulkInsertions,
    allCandidateInsertions,
    replayCheckpoints,
    opTimelineStates,
    deletedCharsByAuthor,
  };
}
