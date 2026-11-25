// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  detectGoogleDocForTab,
  docBaseUrl,
  extractGoogleDocForTab,
  fetchHistory,
  makeFrameFetcher,
  parseDocUrl,
  resolveTargetFromEditPage,
  type Fetcher,
} from '../extractor/gdocsExtractor';
import { checkForUpdate } from '../core/updateCheck';
import { analyzeDocumentHistory, toStoredSummary } from '../core/metrics';
import { saveClassSummary } from '../core/classStore';
import { DEFAULT_SETTINGS, type AnalysisSettings, type DocKind } from '../types';

// Comprova si hi ha una versió nova publicada i ho indica amb una insígnia a la icona
async function refreshUpdateBadge(): Promise<void> {
  const current = chrome.runtime.getManifest().version;
  const info = await checkForUpdate(current);
  if (info) {
    await chrome.action.setBadgeText({ text: '↑' });
    await chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
    await chrome.action.setTitle({
      title: `Traces: hi ha una versió nova (${info.version}). Obre el panell per actualitzar.`,
    });
  } else {
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'Obre Traces' });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
  void refreshUpdateBadge();
});

chrome.runtime.onStartup.addListener(() => {
  void refreshUpdateBadge();
});

// Clic a la icona de la barra d'extensions:
// - En un fitxer de Google, obre el panell integrat dins del fitxer.
// - En qualsevol altra pestanya (Classroom inclòs), obre el panell lateral de Chrome.
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  const tabId = tab.id;
  const isDoc = Boolean(parseDocUrl(tab.url || ''));

  if (!isDoc) {
    chrome.sidePanel?.open({ tabId }).catch(() => {});
    return;
  }

  void (async () => {
    const toggle = () => chrome.tabs.sendMessage(tabId, { type: 'TRACES_TOGGLE_IN_PAGE_DRAWER' });
    try {
      const resp = await toggle();
      if (resp?.handled) return;
    } catch {
      // La pestanya es va obrir abans d'instal·lar l'extensió: injectem el botó ara
    }
    try {
      await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
      await toggle();
    } catch {
      // Sense accés a la pestanya
    }
  })();
});

async function loadSettings(): Promise<AnalysisSettings> {
  try {
    const res = await chrome.storage.local.get('traces_settings_v1');
    return { ...DEFAULT_SETTINGS, ...(res?.traces_settings_v1 ?? {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Per llegir l'historial cal la sessió de Google. Si hi ha alguna pestanya de
 * docs.google.com oberta, la petició es fa des d'allà (mateix origen); si no,
 * directament des del Service Worker amb les galetes de l'usuari.
 */
async function getDocsFetcher(): Promise<Fetcher> {
  const tabs = await chrome.tabs.query({ url: 'https://docs.google.com/*' });
  const usable = tabs.find((t) => t.id && t.status === 'complete' && !t.discarded);
  if (usable?.id) return makeFrameFetcher(usable.id, 0);
  return async (url: string) => {
    try {
      const resp = await fetch(url, { credentials: 'include' });
      return { ok: resp.ok, status: resp.status, body: await resp.text() };
    } catch (err) {
      return { ok: false, status: 0, body: '', errorMessage: String(err) };
    }
  };
}

interface LinkItem {
  url: string;
  docId: string;
  kind: DocKind;
  userPrefix: string;
}

let classRunning = false;

/** Analitza en sèrie els treballs enllaçats en una pàgina de Classroom. */
async function analyzeLinks(tabId: number, items: LinkItem[]): Promise<void> {
  if (classRunning) return;
  classRunning = true;
  const settings = await loadSettings();
  const fetcher = await getDocsFetcher();
  let done = 0;
  try {
    for (const item of items) {
      let summary;
      let error: string | undefined;
      try {
        const target = await resolveTargetFromEditPage(fetcher, item.kind, item.docId, item.userPrefix);
        const history = await fetchHistory(fetcher, target);
        const analysis = analyzeDocumentHistory(history, settings);
        summary = toStoredSummary(analysis, docBaseUrl(item.kind, item.docId, item.userPrefix) + '/edit');
        await saveClassSummary(summary);
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
      done++;
      chrome.tabs
        .sendMessage(tabId, { type: 'TRACES_CLASS_PROGRESS', docId: item.docId, summary, error, done, total: items.length })
        .catch(() => {});
      chrome.runtime.sendMessage({ type: 'TRACES_CLASS_UPDATED' }).catch(() => {});
    }
  } finally {
    classRunning = false;
  }
}

// La interfície incrustada i els content scripts deleguen aquí les tasques privilegiades
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'TRACES_BG_DETECT_DOC') {
    detectGoogleDocForTab(sender.tab?.id)
      .then((candidate) => sendResponse({ ok: true, candidate }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (msg?.type === 'TRACES_BG_EXTRACT_DOC') {
    extractGoogleDocForTab(sender.tab?.id)
      .then((history) => sendResponse({ ok: true, history }))
      .catch((err) =>
        sendResponse({
          ok: false,
          code: err?.code || 'UNKNOWN',
          message: err instanceof Error ? err.message : String(err),
        })
      );
    return true;
  }

  if (msg?.type === 'TRACES_BG_ANALYZE_LINKS' && sender.tab?.id) {
    const tabId = sender.tab.id;
    // Obre el panell lateral amb la taula de la classe (si Chrome ho permet en aquest moment)
    void chrome.storage.local.set({ traces_open_view: { view: 'classe', at: Date.now() } });
    chrome.sidePanel?.open({ tabId }).catch(() => {});
    chrome.runtime.sendMessage({ type: 'TRACES_SHOW_CLASS' }).catch(() => {});
    void analyzeLinks(tabId, Array.isArray(msg.items) ? msg.items : []);
    sendResponse({ ok: true });
    return false;
  }

  if (msg?.type === 'TRACES_BG_FILL_COMMENT') {
    void (async () => {
      let tabId = sender.tab?.id;
      if (!tabId) {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        tabId = active?.id;
      }
      if (!tabId) {
        sendResponse({ ok: false });
        return;
      }
      try {
        const resp = await chrome.tabs.sendMessage(
          tabId,
          { type: 'TRACES_FILL_PRIVATE_COMMENT', text: msg.text },
          { frameId: 0 }
        );
        sendResponse({ ok: Boolean(resp?.ok) });
      } catch {
        sendResponse({ ok: false });
      }
    })();
    return true;
  }

  if (msg?.type === 'TRACES_REFRESH_UPDATE_BADGE') {
    void refreshUpdateBadge();
  }

  return false;
});

function notifyActiveTabChanged(tabId: number, url?: string): void {
  chrome.runtime.sendMessage({ type: 'TRACES_TAB_CHANGED', tabId, url: url || '' }).catch(() => {});
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    notifyActiveTabChanged(activeInfo.tabId, tab?.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.status === 'complete' || changeInfo.url)) {
    notifyActiveTabChanged(tabId, tab.url);
  }
});
