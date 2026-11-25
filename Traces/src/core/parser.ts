// SPDX-License-Identifier: AGPL-3.0-or-later
import type {
  DocTabInfo,
  NormalizedOp,
  RawChangelogEntry,
  RawDocumentHistory,
  RawOperation,
} from '../types';

export function stripXssiPrefix(rawText: string): string {
  return rawText.replace(/^\)\]\}'[^\n]*\n?/, '').trim();
}

export function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

/** Usuari fictici per al text que ja hi havia en crear o copiar el fitxer. */
export const TEMPLATE_USER = '__plantilla__';

export interface ParsedHistoryStream {
  /** Text inicial (plantilla) per objecte: '' és la primera pestanya de Docs. */
  baselineByObject: Map<string, string>;
  operations: NormalizedOp[];
  totalRawEntries: number;
  /** Entrades amb un format que no s'ha sabut interpretar. */
  unrecognizedEntries: number;
  /** Pestanyes del document (Docs); buit si només n'hi ha una. */
  tabs?: DocTabInfo[];
}

type AtomicItem = {
  objectId: string;
  type: 'insert' | 'delete';
  index: number;
  endIndex?: number;
  text?: string;
  isSuggestion: boolean;
};

interface DocsParseContext {
  /** Noms de les pestanyes ('' = primera pestanya), en ordre de creació. */
  tabNames: Map<string, string>;
}

/**
 * Aplana una operació de Docs. Les edicions de la segona pestanya i següents arriben
 * embolcallades: {ty:'nm', nmr:['ksm', idPestanya], nmc: operació}.
 */
function flattenRawOperation(
  rawOp: RawOperation,
  out: AtomicItem[],
  objectId: string,
  ctx: DocsParseContext
): boolean {
  if (!rawOp || typeof rawOp !== 'object' || Array.isArray(rawOp)) return false;
  const ty = rawOp.ty;
  if (typeof ty !== 'string') return false;

  if (ty === 'mlti' && Array.isArray(rawOp.mts)) {
    for (const child of rawOp.mts) {
      flattenRawOperation(child, out, objectId, ctx);
    }
    return true;
  }

  if (ty === 'nm' && rawOp.nmc && typeof rawOp.nmc === 'object') {
    const nmr = rawOp.nmr as unknown[] | undefined;
    const tab = Array.isArray(nmr) && typeof nmr[1] === 'string' ? nmr[1] : objectId;
    return flattenRawOperation(rawOp.nmc as RawOperation, out, tab, ctx);
  }

  // Pestanyes: mkch dona nom a la primera; ac en crea una de nova
  if (ty === 'mkch' && Array.isArray(rawOp.d)) {
    const first = (rawOp.d as unknown[])[0];
    if (Array.isArray(first) && typeof first[1] === 'string' && !ctx.tabNames.has('')) {
      ctx.tabNames.set('', first[1]);
    }
    return true;
  }
  if (ty === 'ac' && Array.isArray(rawOp.d) && typeof (rawOp.d as unknown[])[0] === 'string') {
    const d = rawOp.d as unknown[];
    const name = Array.isArray(d[1]) && typeof d[1][1] === 'string' ? d[1][1] : '';
    if (!ctx.tabNames.has('')) ctx.tabNames.set('', '');
    ctx.tabNames.set(String(d[0]), name);
    return true;
  }

  if ((ty === 'is' || ty === 'iss') && typeof rawOp.s === 'string') {
    if (rawOp.s.length === 0) return true;
    const index = typeof rawOp.ibi === 'number' ? rawOp.ibi : 1;
    out.push({ objectId, type: 'insert', index, text: rawOp.s, isSuggestion: ty === 'iss' });
    return true;
  }

  if ((ty === 'ds' || ty === 'dss') && typeof rawOp.si === 'number' && typeof rawOp.ei === 'number') {
    if (rawOp.ei < rawOp.si) return true;
    out.push({
      objectId,
      type: 'delete',
      index: rawOp.si,
      endIndex: rawOp.ei,
      isSuggestion: ty === 'dss',
    });
    return true;
  }

  // Altres operacions conegudes (estils, taules, imatges…): no afecten el text
  return true;
}

/** Text inicial (plantilla) del document, per pestanya. */
function extractBaselineByObject(
  chunkedSnapshot: unknown[] | undefined,
  ctx: DocsParseContext
): Map<string, string> {
  const result = new Map<string, string>();
  if (!Array.isArray(chunkedSnapshot)) return result;
  for (const chunk of chunkedSnapshot) {
    if (!Array.isArray(chunk)) continue;
    for (const op of chunk as RawOperation[]) {
      const items: AtomicItem[] = [];
      flattenRawOperation(op, items, '', ctx);
      for (const it of items) {
        if (it.type === 'insert' && it.text) {
          result.set(it.objectId, (result.get(it.objectId) ?? '') + it.text);
        }
      }
    }
  }
  return result;
}

export function extractBaselineSnapshotText(chunkedSnapshot?: unknown[]): string {
  return Array.from(extractBaselineByObject(chunkedSnapshot, { tabNames: new Map() }).values()).join('');
}

function pushAtomic(
  operations: NormalizedOp[],
  nextId: { v: number },
  item: AtomicItem,
  meta: { revisionId: number; timestamp: number; userId: string; sessionId: string }
): void {
  if (item.type === 'insert') {
    const text = item.text ?? '';
    operations.push({
      id: nextId.v++,
      ...meta,
      objectId: item.objectId,
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
    operations.push({
      id: nextId.v++,
      ...meta,
      objectId: item.objectId,
      type: 'delete',
      index: start,
      endIndex: end,
      charCount: Math.max(0, end - start + 1),
      wordCount: 0,
      isSuggestion: item.isSuggestion,
    });
  }
}

/** Historial de Google Docs, incloses totes les pestanyes del document. */
export function parseDocumentHistory(history: RawDocumentHistory): ParsedHistoryStream {
  const kind = history.kind ?? 'document';
  if (kind === 'presentation') return parsePresentationHistory(history).stream;

  const ctx: DocsParseContext = { tabNames: new Map() };
  const baselineByObject = extractBaselineByObject(history.chunkedSnapshot, ctx);
  const operations: NormalizedOp[] = [];
  const nextId = { v: 1 };
  let unrecognized = 0;

  const changelog: RawChangelogEntry[] = Array.isArray(history.changelog) ? history.changelog : [];
  for (let i = 0; i < changelog.length; i++) {
    const entry = changelog[i];
    if (!Array.isArray(entry) || entry.length < 2) {
      unrecognized++;
      continue;
    }

    const meta = {
      timestamp: typeof entry[1] === 'number' ? entry[1] : 0,
      userId: entry[2] !== undefined && entry[2] !== null ? String(entry[2]) : 'desconegut',
      revisionId: typeof entry[3] === 'number' ? entry[3] : history.firstRev + i,
      sessionId: entry[4] ? String(entry[4]) : '',
    };

    const atomicList: AtomicItem[] = [];
    if (!flattenRawOperation(entry[0] as RawOperation, atomicList, '', ctx)) unrecognized++;
    for (const item of atomicList) pushAtomic(operations, nextId, item, meta);
  }

  // Pestanyes: la primera és l'objecte '' i la resta, pel seu identificador, en ordre de creació
  const tabs: DocTabInfo[] = [];
  const usedObjects = new Set<string>([...baselineByObject.keys(), ...operations.map((o) => o.objectId)]);
  if (ctx.tabNames.size > 1 || usedObjects.size > 1) {
    const names = new Map(ctx.tabNames);
    if (!names.has('')) names.set('', '');
    const ordered = ['', ...Array.from(names.keys()).filter((id) => id !== '')];
    for (const id of usedObjects) if (!ordered.includes(id)) ordered.push(id);
    ordered.forEach((id, i) => tabs.push({ id, name: names.get(id) || `Pestanya ${i + 1}` }));
  }

  return {
    baselineByObject,
    operations,
    totalRawEntries: changelog.length,
    unrecognizedEntries: unrecognized,
    tabs,
  };
}

/* ────────────────────────────── Presentacions ────────────────────────────── */

export interface SlideObjectInfo {
  parentId: string;
  kind: number;
}

export interface PresentationStructure {
  /** Ordre de les diapositives (ids). */
  slideOrder: string[];
  /** Pàgines que no són diapositives (dissenys i patrons). */
  nonSlidePages: Set<string>;
  objects: Map<string, SlideObjectInfo>;
  images: Array<{ objectId: string; timestamp: number; userId: string; isTemplate: boolean }>;
}

const SLIDES_CMD_BATCH = 4;
const SLIDES_CMD_WRAP = 40;
const SLIDES_CMD_CREATE_PAGE = 12;
const SLIDES_CMD_CREATE_OBJECT = 3;
const SLIDES_CMD_INSERT_TEXT = 15;
const SLIDES_CMD_DELETE_TEXT = 16;
const SLIDES_OBJECT_IMAGE = 3;

function visitSlidesCommand(cmd: unknown, out: unknown[][]): void {
  if (!Array.isArray(cmd) || typeof cmd[0] !== 'number') return;
  if ((cmd[0] === SLIDES_CMD_BATCH || cmd[0] === SLIDES_CMD_WRAP) && Array.isArray(cmd[1])) {
    const inner = cmd[1] as unknown[];
    if (cmd[0] === SLIDES_CMD_WRAP && typeof inner[0] === 'number') {
      visitSlidesCommand(inner, out);
    } else {
      for (const c of inner) visitSlidesCommand(c, out);
    }
    return;
  }
  out.push(cmd);
}

function collectSnapshotCommands(snapshot: unknown, out: unknown[][], depth = 0): void {
  if (!Array.isArray(snapshot) || depth > 4) return;
  if (typeof snapshot[0] === 'number') {
    visitSlidesCommand(snapshot, out);
    return;
  }
  for (const el of snapshot) collectSnapshotCommands(el, out, depth + 1);
}

export function parsePresentationHistory(history: RawDocumentHistory): {
  stream: ParsedHistoryStream;
  structure: PresentationStructure;
} {
  const operations: NormalizedOp[] = [];
  const nextId = { v: 1 };
  const structure: PresentationStructure = {
    slideOrder: [],
    nonSlidePages: new Set(),
    objects: new Map(),
    images: [],
  };
  let unrecognized = 0;

  const registerSlide = (pageId: string, index?: number) => {
    if (structure.nonSlidePages.has(pageId)) return;
    const existing = structure.slideOrder.indexOf(pageId);
    if (existing >= 0) {
      if (typeof index === 'number') {
        structure.slideOrder.splice(existing, 1);
        structure.slideOrder.splice(Math.min(index, structure.slideOrder.length), 0, pageId);
      }
      return;
    }
    if (typeof index === 'number') {
      structure.slideOrder.splice(Math.min(index, structure.slideOrder.length), 0, pageId);
    } else {
      structure.slideOrder.push(pageId);
    }
  };

  const handle = (
    cmd: unknown[],
    meta: { revisionId: number; timestamp: number; userId: string; sessionId: string },
    isTemplate: boolean
  ): boolean => {
    const code = cmd[0] as number;
    if (code === SLIDES_CMD_CREATE_PAGE && typeof cmd[1] === 'string') {
      const pageType = cmd[3];
      if (pageType === 0) registerSlide(cmd[1], typeof cmd[2] === 'number' ? cmd[2] : undefined);
      else structure.nonSlidePages.add(cmd[1]);
      return true;
    }
    if (code === SLIDES_CMD_CREATE_OBJECT && typeof cmd[1] === 'string') {
      const parentId = typeof cmd[cmd.length - 1] === 'string' ? String(cmd[cmd.length - 1]) : '';
      const kind = typeof cmd[2] === 'number' ? cmd[2] : 0;
      structure.objects.set(cmd[1], { parentId, kind });
      // La primera diapositiva d'una presentació nova no es crea explícitament: es registra en aparèixer
      const page = resolveSlideId(parentId, structure);
      if (page && !structure.nonSlidePages.has(page) && !structure.objects.has(page)) registerSlide(page);
      if (kind === SLIDES_OBJECT_IMAGE) {
        structure.images.push({ objectId: cmd[1], timestamp: meta.timestamp, userId: meta.userId, isTemplate });
      }
      return true;
    }
    if (code === SLIDES_CMD_INSERT_TEXT && typeof cmd[1] === 'string' && typeof cmd[4] === 'string') {
      const idx = typeof cmd[3] === 'number' ? cmd[3] : 0;
      pushAtomic(
        operations,
        nextId,
        { objectId: cmd[1], type: 'insert', index: idx + 1, text: cmd[4], isSuggestion: false },
        meta
      );
      if (isTemplate) operations[operations.length - 1].isTemplate = true;
      return true;
    }
    if (code === SLIDES_CMD_DELETE_TEXT && typeof cmd[1] === 'string' && typeof cmd[3] === 'number' && typeof cmd[4] === 'number') {
      // [16, objecte, null, inici (0), final exclusiu]
      if (cmd[4] <= cmd[3]) return true;
      pushAtomic(
        operations,
        nextId,
        { objectId: cmd[1], type: 'delete', index: cmd[3] + 1, endIndex: cmd[4], isSuggestion: false },
        meta
      );
      if (isTemplate) operations[operations.length - 1].isTemplate = true;
      return true;
    }
    return typeof code === 'number';
  };

  // Plantilla de partida (còpies fetes per Classroom o des d'un model)
  const snapshotCmds: unknown[][] = [];
  collectSnapshotCommands(history.chunkedSnapshot, snapshotCmds);
  for (const cmd of snapshotCmds) {
    handle(cmd, { revisionId: 0, timestamp: 0, userId: TEMPLATE_USER, sessionId: '' }, true);
  }

  const changelog: RawChangelogEntry[] = Array.isArray(history.changelog) ? history.changelog : [];
  for (let i = 0; i < changelog.length; i++) {
    const entry = changelog[i];
    if (!Array.isArray(entry) || entry.length < 2 || !Array.isArray(entry[0])) {
      unrecognized++;
      continue;
    }
    const meta = {
      timestamp: typeof entry[1] === 'number' ? entry[1] : 0,
      userId: entry[2] !== undefined && entry[2] !== null ? String(entry[2]) : 'desconegut',
      revisionId: typeof entry[3] === 'number' ? entry[3] : history.firstRev + i,
      sessionId: entry[4] ? String(entry[4]) : '',
    };
    const cmds: unknown[][] = [];
    visitSlidesCommand(entry[0], cmds);
    // La primera revisió d'una presentació nova o copiada crea tota l'estructura de cop
    const isCreation =
      i === 0 &&
      meta.revisionId <= 1 &&
      cmds.some((c) => c[0] === SLIDES_CMD_CREATE_PAGE || c[0] === SLIDES_CMD_CREATE_OBJECT);
    if (cmds.length === 0) unrecognized++;
    for (const cmd of cmds) {
      if (!handle(cmd, meta, isCreation)) unrecognized++;
    }
  }

  // Registra com a diapositives les pàgines on hi ha objectes però que no s'han creat explícitament
  for (const info of structure.objects.values()) {
    const page = resolveSlideId(info.parentId, structure);
    if (page && !structure.nonSlidePages.has(page) && !structure.slideOrder.includes(page)) {
      structure.slideOrder.push(page);
    }
  }

  return {
    stream: {
      baselineByObject: new Map(),
      operations,
      totalRawEntries: changelog.length,
      unrecognizedEntries: unrecognized,
    },
    structure,
  };
}

/** Retorna la diapositiva d'un pare (pàgina, notes o grup d'objectes). */
export function resolveSlideId(parentId: string, structure: PresentationStructure): string {
  let current = parentId;
  for (let guard = 0; guard < 8; guard++) {
    if (current.endsWith(':notes')) return current.slice(0, -':notes'.length);
    const obj = structure.objects.get(current);
    if (!obj) return current;
    current = obj.parentId;
  }
  return current;
}
