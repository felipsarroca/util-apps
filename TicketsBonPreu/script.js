// Utilities
const formatEur = (n) => new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const byId = (id) => document.getElementById(id);

// Persistence keys
const LS_KEYS = {
  productMap: 'bp_product_category_map_v1',
  tickets: 'bp_tickets_v1'
};

// Categories and colors
const CATEGORIES = ['menjar', 'neteja de la llar', 'higiene personal', 'altres'];
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
let activeTicketId = loadJSON('bp_active_ticket', null);
let processing = false;
let workerPromise;
let workerMode;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Init UI
window.addEventListener('DOMContentLoaded', () => {
  const dz = byId('dropzone');
  const fi = byId('fileInput');
  const clearBtn = byId('clearDataBtn');
  const exportBtn = byId('exportCsvBtn');

  ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('focus'); }));
  ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('focus'); }));
  dz.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
  dz.addEventListener('click', (e) => { if (e.target !== fi) { fi.value=''; fi.click(); } });
  dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
  fi.addEventListener('change', () => handleFiles(fi.files));

  clearBtn.addEventListener('click', () => {
    if (!confirm('Esborrar tots els tiquets? Es conservaran les categories que has ensenyat a l’app.')) return;
    tickets = [];
    persist();
    renderAll();
  });

  exportBtn.addEventListener('click', () => exportCSV());

  for (const ticket of tickets) classifyItems(ticket.items);
  renderAll();
});

function handleFiles(fileList){
  if (processing) return;
  const files = Array.from(fileList || []).filter(f => /\.(jpe?g|png|webp)$/i.test(f.name));
  if (!files.length) return;
  processFilesSequentially(files);
}

async function processFilesSequentially(files){
  processing = true;
  byId('fileInput').disabled = true;
  byId('clearDataBtn').disabled = true;
  const errors = [];
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
      if (!ticket.items.length) throw new Error('No s’han pogut llegir els articles.');
      classifyItems(ticket.items);
      tickets.push(ticket);
      activeTicketId = ticket.id;
      persist();
      renderAll();
      stopOcrProgressTimer(true);
    }catch(err){
      console.error(err);
      errors.push(files[i].name);
      stopOcrProgressTimer(false);
      progress.textContent = `Error amb ${files[i].name}: ${err?.message || err}`;
    }
  }
  processing = false;
  byId('fileInput').disabled = false;
  byId('clearDataBtn').disabled = false;
  progress.textContent = errors.length ? `No s’ha pogut llegir: ${errors.join(', ')}. Torna-ho a provar.` : 'Fet!';
  if (!errors.length) setTimeout(()=>{ if (!processing) progress.classList.add('hidden'); }, 1200);
}

async function ocrImage(file){
  const prepped = await preprocessImage(file);
  if (!window.Tesseract) throw new Error("Tesseract no s’ha carregat.");
  try {
    const mode = prepped.dataset.digital === 'true' ? 'digital' : 'photo';
    if (workerPromise && mode !== workerMode) {
      await (await workerPromise).terminate();
      workerPromise = null;
    }
    if (!workerPromise) {
      workerMode = mode;
      // The legacy recognizer reads small monospaced digital prices more accurately.
      workerPromise = mode === 'digital'
        ? Tesseract.createWorker('eng', 0, { legacyCore: true, legacyLang: true })
        : Tesseract.createWorker('cat+spa+eng');
    }
    const worker = await workerPromise;
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    const { data } = await worker.recognize(prepped);
    if (!data.text.trim()) throw new Error('No s’ha trobat text.');
    return data.text;
  } catch (error) {
    if (workerPromise) {
      try { await (await workerPromise).terminate(); } catch (_) { /* Failed initialization */ }
    }
    workerPromise = null;
    throw error;
  }
}

// Helpers de progrés OCR
function setProgressLabel(text){
  const el = byId('progress');
  if (!el) return;
  el.classList.remove('hidden');
  const hasBar = !!el.querySelector('.progressbar');
  if (!hasBar){
    el.innerHTML = `<div class="label">${escapeHTML(text)}</div><div class="progressbar"><div class="bar" style="width:0%"></div></div>`;
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
    el.innerHTML = `<div class="label">${escapeHTML(label)}</div><div class="progressbar"><div class="bar" style="width:${pct}%"></div></div>`;
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

// Crop white margins and keep lossless pixels for small digital receipt text.
async function preprocessImage(file){
  const img = await fileToImage(file);
  const source = document.createElement('canvas');
  source.width = img.width; source.height = img.height;
  const ctx = source.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, source.width, source.height);
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, source.width, source.height);
  let left = source.width, right = -1, top = source.height, bottom = -1;
  let whitePixels = 0;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * 4;
      if (data[i] > 245 && data[i+1] > 245 && data[i+2] > 245) whitePixels++;
      if (data[i] + data[i+1] + data[i+2] < 540) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left) throw new Error('La imatge és buida.');
  const width = right-left+1, height = bottom-top+1;
  const digital = img.width <= 1000 && img.height/img.width > 2 && whitePixels/(img.width*img.height) > 0.7;
  const scale = digital ? 3 : Math.min(4, Math.max(1, 1200/width));
  const canvas = document.createElement('canvas');
  canvas.dataset.digital = String(digital);
  canvas.width = Math.round(width*scale)+40;
  canvas.height = Math.round(height*scale)+40;
  const out = canvas.getContext('2d');
  out.fillStyle = '#fff'; out.fillRect(0, 0, canvas.width, canvas.height);
  out.imageSmoothingEnabled = true; out.imageSmoothingQuality = digital ? 'low' : 'high';
  out.drawImage(source, left, top, width, height, 20, 20, canvas.width-40, canvas.height-40);
  return canvas;
}
function fileToImage(file){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imatge no vàlida.')); };
    img.src = url;
  });
}

function parseTicket(text, filename){
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  // Date (dd/mm/yyyy or dd-mm-yyyy)
  const dateMatch = text.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/);
  const dateISO = dateMatch ? toISO(dateMatch[1]) : new Date().toISOString().slice(0,10);

  const items = [];
  for (const raw of lines){
    if (/^desglossament\b/i.test(raw)) break;
    if (/^(?:total|iva|c[oò]pia|pagament|compte|descomptes|subtotal)\b/i.test(raw)) continue;
    const m = raw.match(/(.+?)\s+(-?\d+[\.,-]\s*\d{1,2})\s*€?$/);
    if (!m) continue;
    const name = cleanName(m[1]);
    const price = parseFloat(m[2].replace(/\s/g, '').replace(/(\d)[,-](?=\d)/, '$1.'));
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

function dedupKey(name){ return normalizeKey(name); }

function dedupItems(items){
  const map = new Map();
  for (const it of items){
    const k = dedupKey(it.name);
    const cur = map.get(k) || { name: it.name, price: 0, category: 'altres', quantity: 0 };
    cur.price = Math.round((cur.price + it.price)*100)/100;
    cur.quantity += 1;
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

function containsPhrase(key, phrase){
  return (` ${key} `).includes(` ${normalizeKey(phrase)} `);
}
function keywordMatch(key,word){
  if (containsPhrase(key,word)) return true;
  return word.length >= 6 && !word.includes(' ') && key.split(' ').some(token => token.length >= 6 && oneCharacterApart(token,word));
}
function guessCategory(name){
  const key = normalizeKey(name);
  if (/\bdent[i1l]f[a-z0-9]*\b/.test(key)) return 'higiene personal';
  const hygiene = ['dentifrica','dentifric','dental','pasta dents','oxigenada','higienic','paper higienic','paper de vater','gel dutxa','gel de bany','gel mans','sabo mans','sabo corporal','mocadors'];
  const cleaning = ['netejador','netejadora','wc','escombraries','sabo roba','sabo plats','paper de cuina','paper cuina'];
  if (cleaning.some(w => keywordMatch(key,w))) return 'neteja de la llar';
  if (hygiene.some(w => keywordMatch(key,w))) return 'higiene personal';
  for (const cat of ['neteja de la llar','higiene personal','menjar']) {
    if (KEYWORDS[cat].filter(w => w !== 'gel').some(w => keywordMatch(key,w))) return cat;
  }
  const foods = ['quefir','kefir','gyoza','xiao long bao','canelons','carbasso','carbassa','ceba','cebes','peskitos','pessic','edam','gouda','guacamole','refresc','mousse','llimona','llimones','gelat','gelats','cornetto','xocolata','pastanagues','sobaos','llom','llonganissa','gulins','raviolis','rotllets','croquetes','beguda','espin','espinacs','pit','varetes','nous','espaguetis','lluc','banana','bananes','brots','ruca','all','gublins','gulins','pebrot','panet','pilotilles','mandonguilles','burger','hamburguesa','pastanagues','curat','rain blanc','rain vermell','pastis','cirerol'];
  if (foods.some(w => containsPhrase(key,w))) return 'menjar';
  // One OCR character may vary in a long word (mocadors/hocadors, tomàquet/toméquet).
  const tokens = key.split(' ').filter(w => w.length >= 6);
  const matches = new Set();
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    for (const word of [...words, ...(cat === 'menjar' ? foods : [])]) {
      if (word.length < 6 || word.includes(' ')) continue;
      if (tokens.some(token => oneCharacterApart(token, word))) matches.add(cat);
    }
  }
  return matches.size === 1 ? [...matches][0] : 'altres';
}
function oneCharacterApart(a,b){
  if (Math.abs(a.length-b.length)>1) return false;
  if (a.length>b.length) return oneCharacterApart(b,a);
  let i=0, j=0, differences=0;
  while (i<a.length && j<b.length) {
    if (a[i]===b[j]) { i++; j++; }
    else { if (++differences>1) return false; if (a.length===b.length) i++; j++; }
  }
  return differences + (b.length-j) <= 1;
}
// Conservative matching: explicit corrections win, ambiguous variants stay separate.
function fuzzySuggest(name){
  const key = normalizeKey(name);
  if (key.length < 10) return null;
  const scores = new Map();
  for (const [learned,category] of Object.entries(productMap)) {
    if (!CATEGORIES.includes(category)) continue;
    const other = normalizeKey(learned);
    if (Math.min(key.length,other.length)/Math.max(key.length,other.length) < 0.8) continue;
    const score = jaccard(trigrams(key),trigrams(other));
    scores.set(category,Math.max(scores.get(category)||0,score));
  }
  const ranked = [...scores].sort((a,b)=>b[1]-a[1]);
  if (!ranked.length || ranked[0][1] < 0.78) return null;
  if (ranked[1] && ranked[0][1]-ranked[1][1] < 0.12) return null;
  return {category:ranked[0][0],score:ranked[0][1]};
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
    it.category = productMap[k] || fuzzySuggest(it.name)?.category || guessCategory(it.name);
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
  for (const tk of tickets) classifyItems(tk.items);
  persist();
  renderAggregate(); renderHistory();
  document.querySelectorAll('select[data-tid]').forEach(select => {
    const ticket = tickets.find(t => t.id === select.dataset.tid);
    select.value = ticket.items[Number(select.dataset.idx)].category;
  });
}

function persist(){
  saveJSON('bp_active_ticket', activeTicketId);
  saveJSON(LS_KEYS.productMap, productMap);
  saveJSON(LS_KEYS.tickets, tickets);
}

function sortedTickets(){
  return [...tickets].sort((a,b)=>b.dateISO.localeCompare(a.dateISO)||Number(b.id.split('_')[0])-Number(a.id.split('_')[0]));
}
function activeTicket(){ return tickets.find(t=>t.id===activeTicketId); }
function renderAll(){
  if (!activeTicket()) activeTicketId = sortedTickets()[0]?.id || null;
  saveJSON('bp_active_ticket',activeTicketId);
  renderAggregate(); renderTickets(); renderHistory();
}
function renderAggregate(){
  const root = byId('aggregateCards');
  const t = activeTicket();
  if (!t) { root.innerHTML = '<div class="card">Afegeix un tiquet per començar.</div>'; return; }
  const totals = sumByCategory(t.items);
  const emoji = {'menjar':'🍎','neteja de la llar':'🧽','higiene personal':'🧼','altres':'🧩'};
  root.innerHTML = `<div class="card">${CATEGORIES.map(cat=>`<div class="row"><span>${emoji[cat]} ${cat[0].toUpperCase()+cat.slice(1)}</span><strong class="sum">${formatEur(totals[cat])}</strong></div>`).join('')}<div class="row total-row"><strong>Total</strong><strong>${formatEur(Object.values(totals).reduce((a,b)=>a+b,0))}</strong></div></div>`;
}
function renderTickets(){
  const root = byId('ticketsList');
  const t = activeTicket();
  if (!t) { root.innerHTML = ''; return; }
  root.innerHTML = `<div class="ticket"><div class="ticket-head"><div><strong>${escapeHTML(t.dateISO)}</strong><div class="filename">${escapeHTML(t.file||'tiquet')}</div></div><button class="btn btn-secondary" id="deleteTicket">Esborra</button></div><div class="items">${t.items.map((it,i)=>itemRowHTML(t.id,i,it)).join('')}</div></div>`;
  byId('deleteTicket').onclick = () => {
    if (!confirm('Esborrar aquest tiquet?')) return;
    tickets = tickets.filter(x=>x.id!==t.id);
    persist(); renderAll();
  };
}
function renderHistory(){
  const root = byId('historyList');
  const previous = sortedTickets().filter(t=>t.id!==activeTicketId);
  byId('historyLabel').textContent = `Altres tiquets (${previous.length})`;
  root.innerHTML = previous.length ? previous.map(t=>`<button class="history-row" data-open="${escapeHTML(t.id)}"><span>${escapeHTML(t.dateISO)}</span><span class="filename">${escapeHTML(t.file||'tiquet')}</span><strong>${formatEur(t.items.reduce((sum,it)=>sum+it.price,0))}</strong></button>`).join('') : '<p>No hi ha altres tiquets.</p>';
  root.querySelectorAll('[data-open]').forEach(button=>{
    button.onclick = () => {
      activeTicketId = button.dataset.open;
      byId('history').open = false;
      renderAll();
      byId('workspace').scrollIntoView({behavior:'smooth',block:'start'});
    };
  });
}
function itemRowHTML(ticketId,index,it){
  const opts = CATEGORIES.map(c=>`<option value="${c}" ${c===it.category?'selected':''}>${c}</option>`).join('');
  return `<div class="item"><div class="name">${escapeHTML(it.name)}${it.quantity>1?` <small>×${it.quantity}</small>`:''}</div><div class="price">${formatEur(it.price)}</div><select aria-label="Categoria de ${escapeHTML(it.name)}" data-tid="${escapeHTML(ticketId)}" data-idx="${index}">${opts}</select></div>`;
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
