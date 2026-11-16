/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Proves automàtiques de domini, casos de referència (§11), invariants (§5) i CSV (§7) */

import assert from 'node:assert/strict';
import {
  validaAlies,
  validaConfiguracio,
  calculaMinimOferta,
  esMultipleValid,
  calculaOpcionsOferta,
  validaOferta,
  calculaPuntuacioParticipant,
  verificaInvariants,
  sanititzaCelaCsv,
  generaCsvParticipants,
  generaCsvAdjudicacions
} from '../js/domini.js';
import { EXEMPLE_MERCAT_INDUSTRIAL } from '../js/textos.js';

console.log('Iniciant proves de domini de Subhasta…');

// 1. Validació d'àlies i unicitat sense distingir majúscules
{
  const existents = [{ uid: 'u1', alies: 'Anna', actiu: true }];
  assert.equal(validaAlies('anna', existents).valid, false, 'Àlies duplicat en minúscules ha de fallar');
  assert.equal(validaAlies('  Marc\n\r ', existents).alies, 'Marc', 'Ha de netejar salts de línia');
  assert.equal(validaAlies('A'.repeat(25), existents).valid, false, 'Més de 24 caràcters ha de fallar');
}

// 2. Validació de l'exemple Mercat industrial
{
  const res = validaConfiguracio(EXEMPLE_MERCAT_INDUSTRIAL);
  assert.equal(res.valid, true, 'L’exemple Mercat industrial ha de ser vàlid');
  assert.equal(res.totalUnitats, 14);
}

// 3. Casos de referència del §11 pas a pas
{
  const sessio = {
    id: 's1',
    pressupost: 1000,
    moneda: 'monedes',
    increment: 10,
    puntuacioActiva: true,
    bonificacioConjunt: 0,
    estat: 'en_curs',
    ronda: 1
  };
  const objectes = [
    { id: 'carbo', nom: 'Carbó', quantitat: 2, preuSortida: 10, valor: 150 }
  ];
  const carteres = {
    anna: { uid: 'anna', alies: 'Anna', habilitada: true, gastat: 0, compres: [] },
    marc: { uid: 'marc', alies: 'Marc', habilitada: true, gastat: 0, compres: [] }
  };
  const tauler = {
    estatSessio: 'en_curs',
    ronda: 1,
    licitacio: {
      objecteId: 'carbo',
      objecteNom: 'Carbó',
      unitat: 1,
      quantitatTotal: 2,
      preuSortida: 10,
      increment: 10,
      estat: 'oberta',
      importActual: 0,
      liderUid: null,
      liderAlies: null,
      numOfertes: 0,
      ultimesOfertes: []
    },
    cataleg: {
      carbo: { venudes: 0, darrerPreu: null, preus: [] }
    }
  };
  const adjudicacions = [];

  // Pas 1: S'obre carbó · unitat 1 de 2. Anna ofereix 10: acceptada; saldo 1.000; «et quedaran 990».
  const v1 = validaOferta({ sessio, tauler, cartera: carteres.anna, uid: 'anna', importOferta: 10 });
  assert.equal(v1.valid, true);
  assert.equal(v1.saldo, 1000);
  assert.equal(v1.quedara, 990);
  tauler.licitacio.importActual = 10;
  tauler.licitacio.liderUid = 'anna';
  tauler.licitacio.liderAlies = 'Anna';
  tauler.licitacio.numOfertes = 1;
  tauler.licitacio.ultimesOfertes = [{ uid: 'anna', alies: 'Anna', import: 10 }];
  assert.equal(verificaInvariants({ sessio, objectes, tauler, carteres: Object.values(carteres), adjudicacions }).ok, true);

  // Pas 2: Marc ofereix 25 -> rebutjada (no és múltiple vàlid); Marc ofereix 30 -> acceptada
  const v2Invalid = validaOferta({ sessio, tauler, cartera: carteres.marc, uid: 'marc', importOferta: 25 });
  assert.equal(v2Invalid.valid, false);
  assert.equal(v2Invalid.codi, 'NO_ES_MULTIPLE');

  const v2 = validaOferta({ sessio, tauler, cartera: carteres.marc, uid: 'marc', importOferta: 30 });
  assert.equal(v2.valid, true);
  tauler.licitacio.importActual = 30;
  tauler.licitacio.liderUid = 'marc';
  tauler.licitacio.liderAlies = 'Marc';
  tauler.licitacio.numOfertes = 2;
  tauler.licitacio.ultimesOfertes = [
    { uid: 'marc', alies: 'Marc', import: 30 },
    { uid: 'anna', alies: 'Anna', import: 10 }
  ];

  // Pas 3: Anna ofereix 30 -> rebutjada; el mínim és 40. No canvia res.
  const v3 = validaOferta({ sessio, tauler, cartera: carteres.anna, uid: 'anna', importOferta: 30 });
  assert.equal(v3.valid, false);
  assert.equal(v3.codi, 'ALGU_S_HA_AVANCAT');
  assert.equal(v3.missatge, 'Algú ha ofert abans. Ara el mínim és 40');

  // Pas 4: Anna ofereix 40, s'atura i s'adjudica
  const v4 = validaOferta({ sessio, tauler, cartera: carteres.anna, uid: 'anna', importOferta: 40 });
  assert.equal(v4.valid, true);
  tauler.licitacio.importActual = 40;
  tauler.licitacio.liderUid = 'anna';
  tauler.licitacio.liderAlies = 'Anna';
  tauler.licitacio.numOfertes = 3;
  tauler.licitacio.ultimesOfertes = [
    { uid: 'anna', alies: 'Anna', import: 40 },
    { uid: 'marc', alies: 'Marc', import: 30 },
    { uid: 'anna', alies: 'Anna', import: 10 }
  ];
  tauler.licitacio.estat = 'aturada';

  // Amb la licitació aturada no s'accepta cap oferta nova (Regla 8)
  const vAturada = validaOferta({ sessio, tauler, cartera: carteres.marc, uid: 'marc', importOferta: 50 });
  assert.equal(vAturada.valid, false);
  assert.equal(vAturada.codi, 'LICITACIO_ATURADA');

  // Adjudica a Anna per 40
  carteres.anna.gastat += 40;
  carteres.anna.compres.push({ adjId: 'adj1', objecteId: 'carbo', objecteNom: 'Carbó', unitat: 1, preu: 40, ronda: 1 });
  tauler.cataleg.carbo.venudes = 1;
  tauler.cataleg.carbo.darrerPreu = 40;
  tauler.cataleg.carbo.preus = [40];
  adjudicacions.push({
    id: 'adj1',
    ronda: 1,
    ordre: 1,
    objecteId: 'carbo',
    objecteNom: 'Carbó',
    unitat: 1,
    participantUid: 'anna',
    alies: 'Anna',
    import: 40,
    ofertesRebudes: 3,
    estat: 'vigent'
  });
  tauler.licitacio = null;

  assert.equal(sessio.pressupost - carteres.anna.gastat, 960);
  assert.equal(objectes[0].quantitat - tauler.cataleg.carbo.venudes, 1);
  assert.equal(tauler.cataleg.carbo.darrerPreu, 40);
  assert.equal(verificaInvariants({ sessio, objectes, tauler, carteres: Object.values(carteres), adjudicacions }).ok, true);

  // Pas 6: Desfer -> Anna torna a 1.000 i 0 carbons; queden 2 de 2; adjudicació desfeta
  carteres.anna.gastat = 0;
  carteres.anna.compres = [];
  tauler.cataleg.carbo.venudes = 0;
  tauler.cataleg.carbo.preus = [];
  tauler.cataleg.carbo.darrerPreu = null;
  adjudicacions[0].estat = 'desfeta';

  assert.equal(sessio.pressupost - carteres.anna.gastat, 1000);
  assert.equal(objectes[0].quantitat - tauler.cataleg.carbo.venudes, 2);
  assert.equal(verificaInvariants({ sessio, objectes, tauler, carteres: Object.values(carteres), adjudicacions }).ok, true);

  // Saldo just (§11): amb saldo 620 i mínim 630, botons inactius i motiu visible; amb saldo 630, vàlida i queda a zero
  carteres.anna.gastat = 380; // saldo = 620
  tauler.licitacio = {
    objecteId: 'carbo',
    objecteNom: 'Carbó',
    unitat: 1,
    quantitatTotal: 2,
    preuSortida: 10,
    increment: 10,
    estat: 'oberta',
    importActual: 620,
    liderUid: 'marc',
    liderAlies: 'Marc',
    numOfertes: 1,
    ultimesOfertes: [{ uid: 'marc', alies: 'Marc', import: 620 }]
  };
  const vInsuf = validaOferta({ sessio, tauler, cartera: carteres.anna, uid: 'anna', importOferta: 630 });
  assert.equal(vInsuf.valid, false);
  assert.equal(vInsuf.missatge, 'El mínim és 630 i tens 620');

  carteres.anna.gastat = 370; // saldo = 630
  const vJust = validaOferta({ sessio, tauler, cartera: carteres.anna, uid: 'anna', importOferta: 630 });
  assert.equal(vJust.valid, true);
  assert.equal(vJust.quedara, 0);

  // Puntuació (§11): carbó val 150. Anna acaba amb 2 carbons i saldo 870 -> 300 + 870 = 1.170 punts
  carteres.anna.gastat = 130;
  carteres.anna.compres = [
    { adjId: 'a1', objecteId: 'carbo', objecteNom: 'Carbó', unitat: 1, preu: 60 },
    { adjId: 'a2', objecteId: 'carbo', objecteNom: 'Carbó', unitat: 2, preu: 70 }
  ];
  const puntsAnna = calculaPuntuacioParticipant(sessio, objectes, carteres.anna);
  assert.equal(puntsAnna.saldo, 870);
  assert.equal(puntsAnna.valorObjectes, 300);
  assert.equal(puntsAnna.puntsTotals, 1170);
}

// 4. Protecció de fórmules i format CSV (§7 i §12)
{
  assert.equal(sanititzaCelaCsv('=1+1'), "'=1+1");
  assert.equal(sanititzaCelaCsv('+SUM(A1)'), "'+SUM(A1)");
  assert.equal(sanititzaCelaCsv('Anna;Marc'), '"Anna;Marc"');

  const csvP = generaCsvParticipants(
    { pressupost: 1000, puntuacioActiva: true, bonificacioConjunt: 0 },
    [{ id: 'carbo', nom: 'Carbó', quantitat: 2, valor: 150 }],
    [{ uid: 'u1', alies: '=1+1', gastat: 130, compres: [{ objecteId: 'carbo', preu: 130 }] }]
  );
  assert.equal(csvP.startsWith('\uFEFFàlies;pressupost;gastat;saldo;unitats;compres;punts'), true);
  assert.equal(csvP.includes("'=1+1;1000;130;870;1;Carbó x1;1020"), true);

  const csvA = generaCsvAdjudicacions([
    { ronda: 1, ordre: 1, objecteNom: 'Carbó', unitat: 1, alies: 'Anna', import: 40, ofertesRebudes: 3, estat: 'desfeta' },
    { ronda: 2, ordre: 2, objecteNom: 'Carbó', unitat: 1, alies: 'Marc', import: 50, ofertesRebudes: 2, estat: 'vigent' }
  ]);
  assert.equal(csvA.startsWith('\uFEFFronda;ordre;objecte;unitat;àlies;import;ofertes rebudes;hora;estat'), true);
  assert.equal(csvA.includes('1;1;Carbó;1;Anna;40;3;;desfeta'), true);
  assert.equal(csvA.includes('2;2;Carbó;1;Marc;50;2;;vigent'), true);
}

console.log('✓ Totes les proves de domini, casos de referència (§11), invariants (§5) i CSV (§7) han passat amb èxit!');
