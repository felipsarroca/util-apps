// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { analyzeDocumentHistory } from '../src/core/metrics';
import type { RawChangelogEntry, RawDocumentHistory } from '../src/types';

function makeWordBlock(wordCount: number, seed = 'paraula'): string {
  return Array.from({ length: wordCount }, (_, i) => `${seed}${i + 1}`).join(' ') + '\n';
}

function typeWordByWord(
  text: string,
  startPos: number,
  startTime: number,
  userId: string,
  startRev = 1
): { entries: RawChangelogEntry[]; nextPos: number; nextTime: number; nextRev: number } {
  const entries: RawChangelogEntry[] = [];
  let pos = startPos;
  let ts = startTime;
  let rev = startRev;

  // Simula pulsacions agrupades de 5-12 caràcters (com fa Google Docs en escriure)
  for (let i = 0; i < text.length; i += 8) {
    const chunk = text.slice(i, i + 8);
    ts += 1800;
    entries.push([{ ty: 'is', ibi: pos, s: chunk }, ts, userId, rev++, 's1']);
    pos += chunk.length;
  }
  return { entries, nextPos: pos, nextTime: ts, nextRev: rev };
}

describe('Pla de validació (Apartat 10 — Documents A fins M)', () => {
  const T0 = 1_732_500_000_000;

  it('Doc A: Escriure manualment 300 paraules -> 100% progressiu, 0 blocs', () => {
    const text300 = makeWordBlock(300, 'manual');
    const typed = typeWordByWord(text300, 1, T0, 'alumneA');

    const res = analyzeDocumentHistory({
      docId: 'doc-A',
      title: 'Document A — 300 paraules manuals',
      firstRev: 1,
      lastRev: typed.nextRev - 1,
      fetchedAt: T0,
      userMap: { alumneA: { name: 'Alumne A' } },
      changelog: typed.entries,
    });

    expect(res.finalWordCount).toBe(300);
    expect(res.progressivePct).toBe(100);
    expect(res.bulkPct).toBe(0);
    expect(res.bulkInsertions).toHaveLength(0);
    expect(res.coverage.level).toBe('alta');
  });

  it('Doc B: Enganxar 300 paraules de cop -> 100% en bloc, estat conservat', () => {
    const text300 = makeWordBlock(300, 'enganxat');
    const res = analyzeDocumentHistory({
      docId: 'doc-B',
      title: 'Document B — 300 paraules enganxades',
      firstRev: 1,
      lastRev: 1,
      fetchedAt: T0,
      userMap: { alumneB: { name: 'Alumne B' } },
      changelog: [[{ ty: 'is', ibi: 1, s: text300 }, T0, 'alumneB', 1]],
    });

    expect(res.finalWordCount).toBe(300);
    expect(res.bulkPct).toBe(100);
    expect(res.progressivePct).toBe(0);
    expect(res.bulkInsertions).toHaveLength(1);
    expect(res.bulkInsertions[0].status).toBe('conservat');
    expect(res.bulkInsertions[0].wordCount).toBe(300);
    // Ha d'avisar de poques revisions per a moltes paraules
    expect(res.coverage.level).toBe('parcial');
  });

  it('Doc C: Escriure 150 paraules i enganxar-ne 150 -> ~50% / ~50% i paràgraf exacte', () => {
    const partManual = makeWordBlock(150, 'redaccio');
    const partEnganxada = makeWordBlock(150, 'enganxat');
    const typed = typeWordByWord(partManual, 1, T0, 'alumneC');

    const changelog: RawChangelogEntry[] = [
      ...typed.entries,
      [{ ty: 'is', ibi: typed.nextPos, s: partEnganxada }, typed.nextTime + 5000, 'alumneC', typed.nextRev],
    ];

    const res = analyzeDocumentHistory({
      docId: 'doc-C',
      title: 'Document C — Mixt 150 + 150',
      firstRev: 1,
      lastRev: typed.nextRev,
      fetchedAt: T0,
      userMap: { alumneC: { name: 'Alumne C' } },
      changelog,
    });

    expect(res.finalWordCount).toBe(300);
    expect(res.progressivePct).toBeGreaterThanOrEqual(49);
    expect(res.progressivePct).toBeLessThanOrEqual(51);
    expect(res.bulkPct).toBeGreaterThanOrEqual(49);
    expect(res.bulkInsertions).toHaveLength(1);
    expect(res.bulkInsertions[0].paragraphNumber).toBe(2);
  });

  it('Doc D: Enganxar text i eliminar-lo -> 0% en bloc al text final, inserció marcada com eliminada', () => {
    const intro = typeWordByWord(makeWordBlock(40, 'propi'), 1, T0, 'alumneD');
    const blocEsborrat = makeWordBlock(120, 'descartat');
    const startPaste = intro.nextPos;
    const endPaste = startPaste + blocEsborrat.length - 1;

    const changelog: RawChangelogEntry[] = [
      ...intro.entries,
      [{ ty: 'is', ibi: startPaste, s: blocEsborrat }, intro.nextTime + 4000, 'alumneD', intro.nextRev],
      [{ ty: 'ds', si: startPaste, ei: endPaste }, intro.nextTime + 12_000, 'alumneD', intro.nextRev + 1],
    ];

    const res = analyzeDocumentHistory({
      docId: 'doc-D',
      title: 'Document D — Enganxat i eliminat',
      firstRev: 1,
      lastRev: intro.nextRev + 1,
      fetchedAt: T0,
      userMap: { alumneD: { name: 'Alumne D' } },
      changelog,
    });

    expect(res.finalWordCount).toBe(40);
    expect(res.progressivePct).toBe(100);
    expect(res.bulkPct).toBe(0);
    expect(res.bulkInsertions).toHaveLength(1);
    expect(res.bulkInsertions[0].status).toBe('eliminat');
  });

  it('Doc E: Enganxar text i reelaborar-lo a fons -> estat reelaborat', () => {
    const blocBase =
      'La Revolució Francesa de 1789 va posar fi a l’Antic Règim absolutista i va proclamar els drets de ciutadania i la sobirania nacional a Europa.';
    // Esborrem la segona meitat (~50%) i escrivim la nostra pròpia continuació
    const keepLen = 70;
    const manualTail = typeWordByWord(
      ' i va transformar profundament les institucions polítiques contemporànies.',
      keepLen + 1,
      T0 + 15_000,
      'alumneE',
      3
    );

    const changelog: RawChangelogEntry[] = [
      [{ ty: 'is', ibi: 1, s: blocBase }, T0, 'alumneE', 1],
      [{ ty: 'ds', si: keepLen + 1, ei: blocBase.length }, T0 + 8000, 'alumneE', 2],
      ...manualTail.entries,
    ];

    const res = analyzeDocumentHistory(
      {
        docId: 'doc-E',
        title: 'Document E — Enganxat i reelaborat',
        firstRev: 1,
        lastRev: manualTail.nextRev - 1,
        fetchedAt: T0,
        userMap: { alumneE: { name: 'Alumne E' } },
        changelog,
      },
      { bulkThresholdChars: 100 }
    );

    expect(res.bulkInsertions).toHaveLength(1);
    expect(res.bulkInsertions[0].status).toBe('reelaborat');
    expect(res.progressivePct).toBeGreaterThan(35);
  });

  it('Doc F: Moure un paràgraf dins del mateix document (tallar i enganxar)', () => {
    const p1 = 'Primer paràgraf breu.\n';
    const p2 =
      'Segon paràgraf força més llarg que l’alumne decideix moure al principi del treball per ordenar millor les idees exposades.\n';
    const t1 = typeWordByWord(p1, 1, T0, 'u1', 1);
    const t2 = typeWordByWord(p2, t1.nextPos, t1.nextTime + 2000, 'u1', t1.nextRev);

    // Talla p2 del final i l'enganxa a la posició 1 (abans de p1)
    const cutStart = p1.length + 1;
    const cutEnd = p1.length + p2.length;
    const changelog: RawChangelogEntry[] = [
      ...t1.entries,
      ...t2.entries,
      [
        {
          ty: 'mlti',
          mts: [
            { ty: 'ds', si: cutStart, ei: cutEnd },
            { ty: 'is', ibi: 1, s: p2 },
          ],
        },
        t2.nextTime + 10_000,
        'u1',
        t2.nextRev,
      ],
    ];

    const res = analyzeDocumentHistory({
      docId: 'doc-F',
      title: 'Document F — Moviment intern',
      firstRev: 1,
      lastRev: t2.nextRev,
      fetchedAt: T0,
      userMap: { u1: { name: 'Alumne F' } },
      changelog,
    });

    expect(res.finalPlainText).toBe((p2 + p1).trimEnd());
    expect(res.paragraphs[0].plainText).toBe(p2.trim());
    expect(res.paragraphs[1].plainText).toBe(p1.trim());
    // Moure text propi no és una inserció en bloc: conserva l'origen progressiu
    expect(res.movedInsertionsCount).toBe(1);
    expect(res.bulkInsertions).toHaveLength(0);
    expect(res.allCandidateInsertions).toHaveLength(0);
    expect(res.progressivePct).toBe(100);
    expect(res.paragraphs[0].segments.every((s) => s.origin === 'progressive')).toBe(true);
    // El moviment no compta com a correcció
    expect(res.revision.deletionPct).toBeLessThan(5);
  });

  it('Doc I: Dictat per veu (ràfegues de 30–40 caràcters) es distingeix segons el llindar configurable', () => {
    const bursts = [
      'Bon dia avui explicarem el cicle de l’aigua ',
      'primer l’evaporació puja cap als núvols ',
      'després la condensació refreda el vapor ',
      'i finalment cau en forma de precipitació.',
    ];
    let pos = 1;
    let ts = T0;
    const changelog: RawChangelogEntry[] = bursts.map((b, idx) => {
      const entry: RawChangelogEntry = [{ ty: 'is', ibi: pos, s: b }, ts, 'u1', idx + 1];
      pos += b.length;
      ts += 4000;
      return entry;
    });

    const history: RawDocumentHistory = {
      docId: 'doc-I',
      title: 'Document I — Dictat per veu',
      firstRev: 1,
      lastRev: bursts.length,
      fetchedAt: T0,
      userMap: { u1: { name: 'Alumne I' } },
      changelog,
    };

    const at100 = analyzeDocumentHistory(history, { bulkThresholdChars: 100 });
    expect(at100.bulkInsertions).toHaveLength(0);
    expect(at100.progressivePct).toBe(100);

    const at25 = analyzeDocumentHistory(history, { bulkThresholdChars: 25 });
    expect(at25.bulkInsertions.length).toBe(4);
  });

  it('Docs L i M: Suporta caràcters catalans (ŀ, ç), emojis UTF-16 i índexs desplaçats per taules sense fallar', () => {
    const history: RawDocumentHistory = {
      docId: 'doc-LM',
      title: 'Document M — Elements especials',
      firstRev: 1,
      lastRev: 4,
      fetchedAt: T0,
      userMap: { u1: { name: 'Alumne M' } },
      changelog: [
        [{ ty: 'is', ibi: 1, s: 'Col·legi i ciència 🧪 amb façade.\n' }, T0, 'u1', 1],
        // Simula una operació de taula amb índex fora del buffer pla
        [{ ty: 'is', ibi: 999, s: 'Cel·la de taula afegida.' }, T0 + 3000, 'u1', 2],
        [{ ty: 'ds', si: 950, ei: 1010 }, T0 + 5000, 'u1', 3],
      ],
    };

    const res = analyzeDocumentHistory(history);
    expect(res.finalPlainText).toContain('Col·legi i ciència 🧪');
    expect(res.coverage.clampedOperations).toBeGreaterThan(0);
  });
});
