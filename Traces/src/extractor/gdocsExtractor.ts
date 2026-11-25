// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RawDocumentHistory, RawTileInfo, RawUserInfo } from '../types';
import { stripXssiPrefix } from '../core/parser';

export interface ActiveDocCandidate {
  tabId: number;
  frameId: number;
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

export class ExtractionError extends Error {
  code: 'NO_DOC' | 'NO_PERMISSION' | 'NETWORK' | 'FORMAT_CHANGED' | 'EXTENSION_ENV';

  constructor(
    code: 'NO_DOC' | 'NO_PERMISSION' | 'NETWORK' | 'FORMAT_CHANGED' | 'EXTENSION_ENV',
    message: string
  ) {
    super(message);
    this.name = 'ExtractionError';
    this.code = code;
  }
}

export function hasDirectScriptingAccess(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.tabs) &&
    Boolean(chrome.scripting)
  );
}

export function isChromeExtensionContext(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.runtime?.id)
  );
}

interface FrameProbeResult {
  isGoogleDoc: boolean;
  docId: string;
  title: string;
  userPrefix: string;
  tabParam: string;
  token: string;
  isViewOnlyHint: boolean;
}

function probeGoogleDocInMainWorld(): FrameProbeResult | null {
  try {
    if (location.hostname !== 'docs.google.com') return null;
    const match = location.pathname.match(/\/document\/(?:(u\/\d+)\/)?d\/([a-zA-Z0-9_-]+)/);
    if (!match) return null;

    const userPrefix = match[1] || '';
    const docId = match[2];
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab') || '';

    const titleInput = document.querySelector('.docs-title-input') as HTMLInputElement | null;
    const rawTitle =
      (titleInput && titleInput.value && titleInput.value.trim()) ||
      document.title
        .replace(/\s*-\s*Documents de Google.*$/i, '')
        .replace(/\s*-\s*Google Docs.*$/i, '')
        .trim() ||
      'Document de Google Docs';

    let token = '';
    const win = window as unknown as Record<string, unknown>;
    const initialData = win._docs_flag_initialData as Record<string, unknown> | undefined;
    if (initialData && typeof initialData === 'object') {
      const infoParams = initialData.info_params as Record<string, unknown> | undefined;
      if (infoParams && typeof infoParams.token === 'string') {
        token = infoParams.token;
      } else {
        for (const val of Object.values(initialData)) {
          if (val && typeof val === 'object' && 'token' in (val as Record<string, unknown>)) {
            const t = (val as Record<string, unknown>).token;
            if (typeof t === 'string' && t.length > 4) {
              token = t;
              break;
            }
          }
        }
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

    const isViewOnlyHint = Boolean(
      document.querySelector('#docs-access-level-indicator') &&
        !document.querySelector('#docs-toolbar-mode-switcher')
    );

    return {
      isGoogleDoc: true,
      docId,
      title: rawTitle,
      userPrefix,
      tabParam,
      token,
      isViewOnlyHint,
    };
  } catch {
    return null;
  }
}

export async function detectGoogleDocForTab(
  explicitTabId?: number
): Promise<ActiveDocCandidate | null> {
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
  const isDocsUrl = tabUrl.startsWith('https://docs.google.com/document/');
  const isClassroomUrl = tabUrl.startsWith('https://classroom.google.com/');
  if (!isDocsUrl && !isClassroomUrl) {
    return null;
  }

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
          docId: res.result.docId,
          title: res.result.title,
          userPrefix: res.result.userPrefix,
          tabParam: res.result.tabParam,
          isInsideClassroom: isClassroomUrl && res.frameId !== 0,
        };
      }
    }
  } catch {
    const m = tabUrl.match(/\/document\/(?:(u\/\d+)\/)?d\/([a-zA-Z0-9_-]+)/);
    if (m) {
      return {
        tabId: targetTab.id,
        frameId: 0,
        docId: m[2],
        title: (targetTab.title || 'Document de Google Docs')
          .replace(/\s*-\s*Documents de Google.*$/i, '')
          .replace(/\s*-\s*Google Docs.*$/i, '')
          .trim(),
        userPrefix: m[1] || '',
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

interface InPageFetchPayload {
  ok: boolean;
  status: number;
  body: string;
  errorMessage?: string;
}

async function fetchInsideDocFrame(
  tabId: number,
  frameId: number,
  url: string
): Promise<InPageFetchPayload> {
  const results = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    world: 'MAIN',
    args: [url],
    func: async (targetUrl: string): Promise<InPageFetchPayload> => {
      try {
        const resp = await fetch(targetUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: '*/*',
          },
        });
        const body = await resp.text();
        return {
          ok: resp.ok,
          status: resp.status,
          body,
        };
      } catch (err) {
        return {
          ok: false,
          status: 0,
          body: '',
          errorMessage: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  const payload = results?.[0]?.result;
  if (!payload) {
    throw new ExtractionError(
      'NETWORK',
      'No s’ha pogut comunicar amb la pestanya de Google Docs. Recarregueu la pàgina (F5) i torneu-ho a provar.'
    );
  }
  return payload;
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

export async function extractGoogleDocForTab(
  explicitTabId?: number,
  onProgress?: (p: ExtractionProgress) => void
): Promise<RawDocumentHistory> {
  // Quan s'executa dins l'iframe incrustat de Google Docs, delega al Service Worker de l'extensió
  if (!hasDirectScriptingAccess()) {
    if (!isChromeExtensionContext()) {
      throw new ExtractionError(
        'EXTENSION_ENV',
        'Aquesta funció requereix obrir Traces com a extensió de Google Chrome sobre un document.'
      );
    }
    onProgress?.({
      phase: 'historial',
      message: 'Consultant i reconstruint les revisions del document…',
      percent: 45,
    });
    const resp = await chrome.runtime.sendMessage({ type: 'TRACES_BG_EXTRACT_DOC' });
    if (!resp?.ok) {
      throw new ExtractionError(
        resp?.code || 'NETWORK',
        resp?.message || 'No s’ha pogut extreure l’historial del document.'
      );
    }
    return resp.history as RawDocumentHistory;
  }

  onProgress?.({
    phase: 'detectant',
    message: 'Connectant amb el document obert…',
    percent: 10,
  });

  const candidate = await detectGoogleDocForTab(explicitTabId);
  if (!candidate) {
    throw new ExtractionError(
      'NO_DOC',
      'Obriu primer un document de Google Docs (o un treball dins del qualificador de Google Classroom) per analitzar-lo.'
    );
  }

  const probeExec = await chrome.scripting.executeScript({
    target: { tabId: candidate.tabId, frameIds: [candidate.frameId] },
    world: 'MAIN',
    func: probeGoogleDocInMainWorld,
  });
  const probe = probeExec?.[0]?.result;
  if (!probe) {
    throw new ExtractionError(
      'NO_DOC',
      'El document encara s’està carregant. Espereu uns segons i torneu a prémer «Analitza».'
    );
  }

  const baseDocUrl = `https://docs.google.com/document/${
    probe.userPrefix ? `${probe.userPrefix}/` : ''
  }d/${probe.docId}`;

  const buildQuery = (
    endpoint: 'revisions/tiles' | 'revisions/load',
    extra: Record<string, string | number>,
    includeTab: boolean
  ): string => {
    const qs = new URLSearchParams();
    qs.set('id', probe.docId);
    for (const [k, v] of Object.entries(extra)) {
      qs.set(k, String(v));
    }
    if (probe.token) {
      qs.set('token', probe.token);
    }
    if (includeTab) {
      qs.set('tab', probe.tabParam || 't.0');
    }
    return `${baseDocUrl}/${endpoint}?${qs.toString()}`;
  };

  onProgress?.({
    phase: 'metadades',
    message: 'Consultant l’índex de revisions i autors…',
    percent: 24,
  });

  let useTabParam = true;
  let userMap: Record<string, RawUserInfo> = {};
  let firstRev = 1;
  let lastRev = 0;

  let tilesResp = await fetchInsideDocFrame(
    candidate.tabId,
    candidate.frameId,
    buildQuery('revisions/tiles', { start: 1, showDetailedRevisions: 'true' }, true)
  );

  if (!tilesResp.ok && tilesResp.status === 400) {
    useTabParam = false;
    tilesResp = await fetchInsideDocFrame(
      candidate.tabId,
      candidate.frameId,
      buildQuery('revisions/tiles', { start: 1, showDetailedRevisions: 'true' }, false)
    );
  }

  if (tilesResp.status === 401 || tilesResp.status === 403) {
    throw new ExtractionError(
      'NO_PERMISSION',
      'No teniu permís d’edició per consultar l’historial de versions d’aquest document (mode de només lectura o compte de Google diferent).'
    );
  }

  if (tilesResp.ok) {
    const firstBatch = parseGoogleJson<TilesResponse>(tilesResp.body);
    if (firstBatch.userMap) {
      userMap = { ...userMap, ...firstBatch.userMap };
    }
    if (typeof firstBatch.firstRev === 'number' && firstBatch.firstRev >= 1) {
      firstRev = firstBatch.firstRev;
    }
    const tiles = firstBatch.tileInfo || [];
    if (tiles.length > 0) {
      lastRev = tiles[tiles.length - 1].end;
      if (firstRev === 1 && tiles[0].start > 1) {
        firstRev = tiles[0].start;
      }

      let guard = 0;
      let cursorStart = lastRev + 1;
      while (tiles.length >= 400 && guard < 15) {
        guard++;
        const nextResp = await fetchInsideDocFrame(
          candidate.tabId,
          candidate.frameId,
          buildQuery(
            'revisions/tiles',
            { start: cursorStart, showDetailedRevisions: 'true' },
            useTabParam
          )
        );
        if (!nextResp.ok) break;
        const nextData = parseGoogleJson<TilesResponse>(nextResp.body);
        if (nextData.userMap) {
          userMap = { ...userMap, ...nextData.userMap };
        }
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
    const probeOne = await fetchInsideDocFrame(
      candidate.tabId,
      candidate.frameId,
      buildQuery('revisions/load', { start: 1, end: 1 }, useTabParam)
    );
    if (probeOne.status === 401 || probeOne.status === 403) {
      throw new ExtractionError(
        'NO_PERMISSION',
        'No teniu permís d’edició per accedir a l’historial de revisions d’aquest document.'
      );
    }
    if (!probeOne.ok) {
      throw new ExtractionError(
        'NO_PERMISSION',
        'No s’ha pogut accedir al registre d’edicions d’aquest document. Verifiqueu que hi teniu permisos d’editor.'
      );
    }

    let low = 1;
    let high = 64;
    while (high < 200_000) {
      const check = await fetchInsideDocFrame(
        candidate.tabId,
        candidate.frameId,
        buildQuery('revisions/load', { start: high, end: high }, useTabParam)
      );
      if (!check.ok) break;
      low = high;
      high *= 2;
    }
    while (low < high - 1) {
      const mid = Math.floor((low + high) / 2);
      const check = await fetchInsideDocFrame(
        candidate.tabId,
        candidate.frameId,
        buildQuery('revisions/load', { start: mid, end: mid }, useTabParam)
      );
      if (check.ok) {
        low = mid;
      } else {
        high = mid;
      }
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
          : `Recuperant ${totalRevs} revisions del document…`,
      percent: Math.round(32 + doneRatio * 55),
    });

    let loadResp = await fetchInsideDocFrame(
      candidate.tabId,
      candidate.frameId,
      buildQuery('revisions/load', { start: batchStart, end: batchEnd }, useTabParam)
    );

    if (!loadResp.ok && batchEnd > batchStart + 200) {
      const smallerEnd = Math.min(lastRev, batchStart + 500 - 1);
      loadResp = await fetchInsideDocFrame(
        candidate.tabId,
        candidate.frameId,
        buildQuery('revisions/load', { start: batchStart, end: smallerEnd }, useTabParam)
      );
      if (loadResp.ok) {
        const parsedSub = parseGoogleJson<LoadResponse>(loadResp.body);
        if (batchStart === firstRev && parsedSub.chunkedSnapshot) {
          initialSnapshot = parsedSub.chunkedSnapshot;
        }
        if (Array.isArray(parsedSub.changelog)) {
          allChangelog.push(...parsedSub.changelog);
        }
        batchStart = smallerEnd + 1;
        continue;
      }
    }

    if (loadResp.status === 401 || loadResp.status === 403) {
      throw new ExtractionError(
        'NO_PERMISSION',
        'Google Docs ha denegat l’accés a les revisions detallades. Cal permís d’edició sobre el document.'
      );
    }

    if (!loadResp.ok) {
      if (allChangelog.length > 0) break;
      throw new ExtractionError(
        'NETWORK',
        `Google Docs ha retornat un error (codi ${loadResp.status}) en carregar l’historial.`
      );
    }

    const parsedLoad = parseGoogleJson<LoadResponse>(loadResp.body);
    if (batchStart === firstRev && parsedLoad.chunkedSnapshot) {
      initialSnapshot = parsedLoad.chunkedSnapshot;
    }
    if (Array.isArray(parsedLoad.changelog)) {
      allChangelog.push(...parsedLoad.changelog);
    }

    batchStart = batchEnd + 1;
  }

  onProgress?.({
    phase: 'processant',
    message: 'Reconstruint el text i calculant mètriques…',
    percent: 92,
  });

  return {
    docId: probe.docId,
    title: probe.title,
    tabId: probe.tabParam || undefined,
    firstRev,
    lastRev,
    fetchedAt: Date.now(),
    userMap,
    chunkedSnapshot: initialSnapshot,
    changelog: allChangelog,
  };
}

export async function extractGoogleDocHistory(
  onProgress?: (p: ExtractionProgress) => void
): Promise<RawDocumentHistory> {
  return extractGoogleDocForTab(undefined, onProgress);
}
