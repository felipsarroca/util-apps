/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Capa de sincronització en temps real (Firebase Firestore + sincronització local entre pestanyes) i simulador de 40 participants */

import { FIREBASE_CONFIG, LIMITS, STORAGE_KEYS } from './config.js?v=1.3.0';
import { EXEMPLE_MERCAT_INDUSTRIAL, TEXTOS } from './textos.js?v=1.3.0';
import {
  netejaText,
  clauAlies,
  validaAlies,
  validaConfiguracio,
  validaOferta,
  calculaMinimOferta,
  determinaSeguentObjecteId
} from './domini.js?v=1.3.0';

const FB_VER = '10.14.1';
const FB_APP_URL = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`;
const FB_FS_URL = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-firestore.js`;
const FB_AUTH_URL = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth.js`;

let fbPromise = null;
const canalLocal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('subhasta:canal') : null;
// A Node (proves automàtiques) el canal no ha de mantenir el procés obert
if (canalLocal && typeof canalLocal.unref === 'function') canalLocal.unref();

function generaHex(bytesLen = 8) {
  const bytes = new Uint8Array(bytesLen);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/* ============================================================
   Identitat: cada navegador té un usuari anònim de Firebase (persistent).
   Qui crea una subhasta n'és el propietari; opcionalment, la pot vincular a Google
   per dirigir-la des d'un altre ordinador.
   ============================================================ */
let uidAuth = null;
let correuAuth = '';

function uidLocalDeReserva() {
  // Només s'utilitza si Firebase no està disponible (sense connexió): mode local
  let uid = null;
  try { uid = localStorage.getItem(STORAGE_KEYS.UID); } catch (_) {}
  if (!uid) {
    uid = 'u_' + generaHex(8);
    try { localStorage.setItem(STORAGE_KEYS.UID, uid); } catch (_) {}
  }
  return uid;
}

function actualitzaIdentitat(user) {
  uidAuth = user?.uid || null;
  correuAuth = user && !user.isAnonymous ? String(user.email || '').toLowerCase() : '';
}

export function getUid() {
  return uidAuth || uidLocalDeReserva();
}

/** Correu de Google vinculat a aquest navegador (buit si és anònim). */
export function getCorreuOrganitzador() {
  return correuAuth;
}

export function esSessioPropia(sessio) {
  return Boolean(sessio && sessio.propietariUid && sessio.propietariUid === getUid());
}

/** Espera (com a molt uns segons) que hi hagi identitat de Firebase. */
export async function preparaIdentitat(timeoutMs = 8000) {
  try {
    await Promise.race([carregaFirebase(), new Promise((r) => setTimeout(r, timeoutMs))]);
  } catch (_) {}
  return uidAuth;
}

/* Codi de sala: 4 caràcters entre lletres i xifres, sense els que es confonen (0/O, 1/I/L). */
export const ALFABET_CODI_SALA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LONGITUD_CODI_SALA = 4;
const TEXTOS_CODI_INCOMPLET = 'El codi de la sala té 4 caràcters (lletres i xifres).';

export function normalitzaCodiSala(raw) {
  // Es conserven fins a 6 caràcters per compatibilitat amb les sales antigues de 6 xifres
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function esCodiSalaComplet(codi) {
  const net = normalitzaCodiSala(codi);
  return net.length === LONGITUD_CODI_SALA || /^[0-9]{6}$/.test(net);
}

export function formatCodiSala(codi) {
  const net = normalitzaCodiSala(codi);
  if (/^[0-9]{6}$/.test(net)) return `${net.slice(0, 3)} ${net.slice(3)}`;
  return net;
}

export function generaCodiSala() {
  const arr = new Uint32Array(LONGITUD_CODI_SALA);
  crypto.getRandomValues(arr);
  let codi = '';
  for (const n of arr) codi += ALFABET_CODI_SALA[n % ALFABET_CODI_SALA.length];
  return codi;
}

function generaCodi4() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  const num = 1000 + (arr[0] % 9000);
  return String(num);
}

async function carregaFirebase() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('SENSE_CONNEXIO');
  }
  if (!fbPromise) {
    fbPromise = (async () => {
      const [appMod, fsMod, authMod] = await Promise.all([
        import(FB_APP_URL),
        import(FB_FS_URL),
        import(FB_AUTH_URL).catch(() => null)
      ]);
      const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
      const db = fsMod.getFirestore(app);
      let auth = null;
      if (authMod) {
        try {
          auth = authMod.getAuth(app);
          if (typeof auth.authStateReady === 'function') await auth.authStateReady();
          if (!auth.currentUser) await authMod.signInAnonymously(auth);
          actualitzaIdentitat(auth.currentUser);
          authMod.onAuthStateChanged(auth, actualitzaIdentitat);
        } catch (_) {}
      }
      return { app, db, fs: fsMod, auth, authMod };
    })().catch((err) => {
      fbPromise = null;
      throw err;
    });
  }
  return fbPromise;
}

/* ============================================================
   Emmagatzematge local sincronitzat (localStorage + BroadcastChannel)
   Garanteix funcionament instantani entre pestanyes i mode d'assaig
   ============================================================ */
function llegeixMagatzemLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS_LOCALS);
    return raw ? JSON.parse(raw) : { sessions: {}, codis: {} };
  } catch (_) {
    return { sessions: {}, codis: {} };
  }
}

function escriuMagatzemLocal(data, sessioIdNotificar = null) {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS_LOCALS, JSON.stringify(data));
  } catch (_) {}
  if (canalLocal && sessioIdNotificar) {
    try {
      canalLocal.postMessage({ tipus: 'canvi_sessio', sessioId: sessioIdNotificar, t: Date.now() });
    } catch (_) {}
  }
}

function inicialitzaCatalegTauler(objectes) {
  const cataleg = {};
  for (const obj of objectes) {
    cataleg[obj.id] = {
      venudes: 0,
      darrerPreu: null,
      preus: []
    };
  }
  return cataleg;
}

function creaPaquetSessioInicial(configBase = EXEMPLE_MERCAT_INDUSTRIAL, opcions = {}) {
  const ara = Date.now();
  const expiraMs = ara + LIMITS.DIES_CADUCITAT * 24 * 3600 * 1000;
  const sessioId = opcions.sessioId || 'ses_' + generaHex(6);
  const codi = opcions.codi || generaCodiSala();
  const propietariUid = getUid();

  const objectes = (configBase.objectes || EXEMPLE_MERCAT_INDUSTRIAL.objectes).map((o, idx) => ({
    id: o.id || `obj_${idx + 1}_${generaHex(2)}`,
    ordre: idx + 1,
    nom: netejaText(o.nom || `Objecte ${idx + 1}`, LIMITS.MAX_NOM_OBJECTE),
    descripcio: netejaText(o.descripcio || '', LIMITS.MAX_DESCRIPCIO),
    icona: o.icona || 'carbo',
    imatgeDataUrl: o.imatgeDataUrl || null,
    quantitat: Number(o.quantitat) || 3,
    preuSortida: Number(o.preuSortida) || 10,
    valor: o.valor !== '' && o.valor !== null && o.valor !== undefined ? Number(o.valor) : 0
  }));

  const sessio = {
    id: sessioId,
    codi,
    propietariUid,
    titol: netejaText(configBase.titol || EXEMPLE_MERCAT_INDUSTRIAL.titol, LIMITS.MAX_TITOL),
    repte: netejaText(configBase.repte ?? EXEMPLE_MERCAT_INDUSTRIAL.repte, LIMITS.MAX_REPTE),
    pressupost: Number(configBase.pressupost) || 1000,
    moneda: netejaText(configBase.moneda || 'monedes', LIMITS.MAX_MONEDA),
    increment: Number(configBase.increment) || 10,
    puntuacioActiva: Boolean(configBase.puntuacioActiva ?? true),
    bonificacioConjunt: Number(configBase.bonificacioConjunt ?? 0),
    estat: opcions.estatInicial || 'preparacio',
    inscripcionsObertes: true,
    ronda: 1,
    mostrarClassificacio: false,
    creatMs: ara,
    actualitzatMs: ara,
    expiraMs
  };

  const cataleg = inicialitzaCatalegTauler(objectes);
  const tauler = {
    estatSessio: sessio.estat,
    ronda: 1,
    licitacio: null,
    cataleg,
    seguentObjecteId: objectes[0]?.id || null,
    ultimaAdjudicacio: null,
    ultimEsdeveniment: null,
    actualitzatMs: ara
  };

  return {
    sessio,
    objectes,
    tauler,
    participants: {},
    carteres: {},
    alies: {},
    canvis: {},
    adjudicacions: []
  };
}

/* ============================================================
   Sincronització amb Cloud Firestore
   ============================================================ */
const sessionsConfirmadesAlNuvol = new Set();

async function codiSalaOcupatAlNuvol(codi) {
  try {
    const { db, fs } = await carregaFirebase();
    const snap = await fs.getDoc(fs.doc(db, 'codis', codi));
    return snap.exists() && (snap.data().expiraMs || 0) > Date.now();
  } catch (_) {
    return false;
  }
}

async function generaCodiSalaLliure(mag) {
  for (let intent = 0; intent < 8; intent += 1) {
    const codi = generaCodiSala();
    if (mag.codis[codi]) continue;
    if (await codiSalaOcupatAlNuvol(codi)) continue;
    return codi;
  }
  return generaCodiSala();
}

async function desarPaquetAFirestore(paquet) {
  try {
    const { db, fs } = await carregaFirebase();
    const { sessio, objectes, tauler } = paquet;

    const refSessio = fs.doc(db, 'sessions', sessio.id);
    const refCodi = fs.doc(db, 'codis', sessio.codi);
    const refTauler = fs.doc(db, 'sessions', sessio.id, 'estat', 'tauler');
    const docCodi = {
      sessioId: sessio.id,
      actualitzatMs: sessio.actualitzatMs,
      expiraMs: sessio.expiraMs
    };

    // Les regles dels objectes comproven que la sessió existeix: la primera vegada
    // es desa la sessió sola i després la resta en un lot.
    if (!sessionsConfirmadesAlNuvol.has(sessio.id)) {
      await fs.setDoc(refSessio, sessio, { merge: true });
      await fs.setDoc(refCodi, docCodi);
      sessionsConfirmadesAlNuvol.add(sessio.id);
    }

    const batch = fs.writeBatch(db);
    batch.set(refSessio, sessio, { merge: true });
    batch.set(refCodi, docCodi);
    batch.set(refTauler, tauler, { merge: true });

    for (const obj of objectes) {
      const refObj = fs.doc(db, 'sessions', sessio.id, 'objectes', obj.id);
      batch.set(refObj, obj);
    }

    // Balanç de tothom: només és públic quan l'organitzador decideix projectar-lo
    const refBalanc = fs.doc(db, 'sessions', sessio.id, 'estat', 'balanc');
    if (sessio.mostrarClassificacio) {
      batch.set(refBalanc, {
        carteres: Object.values(paquet.carteres || {})
          .filter((c) => !c.substituitPer && c.habilitada !== false)
          .map((c) => ({ uid: c.uid, alies: c.alies, habilitada: true, gastat: Number(c.gastat) || 0, compres: c.compres || [] })),
        actualitzatMs: Date.now()
      });
    } else {
      batch.delete(refBalanc);
    }

    await batch.commit();
    return true;
  } catch (_) {
    return false;
  }
}

async function desaParticipantAlNuvol(paq, uidParticipant, clauAliesAntiga = null) {
  try {
    const { db, fs } = await carregaFirebase();
    const sessioId = paq.sessio.id;
    const batch = fs.writeBatch(db);
    const p = paq.participants?.[uidParticipant];
    const c = paq.carteres?.[uidParticipant];
    if (p) batch.set(fs.doc(db, 'sessions', sessioId, 'participants', uidParticipant), p);
    if (c) {
      batch.set(fs.doc(db, 'sessions', sessioId, 'carteres', uidParticipant), {
        ...c,
        actualitzatMs: Date.now()
      });
    }
    if (clauAliesAntiga) batch.delete(fs.doc(db, 'sessions', sessioId, 'alies', clauAliesAntiga));
    if (p && p.actiu !== false) {
      batch.set(fs.doc(db, 'sessions', sessioId, 'alies', clauAlies(p.alies)), {
        uid: uidParticipant,
        alies: p.alies,
        creatMs: Date.now()
      });
    }
    await batch.commit();
  } catch (_) {}
}

async function carregaPaquetDeFirestore(sessioId) {
  const { db, fs } = await carregaFirebase();
  const refSessio = fs.doc(db, 'sessions', sessioId);
  const snapSessio = await fs.getDoc(refSessio);
  if (!snapSessio.exists()) return null;

  const sessio = snapSessio.data();
  if (sessio.expiraMs && sessio.expiraMs <= Date.now()) {
    return null;
  }

  const [snapTauler, snapObjectes, snapParticipants, snapAdjudicacions] = await Promise.all([
    fs.getDoc(fs.doc(db, 'sessions', sessioId, 'estat', 'tauler')),
    fs.getDocs(fs.collection(db, 'sessions', sessioId, 'objectes')),
    fs.getDocs(fs.collection(db, 'sessions', sessioId, 'participants')),
    fs.getDocs(fs.collection(db, 'sessions', sessioId, 'adjudicacions'))
  ]);

  const objectes = [];
  snapObjectes.forEach((d) => objectes.push(d.data()));
  objectes.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

  const participants = {};
  snapParticipants.forEach((d) => {
    participants[d.id] = d.data();
  });

  const adjudicacions = [];
  snapAdjudicacions.forEach((d) => adjudicacions.push(d.data()));
  adjudicacions.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

  const carteres = {};
  const esOrg = esSessioPropia(sessio);
  if (esOrg) {
    try {
      const snapCarteres = await fs.getDocs(fs.collection(db, 'sessions', sessioId, 'carteres'));
      snapCarteres.forEach((d) => {
        carteres[d.id] = d.data();
      });
    } catch (_) {}
  } else {
    const uid = getUid();
    try {
      const snapCarteraPropia = await fs.getDoc(fs.doc(db, 'sessions', sessioId, 'carteres', uid));
      if (snapCarteraPropia.exists()) {
        carteres[uid] = snapCarteraPropia.data();
      }
    } catch (_) {}
  }

  let balancPublic = null;
  if (!esOrg && sessio.mostrarClassificacio) {
    try {
      const snapBalanc = await fs.getDoc(fs.doc(db, 'sessions', sessioId, 'estat', 'balanc'));
      if (snapBalanc.exists()) balancPublic = snapBalanc.data();
    } catch (_) {}
  }

  const tauler = snapTauler.exists()
    ? snapTauler.data()
    : {
        estatSessio: sessio.estat,
        ronda: sessio.ronda || 1,
        licitacio: null,
        cataleg: inicialitzaCatalegTauler(objectes),
        seguentObjecteId: objectes[0]?.id || null,
        ultimaAdjudicacio: null,
        ultimEsdeveniment: null,
        actualitzatMs: Date.now()
      };

  return {
    sessio,
    objectes,
    tauler,
    participants,
    carteres,
    alies: {},
    canvis: {},
    adjudicacions,
    balancPublic
  };
}

/* ============================================================
   Gestor principal de la sessió (Organitzador, Projecció i Terminal)
   ============================================================ */
export class GestorSubhasta {
  constructor() {
    this.sessioId = null;
    this.rol = null; // 'organitzador' | 'projeccio' | 'terminal'
    this.onChange = null;
    this.unsubs = [];
    this.simuladorTimer = null;
    this.comptadorLectures = 0;
    this.latenciesMs = [];

    if (canalLocal) {
      canalLocal.addEventListener('message', (ev) => {
        if (ev.data?.tipus === 'canvi_sessio' && ev.data?.sessioId === this.sessioId) {
          this._emetEstatLocal();
        }
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (ev) => {
        if (ev.key === STORAGE_KEYS.SESSIONS_LOCALS && this.sessioId) {
          this._emetEstatLocal();
        }
      });
    }
  }

  desconnecta() {
    this.aturaSimulador();
    for (const u of this.unsubs) {
      try {
        u();
      } catch (_) {}
    }
    this.unsubs = [];
    this.sessioId = null;
    this.onChange = null;
  }

  _emetEstatLocal() {
    if (!this.sessioId || !this.onChange) return;
    const mag = llegeixMagatzemLocal();
    const paquet = mag.sessions[this.sessioId];
    if (paquet) {
      this.comptadorLectures += 1;
      this.onChange(this._formataVista(paquet));
    }
  }

  _formataVista(paquet) {
    const uid = getUid();
    const objectes = [...(paquet.objectes || [])].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    const participantsList = Object.values(paquet.participants || {}).filter((p) => p.actiu !== false);
    const esOrganitzador = esSessioPropia(paquet.sessio);
    // Fora del navegador de l'organitzador, el balanç de tothom només arriba si s'ha decidit projectar-lo
    const fontCarteres = !esOrganitzador && paquet.sessio?.mostrarClassificacio && paquet.balancPublic?.carteres
      ? paquet.balancPublic.carteres
      : Object.values(paquet.carteres || {});
    const carteresList = fontCarteres.filter((c) => !c.substituitPer);
    const carteraPropia = paquet.carteres?.[uid] || null;
    const adjudicacions = [...(paquet.adjudicacions || [])].sort((a, b) => {
      if ((a.ronda || 1) !== (b.ronda || 1)) return (a.ronda || 1) - (b.ronda || 1);
      return (a.ordre || 0) - (b.ordre || 0);
    });

    return {
      sessio: paquet.sessio,
      objectes,
      tauler: paquet.tauler,
      participants: participantsList,
      carteres: carteresList,
      carteraPropia,
      adjudicacions,
      canvis: paquet.canvis || {},
      uid,
      esOrganitzador,
      lecturesConsumides: this.comptadorLectures,
      latenciaMitjanaMs: this.latenciesMs.length
        ? Math.round(this.latenciesMs.reduce((a, b) => a + b, 0) / this.latenciesMs.length)
        : 0
    };
  }

  /**
   * Vincula les subhastes d'aquest navegador a un compte de Google (opcional),
   * per poder-les dirigir també des d'un altre ordinador.
   */
  async vinculaGoogle() {
    const { auth, authMod, db, fs } = await carregaFirebase();
    if (!auth || !authMod) {
      throw new Error('L’identificació amb Google no està disponible en aquest navegador.');
    }
    const provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const actual = auth.currentUser;
    let user;
    if (actual && actual.isAnonymous) {
      try {
        user = (await authMod.linkWithPopup(actual, provider)).user;
      } catch (err) {
        if (err?.code !== 'auth/credential-already-in-use') throw err;
        // El compte ja s'havia vinculat en un altre ordinador: les sales d'aquest navegador
        // es marquen per passar-hi i després s'entra amb aquell compte.
        const cred = authMod.GoogleAuthProvider.credentialFromError(err);
        const correu = String(err?.customData?.email || '').toLowerCase();
        const propies = await this.llistaLesMevesSubhastes().catch(() => []);
        if (correu) {
          for (const s of propies) {
            await fs.updateDoc(fs.doc(db, 'sessions', s.id), { reclamableCorreu: correu }).catch(() => {});
          }
        }
        user = (await authMod.signInWithCredential(auth, cred)).user;
        actualitzaIdentitat(user);
        const mag = llegeixMagatzemLocal();
        for (const s of propies) {
          try {
            await fs.updateDoc(fs.doc(db, 'sessions', s.id), {
              propietariUid: user.uid,
              reclamableCorreu: fs.deleteField()
            });
            if (mag.sessions[s.id]) mag.sessions[s.id].sessio.propietariUid = user.uid;
          } catch (_) {}
        }
        escriuMagatzemLocal(mag);
      }
    } else {
      user = (await authMod.signInWithPopup(auth, provider)).user;
    }
    actualitzaIdentitat(user);
    return correuAuth;
  }

  /**
   * Desvincula aquest navegador del compte de Google (les subhastes continuen al compte).
   */
  async desvinculaGoogle() {
    const { auth, authMod } = await carregaFirebase();
    if (!auth || !authMod) return;
    await authMod.signOut(auth);
    const user = (await authMod.signInAnonymously(auth)).user;
    actualitzaIdentitat(user);
  }

  /**
   * Llista «Les meves subhastes» i elimina automàticament les sessions caducades (§7 i §10).
   */
  async llistaLesMevesSubhastes() {
    const ara = Date.now();
    const mag = llegeixMagatzemLocal();
    let haCanviat = false;

    for (const [id, paq] of Object.entries(mag.sessions)) {
      if (paq?.sessio?.expiraMs && paq.sessio.expiraMs <= ara) {
        if (paq.sessio.codi) delete mag.codis[paq.sessio.codi];
        delete mag.sessions[id];
        haCanviat = true;
      }
    }
    if (haCanviat) escriuMagatzemLocal(mag);

    // Intenta recuperar també de Firestore
    try {
      const { db, fs } = await carregaFirebase();
      const uid = getUid();
      // Només les sessions d'aquest organitzador (no es descarreguen les de ningú més)
      const snap = await fs.getDocs(
        fs.query(fs.collection(db, 'sessions'), fs.where('propietariUid', '==', uid))
      );
      const caducadesIds = [];

      snap.forEach((docSnap) => {
        const s = docSnap.data();
        if (s.propietariUid === uid) {
          if (s.expiraMs && s.expiraMs <= ara) {
            caducadesIds.push(s.id);
          } else if (!mag.sessions[s.id]) {
            mag.sessions[s.id] = {
              sessio: s,
              objectes: [],
              tauler: { estatSessio: s.estat, ronda: s.ronda || 1, licitacio: null, cataleg: {} },
              participants: {},
              carteres: {},
              adjudicacions: []
            };
          }
        }
      });

      for (const cadId of caducadesIds) {
        await this.eliminaSessio(cadId).catch(() => {});
      }
    } catch (_) {}

    // Les sales on aquest aparell només hi participa no són «les meves subhastes»
    return Object.values(mag.sessions)
      .filter((p) => esSessioPropia(p?.sessio))
      .map((p) => ({
        ...p.sessio,
        numObjectes: (p.objectes || []).length,
        numParticipants: Object.values(p.participants || {}).filter((x) => x.actiu !== false).length,
        numAdjudicacions: (p.adjudicacions || []).filter((a) => a.estat === 'vigent').length
      }))
      .sort((a, b) => (b.actualitzatMs || 0) - (a.actualitzatMs || 0));
  }

  /**
   * Crea una subhasta nova amb l'exemple «Mercat industrial» o una configuració donada.
   */
  async creaSubhasta(configBase = EXEMPLE_MERCAT_INDUSTRIAL, estatInicial = 'preparacio') {
    await preparaIdentitat();
    const mag = llegeixMagatzemLocal();
    const codi = await generaCodiSalaLliure(mag);
    const paquet = creaPaquetSessioInicial(configBase, { codi, estatInicial });
    mag.sessions[paquet.sessio.id] = paquet;
    mag.codis[codi] = paquet.sessio.id;
    escriuMagatzemLocal(mag, paquet.sessio.id);

    // S'espera (com a molt uns segons) que la sala existeixi al núvol abans de deixar-hi entrar ningú
    await Promise.race([desarPaquetAFirestore(paquet), new Promise((r) => setTimeout(r, 5000))]);
    return paquet.sessio;
  }

  /**
   * Duplica una sessió existent amb un codi nou i estat 'preparacio' (§7 Les meves subhastes).
   */
  async duplicaSessio(sessioIdOrigen) {
    const mag = llegeixMagatzemLocal();
    let origen = mag.sessions[sessioIdOrigen];
    if (!origen || !origen.objectes?.length) {
      origen = await carregaPaquetDeFirestore(sessioIdOrigen);
    }
    if (!origen) throw new Error('No s’ha trobat la sessió a duplicar.');

    const cfg = {
      titol: `${origen.sessio.titol} (còpia)`.slice(0, LIMITS.MAX_TITOL),
      repte: origen.sessio.repte,
      pressupost: origen.sessio.pressupost,
      moneda: origen.sessio.moneda,
      increment: origen.sessio.increment,
      puntuacioActiva: origen.sessio.puntuacioActiva,
      bonificacioConjunt: origen.sessio.bonificacioConjunt,
      objectes: origen.objectes.map((o) => ({ ...o, id: `obj_${generaHex(3)}` }))
    };
    return this.creaSubhasta(cfg, 'preparacio');
  }

  /**
   * Elimina completament una sessió (§7 i §10).
   */
  async eliminaSessio(sessioId) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    const codi = paq?.sessio?.codi;
    if (codi) delete mag.codis[codi];
    delete mag.sessions[sessioId];
    escriuMagatzemLocal(mag, sessioId);

    try {
      const { db, fs } = await carregaFirebase();
      if (codi) await fs.deleteDoc(fs.doc(db, 'codis', codi)).catch(() => {});
      await fs.deleteDoc(fs.doc(db, 'sessions', sessioId)).catch(() => {});
    } catch (_) {}
  }

  /* ============================================================
     Configuracions desades amb nom (v1.3)
     Es conserven DIES_CONFIGURACIO dies des de l'últim ús; cada ús en renova el termini.
     Es desen en aquest navegador i, si hi ha connexió, al núvol a nom del propietari.
     ============================================================ */
  _llegeixConfigsLocals() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CONFIGURACIONS);
      const dades = raw ? JSON.parse(raw) : {};
      return dades && typeof dades === 'object' ? dades : {};
    } catch (_) {
      return {};
    }
  }

  _escriuConfigsLocals(dades) {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIGURACIONS, JSON.stringify(dades));
      return true;
    } catch (_) {
      return false;
    }
  }

  async llistaConfiguracions() {
    const ara = Date.now();
    const locals = this._llegeixConfigsLocals();
    const uid = getUid();

    try {
      const { db, fs } = await carregaFirebase();
      const snap = await fs.getDocs(
        fs.query(fs.collection(db, 'configuracions'), fs.where('propietariUid', '==', uid))
      );
      snap.forEach((docSnap) => {
        const c = docSnap.data();
        if (!c?.id) return;
        if ((c.expiraMs || 0) <= ara) {
          fs.deleteDoc(docSnap.ref).catch(() => {});
          return;
        }
        const local = locals[c.id];
        if (!local || (local.usatMs || 0) < (c.usatMs || 0)) locals[c.id] = c;
      });
    } catch (_) {}

    for (const [id, c] of Object.entries(locals)) {
      if (!c?.cfg || (c.expiraMs || 0) <= ara) delete locals[id];
    }
    this._escriuConfigsLocals(locals);
    return Object.values(locals).sort((a, b) => (b.usatMs || 0) - (a.usatMs || 0));
  }

  /**
   * Desa la configuració d'una subhasta amb un nom. Si ja n'hi ha una amb el mateix nom, la substitueix.
   */
  async desaConfiguracio(nomRaw, cfg) {
    const nom = netejaText(nomRaw, LIMITS.MAX_NOM_CONFIGURACIO);
    if (!nom) throw new Error('Escriu un nom per a la configuració.');
    const val = validaConfiguracio(cfg);
    if (!val.valid) throw new Error('Revisa els camps marcats abans de desar la configuració.');

    const existents = await this.llistaConfiguracions();
    const mateixNom = existents.find((c) => c.nom.toLocaleLowerCase('ca-ES') === nom.toLocaleLowerCase('ca-ES'));
    if (!mateixNom && existents.length >= LIMITS.MAX_CONFIGURACIONS) {
      throw new Error(`Ja tens ${LIMITS.MAX_CONFIGURACIONS} configuracions desades. Elimina’n alguna per desar-ne una de nova.`);
    }

    const ara = Date.now();
    const objectes = cfg.objectes.map((o, idx) => ({
      id: o.id || `obj_${idx + 1}_${generaHex(2)}`,
      nom: netejaText(o.nom, LIMITS.MAX_NOM_OBJECTE),
      descripcio: netejaText(o.descripcio ?? '', LIMITS.MAX_DESCRIPCIO),
      icona: o.icona || 'carbo',
      imatgeDataUrl: o.imatgeDataUrl || null,
      quantitat: Number(o.quantitat),
      preuSortida: Number(o.preuSortida),
      valor: Number(o.valor) || 0
    }));
    // Un document de Firestore no pot superar 1 MB: si les fotos ocupen massa, es desen sense
    let senseFotos = false;
    if (JSON.stringify(objectes).length > 700000) {
      objectes.forEach((o) => { o.imatgeDataUrl = null; });
      senseFotos = true;
    }

    const doc = {
      id: mateixNom?.id || 'cfg_' + generaHex(6),
      propietariUid: getUid(),
      nom,
      cfg: {
        titol: netejaText(cfg.titol, LIMITS.MAX_TITOL),
        repte: netejaText(cfg.repte ?? '', LIMITS.MAX_REPTE),
        pressupost: Number(cfg.pressupost),
        moneda: netejaText(cfg.moneda || 'monedes', LIMITS.MAX_MONEDA),
        increment: Number(cfg.increment),
        puntuacioActiva: Boolean(cfg.puntuacioActiva),
        bonificacioConjunt: Number(cfg.bonificacioConjunt ?? 0),
        objectes
      },
      creatMs: mateixNom?.creatMs || ara,
      usatMs: ara,
      expiraMs: ara + LIMITS.DIES_CONFIGURACIO * 24 * 3600 * 1000
    };

    const locals = this._llegeixConfigsLocals();
    locals[doc.id] = doc;
    const desatLocal = this._escriuConfigsLocals(locals);

    let desatNuvol = false;
    try {
      const { db, fs } = await carregaFirebase();
      await fs.setDoc(fs.doc(db, 'configuracions', doc.id), doc);
      desatNuvol = true;
    } catch (_) {}

    if (!desatLocal && !desatNuvol) throw new Error('No s’ha pogut desar la configuració. Torna-ho a provar.');
    return { ...doc, senseFotos, substituida: Boolean(mateixNom), desatNuvol };
  }

  /**
   * Marca una configuració com a usada: en renova el termini de conservació.
   */
  async renovaConfiguracio(id) {
    const locals = this._llegeixConfigsLocals();
    const c = locals[id];
    if (!c) return;
    const ara = Date.now();
    c.usatMs = ara;
    c.expiraMs = ara + LIMITS.DIES_CONFIGURACIO * 24 * 3600 * 1000;
    this._escriuConfigsLocals(locals);
    try {
      const { db, fs } = await carregaFirebase();
      if (c.propietariUid === getUid()) {
        await fs.setDoc(fs.doc(db, 'configuracions', id), c);
      }
    } catch (_) {}
  }

  async eliminaConfiguracio(id) {
    const locals = this._llegeixConfigsLocals();
    delete locals[id];
    this._escriuConfigsLocals(locals);
    try {
      const { db, fs } = await carregaFirebase();
      await fs.deleteDoc(fs.doc(db, 'configuracions', id));
    } catch (_) {}
  }

  /**
   * Subscriu la pantalla als canvis en temps real d'una sessió.
   */
  async subscriuSessio(sessioId, rol, onChange) {
    this.desconnecta();
    this.sessioId = sessioId;
    this.rol = rol;
    this.onChange = onChange;

    const mag = llegeixMagatzemLocal();
    if (mag.sessions[sessioId]) {
      this._emetEstatLocal();
    } else {
      try {
        const remot = await carregaPaquetDeFirestore(sessioId);
        if (remot) {
          mag.sessions[sessioId] = remot;
          mag.codis[remot.sessio.codi] = sessioId;
          escriuMagatzemLocal(mag);
          this._emetEstatLocal();
        }
      } catch (_) {}
    }

    this._connectaNuvol(sessioId, rol);
  }

  /**
   * Oients de Firestore. Si fallen (per exemple, perquè la sala encara no existia al núvol),
   * es tornen a connectar sols al cap de pocs segons.
   */
  async _connectaNuvol(sessioId, rol) {
    const unsubsNuvol = [];
    let reintentat = false;
    const reintenta = () => {
      if (reintentat) return;
      reintentat = true;
      for (const u of unsubsNuvol) {
        try { u(); } catch (_) {}
      }
      this.unsubs = this.unsubs.filter((u) => !unsubsNuvol.includes(u));
      setTimeout(() => {
        if (this.sessioId === sessioId && this.rol === rol) this._connectaNuvol(sessioId, rol);
      }, 3000);
    };
    try {
      const { db, fs } = await carregaFirebase();
      const refTauler = fs.doc(db, 'sessions', sessioId, 'estat', 'tauler');
      const refSessio = fs.doc(db, 'sessions', sessioId);

      const unsubTauler = fs.onSnapshot(
        refTauler,
        (snap) => {
          if (!snap.exists()) return;
          this.comptadorLectures += 1;
          const m = llegeixMagatzemLocal();
          if (!m.sessions[sessioId]) return;
          const remot = snap.data();
          const local = m.sessions[sessioId].tauler || {};
          const localMs = local.actualitzatMs || 0;
          // Una oferta nova d'un altre aparell sempre s'accepta, encara que els rellotges no coincideixin
          const mateixaUnitat = remot.licitacio && local.licitacio
            && remot.licitacio.objecteId === local.licitacio.objecteId
            && remot.licitacio.unitat === local.licitacio.unitat
            && remot.licitacio.estat === local.licitacio.estat;
          const ofertaNova = mateixaUnitat
            && Number(remot.licitacio.numOfertes || 0) > Number(local.licitacio.numOfertes || 0);
          if ((remot.actualitzatMs || 0) >= localMs || ofertaNova || snap.metadata?.hasPendingWrites === false && this.rol !== 'organitzador') {
            m.sessions[sessioId].tauler = remot;
            escriuMagatzemLocal(m);
            if (this.onChange) this.onChange(this._formataVista(m.sessions[sessioId]));
          }
        },
        reintenta
      );

      const unsubSessio = fs.onSnapshot(
        refSessio,
        (snap) => {
          if (!snap.exists()) return;
          this.comptadorLectures += 1;
          const m = llegeixMagatzemLocal();
          if (!m.sessions[sessioId]) return;
          const remot = snap.data();
          const localMs = m.sessions[sessioId].sessio?.actualitzatMs || 0;
          if ((remot.actualitzatMs || 0) >= localMs) {
            m.sessions[sessioId].sessio = remot;
            escriuMagatzemLocal(m);
            if (this.onChange) this.onChange(this._formataVista(m.sessions[sessioId]));
          }
        },
        reintenta
      );

      const unsubParticipants = fs.onSnapshot(
        fs.collection(db, 'sessions', sessioId, 'participants'),
        (snap) => {
          this.comptadorLectures += Math.max(1, snap.docChanges().length);
          const m = llegeixMagatzemLocal();
          if (!m.sessions[sessioId]) return;
          const mapP = { ...(m.sessions[sessioId].participants || {}) };
          snap.forEach((d) => {
            mapP[d.id] = d.data();
          });
          m.sessions[sessioId].participants = mapP;
          escriuMagatzemLocal(m);
          if (this.onChange) this.onChange(this._formataVista(m.sessions[sessioId]));
        },
        reintenta
      );

      unsubsNuvol.push(unsubTauler, unsubSessio, unsubParticipants);

      if (rol !== 'organitzador') {
        // Balanç de tothom, només quan l'organitzador el projecta
        const unsubBalanc = fs.onSnapshot(
          fs.doc(db, 'sessions', sessioId, 'estat', 'balanc'),
          (snap) => {
            const m = llegeixMagatzemLocal();
            if (!m.sessions[sessioId]) return;
            m.sessions[sessioId].balancPublic = snap.exists() ? snap.data() : null;
            escriuMagatzemLocal(m);
            if (this.onChange) this.onChange(this._formataVista(m.sessions[sessioId]));
          },
          () => {}
        );
        unsubsNuvol.push(unsubBalanc);
      }

      if (rol === 'terminal') {
        const uid = getUid();
        const unsubCartera = fs.onSnapshot(
          fs.doc(db, 'sessions', sessioId, 'carteres', uid),
          (snap) => {
            if (!snap.exists()) return;
            this.comptadorLectures += 1;
            const m = llegeixMagatzemLocal();
            if (!m.sessions[sessioId]) return;
            m.sessions[sessioId].carteres[uid] = snap.data();
            escriuMagatzemLocal(m);
            if (this.onChange) this.onChange(this._formataVista(m.sessions[sessioId]));
          },
          reintenta
        );
        unsubsNuvol.push(unsubCartera);
      } else if (rol === 'organitzador') {
        const unsubCarteres = fs.onSnapshot(
          fs.collection(db, 'sessions', sessioId, 'carteres'),
          (snap) => {
            this.comptadorLectures += Math.max(1, snap.docChanges().length);
            const m = llegeixMagatzemLocal();
            if (!m.sessions[sessioId]) return;
            const mapC = { ...(m.sessions[sessioId].carteres || {}) };
            snap.forEach((d) => {
              const dData = d.data();
              const prevMs = mapC[d.id]?.actualitzatMs || 0;
              if ((dData.actualitzatMs || 0) >= prevMs) {
                mapC[d.id] = dData;
              }
            });
            m.sessions[sessioId].carteres = mapC;
            escriuMagatzemLocal(m);
            if (this.onChange) this.onChange(this._formataVista(m.sessions[sessioId]));
          },
          reintenta
        );
        unsubsNuvol.push(unsubCarteres);
      }
    } catch (_) {
      reintenta();
    }
    if (this.sessioId !== sessioId || this.rol !== rol) {
      for (const u of unsubsNuvol) {
        try { u(); } catch (_) {}
      }
      return;
    }
    this.unsubs.push(...unsubsNuvol);
  }

  /**
   * Resol un codi de sala (4 caràcters, o 6 xifres en sales antigues) a un sessioId.
   * Si la sala és d'aquest mateix navegador i l'organitzador hi és, es fa servir la còpia local;
   * altrament es consulta el núvol perquè l'estat (inscripcions, ronda…) sigui el vigent.
   */
  async resolCodiSala(rawCodi) {
    const codi = normalitzaCodiSala(rawCodi);
    if (!esCodiSalaComplet(codi)) {
      throw new Error(TEXTOS_CODI_INCOMPLET);
    }
    await preparaIdentitat();
    const mag = llegeixMagatzemLocal();
    const paqLocal = mag.codis[codi] ? mag.sessions[mag.codis[codi]] : null;
    const localPropi = paqLocal
      && paqLocal.sessio.expiraMs > Date.now()
      && esSessioPropia(paqLocal.sessio);
    if (localPropi) return paqLocal.sessio.id;

    try {
      const { db, fs } = await carregaFirebase();
      const snapCodi = await fs.getDoc(fs.doc(db, 'codis', codi));
      if (snapCodi.exists()) {
        const d = snapCodi.data();
        if (d.expiraMs > Date.now() && d.sessioId) {
          const remot = await carregaPaquetDeFirestore(d.sessioId);
          if (remot) {
            // Conserva la cartera i les reserves locals si ja s'hi havia entrat des d'aquest aparell
            const previ = mag.sessions[d.sessioId];
            if (previ) {
              remot.carteres = { ...(previ.carteres || {}), ...(remot.carteres || {}) };
              remot.alies = { ...(previ.alies || {}), ...(remot.alies || {}) };
              remot.canvis = previ.canvis || {};
            }
            mag.sessions[d.sessioId] = remot;
            mag.codis[codi] = d.sessioId;
            escriuMagatzemLocal(mag);
            return d.sessioId;
          }
        }
      }
    } catch (_) {}

    if (paqLocal && paqLocal.sessio.expiraMs > Date.now()) return paqLocal.sessio.id;
    throw new Error('No s’ha trobat cap subhasta activa amb aquest codi. Revisa’l a la pantalla de l’aula.');
  }

  /**
   * Desa canvis de preparació (editable a preparació i a la sala d'espera fins a «Començar»).
   */
  async desaPreparacio(sessioId, cfg) {
    const val = validaConfiguracio(cfg);
    if (!val.valid) {
      return { ok: false, validacio: val };
    }

    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq) throw new Error('Sessió no trobada.');
    if (paq.sessio.estat !== 'preparacio' && paq.sessio.estat !== 'espera') {
      throw new Error('La configuració només es pot editar abans de començar les licitacions.');
    }

    const ara = Date.now();
    paq.sessio.titol = netejaText(cfg.titol, LIMITS.MAX_TITOL);
    paq.sessio.repte = netejaText(cfg.repte ?? '', LIMITS.MAX_REPTE);
    paq.sessio.pressupost = Number(cfg.pressupost);
    paq.sessio.moneda = netejaText(cfg.moneda || 'monedes', LIMITS.MAX_MONEDA);
    paq.sessio.increment = Number(cfg.increment);
    paq.sessio.puntuacioActiva = Boolean(cfg.puntuacioActiva);
    paq.sessio.bonificacioConjunt = Number(cfg.bonificacioConjunt ?? 0);
    paq.sessio.actualitzatMs = ara;
    paq.sessio.expiraMs = ara + LIMITS.DIES_CADUCITAT * 24 * 3600 * 1000;

    paq.objectes = cfg.objectes.map((o, idx) => ({
      id: o.id || `obj_${idx + 1}_${generaHex(2)}`,
      ordre: idx + 1,
      nom: netejaText(o.nom, LIMITS.MAX_NOM_OBJECTE),
      descripcio: netejaText(o.descripcio ?? '', LIMITS.MAX_DESCRIPCIO),
      icona: o.icona || 'carbo',
      imatgeDataUrl: o.imatgeDataUrl || null,
      quantitat: Number(o.quantitat),
      preuSortida: Number(o.preuSortida),
      valor: o.valor !== '' && o.valor !== null && o.valor !== undefined ? Number(o.valor) : 0
    }));

    paq.tauler.cataleg = inicialitzaCatalegTauler(paq.objectes);
    paq.tauler.seguentObjecteId = paq.objectes[0]?.id || null;
    paq.tauler.actualitzatMs = ara;

    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();
    desarPaquetAFirestore(paq);
    return { ok: true, validacio: val };
  }

  /**
   * Passa de Preparació a Sala d'espera.
   */
  async obreSalaEspera(sessioId) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq) throw new Error('Sessió no trobada.');

    const ara = Date.now();
    paq.sessio.estat = 'espera';
    paq.sessio.inscripcionsObertes = true;
    paq.sessio.actualitzatMs = ara;
    paq.tauler.estatSessio = 'espera';
    paq.tauler.actualitzatMs = ara;

    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();
    desarPaquetAFirestore(paq);
  }

  /**
   * Commuta l'interruptor «Inscripcions obertes/tancades» (§2 i §7).
   */
  async commutaInscripcions(sessioId, obertes) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq) return;
    paq.sessio.inscripcionsObertes = Boolean(obertes);
    paq.sessio.actualitzatMs = Date.now();
    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();
    desarPaquetAFirestore(paq);
  }

  /**
   * Comença la subhasta des de la sala d'espera: tanca les inscripcions automàticament (§2).
   */
  async comencaSubhasta(sessioId, obrirPrimerObjecte = false) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq) throw new Error('Sessió no trobada.');

    const ara = Date.now();
    paq.sessio.estat = 'en_curs';
    paq.sessio.inscripcionsObertes = false;
    paq.sessio.actualitzatMs = ara;
    paq.tauler.estatSessio = 'en_curs';
    paq.tauler.actualitzatMs = ara;

    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();
    desarPaquetAFirestore(paq);

    if (obrirPrimerObjecte && paq.objectes[0]) {
      await this.obreUnitat(sessioId, paq.objectes[0].id);
    }
  }

  /**
   * Entrada d'un participant a la sala amb àlies (§5 i §10).
   */
  async entraParticipant(rawCodi, rawAlies, uidForcat = null) {
    const sessioId = await this.resolCodiSala(rawCodi);
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq) throw new Error('No s’ha trobat la sessió.');

    const uid = uidForcat || getUid();

    // Si ja té cartera activa a la sala, el reconnecta directament
    if (paq.carteres[uid] && paq.carteres[uid].habilitada !== false) {
      return { sessioId, uid, alies: paq.carteres[uid].alies, reconnectat: true };
    }

    if (!paq.sessio.inscripcionsObertes) {
      throw new Error('Les inscripcions estan tancades en aquest moment.');
    }

    const participantsActius = Object.values(paq.participants || {}).filter((p) => p.actiu !== false);
    if (participantsActius.length >= LIMITS.MAX_PARTICIPANTS) {
      throw new Error(`La sala és plena (màxim ${LIMITS.MAX_PARTICIPANTS} participants).`);
    }

    const val = validaAlies(rawAlies, participantsActius, uid);
    if (!val.valid) {
      throw new Error(val.error);
    }

    const ara = Date.now();
    const pDoc = { uid, alies: val.alies, creatMs: ara, actiu: true };
    const cDoc = {
      uid,
      alies: val.alies,
      habilitada: true,
      gastat: 0,
      compres: [],
      actualitzatMs: ara
    };

    paq.participants[uid] = pDoc;
    paq.carteres[uid] = cDoc;
    paq.alies[val.clau] = { uid, alies: val.alies, creatMs: ara };
    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();

    const desaAlNuvol = (async () => {
      const { db, fs } = await carregaFirebase();
      await fs.runTransaction(db, async (tx) => {
        const refAlies = fs.doc(db, 'sessions', sessioId, 'alies', val.clau);
        const snapAlies = await tx.get(refAlies);
        if (snapAlies.exists() && snapAlies.data().uid !== uid) {
          throw new Error('ALIES_OCUPAT');
        }
        tx.set(fs.doc(db, 'sessions', sessioId, 'participants', uid), pDoc);
        tx.set(fs.doc(db, 'sessions', sessioId, 'carteres', uid), cDoc);
        tx.set(refAlies, { uid, alies: val.alies, creatMs: ara });
      });
    })();

    // A l'aparell de l'alumnat, l'entrada només és vàlida si ha arribat al núvol:
    // així l'organitzador i la projecció la veuen de debò.
    const sessioPropia = esSessioPropia(paq.sessio);
    if (!uidForcat && !sessioPropia) {
      try {
        await desaAlNuvol;
      } catch (err) {
        const m = llegeixMagatzemLocal();
        const p2 = m.sessions[sessioId];
        if (p2) {
          delete p2.participants[uid];
          delete p2.carteres[uid];
          delete p2.alies[val.clau];
          escriuMagatzemLocal(m, sessioId);
        }
        throw new Error(err?.message === 'ALIES_OCUPAT'
          ? 'Aquest àlies ja el fa servir algú altre. Tria’n un de diferent.'
          : 'No s’ha pogut entrar a la sala. Comprova la connexió i torna-ho a provar.');
      }
    } else {
      desaAlNuvol.catch(() => {});
    }

    return { sessioId, uid, alies: val.alies, reconnectat: false };
  }

  /**
   * Canvia l'àlies d'un participant des del comandament de l'organitzador (§7).
   */
  async canviaAliesParticipant(sessioId, uidParticipant, nouAliesRaw) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq || !paq.participants[uidParticipant]) return;

    const participantsActius = Object.values(paq.participants).filter((p) => p.actiu !== false);
    const val = validaAlies(nouAliesRaw, participantsActius, uidParticipant);
    if (!val.valid) throw new Error(val.error);

    const anticAlies = paq.participants[uidParticipant].alies;
    const clauAntiga = clauAlies(anticAlies);
    delete paq.alies[clauAntiga];

    paq.participants[uidParticipant].alies = val.alies;
    if (paq.carteres[uidParticipant]) {
      paq.carteres[uidParticipant].alies = val.alies;
    }
    paq.alies[val.clau] = { uid: uidParticipant, alies: val.alies, creatMs: Date.now() };

    if (paq.tauler.licitacio?.liderUid === uidParticipant) {
      paq.tauler.licitacio.liderAlies = val.alies;
    }
    if (Array.isArray(paq.tauler.licitacio?.ultimesOfertes)) {
      paq.tauler.licitacio.ultimesOfertes.forEach((o) => {
        if (o.uid === uidParticipant) o.alies = val.alies;
      });
    }
    paq.tauler.actualitzatMs = Date.now();

    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();
    desarPaquetAFirestore(paq);
    desaParticipantAlNuvol(paq, uidParticipant, clauAntiga !== val.clau ? clauAntiga : null);
  }

  /**
   * Treu / desactiva un participant des del comandament (§7).
   */
  async treuParticipant(sessioId, uidParticipant) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq) return;
    if (paq.tauler.licitacio && paq.tauler.licitacio.liderUid === uidParticipant) {
      throw new Error('No es pot treure el participant que lidera la licitació en curs. Retira o adjudica abans.');
    }
    const anticAlies = paq.participants[uidParticipant]?.alies;
    if (anticAlies) delete paq.alies[clauAlies(anticAlies)];
    if (paq.participants[uidParticipant]) paq.participants[uidParticipant].actiu = false;
    if (paq.carteres[uidParticipant]) paq.carteres[uidParticipant].habilitada = false;

    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();
    desaParticipantAlNuvol(paq, uidParticipant, anticAlies ? clauAlies(anticAlies) : null);
  }

  /**
   * Genera un codi de 4 xifres vàlid 5 minuts per a canvi d'aparell (§10).
   */
  async generaCodiCanviAparell(sessioId, uidParticipant) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq || !paq.carteres[uidParticipant]) {
      throw new Error('Participant no trobat.');
    }
    const codi4 = generaCodi4();
    const expiraMs = Date.now() + LIMITS.MINUTS_CODI_CANVI * 60 * 1000;
    const c = paq.carteres[uidParticipant];

    paq.canvis = paq.canvis || {};
    paq.canvis[codi4] = {
      codi: codi4,
      targetUid: uidParticipant,
      alies: c.alies,
      gastat: c.gastat,
      compres: c.compres,
      expiraMs,
      usat: false
    };
    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();

    try {
      const { db, fs } = await carregaFirebase();
      await fs.setDoc(fs.doc(db, 'sessions', sessioId, 'canvis', codi4), paq.canvis[codi4]);
    } catch (_) {}

    return { codi: codi4, expiraMs, alies: c.alies };
  }

  /**
   * Recupera la cartera en un aparell nou amb el codi de 4 xifres (§10).
   */
  async recuperaAmbCodiCanvi(rawCodiSala, rawCodi4) {
    const sessioId = await this.resolCodiSala(rawCodiSala);
    const codi4 = String(rawCodi4 || '').replace(/[^0-9]/g, '').slice(0, 4);
    if (codi4.length !== 4) {
      throw new Error('El codi de canvi d’aparell ha de tenir 4 xifres.');
    }

    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq) throw new Error('Sessió no trobada.');

    let infoCanvi = paq.canvis?.[codi4];
    if (!infoCanvi) {
      try {
        const { db, fs } = await carregaFirebase();
        const snap = await fs.getDoc(fs.doc(db, 'sessions', sessioId, 'canvis', codi4));
        if (snap.exists()) infoCanvi = snap.data();
      } catch (_) {}
    }

    if (!infoCanvi || infoCanvi.usat || infoCanvi.expiraMs <= Date.now()) {
      throw new Error('Aquest codi de canvi d’aparell no és vàlid o ha caducat.');
    }

    const nouUid = getUid();
    const anticUid = infoCanvi.targetUid;
    const ara = Date.now();

    const carteraAntiga = paq.carteres[anticUid] || {
      alies: infoCanvi.alies,
      gastat: infoCanvi.gastat || 0,
      compres: infoCanvi.compres || []
    };

    // En un aparell diferent del de l'organitzador, el traspàs es fa al núvol en una transacció:
    // les regles comproven el codi i que la cartera nova és idèntica a l'antiga.
    if (!esSessioPropia(paq.sessio) && anticUid !== nouUid) {
      try {
        const { db, fs } = await carregaFirebase();
        await fs.runTransaction(db, async (tx) => {
          const refCanvi = fs.doc(db, 'sessions', sessioId, 'canvis', codi4);
          const snapCanvi = await tx.get(refCanvi);
          const c = snapCanvi.exists() ? snapCanvi.data() : null;
          if (!c || c.usat || c.expiraMs <= Date.now() || c.targetUid !== anticUid) throw new Error('CODI_INVALID');
          tx.set(fs.doc(db, 'sessions', sessioId, 'carteres', nouUid), {
            uid: nouUid,
            alies: c.alies,
            habilitada: true,
            gastat: c.gastat || 0,
            compres: c.compres || [],
            transferitDesDe: anticUid,
            codiCanvi: codi4,
            actualitzatMs: ara
          });
          tx.update(fs.doc(db, 'sessions', sessioId, 'carteres', anticUid), {
            habilitada: false,
            substituitPer: nouUid,
            actualitzatMs: ara
          });
          tx.set(fs.doc(db, 'sessions', sessioId, 'participants', nouUid), {
            uid: nouUid, alies: c.alies, creatMs: ara, actiu: true
          });
          tx.update(fs.doc(db, 'sessions', sessioId, 'participants', anticUid), { actiu: false });
          tx.set(fs.doc(db, 'sessions', sessioId, 'alies', clauAlies(c.alies)), {
            uid: nouUid, alies: c.alies, creatMs: ara
          });
          tx.update(refCanvi, { usat: true });
        });
      } catch (_) {
        throw new Error('No s’ha pogut recuperar la cartera. Demana a l’organitzador un codi nou i torna-ho a provar.');
      }
    }

    paq.carteres[nouUid] = {
      uid: nouUid,
      alies: carteraAntiga.alies,
      habilitada: true,
      gastat: carteraAntiga.gastat,
      compres: [...(carteraAntiga.compres || [])],
      transferitDesDe: anticUid,
      actualitzatMs: ara
    };

    if (anticUid !== nouUid && paq.carteres[anticUid]) {
      paq.carteres[anticUid].habilitada = false;
      paq.carteres[anticUid].substituitPer = nouUid;
    }
    if (anticUid !== nouUid && paq.participants[anticUid]) {
      paq.participants[anticUid].actiu = false;
    }
    paq.participants[nouUid] = {
      uid: nouUid,
      alies: carteraAntiga.alies,
      creatMs: ara,
      actiu: true
    };
    paq.alies[clauAlies(carteraAntiga.alies)] = {
      uid: nouUid,
      alies: carteraAntiga.alies,
      creatMs: ara
    };

    for (const adj of paq.adjudicacions || []) {
      if (adj.participantUid === anticUid) {
        adj.participantUid = nouUid;
      }
    }
    if (paq.tauler.licitacio?.liderUid === anticUid) {
      paq.tauler.licitacio.liderUid = nouUid;
    }
    infoCanvi.usat = true;
    paq.canvis[codi4] = infoCanvi;

    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();
    return { sessioId, uid: nouUid, alies: carteraAntiga.alies };
  }

  /* ============================================================
     Transicions de la subhasta (§5 Regles de la subhasta)
     ============================================================ */

  /**
   * Obre una unitat d'un objecte (§5: Cap licitació en curs -> Licitació oberta, sense ofertes).
   */
  async obreUnitat(sessioId, objecteId) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq) throw new Error('Sessió no trobada.');
    if (paq.tauler.licitacio !== null) {
      throw new Error('Ja hi ha una licitació en curs. Atura-la i adjudica-la o retira-la abans d’obrir-ne una altra.');
    }

    const obj = paq.objectes.find((o) => o.id === objecteId);
    if (!obj) throw new Error('Objecte no trobat.');

    const estatObj = paq.tauler.cataleg[obj.id] || { venudes: 0, darrerPreu: null, preus: [] };
    if (estatObj.venudes >= obj.quantitat) {
      throw new Error(`No queden unitats disponibles de ${obj.nom}.`);
    }

    const ara = Date.now();
    const unitatNum = estatObj.venudes + 1;

    paq.sessio.estat = 'en_curs';
    paq.sessio.inscripcionsObertes = false;
    paq.sessio.actualitzatMs = ara;
    paq.tauler.estatSessio = 'en_curs';

    // En obrir la unitat següent ja no es pot desfer l'adjudicació anterior (§5)
    if (paq.tauler.ultimaAdjudicacio) {
      paq.tauler.ultimaAdjudicacio.potDesfer = false;
    }

    paq.tauler.licitacio = {
      objecteId: obj.id,
      objecteNom: obj.nom,
      objecteIcona: obj.icona,
      unitat: unitatNum,
      quantitatTotal: obj.quantitat,
      preuSortida: Number(obj.preuSortida),
      increment: Number(paq.sessio.increment),
      estat: 'oberta',
      importActual: 0,
      liderUid: null,
      liderAlies: null,
      numOfertes: 0,
      ultimesOfertes: []
    };

    paq.tauler.seguentObjecteId = determinaSeguentObjecteId(
      paq.objectes,
      paq.tauler.cataleg,
      obj.id,
      true
    );
    paq.tauler.ultimEsdeveniment = {
      tipus: 'oberta',
      text: `${obj.nom} · unitat ${unitatNum} de ${obj.quantitat}`,
      ms: ara
    };
    paq.tauler.actualitzatMs = ara;

    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();
    desarPaquetAFirestore(paq);
  }

  /**
   * Atura les ofertes (§5: Oberta -> Aturada: import i líder congelats).
   */
  async aturaOfertes(sessioId) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq || !paq.tauler.licitacio) return;
    if (paq.tauler.licitacio.estat !== 'oberta') return;

    const ara = Date.now();
    paq.tauler.licitacio.estat = 'aturada';
    paq.tauler.ultimEsdeveniment = {
      tipus: 'aturada',
      text: TEXTOS.projeccio.aturada,
      ms: ara
    };
    paq.tauler.actualitzatMs = ara;

    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();
    desarPaquetAFirestore(paq);
  }

  /**
   * Reprèn les ofertes (§5: Aturada -> Oberta; es conserva la millor oferta).
   */
  async reprenOfertes(sessioId) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq || !paq.tauler.licitacio) return;
    if (paq.tauler.licitacio.estat !== 'aturada') return;

    const ara = Date.now();
    paq.tauler.licitacio.estat = 'oberta';
    paq.tauler.ultimEsdeveniment = {
      tipus: 'represa',
      text: 'Ofertes obertes de nou',
      ms: ara
    };
    paq.tauler.actualitzatMs = ara;

    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();
    desarPaquetAFirestore(paq);
  }

  /**
   * Adjudica la unitat (§5: Aturada amb líder -> Venuda).
   * Comprova que el líder i l'import coincideixen amb els revisats per l'organitzador,
   * i impedeix que un doble clic faci dos càrrecs (Regla 6).
   */
  async adjudicaUnitat(sessioId, esperatLiderUid, esperatImport) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq) throw new Error('Sessió no trobada.');

    const lic = paq.tauler.licitacio;
    if (!lic) {
      // Idempotència: si ja s'ha adjudicat per un primer clic, no fa res
      return { ok: false, motiu: 'JA_PROCESSADA' };
    }
    if (lic.estat !== 'aturada') {
      throw new Error('Cal aturar les ofertes abans d’adjudicar la unitat.');
    }
    if (!lic.liderUid || lic.numOfertes < 1) {
      throw new Error('No hi ha cap oferta vàlida per adjudicar. Pots retirar la unitat.');
    }
    if (lic.liderUid !== esperatLiderUid || lic.importActual !== Number(esperatImport)) {
      throw new Error('L’oferta o qui lidera ha canviat just abans d’aturar. Revisa les dades congelades i confirma de nou.');
    }

    let cartera = paq.carteres[lic.liderUid];
    for (let salts = 0; cartera?.substituitPer && paq.carteres[cartera.substituitPer] && salts < 5; salts += 1) {
      cartera = paq.carteres[cartera.substituitPer];
    }
    if (!cartera) {
      throw new Error('No s’ha trobat la cartera de qui lidera.');
    }
    const saldoActual = Number(paq.sessio.pressupost) - Number(cartera.gastat);
    if (lic.importActual > saldoActual) {
      throw new Error('Saldo insuficient a la cartera de qui lidera.');
    }

    const ara = Date.now();
    const adjId = `adj_${paq.sessio.ronda || 1}_${(paq.adjudicacions?.length || 0) + 1}_${generaHex(2)}`;
    const ordre = (paq.adjudicacions?.length || 0) + 1;
    const ronda = paq.sessio.ronda || 1;

    // 1. Actualitza cartera
    cartera.gastat = Number(cartera.gastat) + lic.importActual;
    cartera.compres = Array.isArray(cartera.compres) ? cartera.compres : [];
    cartera.compres.push({
      adjId,
      objecteId: lic.objecteId,
      objecteNom: lic.objecteNom,
      unitat: lic.unitat,
      preu: lic.importActual,
      ronda,
      horaMs: ara
    });
    cartera.actualitzatMs = ara;

    // 2. Actualitza catàleg del tauler
    const catObj = paq.tauler.cataleg[lic.objecteId] || { venudes: 0, darrerPreu: null, preus: [] };
    catObj.venudes = Number(catObj.venudes) + 1;
    catObj.darrerPreu = lic.importActual;
    catObj.preus = Array.isArray(catObj.preus) ? [...catObj.preus, lic.importActual] : [lic.importActual];
    paq.tauler.cataleg[lic.objecteId] = catObj;

    // 3. Registra l'adjudicació
    const adjDoc = {
      id: adjId,
      ronda,
      ordre,
      objecteId: lic.objecteId,
      objecteNom: lic.objecteNom,
      unitat: lic.unitat,
      participantUid: lic.liderUid,
      alies: lic.liderAlies,
      import: lic.importActual,
      ofertesRebudes: lic.numOfertes,
      horaMs: ara,
      estat: 'vigent'
    };
    paq.adjudicacions = paq.adjudicacions || [];
    paq.adjudicacions.push(adjDoc);

    // 4. Actualitza tauler
    paq.tauler.ultimaAdjudicacio = {
      id: adjId,
      objecteId: lic.objecteId,
      objecteNom: lic.objecteNom,
      objecteIcona: lic.objecteIcona,
      unitat: lic.unitat,
      quantitatTotal: lic.quantitatTotal,
      compradorUid: lic.liderUid,
      compradorAlies: lic.liderAlies,
      preu: lic.importActual,
      numOfertes: lic.numOfertes,
      ronda,
      ordre,
      horaMs: ara,
      potDesfer: true
    };
    paq.tauler.seguentObjecteId = determinaSeguentObjecteId(
      paq.objectes,
      paq.tauler.cataleg,
      lic.objecteId,
      false
    );
    paq.tauler.ultimEsdeveniment = {
      tipus: 'adjudicada',
      text: TEXTOS.projeccio.venut(lic.liderAlies, lic.importActual, paq.sessio.moneda),
      compradorUid: lic.liderUid,
      compradorAlies: lic.liderAlies,
      objecteNom: lic.objecteNom,
      preu: lic.importActual,
      quedara: Number(paq.sessio.pressupost) - cartera.gastat,
      ms: ara
    };
    paq.tauler.licitacio = null;
    paq.tauler.actualitzatMs = ara;
    paq.sessio.actualitzatMs = ara;

    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();

    (async () => {
      try {
        const { db, fs } = await carregaFirebase();
        const batch = fs.writeBatch(db);
        batch.set(fs.doc(db, 'sessions', sessioId, 'estat', 'tauler'), paq.tauler);
        batch.set(fs.doc(db, 'sessions', sessioId, 'carteres', cartera.uid), {
          ...cartera
        });
        batch.set(fs.doc(db, 'sessions', sessioId, 'adjudicacions', adjId), adjDoc);
        await batch.commit();
      } catch (_) {}
    })();

    return { ok: true, adjudicacio: adjDoc };
  }

  /**
   * Retira una licitació aturada (§5: Sense vendre, cap càrrec i la unitat continua disponible).
   */
  async retiraUnitat(sessioId) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq || !paq.tauler.licitacio) return;
    if (paq.tauler.licitacio.estat !== 'aturada') {
      throw new Error('Cal aturar les ofertes abans de retirar la unitat.');
    }

    const ara = Date.now();
    const objId = paq.tauler.licitacio.objecteId;
    paq.tauler.licitacio = null;
    paq.tauler.seguentObjecteId = determinaSeguentObjecteId(
      paq.objectes,
      paq.tauler.cataleg,
      objId,
      false
    );
    paq.tauler.ultimEsdeveniment = {
      tipus: 'retirada',
      text: TEXTOS.projeccio.senseVendre,
      ms: ara
    };
    paq.tauler.actualitzatMs = ara;

    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();
    desarPaquetAFirestore(paq);
  }

  /**
   * Desfà l'última adjudicació abans d'obrir la unitat següent (§5).
   */
  async desfesUltimaAdjudicacio(sessioId) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq) throw new Error('Sessió no trobada.');
    if (paq.tauler.licitacio !== null) {
      throw new Error('No es pot desfer l’adjudicació anterior un cop s’ha obert una unitat nova.');
    }

    const ultima = paq.tauler.ultimaAdjudicacio;
    if (!ultima || !ultima.potDesfer) {
      throw new Error('No hi ha cap adjudicació recent disponible per desfer.');
    }

    const ara = Date.now();
    const cartera = paq.carteres[ultima.compradorUid];
    if (cartera) {
      cartera.gastat = Math.max(0, Number(cartera.gastat) - Number(ultima.preu));
      cartera.compres = (cartera.compres || []).filter((c) => c.adjId !== ultima.id);
      cartera.actualitzatMs = ara;
    }

    const catObj = paq.tauler.cataleg[ultima.objecteId];
    if (catObj) {
      catObj.venudes = Math.max(0, Number(catObj.venudes) - 1);
      if (Array.isArray(catObj.preus) && catObj.preus.length > 0) {
        catObj.preus.pop();
      }
      catObj.darrerPreu = catObj.preus?.length ? catObj.preus[catObj.preus.length - 1] : null;
    }

    const adj = (paq.adjudicacions || []).find((a) => a.id === ultima.id);
    if (adj) {
      adj.estat = 'desfeta';
    }

    paq.tauler.ultimaAdjudicacio.potDesfer = false;
    paq.tauler.seguentObjecteId = ultima.objecteId;
    paq.tauler.ultimEsdeveniment = {
      tipus: 'desfeta',
      text: `Adjudicació desfeta (${ultima.objecteNom} · ${ultima.compradorAlies})`,
      ms: ara
    };
    paq.tauler.actualitzatMs = ara;

    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();

    (async () => {
      try {
        const { db, fs } = await carregaFirebase();
        const batch = fs.writeBatch(db);
        batch.set(fs.doc(db, 'sessions', sessioId, 'estat', 'tauler'), paq.tauler);
        if (cartera) {
          batch.set(fs.doc(db, 'sessions', sessioId, 'carteres', cartera.uid), {
            ...cartera
          });
        }
        if (adj) {
          batch.set(fs.doc(db, 'sessions', sessioId, 'adjudicacions', adj.id), {
            ...adj
          });
        }
        await batch.commit();
      } catch (_) {}
    })();
  }

  /**
   * «Tornar a començar» (§5): posa a zero despeses, compres i vendes, conserva els participants
   * i torna a la sala d'espera amb una ronda nova; les adjudicacions de cada ronda queden al CSV.
   */
  async tornaAComencar(sessioId) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq) throw new Error('Sessió no trobada.');
    if (paq.tauler.licitacio !== null) {
      throw new Error('Tanca o retira la licitació en curs abans de tornar a començar.');
    }

    const ara = Date.now();
    const novaRonda = Number(paq.sessio.ronda || 1) + 1;

    paq.sessio.estat = 'espera';
    paq.sessio.ronda = novaRonda;
    paq.sessio.inscripcionsObertes = true;
    paq.sessio.mostrarClassificacio = false;
    paq.sessio.actualitzatMs = ara;

    for (const c of Object.values(paq.carteres || {})) {
      if (!c.substituitPer) {
        c.gastat = 0;
        c.compres = [];
        c.actualitzatMs = ara;
      }
    }

    paq.tauler = {
      estatSessio: 'espera',
      ronda: novaRonda,
      licitacio: null,
      cataleg: inicialitzaCatalegTauler(paq.objectes),
      seguentObjecteId: paq.objectes[0]?.id || null,
      ultimaAdjudicacio: null,
      ultimEsdeveniment: {
        tipus: 'reinici',
        text: `Ronda ${novaRonda} preparada`,
        ms: ara
      },
      actualitzatMs: ara
    };

    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();
    desarPaquetAFirestore(paq);
  }

  /**
   * Finalitza la subhasta (§5: pas separat i definitiu, només sense licitació oberta o aturada).
   */
  async finalitzaSessio(sessioId) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq) throw new Error('Sessió no trobada.');
    if (paq.tauler.licitacio !== null) {
      throw new Error('No es pot finalitzar mentre hi ha una licitació oberta o aturada.');
    }

    const ara = Date.now();
    paq.sessio.estat = 'finalitzada';
    paq.sessio.inscripcionsObertes = false;
    paq.sessio.actualitzatMs = ara;
    paq.sessio.expiraMs = ara + LIMITS.DIES_CADUCITAT * 24 * 3600 * 1000;

    paq.tauler.estatSessio = 'finalitzada';
    if (paq.tauler.ultimaAdjudicacio) {
      paq.tauler.ultimaAdjudicacio.potDesfer = false;
    }
    paq.tauler.actualitzatMs = ara;

    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();
    desarPaquetAFirestore(paq);
  }

  /**
   * Commuta la projecció conscient de la classificació/balanç de participants (§4).
   */
  async commutaClassificacioPublica(sessioId, mostrar) {
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq) return;
    paq.sessio.mostrarClassificacio = Boolean(mostrar);
    paq.sessio.actualitzatMs = Date.now();
    escriuMagatzemLocal(mag, sessioId);
    this._emetEstatLocal();
    desarPaquetAFirestore(paq);
  }

  /**
   * Envia una oferta des del terminal (§5, §7, §10, §11).
   * Comprova l'estat fixat en començar la pulsació i executa la transacció.
   */
  async enviaOferta(sessioId, importOferta, contexteFixat = null, uidForcat = null) {
    const tInici = performance.now();
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq) {
      return { ok: false, codi: 'SESSIO_NO_TROBADA', missatge: TEXTOS.terminal.senseConnexio };
    }

    const uid = uidForcat || getUid();
    const lic = paq.tauler.licitacio;

    // Si la unitat ha canviat des que es va prémer el botó, es cancel·la amb explicació (§7)
    if (
      contexteFixat &&
      lic &&
      (lic.objecteId !== contexteFixat.objecteId || lic.unitat !== contexteFixat.unitat)
    ) {
      return {
        ok: false,
        codi: 'UNITAT_CANVIADA',
        missatge: 'La unitat en curs ha canviat abans d’enviar l’oferta.'
      };
    }

    const cartera = paq.carteres[uid];
    const validacio = validaOferta({
      sessio: paq.sessio,
      tauler: paq.tauler,
      cartera,
      uid,
      importOferta
    });

    if (!validacio.valid) {
      return { ok: false, codi: validacio.codi, missatge: validacio.missatge };
    }

    const ara = Date.now();
    const novaOfertaItem = {
      uid,
      alies: cartera.alies,
      import: validacio.import,
      ms: ara
    };

    const esdeveniment = {
      tipus: 'oferta',
      text: `${cartera.alies} ofereix ${validacio.import}`,
      uid,
      alies: cartera.alies,
      import: validacio.import,
      ms: ara
    };

    // Transacció a Firestore. Resol la incertesa mirant el tauler (§10).
    const transaccio = (async () => {
      const { db, fs } = await carregaFirebase();
      const refTauler = fs.doc(db, 'sessions', sessioId, 'estat', 'tauler');
      let resultat = { acceptada: false, tauler: null };
      await fs.runTransaction(db, async (tx) => {
        const snap = await tx.get(refTauler);
        if (!snap.exists()) {
          resultat = { acceptada: false, tauler: null };
          return;
        }
        const tRemot = snap.data();
        const licRemota = tRemot.licitacio;
        resultat = { acceptada: false, tauler: tRemot };
        if (!licRemota || licRemota.estat !== 'oberta') return;
        if (licRemota.objecteId !== lic.objecteId || licRemota.unitat !== lic.unitat) return;
        if (validacio.import < calculaMinimOferta(licRemota)) return;
        if (licRemota.liderUid === uid) return;
        const novesUltimes = [novaOfertaItem, ...(licRemota.ultimesOfertes || [])].slice(0, 3);
        const licNova = {
          ...licRemota,
          importActual: validacio.import,
          liderUid: uid,
          liderAlies: cartera.alies,
          numOfertes: Number(licRemota.numOfertes || 0) + 1,
          ultimesOfertes: novesUltimes
        };
        tx.update(refTauler, { licitacio: licNova, ultimEsdeveniment: esdeveniment, actualitzatMs: ara });
        resultat = { acceptada: true, tauler: { ...tRemot, licitacio: licNova, ultimEsdeveniment: esdeveniment, actualitzatMs: ara } };
      });
      return resultat;
    })();

    const sessioPropia = esSessioPropia(paq.sessio);
    if (!uidForcat && !sessioPropia) {
      // Terminal en un altre aparell: només es dona per bona l'oferta que el núvol ha acceptat
      let res;
      try {
        res = await transaccio;
      } catch (_) {
        return { ok: false, codi: 'SENSE_CONNEXIO', missatge: TEXTOS.terminal.senseConnexio };
      }
      const m = llegeixMagatzemLocal();
      if (res.tauler && m.sessions[sessioId]) {
        m.sessions[sessioId].tauler = res.tauler;
        escriuMagatzemLocal(m, sessioId);
        this._emetEstatLocal();
      }
      if (!res.acceptada) {
        const licR = res.tauler?.licitacio;
        if (!licR || licR.estat !== 'oberta') {
          return { ok: false, codi: 'LICITACIO_ATURADA', missatge: TEXTOS.terminal.aturada };
        }
        return { ok: false, codi: 'ALGU_S_HA_AVANCAT', missatge: TEXTOS.terminal.avancat(calculaMinimOferta(licR)) };
      }
    } else {
      // Mateix navegador que l'organitzador (assaig o simulador): actualització local immediata
      lic.importActual = validacio.import;
      lic.liderUid = uid;
      lic.liderAlies = cartera.alies;
      lic.numOfertes = Number(lic.numOfertes || 0) + 1;
      lic.ultimesOfertes = [novaOfertaItem, ...(lic.ultimesOfertes || [])].slice(0, LIMITS.MAX_ULTIMES_OFERTES);
      paq.tauler.ultimEsdeveniment = esdeveniment;
      paq.tauler.actualitzatMs = ara;
      escriuMagatzemLocal(mag, sessioId);
      this._emetEstatLocal();
      transaccio.catch(() => {});
    }

    const dt = Math.round(performance.now() - tInici);
    this.latenciesMs.push(dt);
    if (this.latenciesMs.length > 60) this.latenciesMs.shift();

    return {
      ok: true,
      import: validacio.import,
      quedara: validacio.quedara,
      missatge: TEXTOS.terminal.lideres(validacio.import, validacio.quedara)
    };
  }

  /* ============================================================
     Simulador d'aula de fins a 40 participants (§12 i §13)
     Es conserva perquè l'organitzador pugui assajar sol
     ============================================================ */
  async afegeixParticipantsSimulats(sessioId, quantitat = 10) {
    const nomsBase = [
      'Anna', 'Marc', 'Júlia', 'Pol', 'Laia', 'Nil', 'Martina', 'Jan',
      'Carla', 'Àlex', 'Berta', 'Pau', 'Clàudia', 'Roger', 'Arnau', 'Bernat',
      'Nora', 'Biel', 'Ona', 'oriol', 'Aina', 'Guillem', 'Paula', 'Unai',
      'Mireia', 'Èric', 'Sara', 'Hugo', 'Alba', 'Leo', 'Ariadna', 'Iker',
      'Judit', 'Dídac', 'Marina', 'Roc', 'Abril', 'Enzo', 'Gemma', 'Lluc'
    ];
    const mag = llegeixMagatzemLocal();
    const paq = mag.sessions[sessioId];
    if (!paq) return 0;

    const actius = Object.values(paq.participants || {}).filter((p) => p.actiu !== false);
    const llocsLliures = Math.max(0, LIMITS.MAX_PARTICIPANTS - actius.length);
    const aCrear = Math.min(quantitat, llocsLliures);

    const inscripcionsPrevies = paq.sessio.inscripcionsObertes;
    paq.sessio.inscripcionsObertes = true;
    escriuMagatzemLocal(mag);

    let creats = 0;
    for (let i = 0; i < nomsBase.length && creats < aCrear; i++) {
      const candidat = nomsBase[i].charAt(0).toUpperCase() + nomsBase[i].slice(1);
      const jaHiEs = Object.values(paq.participants || {}).some(
        (p) => p.actiu !== false && clauAlies(p.alies) === clauAlies(candidat)
      );
      if (jaHiEs) continue;
      const botUid = `bot_${ i + 1 }_${generaHex(3)}`;
      await this.entraParticipant(paq.sessio.codi, candidat, botUid);
      creats += 1;
    }

    const mag2 = llegeixMagatzemLocal();
    if (mag2.sessions[sessioId]) {
      mag2.sessions[sessioId].sessio.inscripcionsObertes = inscripcionsPrevies;
      escriuMagatzemLocal(mag2, sessioId);
    }
    this._emetEstatLocal();
    return creats;
  }

  iniciaSimuladorOfertes(sessioId, intervalMs = 1100) {
    this.aturaSimulador();
    this.simuladorTimer = setInterval(() => {
      const mag = llegeixMagatzemLocal();
      const paq = mag.sessions[sessioId];
      if (!paq || !paq.tauler.licitacio || paq.tauler.licitacio.estat !== 'oberta') return;

      const lic = paq.tauler.licitacio;
      const bots = Object.values(paq.carteres || {}).filter(
        (c) => String(c.uid).startsWith('bot_') && c.habilitada !== false && c.uid !== lic.liderUid
      );
      if (bots.length === 0) return;

      const minim = calculaMinimOferta(lic);
      const obj = paq.objectes.find((o) => o.id === lic.objecteId);
      const llindarMax = obj?.valor > 0 ? Math.round(obj.valor * 1.25) : Math.round(paq.sessio.pressupost * 0.45);
      if (minim > llindarMax) return;

      const candidatsValids = bots.filter((b) => paq.sessio.pressupost - b.gastat >= minim);
      if (candidatsValids.length === 0) return;

      const escollit = candidatsValids[Math.floor(Math.random() * candidatsValids.length)];
      const salt = Math.random() < 0.22 ? lic.increment : 0;
      const oferta =
        minim + salt <= paq.sessio.pressupost - escollit.gastat ? minim + salt : minim;

      this.enviaOferta(sessioId, oferta, { objecteId: lic.objecteId, unitat: lic.unitat }, escollit.uid);
    }, intervalMs);
  }

  aturaSimulador() {
    if (this.simuladorTimer) {
      clearInterval(this.simuladorTimer);
      this.simuladorTimer = null;
    }
  }
}
