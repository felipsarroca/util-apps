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
import { countWords, TEMPLATE_USER } from './parser';

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
/** Temps màxim entre retallar i enganxar perquè es consideri un moviment intern. */
const MOVE_WINDOW_MS = 2 * 60 * 60_000;
/** Mida mínima perquè un fragment esborrat es recordi com a possible origen d'un moviment. */
const MIN_REMEMBERED_DELETE = 12;

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
    if (userId === TEMPLATE_USER) {
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
  opId: number; // 0 = plantilla inicial
  userId: string;
  timestamp: number;
  insertedLength: number; // mida de la inserció original
  moved?: boolean;
}

/** Com es col·loca cada objecte de text al resultat final (null = no visible, p. ex. dissenys). */
export interface ObjectPlacement {
  order: number;
  slideNumber?: number;
  isNotes?: boolean;
  tabName?: string;
}

export type PlacementResolver = (objectId: string) => ObjectPlacement | null;

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
  /** Insercions identificades com a text mogut o duplicat dins del mateix fitxer. */
  movedOpIds: Set<number>;
  movedChars: number;
  /** Caràcters finals per objecte (per a estadístiques de diapositives). */
  finalCharsByObject: Map<string, TrackedChar[]>;
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

const defaultPlacement: PlacementResolver = () => ({ order: 0 });

function stripTrailingNewlines(chars: TrackedChar[]): TrackedChar[] {
  let len = chars.length;
  while (len > 0 && chars[len - 1].ch === '\n') len--;
  return chars.slice(0, len);
}

function charsToText(chars: TrackedChar[]): string {
  let s = '';
  for (let i = 0; i < chars.length; i++) s += chars[i].ch;
  return s;
}

export function reconstructDocument(
  baseline: string | Map<string, string>,
  operations: NormalizedOp[],
  bulkThresholdChars: number,
  getAuthor: (userId: string) => ResolvedAuthor,
  placement: PlacementResolver = defaultPlacement
): ReconstructionResult {
  const buffers = new Map<string, TrackedChar[]>();
  const getBuffer = (objectId: string): TrackedChar[] => {
    let b = buffers.get(objectId);
    if (!b) {
      b = [];
      buffers.set(objectId, b);
    }
    return b;
  };

  const baselineMap =
    typeof baseline === 'string' ? new Map(baseline ? [['', baseline]] : []) : baseline;
  for (const [objectId, text] of baselineMap) {
    const buf = getBuffer(objectId);
    for (let i = 0; i < text.length; i++) {
      buf.push({ ch: text[i], opId: 0, userId: TEMPLATE_USER, timestamp: 0, insertedLength: text.length });
    }
  }

  const hasMultipleObjects = () => buffers.size > 1;

  const visibleObjects = (): Array<{ id: string; place: ObjectPlacement }> => {
    const list: Array<{ id: string; place: ObjectPlacement }> = [];
    for (const id of buffers.keys()) {
      const place = placement(id);
      if (place) list.push({ id, place });
    }
    list.sort((a, b) => a.place.order - b.place.order);
    return list;
  };

  const composeCurrentText = (): string => {
    if (!hasMultipleObjects()) {
      const only = buffers.keys().next().value;
      if (only === undefined || !placement(only)) return '';
      return charsToText(buffers.get(only) ?? []).replace(/\n+$/, '');
    }
    const parts: string[] = [];
    let lastHeader = '';
    for (const { id, place } of visibleObjects()) {
      const text = charsToText(buffers.get(id) ?? []).replace(/\n+$/, '').trim();
      if (!text) continue;
      const header =
        place.slideNumber !== undefined
          ? `— Diapositiva ${place.slideNumber}${place.isNotes ? ' (notes)' : ''} —`
          : place.tabName
            ? `— ${place.tabName} —`
            : '';
      if (header && header !== lastHeader) {
        parts.push(header);
        lastHeader = header;
      }
      parts.push(text);
    }
    return parts.join('\n');
  };

  let clampedOperations = 0;
  const candidateOps: NormalizedOp[] = [];
  const movedOpIds = new Set<number>();
  let movedChars = 0;
  const opTimelineStates: Array<{ op: NormalizedOp; wordCount: number; charCount: number }> = [];
  const deletedCharsByAuthor = new Map<string, number>();
  const recentDeletes: Array<{ chars: TrackedChar[]; text: string; timestamp: number }> = [];

  const checkpointStride = Math.max(1, Math.ceil(operations.length / 80));
  const replayCheckpoints: ReplayCheckpoint[] = [];

  const initialText = composeCurrentText();
  if (initialText.trim().length > 0) {
    replayCheckpoints.push({
      stepIndex: 0,
      revisionId: 0,
      timestamp: operations.find((o) => !o.isTemplate)?.timestamp ?? Date.now(),
      userId: TEMPLATE_USER,
      authorName: 'Plantilla inicial',
      wordCount: countWords(initialText),
      charCount: initialText.length,
      text: initialText,
      isBulkStep: false,
      deltaSummary: `Plantilla base (${countWords(initialText)} paraules)`,
    });
  }

  let totalCharCount = Array.from(buffers.values()).reduce((a, b) => a + b.length, 0);

  /** Cerca si un text inserit ja existia al fitxer (esborrat fa poc o duplicat). */
  const findInternalSource = (core: string, now: number): TrackedChar[] | null => {
    for (let d = recentDeletes.length - 1; d >= 0; d--) {
      const del = recentDeletes[d];
      if (now - del.timestamp > MOVE_WINDOW_MS) continue;
      const at = del.text.indexOf(core);
      if (at >= 0) return del.chars.slice(at, at + core.length);
    }
    // Un text que ja era al fitxer i es torna a enganxar (duplicat intern)
    for (const buf of buffers.values()) {
      const at = charsToText(buf).indexOf(core);
      if (at >= 0) return buf.slice(at, at + core.length);
    }
    return null;
  };

  for (let idx = 0; idx < operations.length; idx++) {
    const op = operations[idx];
    const buffer = getBuffer(op.objectId);

    if (op.type === 'insert') {
      const text = op.text ?? '';
      const rawPos = op.index - 1; // 1-based -> 0-based
      const insertPos = Math.max(0, Math.min(rawPos, buffer.length));
      if (insertPos !== rawPos && rawPos > buffer.length + 1) {
        clampedOperations++;
      }

      const trimmedLen = text.trim().length;
      let source: TrackedChar[] | null = null;
      let coreOffset = 0;
      if (!op.isTemplate && trimmedLen >= MIN_CANDIDATE_INSERT_CHARS) {
        const core = text.trim();
        coreOffset = text.indexOf(core);
        source = findInternalSource(core, op.timestamp);
        if (source) {
          movedOpIds.add(op.id);
          movedChars += trimmedLen;
        } else {
          candidateOps.push(op);
        }
      }

      const newItems: TrackedChar[] = new Array(text.length);
      for (let c = 0; c < text.length; c++) {
        const src = source ? source[c - coreOffset] : undefined;
        if (src && src.ch === text[c]) {
          newItems[c] = { ...src, moved: true };
        } else if (op.isTemplate) {
          newItems[c] = { ch: text[c], opId: 0, userId: TEMPLATE_USER, timestamp: 0, insertedLength: trimmedLen };
        } else {
          newItems[c] = {
            ch: text[c],
            opId: op.id,
            userId: op.userId,
            timestamp: op.timestamp,
            // Els caràcters d'un moviment intern que no coincideixen compten com a escriptura pròpia
            insertedLength: source ? 1 : trimmedLen,
          };
        }
      }

      if (newItems.length < 4000) {
        buffer.splice(insertPos, 0, ...newItems);
      } else {
        const tail = buffer.splice(insertPos);
        for (let k = 0; k < newItems.length; k++) buffer.push(newItems[k]);
        for (let k = 0; k < tail.length; k++) buffer.push(tail[k]);
      }
      totalCharCount += newItems.length;
    } else {
      const rawStart = op.index - 1;
      const rawEndExclusive = op.endIndex ?? op.index; // 1-based inclusiu == 0-based exclusiu
      const start = Math.max(0, Math.min(rawStart, buffer.length));
      const endExclusive = Math.max(start, Math.min(rawEndExclusive, buffer.length));

      if (rawStart < 0 || rawEndExclusive > buffer.length + 1) {
        clampedOperations++;
      }

      const removedCount = endExclusive - start;
      if (removedCount > 0) {
        const removed = buffer.splice(start, removedCount);
        totalCharCount -= removedCount;
        if (!op.isTemplate) {
          deletedCharsByAuthor.set(op.userId, (deletedCharsByAuthor.get(op.userId) ?? 0) + removedCount);
        }
        if (removedCount >= MIN_REMEMBERED_DELETE) {
          recentDeletes.push({ chars: removed, text: charsToText(removed), timestamp: op.timestamp });
          if (recentDeletes.length > 60) recentDeletes.shift();
        }
      }
    }

    const isBulkOp =
      op.type === 'insert' &&
      !op.isTemplate &&
      !movedOpIds.has(op.id) &&
      (op.text?.trim().length ?? 0) >= bulkThresholdChars;
    const isCheckpoint =
      isBulkOp || idx === 0 || idx === operations.length - 1 || idx % checkpointStride === 0;

    if (isCheckpoint) {
      const currentText = composeCurrentText();
      const wc = countWords(currentText);
      const author = getAuthor(op.isTemplate ? TEMPLATE_USER : op.userId);
      opTimelineStates.push({ op, wordCount: wc, charCount: currentText.length });

      const deltaSummary =
        op.type === 'insert'
          ? isBulkOp
            ? `Inserció en bloc (+${op.wordCount} paraules)`
            : movedOpIds.has(op.id)
              ? `Text reubicat (${op.wordCount} paraules)`
              : `+${op.charCount} caràcters`
          : `Esborrat (−${op.charCount} caràcters)`;

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
      const prevWc =
        opTimelineStates.length > 0 ? opTimelineStates[opTimelineStates.length - 1].wordCount : 0;
      const deltaW =
        op.type === 'insert' ? op.wordCount : -Math.max(0, Math.round(op.charCount / 6));
      opTimelineStates.push({
        op,
        wordCount: Math.max(0, prevWc + deltaW),
        charCount: totalCharCount,
      });
    }
  }

  // Resultat final: objectes visibles en ordre, separats per salts de línia
  const finalCharsByObject = new Map<string, TrackedChar[]>();
  const orderedObjects = visibleObjects();

  const finalChars: TrackedChar[] = [];
  const paragraphs: ParagraphBlock[] = [];
  const survivingByOpId = new Map<number, number>();
  const firstParagraphByOpId = new Map<number, number>();
  const firstSlideByOpId = new Map<number, number>();
  let paragraphCounter = 0;

  const flushParagraph = (charsInPara: TrackedChar[], place: ObjectPlacement) => {
    const plain = charsToText(charsInPara);
    if (plain.trim().length === 0) return;

    paragraphCounter++;
    const pNum = paragraphCounter;

    for (const item of charsInPara) {
      if (/\S/.test(item.ch)) {
        survivingByOpId.set(item.opId, (survivingByOpId.get(item.opId) ?? 0) + 1);
        if (!firstParagraphByOpId.has(item.opId)) {
          firstParagraphByOpId.set(item.opId, pNum);
          if (place.slideNumber !== undefined) firstSlideByOpId.set(item.opId, place.slideNumber);
        }
      }
    }

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
        prev.authorId === item.userId &&
        Boolean(prev.moved) === Boolean(item.moved)
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
          moved: item.moved || undefined,
        });
      }
    }

    paragraphs.push({
      paragraphNumber: pNum,
      segments,
      plainText: plain,
      hasBulk,
      slideNumber: place.slideNumber,
      isNotes: place.isNotes,
      tabName: place.tabName,
    });
  };

  for (const { id, place } of orderedObjects) {
    const chars = stripTrailingNewlines(buffers.get(id) ?? []);
    finalCharsByObject.set(id, chars);
    if (chars.length === 0) continue;
    if (finalChars.length > 0) {
      finalChars.push({ ch: '\n', opId: 0, userId: TEMPLATE_USER, timestamp: 0, insertedLength: 0 });
    }
    for (const c of chars) finalChars.push(c);

    let current: TrackedChar[] = [];
    for (const item of chars) {
      if (item.ch === '\n' || item.ch === '\u000b') {
        flushParagraph(current, place);
        current = [];
      } else {
        current.push(item);
      }
    }
    flushParagraph(current, place);
  }

  const finalPlainText = charsToText(finalChars);

  const allCandidateInsertions: BulkInsertion[] = candidateOps.map((op) => {
    const rawText = op.text ?? '';
    const nonWsOriginal = rawText.replace(/\s+/g, '').length;
    const survivingNonWs = survivingByOpId.get(op.id) ?? 0;
    const ratio = nonWsOriginal > 0 ? Math.min(1, survivingNonWs / nonWsOriginal) : 0;
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
      slideNumber: status === 'eliminat' ? null : (firstSlideByOpId.get(op.id) ?? null),
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
    movedOpIds,
    movedChars,
    finalCharsByObject,
  };
}
