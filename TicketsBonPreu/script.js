// Utilities
const formatEur = (n) => new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const byId = (id) => document.getElementById(id);

// Persistence keys
const LS_KEYS = {
  productMap: 'bp_product_category_map_v1',
  tickets: 'bp_tickets_v1'
};

// Categories and colors
const CATEGORIES = ['menjar', 'higiene personal', 'neteja de la llar', 'altres'];
const CAT_CLASS = {
  'menjar': 'color-menjar',
  'higiene personal': 'color-higiene',
  'neteja de la llar': 'color-neteja',
  'altres': 'color-altres'
};

// Simple keyword rules (initial heuristic)
const KEYWORDS = {
  'menjar': [
    'pa','llet','iogurt','formatge','ou','ous','arros','pasta','tomaquet','cogombre','patata','patates','pollastre','tonyina','pernil','poma','platan','raim','galeta','cacau','cereals','sucre','cafe','te','aigua','oliva','olives','oli','vinagre','pizza','hamb','burg','iogur','nabius','ametlla','ametlles','salsa','quetxup','ketchup','maionesa','galetes','llenties','cigrons','mongeta','peix','vedella','porc','brou','postres'
  ],
  'higiene personal': [
    'raspall','pasta de dents','xampu','gel','rentamans','sabo','desodorant','compreses','paper de vater','paper higienic','cotonets','bolquers','maquineta','fulles afeitar'
  ],
  'neteja de la llar': [
    'lleixiu','detergent','rentaplats','rentavaixelles','neteja','desinfectant','bossa escombraries','bosses escombraries','fregall','balleta','baieta','suavitzant','desgreixant','multiusos','ambientador'
  ]
};

// State
let productMap = loadJSON(LS_KEYS.productMap, {}); // { normalized_name: category }
let tickets = loadJSON(LS_KEYS.tickets, []);      // [{id, dateISO, items:[{name, price, category}]}]

// Init UI
window.addEventListener('DOMContentLoaded', () => {
  const dz = byId('dropzone');
  const fi = byId('fileInput');
  const clearBtn = byId('clearDataBtn');
  const exportBtn = byId('exportCsvBtn');

  ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('focus'); }));
  ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('focus'); }));
  dz.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
  dz.addEventListener('click', () => { fi.value=''; fi.click(); });
  fi.addEventListener('change', () => handleFiles(fi.files));

  clearBtn.addEventListener('click', () => {
    if (!confirm('Segur que vols esborrar les dades guardades?')) return;
    productMap = {};
    tickets = [];
    persist();
    renderAll();
  });

  exportBtn.addEventListener('click', () => exportCSV());

  renderAll();
});

function handleFiles(fileList){
  const files = Array.from(fileList || []).filter(f => /jpe?g$/i.test(f.name));
  const dbg = byId('debug');
  if (dbg){
    dbg.classList.remove('hidden');
    dbg.textContent = files.length ? `Detectats ${files.length} fitxer(s): ` + files.map(f=>f.name).join(', ') : 'Cap fitxer JPG detectat';
  }
  if (!files.length) return;
  processFilesSequentially(files);
}

async function processFilesSequentially(files){
  const progress = byId('progress');
  progress.classList.remove('hidden');
  progress.innerHTML = `<div class="label">Processant ${files.length} imatge(s)...</div><div class="progressbar"><div class="bar" style="width:0%"></div></div>`;

  for (let i=0;i<files.length;i++){
    try{
      // Context perquè l'actualització de progrés mostri quin fitxer està en curs
      window.__ocrContext = { idx: i+1, total: files.length, name: files[i].name };
      setProgressLabel(`OCR ${i+1}/${files.length} — preparant: ${files[i].name}`);
      startOcrProgressTimer();
      const text = await ocrImage(files[i]);
      const ticket = parseTicket(text, files[i].name);
      classifyItems(ticket.items);
      tickets.push(ticket);
      persist();
      renderAll();
      stopOcrProgressTimer(true);
    }catch(err){
      console.error(err);
      stopOcrProgressTimer(false);
      progress.innerHTML = `<div class="label">Error amb ${files[i].name}: ${err?.message || err}</div>`;
    }
  }
  progress.innerHTML = '<div class="label">Fet!</div>';
  setTimeout(()=>progress.classList.add('hidden'), 1200);
}

async function ocrImage(file){
  const prepped = await preprocessImage(file);
  if (!window.Tesseract){
    throw new Error("Tesseract no s'ha carregat. Prova obrint amb un servidor local.");
  }
  // Via directa amb Tesseract.recognize i logger (sense passar funcions al Worker)
  try{
    const { data } = await Tesseract.recognize(
      prepped,
      'cat+spa+eng'
    );
    updateOcrProgress('fet', 1);
    return (data && data.text) ? data.text : '';
  }catch(err){
    console.warn('Falla unpkg, reintentant amb jsDelivr', err);
    setProgressLabel('Reintentant OCR (cdn alternatiu)...');
    const { data } = await Tesseract.recognize(
      prepped,
      'cat+spa+eng'
    );
    updateOcrProgress('fet', 1);
    return (data && data.text) ? data.text : '';
  }
}

// Helpers de progrés OCR
function setProgressLabel(text){
  const el = byId('progress');
  if (!el) return;
  el.classList.remove('hidden');
  const hasBar = !!el.querySelector('.progressbar');
  if (!hasBar){
    el.innerHTML = `<div class="label">${text}</div><div class="progressbar"><div class="bar" style="width:0%"></div></div>`;
  }else{
    const label = el.querySelector('.label');
    if (label) label.textContent = text;
  }
}

function updateOcrProgress(status, frac){
  const pct = Math.max(0, Math.min(100, Math.round((frac || 0) * 100)));
  const ctx = window.__ocrContext || {};
  const label = `OCR ${ctx.idx || '?'} / ${ctx.total || '?'} — ${status} ${pct}% — ${ctx.name || ''}`;
  const el = byId('progress');
  if (!el) return;
  el.classList.remove('hidden');
  if (!el.querySelector('.progressbar')){
    el.innerHTML = `<div class="label">${label}</div><div class="progressbar"><div class="bar" style="width:${pct}%"></div></div>`;
  }else{
    const l = el.querySelector('.label');
    const bar = el.querySelector('.progressbar .bar');
    if (l) l.textContent = label;
    if (bar){
      bar.style.width = `${pct}%`;
      // Assigna color segons fase
      const phase = phaseFromStatus(status);
      bar.classList.remove('phase-loading','phase-init','phase-recognize','phase-done');
      if (phase) bar.classList.add(phase);
    }
  }
}

function phaseFromStatus(status){
  const s = String(status || '').toLowerCase();
  if (s.includes('load') || s.includes('init worker')) return 'phase-loading';
  if (s.includes('init') || s.includes('initialize')) return 'phase-init';
  if (s.includes('recognize') || s.includes('text')) return 'phase-recognize';
  if (s.includes('fet') || s.includes('done')) return 'phase-done';
  return '';
}

// Progrés simulat (sense logger) per evitar DataCloneError
let __ocrTimer = null;
function startOcrProgressTimer(){
  stopOcrProgressTimer();
  let p = 0;
  let phase = 'loading';
  const tick = () => {
    // increments més ràpids al principi, més lents cap al 90%
    const delta = p < 30 ? 2.5 : p < 70 ? 1.2 : 0.5;
    p = Math.min(90, p + delta);
    updateOcrProgress(phase, p/100);
    if (p > 35) phase = 'recognize';
  };
  updateOcrProgress('loading', 0.05);
  __ocrTimer = setInterval(tick, 140);
}
function stopOcrProgressTimer(success){
  if (__ocrTimer){ clearInterval(__ocrTimer); __ocrTimer = null; }
  if (success){ updateOcrProgress('fet', 1); }
}

// Image preprocessing: denoise + scale for OCR
async function preprocessImage(file, targetWidth = 1800){
  const img = await fileToImage(file);
  const scale = Math.max(1, targetWidth / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,w,h);
  ctx.drawImage(img, 0, 0, w, h);

  // Simple grayscale to improve contrast
  const imgData = ctx.getImageData(0,0,w,h);
  const d = imgData.data;
  for (let i=0;i<d.length;i+=4){
    const v = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
    const bw = v > 200 ? 255 : (v < 120 ? 0 : v);
    d[i]=d[i+1]=d[i+2]=bw;
  }
  ctx.putImageData(imgData,0,0);

  return await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
}

function fileToImage(file){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function parseTicket(text, filename){
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  // Date (dd/mm/yyyy or dd-mm-yyyy)
  const dateMatch = text.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/);
  const dateISO = dateMatch ? toISO(dateMatch[1]) : new Date().toISOString().slice(0,10);

  const items = [];
  for (const raw of lines){
    if (/total|desglossament|iva|copia|pagament|compte|descomptes|subtotal/i.test(raw)) continue;
    const m = raw.match(/(.+?)\s+(-?\d+[\.,]\d{2})$/);
    if (!m) continue;
    const name = cleanName(m[1]);
    const price = parseFloat(m[2].replace(',', '.'));
    if (name.length < 2 || isNaN(price)) continue;
    items.push({ name, price, category: 'altres' });
  }

  // Deduplicate similar lines (sum prices by normalized key)
  const deduped = dedupItems(items);

  // Simple id
  const id = `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  return { id, file: filename, dateISO, items: deduped };
}

function cleanName(s){
  // Remove bullets/dots and normalize spaces
  return s.replace(/\s{2,}/g,' ').replace(/[\u2022\u00B7]+/g,' ').trim();
}

function dedupKey(name){
  // Normalize: lowercase, remove diacritics, remove digits and unit tokens
  const norm = name.toLowerCase()
    .normalize('NFD').replace(/[^\w\s]/g,' ')
    .replace(/\d+[\w%]*/g,' ') // numbers and units
    .replace(/\b(kg|g|gr|ml|l|cl|u|pack|km0|eco|ecologic|ecologica|bonpreu|la|el|de|del|km)\b/g,' ')
    .replace(/\s+/g,' ').trim();
  // Keep first 3 tokens as a coarse key
  return norm.split(' ').slice(0,3).join(' ');
}

function dedupItems(items){
  const map = new Map();
  for (const it of items){
    const k = dedupKey(it.name);
    const cur = map.get(k) || { name: it.name, price: 0, category: 'altres' };
    cur.price += it.price;
    if (it.name.length > cur.name.length) cur.name = it.name;
    map.set(k, cur);
  }
  return [...map.values()];
}

function toISO(d){
  const [dd,mm,yy] = d.replace(/[.]/g,'/').replace(/-/g,'/').split('/');
  const yyyy = (yy.length === 2) ? (Number(yy) > 70 ? '19'+yy : '20'+yy) : yy;
  const pad = (n) => String(n).padStart(2,'0');
  return `${yyyy}-${pad(mm)}-${pad(dd)}`;
}

function normalizeKey(name){
  return name.toLowerCase().normalize('NFD').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
}

function guessCategory(name){
  const key = normalizeKey(name);
  for (const [cat, words] of Object.entries(KEYWORDS)){
    if (words.some(w => key.includes(w))) return cat;
  }
  return 'altres';
}

// Fuzzy suggestion using trigram Jaccard over learned names
function fuzzySuggest(name){
  const key = normalizeKey(name);
  const gramsA = trigrams(key);
  let bestScore = 0; let bestCat = 'altres';
  for (const k of Object.keys(productMap)){
    const s = jaccard(gramsA, trigrams(k));
    if (s > bestScore){ bestScore = s; bestCat = productMap[k]; }
  }
  if (bestScore >= 0.35) return { score: bestScore, category: bestCat };
  return null;
}

function trigrams(s){
  const set = new Set();
  const t = ` ${s} `;
  for (let i=0; i<t.length-2; i++) set.add(t.slice(i, i+3));
  return set;
}

function jaccard(a, b){
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

function classifyItems(items){
  for (const it of items){
    const k = normalizeKey(it.name);
    it.category = productMap[k] || guessCategory(it.name);
  }
}

function setCategoryForItem(ticketId, index, category){
  const t = tickets.find(x => x.id === ticketId);
  if (!t) return;
  const it = t.items[index];
  it.category = category;
  const key = normalizeKey(it.name);
  // Aprenentatge
  productMap[key] = category;
  // Propaga la categoria a tots els productes equivalents ja existents
  for (const tk of tickets){
    for (const item of tk.items){
      if (normalizeKey(item.name) === key){
        item.category = category;
      }
    }
  }
  persist();
  renderAll();
}

function persist(){
  saveJSON(LS_KEYS.productMap, productMap);
  saveJSON(LS_KEYS.tickets, tickets);
}

function renderAll(){
  renderAggregate();
  renderTickets();
}

function renderAggregate(){
  const root = byId('aggregateCards');
  root.innerHTML = '';

  if (!tickets.length){
    root.innerHTML = '<div class="card">Encara no hi ha tiquets.</div>';
    return;
  }

  const catEmoji = { 'menjar':'🍎', 'higiene personal':'🧼', 'neteja de la llar':'🧽', 'altres':'🧩' };

  const sorted = [...tickets].sort((a,b)=>{
    if (a.dateISO !== b.dateISO) return b.dateISO.localeCompare(a.dateISO);
    return Number(b.id.split('_')[0]) - Number(a.id.split('_')[0]);
  });
  for (const t of sorted){
    const totals = sumByCategory(t.items);
    const sum = Object.values(totals).reduce((a,b)=>a+b,0);
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <h3>${t.dateISO} · <code>${t.file || 'tiquet'}</code></h3>
      <div class="row"><span><span class="emoji">${catEmoji['menjar']}</span>Menjar</span><span class="sum">${formatEur(totals['menjar'])}</span></div>
      <div class="row"><span><span class="emoji">${catEmoji['higiene personal']}</span>Higiene personal</span><span class="sum">${formatEur(totals['higiene personal'])}</span></div>
      <div class="row"><span><span class="emoji">${catEmoji['neteja de la llar']}</span>Neteja de la llar</span><span class="sum">${formatEur(totals['neteja de la llar'])}</span></div>
      <div class="row"><span><span class="emoji">${catEmoji['altres']}</span>Altres</span><span class="sum">${formatEur(totals['altres'])}</span></div>
      <div class="row" style="border-top:1px dashed var(--border);padding-top:6px"><strong>Total</strong><strong>${formatEur(sum)}</strong></div>
    `;
    root.appendChild(el);
  }
}

function renderTickets(){
  const root = byId('ticketsList');
  root.innerHTML = '';
  const sorted = [...tickets].sort((a,b)=>{
    if (a.dateISO !== b.dateISO) return b.dateISO.localeCompare(a.dateISO);
    return Number(b.id.split('_')[0]) - Number(a.id.split('_')[0]);
  });
  for (const t of sorted){
    const el = document.createElement('div');
    el.className = 'ticket';
    const totals = sumByCategory(t.items);
    const pills = `
      <span class="pill ${CAT_CLASS['menjar']}">Menjar: ${formatEur(totals['menjar'])}</span>
      <span class="pill ${CAT_CLASS['higiene personal']}">Higiene: ${formatEur(totals['higiene personal'])}</span>
      <span class="pill ${CAT_CLASS['neteja de la llar']}">Neteja: ${formatEur(totals['neteja de la llar'])}</span>
      <span class="pill ${CAT_CLASS['altres']}">Altres: ${formatEur(totals['altres'])}</span>
    `;
    el.innerHTML = `
      <div class="ticket-head">
        <div>
          <div><strong>${t.dateISO}</strong> · <code>${t.file || 'tiquet'}</code></div>
          <div class="totals">${pills}</div>
        </div>
        <div><button class="btn btn-secondary" data-del="${t.id}">Esborra</button></div>
      </div>
      <div class="items">
        ${t.items.map((it, idx)=> itemRowHTML(t.id, idx, it)).join('')}
      </div>
    `;
    el.addEventListener('click', (ev)=>{
      const del = ev.target.closest('button[data-del]');
      if (del){
        if (confirm('Esborrar aquest tiquet?')){
          tickets = tickets.filter(x=>x.id!==t.id);
          persist();
          renderAll();
        }
      }
    });
    root.appendChild(el);
  }
}

function itemRowHTML(ticketId, index, it){
  const opts = CATEGORIES.map(c => `<option value="${c}" ${c===it.category?'selected':''}>${c}</option>`).join('');
  return `
    <div class="item">
      <div class="name">${it.name}</div>
      <div>${formatEur(it.price)}</div>
      <div><select data-tid="${ticketId}" data-idx="${index}">${opts}</select></div>
      <div>
        <span class="pill ${CAT_CLASS[it.category]}">${it.category}</span>
      </div>
    </div>
  `;
}

// Delegate select changes
document.addEventListener('change', (e)=>{
  const sel = e.target.closest('select[data-tid]');
  if (!sel) return;
  setCategoryForItem(sel.dataset.tid, Number(sel.dataset.idx), sel.value);
});

// (Suggeriments desactivats)

function sumByCategory(items){
  const totals = { 'menjar':0, 'higiene personal':0, 'neteja de la llar':0, 'altres':0 };
  for (const it of items){ totals[it.category] += it.price; }
  return totals;
}

// Export
function exportCSV(){
  const rows = [['data','fitxer','nom','preu','categoria']];
  for (const t of tickets){
    for (const it of t.items){
      rows.push([t.dateISO, t.file||'', it.name.replace(/"/g,'""'), it.price.toFixed(2), it.category]);
    }
  }
  const csv = rows.map(r=> r.map(v=> /[",\n;]/.test(String(v)) ? '"'+String(v)+'"' : String(v)).join(';')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tickets_bonpreu.csv';
  a.click();
}

// Persistence helpers
function loadJSON(key, def){
  try{ return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); }
  catch{ return def; }
}
function saveJSON(key, val){
  localStorage.setItem(key, JSON.stringify(val));
}
