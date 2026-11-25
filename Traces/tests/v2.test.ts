// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  analyzeDocumentHistory,
  computeDeadlineStats,
  guessAssignmentGroup,
  toStoredSummary,
} from '../src/core/metrics';
import { columnLabel, rangeLabel } from '../src/core/sheetsParser';
import type { RawChangelogEntry, RawDocumentHistory } from '../src/types';

const T0 = 1_764_000_000_000;
const MIN = 60_000;

function typeChars(objectId: string, text: string, start: number, t: number, user: string, rev: number) {
  const out: RawChangelogEntry[] = [];
  for (let i = 0; i < text.length; i++) {
    out.push([[15, objectId, null, start + i, text[i]], t + i * 400, user, rev + i]);
  }
  return out;
}

describe('Traces 2 — Presentacions de Google', () => {
  const pasted =
    'Aquest fragment llarg s’enganxa de cop dins de la segona diapositiva per comprovar que Traces el detecta com a bloc.';

  const build = (): RawDocumentHistory => {
    const changelog: RawChangelogEntry[] = [
      // Revisió 1: creació de la presentació (estructura inicial)
      [
        [
          4,
          [
            [12, 'layout1', 0, 1, [1, 'tema', 2, 'TITLE']],
            [3, 'p1_i0', 108, [1, 0, 0, 1, 0, 0], [55, 0], 'layout1'],
            [15, 'p1_i0', null, 0, 'Feu clic per afegir un títol'],
            [3, 'i0', 108, [1, 0, 0, 1, 0, 0], [44, 0], 'p'],
            [3, 'i1', 108, [1, 0, 0, 1, 0, 0], [44, 1], 'p'],
            [15, 'i0', null, 0, '\n'],
            [15, 'i1', null, 0, '\n'],
          ],
        ],
        T0,
        'u1',
        1,
      ],
      ...typeChars('i0', 'Revolució', 0, T0 + 5000, 'u1', 2),
      // Diapositiva nova feta per una altra alumna
      [
        [
          4,
          [
            [12, 's2', 1, 0, [1, 'tema']],
            [3, 's2_t', 108, [1, 0, 0, 1, 0, 0], [44, 2], 's2'],
            [15, 's2_t', null, 0, '\n'],
          ],
        ],
        T0 + 2 * MIN,
        'u2',
        20,
      ],
      [[15, 's2_t', null, 0, pasted], T0 + 3 * MIN, 'u2', 21],
      [[16, 's2_t', null, 0, 7], T0 + 3 * MIN + 4000, 'u2', 22],
      [[4, [[3, 'img1', 3, [1, 0, 0, 1, 0, 0], { 1: 'imatge' }, 's2'], [6, 'img1', [1, 0, 0, 1, 0, 0]]]], T0 + 4 * MIN, 'u2', 23],
      ...typeChars('i1', 'Notes', 0, T0 + 5 * MIN, 'u1', 24),
    ];
    return {
      docId: 'pres-1',
      title: 'Joan Garcia - Revolució industrial',
      kind: 'presentation',
      firstRev: 1,
      lastRev: 28,
      fetchedAt: T0,
      userMap: { u1: { name: 'Joan Garcia' }, u2: { name: 'Marta Puig' } },
      changelog,
    };
  };

  it('reconstrueix el text per diapositiva, separa la plantilla i detecta blocs i imatges', () => {
    const res = analyzeDocumentHistory(build(), { bulkThresholdChars: 100 });
    expect(res.kind).toBe('presentation');
    expect(res.slides).toHaveLength(2);
    expect(res.slides![0].title).toBe('Revolució');
    expect(res.slides![1].bulkCount).toBe(1);
    expect(res.slides![1].images).toBe(1);
    expect(res.imagesInserted).toBe(1);
    // El text dels dissenys (layouts) no forma part del resultat
    expect(res.finalPlainText).not.toContain('Feu clic');
    expect(res.bulkInsertions).toHaveLength(1);
    expect(res.bulkInsertions[0].slideNumber).toBe(2);
    expect(res.bulkInsertions[0].status).toBe('conservat');
    expect(res.paragraphs.find((p) => p.plainText.startsWith('Notes'))?.slideNumber).toBe(1);
    const marta = res.authors.find((a) => a.name === 'Marta Puig');
    expect(marta?.slidesTouched).toBe(1);
    // La creació de la presentació no compta com a temps de treball ni com a bloc
    expect(res.sessionCount).toBe(1);
  });
});

describe('Traces 2 — Google Sheets', () => {
  const build = (): RawDocumentHistory => ({
    docId: 'sheet-1',
    title: 'Anna Soler - Pressupost',
    kind: 'spreadsheet',
    firstRev: 1,
    lastRev: 6,
    fetchedAt: T0,
    userMap: { u1: { name: 'Anna Soler' } },
    changelog: [
      [[4444216, [[21350203, [null, 0, 0, '0', { 1: [[null, 0, 0, 'Full 1'], { 1: 2 }] }]]]], T0, 'u1', 1],
      [[21299578, [null, [null, '0', 0, 1, 0, 1], [null, 132274236, 3, { 1: 3, 3: 12 }, null, null, 0], {}]], T0 + 10_000, 'u1', 2],
      [[21299578, [null, [null, '0', 1, 2, 0, 1], [null, 132274236, 3, [null, 2, 'Lloguer'], null, null, 0], {}]], T0 + 20_000, 'u1', 3],
      [[21299578, [null, [null, '0', 2, 3, 0, 1], [null, 132274225, 12, null, 0, 0]]], T0 + 30_000, 'u1', 4],
      [
        [
          25813757,
          [
            null,
            [null, '0', 0, 3, 1, 4],
            [],
            null,
            null,
            null,
            [
              ...'abcdefgh'.split('').map((ch) => [null, 132274236, 3, [null, 2, ch], null, null, 0]),
              [null, 132274225, 12, null, 0, 0],
            ],
            null,
            [0, 0, 0, 1, 1, 1, 2, 2, 2],
            [1, 2, 3, 1, 2, 3, 1, 2, 3],
          ],
        ],
        T0 + 40_000,
        'u1',
        5,
      ],
      [[42492482, [null, [[null, [null, '0', 0, 1, 0, 1], [null, '0', 0, 7, 0, 1], []]], [], 1, 2]], T0 + 50_000, 'u1', 6],
      [[26812461, [null, '0', { 1: [[null, 0, 0, 'Despeses']] }]], T0 + 60_000, 'u1', 7],
    ],
  });

  it('distingeix cel·les escrites, enganxades, fórmules i ompliments', () => {
    const res = analyzeDocumentHistory(build());
    expect(res.kind).toBe('spreadsheet');
    expect(res.sheet?.cellsTyped).toBe(3);
    expect(res.sheet?.formulasTyped).toBe(1);
    expect(res.sheet?.cellsPasted).toBe(9);
    expect(res.sheet?.formulasPasted).toBe(1);
    expect(res.sheet?.fills).toBe(1);
    expect(res.sheet?.pastes).toHaveLength(1);
    expect(res.sheet?.pastes[0].rangeLabel).toBe('B1:D3');
    expect(res.sheet?.pastes[0].sheetName).toBe('Despeses');
    expect(res.sheet?.pastes[0].preview).toContain('a · b');
    expect(res.progressivePct).toBe(25);
    expect(res.bulkPct).toBe(75);
    expect(res.authors[0].cellsTyped).toBe(3);
    expect(res.timeline.some((p) => p.bulkInsertion)).toBe(true);
  });

  it('etiqueta columnes i rangs com Sheets', () => {
    expect(columnLabel(0)).toBe('A');
    expect(columnLabel(25)).toBe('Z');
    expect(columnLabel(26)).toBe('AA');
    expect(rangeLabel([4, 5, 0, 1])).toBe('A5');
  });
});

describe('Traces 2 — Mètriques noves de Docs', () => {
  const typed = (text: string, pos: number, t: number, rev: number): RawChangelogEntry[] => {
    const out: RawChangelogEntry[] = [];
    for (let i = 0; i < text.length; i += 6) {
      out.push([{ ty: 'is', ibi: pos + i, s: text.slice(i, i + 6) }, t + (i / 6) * 1500, 'u1', rev + i]);
    }
    return out;
  };

  it('calcula el ritme amb paraules pròpies, els dies de treball i l’eix de temps actiu', () => {
    const day1 = 'Primer dia escric unes quantes paraules pròpies amb calma. ';
    const day2 = 'Segon dia continuo el treball i acabo la conclusió final.';
    const paste =
      ' Aquest paràgraf llarg ve de fora i s’enganxa de cop per comprovar que no compta com a escriptura pròpia ni al ritme.';
    const d2Start = T0 + 24 * 3600_000;
    const changelog: RawChangelogEntry[] = [
      ...typed(day1, 1, T0, 1),
      ...typed(day2, 1 + day1.length, d2Start, 500),
      [{ ty: 'is', ibi: 1 + day1.length + day2.length, s: paste }, d2Start + 10 * MIN, 'u1', 900],
    ];
    const res = analyzeDocumentHistory(
      { docId: 'd', title: 'Doc', firstRev: 1, lastRev: 900, fetchedAt: T0, userMap: { u1: { name: 'Pau' } }, changelog },
      { bulkThresholdChars: 100 }
    );
    expect(res.workDays).toHaveLength(2);
    expect(res.lastDaySharePct).toBeGreaterThan(50);
    expect(res.progressiveFinalWords).toBe(19);
    expect(res.ownWordsPerMinute).toBeGreaterThan(0);
    const xs = res.timeline.map((p) => p.activeX);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(1);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));

    const dl = computeDeadlineStats(res, d2Start + 5 * MIN);
    expect(dl.lateSeconds).toBeGreaterThan(0);
    expect(dl.daysBefore).toBe(2);
  });

  it('marca l’escriptura llarga sense correccions i mesura el percentatge esborrat', () => {
    const words = Array.from({ length: 180 }, (_, i) => `mot${i}`).join(' ');
    const changelog = typed(words, 1, T0, 1);
    const res = analyzeDocumentHistory({ docId: 'x', title: 'x', firstRev: 1, lastRev: 1, fetchedAt: T0, userMap: {}, changelog });
    expect(res.revision.fewCorrections).toBe(true);
    expect(res.revision.level).toBe('poques');

    const withEdits: RawChangelogEntry[] = [
      ...changelog,
      [{ ty: 'ds', si: 1, ei: 300 }, T0 + 400_000, 'u1', 9000],
    ];
    const res2 = analyzeDocumentHistory({ docId: 'x', title: 'x', firstRev: 1, lastRev: 1, fetchedAt: T0, userMap: {}, changelog: withEdits });
    expect(res2.revision.deletionPct).toBeGreaterThan(15);
    expect(res2.revision.level).toBe('moltes');
    expect(res2.revision.fewCorrections).toBe(false);
  });

  it('avisa quan el format intern no es reconeix (canvi de Google)', () => {
    const changelog: RawChangelogEntry[] = Array.from({ length: 5 }, (_, i) => [
      { op: 'desconegut' } as unknown as RawChangelogEntry[0],
      T0 + i,
      'u1',
      i + 1,
    ]);
    const res = analyzeDocumentHistory({ docId: 'f', title: 'f', firstRev: 1, lastRev: 5, fetchedAt: T0, userMap: {}, changelog });
    expect(res.coverage.formatUnrecognized).toBe(true);
    expect(res.coverage.level).toBe('limitada');
  });

  it('analitza totes les pestanyes del document (format real amb nm/ksm) i les etiqueta', () => {
    const res = analyzeDocumentHistory({
      docId: 't',
      title: 'Amb pestanyes',
      firstRev: 1,
      lastRev: 3,
      fetchedAt: T0,
      userMap: {},
      changelog: [
        [{ ty: 'is', ibi: 1, s: 'Hola' }, T0, 'u1', 1],
        [
          {
            ty: 'mlti',
            mts: [
              { ty: 'mkch', d: [[1, 'Introducció']] },
              { ty: 'ac', d: ['t.abc', [1, 'Conclusió'], [1]] },
            ],
          },
          T0 + 500,
          'u1',
          2,
        ],
        [{ ty: 'nm', nmr: ['ksm', 't.abc'], nmc: { ty: 'is', ibi: 1, s: 'Adéu' } }, T0 + 1000, 'u1', 3],
      ],
    });
    expect(res.finalPlainText).toBe('Hola\nAdéu');
    expect(res.paragraphs.map((p) => p.tabName)).toEqual(['Introducció', 'Conclusió']);
    expect(res.docTabs).toHaveLength(2);
    expect(res.coverage.notes.some((n) => n.includes('2 pestanyes'))).toBe(true);
  });

  it('dedueix la tasca del títol de la còpia de Classroom i desa un resum sense text', () => {
    expect(guessAssignmentGroup('Joan Garcia - La Revolució industrial')).toBe('La Revolució industrial');
    expect(guessAssignmentGroup('Treball lliure')).toBe('Treball lliure');
    const res = analyzeDocumentHistory({
      docId: 'g',
      title: 'Joan Garcia - Tasca 1',
      firstRev: 1,
      lastRev: 1,
      fetchedAt: T0,
      userMap: { u1: { name: 'Joan Garcia' } },
      changelog: [[{ ty: 'is', ibi: 1, s: 'Text de prova' }, T0, 'u1', 1]],
    });
    const s = toStoredSummary(res);
    expect(s.group).toBe('Tasca 1');
    expect(s.mainAuthor).toBe('Joan Garcia');
    expect(JSON.stringify(s)).not.toContain('Text de prova');
  });
});

import { findDueDateInText, parseLooseDate } from '../src/core/dates';

describe('Traces 2 — Dates de lliurament de Classroom', () => {
  const now = new Date(2026, 10, 25, 10, 0); // 25/11/2026

  it('entén els formats en català, castellà i anglès', () => {
    const check = (text: string, y: number, m: number, d: number, h: number, min: number) => {
      const ts = parseLooseDate(text, now);
      expect(ts).not.toBeNull();
      const dt = new Date(ts!);
      expect([dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours(), dt.getMinutes()]).toEqual([y, m, d, h, min]);
    };
    check('28 de nov., 23:59', 2026, 10, 28, 23, 59);
    check('3 de des. 2026', 2026, 11, 3, 23, 59);
    check('Nov 28, 11:59 PM', 2026, 10, 28, 23, 59);
    check('12 mar 2027 9:30', 2027, 2, 12, 9, 30);
    check('28/11/2026', 2026, 10, 28, 23, 59);
    check('demà, 9:00', 2026, 10, 26, 9, 0);
    check('15 de set.', 2026, 8, 15, 23, 59);
  });

  it('troba la data dins del text del qualificador', () => {
    const text = 'Treball de Socials\nData de venciment: 30 de nov., 23:59\n10 punts';
    const ts = findDueDateInText(text, now)!;
    expect(new Date(ts).getDate()).toBe(30);
    expect(findDueDateInText('Sense data', now)).toBeNull();
  });
});
