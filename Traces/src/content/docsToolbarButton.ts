// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Content script lleuger per a Google Docs:
 * - NO llegeix ni analitza cap dada del document en segon pla.
 * - Afegeix un botó integrat «Traces» a la barra superior de Google Docs.
 * - En fer-hi clic, desplega un panell lateral ample (480 px per defecte, ampliable a 660 px
 *   o redimensionable arrossegant la vora) amb tota la informació clara i còmoda de llegir.
 */

const BUTTON_ID = 'traces-gdocs-toolbar-btn';
const DRAWER_ID = 'traces-gdocs-drawer-root';
const STYLE_ID = 'traces-gdocs-injected-styles';
const WIDTH_STORAGE_KEY = 'traces_drawer_width_v1';

const DEFAULT_WIDTH = 480;
const WIDE_WIDTH = 660;
const MIN_WIDTH = 360;
const MAX_WIDTH = 780;

let drawerWidth = DEFAULT_WIDTH;
let isExpandedWide = false;

function isRealDocEditorFrame(): boolean {
  if (!/\/document\/(?:u\/\d+\/)?d\/[a-zA-Z0-9_-]+/.test(location.pathname)) {
    return false;
  }
  // Evita injectar en iframes interns ocults de Google Docs (com sandbox d'impressió o xat)
  if (window.innerWidth < 300 || window.innerHeight < 200) {
    return false;
  }
  return true;
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${BUTTON_ID} {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 34px;
      padding: 0 13px 0 10px;
      margin-right: 8px;
      border-radius: 999px;
      border: 1px solid #bae6fd;
      background: #f0f9ff;
      color: #0f172a;
      font-family: 'Google Sans', Roboto, system-ui, sans-serif;
      font-size: 13.5px;
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
      user-select: none;
      vertical-align: middle;
      transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
      z-index: 999;
    }
    #${BUTTON_ID}:hover {
      background: #e0f2fe;
      border-color: #7dd3fc;
    }
    #${BUTTON_ID}.traces-btn-active {
      background: #1e293b;
      border-color: #1e293b;
      color: #ffffff;
    }
    #${BUTTON_ID}.traces-btn-floating {
      position: fixed;
      top: 12px;
      right: 16px;
      z-index: 2147483645;
    }
    #${BUTTON_ID} .traces-btn-badge {
      width: 20px;
      height: 20px;
      display: block;
      flex-shrink: 0;
    }
    #${DRAWER_ID} {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: ${DEFAULT_WIDTH}px;
      max-width: 92vw;
      background: #f4f6fb;
      border-left: 1px solid #cbd5e1;
      box-shadow: -10px 0 28px rgba(15, 23, 42, 0.14);
      z-index: 2147483646;
      display: none;
      flex-direction: column;
    }
    #${DRAWER_ID}.traces-drawer-open {
      display: flex;
    }
    #${DRAWER_ID} .traces-resize-handle {
      position: absolute;
      top: 0;
      left: -4px;
      bottom: 0;
      width: 8px;
      cursor: ew-resize;
      z-index: 2;
    }
    #${DRAWER_ID} .traces-resize-handle::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 3px;
      transform: translateY(-50%);
      width: 2px;
      height: 36px;
      border-radius: 2px;
      background: #94a3b8;
      opacity: 0;
      transition: opacity 0.15s;
    }
    #${DRAWER_ID} .traces-resize-handle:hover::after {
      opacity: 0.85;
    }
    #${DRAWER_ID} iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #f4f6fb;
      display: block;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function loadSavedWidth(): void {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(WIDTH_STORAGE_KEY, (res) => {
        const w = Number(res?.[WIDTH_STORAGE_KEY]);
        if (Number.isFinite(w) && w >= MIN_WIDTH && w <= MAX_WIDTH) {
          drawerWidth = w;
          const drawer = document.getElementById(DRAWER_ID);
          if (drawer) drawer.style.width = `${drawerWidth}px`;
        }
      });
    }
  } catch {
    // Ignora si el context s'ha invalidat
  }
}

function saveWidth(w: number): void {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      void chrome.storage.local.set({ [WIDTH_STORAGE_KEY]: Math.round(w) });
    }
  } catch {
    // Ignora
  }
}

function ensureDrawer(): HTMLElement {
  let drawer = document.getElementById(DRAWER_ID);
  if (drawer) return drawer;

  drawer = document.createElement('aside');
  drawer.id = DRAWER_ID;
  drawer.setAttribute('aria-label', 'Panell lateral de Traces');
  drawer.style.width = `${drawerWidth}px`;

  const handle = document.createElement('div');
  handle.className = 'traces-resize-handle';
  handle.title = 'Arrossega per ajustar l’amplada del panell';

  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('sidepanel.html?embedded=1');
  iframe.allow = 'clipboard-write';

  // Drag-to-resize logic
  let dragging = false;
  handle.addEventListener('mousedown', (ev) => {
    ev.preventDefault();
    dragging = true;
    iframe.style.pointerEvents = 'none';

    const onMove = (moveEv: MouseEvent) => {
      if (!dragging || !drawer) return;
      const nextW = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, window.innerWidth - moveEv.clientX)
      );
      drawerWidth = nextW;
      drawer.style.width = `${nextW}px`;
    };

    const onUp = () => {
      dragging = false;
      iframe.style.pointerEvents = '';
      saveWidth(drawerWidth);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  drawer.appendChild(handle);
  drawer.appendChild(iframe);
  document.body.appendChild(drawer);
  return drawer;
}

function setDrawerOpen(open: boolean): void {
  const btn = document.getElementById(BUTTON_ID);
  if (!open) {
    const existing = document.getElementById(DRAWER_ID);
    if (existing) existing.classList.remove('traces-drawer-open');
    if (btn) btn.classList.remove('traces-btn-active');
    return;
  }

  const drawer = ensureDrawer();
  const wasClosed = !drawer.classList.contains('traces-drawer-open');
  drawer.classList.add('traces-drawer-open');
  if (btn) btn.classList.add('traces-btn-active');

  // Quan es torna a obrir, demana a l'iframe que refresqui si cal
  if (wasClosed) {
    const iframe = drawer.querySelector('iframe');
    iframe?.contentWindow?.postMessage({ type: 'TRACES_REFRESH_REQUEST' }, '*');
  }
}

function toggleDrawer(): void {
  const existing = document.getElementById(DRAWER_ID);
  const isOpen = Boolean(existing?.classList.contains('traces-drawer-open'));
  setDrawerOpen(!isOpen);
}

function createToolbarButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = BUTTON_ID;
  btn.title = 'Analitza l’historial d’elaboració amb Traces';
  const iconUrl = chrome.runtime.getURL('icons/icon32.png');
  btn.innerHTML = `
    <img class="traces-btn-badge" src="${iconUrl}" width="20" height="20" alt="" aria-hidden="true" />
    <span>Traces</span>
  `;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDrawer();
  });
  return btn;
}

function mountToolbarButton(): void {
  if (!isRealDocEditorFrame()) return;
  if (document.getElementById(BUTTON_ID)) return;

  injectStyles();
  loadSavedWidth();

  const btn = createToolbarButton();
  const shareContainer =
    document.querySelector('.docs-titlebar-buttons') ||
    document.getElementById('docs-titlebar-share-client-button')?.parentElement;

  if (shareContainer) {
    shareContainer.insertBefore(btn, shareContainer.firstChild);
  } else if (document.body) {
    btn.classList.add('traces-btn-floating');
    document.body.appendChild(btn);
  }
}

// Escolta missatges des de l'iframe de Traces (tancar o eixamplar) i des de la icona d'extensió
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'TRACES_CLOSE_DRAWER') {
    setDrawerOpen(false);
  } else if (data.type === 'TRACES_TOGGLE_WIDTH') {
    const drawer = document.getElementById(DRAWER_ID);
    if (!drawer) return;
    isExpandedWide = !isExpandedWide;
    drawerWidth = isExpandedWide ? WIDE_WIDTH : DEFAULT_WIDTH;
    drawer.style.width = `${drawerWidth}px`;
    saveWidth(drawerWidth);
  }
});

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'TRACES_TOGGLE_IN_PAGE_DRAWER') {
      if (isRealDocEditorFrame()) {
        mountToolbarButton();
        toggleDrawer();
        sendResponse({ handled: true });
        return true;
      }
    }
    return false;
  });
}

function init(): void {
  if (!isRealDocEditorFrame()) return;
  mountToolbarButton();

  // Observador lleuger per si Google Docs reconstrueix la barra superior en acabar de carregar
  const observer = new MutationObserver(() => {
    const existing = document.getElementById(BUTTON_ID);
    if (!existing) {
      mountToolbarButton();
    } else if (existing.classList.contains('traces-btn-floating')) {
      const shareContainer = document.querySelector('.docs-titlebar-buttons');
      if (shareContainer) {
        existing.classList.remove('traces-btn-floating');
        shareContainer.insertBefore(existing, shareContainer.firstChild);
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

init();
