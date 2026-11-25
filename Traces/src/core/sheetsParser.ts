// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RawChangelogEntry, RawDocumentHistory } from '../types';

/**
 * Lector del registre intern de revisions de Google Sheets.
 *
 * Cada revisió conté una ordre numèrica [codi, dades]. No es reconstrueix el full
 * sencer: només s'extreu el que és útil per al professorat (quantes cel·les s'han
 * escrit a mà, quantes s'han enganxat de cop, fórmules i fulls).
 */

const SHEETS_CMD_BATCH = 4444216;
const SHEETS_CMD_SET_CELL = 21299578;
const SHEETS_CMD_ADD_SHEET = 21350203;
const SHEETS_CMD_RENAME_SHEET = 26812461;
const SHEETS_CMD_FILL = 42492482;
/** Tipus de valor dins d'una cel·la: 3 = dada, 12 = fórmula. */
const CELL_VALUE = 3;
const CELL_FORMULA = 12;

export type SheetOpKind = 'typed' | 'pasted' | 'fill' | 'other';

export interface SheetOp {
  id: number;
  revisionId: number;
  timestamp: number;
  userId: string;
  kind: SheetOpKind;
  cells: number;
  formulas: number;
  sheetId: string;
  range: [number, number, number, number] | null; // fila inici, fila final (excl.), col inici, col final (excl.)
  texts: string[];
  isTemplate: boolean;
}

export interface ParsedSheets {
  ops: SheetOp[];
  sheetNames: Map<string, string>;
  templateCells: number;
  totalRawEntries: number;
  unrecognizedEntries: number;
}

function flatten(cmd: unknown, out: unknown[][]): void {
  if (!Array.isArray(cmd) || typeof cmd[0] !== 'number') return;
  if (cmd[0] === SHEETS_CMD_BATCH && Array.isArray(cmd[1])) {
    for (const c of cmd[1] as unknown[]) flatten(c, out);
    return;
  }
  out.push(cmd);
}

function isValueEntry(v: unknown): v is unknown[] {
  return (
    Array.isArray(v) &&
    v[0] === null &&
    typeof v[1] === 'number' &&
    v[1] > 1_000_000 &&
    (v[2] === CELL_VALUE || v[2] === CELL_FORMULA)
  );
}

interface CellScan {
  cells: number;
  formulas: number;
  texts: string[];
  range: { sheetId: string; r: [number, number, number, number] } | null;
}

function scan(value: unknown, acc: CellScan, depth = 0): void {
  if (depth > 9 || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    if (isValueEntry(value)) {
      acc.cells++;
      if (value[2] === CELL_FORMULA) acc.formulas++;
      const inner = value[3];
      if (Array.isArray(inner) && inner[1] === 2 && typeof inner[2] === 'string' && acc.texts.length < 8) {
        acc.texts.push(inner[2]);
      }
      return;
    }
    if (
      !acc.range &&
      value.length === 6 &&
      value[0] === null &&
      typeof value[1] === 'string' &&
      value.slice(2).every((n) => typeof n === 'number')
    ) {
      acc.range = { sheetId: value[1], r: value.slice(2) as [number, number, number, number] };
      return;
    }
    for (const v of value) scan(v, acc, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) scan(v, acc, depth + 1);
  }
}

function findSheetName(payload: unknown): string | null {
  // El nom apareix com [null, 0, 0, "Nom"] dins de l'objecte de propietats
  let found: string | null = null;
  const walk = (v: unknown, d = 0) => {
    if (found || d > 6 || !v) return;
    if (Array.isArray(v)) {
      if (v.length === 4 && v[0] === null && v[1] === 0 && v[2] === 0 && typeof v[3] === 'string') {
        found = v[3];
        return;
      }
      v.forEach((x) => walk(x, d + 1));
    } else if (typeof v === 'object') {
      Object.values(v as Record<string, unknown>).forEach((x) => walk(x, d + 1));
    }
  };
  walk(payload);
  return found;
}

export function parseSheetsHistory(history: RawDocumentHistory): ParsedSheets {
  const ops: SheetOp[] = [];
  const sheetNames = new Map<string, string>();
  let nextId = 1;
  let unrecognized = 0;
  let templateCells = 0;

  const handle = (
    cmd: unknown[],
    meta: { revisionId: number; timestamp: number; userId: string },
    isTemplate: boolean
  ) => {
    const code = cmd[0] as number;
    const payload = cmd[1];

    if (code === SHEETS_CMD_ADD_SHEET && Array.isArray(payload)) {
      const sheetId = typeof payload[3] === 'string' ? payload[3] : String(payload[3] ?? '');
      const name = findSheetName(payload[4]);
      if (sheetId && name) sheetNames.set(sheetId, name);
      return;
    }
    if (code === SHEETS_CMD_RENAME_SHEET && Array.isArray(payload) && typeof payload[1] === 'string') {
      const name = findSheetName(payload[2]);
      if (name) sheetNames.set(payload[1], name);
      return;
    }

    const acc: CellScan = { cells: 0, formulas: 0, texts: [], range: null };
    scan(payload, acc);

    let kind: SheetOpKind = 'other';
    if (code === SHEETS_CMD_FILL) kind = 'fill';
    else if (acc.cells === 1 && code === SHEETS_CMD_SET_CELL) kind = 'typed';
    else if (acc.cells >= 1) kind = 'pasted';

    if (isTemplate) {
      templateCells += acc.cells;
    }

    ops.push({
      id: nextId++,
      ...meta,
      kind,
      cells: acc.cells,
      formulas: acc.formulas,
      sheetId: acc.range?.sheetId ?? '',
      range: acc.range?.r ?? null,
      texts: acc.texts,
      isTemplate,
    });
  };

  // Plantilla de partida (còpia feta per Classroom o des d'un model)
  const snapshotCmds: unknown[][] = [];
  const collect = (v: unknown, d = 0) => {
    if (!Array.isArray(v) || d > 4) return;
    if (typeof v[0] === 'number') flatten(v, snapshotCmds);
    else v.forEach((x) => collect(x, d + 1));
  };
  collect(history.chunkedSnapshot);
  for (const cmd of snapshotCmds) {
    handle(cmd, { revisionId: 0, timestamp: 0, userId: '__plantilla__' }, true);
  }

  const changelog: RawChangelogEntry[] = Array.isArray(history.changelog) ? history.changelog : [];
  for (let i = 0; i < changelog.length; i++) {
    const entry = changelog[i];
    if (!Array.isArray(entry) || !Array.isArray(entry[0])) {
      unrecognized++;
      continue;
    }
    const meta = {
      timestamp: typeof entry[1] === 'number' ? entry[1] : 0,
      userId: entry[2] !== undefined && entry[2] !== null ? String(entry[2]) : 'desconegut',
      revisionId: typeof entry[3] === 'number' ? entry[3] : history.firstRev + i,
    };
    const cmds: unknown[][] = [];
    flatten(entry[0], cmds);
    if (cmds.length === 0) unrecognized++;
    // La primera revisió d'un full nou o copiat en crea tota l'estructura de cop
    const isCreation =
      i === 0 && meta.revisionId <= 1 && cmds.some((c) => c[0] === SHEETS_CMD_ADD_SHEET);
    for (const cmd of cmds) handle(cmd, meta, isCreation);
  }

  return {
    ops,
    sheetNames,
    templateCells,
    totalRawEntries: changelog.length,
    unrecognizedEntries: unrecognized,
  };
}

export function columnLabel(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function rangeLabel(range: [number, number, number, number] | null): string {
  if (!range) return '—';
  const [r1, r2, c1, c2] = range;
  const start = `${columnLabel(c1)}${r1 + 1}`;
  const end = `${columnLabel(Math.max(c1, c2 - 1))}${Math.max(r1, r2 - 1) + 1}`;
  return start === end ? start : `${start}:${end}`;
}
