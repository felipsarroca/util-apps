// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  detectGoogleDocForTab,
  extractGoogleDocForTab,
} from '../extractor/gdocsExtractor';
import { checkForUpdate } from '../core/updateCheck';

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
    await chrome.action.setTitle({ title: 'Obre Traces per analitzar el document' });
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
// - En un Google Doc, obre el panell ample integrat dins del document.
// - En qualsevol altra pestanya, obre el panell lateral natiu de Chrome.
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  const tabId = tab.id;
  const url = tab.url || '';
  const isDoc = url.startsWith('https://docs.google.com/document/');

  if (!isDoc) {
    chrome.sidePanel?.open({ tabId }).catch(() => {});
    return;
  }

  void (async () => {
    const toggle = () =>
      chrome.tabs.sendMessage(tabId, { type: 'TRACES_TOGGLE_IN_PAGE_DRAWER' });
    try {
      const resp = await toggle();
      if (resp?.handled) return;
    } catch {
      // La pestanya es va obrir abans d'instal·lar l'extensió: injectem el botó ara
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: ['content.js'],
      });
      await toggle();
    } catch {
      // Sense accés a la pestanya
    }
  })();
});

// La interfície incrustada al document delega aquí la detecció i l'extracció si cal
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

  if (msg?.type === 'TRACES_REFRESH_UPDATE_BADGE') {
    void refreshUpdateBadge();
  }

  return false;
});

function notifyActiveTabChanged(tabId: number, url?: string): void {
  chrome.runtime
    .sendMessage({ type: 'TRACES_TAB_CHANGED', tabId, url: url || '' })
    .catch(() => {});
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
