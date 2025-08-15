const els = {
  pickDir: document.getElementById('pickDir'),
  baseDir: document.getElementById('baseDir'),
  refresh: document.getElementById('refresh'),
  owner: document.getElementById('owner'),
  visibility: document.getElementById('visibility'),
  rows: document.getElementById('rows'),
  syncSelected: document.getElementById('syncSelected'),
  syncAll: document.getElementById('syncAll'),
  checkAll: document.getElementById('checkAll'),
  log: document.getElementById('log'),
  tree: document.getElementById('tree')
};

function log(msg) {
  const ts = new Date().toLocaleString();
  els.log.textContent += `[${ts}] ${msg}\n`;
  els.log.scrollTop = els.log.scrollHeight;
}

// ---- Taula de carpetes ----
function rowHtml(item) {
  const badgeRepo = item.isRepo ? '<span class="badge ok">sí</span>' : '<span class="badge warn">no</span>';
  const badgeRemote = item.hasRemote ? '<span class="badge ok">sí</span>' : '<span class="badge warn">no</span>';
  const badgeChanges = item.hasChanges ? '<span class="badge warn">sí</span>' : '<span class="badge ok">no</span>';
  return `<tr data-name="${item.name}">
    <td><input type="checkbox" class="pick" /></td>
    <td>${item.name}</td>
    <td>${badgeRepo}</td>
    <td>${badgeRemote}</td>
    <td>${badgeChanges}</td>
    <td class="result"></td>
  </tr>`;
}

// ---- Vista d'arbre ----
function renderTreeNode(node) {
  if (node.type === 'file') {
    return `<li class="file">${node.name}</li>`;
  }
  const children = (node.children || []).map(renderTreeNode).join('');
  return `<li class="dir">
    <span class="label toggle">${node.name}</span>
    <ul>${children}</ul>
  </li>`;
}
function attachToggleHandlers() {
  els.tree.querySelectorAll('.dir > .label').forEach(label => {
    label.addEventListener('click', () => {
      const li = label.parentElement;
      li.classList.toggle('collapsed');
    });
  });
}
async function drawTree(baseDir) {
  try {
    const data = await window.api.tree(baseDir);
    if (data?.error) {
      els.tree.innerHTML = `<div class="badge err">${data.error}</div>`;
      return;
    }
    els.tree.innerHTML = `<ul>${renderTreeNode(data)}</ul>`;
    els.tree.querySelectorAll('.dir').forEach((li, idx) => { if (idx > 0) li.classList.add('collapsed'); });
    attachToggleHandlers();
  } catch (e) {
    log(`ERROR tree: ${e?.message || e}`);
  }
}

// ---- Scan & sync ----
async function scan() {
  const baseDir = els.baseDir.value.trim();
  if (!baseDir) { log('⚠️ Indica una carpeta base.'); return; }
  log(`Escanejant: ${baseDir}`);
  try {
    const res = await window.api.scan(baseDir);
    const items = Array.isArray(res) ? res : (res.items || []);
    if (res?.error) log(`ERROR scan: ${res.error}`);
    els.rows.innerHTML = items.map(rowHtml).join('');
    await drawTree(res?.baseDir || baseDir);
  } catch (e) {
    log(`ERROR scan: ${e?.message || e}`);
  }
}

function selectedNames() {
  return [...document.querySelectorAll('#rows tr')]
    .filter(tr => tr.querySelector('input.pick').checked)
    .map(tr => tr.dataset.name);
}

function setResults(results) {
  const map = new Map(results.map(r => [r.name, r]));
  [...document.querySelectorAll('#rows tr')].forEach(tr => {
    const name = tr.dataset.name;
    const cell = tr.querySelector('.result');
    const r = map.get(name);
    if (!r) return;
    if (r.status === 'error') {
      cell.innerHTML = `<span class="badge err">error</span>`;
      log(`❌ ${name}: ${r.error}`);
    } else if (r.status === 'pushed') {
      cell.innerHTML = `<span class="badge ok">pushed</span>`;
      log(`✅ ${name}: pushed`);
    } else {
      cell.innerHTML = `<span class="badge ok">up-to-date</span>`;
      log(`ℹ️ ${name}: up-to-date`);
    }
  });
}

// ---- Events ----
els.pickDir.addEventListener('click', async () => {
  try {
    if (!window.api?.selectBaseDir) throw new Error('API no disponible (preload no carregat)');
    const p = await window.api.selectBaseDir();
    if (p) { els.baseDir.value = p; scan(); }
  } catch (e) {
    log(e?.message || String(e));
    alert(e?.message || String(e));
  }
});
els.refresh.addEventListener('click', scan);
els.checkAll.addEventListener('change', (e) => {
  const on = e.target.checked;
  document.querySelectorAll('#rows .pick').forEach(cb => cb.checked = on);
});
els.syncSelected.addEventListener('click', async () => {
  const names = selectedNames();
  if (names.length === 0) { log('⚠️ Selecciona almenys una carpeta.'); return; }
  const payload = {
    baseDir: els.baseDir.value.trim(),
    names,
    options: { owner: els.owner.value.trim(), visibility: els.visibility.value }
  };
  log(`Sincronitzant ${names.length} carpeta(es)...`);
  const res = await window.api.sync(payload);
  setResults(res);
});
els.syncAll.addEventListener('click', async () => {
  const names = [...document.querySelectorAll('#rows tr')].map(tr => tr.dataset.name);
  if (names.length === 0) { log('⚠️ No hi ha carpetes.'); return; }
  const payload = {
    baseDir: els.baseDir.value.trim(),
    names,
    options: { owner: els.owner.value.trim(), visibility: els.visibility.value }
  };
  log(`Sincronitzant TOTES les ${names.length} carpetes...`);
  const res = await window.api.sync(payload);
  setResults(res);
});

// Ajuda de diagnòstic (temporal)
console.log('window.api is', typeof window.api);

// Inicialització amb un valor editable
(function initDefaultPath() {
  els.baseDir.value = 'I\\Mi unidad\\Github';
})();
