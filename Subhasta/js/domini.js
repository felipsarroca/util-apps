/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Lògica pura de domini, validacions, transicions, puntuació i exportació CSV de Subhasta */

import { LIMITS } from './config.js?v=1.3.0';
import { TEXTOS } from './textos.js?v=1.3.0';

/**
 * Neteja caràcters invisibles i salts de línia d'un text.
 */
export function netejaText(raw, maxLen = 200) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202F\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Normalitza l'àlies per comprovar-ne la unicitat sense distingir majúscules.
 */
export function clauAlies(raw) {
  return netejaText(raw, LIMITS.MAX_ALIES).toLocaleLowerCase('ca-ES');
}

/**
 * Valida un àlies de participant (§5 Límits).
 */
export function validaAlies(raw, aliesExistents = [], uidActual = null) {
  const alies = netejaText(raw, LIMITS.MAX_ALIES + 5);
  if (!alies) {
    return { valid: false, error: 'Escriu un àlies per entrar a la sala.' };
  }
  if (alies.length > LIMITS.MAX_ALIES) {
    return { valid: false, error: `L’àlies pot tenir com a màxim ${LIMITS.MAX_ALIES} caràcters.` };
  }
  const clau = clauAlies(alies);
  const ocupat = aliesExistents.some(
    (p) => p.actiu !== false && p.uid !== uidActual && clauAlies(p.alies) === clau
  );
  if (ocupat) {
    return { valid: false, error: `L’àlies «${alies}» ja està en ús en aquesta sala.` };
  }
  return { valid: true, alies, clau };
}

/**
 * Valida la configuració completa d'una subhasta (§5 Límits).
 */
export function validaConfiguracio(cfg) {
  const errors = {};
  const titol = netejaText(cfg?.titol, LIMITS.MAX_TITOL + 5);
  if (!titol) errors.titol = 'Escriu un títol per a la subhasta.';
  else if (titol.length > LIMITS.MAX_TITOL) errors.titol = `Màxim ${LIMITS.MAX_TITOL} caràcters.`;

  const repte = netejaText(cfg?.repte ?? '', LIMITS.MAX_REPTE + 5);
  if (repte.length > LIMITS.MAX_REPTE) errors.repte = `Màxim ${LIMITS.MAX_REPTE} caràcters.`;

  const moneda = netejaText(cfg?.moneda || 'monedes', LIMITS.MAX_MONEDA + 5);
  if (!moneda) errors.moneda = 'Indica el nom de la moneda.';
  else if (moneda.length > LIMITS.MAX_MONEDA) errors.moneda = `Màxim ${LIMITS.MAX_MONEDA} caràcters.`;

  const pressupost = Number(cfg?.pressupost);
  if (!Number.isInteger(pressupost) || pressupost < LIMITS.MIN_PRESSUPOST || pressupost > LIMITS.MAX_PRESSUPOST) {
    errors.pressupost = `El pressupost ha de ser un enter d’1 a ${LIMITS.MAX_PRESSUPOST.toLocaleString('ca-ES')}.`;
  }

  const increment = Number(cfg?.increment);
  if (!Number.isInteger(increment) || increment < 1 || (Number.isInteger(pressupost) && increment > pressupost)) {
    errors.increment = 'L’increment ha de ser un enter entre 1 i el pressupost.';
  }

  const bonificacioConjunt = Number(cfg?.bonificacioConjunt ?? 0);
  if (!Number.isInteger(bonificacioConjunt) || bonificacioConjunt < 0 || bonificacioConjunt > LIMITS.MAX_PRESSUPOST * 10) {
    errors.bonificacioConjunt = 'La bonificació per conjunt ha de ser un enter positiu o zero.';
  }

  const objectes = Array.isArray(cfg?.objectes) ? cfg.objectes : [];
  if (objectes.length < 1 || objectes.length > LIMITS.MAX_OBJECTES) {
    errors.objectes = `Hi ha d’haver entre 1 i ${LIMITS.MAX_OBJECTES} objectes.`;
  }

  let totalUnitats = 0;
  const errorsObjectes = [];
  const nomsVistos = new Set();

  objectes.forEach((obj, idx) => {
    const errObj = {};
    const nom = netejaText(obj?.nom, LIMITS.MAX_NOM_OBJECTE + 5);
    if (!nom) errObj.nom = 'Cal un nom.';
    else if (nom.length > LIMITS.MAX_NOM_OBJECTE) errObj.nom = `Màxim ${LIMITS.MAX_NOM_OBJECTE} caràcters.`;
    else {
      const clauNom = nom.toLocaleLowerCase('ca-ES');
      if (nomsVistos.has(clauNom)) errObj.nom = 'Nom d’objecte repetit.';
      nomsVistos.add(clauNom);
    }

    const desc = netejaText(obj?.descripcio ?? '', LIMITS.MAX_DESCRIPCIO + 5);
    if (desc.length > LIMITS.MAX_DESCRIPCIO) errObj.descripcio = `Màxim ${LIMITS.MAX_DESCRIPCIO} caràcters.`;

    const q = Number(obj?.quantitat);
    if (!Number.isInteger(q) || q < 1 || q > LIMITS.MAX_UNITATS_TOTALS) {
      errObj.quantitat = `Entre 1 i ${LIMITS.MAX_UNITATS_TOTALS}.`;
    } else {
      totalUnitats += q;
    }

    const sortida = Number(obj?.preuSortida);
    if (!Number.isInteger(sortida) || sortida < 1 || (Number.isInteger(pressupost) && sortida > pressupost)) {
      errObj.preuSortida = 'Entre 1 i el pressupost.';
    }

    if (obj?.valor !== null && obj?.valor !== undefined && obj?.valor !== '') {
      const val = Number(obj.valor);
      if (!Number.isInteger(val) || val < 0 || val > LIMITS.MAX_PRESSUPOST * 10) {
        errObj.valor = 'Valor enter >= 0.';
      }
    }

    errorsObjectes[idx] = errObj;
  });

  if (totalUnitats < 1 || totalUnitats > LIMITS.MAX_UNITATS_TOTALS) {
    errors.totalUnitats = `El total d’unitats (${totalUnitats}) ha d’estar entre 1 i ${LIMITS.MAX_UNITATS_TOTALS}.`;
  }

  const teErrorsObjecte = errorsObjectes.some((e) => Object.keys(e).length > 0);
  return {
    valid: Object.keys(errors).length === 0 && !teErrorsObjecte,
    errors,
    errorsObjectes,
    totalUnitats
  };
}

/**
 * Calcula l'import mínim vigent d'una licitació oberta o aturada (§5 Imports).
 */
export function calculaMinimOferta(licitacio) {
  if (!licitacio) return null;
  const sortida = Number(licitacio.preuSortida);
  const inc = Number(licitacio.increment);
  if (!licitacio.numOfertes || licitacio.numOfertes === 0) {
    return sortida;
  }
  return Number(licitacio.importActual) + inc;
}

/**
 * Comprova si un import és múltiple vàlid a partir del preu de sortida (§5 Imports).
 */
export function esMultipleValid(importOferta, preuSortida, increment) {
  if (!Number.isInteger(importOferta) || !Number.isInteger(preuSortida) || !Number.isInteger(increment) || increment < 1) {
    return false;
  }
  if (importOferta < preuSortida) return false;
  return (importOferta - preuSortida) % increment === 0;
}

/**
 * Calcula el màxim import vàlid que un participant pot oferir amb el seu saldo.
 */
export function calculaMaximOferta(licitacio, saldo) {
  if (!licitacio || !Number.isInteger(saldo)) return null;
  const sortida = Number(licitacio.preuSortida);
  const inc = Number(licitacio.increment);
  if (saldo < sortida) return null;
  const incrementsPossibles = Math.floor((saldo - sortida) / inc);
  return sortida + incrementsPossibles * inc;
}

/**
 * Calcula els tres botons d'oferta ràpida (mínim, +1 increment, +4 increments)
 * i els límits del selector − / + per al terminal (§7 Terminal a l'ordinador).
 */
export function calculaOpcionsOferta(licitacio, saldo) {
  if (!licitacio) {
    return { minim: null, maxim: null, botons: [], potLicitar: false };
  }
  const minim = calculaMinimOferta(licitacio);
  const maxim = calculaMaximOferta(licitacio, saldo);
  const inc = Number(licitacio.increment);
  const candidats = [minim, minim + inc, minim + 4 * inc];

  const botons = candidats.map((imp, idx) => ({
    import: imp,
    etiqueta: idx === 0 ? 'Mínim' : idx === 1 ? `+${inc}` : `+${4 * inc}`,
    principal: idx === 0,
    disponible: licitacio.estat === 'oberta' && imp <= saldo,
    quedara: saldo - imp
  }));

  return {
    minim,
    maxim,
    increment: inc,
    botons,
    potLicitar: licitacio.estat === 'oberta' && minim <= saldo
  };
}

/**
 * Valida una oferta d'un participant sobre l'estat actual (§5, §7, §11).
 */
export function validaOferta({ sessio, tauler, cartera, uid, importOferta }) {
  if (!sessio || sessio.estat !== 'en_curs') {
    return { valid: false, codi: 'SESSIO_NO_ACTIVA', missatge: TEXTOS.terminal.esperantSeguent };
  }
  if (!cartera || cartera.habilitada === false) {
    return { valid: false, codi: 'CARTERA_INACTIVA', missatge: TEXTOS.terminal.carteraDeshabilitada };
  }
  const lic = tauler?.licitacio;
  if (!lic) {
    return { valid: false, codi: 'CAP_LICITACIO', missatge: TEXTOS.terminal.esperantSeguent };
  }
  if (lic.estat !== 'oberta') {
    return { valid: false, codi: 'LICITACIO_ATURADA', missatge: TEXTOS.terminal.aturada };
  }
  if (lic.liderUid === uid) {
    const queda = sessio.pressupost - cartera.gastat - lic.importActual;
    return {
      valid: false,
      codi: 'JA_ETS_LIDER',
      missatge: TEXTOS.terminal.lideres(lic.importActual, queda)
    };
  }

  const saldo = Number(sessio.pressupost) - Number(cartera.gastat);
  const minim = calculaMinimOferta(lic);
  const imp = Number(importOferta);

  if (!Number.isInteger(imp)) {
    return { valid: false, codi: 'IMPORT_INVALID', missatge: 'L’import ha de ser un nombre enter.' };
  }
  if (!esMultipleValid(imp, lic.preuSortida, lic.increment)) {
    return {
      valid: false,
      codi: 'NO_ES_MULTIPLE',
      missatge: `L’import ha de seguir múltiples de ${lic.increment} a partir de ${lic.preuSortida}.`
    };
  }
  if (imp < minim) {
    return {
      valid: false,
      codi: 'ALGU_S_HA_AVANCAT',
      missatge: TEXTOS.terminal.avancat(minim)
    };
  }
  if (imp > saldo) {
    return {
      valid: false,
      codi: 'SALDO_INSUFICIENT',
      missatge: TEXTOS.terminal.saldoInsuficient(minim, saldo)
    };
  }

  return {
    valid: true,
    import: imp,
    saldo,
    quedara: saldo - imp
  };
}

/**
 * Determina quin és el proper objecte suggerit per obrir (§7 Comandament):
 * per defecte continua amb el mateix objecte si encara li queden unitats;
 * si no, el següent objecte del catàleg amb unitats disponibles.
 */
export function determinaSeguentObjecteId(objectes, cataleg, objecteActualId = null, descomptarActual = false) {
  if (!Array.isArray(objectes) || objectes.length === 0) return null;

  const queden = (objId) => {
    const obj = objectes.find((o) => o.id === objId);
    if (!obj) return 0;
    const venudes = Number(cataleg?.[objId]?.venudes ?? 0);
    const extra = descomptarActual && objId === objecteActualId ? 1 : 0;
    return Math.max(0, Number(obj.quantitat) - venudes - extra);
  };

  if (objecteActualId && queden(objecteActualId) > 0) {
    return objecteActualId;
  }

  const idxActual = objectes.findIndex((o) => o.id === objecteActualId);
  const n = objectes.length;
  for (let i = 1; i <= n; i++) {
    const candidat = objectes[(idxActual + i + n) % n];
    if (candidat && queden(candidat.id) > 0) {
      return candidat.id;
    }
  }
  return null;
}

/**
 * Calcula la puntuació i el balanç d'un participant (§4 El motor didàctic).
 */
export function calculaPuntuacioParticipant(sessio, objectes, cartera) {
  const pressupost = Number(sessio?.pressupost ?? 0);
  const gastat = Number(cartera?.gastat ?? 0);
  const saldo = pressupost - gastat;
  const compres = Array.isArray(cartera?.compres) ? cartera.compres : [];

  const recomptePerObjecte = {};
  for (const obj of objectes || []) {
    recomptePerObjecte[obj.id] = 0;
  }
  let valorObjectes = 0;
  const mapaObj = new Map((objectes || []).map((o) => [o.id, o]));

  for (const c of compres) {
    recomptePerObjecte[c.objecteId] = (recomptePerObjecte[c.objecteId] || 0) + 1;
    const obj = mapaObj.get(c.objecteId);
    const valUnitat = Number(obj?.valor ?? 0);
    if (Number.isFinite(valUnitat) && valUnitat > 0) {
      valorObjectes += valUnitat;
    }
  }

  let conjuntsComplets = 0;
  if (Array.isArray(objectes) && objectes.length > 0) {
    conjuntsComplets = Math.min(...objectes.map((o) => recomptePerObjecte[o.id] || 0));
  }
  const bonificacioUnitaria = Number(sessio?.bonificacioConjunt ?? 0);
  const puntsConjunt = conjuntsComplets * (bonificacioUnitaria > 0 ? bonificacioUnitaria : 0);

  const puntuacioActiva = Boolean(
    sessio?.puntuacioActiva &&
      ((objectes || []).some((o) => Number(o.valor) > 0) || bonificacioUnitaria > 0)
  );

  const puntsTotals = puntuacioActiva ? valorObjectes + puntsConjunt + saldo : null;

  return {
    pressupost,
    gastat,
    saldo,
    unitatsComprades: compres.length,
    recomptePerObjecte,
    valorObjectes,
    conjuntsComplets,
    puntsConjunt,
    puntuacioActiva,
    puntsTotals
  };
}

/**
 * Verifica les 8 regles que mai no poden fallar (§5 Regles que mai no poden fallar).
 * Retorna { ok: boolean, errors: string[] }.
 */
export function verificaInvariants({ sessio, objectes, tauler, carteres, adjudicacions }) {
  const errors = [];
  const pressupost = Number(sessio?.pressupost ?? 0);
  const rondaActual = Number(sessio?.ronda ?? 1);

  // 1. Com a màxim una licitació en curs per sessió (estructura única a tauler.licitacio)
  if (tauler?.licitacio && typeof tauler.licitacio !== 'object') {
    errors.push('Regla 1: format de licitació invàlid.');
  }

  // Adjudicacions vigents de la ronda actual
  const adjVigents = (adjudicacions || []).filter(
    (a) => a.estat === 'vigent' && Number(a.ronda ?? 1) === rondaActual
  );

  // 2, 3, 4. Carteres: cap saldo negatiu, pressupost = saldo + despesa, compres = adjudicacions vigents
  for (const c of carteres || []) {
    const gastat = Number(c.gastat ?? 0);
    const saldo = pressupost - gastat;
    if (saldo < 0) {
      errors.push(`Regla 2: saldo negatiu per a ${c.alies} (${saldo}).`);
    }
    const compres = Array.isArray(c.compres) ? c.compres : [];
    const sumaCompres = compres.reduce((acc, item) => acc + Number(item.preu ?? 0), 0);
    if (sumaCompres !== gastat) {
      errors.push(`Regla 3: despesa de ${c.alies} (${gastat}) no coincideix amb la suma de compres (${sumaCompres}).`);
    }
    const adjPersona = adjVigents.filter((a) => a.participantUid === c.uid);
    if (adjPersona.length !== compres.length) {
      errors.push(
        `Regla 4: compres de la cartera de ${c.alies} (${compres.length}) != adjudicacions vigents (${adjPersona.length}).`
      );
    }
  }

  // 5. Unitats disponibles = inicials - venudes
  for (const obj of objectes || []) {
    const venudesTauler = Number(tauler?.cataleg?.[obj.id]?.venudes ?? 0);
    const venudesAdj = adjVigents.filter((a) => a.objecteId === obj.id).length;
    if (venudesTauler !== venudesAdj) {
      errors.push(`Regla 5: venudes al tauler de ${obj.nom} (${venudesTauler}) != adjudicacions vigents (${venudesAdj}).`);
    }
    if (venudesTauler < 0 || venudesTauler > Number(obj.quantitat)) {
      errors.push(`Regla 5: venudes fora de límit per a ${obj.nom} (${venudesTauler}/${obj.quantitat}).`);
    }
  }

  // 7. Import, líder i darreres ofertes coherents al mateix document tauler
  if (tauler?.licitacio) {
    const lic = tauler.licitacio;
    if (lic.numOfertes === 0) {
      if (lic.liderUid !== null || lic.importActual !== 0) {
        errors.push('Regla 7: sense ofertes no hi pot haver líder ni import.');
      }
    } else if (lic.numOfertes > 0) {
      if (!lic.liderUid || lic.importActual < lic.preuSortida) {
        errors.push('Regla 7: licitació amb ofertes sense líder o import vàlid.');
      }
      if (Array.isArray(lic.ultimesOfertes) && lic.ultimesOfertes.length > 0) {
        const darrera = lic.ultimesOfertes[0];
        if (darrera.uid !== lic.liderUid || darrera.import !== lic.importActual) {
          errors.push('Regla 7: la primera de les últimes ofertes no coincideix amb el líder i import actuals.');
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Neutralitza cel·les CSV que comencin com una fórmula (=, +, -, @, tabulador, retorn) (§7 Resultats).
 */
export function sanititzaCelaCsv(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Genera el CSV de participants amb UTF-8 BOM i punt i coma (§7 Resultats).
 * Columnes: àlies;pressupost;gastat;saldo;unitats;compres;punts
 */
export function generaCsvParticipants(sessio, objectes, carteres) {
  const capcalera = ['àlies', 'pressupost', 'gastat', 'saldo', 'unitats', 'compres', 'punts'];
  const files = [capcalera.join(';')];

  const llista = [...(carteres || [])].sort((a, b) =>
    String(a.alies || '').localeCompare(String(b.alies || ''), 'ca-ES')
  );

  for (const c of llista) {
    const resum = calculaPuntuacioParticipant(sessio, objectes, c);
    const detallCompres = (objectes || [])
      .map((o) => {
        const n = resum.recomptePerObjecte[o.id] || 0;
        return n > 0 ? `${o.nom} x${n}` : null;
      })
      .filter(Boolean)
      .join(', ');

    const fila = [
      sanititzaCelaCsv(c.alies),
      resum.pressupost,
      resum.gastat,
      resum.saldo,
      resum.unitatsComprades,
      sanititzaCelaCsv(detallCompres || 'Cap'),
      resum.puntuacioActiva ? resum.puntsTotals : ''
    ];
    files.push(fila.join(';'));
  }

  return '\uFEFF' + files.join('\r\n') + '\r\n';
}

/**
 * Genera el CSV d'adjudicacions amb UTF-8 BOM i punt i coma (§7 Resultats).
 * Columnes: ronda;ordre;objecte;unitat;àlies;import;ofertes rebudes;hora;estat
 */
export function generaCsvAdjudicacions(adjudicacions) {
  const capcalera = [
    'ronda',
    'ordre',
    'objecte',
    'unitat',
    'àlies',
    'import',
    'ofertes rebudes',
    'hora',
    'estat'
  ];
  const files = [capcalera.join(';')];

  const ordenades = [...(adjudicacions || [])].sort((a, b) => {
    if ((a.ronda || 1) !== (b.ronda || 1)) return (a.ronda || 1) - (b.ronda || 1);
    return (a.ordre || 0) - (b.ordre || 0);
  });

  for (const a of ordenades) {
    const dataHora = a.horaMs
      ? new Date(a.horaMs).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '';
    const fila = [
      a.ronda ?? 1,
      a.ordre ?? 1,
      sanititzaCelaCsv(a.objecteNom),
      a.unitat ?? 1,
      sanititzaCelaCsv(a.alies),
      a.import ?? 0,
      a.ofertesRebudes ?? 1,
      sanititzaCelaCsv(dataHora),
      a.estat === 'desfeta' ? 'desfeta' : 'vigent'
    ];
    files.push(fila.join(';'));
  }

  return '\uFEFF' + files.join('\r\n') + '\r\n';
}
