// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DocKind, RawDocumentHistory, RawTileInfo, RawUserInfo } from '../types';
import { stripXssiPrefix } from '../core/parser';

export interface ActiveDocCandidate {
  tabId: number;
  frameId: number;
  kind: DocKind;
  docId: string;
  title: string;
  userPrefix: string;
  tabParam: string;
  isInsideClassroom: boolean;
}

export interface ExtractionProgress {
  phase: 'detectant' | 'metadades' | 'historial' | 'processant';
  message: string;
  percent: number;
}

export type ExtractionErrorCode = 'NO_DOC' | 'NO_PERMISSION' | 'NETWORK' | 'FORMAT_CHANGED' | 'EXTENSION_ENV';

export class ExtractionError extends Error {
  code: ExtractionErrorCode;

  constructor(code: ExtractionErrorCode, message: string) {
    super(message);
    this.name = 'ExtractionError';
    this.code = code;
  }
}

export const KIND_LABELS: Record<DocKind, { singular: string; article: string }> = {
  document: { singular: 'document', article: 'el document' },
  presentation: { singular: 'presentació', article: 'la presentació' },
  spreadsheet: { singular: 'full de càlcul', article: 'el full de càlcul' },
};

const KIND_BY_PATH: Record<string, DocKind> = {
  document: 'document',
  presentation: 'presentation',
  spreadsheets: 'spreadsheet',
};
const PATH_BY_KIND: Record<DocKind, string> = {
  document: 'document',
  presentation: 'presentation',
  spreadsheet: 'spreadsheets',
};

export const DOC_URL_RE = /\/(document|presentation|spreadsheets)\/(?:(u\/\d+)\/)?d\/([a-zA-Z0-9_-]+)/;

/** Reconeix l'adreça d'un document, presentació o full de càlcul de Google. */
export function parseDocUrl(url: string): { kind: DocKind; docId: string; userPrefix: string } | null {
  const m = url.match(DOC_URL_RE);
  if (!m) return null;
  return { kind: KIND_BY_PATH[m[1]], docId: m[3], userPrefix: m[2] || '' };
}

export function docBaseUrl(kind: DocKind, docId: string, userPrefix = ''): string {
  return `https://docs.google.com/${PATH_BY_KIND[kind]}/${userPrefix ? `${userPrefix}/` : ''}d/${docId}`;
}

/** Treu el sufix del producte del títol de la pestanya («- Documents de Google», etc.). */
export function cleanTitle(raw: string): string {
  return raw
    .replace(
      /\s*[-–]\s*(Documents de Google|Google Docs|Documentos de Google|Presentacions de Google|Google Slides|Presentaciones de Google|Fulls de càlcul de Google|Google Sheets|Hojas de cálculo de Google)\s*$/i,
      ''
    )
    .trim();
}

export function hasDirectScriptingAccess(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.tabs) && Boolean(chrome.scripting);
}

export function isChromeExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
}

interface FrameProbeResult {
  isGoogleDoc: boolean;
  kind: DocKind;
  docId: string;
  title: string;
  userPrefix: string;
  tabParam: string;
  token: string;
}

/** S'executa dins de la pàgina de Google (món MAIN): ha de ser autocontinguda. */
function probeGoogleDocInMainWorld(): FrameProbeResult | null {
  try {
    if (location.hostname !== 'docs.google.com') return null;
    const match = location.pathname.match(
      /\/(document|presentation|spreadsheets)\/(?:(u\/\d+)\/)?d\/([a-zA-Z0-9_-]+)/
    );
    if (!match) return null;
    const kinds: Record<string, 'document' | 'presentation' | 'spreadsheet'> = {
      document: 'document',
      presentation: 'presentation',
      spreadsheets: 'spreadsheet',
    };

    const params = new URLSearchParams(location.search);
    const titleInput = document.querySelector('.docs-title-input') as HTMLInputElement | null;
    const rawTitle =
      (titleInput && titleInput.value && titleInput.value.trim()) ||
      document.title
        .replace(
          /\s*[-–]\s*(Documents de Google|Google Docs|Documentos de Google|Presentacions de Google|Google Slides|Presentaciones de Google|Fulls de càlcul de Google|Google Sheets|Hojas de cálculo de Google).*$/i,
          ''
        )
        .trim() ||
      'Fitxer de Google';

    let token = '';
    const win = window as unknown as Record<string, unknown>;
    const initialData = win._docs_flag_initialData as Record<string, unknown> | undefined;
    if (initialData && typeof initialData === 'object') {
      const infoParams = initialData.info_params as Record<string, unknown> | undefined;
      if (infoParams && typeof infoParams.token === 'string') {
        token = infoParams.token;
      }
    }
    if (!token) {
      const scripts = document.querySelectorAll('script');
      for (let i = 0; i < scripts.length; i++) {
        const txt = scripts[i].textContent || '';
        if (txt.includes('info_params')) {
          const m = txt.match(/"info_params"\s*:\s*\{[^}]*?"token"\s*:\s*"([^"]+)"/);
          if (m && m[1]) {
            token = m[1];
            break;
          }
        }
      }
    }

    return {
      isGoogleDoc: true,
      kind: kinds[match[1]],
      docId: match[3],
      title: rawTitle,
      userPrefix: match[2] || '',
      tabParam: params.get('tab') || '',
      token,
    };
  } catch {
    return null;
  }
}

export async function detectGoogleDocForTab(explicitTabId?: number): Promise<ActiveDocCandidate | null> {
  if (!hasDirectScriptingAccess()) {
    if (isChromeExtensionContext()) {
      const resp = await chrome.runtime.sendMessage({ type: 'TRACES_BG_DETECT_DOC' });
      return resp?.ok ? (resp.candidate as ActiveDocCandidate | null) : null;
    }
    return null;
  }

  let targetTab: chrome.tabs.Tab | undefined;
  if (typeof explicitTabId === 'number') {
    targetTab = await chrome.tabs.get(explicitTabId).catch(() => undefined);
  } else {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    targetTab = tabs[0];
  }

  if (!targetTab?.id) return null;

  const tabUrl = targetTab.url || '';
  const parsedUrl = parseDocUrl(tabUrl);
  const isClassroomUrl = tabUrl.startsWith('https://classroom.google.com/');
  if (!parsedUrl && !isClassroomUrl) return null;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id, allFrames: true },
      world: 'MAIN',
      func: probeGoogleDocInMainWorld,
    });

    for (const res of results) {
      if (res.result && res.result.isGoogleDoc) {
        return {
          tabId: targetTab.id,
          frameId: res.frameId,
          kind: res.result.kind,
          docId: res.result.docId,
          title: res.result.title,
          userPrefix: res.result.userPrefix,
          tabParam: res.result.tabParam,
          isInsideClassroom: isClassroomUrl && res.frameId !== 0,
        };
      }
    }
  } catch {
    if (parsedUrl) {
      return {
        tabId: targetTab.id,
        frameId: 0,
        kind: parsedUrl.kind,
        docId: parsedUrl.docId,
        title: cleanTitle(targetTab.title || 'Fitxer de Google'),
        userPrefix: parsedUrl.userPrefix,
        tabParam: new URL(tabUrl).searchParams.get('tab') || '',
        isInsideClassroom: false,
      };
    }
  }

  return null;
}

export async function detectActiveGoogleDoc(): Promise<ActiveDocCandidate | null> {
  return detectGoogleDocForTab();
}

export interface FetchPayload {
  ok: boolean;
  status: number;
  body: string;
  errorMessage?: string;
}

/** Funció que fa una petició GET amb la sessió de Google de l'usuari. */
export type Fetcher = (url: string) => Promise<FetchPayload>;

/** Executa fetch() dins d'un marc de docs.google.com (mateix origen i mateixa sessió). */
export function makeFrameFetcher(tabId: number, frameId: number): Fetcher {
  return async (url: string) => {
    const results = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      world: 'MAIN',
      args: [url],
      func: async (targetUrl: string) => {
        try {
          const resp = await fetch(targetUrl, { method: 'GET', credentials: 'include', headers: { Accept: '*/*' } });
          return { ok: resp.ok, status: resp.status, body: await resp.text() };
        } catch (err) {
          return { ok: false, status: 0, body: '', errorMessage: err instanceof Error ? err.message : String(err) };
        }
      },
    });
    const payload = results?.[0]?.result as FetchPayload | undefined;
    if (!payload) {
      throw new ExtractionError(
        'NETWORK',
        'No s’ha pogut comunicar amb la pestanya de Google. Recarregueu la pàgina (F5) i torneu-ho a provar.'
      );
    }
    return payload;
  };
}

function parseGoogleJson<T>(rawBody: string): T {
  const clean = stripXssiPrefix(rawBody);
  try {
    return JSON.parse(clean) as T;
  } catch {
    throw new ExtractionError(
      'FORMAT_CHANGED',
      'La resposta rebuda no té el format d’historial esperat. Comproveu que la sessió de Google estigui activa.'
    );
  }
}

interface TilesResponse {
  tileInfo?: RawTileInfo[];
  userMap?: Record<string, RawUserInfo>;
  firstRev?: number;
}

interface LoadResponse {
  changelog?: RawDocumentHistory['changelog'];
  chunkedSnapshot?: RawDocumentHistory['chunkedSnapshot'];
}

export interface DocTarget {
  kind: DocKind;
  docId: string;
  userPrefix: string;
  token: string;
  tabParam: string;
  title: string;
}

/** Descodifica les entitats HTML d'un títol (funciona també al Service Worker, sense DOM). */
export function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return named[code.toLowerCase()] ?? m;
  });
}

/** Llegeix el testimoni de sessió i el títol d'un fitxer a partir de la seva pàgina d'edició. */
export async function resolveTargetFromEditPage(
  fetcher: Fetcher,
  kind: DocKind,
  docId: string,
  userPrefix: string
): Promise<DocTarget> {
  const resp = await fetcher(`${docBaseUrl(kind, docId, userPrefix)}/edit`);
  if (resp.status === 401 || resp.status === 403 || resp.status === 404) {
    throw new ExtractionError('NO_PERMISSION', 'No teniu accés d’edició a aquest fitxer.');
  }
  const token = resp.body.match(/"info_params"\s*:\s*\{[^}]*?"token"\s*:\s*"([^"]+)"/)?.[1] ?? '';
  const titleRaw = resp.body.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  return { kind, docId, userPrefix, token, tabParam: '', title: cleanTitle(decodeEntities(titleRaw)) || 'Fitxer de Google' };
}

/** Descarrega l'índex d'autors i tot el registre de revisions d'un fitxer. */
export async function fetchHistory(
  fetcher: Fetcher,
  target: DocTarget,
  onProgress?: (p: ExtractionProgress) => void
): Promise<RawDocumentHistory> {
  const baseDocUrl = docBaseUrl(target.kind, target.docId, target.userPrefix);

  const buildQuery = (
    endpoint: 'revisions/tiles' | 'revisions/load',
    extra: Record<string, string | number>,
    includeTab: boolean
  ): string => {
    const qs = new URLSearchParams();
    qs.set('id', target.docId);
    for (const [k, v] of Object.entries(extra)) qs.set(k, String(v));
    if (target.token) qs.set('token', target.token);
    if (includeTab && target.kind === 'document') qs.set('tab', target.tabParam || 't.0');
    return `${baseDocUrl}/${endpoint}?${qs.toString()}`;
  };

  onProgress?.({ phase: 'metadades', message: 'Consultant l’índex de revisions i autors…', percent: 24 });

  let useTabParam = target.kind === 'document';
  let userMap: Record<string, RawUserInfo> = {};
  let firstRev = 1;
  let lastRev = 0;

  let tilesResp = await fetcher(
    buildQuery('revisions/tiles', { start: 1, showDetailedRevisions: 'true' }, useTabParam)
  );
  if (!tilesResp.ok && tilesResp.status === 400 && useTabParam) {
    useTabParam = false;
    tilesResp = await fetcher(buildQuery('revisions/tiles', { start: 1, showDetailedRevisions: 'true' }, false));
  }

  if (tilesResp.status === 401 || tilesResp.status === 403) {
    throw new ExtractionError(
      'NO_PERMISSION',
      'No teniu permís d’edició per consultar l’historial de versions (mode de només lectura o compte de Google diferent).'
    );
  }

  if (tilesResp.ok) {
    const firstBatch = parseGoogleJson<TilesResponse>(tilesResp.body);
    if (firstBatch.userMap) userMap = { ...userMap, ...firstBatch.userMap };
    if (typeof firstBatch.firstRev === 'number' && firstBatch.firstRev >= 1) firstRev = firstBatch.firstRev;
    const tiles = firstBatch.tileInfo || [];
    if (tiles.length > 0) {
      lastRev = tiles[tiles.length - 1].end;
      if (firstRev === 1 && tiles[0].start > 1) firstRev = tiles[0].start;

      let guard = 0;
      let cursorStart = lastRev + 1;
      while (tiles.length >= 400 && guard < 15) {
        guard++;
        const nextResp = await fetcher(
          buildQuery('revisions/tiles', { start: cursorStart, showDetailedRevisions: 'true' }, useTabParam)
        );
        if (!nextResp.ok) break;
        const nextData = parseGoogleJson<TilesResponse>(nextResp.body);
        if (nextData.userMap) userMap = { ...userMap, ...nextData.userMap };
        const moreTiles = nextData.tileInfo || [];
        if (moreTiles.length === 0) break;
        const newEnd = moreTiles[moreTiles.length - 1].end;
        if (newEnd <= lastRev) break;
        lastRev = newEnd;
        cursorStart = lastRev + 1;
        if (moreTiles.length < 400) break;
      }
    }
  }

  if (lastRev < 1) {
    // Sense índex: troba l'última revisió per cerca binària
    const probeOne = await fetcher(buildQuery('revisions/load', { start: 1, end: 1 }, useTabParam));
    if (!probeOne.ok) {
      throw new ExtractionError(
        'NO_PERMISSION',
        'No s’ha pogut accedir al registre d’edicions. Verifiqueu que hi teniu permís d’editor.'
      );
    }
    let low = 1;
    let high = 64;
    while (high < 400_000) {
      const check = await fetcher(buildQuery('revisions/load', { start: high, end: high }, useTabParam));
      if (!check.ok) break;
      low = high;
      high *= 2;
    }
    while (low < high - 1) {
      const mid = Math.floor((low + high) / 2);
      const check = await fetcher(buildQuery('revisions/load', { start: mid, end: mid }, useTabParam));
      if (check.ok) low = mid;
      else high = mid;
    }
    lastRev = low;
  }

  const CHUNK_SIZE = 2500;
  const totalRevs = Math.max(1, lastRev - firstRev + 1);
  const allChangelog: RawDocumentHistory['changelog'] = [];
  let initialSnapshot: RawDocumentHistory['chunkedSnapshot'] | undefined;

  let batchStart = firstRev;
  while (batchStart <= lastRev) {
    const batchEnd = Math.min(lastRev, batchStart + CHUNK_SIZE - 1);
    const doneRatio = (batchStart - firstRev) / totalRevs;
    onProgress?.({
      phase: 'historial',
      message:
        totalRevs > CHUNK_SIZE
          ? `Recuperant revisions (${batchStart}–${batchEnd} de ${lastRev})…`
          : `Recuperant ${totalRevs} revisions…`,
      percent: Math.round(32 + doneRatio * 55),
    });

    let loadResp = await fetcher(buildQuery('revisions/load', { start: batchStart, end: batchEnd }, useTabParam));

    if (!loadResp.ok && batchEnd > batchStart + 200) {
      const smallerEnd = Math.min(lastRev, batchStart + 500 - 1);
      loadResp = await fetcher(buildQuery('revisions/load', { start: batchStart, end: smallerEnd }, useTabParam));
      if (loadResp.ok) {
        const parsedSub = parseGoogleJson<LoadResponse>(loadResp.body);
        if (batchStart === firstRev && parsedSub.chunkedSnapshot) initialSnapshot = parsedSub.chunkedSnapshot;
        if (Array.isArray(parsedSub.changelog)) allChangelog.push(...parsedSub.changelog);
        batchStart = smallerEnd + 1;
        continue;
      }
    }

    if (loadResp.status === 401 || loadResp.status === 403) {
      throw new ExtractionError(
        'NO_PERMISSION',
        'Google ha denegat l’accés a les revisions detallades. Cal permís d’edició.'
      );
    }

    if (!loadResp.ok) {
      if (allChangelog.length > 0) break;
      throw new ExtractionError('NETWORK', `Google ha retornat un error (codi ${loadResp.status}) en carregar l’historial.`);
    }

    const parsedLoad = parseGoogleJson<LoadResponse>(loadResp.body);
    if (batchStart === firstRev && parsedLoad.chunkedSnapshot) initialSnapshot = parsedLoad.chunkedSnapshot;
    if (Array.isArray(parsedLoad.changelog)) allChangelog.push(...parsedLoad.changelog);

    batchStart = batchEnd + 1;
  }

  onProgress?.({ phase: 'processant', message: 'Reconstruint el contingut i calculant mètriques…', percent: 92 });

  return {
    docId: target.docId,
    title: target.title,
    kind: target.kind,
    tabId: target.tabParam || undefined,
    firstRev,
    lastRev,
    fetchedAt: Date.now(),
    userMap,
    chunkedSnapshot: initialSnapshot,
    changelog: allChangelog,
  };
}

export async function extractGoogleDocForTab(
  explicitTabId?: number,
  onProgress?: (p: ExtractionProgress) => void
): Promise<RawDocumentHistory> {
  // Dins de l'iframe incrustat al document, delega al Service Worker de l'extensió
  if (!hasDirectScriptingAccess()) {
    if (!isChromeExtensionContext()) {
      throw new ExtractionError(
        'EXTENSION_ENV',
        'Aquesta funció requereix obrir Traces com a extensió de Google Chrome sobre un fitxer de Google.'
      );
    }
    onProgress?.({ phase: 'historial', message: 'Consultant i reconstruint les revisions…', percent: 45 });
    const resp = await chrome.runtime.sendMessage({ type: 'TRACES_BG_EXTRACT_DOC' });
    if (!resp?.ok) {
      throw new ExtractionError(resp?.code || 'NETWORK', resp?.message || 'No s’ha pogut extreure l’historial.');
    }
    return resp.history as RawDocumentHistory;
  }

  onProgress?.({ phase: 'detectant', message: 'Connectant amb el fitxer obert…', percent: 10 });

  const candidate = await detectGoogleDocForTab(explicitTabId);
  if (!candidate) {
    throw new ExtractionError(
      'NO_DOC',
      'Obriu primer un document, una presentació o un full de càlcul de Google (o un treball dins del qualificador de Classroom).'
    );
  }

  const probeExec = await chrome.scripting.executeScript({
    target: { tabId: candidate.tabId, frameIds: [candidate.frameId] },
    world: 'MAIN',
    func: probeGoogleDocInMainWorld,
  });
  const probe = probeExec?.[0]?.result;
  if (!probe) {
    throw new ExtractionError('NO_DOC', 'El fitxer encara s’està carregant. Espereu uns segons i torneu-ho a provar.');
  }

  return fetchHistory(
    makeFrameFetcher(candidate.tabId, candidate.frameId),
    {
      kind: probe.kind,
      docId: probe.docId,
      userPrefix: probe.userPrefix,
      token: probe.token,
      tabParam: probe.tabParam,
      title: probe.title,
    },
    onProgress
  );
}

export async function extractGoogleDocHistory(
  onProgress?: (p: ExtractionProgress) => void
): Promise<RawDocumentHistory> {
  return extractGoogleDocForTab(undefined, onProgress);
}
