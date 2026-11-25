// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Content script per a Google Classroom (autocontingut, sense imports):
 * - A les pàgines amb diversos treballs, mostra el botó «Analitza la classe» i, al costat
 *   de cada fitxer, una etiqueta compacta amb el resum de Traces.
 * - Llegeix la data de lliurament que mostra la pàgina perquè Traces la pugui comparar
 *   amb el procés de treball.
 * - Omple (sense enviar-lo) el camp de comentari privat quan el docent ho demana.
 * No llegeix res fins que el docent fa clic.
 */

const CLASS_BTN_ID = 'traces-classroom-analyze';
const STYLE_ID = 'traces-classroom-styles';
const CHIP_CLASS = 'traces-cr-chip';
const DUE_KEY = 'traces_due_v1';
const DOC_LINK_RE = /https:\/\/docs\.google\.com\/(document|presentation|spreadsheets)\/(?:(u\/\d+)\/)?d\/([a-zA-Z0-9_-]{20,})/;

interface LinkItem {
  url: string;
  docId: string;
  kind: 'document' | 'presentation' | 'spreadsheet';
  userPrefix: string;
}

interface ChipSummary {
  activeSeconds: number;
  progressivePct: number;
  bulkPct: number;
  sessions: number;
  days: number;
  mainAuthor: string;
  kind: string;
}

const KINDS: Record<string, LinkItem['kind']> = {
  document: 'document',
  presentation: 'presentation',
  spreadsheets: 'spreadsheet',
};

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${CLASS_BTN_ID} {
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
      display: inline-flex; align-items: center; gap: 8px;
      height: 40px; padding: 0 16px 0 12px; border-radius: 20px;
      border: 1px solid #BAE6FD; background: #FFFFFF; color: #0C4A6E;
      font: 600 14px/1 'Google Sans', Roboto, Arial, sans-serif; cursor: pointer;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.16);
    }
    #${CLASS_BTN_ID}:hover { background: #F0F9FF; }
    #${CLASS_BTN_ID}[disabled] { opacity: .75; cursor: progress; }
    .${CHIP_CLASS} {
      display: inline-flex; align-items: center; gap: 4px; margin: 2px 0 2px 6px;
      padding: 2px 8px; border-radius: 10px; vertical-align: middle;
      font: 600 11.5px/1.4 'Google Sans', Roboto, Arial, sans-serif; white-space: nowrap;
      background: #F1F5F9; color: #334155; border: 1px solid #E2E8F0;
    }
    .${CHIP_CLASS}[data-tone="ok"] { background: #ECFDF5; color: #065F46; border-color: #A7F3D0; }
    .${CHIP_CLASS}[data-tone="mix"] { background: #FFFBEB; color: #92400E; border-color: #FDE68A; }
    .${CHIP_CLASS}[data-tone="bulk"] { background: #FEF2F2; color: #991B1B; border-color: #FECACA; }
    .${CHIP_CLASS}[data-tone="wait"] { color: #64748B; }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function parseLink(href: string): LinkItem | null {
  const m = href.match(DOC_LINK_RE);
  if (!m) return null;
  return { url: m[0], kind: KINDS[m[1]], userPrefix: m[2] || '', docId: m[3] };
}

/** Enllaços a fitxers de Google visibles a la pàgina, agrupats per fitxer. */
function collectDocLinks(): Map<string, { item: LinkItem; anchors: HTMLAnchorElement[] }> {
  const found = new Map<string, { item: LinkItem; anchors: HTMLAnchorElement[] }>();
  document.querySelectorAll<HTMLAnchorElement>('a[href*="docs.google.com/"]').forEach((a) => {
    const item = parseLink(a.href);
    if (!item) return;
    const entry = found.get(item.docId) ?? { item, anchors: [] };
    entry.anchors.push(a);
    found.set(item.docId, entry);
  });
  return found;
}

function formatDuration(seconds: number): string {
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

function setChip(docId: string, state: { summary?: ChipSummary; error?: string; waiting?: boolean }): void {
  const links = collectDocLinks().get(docId);
  if (!links) return;
  const anchor = links.anchors[links.anchors.length - 1];
  let chip = anchor.parentElement?.querySelector<HTMLSpanElement>(`.${CHIP_CLASS}[data-doc="${docId}"]`) ?? null;
  if (!chip) {
    chip = document.createElement('span');
    chip.className = CHIP_CLASS;
    chip.dataset.doc = docId;
    anchor.insertAdjacentElement('afterend', chip);
  }
  if (state.waiting) {
    chip.dataset.tone = 'wait';
    chip.textContent = 'Traces…';
    chip.title = 'Analitzant';
    return;
  }
  if (state.error || !state.summary) {
    chip.dataset.tone = 'wait';
    chip.textContent = 'Traces: sense dades';
    chip.title = state.error || 'No s’ha pogut analitzar';
    return;
  }
  const s = state.summary;
  chip.dataset.tone = s.bulkPct >= 55 ? 'bulk' : s.bulkPct >= 20 ? 'mix' : 'ok';
  chip.textContent =
    s.kind === 'spreadsheet'
      ? `${formatDuration(s.activeSeconds)} · ${s.sessions} ses.`
      : `${formatDuration(s.activeSeconds)} · ${s.progressivePct} % escrit`;
  chip.title =
    `${s.mainAuthor}: ${formatDuration(s.activeSeconds)} de treball actiu en ${s.sessions} ` +
    `${s.sessions === 1 ? 'sessió' : 'sessions'} (${s.days} ${s.days === 1 ? 'dia' : 'dies'}). ` +
    `${s.progressivePct} % escrit pas a pas · ${s.bulkPct} % enganxat.`;
}

/* ───────── Data de lliurament ───────── */

const DUE_LINE_RE =
  /(data de venciment|venciment|venç|data de lliurament|data límit|fecha de entrega|fecha límite|vence|due date|due)\s*:?\s*([^\n]{3,40})/i;

let lastDueSignature = '';

function captureDueDate(): void {
  const text = document.body?.innerText || '';
  const m = text.match(DUE_LINE_RE);
  if (!m) return;
  const dueText = `${m[1]} ${m[2]}`.trim();
  const docIds = new Set<string>();
  collectDocLinks().forEach((_v, id) => docIds.add(id));
  document.querySelectorAll<HTMLIFrameElement>('iframe[src*="docs.google.com/"]').forEach((f) => {
    const item = parseLink(f.src);
    if (item) docIds.add(item.docId);
  });
  if (docIds.size === 0) return;
  const signature = `${dueText}|${Array.from(docIds).sort().join(',')}`;
  if (signature === lastDueSignature) return;
  lastDueSignature = signature;
  try {
    chrome.storage.local.get(DUE_KEY, (res) => {
      const map = (res?.[DUE_KEY] as Record<string, { text: string; at: number }>) ?? {};
      const now = Date.now();
      docIds.forEach((id) => {
        map[id] = { text: dueText, at: now };
      });
      // Conserva només les 800 entrades més recents
      const entries = Object.entries(map).sort((a, b) => b[1].at - a[1].at).slice(0, 800);
      chrome.storage.local.set({ [DUE_KEY]: Object.fromEntries(entries) });
    });
  } catch {
    // Context invalidat (extensió actualitzada): s'ignora
  }
}

/* ───────── Comentari privat ───────── */

function findPrivateCommentField(): HTMLElement | null {
  const re = /comentari privat|comentaris privats|private comment|comentario privado/i;
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('textarea, [contenteditable="true"], [role="textbox"]')
  );
  const labelled = candidates.find((el) =>
    re.test(
      `${el.getAttribute('aria-label') || ''} ${el.getAttribute('placeholder') || ''} ${
        el.getAttribute('data-placeholder') || ''
      }`
    )
  );
  if (labelled) return labelled;
  // Si no té etiqueta, busca el camp dins de la secció «Comentaris privats»
  for (const el of candidates) {
    let node: HTMLElement | null = el;
    for (let i = 0; i < 6 && node; i++) {
      node = node.parentElement;
      if (node && re.test((node.innerText || '').slice(0, 120))) return el;
    }
  }
  return null;
}

function fillPrivateComment(text: string): boolean {
  const field = findPrivateCommentField();
  if (!field) return false;
  field.scrollIntoView({ block: 'center' });
  field.focus();
  if (field instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    const value = field.value ? `${field.value}\n${text}` : text;
    setter?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    document.execCommand('insertText', false, text);
  }
  return true;
}

/* ───────── Botó «Analitza la classe» ───────── */

let analyzing = false;

function updateClassButton(): void {
  const links = collectDocLinks();
  let btn = document.getElementById(CLASS_BTN_ID) as HTMLButtonElement | null;
  if (links.size < 2) {
    btn?.remove();
    return;
  }
  if (!btn) {
    injectStyles();
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = CLASS_BTN_ID;
    btn.addEventListener('click', startClassAnalysis);
    document.body.appendChild(btn);
  }
  const label = `Analitza la classe (${links.size})`;
  // Només es reescriu si canvia, per no provocar un bucle amb l'observador
  if (!analyzing && btn.querySelector('span')?.textContent !== label) {
    const iconUrl = chrome.runtime.getURL('icons/icon32.png');
    btn.innerHTML = `<img src="${iconUrl}" width="20" height="20" alt="" aria-hidden="true"><span>${label}</span>`;
    btn.disabled = false;
  }
}

function startClassAnalysis(): void {
  if (analyzing) return;
  const links = collectDocLinks();
  if (links.size === 0) return;
  analyzing = true;
  const btn = document.getElementById(CLASS_BTN_ID) as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.querySelector('span')!.textContent = `Analitzant 0/${links.size}…`;
  }
  links.forEach((_v, id) => setChip(id, { waiting: true }));
  chrome.runtime
    .sendMessage({
      type: 'TRACES_BG_ANALYZE_LINKS',
      items: Array.from(links.values()).map((l) => l.item),
    })
    .catch(() => {
      analyzing = false;
      updateClassButton();
    });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'TRACES_CLASS_PROGRESS') {
    setChip(msg.docId, { summary: msg.summary, error: msg.error });
    const btn = document.getElementById(CLASS_BTN_ID) as HTMLButtonElement | null;
    const label = btn?.querySelector('span');
    if (label) label.textContent = `Analitzant ${msg.done}/${msg.total}…`;
    if (msg.done >= msg.total) {
      analyzing = false;
      updateClassButton();
    }
    return false;
  }
  if (msg?.type === 'TRACES_FILL_PRIVATE_COMMENT' && window === window.top) {
    sendResponse({ ok: fillPrivateComment(String(msg.text || '')) });
    return true;
  }
  return false;
});

let scheduled = 0;
function scheduleScan(): void {
  if (scheduled) return;
  scheduled = window.setTimeout(() => {
    scheduled = 0;
    updateClassButton();
    captureDueDate();
  }, 700);
}

if (window === window.top) {
  scheduleScan();
  new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true });
}
