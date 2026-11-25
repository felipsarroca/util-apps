// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NormalizedOp, RawChangelogEntry, RawDocumentHistory, RawOperation } from '../types';

export function stripXssiPrefix(rawText: string): string {
  return rawText.replace(/^\)\]\}'[^\n]*\n?/, '').trim();
}

export function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export interface ParsedHistoryStream {
  baselineText: string;
  operations: NormalizedOp[];
  totalRawEntries: number;
}

function flattenRawOperation(
  rawOp: RawOperation,
  out: Array<{ type: 'insert' | 'delete'; index: number; endIndex?: number; text?: string; isSuggestion: boolean }>
): void {
  if (!rawOp || typeof rawOp !== 'object') return;
  const ty = rawOp.ty;

  if (ty === 'mlti' && Array.isArray(rawOp.mts)) {
    for (const child of rawOp.mts) {
      flattenRawOperation(child, out);
    }
    return;
  }

  if ((ty === 'is' || ty === 'iss') && typeof rawOp.s === 'string') {
    if (rawOp.s.length === 0) return;
    const index = typeof rawOp.ibi === 'number' ? rawOp.ibi : 1;
    out.push({
      type: 'insert',
      index,
      text: rawOp.s,
      isSuggestion: ty === 'iss',
    });
    return;
  }

  if ((ty === 'ds' || ty === 'dss') && typeof rawOp.si === 'number' && typeof rawOp.ei === 'number') {
    if (rawOp.ei < rawOp.si) return;
    out.push({
      type: 'delete',
      index: rawOp.si,
      endIndex: rawOp.ei,
      isSuggestion: ty === 'dss',
    });
  }
}

export function extractBaselineSnapshotText(chunkedSnapshot?: RawOperation[][]): string {
  if (!Array.isArray(chunkedSnapshot) || chunkedSnapshot.length === 0) {
    return '';
  }

  const pieces: string[] = [];
  for (const chunk of chunkedSnapshot) {
    if (!Array.isArray(chunk)) continue;
    for (const op of chunk) {
      if (op && (op.ty === 'is' || op.ty === 'iss') && typeof op.s === 'string') {
        pieces.push(op.s);
      }
    }
  }
  return pieces.join('');
}

export function parseDocumentHistory(history: RawDocumentHistory): ParsedHistoryStream {
  const baselineText = extractBaselineSnapshotText(history.chunkedSnapshot);
  const operations: NormalizedOp[] = [];
  let nextOpId = 1;

  const changelog: RawChangelogEntry[] = Array.isArray(history.changelog) ? history.changelog : [];

  for (let i = 0; i < changelog.length; i++) {
    const entry = changelog[i];
    if (!Array.isArray(entry) || entry.length < 2) continue;

    const rawOp = entry[0];
    const timestamp = typeof entry[1] === 'number' ? entry[1] : 0;
    const userId = entry[2] !== undefined && entry[2] !== null ? String(entry[2]) : 'desconegut';
    const revisionId = typeof entry[3] === 'number' ? entry[3] : history.firstRev + i;
    const sessionId = entry[4] ? String(entry[4]) : '';

    const atomicList: Array<{
      type: 'insert' | 'delete';
      index: number;
      endIndex?: number;
      text?: string;
      isSuggestion: boolean;
    }> = [];

    flattenRawOperation(rawOp, atomicList);

    for (const item of atomicList) {
      if (item.type === 'insert') {
        const text = item.text ?? '';
        operations.push({
          id: nextOpId++,
          revisionId,
          timestamp,
          userId,
          sessionId,
          type: 'insert',
          index: item.index,
          text,
          charCount: text.length,
          wordCount: countWords(text),
          isSuggestion: item.isSuggestion,
        });
      } else {
        const start = item.index;
        const end = item.endIndex ?? start;
        const count = Math.max(0, end - start + 1);
        operations.push({
          id: nextOpId++,
          revisionId,
          timestamp,
          userId,
          sessionId,
          type: 'delete',
          index: start,
          endIndex: end,
          charCount: count,
          wordCount: 0,
          isSuggestion: item.isSuggestion,
        });
      }
    }
  }

  return {
    baselineText,
    operations,
    totalRawEntries: changelog.length,
  };
}
