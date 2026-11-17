/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Configuració de Firebase i constants del sistema per a Subhasta */

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAItPvSyCU6AqrPoCuitS3SZZ34XwMCnQo',
  authDomain: 'subhasta-aula-cat.firebaseapp.com',
  projectId: 'subhasta-aula-cat',
  storageBucket: 'subhasta-aula-cat.firebasestorage.app',
  messagingSenderId: '388682808914',
  appId: '1:388682808914:web:51074ffbd11c843321a98b'
};

export const LIMITS = {
  MAX_PARTICIPANTS: 40,
  MAX_OBJECTES: 12,
  MAX_UNITATS_TOTALS: 60,
  MIN_PRESSUPOST: 1,
  MAX_PRESSUPOST: 100000,
  MAX_TITOL: 60,
  MAX_NOM_OBJECTE: 40,
  MAX_DESCRIPCIO: 200,
  MAX_ALIES: 24,
  MAX_MONEDA: 16,
  MAX_REPTE: 280,
  DIES_CADUCITAT: 30,
  DIES_CONFIGURACIO: 365,
  MAX_CONFIGURACIONS: 20,
  MAX_NOM_CONFIGURACIO: 60,
  MINUTS_CODI_CANVI: 5,
  MAX_ULTIMES_OFERTES: 3,
  MAX_IMATGE_KB: 60
};

export const STORAGE_KEYS = {
  UID: 'subhasta:uid',
  CLAU_ORG: 'subhasta:clauOrg',
  CORREU_ORG: 'subhasta:correuOrg',
  TEMA: 'subhasta:tema',
  SO_MARTELL: 'subhasta:soMartell',
  SESSIONS_LOCALS: 'subhasta:sessionsLocals',
  SESSIO_ACTIVA: 'subhasta:sessioActiva',
  CONFIGURACIONS: 'subhasta:configuracions',
  EQUIPS_PREVISTOS: 'subhasta:equipsPrevistos'
};
