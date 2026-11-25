// SPDX-License-Identifier: AGPL-3.0-or-later
import type { StoredSummary } from '../types';

/**
 * Taula de la classe: resums compactes (sense el text de l'alumnat) desats només
 * en aquest navegador, a chrome.storage.local.
 */
const CLASS_KEY = 'traces_class_v1';
const DUE_KEY = 'traces_due_v1';
const MANUAL_DUE_KEY = 'traces_due_manual_v1';
/** Màxim de resums desats (els més antics s'eliminen). */
const MAX_SUMMARIES = 600;

function hasStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

export async function loadClassSummaries(): Promise<Record<string, StoredSummary>> {
  if (!hasStorage()) return {};
  try {
    const res = await chrome.storage.local.get(CLASS_KEY);
    return (res?.[CLASS_KEY] as Record<string, StoredSummary>) ?? {};
  } catch {
    return {};
  }
}

export async function saveClassSummary(summary: StoredSummary): Promise<void> {
  if (!hasStorage()) return;
  const all = await loadClassSummaries();
  all[summary.docId] = summary;
  const entries = Object.values(all);
  if (entries.length > MAX_SUMMARIES) {
    entries.sort((a, b) => b.analyzedAt - a.analyzedAt);
    const keep = new Set(entries.slice(0, MAX_SUMMARIES).map((e) => e.docId));
    for (const id of Object.keys(all)) if (!keep.has(id)) delete all[id];
  }
  await chrome.storage.local.set({ [CLASS_KEY]: all });
}

export async function removeClassSummaries(docIds: string[] | 'all'): Promise<void> {
  if (!hasStorage()) return;
  if (docIds === 'all') {
    await chrome.storage.local.remove(CLASS_KEY);
    return;
  }
  const all = await loadClassSummaries();
  for (const id of docIds) delete all[id];
  await chrome.storage.local.set({ [CLASS_KEY]: all });
}

/** Text de la data de lliurament llegit a Classroom (o data posada a mà, en ms). */
export async function loadDueInfo(docId: string): Promise<{ text?: string; manual?: number }> {
  if (!hasStorage()) return {};
  try {
    const res = await chrome.storage.local.get([DUE_KEY, MANUAL_DUE_KEY]);
    const auto = (res?.[DUE_KEY] as Record<string, { text: string }> | undefined)?.[docId];
    const manual = (res?.[MANUAL_DUE_KEY] as Record<string, number> | undefined)?.[docId];
    return { text: auto?.text, manual };
  } catch {
    return {};
  }
}

export async function saveManualDue(docId: string, ts: number | null): Promise<void> {
  if (!hasStorage()) return;
  const res = await chrome.storage.local.get(MANUAL_DUE_KEY);
  const map = (res?.[MANUAL_DUE_KEY] as Record<string, number>) ?? {};
  if (ts === null) delete map[docId];
  else map[docId] = ts;
  await chrome.storage.local.set({ [MANUAL_DUE_KEY]: map });
}
