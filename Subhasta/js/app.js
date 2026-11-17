/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Controlador principal d'interfície, adaptació de pantalla, gràfic de preus i accessibilitat de Subhasta */

import { LIMITS, STORAGE_KEYS } from './config.js?v=1.3.0';
import { TEXTOS, ICONES, EXEMPLE_MERCAT_INDUSTRIAL, MODELS, fmtNum, renderIconaSvg } from './textos.js?v=1.3.0';
import {
  netejaText,
  validaConfiguracio,
  calculaMinimOferta,
  calculaOpcionsOferta,
  calculaPuntuacioParticipant,
  generaCsvParticipants,
  generaCsvAdjudicacions
} from './domini.js?v=1.3.0';
import {
  GestorSubhasta,
  normalitzaCodiSala,
  formatCodiSala,
  esCodiSalaComplet,
  getCorreuOrganitzador,
  preparaIdentitat
} from './emmagatzematge.js?v=1.3.0';
import { renderQrSvg } from './qr.js?v=1.3.0';
import { soMartell } from './audio.js?v=1.3.0';

const gestor = new GestorSubhasta();

const estatUI = {
  vistaActual: 'inici', // 'inici' | 'llista' | 'preparacio' | 'espera' | 'comandament' | 'projeccio' | 'terminal' | 'resultats'
  rolActual: null,      // 'organitzador' | 'projeccio' | 'terminal'
  sessioId: null,
  dades: null,          // vista formatada des de GestorSubhasta
  esborranyPrep: null,
  desantTimer: null,
  modePresentacio: false,
  mostrarParticipantsPresentacio: false,
  selectorImport: null,
  selectorObjecteKey: null,
  contextOfertaFixat: null,
  enviantOferta: false,
  missatgeTerminalFix: null,
  darrerEventAdjudicatMs: 0,
  darrerImportProjeccio: null,
  wakeLock: null,
  modeModels: 'crear',   // 'crear' | 'substituir'
  configsDesades: [],
  creantSessio: false,
  unitatsAmbOfertaMeva: new Set()
};

const $ = (id) => document.getElementById(id);

/* Icones de línia per a accions petites (en lloc de glifs o emojis) */
const SVG_OBERT = '<svg class="ic ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const IC = {
  editar: `${SVG_OBERT}<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  treure: `${SVG_OBERT}<path d="M18 6 6 18M6 6l12 12"/></svg>`,
  aparell: `${SVG_OBERT}<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
  martell: `${SVG_OBERT}<path d="M14 4l6 6-8 8-6-6 8-8z"/><path d="M4 20h16"/></svg>`,
  check: `${SVG_OBERT}<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.5 9.5"/></svg>`,
  rellotge: `${SVG_OBERT}<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  persones: `${SVG_OBERT}<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  bossa: `${SVG_OBERT}<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  tancat: `${SVG_OBERT}<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  avis: `${SVG_OBERT}<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>`,
  pausa: `${SVG_OBERT}<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/></svg>`,
  amunt: `${SVG_OBERT}<path d="M12 19V5M5 12l7-7 7 7"/></svg>`,
  ma: `${SVG_OBERT}<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`,
  senseXarxa: `${SVG_OBERT}<path d="M1 1l22 22"/><path d="M16.7 11.1A11 11 0 0 1 19 12.6M5 12.6a11 11 0 0 1 5.2-2.4M10.7 5.1A16 16 0 0 1 22.6 9M1.4 9a16 16 0 0 1 4.7-2.9M8.5 16.1a6 6 0 0 1 7 0M12 20h.01"/></svg>`
};

/* Text «Després: …» amb la unitat concreta que es proposa obrir */
function textSeguent(objectes, tauler) {
  const objSeg = objectes.find((o) => o.id === tauler.seguentObjecteId);
  if (!objSeg) return '';
  const venudes = Number(tauler.cataleg?.[objSeg.id]?.venudes ?? 0);
  const enJoc = tauler.licitacio?.objecteId === objSeg.id ? 1 : 0;
  const unitat = venudes + 1 + enJoc;
  return unitat <= Number(objSeg.quantitat)
    ? `Després: ${objSeg.nom} · unitat ${unitat}`
    : `Després: ${objSeg.nom}`;
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   1. Adaptació a la pantalla (mecanisme d'edu-apps/Equacions §9)
   Disseny base 1440x800, escala uniforme fins al 75 % en portàtils (1366x768)
   i creixement cap amunt a la projecció (1920x1080)
   ============================================================ */
const BASE_W = 1440;
const BASE_H = 800;
const MIN_ZOOM = 0.75;
const MIN_DESKTOP_W = 1200;

function ajustaEscalaPantalla() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  let z = 1;

  if (w >= MIN_DESKTOP_W) {
    const rati = Math.min(w / BASE_W, h / BASE_H);
    if (estatUI.vistaActual === 'projeccio') {
      // La projecció també creix cap amunt perquè es llegeixi des del fons de l'aula (§9)
      z = Math.min(1.35, Math.max(MIN_ZOOM, Math.floor(rati * 20) / 20));
    } else {
      z = Math.min(1, Math.max(MIN_ZOOM, Math.floor(rati * 20) / 20));
    }
  }

  document.documentElement.style.setProperty('--ui-zoom', String(z));
}

/* ============================================================
   2. Pantalla sempre encesa (Screen Wake Lock API §9)
   ============================================================ */
async function actualitzaWakeLock() {
  const calMantenirEncesa =
    estatUI.vistaActual === 'projeccio' ||
    estatUI.vistaActual === 'terminal' ||
    estatUI.vistaActual === 'comandament' ||
    estatUI.vistaActual === 'espera';

  if (!calMantenirEncesa) {
    if (estatUI.wakeLock) {
      try {
        await estatUI.wakeLock.release();
      } catch (_) {}
      estatUI.wakeLock = null;
    }
    return;
  }

  if ('wakeLock' in navigator && !estatUI.wakeLock && document.visibilityState === 'visible') {
    try {
      estatUI.wakeLock = await navigator.wakeLock.request('screen');
      estatUI.wakeLock.addEventListener('release', () => {
        estatUI.wakeLock = null;
      });
    } catch (_) {}
  }
}

/* ============================================================
   3. Tema visual (Mercat, Llotja clara, Sala fosca §9)
   ============================================================ */
function aplicaTema(tema) {
  const valid = ['mercat', 'llotja', 'fosca'].includes(tema) ? tema : 'mercat';
  document.documentElement.setAttribute('data-theme', valid);
  try {
    localStorage.setItem(STORAGE_KEYS.TEMA, valid);
  } catch (_) {}
  document.querySelectorAll('.btn-tema').forEach((btn) => {
    btn.classList.toggle('actiu', btn.dataset.tema === valid);
  });
}

/* ============================================================
   4. Navegació entre vistes
   ============================================================ */
function mostraVista(nomVista) {
  estatUI.vistaActual = nomVista;
  const vistes = [
    'inici',
    'llista',
    'preparacio',
    'espera',
    'comandament',
    'projeccio',
    'terminal',
    'resultats'
  ];
  for (const v of vistes) {
    const el = $(`vista-${v}`);
    if (el) el.hidden = v !== nomVista;
  }

  const enSessio = !['inici', 'llista'].includes(nomVista) && Boolean(estatUI.dades?.sessio);
  const esVistaOrg = enSessio && estatUI.rolActual === 'organitzador';
  document.body.dataset.vista = nomVista;
  $('btn-copia-codi-top').hidden = !esVistaOrg;
  $('insignia-sala').hidden = !enSessio;
  $('btn-sortir').hidden = nomVista === 'inici';
  $('nav-espais').hidden = !esVistaOrg;
  $('btn-so-martell').hidden = nomVista !== 'projeccio';

  if (enSessio && estatUI.dades?.sessio) {
    $('insignia-codi').textContent = formatCodiSala(estatUI.dades.sessio.codi);
    $('btn-nav-comandament').hidden = !estatUI.dades.esOrganitzador;
    $('btn-nav-comandament').classList.toggle(
      'actiu',
      nomVista === 'comandament' || nomVista === 'espera' || nomVista === 'preparacio'
    );
    $('btn-nav-projeccio').classList.toggle('actiu', nomVista === 'projeccio');
  }

  actualitzaPassosOrg();
  ajustaEscalaPantalla();
  actualitzaWakeLock();
}

/* ============================================================
   4b. Passos guiats de l'organitzador (v1.3)
   ============================================================ */
const ORDRE_PASSOS = ['preparacio', 'espera', 'comandament', 'resultats'];
const AJUDA_PASSOS = {
  preparacio: 'revisa els objectes, quantes unitats en vols vendre i el preu de sortida. Tot es desa sol.',
  espera: 'projecta el codi perquè els equips entrin. Quan hi siguin tots, prem «Comença la subhasta».',
  comandament: 'obre una unitat, deixa que facin ofertes, atura-les i adjudica-la.',
  resultats: 'comenteu el gràfic de preus i les preguntes. Pots descarregar els CSV o fer una ronda nova.'
};

function actualitzaPassosOrg(textAra = null) {
  const nav = $('passos-org');
  if (!nav) return;
  const vista = estatUI.vistaActual;
  const idx = ORDRE_PASSOS.indexOf(vista);
  const visible = idx >= 0 && estatUI.rolActual === 'organitzador' && Boolean(estatUI.dades?.esOrganitzador);
  nav.hidden = !visible;
  document.body.classList.toggle('amb-passos', visible);
  if (!visible) return;
  nav.querySelectorAll('li[data-pas]').forEach((li) => {
    const i = ORDRE_PASSOS.indexOf(li.dataset.pas);
    li.classList.toggle('fet', i < idx);
    li.classList.toggle('actual', i === idx);
    if (i === idx) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
  });
  if (textAra && vista === 'comandament') estatUI.ajudaComandament = textAra;
  const text = textAra || (vista === 'comandament' && estatUI.ajudaComandament) || AJUDA_PASSOS[vista] || '';
  $('passos-org-ara').innerHTML = `<strong>Ara:</strong> ${escHtml(text)}`;
}

/* ============================================================
   5. Reducció d'imatges opcionals al navegador (<= 60 kB WebP/JPEG §2)
   ============================================================ */
function redueixImatgeAlNavegador(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Selecciona un fitxer d’imatge vàlid.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No s’ha pogut llegir la imatge.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format d’imatge no compatible.'));
      img.onload = () => {
        const maxCostat = 192;
        const escala = Math.min(1, maxCostat / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * escala));
        const h = Math.max(1, Math.round(img.height * escala));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        let qualitat = 0.82;
        let dataUrl = canvas.toDataURL('image/webp', qualitat);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', qualitat);
        }
        while (dataUrl.length > LIMITS.MAX_IMATGE_KB * 1330 && qualitat > 0.35) {
          qualitat -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', qualitat);
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// «de» o «d’» segons la paraula següent (d’Anna, d’Equip Roure, de Marc)
function deNom(nom) {
  return /^(h?[aeiouàèéíòóúAEIOUÀÈÉÍÒÓÚ]|H[aeiouàèéíòóú])/.test(String(nom || '')) ? `d’${nom}` : `de ${nom}`;
}

/* ============================================================
   6. Vista 1: Portada i Vista 2: Les meves subhastes
   ============================================================ */
async function actualitzaPortada() {
  const correu = getCorreuOrganitzador();
  $('estat-compte-org').textContent = correu
    ? `Subhastes vinculades a ${correu}`
    : 'Les teves subhastes es desen en aquest navegador';
  $('btn-identifica-google').textContent = correu ? 'Desvincula' : 'Vincula-les a Google';
  $('btn-identifica-google').title = correu
    ? 'Aquest navegador deixa d’estar vinculat. Les subhastes continuen al teu compte de Google.'
    : 'Opcional: per obrir les teves subhastes des d’un altre ordinador amb el teu compte de Google';

  const sessions = await gestor.llistaLesMevesSubhastes();
  $('comptador-meves-subhastes').textContent = String(sessions.length);

  const sessioRec = sessions[0];
  if (sessioRec) {
    $('barra-reprendre').hidden = false;
    $('reprendre-titol').textContent = sessioRec.titol;
    $('reprendre-codi').textContent = `· Codi ${formatCodiSala(sessioRec.codi)}`;
    $('btn-reprendre-ara').onclick = () => obreSessioComOrganitzador(sessioRec.id);
  } else {
    $('barra-reprendre').hidden = true;
  }
}

async function renderLlistaMevesSubhastes() {
  const sessions = await gestor.llistaLesMevesSubhastes();
  const cont = $('contenedor-llista-sessions');
  if (!sessions.length) {
    cont.innerHTML = `
      <div class="panell">
        <p>Encara no tens cap subhasta desada. Prem <strong>«+ Nova subhasta»</strong> per preparar-ne una amb l’exemple carregable «Mercat industrial».</p>
      </div>
    `;
    return;
  }

  const etiquetesEstat = {
    preparacio: 'En preparació',
    espera: 'Sala d’espera',
    en_curs: 'En curs',
    finalitzada: 'Finalitzada'
  };

  cont.innerHTML = sessions
    .map((s) => {
      const dataStr = new Date(s.actualitzatMs || s.creatMs).toLocaleDateString('ca-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      return `
        <article class="targeta-sessio-item">
          <div>
            <div class="targeta-sessio-cap">
              <h3>${escHtml(s.titol)}</h3>
              <span class="etiqueta-estat">${escHtml(etiquetesEstat[s.estat] || s.estat)}</span>
            </div>
            <div class="targeta-sessio-meta tabular" style="margin-top:0.35rem;">
              <span>Codi: <strong>${formatCodiSala(s.codi)}</strong></span>
              <span>· Ronda ${s.ronda || 1}</span>
              <span>· ${s.numParticipants || 0} participants</span>
              <span>· ${dataStr}</span>
            </div>
          </div>
          <div class="targeta-sessio-accions">
            <button type="button" class="btn btn-primari btn-sm" data-accio-llista="obrir" data-id="${s.id}">Obre</button>
            <button type="button" class="btn btn-secundari btn-sm" data-accio-llista="projeccio" data-id="${s.id}">Projecció</button>
            <button type="button" class="btn btn-suau btn-sm" data-accio-llista="duplicar" data-id="${s.id}">Duplica</button>
            <button type="button" class="btn btn-suau btn-sm" data-accio-llista="csv" data-id="${s.id}">CSV</button>
            <button type="button" class="btn btn-perill-suau btn-sm" data-accio-llista="eliminar" data-id="${s.id}">Elimina</button>
          </div>
        </article>
      `;
    })
    .join('');
}

/* ============================================================
   6b. Models d'activitat i configuracions desades (v1.3)
   ============================================================ */
function copiaConfig(cfg) {
  return JSON.parse(JSON.stringify(cfg));
}

function totalUnitatsCfg(cfg) {
  return (cfg.objectes || []).reduce((a, o) => a + (Number(o.quantitat) || 0), 0);
}

// Durada orientativa: aproximadament minut i mig per unitat, arrodonit a 5 minuts
function minutsEstimats(unitats) {
  return Math.max(5, Math.round((unitats * 1.5) / 5) * 5);
}

function resumCfg(cfg) {
  const unitats = totalUnitatsCfg(cfg);
  const n = (cfg.objectes || []).length;
  return `${n} ${n === 1 ? 'objecte' : 'objectes'} · ${unitats} ${unitats === 1 ? 'unitat' : 'unitats'} · ${fmtNum(cfg.pressupost)} ${escHtml(cfg.moneda || 'monedes')}`;
}

function iconesCfg(cfg) {
  return (cfg.objectes || [])
    .slice(0, 6)
    .map((o) => `<span class="model-ic-obj" title="${escHtml(o.nom)}">${renderIconaSvg(o.icona, o.imatgeDataUrl)}</span>`)
    .join('');
}

function dataCurta(ms) {
  return new Date(ms).toLocaleDateString('ca-ES', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function renderModalModels() {
  $('graella-models').innerHTML = MODELS.map(
    (m) => `
      <button type="button" class="targeta-model" data-model="${m.id}">
        <span class="targeta-model-cap">
          <span class="targeta-model-ic">${renderIconaSvg(m.icona)}</span>
          <span class="targeta-model-noms">
            <strong>${escHtml(m.nom)}</strong>
            <span class="targeta-model-materia">${escHtml(m.materia)}</span>
          </span>
        </span>
        <span class="targeta-model-text">${escHtml(m.consisteix)}</span>
        <span class="targeta-model-treballa"><b>Treballa:</b> ${escHtml(m.treballa)}</span>
        <span class="targeta-model-peu">
          <span class="targeta-model-icones">${iconesCfg(m.config)}</span>
          <span class="tabular">${resumCfg(m.config)} · uns ${minutsEstimats(totalUnitatsCfg(m.config))} min</span>
        </span>
      </button>`
  ).join('');

  const configs = estatUI.configsDesades;
  $('bloc-configs-desades').hidden = !configs.length;
  $('llista-configs-desades').innerHTML = configs
    .map(
      (c) => `
      <div class="targeta-config">
        <button type="button" class="targeta-config-obre" data-config="${escHtml(c.id)}">
          <span class="targeta-model-icones">${iconesCfg(c.cfg)}</span>
          <strong>${escHtml(c.nom)}</strong>
          <span class="subtext tabular">${resumCfg(c.cfg)}</span>
          <span class="subtext">Es conserva fins al ${dataCurta(c.expiraMs)}</span>
          <span class="targeta-config-usa">Fes-la servir →</span>
        </button>
        <button type="button" class="btn-xip btn-xip-perill" data-elimina-config="${escHtml(c.id)}" title="Elimina aquesta configuració" aria-label="Elimina la configuració ${escHtml(c.nom)}">${IC.treure}</button>
      </div>`
    )
    .join('');
}

async function obreModalModels(mode = 'crear') {
  estatUI.modeModels = mode;
  $('titol-modal-models').textContent = mode === 'crear' ? 'Com vols començar?' : 'Canvia de model';
  $('subtitol-modal-models').textContent =
    mode === 'crear'
      ? 'Tria un model ja preparat o una configuració teva. Després podràs canviar-ne tots els detalls.'
      : 'El model que triïs substituirà el títol, el repte i el catàleg d’aquesta subhasta.';
  estatUI.configsDesades = [];
  renderModalModels();
  $('modal-models').showModal();
  try {
    estatUI.configsDesades = await gestor.llistaConfiguracions();
    if ($('modal-models').open) renderModalModels();
  } catch (_) {}
}

async function aplicaConfigEscollida(cfg, idConfig = null) {
  if (estatUI.creantSessio) return;
  const config = copiaConfig(cfg);
  if (idConfig) gestor.renovaConfiguracio(idConfig);

  if (estatUI.modeModels === 'substituir' && estatUI.esborranyPrep) {
    estatUI.esborranyPrep = {
      titol: config.titol,
      repte: config.repte ?? '',
      pressupost: config.pressupost,
      moneda: config.moneda || 'monedes',
      increment: config.increment,
      puntuacioActiva: Boolean(config.puntuacioActiva),
      bonificacioConjunt: Number(config.bonificacioConjunt ?? 0),
      objectes: config.objectes
    };
    $('modal-models').close();
    pintaFormulariPreparacio();
    validaIDesaPreparacio(true);
    return;
  }

  estatUI.creantSessio = true;
  $('modal-models').classList.add('ocupat');
  try {
    const sessio = await gestor.creaSubhasta(config, 'preparacio');
    $('modal-models').close();
    await obreSessioComOrganitzador(sessio.id, 'preparacio');
  } finally {
    estatUI.creantSessio = false;
    $('modal-models').classList.remove('ocupat');
  }
}

function obreDesaConfiguracio() {
  llegeixEsborranyDelDom();
  const esb = estatUI.esborranyPrep;
  if (!esb) return;
  const val = validaConfiguracio(esb);
  if (!val.valid) {
    obreModalAccio({
      titol: 'Desa la configuració',
      htmlCos: '<p>Abans de desar-la, corregeix els camps marcats en vermell.</p>',
      textConfirmar: 'D’acord',
      onConfirm: () => {}
    });
    return;
  }
  let error = null;
  let resultat = null;
  obreModalAccio({
    titol: 'Desa la configuració',
    htmlCos: `
      <div class="camp-grup">
        <label for="input-nom-config">Nom de la configuració</label>
        <input id="input-nom-config" type="text" maxlength="${LIMITS.MAX_NOM_CONFIGURACIO}" value="${escHtml(esb.titol)}">
      </div>
      <p class="subtext">Es desen el títol, el repte, els diners i tot el catàleg. La trobaràs a «Crea una subhasta nova» per fer-la servir amb altres grups. Es conserva un any des de l’últim cop que la facis servir; després s’esborra sola. Si ja en tens una amb el mateix nom, s’actualitza.</p>`,
    textConfirmar: 'Desa',
    onConfirm: async () => {
      try {
        resultat = await gestor.desaConfiguracio($('input-nom-config').value, esb);
      } catch (err) {
        error = err.message || 'No s’ha pogut desar la configuració.';
      }
      setTimeout(() => {
        if (error) {
          obreModalAccio({ titol: 'Desa la configuració', htmlCos: `<p>${escHtml(error)}</p>`, textConfirmar: 'D’acord', onConfirm: () => {} });
          return;
        }
        const ind = $('indicador-desament');
        ind.textContent = `Configuració «${resultat.nom}» desada ✓`;
        ind.title = `Es conserva fins al ${dataCurta(resultat.expiraMs)}`;
        ind.style.background = 'var(--ok-soft)';
        ind.style.color = 'var(--ok)';
        if (resultat.senseFotos) {
          obreModalAccio({
            titol: 'Configuració desada',
            htmlCos: '<p>S’ha desat sense les fotos dels objectes, perquè ocupaven massa. Les icones sí que s’hi han desat.</p>',
            textConfirmar: 'D’acord',
            onConfirm: () => {}
          });
        }
      }, 0);
    }
  });
  setTimeout(() => {
    const inp = $('input-nom-config');
    if (inp) {
      inp.focus();
      inp.select();
    }
  }, 50);
}

/* Equips previstos i recomanació d'unitats */
function equipsPrevistos() {
  const v = Math.round(Number($('prep-equips')?.value));
  return Number.isFinite(v) ? Math.min(40, Math.max(2, v)) : 8;
}

function unitatsRecomanades(equips, numObjectes) {
  const perObjecte = Math.ceil(equips / 3) + 1;
  return Math.max(1, Math.min(perObjecte, equips - 1, Math.floor(LIMITS.MAX_UNITATS_TOTALS / Math.max(1, numObjectes))));
}

function actualitzaRecomanacioUnitats() {
  const esb = estatUI.esborranyPrep;
  const el = $('recomanacio-unitats');
  if (!esb || !el) return;
  const equips = equipsPrevistos();
  const total = totalUnitatsCfg(esb);
  const recomanat = unitatsRecomanades(equips, esb.objectes.length);
  const saturats = esb.objectes.filter((o) => Number(o.quantitat) >= equips).map((o) => o.nom || 'sense nom');
  const linia = `<b class="tabular">${total}</b> unitats · uns <b class="tabular">${minutsEstimats(total)}</b> minuts de subhasta.`;
  if (saturats.length) {
    el.className = 'recomanacio-unitats rec-avis';
    el.innerHTML = `${IC.rellotge}<span>${linia} <b>Poca competència:</b> ${escHtml(saturats.join(', '))} ${saturats.length === 1 ? 'té' : 'tenen'} tantes unitats com equips o més.</span>`;
  } else {
    el.className = 'recomanacio-unitats rec-ok';
    el.innerHTML = `${IC.check}<span>${linia} Hi haurà competència: cada objecte té menys unitats que equips.</span>`;
  }
  const btn = $('btn-ajusta-unitats');
  btn.textContent = `Posa ${recomanat} ${recomanat === 1 ? 'unitat' : 'unitats'} a cada objecte`;
  btn.dataset.recomanat = String(recomanat);
  btn.disabled = esb.objectes.every((o) => Number(o.quantitat) === recomanat);
}

/* ============================================================
   7. Vista 3: Preparació en una sola pantalla
   ============================================================ */
function carregaPreparacioAFormulario(dades) {
  const s = dades.sessio;
  estatUI.esborranyPrep = {
    titol: s.titol,
    repte: s.repte || '',
    pressupost: s.pressupost,
    moneda: s.moneda || 'monedes',
    increment: s.increment,
    puntuacioActiva: Boolean(s.puntuacioActiva),
    bonificacioConjunt: Number(s.bonificacioConjunt ?? 0),
    objectes: dades.objectes.map((o) => ({ ...o }))
  };
  pintaFormulariPreparacio();
}

function pintaFormulariPreparacio() {
  const esb = estatUI.esborranyPrep;
  if (!esb) return;

  $('prep-titol').value = esb.titol;
  $('prep-pressupost').value = esb.pressupost;
  $('prep-increment').value = esb.increment;
  $('prep-moneda').value = esb.moneda;
  $('prep-repte').value = esb.repte;
  $('prep-puntuacio-activa').checked = esb.puntuacioActiva;
  $('prep-bonificacio-conjunt').value = esb.bonificacioConjunt;
  $('bloc-bonificacio-conjunt').hidden = !esb.puntuacioActiva;
  $('th-valor-punts').hidden = !esb.puntuacioActiva;

  $('comptador-prep-titol').textContent = `${esb.titol.length}/${LIMITS.MAX_TITOL}`;
  $('comptador-prep-repte').textContent = `${esb.repte.length}/${LIMITS.MAX_REPTE}`;

  renderFilesObjectesPreparacio();
  validaIDesaPreparacio(false);
}

function renderFilesObjectesPreparacio() {
  const esb = estatUI.esborranyPrep;
  const tbody = $('tbody-prep-objectes');
  const opcionsIcones = Object.entries(ICONES)
    .map(([clau, info]) => `<option value="${clau}">${escHtml(info.nom)}</option>`)
    .join('');

  tbody.innerHTML = esb.objectes
    .map(
      (obj, idx) => `
      <tr data-idx="${idx}">
        <td class="col-icona">
          <div class="cel-icona-selector">
            <span class="preview-icona-prep">${renderIconaSvg(obj.icona, obj.imatgeDataUrl)}</span>
            <div style="display:flex;flex-direction:column;gap:0.2rem;flex:1;">
              <select class="sel-icona-obj" data-idx="${idx}" aria-label="Icona de l'objecte ${idx + 1}">
                ${opcionsIcones.replace(`value="${obj.icona}"`, `value="${obj.icona}" selected`)}
              </select>
              <label class="btn-enllac" style="font-size:0.74rem;">
                <span>${obj.imatgeDataUrl ? 'Canvia foto' : 'Puja foto'}</span>
                <input type="file" class="input-foto-obj" data-idx="${idx}" accept="image/*" hidden>
              </label>
            </div>
          </div>
        </td>
        <td>
          <div class="cel-nom-desc">
            <input type="text" class="inp-obj-nom" data-idx="${idx}" maxlength="40" value="${escHtml(obj.nom)}" placeholder="Nom de l'objecte" aria-label="Nom de l'objecte ${idx + 1}">
            <input type="text" class="inp-obj-desc input-desc-petit" data-idx="${idx}" maxlength="200" value="${escHtml(obj.descripcio || '')}" placeholder="Descripció breu (opcional)" aria-label="Descripció de l'objecte ${idx + 1}">
            <p class="error-camp err-obj-nom" data-idx="${idx}" hidden></p>
          </div>
        </td>
        <td class="col-num col-unitats">
          <div class="grup-pas-mini">
            <button type="button" class="btn-pas-mini" data-pas-unitats="-1" data-idx="${idx}" aria-label="Una unitat menys ${deNom(escHtml(obj.nom))}">−</button>
            <input type="number" class="inp-obj-quantitat tabular" data-idx="${idx}" min="1" max="60" step="1" value="${obj.quantitat}" aria-label="Unitats ${deNom(escHtml(obj.nom))}">
            <button type="button" class="btn-pas-mini" data-pas-unitats="1" data-idx="${idx}" aria-label="Una unitat més ${deNom(escHtml(obj.nom))}">+</button>
          </div>
          <p class="error-camp err-obj-quantitat" data-idx="${idx}" hidden></p>
        </td>
        <td class="col-num">
          <input type="number" class="inp-obj-sortida tabular" data-idx="${idx}" min="1" max="100000" step="${esb.increment || 1}" value="${obj.preuSortida}" aria-label="Preu de sortida ${deNom(escHtml(obj.nom))}">
          <p class="error-camp err-obj-sortida" data-idx="${idx}" hidden></p>
        </td>
        <td class="col-num" ${esb.puntuacioActiva ? '' : 'hidden'}>
          <input type="number" class="inp-obj-valor tabular" data-idx="${idx}" min="0" max="100000" step="10" value="${obj.valor ?? 0}" aria-label="Valor en punts ${deNom(escHtml(obj.nom))}">
        </td>
        <td class="col-accions">
          <button type="button" class="btn-xip btn-eliminar-obj" data-idx="${idx}" title="Elimina l'objecte" ${esb.objectes.length <= 1 ? 'disabled' : ''}>✕</button>
        </td>
      </tr>
    `
    )
    .join('');
}

function llegeixEsborranyDelDom() {
  const esb = estatUI.esborranyPrep;
  if (!esb) return;
  esb.titol = $('prep-titol').value;
  esb.pressupost = Number($('prep-pressupost').value);
  esb.increment = Number($('prep-increment').value);
  esb.moneda = $('prep-moneda').value;
  esb.repte = $('prep-repte').value;
  esb.puntuacioActiva = $('prep-puntuacio-activa').checked;
  esb.bonificacioConjunt = Number($('prep-bonificacio-conjunt').value || 0);

  $('comptador-prep-titol').textContent = `${esb.titol.length}/${LIMITS.MAX_TITOL}`;
  $('comptador-prep-repte').textContent = `${esb.repte.length}/${LIMITS.MAX_REPTE}`;

  document.querySelectorAll('#tbody-prep-objectes tr').forEach((tr) => {
    const idx = Number(tr.dataset.idx);
    const obj = esb.objectes[idx];
    if (!obj) return;
    obj.icona = tr.querySelector('.sel-icona-obj')?.value || obj.icona;
    obj.nom = tr.querySelector('.inp-obj-nom')?.value ?? obj.nom;
    obj.descripcio = tr.querySelector('.inp-obj-desc')?.value ?? obj.descripcio;
    obj.quantitat = Number(tr.querySelector('.inp-obj-quantitat')?.value || 0);
    obj.preuSortida = Number(tr.querySelector('.inp-obj-sortida')?.value || 0);
    const valInput = tr.querySelector('.inp-obj-valor');
    if (valInput) obj.valor = Number(valInput.value || 0);
  });
}

async function validaIDesaPreparacio(desar = true) {
  llegeixEsborranyDelDom();
  const esb = estatUI.esborranyPrep;
  const val = validaConfiguracio(esb);

  const setErr = (id, msg) => {
    const el = $(id);
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
  };

  setErr('err-prep-titol', val.errors.titol);
  setErr('err-prep-pressupost', val.errors.pressupost);
  setErr('err-prep-increment', val.errors.increment);
  setErr('err-prep-moneda', val.errors.moneda);
  setErr('err-prep-repte', val.errors.repte);
  setErr('err-prep-objectes', val.errors.objectes || val.errors.totalUnitats);

  $('resum-capacitat-prep').textContent = `${esb.objectes.length} ${esb.objectes.length === 1 ? 'objecte' : 'objectes'} · ${val.totalUnitats} unitats, que se subhasten d’una en una (màx. ${LIMITS.MAX_OBJECTES} i ${LIMITS.MAX_UNITATS_TOTALS})`;
  actualitzaRecomanacioUnitats();

  val.errorsObjectes.forEach((errObj, idx) => {
    const tr = document.querySelector(`#tbody-prep-objectes tr[data-idx="${idx}"]`);
    if (!tr) return;
    const eNom = tr.querySelector('.err-obj-nom');
    const eQuant = tr.querySelector('.err-obj-quantitat');
    const eSort = tr.querySelector('.err-obj-sortida');
    if (eNom) {
      eNom.textContent = errObj.nom || errObj.descripcio || '';
      eNom.hidden = !(errObj.nom || errObj.descripcio);
    }
    if (eQuant) {
      eQuant.textContent = errObj.quantitat || '';
      eQuant.hidden = !errObj.quantitat;
    }
    if (eSort) {
      eSort.textContent = errObj.preuSortida || '';
      eSort.hidden = !errObj.preuSortida;
    }
  });

  $('btn-anar-sala-espera').disabled = !val.valid;

  if (!val.valid) {
    $('indicador-desament').textContent = 'Revisa els camps marcats';
    $('indicador-desament').style.background = 'var(--amber-soft)';
    $('indicador-desament').style.color = 'var(--amber)';
    return false;
  }

  if (desar && estatUI.sessioId) {
    $('indicador-desament').textContent = 'Desant…';
    await gestor.desaPreparacio(estatUI.sessioId, esb);
    $('indicador-desament').textContent = 'Desat automàticament ✓';
    $('indicador-desament').style.background = 'var(--ok-soft)';
    $('indicador-desament').style.color = 'var(--ok)';
  }
  return true;
}

/* ============================================================
   8. Vista 4: Sala d'espera
   ============================================================ */
function renderSalaEspera(dades) {
  const { sessio, objectes, participants, esOrganitzador } = dades;
  $('espera-codi-6').textContent = formatCodiSala(sessio.codi);

  const urlEntrada = `${window.location.origin}${window.location.pathname}?codi=${sessio.codi}`;
  try {
    $('espera-qr-svg').innerHTML = renderQrSvg(urlEntrada);
  } catch (_) {
    $('espera-qr-svg').innerHTML = '';
  }

  $('espera-repte-bloc').hidden = !sessio.repte;
  $('espera-repte-text').textContent = sessio.repte || '';

  const totalUnitats = objectes.reduce((a, o) => a + Number(o.quantitat), 0);
  $('espera-resum-pressupost').textContent = `${fmtNum(sessio.pressupost)} ${sessio.moneda} · increment ${fmtNum(sessio.increment)} · ${totalUnitats} unitats`;

  $('espera-llista-objectes').innerHTML = objectes
    .map(
      (o) => `
      <li class="item-obj-compacte">
        <span class="item-obj-esquerra">
          ${renderIconaSvg(o.icona, o.imatgeDataUrl)}
          <span>${escHtml(o.nom)}</span>
        </span>
        <span class="tabular">
          <strong>${o.quantitat} u.</strong> · sortida ${fmtNum(o.preuSortida)}
          ${sessio.puntuacioActiva && o.valor > 0 ? ` · valor ${fmtNum(o.valor)} pts` : ''}
        </span>
      </li>
    `
    )
    .join('');

  $('espera-num-participants').textContent = String(participants.length);
  $('check-inscripcions-espera').checked = Boolean(sessio.inscripcionsObertes);
  $('check-inscripcions-espera').disabled = !esOrganitzador;
  $('txt-inscripcions-espera').textContent = sessio.inscripcionsObertes
    ? 'Inscripcions obertes'
    : 'Inscripcions tancades';

  $('barra-simulador-espera').hidden = !esOrganitzador;
  $('accions-org-espera').hidden = !esOrganitzador;

  const llistaEl = $('llista-participants-espera');
  if (!participants.length) {
    llistaEl.innerHTML = `
      <div class="espera-buida">
        <span class="espera-buida-ic">${IC.persones}</span>
        <strong>Encara no ha entrat ningú</strong>
        <span>L’alumnat entra a <b>ja.cat/subhasta</b> amb el codi <b class="tabular">${formatCodiSala(sessio.codi)}</b>.</span>
      </div>`;
  } else {
    llistaEl.innerHTML = participants
      .map(
        (p) => `
        <div class="xip-participant">
          <span>${escHtml(p.alies)}</span>
          ${
            esOrganitzador
              ? `<span class="xip-accions">
                  <button type="button" class="btn-xip" data-accio-part="renomena" data-uid="${p.uid}" data-alies="${escHtml(p.alies)}" title="Canvia l’àlies" aria-label="Canvia l’àlies ${deNom(escHtml(p.alies))}">${IC.editar}</button>
                  <button type="button" class="btn-xip btn-xip-perill" data-accio-part="treu" data-uid="${p.uid}" data-alies="${escHtml(p.alies)}" title="Treu de la sala" aria-label="Treu ${escHtml(p.alies)} de la sala">${IC.treure}</button>
                </span>`
              : ''
          }
        </div>
      `
      )
      .join('');
  }
}

/* ============================================================
   9. Vista 5: Comandament de l'organitzador
   ============================================================ */
function renderComandament(dades) {
  const { sessio, objectes, tauler, participants, carteres } = dades;
  const lic = tauler.licitacio;
  const ultima = tauler.ultimaAdjudicacio;

  $('cmd-num-participants').textContent = String(participants.length);
  $('cmd-ronda-badge').textContent = `Ronda ${sessio.ronda || 1}`;
  $('check-inscripcions-cmd').checked = Boolean(sessio.inscripcionsObertes);
  $('txt-inscripcions-cmd').textContent = sessio.inscripcionsObertes
    ? 'Inscripcions obertes'
    : 'Inscripcions tancades';
  $('check-sim-actiu').checked = Boolean(gestor.simuladorTimer);

  // Botó Desfer (només abans d'obrir la unitat següent §5)
  const potDesfer = !lic && Boolean(ultima?.potDesfer);
  $('btn-cmd-desfer').hidden = !potDesfer;
  if (potDesfer) {
    $('txt-cmd-desfer').textContent = `Desfés: ${ultima.objecteNom} a ${ultima.compradorAlies} (${fmtNum(ultima.preu)})`;
  }

  // «Finalitzar» i «Tornar a començar» només sense licitació oberta o aturada (§5)
  $('btn-cmd-finalitzar').disabled = Boolean(lic);
  $('btn-cmd-reiniciar').disabled = Boolean(lic);

  // Targeta de control directe amb una sola acció principal segons el moment (§1 i §7)
  const targeta = $('targeta-control-directe');

  if (!lic) {
    const segId = tauler.seguentObjecteId;
    const objSeg = objectes.find((o) => o.id === segId);
    const venudesSeg = objSeg ? Number(tauler.cataleg?.[objSeg.id]?.venudes ?? 0) : 0;
    const unitatSeg = venudesSeg + 1;

    const blocUltima = ultima
      ? `<div class="cmd-confirmacio-adjudicar">
          Última adjudicació: <strong>1 ${escHtml(ultima.objecteNom.toLowerCase())}</strong> venut a <strong>${escHtml(ultima.compradorAlies)}</strong> per <strong class="tabular">${fmtNum(ultima.preu)} ${escHtml(sessio.moneda)}</strong>
        </div>`
      : '';

    if (objSeg) {
      targeta.innerHTML = `
        <div class="cmd-estat-superior">
          <div class="cmd-unitat-titol">
            ${renderIconaSvg(objSeg.icona, objSeg.imatgeDataUrl)}
            <span>Esperant la unitat següent</span>
          </div>
          <span class="etiqueta-estat">Preparat per obrir</span>
        </div>
        ${blocUltima}
        <div class="cmd-accio-principal-fila">
          <button type="button" class="btn btn-primari btn-gran" id="btn-cmd-accio-principal" data-obrir-id="${objSeg.id}">
            <span>Obrir ${escHtml(objSeg.nom.toLowerCase())} · unitat ${unitatSeg} de ${objSeg.quantitat}</span>
          </button>
          <span class="subtext tabular">Preu de sortida: ${fmtNum(objSeg.preuSortida)} ${escHtml(sessio.moneda)}</span>
        </div>
      `;
    } else {
      targeta.innerHTML = `
        <div class="cmd-estat-superior">
          <div class="cmd-unitat-titol"><span>Totes les unitats del catàleg s’han subhastat</span></div>
          <span class="etiqueta-estat">Catàleg completat</span>
        </div>
        ${blocUltima}
        <div class="cmd-accio-principal-fila">
          <button type="button" class="btn btn-primari btn-gran" id="btn-cmd-finalitzar-directe">
            <span>Finalitza la subhasta i mostra els resultats →</span>
          </button>
        </div>
      `;
    }
  } else if (lic.estat === 'oberta') {
    const preuMostrar =
      lic.numOfertes > 0
        ? `${fmtNum(lic.importActual)} ${escHtml(sessio.moneda)}`
        : `Sortida: ${fmtNum(lic.preuSortida)} ${escHtml(sessio.moneda)}`;
    const liderMostrar = lic.liderAlies ? `Lidera: ${escHtml(lic.liderAlies)}` : 'Sense ofertes encara';
    const ultimes = (lic.ultimesOfertes || [])
      .map((o) => `${escHtml(o.alies)} ${fmtNum(o.import)}`)
      .join(' · ');

    targeta.innerHTML = `
      <div class="cmd-estat-superior">
        <div class="cmd-unitat-titol">
          ${renderIconaSvg(lic.objecteIcona)}
          <span>${escHtml(lic.objecteNom)} · unitat ${lic.unitat} de ${lic.quantitatTotal}</span>
        </div>
        <span class="proj-estat-pastilla proj-estat-oberta">OBERTA</span>
      </div>
      <div class="cmd-resum-oferta">
        <div>
          <div class="cmd-import-gegant tabular">${preuMostrar}</div>
          <div class="cmd-lider-info">${liderMostrar}</div>
        </div>
        <div class="subtext tabular">
          <div>Ofertes rebudes: <strong>${lic.numOfertes}</strong></div>
          <div>${ultimes ? `Últimes: ${ultimes}` : `Mínim següent: ${fmtNum(calculaMinimOferta(lic))}`}</div>
        </div>
      </div>
      <div class="cmd-accio-principal-fila">
        <button type="button" class="btn btn-primari btn-gran" id="btn-cmd-aturar">
          <span>Aturar ofertes</span>
        </button>
      </div>
    `;
  } else {
    // lic.estat === 'aturada'
    const teLider = Boolean(lic.liderUid && lic.numOfertes > 0);
    const preuMostrar = teLider
      ? `${fmtNum(lic.importActual)} ${escHtml(sessio.moneda)}`
      : `Sense ofertes (sortida ${fmtNum(lic.preuSortida)})`;

    targeta.innerHTML = `
      <div class="cmd-estat-superior">
        <div class="cmd-unitat-titol">
          ${renderIconaSvg(lic.objecteIcona)}
          <span>${escHtml(lic.objecteNom)} · unitat ${lic.unitat} de ${lic.quantitatTotal}</span>
        </div>
        <span class="proj-estat-pastilla proj-estat-aturada">OFERTES ATURADES</span>
      </div>
      <div class="cmd-resum-oferta">
        <div>
          <div class="cmd-import-gegant tabular">${preuMostrar}</div>
          <div class="cmd-lider-info">${teLider ? `Lidera: ${escHtml(lic.liderAlies)}` : 'Cap participant ha fet oferta'}</div>
        </div>
      </div>
      ${
        teLider
          ? `<div class="cmd-confirmacio-adjudicar">
              Revisió abans de confirmar: <strong>Adjudicar 1 ${escHtml(lic.objecteNom.toLowerCase())} a ${escHtml(lic.liderAlies)} per ${fmtNum(lic.importActual)} ${escHtml(sessio.moneda)}</strong>
            </div>`
          : ''
      }
      <div class="cmd-accio-principal-fila">
        ${
          teLider
            ? `<button type="button" class="btn btn-primari btn-gran" id="btn-cmd-adjudicar" data-lider="${lic.liderUid}" data-import="${lic.importActual}">
                <span>Adjudicar 1 ${escHtml(lic.objecteNom.toLowerCase())} a ${escHtml(lic.liderAlies)} per ${fmtNum(lic.importActual)}</span>
              </button>`
            : ''
        }
        <button type="button" class="btn btn-secundari" id="btn-cmd-reprendre">Reprendre ofertes</button>
        <button type="button" class="btn btn-suau" id="btn-cmd-retirar" data-te-oferta="${teLider ? '1' : '0'}">Retirar sense vendre</button>
      </div>
    `;
  }

  // Ajuda del pas actual segons el moment de la licitació
  if (estatUI.vistaActual === 'comandament') {
    let ara;
    if (!lic) {
      ara = tauler.seguentObjecteId && objectes.some((o) => o.id === tauler.seguentObjecteId)
        ? 'prem «Obrir…» per posar a la venda la unitat següent (o tria un altre objecte del catàleg).'
        : 'ja s’han venut totes les unitats. Prem «Finalitza la subhasta» per veure els resultats.';
    } else if (lic.estat === 'oberta') {
      ara = 'deixa que els equips facin ofertes. Quan ningú no millori el preu, prem «Aturar ofertes».';
    } else if (lic.liderUid && lic.numOfertes > 0) {
      ara = 'revisa qui guanya i prem «Adjudicar». Si encara volien oferir, prem «Reprendre ofertes».';
    } else {
      ara = 'ningú no ha fet cap oferta. Retira la unitat sense vendre o reprèn les ofertes.';
    }
    actualitzaPassosOrg(ara);
  }

  // Graella del catàleg al comandament
  $('graella-cataleg-comandament').innerHTML = objectes
    .map((o) => {
      const cat = tauler.cataleg?.[o.id] || { venudes: 0, darrerPreu: null };
      const queden = Math.max(0, Number(o.quantitat) - Number(cat.venudes));
      const enJoc = lic?.objecteId === o.id;
      const proxUnitat = Number(cat.venudes) + 1;
      return `
        <div class="targeta-obj-cmd ${enJoc ? 'en-joc' : ''}">
          <div class="targeta-obj-cmd-cap">
            <span class="targeta-obj-cmd-nom">
              ${renderIconaSvg(o.icona, o.imatgeDataUrl)}
              <span>${escHtml(o.nom)}</span>
            </span>
            <span class="tabular subtext"><strong>${queden}</strong> de ${o.quantitat}</span>
          </div>
          <div class="subtext tabular">
            Sortida: ${fmtNum(o.preuSortida)} · Darrer: <strong>${cat.darrerPreu !== null ? fmtNum(cat.darrerPreu) : '—'}</strong>
          </div>
          <button type="button" class="btn btn-secundari btn-sm btn-obrir-obj-cataleg" data-obj-id="${o.id}" ${lic || queden <= 0 ? 'disabled' : ''}
            title="${lic && queden > 0 ? 'Adjudica o retira la unitat en joc per obrir-ne una altra' : ''}">
            ${queden <= 0 ? 'Esgotat' : enJoc ? `En joc · unitat ${lic.unitat}` : `Obrir unitat ${proxUnitat} de ${o.quantitat}`}
          </button>
        </div>
      `;
    })
    .join('');

  // Llista lateral de participants amb saldo, compres i canvi d'aparell
  const llistaCarteres = $('llista-carteres-comandament');
  const carteresActives = carteres
    .filter((c) => c.habilitada !== false)
    .sort((a, b) => String(a.alies || '').localeCompare(String(b.alies || ''), 'ca-ES'));

  if (!carteresActives.length) {
    llistaCarteres.innerHTML = `<p class="subtext">Cap participant actiu. Pots obrir les inscripcions o afegir bots d’assaig.</p>`;
  } else {
    llistaCarteres.innerHTML = carteresActives
      .map((c) => {
        const saldo = Number(sessio.pressupost) - Number(c.gastat || 0);
        const compresTxt =
          (c.compres || []).length > 0
            ? c.compres.map((item) => `${item.objecteNom} (${fmtNum(item.preu)})`).join(', ')
            : 'Cap compra';
        const esLider = lic?.liderUid === c.uid;
        return `
          <div class="fila-cartera-cmd ${esLider ? 'es-lider' : ''}">
            <div class="fila-cartera-info">
              <strong>${escHtml(c.alies)}${esLider ? ' <span class="pastilla-lider">Lidera</span>' : ''}</strong>
              <span class="subtext tabular">Saldo: <strong>${fmtNum(saldo)}</strong> · Gastat: ${fmtNum(c.gastat)}</span>
              <span class="subtext" style="font-size:0.78rem;">${escHtml(compresTxt)}</span>
            </div>
            <div class="fila-cartera-accions">
              <button type="button" class="btn-xip" data-accio-part="canvi-aparell" data-uid="${c.uid}" data-alies="${escHtml(c.alies)}" title="Codi de 4 xifres per canviar d’aparell" aria-label="Canvi d’aparell ${deNom(escHtml(c.alies))}">${IC.aparell}</button>
              <button type="button" class="btn-xip" data-accio-part="renomena" data-uid="${c.uid}" data-alies="${escHtml(c.alies)}" title="Canvia l’àlies" aria-label="Canvia l’àlies ${deNom(escHtml(c.alies))}">${IC.editar}</button>
              <button type="button" class="btn-xip btn-xip-perill" data-accio-part="treu" data-uid="${c.uid}" data-alies="${escHtml(c.alies)}" title="Treu de la sessió" aria-label="Treu ${escHtml(c.alies)} de la sessió">${IC.treure}</button>
            </div>
          </div>
        `;
      })
      .join('');
  }
}

/* ============================================================
   10. Vista 6: Projecció pública i Mode de presentació (§7 Projecció)
   ============================================================ */
function renderProjeccio(dades) {
  const { sessio, objectes, tauler, participants, esOrganitzador } = dades;
  const lic = tauler.licitacio;
  const ultima = tauler.ultimaAdjudicacio;
  const ev = tauler.ultimEsdeveniment;

  // So de martell opcional quan hi ha una nova adjudicació (§7)
  if (ev?.tipus === 'adjudicada' && ev.ms && ev.ms !== estatUI.darrerEventAdjudicatMs) {
    if (estatUI.darrerEventAdjudicatMs !== 0) {
      soMartell.martellAdjudicacio();
    }
    estatUI.darrerEventAdjudicatMs = ev.ms;
  }

  $('proj-titol-sessio').textContent = sessio.titol;
  $('proj-ronda-tag').textContent = `Ronda ${sessio.ronda || 1}`;
  $('proj-codi-sala').textContent = formatCodiSala(sessio.codi);
  $('btn-proj-mode-presentacio').hidden = !esOrganitzador;

  const escenari = $('proj-escenari-unitat');

  if (lic) {
    const estatTxt = lic.estat === 'oberta' ? TEXTOS.projeccio.oberta : TEXTOS.projeccio.aturada;
    const estatCls = lic.estat === 'oberta' ? 'proj-estat-oberta' : 'proj-estat-aturada';
    const xifraTxt =
      lic.numOfertes > 0
        ? `${fmtNum(lic.importActual)} ${escHtml(sessio.moneda)}`
        : TEXTOS.projeccio.sortida(lic.preuSortida, sessio.moneda);
    const liderTxt = lic.liderAlies
      ? TEXTOS.projeccio.lidera(lic.liderAlies)
      : 'Esperant la primera oferta';
    const minimSeg = calculaMinimOferta(lic);
    const ultimesTxt =
      (lic.ultimesOfertes || []).length > 0
        ? lic.ultimesOfertes.map((o) => `${escHtml(o.alies)} ${fmtNum(o.import)}`).join(' · ')
        : 'Cap oferta registrada en aquesta unitat';

    const haCanviatImport =
      estatUI.darrerImportProjeccio !== null && estatUI.darrerImportProjeccio !== lic.importActual;
    estatUI.darrerImportProjeccio = lic.importActual;

    escenari.innerHTML = `
      <div class="proj-unitat-barra">
        <div class="proj-unitat-nom">${escHtml(lic.objecteNom.toUpperCase())} · unitat ${lic.unitat} de ${lic.quantitatTotal}</div>
        <span class="proj-estat-pastilla ${estatCls}">${estatTxt}</span>
      </div>

      <div class="proj-centre-import">
        <div class="proj-icona-gran">
          ${renderIconaSvg(lic.objecteIcona)}
        </div>
        <div>
          <div class="proj-xifra-dominant tabular ${haCanviatImport ? 'flash-oferta' : ''}">${xifraTxt}</div>
          <div class="proj-lider-gran">${escHtml(liderTxt)}</div>
        </div>
      </div>

      <div class="proj-peu-escenari">
        <div class="proj-oferta-minima tabular">${
          lic.estat === 'oberta' ? TEXTOS.projeccio.ofertaMinima(minimSeg) : 'Ofertes congelades'
        }</div>
        <div class="proj-ultimes-ofertes tabular">${TEXTOS.projeccio.ultimesOfertes} ${ultimesTxt}</div>
      </div>
    `;
  } else if (ev?.tipus === 'retirada') {
    escenari.innerHTML = `
      <div class="proj-unitat-barra">
        <div class="proj-unitat-nom">Unitat retirada</div>
        <span class="proj-estat-pastilla proj-estat-aturada">${TEXTOS.projeccio.senseVendre}</span>
      </div>
      <div class="proj-centre-import">
        <div>
          <div class="proj-xifra-dominant">${TEXTOS.projeccio.senseVendre}</div>
          <div class="proj-lider-gran">${TEXTOS.projeccio.esperantUnitat}</div>
        </div>
      </div>
      <div class="proj-peu-escenari">
        <div class="proj-ultimes-ofertes">Cap càrrec aplicat; la unitat continua disponible al catàleg.</div>
      </div>
    `;
  } else if (ultima) {
    // L'adjudicació es queda visible fins que s'obre la unitat següent (§7)
    escenari.innerHTML = `
      <div class="proj-unitat-barra">
        <div class="proj-unitat-nom">${escHtml(ultima.objecteNom.toUpperCase())} · unitat ${ultima.unitat} de ${ultima.quantitatTotal}</div>
        <span class="proj-estat-pastilla proj-estat-venut">ADJUDICADA</span>
      </div>
      <div class="proj-centre-import">
        <div class="proj-icona-gran">
          ${renderIconaSvg(ultima.objecteIcona || 'carbo')}
        </div>
        <div>
          <div class="proj-xifra-dominant tabular">${TEXTOS.projeccio.venut(ultima.compradorAlies, ultima.preu, sessio.moneda)}</div>
          <div class="proj-lider-gran">${TEXTOS.projeccio.esperantUnitat}</div>
        </div>
      </div>
      <div class="proj-peu-escenari">
        <div class="proj-ultimes-ofertes tabular">Adjudicada després de ${ultima.numOfertes} ${ultima.numOfertes === 1 ? 'oferta' : 'ofertes'}.</div>
      </div>
    `;
  } else {
    escenari.innerHTML = `
      <div class="proj-unitat-barra">
        <div class="proj-unitat-nom">${
          sessio.estat === 'espera' ? 'Sala d’espera oberta' : TEXTOS.projeccio.esperantUnitat
        }</div>
        <span class="proj-estat-pastilla proj-estat-oberta">${participants.length} participants</span>
      </div>
      <div class="proj-centre-import">
        <div>
          <div class="proj-xifra-dominant tabular">${fmtNum(sessio.pressupost)} ${escHtml(sessio.moneda)}</div>
          <div class="proj-lider-gran">Pressupost inicial per participant · Increment mínim: ${fmtNum(sessio.increment)}</div>
        </div>
      </div>
      <div class="proj-peu-escenari">
        <div class="proj-ultimes-ofertes">Entra a <strong>ja.cat/subhasta</strong> amb el codi <strong>${formatCodiSala(sessio.codi)}</strong></div>
      </div>
    `;
  }

  // Catàleg d'ordre fix: «Queden» inclou la unitat en curs; «Darrer preu» és sempre l'última adjudicació (§7)
  $('proj-seguent-indicador').textContent = textSeguent(objectes, tauler);

  $('tbody-proj-cataleg').innerHTML = objectes
    .map((o) => {
      const cat = tauler.cataleg?.[o.id] || { venudes: 0, darrerPreu: null };
      const queden = Math.max(0, Number(o.quantitat) - Number(cat.venudes));
      const esActiu = lic?.objecteId === o.id;
      return `
        <tr class="${esActiu ? 'fila-activa' : ''}">
          <td>
            <span class="cel-obj-proj">
              ${renderIconaSvg(o.icona, o.imatgeDataUrl)}
              <span>${escHtml(o.nom)}</span>
              ${esActiu ? '<span class="pastilla-en-joc">En joc</span>' : ''}
            </span>
          </td>
          <td class="col-num tabular">${queden} de ${o.quantitat}</td>
          <td class="col-num tabular">${cat.darrerPreu !== null ? fmtNum(cat.darrerPreu) : '—'}</td>
        </tr>
      `;
    })
    .join('');

  $('proj-repte-caixa').hidden = !sessio.repte;
  $('proj-repte-text').textContent = sessio.repte || '';

  // Barra de «Mode de presentació» per a un sol ordinador duplicat (§6)
  const barraPres = $('barra-mode-presentacio');
  barraPres.hidden = !(esOrganitzador && estatUI.modePresentacio);
  if (esOrganitzador && estatUI.modePresentacio) {
    renderBarraModePresentacio(dades, barraPres);
  }
}

function renderBarraModePresentacio(dades, contenidor) {
  const { objectes, tauler, participants } = dades;
  const lic = tauler.licitacio;
  const objSeg = objectes.find((o) => o.id === tauler.seguentObjecteId);

  let controlsAccio = '';
  if (!lic) {
    if (objSeg) {
      const venudes = Number(tauler.cataleg?.[objSeg.id]?.venudes ?? 0);
      controlsAccio = `<button type="button" class="btn btn-primari btn-sm" id="btn-pres-obrir" data-id="${objSeg.id}">Obrir ${escHtml(objSeg.nom)} (${venudes + 1}/${objSeg.quantitat})</button>`;
    }
    if (tauler.ultimaAdjudicacio?.potDesfer) {
      controlsAccio += ` <button type="button" class="btn btn-suau btn-sm" id="btn-pres-desfer">Desfés última</button>`;
    }
    controlsAccio += ` <button type="button" class="btn btn-perill-suau btn-sm" id="btn-pres-finalitzar">Finalitza</button>`;
  } else if (lic.estat === 'oberta') {
    controlsAccio = `<button type="button" class="btn btn-primari btn-sm" id="btn-pres-aturar">Aturar ofertes</button>`;
  } else {
    if (lic.liderUid) {
      controlsAccio = `<button type="button" class="btn btn-primari btn-sm" id="btn-pres-adjudicar" data-lider="${lic.liderUid}" data-import="${lic.importActual}">Adjudicar a ${escHtml(lic.liderAlies)} (${fmtNum(lic.importActual)})</button>`;
    }
    controlsAccio += ` <button type="button" class="btn btn-secundari btn-sm" id="btn-pres-reprendre">Reprendre</button>`;
    controlsAccio += ` <button type="button" class="btn btn-suau btn-sm" id="btn-pres-retirar">Retirar</button>`;
  }

  contenidor.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
      <strong>Mode presentació:</strong>
      ${controlsAccio}
    </div>
    <div style="display:flex;align-items:center;gap:0.5rem;">
      <button type="button" class="btn btn-suau btn-sm" id="btn-pres-participants">
        Participants (${participants.length}) — avís públic
      </button>
    </div>
  `;
}

/* ============================================================
   11. Vista 7: Terminal del participant (§7 Terminal a l'ordinador)
   ============================================================ */
function renderTerminal(dades) {
  const { sessio, objectes, tauler, carteraPropia, uid } = dades;
  const lic = tauler.licitacio;
  const ev = tauler.ultimEsdeveniment;

  if (!carteraPropia) {
    mostraVista('inici');
    return;
  }

  const pressupost = Number(sessio.pressupost);
  const gastat = Number(carteraPropia.gastat || 0);
  const saldo = pressupost - gastat;

  $('term-alies').textContent = carteraPropia.alies;
  $('term-gastat-resum').textContent = `Gastat: ${fmtNum(gastat)} de ${fmtNum(pressupost)}`;
  $('term-saldo-valor').textContent = `${fmtNum(saldo)} ${sessio.moneda}`;
  $('term-repte-caixa').hidden = !sessio.repte;
  $('term-repte-text').textContent = sessio.repte || '';

  const capUnitat = $('term-unitat-cap');
  const msgEl = $('term-missatge-estat');
  const zonaBotons = $('term-zona-botons');

  // Si la cartera s'ha transferit a un altre aparell o desactivat
  if (carteraPropia.habilitada === false) {
    capUnitat.className = 'term-unitat-cap term-estat-gran';
    capUnitat.innerHTML = `
      <span class="term-estat-gran-ic to-error">${IC.tancat}</span>
      <strong class="term-estat-gran-titol">Accés tancat en aquest aparell</strong>`;
    msgEl.className = 'term-missatge-estat estat-error';
    msgEl.textContent = TEXTOS.terminal.carteraDeshabilitada;
    zonaBotons.hidden = true;
    return;
  }

  const estatGran = (icona, titol, detall, to = '') => {
    capUnitat.className = 'term-unitat-cap term-estat-gran';
    capUnitat.innerHTML = `
      <span class="term-estat-gran-ic ${to}">${icona}</span>
      <strong class="term-estat-gran-titol">${titol}</strong>
      ${detall ? `<span class="term-estat-gran-detall">${detall}</span>` : ''}`;
  };

  $('term-ultimes-ofertes').hidden = !lic;
  if (!lic) {
    zonaBotons.hidden = true;
    estatUI.selectorObjecteKey = null;
    // El missatge queda per als lectors de pantalla; la targeta central el mostra en gran
    msgEl.className = 'term-missatge-estat sr-only';

    if (sessio.estat === 'espera') {
      estatGran(IC.rellotge, 'Ja ets a la sala', `${escHtml(sessio.titol)} · ${escHtml(TEXTOS.terminal.salaEspera)}`);
      msgEl.textContent = TEXTOS.terminal.salaEspera;
    } else if (ev?.tipus === 'adjudicada' && ev.compradorUid === uid) {
      estatGran(IC.check, `Has comprat 1 ${escHtml(String(ev.objecteNom).toLowerCase())}`,
        `Per <b class="tabular">${fmtNum(ev.preu)}</b> ${escHtml(sessio.moneda)} · Et queden <b class="tabular">${fmtNum(saldo)}</b>`, 'to-ok');
      msgEl.textContent = TEXTOS.terminal.compra(ev.objecteNom, ev.preu, saldo);
    } else if (ev?.tipus === 'adjudicada') {
      estatGran(IC.martell, escHtml(ev.text), escHtml(TEXTOS.terminal.esperantSeguent));
      msgEl.textContent = `${ev.text}. ${TEXTOS.terminal.esperantSeguent}`;
    } else {
      estatGran(IC.rellotge, escHtml(TEXTOS.terminal.esperantSeguent), 'Quan s’obri una unitat, aquí apareixeran els botons per oferir.');
      msgEl.textContent = TEXTOS.terminal.esperantSeguent;
    }
  } else {
    zonaBotons.hidden = false;
    capUnitat.className = 'term-unitat-cap';
    const obj = objectes.find((o) => o.id === lic.objecteId);
    const estatTxt = lic.estat === 'oberta' ? 'OBERTA' : 'ATURADA';
    const estatCls = lic.estat === 'oberta' ? 'proj-estat-oberta' : 'proj-estat-aturada';
    const millorTxt =
      lic.numOfertes > 0
        ? `Millor oferta: ${fmtNum(lic.importActual)} ${escHtml(sessio.moneda)}`
        : `Sortida: ${fmtNum(lic.preuSortida)} ${escHtml(sessio.moneda)}`;
    const liderTxt = lic.liderAlies ? `Lidera: ${escHtml(lic.liderAlies)}` : 'Sense ofertes';

    capUnitat.innerHTML = `
      <div class="term-unitat-titol-fila">
        <span class="term-unitat-nom">
          ${renderIconaSvg(lic.objecteIcona, obj?.imatgeDataUrl)}
          <span>${escHtml(lic.objecteNom.toUpperCase())} · unitat ${lic.unitat} de ${lic.quantitatTotal}</span>
        </span>
        <span class="proj-estat-pastilla ${estatCls}">${estatTxt}</span>
      </div>
      ${obj?.descripcio ? `<p class="subtext">${escHtml(obj.descripcio)}</p>` : ''}
      <div class="term-millor-oferta-caixa tabular">
        <span class="term-import-actual">${millorTxt}</span>
        <span class="term-lider-actual">${liderTxt}</span>
      </div>
    `;
    // Context secundari sota el missatge: les darreres ofertes de la unitat
    const ultimesTerm = (lic.ultimesOfertes || []).slice(0, 3);
    $('term-ultimes-ofertes').innerHTML = ultimesTerm.length
      ? `<span class="term-ultimes-etiqueta">Últimes ofertes</span>${ultimesTerm
          .map((o, i) => `<span class="term-ultima ${o.uid === uid ? 'meva' : ''} ${i === 0 ? 'primera' : ''}">${escHtml(o.uid === uid ? 'Tu' : o.alies)} <b class="tabular">${fmtNum(o.import)}</b></span>`)
          .join('')}`
      : `<span class="term-ultimes-etiqueta">Encara no hi ha cap oferta en aquesta unitat.</span>`;

    const opcions = calculaOpcionsOferta(lic, saldo);
    const minim = opcions.minim;
    const socLider = lic.liderUid === uid;
    const clauMeva = `${estatUI.sessioId}:${lic.objecteId}:${lic.unitat}:${sessio.ronda || 1}`;
    const emVanSuperar =
      !socLider &&
      lic.numOfertes > 0 &&
      (estatUI.unitatsAmbOfertaMeva.has(clauMeva) ||
        (Array.isArray(lic.ultimesOfertes) && lic.ultimesOfertes.slice(1).some((o) => o.uid === uid)));

    // Missatge d'estat persistent i destacat: què em passa a mi ara (§7)
    const T = TEXTOS.terminal;
    const posaMissatge = (cls, icona, titol, detall = '') => {
      msgEl.className = `term-missatge-estat ${cls}`;
      msgEl.innerHTML = `<span class="term-msg-ic">${icona}</span><span class="term-msg-text"><strong>${escHtml(titol)}</strong>${detall ? `<span>${escHtml(detall)}</span>` : ''}</span>`;
    };
    if (!navigator.onLine) {
      posaMissatge('estat-error', IC.senseXarxa, T.senseConnexio, T.senseConnexioDetall);
    } else if (estatUI.enviantOferta) {
      posaMissatge('', IC.rellotge, T.enviant(estatUI.enviantOferta));
    } else if (lic.estat !== 'oberta') {
      posaMissatge('estat-avis', IC.pausa, T.aturada, T.aturadaDetall);
    } else if (socLider) {
      posaMissatge('estat-lider', IC.check, T.vasPrimer(lic.importActual), `${T.siGuanyes(saldo - lic.importActual)} ${T.esperaQueOfereixin}`);
    } else if (estatUI.missatgeTerminalFix) {
      posaMissatge('estat-avis', IC.avis, estatUI.missatgeTerminalFix);
    } else if (minim > saldo) {
      posaMissatge('estat-error', IC.avis, T.senseDiners, `${T.saldoInsuficient(minim, saldo)}.`);
    } else if (emVanSuperar) {
      posaMissatge('estat-superat', IC.amunt, T.superat(lic.liderAlies, lic.importActual), T.perLiderar(minim));
    } else {
      posaMissatge('', IC.ma, T.potsOferir(minim, sessio.moneda), T.siGuanyes(saldo - minim));
    }

    const bloquejat =
      !navigator.onLine ||
      Boolean(estatUI.enviantOferta) ||
      lic.estat !== 'oberta' ||
      socLider ||
      minim > saldo;

    // Botó 1 (mínim vigent)
    const b1 = opcions.botons[0];
    const btn1 = $('btn-oferta-1');
    btn1.disabled = bloquejat || !b1?.disponible;
    btn1.dataset.import = b1?.import ?? '';
    $('lbl-oferta-1').textContent = `Oferir ${fmtNum(b1?.import)} ${sessio.moneda}`;
    $('sub-oferta-1').textContent =
      b1 && b1.quedara >= 0
        ? `Si guanyes, et quedaran ${fmtNum(b1.quedara)}`
        : TEXTOS.terminal.saldoInsuficient(minim, saldo);

    // Botó 2 (+1 increment) i Botó 3 (+4 increments)
    const b2 = opcions.botons[1];
    const b3 = opcions.botons[2];
    const btn2 = $('btn-oferta-2');
    const btn3 = $('btn-oferta-3');
    btn2.disabled = bloquejat || !b2?.disponible;
    btn2.dataset.import = b2?.import ?? '';
    btn2.textContent = `Oferir ${fmtNum(b2?.import)}`;

    btn3.disabled = bloquejat || !b3?.disponible;
    btn3.dataset.import = b3?.import ?? '';
    btn3.textContent = `Oferir ${fmtNum(b3?.import)}`;

    // Selector − / + d'increment en increment fins al saldo
    const clauUnitat = `${lic.objecteId}:${lic.unitat}`;
    if (
      estatUI.selectorObjecteKey !== clauUnitat ||
      estatUI.selectorImport === null ||
      estatUI.selectorImport < minim
    ) {
      estatUI.selectorObjecteKey = clauUnitat;
      estatUI.selectorImport = minim;
    }
    if (opcions.maxim !== null && estatUI.selectorImport > opcions.maxim) {
      estatUI.selectorImport = Math.max(minim, opcions.maxim);
    }

    $('out-import-selector').textContent = fmtNum(estatUI.selectorImport);
    $('btn-pas-menys').disabled = bloquejat || estatUI.selectorImport <= minim;
    $('btn-pas-mes').disabled =
      bloquejat || opcions.maxim === null || estatUI.selectorImport + lic.increment > opcions.maxim;

    const btnSel = $('btn-oferta-selector');
    btnSel.disabled = bloquejat || estatUI.selectorImport > saldo;
    btnSel.dataset.import = estatUI.selectorImport;
    btnSel.textContent = `Oferir ${fmtNum(estatUI.selectorImport)}`;
  }

  // Columna dreta: Les meves compres i puntuació
  const resumPunts = calculaPuntuacioParticipant(sessio, objectes, carteraPropia);
  const badgePunts = $('term-punts-badge');
  badgePunts.hidden = !resumPunts.puntuacioActiva;
  if (resumPunts.puntuacioActiva) {
    badgePunts.textContent = `Punts actuals: ${fmtNum(resumPunts.puntsTotals)}`;
  }

  const llistaCompres = $('term-llista-compres');
  const compres = carteraPropia.compres || [];
  // Progrés cap al conjunt complet (una unitat de cada objecte), si dona punts
  const ambConjunt = resumPunts.puntuacioActiva && Number(sessio.bonificacioConjunt) > 0 && objectes.length > 1;
  let htmlConjunt = '';
  if (ambConjunt) {
    const recompte = resumPunts.recomptePerObjecte || {};
    const falten = objectes.filter((o) => !(recompte[o.id] > 0)).map((o) => o.nom);
    const conjunts = resumPunts.conjuntsComplets || 0;
    htmlConjunt = falten.length
      ? `<li class="conjunt-progres"><span>Conjunt complet: <b class="tabular">${objectes.length - falten.length} de ${objectes.length}</b> objectes (+${fmtNum(sessio.bonificacioConjunt)} punts)</span><span>Et falta: ${escHtml(falten.join(', '))}</span></li>`
      : `<li class="conjunt-progres conjunt-fet">${IC.check}<span>Tens ${conjunts} ${conjunts === 1 ? 'conjunt complet' : 'conjunts complets'}: +${fmtNum(conjunts * Number(sessio.bonificacioConjunt))} punts</span></li>`;
  }
  if (!compres.length) {
    llistaCompres.innerHTML = `<li class="compres-buida">${IC.bossa}<span>Encara no has comprat cap unitat.</span></li>${htmlConjunt}`;
  } else {
    llistaCompres.innerHTML =
      objectes
        .filter((o) => compres.some((c) => c.objecteId === o.id))
        .map((o) => {
          const preus = compres.filter((c) => c.objecteId === o.id).map((c) => Number(c.preu));
          return `
        <li class="item-obj-compacte tabular">
          <span class="item-obj-esquerra">
            ${renderIconaSvg(o.icona, o.imatgeDataUrl)}
            <strong>${escHtml(o.nom)} × ${preus.length}</strong>
          </span>
          <span>${preus.map(fmtNum).join(' + ')} ${escHtml(sessio.moneda)}</span>
        </li>`;
        })
        .join('') + htmlConjunt;
  }

  // Catàleg al terminal
  $('term-seguent-obj').textContent = textSeguent(objectes, tauler);
  $('term-llista-cataleg').innerHTML = objectes
    .map((o) => {
      const cat = tauler.cataleg?.[o.id] || { venudes: 0, darrerPreu: null };
      const queden = Math.max(0, Number(o.quantitat) - Number(cat.venudes));
      const enJoc = lic?.objecteId === o.id;
      return `
        <li class="item-obj-compacte tabular ${enJoc ? 'en-joc' : ''} ${queden <= 0 ? 'esgotat' : ''}">
          <span class="item-obj-esquerra">
            ${renderIconaSvg(o.icona, o.imatgeDataUrl)}
            <span>${escHtml(o.nom)}</span>
            ${enJoc ? '<span class="pastilla-en-joc">En joc</span>' : ''}
          </span>
          <span>queden <strong>${queden}</strong>/${o.quantitat} · darrer ${cat.darrerPreu !== null ? fmtNum(cat.darrerPreu) : '—'}</span>
        </li>
      `;
    })
    .join('');
}

/* ============================================================
   12. Vista 8: Resultats finals, gràfic de preus i reflexió (§4 i §7)
   ============================================================ */
function renderResultats(dades) {
  const { sessio, objectes, tauler, carteres, carteraPropia, esOrganitzador } = dades;

  $('res-titol-sessio').textContent = `Resultats · ${sessio.titol}`;
  $('res-accions-organitzador').hidden = !esOrganitzador;

  // Balanç personal si qui ho veu té una cartera de participant
  const blocPersonal = $('res-balanc-personal');
  if (carteraPropia && estatUI.rolActual === 'terminal') {
    blocPersonal.hidden = false;
    const r = calculaPuntuacioParticipant(sessio, objectes, carteraPropia);
    const detallCompres =
      (carteraPropia.compres || []).length > 0
        ? carteraPropia.compres.map((c) => `${escHtml(c.objecteNom)} (${fmtNum(c.preu)})`).join(' · ')
        : 'Cap compra realitzada';

    blocPersonal.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">
        <div>
          <h2>El teu balanç final: ${escHtml(carteraPropia.alies)}</h2>
          <p class="subtext">Compres: <strong>${detallCompres}</strong></p>
        </div>
        <div class="tabular" style="font-size:1.05rem;">
          <span>Gastat: <strong>${fmtNum(r.gastat)}</strong></span> ·
          <span>Saldo sobrant: <strong>${fmtNum(r.saldo)} ${escHtml(sessio.moneda)}</strong></span>
          ${
            r.puntuacioActiva
              ? ` · <strong>Total: ${fmtNum(r.puntsTotals)} punts</strong> (objectes ${fmtNum(r.valorObjectes)} + conjunts ${fmtNum(r.puntsConjunt)} + saldo ${fmtNum(r.saldo)})`
              : ''
          }
        </div>
      </div>
    `;
  } else {
    blocPersonal.hidden = true;
  }

  // Gràfic SVG de preus i taula equivalent
  $('contenedor-grafic-svg').innerHTML = renderGraficPreusSvg(objectes, tauler, sessio.moneda);

  $('tbody-res-objectes').innerHTML = objectes
    .map((o) => {
      const cat = tauler.cataleg?.[o.id] || { venudes: 0, preus: [] };
      const preus = Array.isArray(cat.preus) ? cat.preus : [];
      const mitjana = preus.length
        ? Math.round(preus.reduce((a, b) => a + b, 0) / preus.length)
        : null;
      return `
        <tr>
          <td><strong>${escHtml(o.nom)}</strong></td>
          <td class="col-num tabular">${preus.length} de ${o.quantitat}</td>
          <td class="tabular">${preus.length ? preus.map((p) => fmtNum(p)).join(' → ') : 'Cap unitat venuda'}</td>
          <td class="col-num tabular">${mitjana !== null ? fmtNum(mitjana) : '—'}</td>
        </tr>
      `;
    })
    .join('');

  // Tres preguntes de reflexió (§4)
  $('llista-preguntes-reflexio').innerHTML = TEXTOS.preguntesReflexio
    .map((q) => `<li>${escHtml(q)}</li>`)
    .join('');

  // Balanç dels participants (sense classificació pública per defecte a la projecció §4)
  $('lbl-switch-classificacio').hidden = !esOrganitzador;
  $('check-mostrar-classificacio').checked = Boolean(sessio.mostrarClassificacio);

  const contPart = $('contingut-res-participants');
  const mostrarTaula = esOrganitzador || Boolean(sessio.mostrarClassificacio);

  if (!mostrarTaula) {
    contPart.innerHTML = `<p class="subtext">El balanç individual es manté privat a cada terminal. L’organitzador pot projectar-lo si ho considera oportú per al debat final.</p>`;
  } else {
    const files = (carteres || [])
      .filter((c) => c.habilitada !== false)
      .map((c) => ({
        cartera: c,
        resum: calculaPuntuacioParticipant(sessio, objectes, c)
      }))
      .sort((a, b) => {
        if (a.resum.puntuacioActiva && b.resum.puntuacioActiva) {
          return (b.resum.puntsTotals || 0) - (a.resum.puntsTotals || 0);
        }
        return b.resum.unitatsComprades - a.resum.unitatsComprades;
      });

    if (!files.length) {
      contPart.innerHTML = `<p class="subtext">No hi ha carteres registrades.</p>`;
    } else {
      const mostraPunts = files[0]?.resum?.puntuacioActiva;
      contPart.innerHTML = `
        <table class="taula-resum-objectes tabular">
          <thead>
            <tr>
              <th>Participant</th>
              <th class="col-num">Unitats</th>
              <th class="col-num">Gastat</th>
              <th class="col-num">Saldo</th>
              ${mostraPunts ? '<th class="col-num">Punts</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${files
              .map(
                ({ cartera, resum }) => `
              <tr>
                <td><strong>${escHtml(cartera.alies)}</strong></td>
                <td class="col-num">${resum.unitatsComprades}</td>
                <td class="col-num">${fmtNum(resum.gastat)}</td>
                <td class="col-num">${fmtNum(resum.saldo)}</td>
                ${mostraPunts ? `<td class="col-num"><strong>${fmtNum(resum.puntsTotals)}</strong></td>` : ''}
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    }
  }
}

function renderGraficPreusSvg(objectes, tauler, moneda) {
  const colors = ['#0c6356', '#c2491d', '#1754c6', '#b45309', '#7c3aed', '#be185d'];
  let maxUnitats = 1;
  let maxPreu = 10;
  let hiHaVendes = false;

  for (const o of objectes) {
    const preus = tauler.cataleg?.[o.id]?.preus || [];
    if (preus.length > 0) hiHaVendes = true;
    maxUnitats = Math.max(maxUnitats, preus.length, o.quantitat);
    for (const p of preus) {
      if (p > maxPreu) maxPreu = p;
    }
  }

  if (!hiHaVendes) {
    return `<div style="height:100%;display:flex;align-items:center;justify-content:center;" class="subtext">Encara no s’ha adjudicat cap unitat en aquesta ronda.</div>`;
  }

  const W = 680;
  const H = 225;
  const padL = 56;
  const padR = 24;
  const padT = 22;
  const padB = 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xOf = (uIdx) =>
    maxUnitats <= 1 ? padL + plotW / 2 : padL + (uIdx / (maxUnitats - 1)) * plotW;
  // Escala amb valors rodons (0, 20, 40, 60…) en lloc de terços del màxim
  const brut = (maxPreu * 1.05) / 4;
  const pot = 10 ** Math.max(0, Math.floor(Math.log10(brut)));
  const pas = [1, 2, 5, 10].map((f) => f * pot).find((v) => v >= brut) || 10 * pot;
  const sostre = Math.ceil((maxPreu * 1.05) / pas) * pas;
  const yOf = (preu) => padT + plotH - (preu / sostre) * plotH;

  let linies = '';
  let llegenda = '';

  // Eixos horitzontals guia
  for (let val = 0; val <= sostre + 1e-9; val += pas) {
    const y = Math.round(yOf(val));
    linies += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="currentColor" stroke-opacity="0.14" stroke-dasharray="3 3"/>`;
    linies += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="currentColor" opacity="0.7">${fmtNum(val)}</text>`;
  }

  // Etiquetes d'unitats X
  for (let u = 0; u < maxUnitats; u++) {
    const x = Math.round(xOf(u));
    linies += `<text x="${x}" y="${H - 12}" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.8">Unitat ${u + 1}</text>`;
  }

  let posLlegenda = 0;
  objectes.forEach((o, idx) => {
    const preus = tauler.cataleg?.[o.id]?.preus || [];
    if (!preus.length) return;
    const col = colors[idx % colors.length];
    const pts = preus.map((p, uIdx) => `${Math.round(xOf(uIdx))},${Math.round(yOf(p))}`).join(' ');
    if (preus.length > 1) {
      linies += `<polyline fill="none" stroke="${col}" stroke-width="3" points="${pts}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    preus.forEach((p, uIdx) => {
      const cx = Math.round(xOf(uIdx));
      const cy = Math.round(yOf(p));
      linies += `<circle cx="${cx}" cy="${cy}" r="5" fill="${col}" stroke="#fff" stroke-width="1.5"><title>${escHtml(o.nom)} · Unitat ${uIdx + 1}: ${fmtNum(p)} ${escHtml(moneda)}</title></circle>`;
    });

    const lx = padL + posLlegenda * 125;
    posLlegenda += 1;
    if (lx < W - 70) {
      llegenda += `<g transform="translate(${lx}, 12)">
        <circle cx="0" cy="-4" r="4.5" fill="${col}"/>
        <text x="8" y="0" font-size="11.5" font-weight="700" fill="currentColor">${escHtml(o.nom)}</text>
      </g>`;
    }
  });

  return `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${llegenda}
      ${linies}
    </svg>
  `;
}

/* ============================================================
   13. Modals auxiliars i descarregador de CSV
   ============================================================ */
function obreModalAccio({ titol, htmlCos, textConfirmar = 'Confirma', classeBtn = 'btn-primari', onConfirm }) {
  const modal = $('modal-accio');
  $('titol-modal-accio').textContent = titol;
  $('cos-modal-accio').innerHTML = htmlCos;
  $('peu-modal-accio').innerHTML = `
    <button type="button" class="btn btn-suau" id="btn-modal-cancel">Cancel·la</button>
    ${onConfirm ? `<button type="button" class="btn ${classeBtn}" id="btn-modal-ok">${escHtml(textConfirmar)}</button>` : ''}
  `;
  $('btn-modal-cancel').onclick = () => modal.close();
  if (onConfirm) {
    $('btn-modal-ok').onclick = async () => {
      await onConfirm();
      modal.close();
    };
  }
  modal.showModal();
}

function descarregaFitxerText(contingut, nomFitxer, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([contingut], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFitxer;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function copiaTextAlPortapapers(text, btnFeedback = null) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  if (btnFeedback) {
    const prev = btnFeedback.innerHTML;
    btnFeedback.textContent = 'Enllaç copiat ✓';
    setTimeout(() => {
      btnFeedback.innerHTML = prev;
    }, 1800);
  }
}

/* ============================================================
   14. Fluxos de connexió i sincronització de la sessió
   ============================================================ */
async function obreSessioComOrganitzador(sessioId, forcarVista = null) {
  estatUI.sessioId = sessioId;
  estatUI.rolActual = 'organitzador';

  await gestor.subscriuSessio(sessioId, 'organitzador', (dades) => {
    estatUI.dades = dades;
    const est = dades.sessio.estat;

    if (estatUI.vistaActual === 'projeccio') {
      if (est === 'finalitzada') {
        mostraVista('resultats');
        renderResultats(dades);
      } else {
        renderProjeccio(dades);
      }
      return;
    }

    const vistaDesti =
      forcarVista ||
      (est === 'preparacio'
        ? 'preparacio'
        : est === 'espera'
          ? 'espera'
          : est === 'finalitzada'
            ? 'resultats'
            : 'comandament');

    forcarVista = null;

    if (vistaDesti === 'preparacio') {
      if (estatUI.vistaActual !== 'preparacio') {
        mostraVista('preparacio');
        carregaPreparacioAFormulario(dades);
      }
    } else if (vistaDesti === 'espera') {
      mostraVista('espera');
      renderSalaEspera(dades);
    } else if (vistaDesti === 'comandament') {
      mostraVista('comandament');
      renderComandament(dades);
    } else if (vistaDesti === 'resultats') {
      mostraVista('resultats');
      renderResultats(dades);
    }
  });
}

async function obreSessioComProjeccio(sessioId) {
  estatUI.sessioId = sessioId;
  estatUI.rolActual = 'projeccio';

  await gestor.subscriuSessio(sessioId, 'projeccio', (dades) => {
    estatUI.dades = dades;
    if (dades.sessio.estat === 'finalitzada') {
      mostraVista('resultats');
      renderResultats(dades);
    } else {
      mostraVista('projeccio');
      renderProjeccio(dades);
    }
  });
}

async function obreSessioComTerminal(sessioId) {
  estatUI.sessioId = sessioId;
  estatUI.rolActual = 'terminal';

  await gestor.subscriuSessio(sessioId, 'terminal', (dades) => {
    estatUI.dades = dades;
    if (dades.sessio.estat === 'finalitzada') {
      mostraVista('resultats');
      renderResultats(dades);
    } else {
      mostraVista('terminal');
      renderTerminal(dades);
    }
  });
}

/* ============================================================
   15. Inicialització d'esdeveniments i drecera d'URL
   ============================================================ */
function inicialitzaEsdeveniments() {
  window.addEventListener('resize', ajustaEscalaPantalla);
  document.addEventListener('visibilitychange', actualitzaWakeLock);
  window.addEventListener('online', () => {
    $('baner-connexio').hidden = true;
    if (estatUI.dades && estatUI.vistaActual === 'terminal') renderTerminal(estatUI.dades);
  });
  window.addEventListener('offline', () => {
    $('baner-connexio').hidden = false;
    if (estatUI.dades && estatUI.vistaActual === 'terminal') renderTerminal(estatUI.dades);
  });

  // Glossari al modal de Guia
  $('modal-dl-glossari').innerHTML = TEXTOS.glossari
    .map((g) => `<div><dt>${escHtml(g.terme)}</dt><dd>${escHtml(g.definicio)}</dd></div>`)
    .join('');

  // Tema visual guardat
  const temaGuardat = localStorage.getItem(STORAGE_KEYS.TEMA) || 'mercat';
  aplicaTema(temaGuardat);

  document.querySelectorAll('.btn-tema').forEach((btn) => {
    btn.addEventListener('click', () => aplicaTema(btn.dataset.tema));
  });

  // Botó so de martell a la projecció
  const actualitzaBotoMartell = () => {
    const act = soMartell.activat;
    const btn = $('btn-so-martell');
    btn.setAttribute('aria-pressed', act ? 'true' : 'false');
    btn.querySelector('.ic-so-on').hidden = !act;
    btn.querySelector('.ic-so-off').hidden = act;
  };
  actualitzaBotoMartell();
  $('btn-so-martell').addEventListener('click', () => {
    soMartell.commuta();
    actualitzaBotoMartell();
  });

  // Modal guia
  $('btn-guia').addEventListener('click', () => $('modal-guia').showModal());
  document.querySelectorAll('[data-tanca]').forEach((btn) => {
    btn.addEventListener('click', () => $(btn.dataset.tanca)?.close());
  });

  // Tornar a portada
  const tornaPortada = () => {
    gestor.desconnecta();
    estatUI.sessioId = null;
    estatUI.dades = null;
    mostraVista('inici');
    actualitzaPortada();
  };
  $('btn-inici').addEventListener('click', tornaPortada);
  $('btn-sortir').addEventListener('click', tornaPortada);
  $('btn-descarta-reprendre').addEventListener('click', () => {
    $('barra-reprendre').hidden = true;
  });

  // Copiar enllaç d'entrada
  const copiaEnllacSalaActual = (btn) => {
    const codi = estatUI.dades?.sessio?.codi;
    if (!codi) return;
    const url = `${window.location.origin}${window.location.pathname}?codi=${codi}`;
    copiaTextAlPortapapers(url, btn);
  };
  $('btn-copia-codi-top').addEventListener('click', (e) => copiaEnllacSalaActual(e.currentTarget));
  $('btn-copia-classroom').addEventListener('click', (e) => copiaEnllacSalaActual(e.currentTarget));

  // Commutació entre Comandament i Projecció
  $('btn-nav-comandament').addEventListener('click', () => {
    if (!estatUI.dades) return;
    const est = estatUI.dades.sessio.estat;
    if (est === 'preparacio') {
      mostraVista('preparacio');
      carregaPreparacioAFormulario(estatUI.dades);
    } else if (est === 'espera') {
      mostraVista('espera');
      renderSalaEspera(estatUI.dades);
    } else if (est === 'finalitzada') {
      mostraVista('resultats');
      renderResultats(estatUI.dades);
    } else {
      mostraVista('comandament');
      renderComandament(estatUI.dades);
    }
  });

  $('btn-nav-projeccio').addEventListener('click', () => {
    if (!estatUI.dades) return;
    mostraVista('projeccio');
    renderProjeccio(estatUI.dades);
  });

  const obreFinestraProjeccio = () => {
    const codi = estatUI.dades?.sessio?.codi;
    if (!codi) return;
    const url = `${window.location.origin}${window.location.pathname}?vista=projeccio&codi=${codi}`;
    window.open(url, '_blank', 'noopener');
  };
  $('btn-nav-finestra-projeccio').addEventListener('click', obreFinestraProjeccio);
  $('btn-espera-projeccio').addEventListener('click', () => {
    if (!estatUI.dades) return;
    mostraVista('projeccio');
    renderProjeccio(estatUI.dades);
  });

  // Format del codi de sala mentre s'escriu (majúscules, sense espais)
  $('input-codi-sala').addEventListener('input', (e) => {
    const net = normalitzaCodiSala(e.target.value);
    e.target.value = formatCodiSala(net);
  });

  // Entrar com a participant
  $('form-entrar-participant').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('error-inici-entrar');
    errEl.hidden = true;
    try {
      const codi = $('input-codi-sala').value;
      const alies = $('input-alies-participant').value;
      const res = await gestor.entraParticipant(codi, alies);
      await obreSessioComTerminal(res.sessioId);
    } catch (err) {
      errEl.textContent = err.message || 'No s’ha pogut entrar a la sala.';
      errEl.hidden = false;
    }
  });

  // Obrir projecció pública des de portada
  $('btn-entrar-projeccio').addEventListener('click', async () => {
    const errEl = $('error-inici-entrar');
    errEl.hidden = true;
    try {
      const codi = $('input-codi-sala').value;
      const sessioId = await gestor.resolCodiSala(codi);
      await obreSessioComProjeccio(sessioId);
    } catch (err) {
      errEl.textContent = err.message || 'Escriu un codi de sala vàlid (4 caràcters) per obrir la projecció.';
      errEl.hidden = false;
    }
  });

  // Canvi d'aparell amb codi de 4 xifres
  $('btn-mostra-canvi-aparell').addEventListener('click', () => {
    const form = $('form-canvi-aparell');
    form.hidden = !form.hidden;
    $('btn-mostra-canvi-aparell').setAttribute('aria-expanded', form.hidden ? 'false' : 'true');
  });

  $('form-canvi-aparell').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('error-inici-entrar');
    errEl.hidden = true;
    try {
      const codiSala = $('input-codi-sala').value;
      const codi4 = $('input-codi-canvi').value;
      const res = await gestor.recuperaAmbCodiCanvi(codiSala, codi4);
      await obreSessioComTerminal(res.sessioId);
    } catch (err) {
      errEl.textContent = err.message || 'No s’ha pogut recuperar la cartera.';
      errEl.hidden = false;
    }
  });

  // Accions d'organitzador a la portada
  $('btn-nova-subhasta').addEventListener('click', () => obreModalModels('crear'));

  $('btn-assaig-rapid').addEventListener('click', async () => {
    const sessio = await gestor.creaSubhasta(EXEMPLE_MERCAT_INDUSTRIAL, 'en_curs');
    await gestor.afegeixParticipantsSimulats(sessio.id, 8);
    await gestor.obreUnitat(sessio.id, EXEMPLE_MERCAT_INDUSTRIAL.objectes[0].id);
    gestor.iniciaSimuladorOfertes(sessio.id, 1300);
    await obreSessioComOrganitzador(sessio.id, 'comandament');
  });

  $('btn-les-meves-subhastes').addEventListener('click', async () => {
    mostraVista('llista');
    await renderLlistaMevesSubhastes();
  });

  $('btn-identifica-google').addEventListener('click', async () => {
    const btn = $('btn-identifica-google');
    btn.disabled = true;
    try {
      if (getCorreuOrganitzador()) {
        await gestor.desvinculaGoogle();
      } else {
        await gestor.vinculaGoogle();
      }
    } catch (err) {
      const codi = err?.code || '';
      if (codi !== 'auth/popup-closed-by-user' && codi !== 'auth/cancelled-popup-request') {
        obreModalAccio({
          titol: 'Vinculació amb Google',
          htmlCos: `<p>${escHtml(
            codi === 'auth/popup-blocked'
              ? 'El navegador ha blocat la finestra de Google. Permet les finestres emergents d’aquesta pàgina i torna-ho a provar.'
              : 'No s’ha pogut vincular amb Google. Pots continuar sense: les teves subhastes es desen en aquest navegador.'
          )}</p>`,
          textConfirmar: 'D’acord',
          onConfirm: () => {}
        });
      }
    } finally {
      btn.disabled = false;
      actualitzaPortada();
    }
  });

  // Vista 2: Les meves subhastes
  $('btn-llista-tornar').addEventListener('click', tornaPortada);
  $('btn-llista-nova').addEventListener('click', () => obreModalModels('crear'));

  // Finestra de models i configuracions desades
  $('modal-models').addEventListener('click', async (e) => {
    const bModel = e.target.closest('[data-model]');
    if (bModel) {
      const model = MODELS.find((m) => m.id === bModel.dataset.model);
      if (model) await aplicaConfigEscollida(model.config);
      return;
    }
    const bConfig = e.target.closest('[data-config]');
    if (bConfig) {
      const c = estatUI.configsDesades.find((x) => x.id === bConfig.dataset.config);
      if (c) await aplicaConfigEscollida(c.cfg, c.id);
      return;
    }
    const bElimina = e.target.closest('[data-elimina-config]');
    if (bElimina) {
      const c = estatUI.configsDesades.find((x) => x.id === bElimina.dataset.eliminaConfig);
      if (!c) return;
      obreModalAccio({
        titol: 'Elimina la configuració',
        htmlCos: `<p>Segur que vols eliminar la configuració «${escHtml(c.nom)}»? Les subhastes que ja has fet amb ella no canvien.</p>`,
        textConfirmar: 'Sí, elimina-la',
        classeBtn: 'btn-perill-suau',
        onConfirm: async () => {
          await gestor.eliminaConfiguracio(c.id);
          estatUI.configsDesades = estatUI.configsDesades.filter((x) => x.id !== c.id);
          renderModalModels();
        }
      });
    }
  });

  $('contenedor-llista-sessions').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-accio-llista]');
    if (!btn) return;
    const accio = btn.dataset.accioLlista;
    const id = btn.dataset.id;

    if (accio === 'obrir') {
      await obreSessioComOrganitzador(id);
    } else if (accio === 'projeccio') {
      await obreSessioComProjeccio(id);
    } else if (accio === 'duplicar') {
      await gestor.duplicaSessio(id);
      await renderLlistaMevesSubhastes();
    } else if (accio === 'csv') {
      await obreSessioComOrganitzador(id, 'resultats');
    } else if (accio === 'eliminar') {
      obreModalAccio({
        titol: 'Elimina la subhasta',
        htmlCos: '<p>Segur que vols eliminar definitivament aquesta subhasta i totes les seves dades?</p>',
        textConfirmar: 'Sí, elimina-la',
        classeBtn: 'btn-perill-suau',
        onConfirm: async () => {
          await gestor.eliminaSessio(id);
          await renderLlistaMevesSubhastes();
        }
      });
    }
  });

  // Vista 3: Preparació
  const programaAutoDesament = () => {
    clearTimeout(estatUI.desantTimer);
    estatUI.desantTimer = setTimeout(() => validaIDesaPreparacio(true), 250);
  };

  ['prep-titol', 'prep-pressupost', 'prep-increment', 'prep-moneda', 'prep-repte', 'prep-bonificacio-conjunt'].forEach(
    (id) => {
      $(id).addEventListener('input', programaAutoDesament);
    }
  );

  $('prep-puntuacio-activa').addEventListener('change', (e) => {
    estatUI.esborranyPrep.puntuacioActiva = e.target.checked;
    $('bloc-bonificacio-conjunt').hidden = !e.target.checked;
    $('th-valor-punts').hidden = !e.target.checked;
    renderFilesObjectesPreparacio();
    validaIDesaPreparacio(true);
  });

  $('tbody-prep-objectes').addEventListener('input', programaAutoDesament);
  $('tbody-prep-objectes').addEventListener('change', async (e) => {
    if (e.target.classList.contains('sel-icona-obj')) {
      const idx = Number(e.target.dataset.idx);
      const obj = estatUI.esborranyPrep.objectes[idx];
      if (obj) {
        obj.icona = e.target.value;
        obj.imatgeDataUrl = null;
        renderFilesObjectesPreparacio();
        validaIDesaPreparacio(true);
      }
    } else if (e.target.classList.contains('input-foto-obj')) {
      const idx = Number(e.target.dataset.idx);
      const file = e.target.files?.[0];
      if (file && estatUI.esborranyPrep.objectes[idx]) {
        try {
          const dataUrl = await redueixImatgeAlNavegador(file);
          estatUI.esborranyPrep.objectes[idx].imatgeDataUrl = dataUrl;
          renderFilesObjectesPreparacio();
          validaIDesaPreparacio(true);
        } catch (_) {}
      }
    }
  });

  $('tbody-prep-objectes').addEventListener('click', (e) => {
    const btnPas = e.target.closest('[data-pas-unitats]');
    if (btnPas) {
      const inp = btnPas.parentElement.querySelector('.inp-obj-quantitat');
      const nou = Math.min(LIMITS.MAX_UNITATS_TOTALS, Math.max(1, (Number(inp.value) || 0) + Number(btnPas.dataset.pasUnitats)));
      inp.value = String(nou);
      programaAutoDesament();
      return;
    }
    const btnDel = e.target.closest('.btn-eliminar-obj');
    if (!btnDel) return;
    const idx = Number(btnDel.dataset.idx);
    if (estatUI.esborranyPrep.objectes.length <= 1) return;
    estatUI.esborranyPrep.objectes.splice(idx, 1);
    renderFilesObjectesPreparacio();
    validaIDesaPreparacio(true);
  });

  $('btn-afegir-objecte').addEventListener('click', () => {
    llegeixEsborranyDelDom();
    const esb = estatUI.esborranyPrep;
    if (esb.objectes.length >= LIMITS.MAX_OBJECTES) return;
    const clausIcones = Object.keys(ICONES);
    const icona = clausIcones[esb.objectes.length % clausIcones.length];
    esb.objectes.push({
      id: `obj_${Date.now()}_${esb.objectes.length + 1}`,
      nom: `Objecte ${esb.objectes.length + 1}`,
      descripcio: '',
      icona,
      imatgeDataUrl: null,
      quantitat: 2,
      preuSortida: esb.increment || 10,
      valor: 100
    });
    renderFilesObjectesPreparacio();
    validaIDesaPreparacio(true);
  });

  $('btn-canvia-model').addEventListener('click', () => obreModalModels('substituir'));
  $('btn-desa-config').addEventListener('click', obreDesaConfiguracio);

  // Equips previstos: es recorda en aquest navegador i recalcula la recomanació
  try {
    const desats = Number(localStorage.getItem(STORAGE_KEYS.EQUIPS_PREVISTOS));
    if (desats >= 2 && desats <= 40) $('prep-equips').value = String(desats);
  } catch (_) {}
  const canviaEquips = (delta = 0) => {
    $('prep-equips').value = String(Math.min(40, Math.max(2, equipsPrevistos() + delta)));
    try {
      localStorage.setItem(STORAGE_KEYS.EQUIPS_PREVISTOS, $('prep-equips').value);
    } catch (_) {}
    actualitzaRecomanacioUnitats();
  };
  $('btn-equips-menys').addEventListener('click', () => canviaEquips(-1));
  $('btn-equips-mes').addEventListener('click', () => canviaEquips(1));
  $('prep-equips').addEventListener('change', () => canviaEquips(0));
  $('prep-equips').addEventListener('input', actualitzaRecomanacioUnitats);

  $('btn-ajusta-unitats').addEventListener('click', () => {
    llegeixEsborranyDelDom();
    const recomanat = Number($('btn-ajusta-unitats').dataset.recomanat) || 1;
    estatUI.esborranyPrep.objectes.forEach((o) => {
      o.quantitat = recomanat;
    });
    renderFilesObjectesPreparacio();
    validaIDesaPreparacio(true);
  });

  $('btn-anar-sala-espera').addEventListener('click', async () => {
    const ok = await validaIDesaPreparacio(true);
    if (!ok || !estatUI.sessioId) return;
    await gestor.obreSalaEspera(estatUI.sessioId);
  });

  // Vista 4: Sala d'espera
  $('check-inscripcions-espera').addEventListener('change', (e) => {
    if (estatUI.sessioId) gestor.commutaInscripcions(estatUI.sessioId, e.target.checked);
  });

  $('btn-sim-afegir-6').addEventListener('click', () => {
    if (estatUI.sessioId) gestor.afegeixParticipantsSimulats(estatUI.sessioId, 6);
  });

  $('btn-sim-afegir-40').addEventListener('click', () => {
    if (estatUI.sessioId) gestor.afegeixParticipantsSimulats(estatUI.sessioId, 40);
  });

  $('btn-tornar-preparacio').addEventListener('click', () => {
    if (!estatUI.dades) return;
    mostraVista('preparacio');
    carregaPreparacioAFormulario(estatUI.dades);
  });

  $('btn-comencar-subhasta').addEventListener('click', async () => {
    if (!estatUI.sessioId) return;
    await gestor.comencaSubhasta(estatUI.sessioId, false);
  });

  // Accions sobre participants (Sala d'espera i Comandament)
  const gestionaClickParticipant = async (e) => {
    const btn = e.target.closest('[data-accio-part]');
    if (!btn || !estatUI.sessioId) return;
    const accio = btn.dataset.accioPart;
    const uid = btn.dataset.uid;
    const alies = btn.dataset.alies;

    if (accio === 'renomena') {
      obreModalAccio({
        titol: `Canvia l’àlies de ${alies}`,
        htmlCos: `
          <div class="camp-grup">
            <label for="inp-nou-alies">Nou àlies (màxim 24 caràcters)</label>
            <input id="inp-nou-alies" type="text" maxlength="24" value="${escHtml(alies)}">
          </div>
        `,
        textConfirmar: 'Desa el nom',
        onConfirm: async () => {
          const nou = $('inp-nou-alies')?.value;
          if (nou) await gestor.canviaAliesParticipant(estatUI.sessioId, uid, nou);
        }
      });
    } else if (accio === 'treu') {
      obreModalAccio({
        titol: `Treu ${alies} de la sessió`,
        htmlCos: `<p>Segur que vols desactivar la participació de <strong>${escHtml(alies)}</strong>?</p>`,
        textConfirmar: 'Treu de la sala',
        classeBtn: 'btn-perill-suau',
        onConfirm: async () => {
          await gestor.treuParticipant(estatUI.sessioId, uid);
        }
      });
    } else if (accio === 'canvi-aparell') {
      const info = await gestor.generaCodiCanviAparell(estatUI.sessioId, uid);
      obreModalAccio({
        titol: `Canvi d’aparell per a ${info.alies}`,
        htmlCos: `
          <p>En el portàtil o Chromebook nou, entra el codi de la sala (<strong>${formatCodiSala(estatUI.dades.sessio.codi)}</strong>), obre «Tinc un codi de canvi d’aparell» i escriu aquest codi de 4 xifres:</p>
          <div style="text-align:center;margin:0.8rem 0;padding:0.8rem;background:var(--surface-soft);border-radius:12px;">
            <strong class="tabular" style="font-size:2.4rem;letter-spacing:0.12em;color:var(--primary);">${info.codi}</strong>
            <div class="subtext">Vàlid durant 5 minuts. La cartera passarà sencera i l’aparell antic perdrà l’accés.</div>
          </div>
        `,
        textConfirmar: 'Entesos'
      });
    }
  };
  $('llista-participants-espera').addEventListener('click', gestionaClickParticipant);
  $('llista-carteres-comandament').addEventListener('click', gestionaClickParticipant);

  // Vista 5: Comandament de l'organitzador
  $('targeta-control-directe').addEventListener('click', async (e) => {
    const sessioId = estatUI.sessioId;
    if (!sessioId) return;

    const btnObrir = e.target.closest('#btn-cmd-accio-principal');
    if (btnObrir) {
      await gestor.obreUnitat(sessioId, btnObrir.dataset.obrirId);
      return;
    }
    if (e.target.closest('#btn-cmd-aturar')) {
      await gestor.aturaOfertes(sessioId);
      return;
    }
    if (e.target.closest('#btn-cmd-reprendre')) {
      await gestor.reprenOfertes(sessioId);
      return;
    }
    const btnAdj = e.target.closest('#btn-cmd-adjudicar');
    if (btnAdj) {
      btnAdj.disabled = true;
      await gestor.adjudicaUnitat(sessioId, btnAdj.dataset.lider, Number(btnAdj.dataset.import));
      return;
    }
    const btnRet = e.target.closest('#btn-cmd-retirar');
    if (btnRet) {
      if (btnRet.dataset.teOferta === '1') {
        obreModalAccio({
          titol: 'Retira la unitat sense vendre',
          htmlCos: '<p>Aquesta unitat ja té ofertes. Si la retires, no es carregarà cap import i la unitat continuarà disponible al catàleg. Vols retirar-la?</p>',
          textConfirmar: 'Sí, retira-la sense vendre',
          onConfirm: () => gestor.retiraUnitat(sessioId)
        });
      } else {
        await gestor.retiraUnitat(sessioId);
      }
      return;
    }
    if (e.target.closest('#btn-cmd-finalitzar-directe')) {
      await gestor.finalitzaSessio(sessioId);
    }
  });

  $('graella-cataleg-comandament').addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-obrir-obj-cataleg');
    if (!btn || !estatUI.sessioId) return;
    await gestor.obreUnitat(estatUI.sessioId, btn.dataset.objId);
  });

  $('btn-cmd-desfer').addEventListener('click', () => {
    if (!estatUI.sessioId || !estatUI.dades?.tauler?.ultimaAdjudicacio) return;
    const u = estatUI.dades.tauler.ultimaAdjudicacio;
    obreModalAccio({
      titol: 'Desfés l’última adjudicació',
      htmlCos: `<p>Es retornarà l’import de <strong>${fmtNum(u.preu)} ${escHtml(estatUI.dades.sessio.moneda)}</strong> a <strong>${escHtml(u.compradorAlies)}</strong> i la unitat de <strong>${escHtml(u.objecteNom)}</strong> tornarà a estar disponible.</p>`,
      textConfirmar: 'Desfés l’adjudicació',
      onConfirm: () => gestor.desfesUltimaAdjudicacio(estatUI.sessioId)
    });
  });

  const demanaTornarAComencar = () => {
    if (!estatUI.sessioId) return;
    obreModalAccio({
      titol: 'Tornar a començar (nova ronda)',
      htmlCos: '<p>Es posaran a zero les despeses, les compres i les vendes del catàleg, es conservaran tots els participants i es tornarà a la sala d’espera amb una ronda nova. Les adjudicacions d’aquesta ronda es conservaran al CSV.</p>',
      textConfirmar: 'Inicia una ronda nova',
      onConfirm: () => gestor.tornaAComencar(estatUI.sessioId)
    });
  };
  $('btn-cmd-reiniciar').addEventListener('click', demanaTornarAComencar);
  $('btn-res-nova-ronda').addEventListener('click', demanaTornarAComencar);

  $('btn-cmd-finalitzar').addEventListener('click', () => {
    if (!estatUI.sessioId) return;
    obreModalAccio({
      titol: 'Finalitza la subhasta',
      htmlCos: '<p>Finalitzar la subhasta és definitiu per a aquesta ronda i mostrarà els resultats finals i el gràfic de preus a totes les pantalles. Vols continuar?</p>',
      textConfirmar: 'Finalitza la subhasta',
      onConfirm: () => gestor.finalitzaSessio(estatUI.sessioId)
    });
  });

  $('check-inscripcions-cmd').addEventListener('change', (e) => {
    if (estatUI.sessioId) gestor.commutaInscripcions(estatUI.sessioId, e.target.checked);
  });

  $('check-sim-actiu').addEventListener('change', (e) => {
    if (!estatUI.sessioId) return;
    if (e.target.checked) gestor.iniciaSimuladorOfertes(estatUI.sessioId, 1150);
    else gestor.aturaSimulador();
  });

  $('btn-cmd-afegir-bots').addEventListener('click', () => {
    if (estatUI.sessioId) gestor.afegeixParticipantsSimulats(estatUI.sessioId, 5);
  });

  // Mode de presentació a la vista de projecció (§6)
  $('btn-proj-mode-presentacio').addEventListener('click', () => {
    estatUI.modePresentacio = !estatUI.modePresentacio;
    if (estatUI.dades) renderProjeccio(estatUI.dades);
  });

  $('barra-mode-presentacio').addEventListener('click', async (e) => {
    const sId = estatUI.sessioId;
    if (!sId) return;
    const bObrir = e.target.closest('#btn-pres-obrir');
    if (bObrir) return gestor.obreUnitat(sId, bObrir.dataset.id);
    if (e.target.closest('#btn-pres-aturar')) return gestor.aturaOfertes(sId);
    if (e.target.closest('#btn-pres-reprendre')) return gestor.reprenOfertes(sId);
    if (e.target.closest('#btn-pres-retirar')) return gestor.retiraUnitat(sId);
    if (e.target.closest('#btn-pres-desfer')) return gestor.desfesUltimaAdjudicacio(sId);
    if (e.target.closest('#btn-pres-finalitzar')) return gestor.finalitzaSessio(sId);
    const bAdj = e.target.closest('#btn-pres-adjudicar');
    if (bAdj) return gestor.adjudicaUnitat(sId, bAdj.dataset.lider, Number(bAdj.dataset.import));
    if (e.target.closest('#btn-pres-participants')) {
      obreModalAccio({
        titol: 'Avís de pantalla projectada',
        htmlCos: '<p>Si obres el llistat de participants i saldos, es veurà a la projecció pública de l’aula. Vols continuar al Comandament?</p>',
        textConfirmar: 'Obre el Comandament',
        onConfirm: () => {
          mostraVista('comandament');
          renderComandament(estatUI.dades);
        }
      });
    }
  });

  // Vista 7: Terminal del participant — Fixar import en començar la pulsació (§7)
  const fixaContextOferta = (btn) => {
    const lic = estatUI.dades?.tauler?.licitacio;
    if (!lic) return;
    estatUI.contextOfertaFixat = {
      objecteId: lic.objecteId,
      unitat: lic.unitat,
      importFixat: Number(btn.dataset.import)
    };
  };

  const executaOfertaBotons = async (btn) => {
    if (!estatUI.sessioId || !estatUI.dades?.tauler?.licitacio) return;
    const imp = Number(btn.dataset.import);
    if (!imp || Number.isNaN(imp)) return;

    const ctxFixat = estatUI.contextOfertaFixat || {
      objecteId: estatUI.dades.tauler.licitacio.objecteId,
      unitat: estatUI.dades.tauler.licitacio.unitat
    };

    estatUI.enviantOferta = imp;
    estatUI.missatgeTerminalFix = null;
    renderTerminal(estatUI.dades);

    const res = await gestor.enviaOferta(estatUI.sessioId, imp, ctxFixat);
    estatUI.enviantOferta = false;
    estatUI.contextOfertaFixat = null;

    if (!res.ok) {
      estatUI.missatgeTerminalFix = res.missatge;
    } else {
      estatUI.missatgeTerminalFix = null;
      const licAct = estatUI.dades?.tauler?.licitacio;
      if (licAct) estatUI.unitatsAmbOfertaMeva.add(`${estatUI.sessioId}:${licAct.objecteId}:${licAct.unitat}:${estatUI.dades?.sessio?.ronda || 1}`);
    }
    if (estatUI.dades) renderTerminal(estatUI.dades);
  };

  ['btn-oferta-1', 'btn-oferta-2', 'btn-oferta-3', 'btn-oferta-selector'].forEach((id) => {
    const btn = $(id);
    btn.addEventListener('pointerdown', () => fixaContextOferta(btn));
    btn.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') fixaContextOferta(btn);
    });
    btn.addEventListener('click', () => executaOfertaBotons(btn));
  });

  $('btn-pas-menys').addEventListener('click', () => {
    const lic = estatUI.dades?.tauler?.licitacio;
    if (!lic) return;
    const minim = calculaMinimOferta(lic);
    estatUI.selectorImport = Math.max(minim, (estatUI.selectorImport || minim) - lic.increment);
    renderTerminal(estatUI.dades);
  });

  $('btn-pas-mes').addEventListener('click', () => {
    const lic = estatUI.dades?.tauler?.licitacio;
    const c = estatUI.dades?.carteraPropia;
    if (!lic || !c) return;
    const saldo = Number(estatUI.dades.sessio.pressupost) - Number(c.gastat);
    const candidat = (estatUI.selectorImport || calculaMinimOferta(lic)) + lic.increment;
    if (candidat <= saldo) {
      estatUI.selectorImport = candidat;
      renderTerminal(estatUI.dades);
    }
  });

  // Vista 8: Resultats i exportació CSV
  $('btn-csv-participants').addEventListener('click', () => {
    if (!estatUI.dades) return;
    const { sessio, objectes, carteres } = estatUI.dades;
    const csv = generaCsvParticipants(sessio, objectes, carteres);
    descarregaFitxerText(csv, `subhasta-${sessio.codi}-participants.csv`);
  });

  $('btn-csv-adjudicacions').addEventListener('click', () => {
    if (!estatUI.dades) return;
    const { sessio, adjudicacions } = estatUI.dades;
    const csv = generaCsvAdjudicacions(adjudicacions);
    descarregaFitxerText(csv, `subhasta-${sessio.codi}-adjudicacions.csv`);
  });

  $('btn-res-duplicar').addEventListener('click', async () => {
    if (!estatUI.sessioId) return;
    const nova = await gestor.duplicaSessio(estatUI.sessioId);
    await obreSessioComOrganitzador(nova.id, 'preparacio');
  });

  $('check-mostrar-classificacio').addEventListener('change', (e) => {
    if (estatUI.sessioId) gestor.commutaClassificacioPublica(estatUI.sessioId, e.target.checked);
  });
}

async function arrencaApp() {
  inicialitzaEsdeveniments();
  ajustaEscalaPantalla();
  // Identitat anònima de Firebase (qui crea una subhasta n'és el propietari)
  await preparaIdentitat(6000);

  // Comprova paràmetres d'URL immediatament (?codi=K7QM o ?vista=projeccio&codi=K7QM)
  const params = new URLSearchParams(window.location.search);
  const codiParam = normalitzaCodiSala(params.get('codi') || '');
  const vistaParam = params.get('vista');

  if (esCodiSalaComplet(codiParam)) {
    $('input-codi-sala').value = formatCodiSala(codiParam);
    if (vistaParam === 'projeccio') {
      try {
        const sId = await gestor.resolCodiSala(codiParam);
        await obreSessioComProjeccio(sId);
        return;
      } catch (_) {}
    } else {
      $('input-alies-participant').focus();
    }
  }

  actualitzaPortada();
}

arrencaApp();
