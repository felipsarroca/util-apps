// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RawChangelogEntry, RawDocumentHistory } from '../types';

interface SimBuilder {
  entries: RawChangelogEntry[];
  cursor: number;
  rev: number;
  ts: number;
  typeProgressively: (userId: string, text: string, msPerChunk?: number) => void;
  pasteBlock: (userId: string, text: string, delayMs?: number) => void;
  pasteAt: (userId: string, pos1Based: number, text: string, delayMs?: number) => void;
  deleteRange: (userId: string, start1Based: number, length: number, delayMs?: number) => void;
  advanceMinutes: (minutes: number) => void;
}

function createSimBuilder(startTs: number, startCursor = 1, startRev = 1): SimBuilder {
  const entries: RawChangelogEntry[] = [];
  let cursor = startCursor;
  let rev = startRev;
  let ts = startTs;

  return {
    entries,
    get cursor() {
      return cursor;
    },
    set cursor(v: number) {
      cursor = v;
    },
    get rev() {
      return rev;
    },
    get ts() {
      return ts;
    },
    advanceMinutes(minutes: number) {
      ts += Math.round(minutes * 60_000);
    },
    typeProgressively(userId: string, text: string, msPerChunk = 2400) {
      // Simulate realistic human typing chunks of 3..14 characters with occasional small typos
      let idx = 0;
      let chunkStep = 0;
      while (idx < text.length) {
        const size = 4 + ((chunkStep * 3) % 9);
        const slice = text.slice(idx, idx + size);
        ts += msPerChunk + ((chunkStep * 410) % 1300);
        entries.push([{ ty: 'is', ibi: cursor, s: slice }, ts, userId, rev++, 'sess']);
        cursor += slice.length;
        idx += slice.length;

        // Every ~11th chunk simulate a quick 2-char backspace correction
        if (chunkStep % 11 === 5 && idx < text.length && cursor > 4) {
          ts += 650;
          entries.push([{ ty: 'is', ibi: cursor, s: 'xz' }, ts, userId, rev++, 'sess']);
          cursor += 2;
          ts += 520;
          entries.push(
            [{ ty: 'ds', si: cursor - 2, ei: cursor - 1 }, ts, userId, rev++, 'sess']
          );
          cursor -= 2;
        }
        chunkStep++;
      }
    },
    pasteBlock(userId: string, text: string, delayMs = 4000) {
      ts += delayMs;
      entries.push([{ ty: 'is', ibi: cursor, s: text }, ts, userId, rev++, 'sess']);
      cursor += text.length;
    },
    pasteAt(userId: string, pos1Based: number, text: string, delayMs = 3500) {
      ts += delayMs;
      entries.push([{ ty: 'is', ibi: pos1Based, s: text }, ts, userId, rev++, 'sess']);
      if (pos1Based <= cursor) {
        cursor += text.length;
      } else {
        cursor = pos1Based + text.length;
      }
    },
    deleteRange(userId: string, start1Based: number, length: number, delayMs = 2800) {
      if (length <= 0) return;
      ts += delayMs;
      entries.push(
        [
          { ty: 'ds', si: start1Based, ei: start1Based + length - 1 },
          ts,
          userId,
          rev++,
          'sess',
        ]
      );
      cursor = Math.max(1, cursor - length);
    },
  };
}

export interface DemoScenarioMeta {
  id: string;
  label: string;
  subtitle: string;
  build: () => RawDocumentHistory;
}

function buildIndustrialRevolutionDemo(): RawDocumentHistory {
  const templateText =
    'Ciències Socials · 4t d’ESO — Activitat: Impacte social i econòmic de la Revolució Industrial a Catalunya\n';
  const baseTs = new Date('2026-11-23T17:30:00+01:00').getTime();
  const sim = createSimBuilder(baseTs, templateText.length + 1, 3);

  // Session 1: 23/11 17:30 (~13 min) — Introducció escrita a mà + 2 blocs enganxats
  sim.typeProgressively(
    'u_alumne1',
    'La industrialització de Catalunya al segle XIX va transformar profundament els pobles i les ciutats, especialment prop dels rius com el Llobregat i el Ter i als nuclis fabrils del Vallès.\n',
    4800
  );

  sim.advanceMinutes(1.2);
  sim.pasteBlock(
    'u_alumne1',
    'El sector tèxtil cotoner es va convertir en el motor principal de l’economia catalana gràcies a la mecanització dels telers i a la introducció de la màquina de vapor. Davant l’escassetat de carbó mineral autòcton, molts industrials van optar per construir colònies industrials aprofitant la força hidràulica dels rius.\n',
    6000
  );

  sim.advanceMinutes(0.9);
  sim.pasteBlock(
    'u_alumne1',
    'Les condicions de vida de la classe obrera a les fàbriques eren extremadament dures: jornades d’entre dotze i catorze hores diàries, salaris molt baixos, presència habitual de treball infantil i absència de mesures d’higiene o seguretat laboral davant els accidents.\n',
    5000
  );

  sim.typeProgressively(
    'u_alumne1',
    'A Terrassa i Sabadell, en canvi, va predominar la indústria llanera amb els vapors urbans.\n',
    6500
  );

  // Session 2: 24/11 18:09 (~7 min) — Enganxa un paràgraf, l'elimina i n'enganxa un altre que reelabora!
  sim.advanceMinutes(24 * 60 + 27);
  const tempStart = sim.cursor;
  const discardedBlock =
    'Aquest fragment genèric sobre la siderúrgia britànica de Birmingham no corresponia al tema demanat a l’enunciat sobre Catalunya.\n';
  sim.pasteBlock('u_alumne2', discardedBlock, 4000);
  sim.advanceMinutes(1.1);
  sim.deleteRange('u_alumne2', tempStart, discardedBlock.length, 3000);

  const reworkedStart = sim.cursor;
  const reworkedBlock =
    'El moviment obrer va començar amb associacions d’ajuda mútua i societats de resistència que reclamaven la reducció de la jornada laboral i la prohibició del treball dels infants menors.';
  sim.pasteBlock('u_alumne2', reworkedBlock, 4000);
  // Reelabora l'última part del bloc enganxat i afegeix context propi
  sim.advanceMinutes(1.4);
  sim.deleteRange('u_alumne2', reworkedStart + 92, reworkedBlock.length - 92, 3200);
  sim.typeProgressively(
    'u_alumne2',
    'per defensar salaris dignes, limitar la jornada a vuit hores i protegir els infants a les fàbriques.\n',
    5200
  );

  // Session 3: 24/11 18:22 (~5 min) — Conclusió personal progressiva
  sim.advanceMinutes(7.5);
  sim.typeProgressively(
    'u_alumne1',
    'En conclusió, l’arribada dels vapors va modernitzar l’economia i les comunicacions amb el ferrocarril, però també va obrir grans desigualtats socials que marcarien tot el segle XX.\n',
    5000
  );

  return {
    docId: 'demo-revolucio-industrial',
    title: 'La Revolució Industrial a Catalunya — 4t ESO',
    firstRev: 3,
    lastRev: sim.rev - 1,
    fetchedAt: Date.now(),
    isDemo: true,
    demoId: 'mixt',
    userMap: {
      u_alumne1: { name: 'Martí Vila', color: '#0284C7' },
      u_alumne2: { name: 'Nora Bensaid', color: '#0D9488' },
    },
    chunkedSnapshot: [[{ ty: 'is', ibi: 1, s: templateText }]],
    changelog: sim.entries,
  };
}

function buildProgressiveEssayDemo(): RawDocumentHistory {
  const baseTs = new Date('2026-11-22T16:15:00+01:00').getTime();
  const sim = createSimBuilder(baseTs, 1, 1);

  sim.typeProgressively(
    'u_laia',
    'Per què l’aigua del mar és més densa que l’aigua dolça?\nQuan afegim sal a un volum d’aigua, la massa total de la dissolució augmenta notablement mentre que el volum gairebé no canvia, perquè els ions es col·loquen entre les molècules d’aigua.\n',
    4500
  );

  sim.advanceMinutes(12);

  sim.typeProgressively(
    'u_laia',
    'Al laboratori hem comprovat aquesta diferència mesurant amb la proveta 100 mL d’aigua de l’aixeta i 100 mL d’aigua amb 15 g de sal. A la balança electrònica hem obtingut una densitat d’1,00 g/cm³ en el primer cas i d’1,11 g/cm³ en el segon.\n',
    4700
  );

  sim.advanceMinutes(9);

  sim.typeProgressively(
    'u_laia',
    'Aquest mateix principi explica per què un ou fresc s’enfonsa en aigua dolça però sura fàcilment quan hi dissolem prou sal: l’empenta d’Arquimedes depèn directament de la densitat del fluid.\n',
    4600
  );

  return {
    docId: 'demo-redaccio-progressiva',
    title: 'Informe de laboratori: densitat i flotabilitat',
    firstRev: 1,
    lastRev: sim.rev - 1,
    fetchedAt: Date.now(),
    isDemo: true,
    demoId: 'progressiu',
    userMap: {
      u_laia: { name: 'Laia Puigdomènech', color: '#059669' },
    },
    changelog: sim.entries,
  };
}

function buildHeavyPasteDemo(): RawDocumentHistory {
  const baseTs = new Date('2026-11-24T21:48:00+01:00').getTime();
  const sim = createSimBuilder(baseTs, 1, 1);

  sim.typeProgressively('u_pol', ' El mite de la caverna de Plató\n', 2200);

  sim.pasteBlock(
    'u_pol',
    'Al llibre VII de La República, Plató exposa l’al·legoria de la caverna per explicar la seva teoria dualista del coneixement i la distinció ontològica entre el món sensible i el món intel·ligible. Els presoners encadenats des de la infantesa només contemplen ombres projectades al fons de la paret i confonen aquestes aparences amb l’única realitat existent.\n',
    5000
  );

  sim.pasteBlock(
    'u_pol',
    'L’alliberament d’un dels presoners i l’ascens dolorós cap a l’exterior simbolitzen el procés dialèctic de l’educació filosòfica (paideia), que culmina en la contemplació del Sol com a imatge de la Idea del Bé, causa última de tota veritat i intel·ligibilitat.\n',
    6500
  );

  return {
    docId: 'demo-insercio-directa',
    title: 'Comentari filosòfic: el mite de la caverna',
    firstRev: 1,
    lastRev: sim.rev - 1,
    fetchedAt: Date.now(),
    isDemo: true,
    demoId: 'bloc',
    userMap: {
      u_pol: { name: 'Pol Casals', color: '#D97706' },
    },
    changelog: sim.entries,
  };
}

export const DEMO_SCENARIOS: DemoScenarioMeta[] = [
  {
    id: 'mixt',
    label: 'Cas mixt (Classroom)',
    subtitle: '2 autors, plantilla base, blocs conservats i un de reelaborat',
    build: buildIndustrialRevolutionDemo,
  },
  {
    id: 'progressiu',
    label: 'Redacció progressiva',
    subtitle: '3 sessions d’escriptura pas a pas sense insercions massives',
    build: buildProgressiveEssayDemo,
  },
  {
    id: 'bloc',
    label: 'Incorporació en bloc',
    subtitle: 'Document creat en 1 min amb dos blocs grans gairebé intactes',
    build: buildHeavyPasteDemo,
  },
];
