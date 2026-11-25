// SPDX-License-Identifier: AGPL-3.0-or-later

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch(() => {
        // Ignora en versions antigues de Chromium
      });
  }
});

// Notifica al panell lateral quan l'usuari canvia de pestanya o navega a un altre document
function notifyActiveTabChanged(tabId: number, url?: string): void {
  chrome.runtime
    .sendMessage({
      type: 'TRACES_TAB_CHANGED',
      tabId,
      url: url || '',
    })
    .catch(() => {
      // El panell lateral està tancat: cap acció necessària
    });
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
