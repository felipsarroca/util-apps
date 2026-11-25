// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { analyzeDocumentHistory } from '../src/core/metrics';
import { stripXssiPrefix } from '../src/core/parser';
import { DEMO_SCENARIOS } from '../src/core/demoData';
import type { RawDocumentHistory } from '../src/types';

describe('Traces — Motor d’interpretació i mètriques', () => {
  it('elimina correctament el prefix de seguretat XSSI de Google Docs', () => {
    const raw = ")]}'\n{\"firstRev\":1}";
    expect(JSON.parse(stripXssiPrefix(raw))).toEqual({ firstRev: 1 });
  });

  it('Cas A: reconstrueix escriptura progressiva i detecta 100% progressiu', () => {
    const t0 = 1_700_000_000_000;
    const history: RawDocumentHistory = {
      docId: 'test-a',
      title: 'Prova manual',
      firstRev: 1,
      lastRev: 4,
      fetchedAt: t0,
      userMap: { u1: { name: 'Alumne A', color: '#0284C7' } },
      changelog: [
        [{ ty: 'is', ibi: 1, s: 'Hola ' }, t0, 'u1', 1],
        [{ ty: 'is', ibi: 6, s: 'mónx' }, t0 + 2000, 'u1', 2],
        [{ ty: 'ds', si: 9, ei: 9 }, t0 + 3000, 'u1', 3],
        [{ ty: 'is', ibi: 9, s: ' català!' }, t0 + 5000, 'u1', 4],
      ],
    };

    const res = analyzeDocumentHistory(history, { bulkThresholdChars: 50 });
    expect(res.finalPlainText).toBe('Hola món català!');
    expect(res.finalWordCount).toBe(3);
    expect(res.progressivePct).toBe(100);
    expect(res.bulkPct).toBe(0);
    expect(res.bulkInsertions).toHaveLength(0);
    expect(res.sessionCount).toBe(1);
  });

  it('Casos B, D i E: distingeix insercions conservades, eliminades i reelaborades', () => {
    const t0 = 1_700_000_000_000;
    const blocConservat =
      'Aquest primer paràgraf s’incorpora d’un sol cop i es manté completament intacte fins al final del document.\n';
    const blocEliminat =
      'Aquest segon bloc també supera el llindar però l’alumne l’esborra sencer al cap d’uns segons.\n';
    const blocReelaborat =
      'Aquest tercer paràgraf enganxat serà parcialment retallat per deixar-ne només la meitat inicial del contingut.';

    const c1 = 1;
    const c2 = c1 + blocConservat.length;
    const c3 = c2 + blocEliminat.length;

    const history: RawDocumentHistory = {
      docId: 'test-bde',
      title: 'Prova estats d’inserció',
      firstRev: 1,
      lastRev: 5,
      fetchedAt: t0,
      userMap: { u1: { name: 'Alumne B' } },
      changelog: [
        [{ ty: 'is', ibi: c1, s: blocConservat }, t0, 'u1', 1],
        [{ ty: 'is', ibi: c2, s: blocEliminat }, t0 + 5000, 'u1', 2],
        // Elimina blocEliminat sencer
        [
          { ty: 'ds', si: c2, ei: c3 - 1 },
          t0 + 10_000,
          'u1',
          3,
        ],
        // Enganxa blocReelaborat a c2 i n'esborra la meitat final
        [{ ty: 'is', ibi: c2, s: blocReelaborat }, t0 + 15_000, 'u1', 4],
        [
          {
            ty: 'ds',
            si: c2 + 52,
            ei: c2 + blocReelaborat.length - 1,
          },
          t0 + 20_000,
          'u1',
          5,
        ],
      ],
    };

    const res = analyzeDocumentHistory(history, { bulkThresholdChars: 50 });
    expect(res.bulkInsertions).toHaveLength(3);
    expect(res.bulkInsertions[0].status).toBe('conservat');
    expect(res.bulkInsertions[0].paragraphNumber).toBe(1);

    expect(res.bulkInsertions[1].status).toBe('eliminat');
    expect(res.bulkInsertions[1].paragraphNumber).toBeNull();

    expect(res.bulkInsertions[2].status).toBe('reelaborat');
    expect(res.bulkInsertions[2].paragraphNumber).toBe(2);
  });

  it('Cas K (Classroom): separa la plantilla inicial chunkedSnapshot de les insercions de l’alumne', () => {
    const t0 = 1_700_000_000_000;
    const template = 'Enunciat del professor: expliqueu les causes del conflicte.\n';
    const resposta = 'La causa principal va ser la crisi agrària.';

    const history: RawDocumentHistory = {
      docId: 'test-classroom',
      title: 'Tasca Classroom',
      firstRev: 4,
      lastRev: 5,
      fetchedAt: t0,
      userMap: { u1: { name: 'Alumne C' } },
      chunkedSnapshot: [[{ ty: 'is', ibi: 1, s: template }]],
      changelog: [
        [{ ty: 'is', ibi: template.length + 1, s: resposta }, t0, 'u1', 4],
      ],
    };

    const res = analyzeDocumentHistory(history, { bulkThresholdChars: 100 });
    expect(res.coverage.hasTemplateBaseline).toBe(true);
    expect(res.templatePct).toBeGreaterThan(40);
    expect(res.bulkInsertions).toHaveLength(0);
    expect(res.paragraphs).toHaveLength(2);
  });

  it('Casos G i H: separa sessions per inactivitat i no duplica temps simultani de dos autors', () => {
    const t0 = 1_700_000_000_000;
    const min = 60_000;
    const history: RawDocumentHistory = {
      docId: 'test-sessions',
      title: ' Treball cooperatiu',
      firstRev: 1,
      lastRev: 6,
      fetchedAt: t0,
      userMap: {
        u1: { name: 'Autor 1' },
        u2: { name: 'Autor 2' },
      },
      changelog: [
        // Sessió 1: u1 i u2 editen simultàniament durant 4 minuts
        [{ ty: 'is', ibi: 1, s: 'Inici ' }, t0, 'u1', 1],
        [{ ty: 'is', ibi: 7, s: 'cooperatiu ' }, t0 + 2 * min, 'u2', 2],
        [{ ty: 'is', ibi: 18, s: 'actiu. ' }, t0 + 4 * min, 'u1', 3],
        // Pausa de 20 minuts -> Sessió 2 de 2 minuts
        [{ ty: 'is', ibi: 25, s: 'Segona ' }, t0 + 24 * min, 'u2', 4],
        [{ ty: 'is', ibi: 32, s: 'sessió.' }, t0 + 26 * min, 'u2', 5],
      ],
    };

    const res = analyzeDocumentHistory(history, { sessionGapMinutes: 5 });
    expect(res.sessionCount).toBe(2);
    // 4 min + 2 min + crèdit base de 2 sessions (40 s) ~= 6.7 min (mai el doble per ser 2 autors)
    expect(res.totalActiveMinutes).toBeGreaterThanOrEqual(6);
    expect(res.totalActiveMinutes).toBeLessThanOrEqual(7.5);
    expect(res.authors).toHaveLength(2);
  });

  it('valida els tres escenaris de demostració integrats sense cap desquadrament', () => {
    for (const scenario of DEMO_SCENARIOS) {
      const data = scenario.build();
      const analysis = analyzeDocumentHistory(data);
      expect(analysis.finalWordCount).toBeGreaterThan(40);
      expect(analysis.coverage.clampedOperations).toBe(0);
      expect(analysis.progressivePct + analysis.bulkPct + analysis.templatePct).toBe(
        100
      );
    }
  });
});
