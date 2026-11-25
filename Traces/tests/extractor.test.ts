// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  detectActiveGoogleDoc,
  ExtractionError,
  extractGoogleDocHistory,
} from '../src/extractor/gdocsExtractor';

describe('Traces — Extractor de Google Docs i Classroom (simulació API Chrome MV3)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('extreu correctament de Google Classroom (iframe amb /u/1/ i tab=t.0) i neteja el prefix XSSI', async () => {
    const requestedUrls: string[] = [];

    const mockChrome = {
      runtime: { id: 'mock-ext-id' },
      tabs: {
        query: vi.fn().mockResolvedValue([
          {
            id: 42,
            url: 'https://classroom.google.com/u/1/c/123/a/456/submissions/by-status/and-sort-name/student/789',
            title: 'Qualificador Classroom',
          },
        ]),
      },
      scripting: {
        executeScript: vi.fn().mockImplementation(async (opts: { target: { allFrames?: boolean; frameIds?: number[] }; args?: string[] }) => {
          // 1. Crida de sondeig amb allFrames: true (frame 0 = Classroom, frame 4 = Google Doc incrustat)
          if (opts.target.allFrames) {
            return [
              { frameId: 0, result: null },
              {
                frameId: 4,
                result: {
                  isGoogleDoc: true,
                  kind: 'document',
                  docId: 'DOC_CLASSROOM_99',
                  title: 'Treball de Socials — Alumne Prova',
                  userPrefix: 'u/1',
                  tabParam: 't.0',
                  token: 'xsrf_secret_token_123',
                  isViewOnlyHint: false,
                },
              },
            ];
          }

          // 2. Sondeig específic sobre frameId 4 sense args
          if (!opts.args || opts.args.length === 0) {
            return [
              {
                frameId: 4,
                result: {
                  isGoogleDoc: true,
                  kind: 'document',
                  docId: 'DOC_CLASSROOM_99',
                  title: 'Treball de Socials — Alumne Prova',
                  userPrefix: 'u/1',
                  tabParam: 't.0',
                  token: 'xsrf_secret_token_123',
                  isViewOnlyHint: false,
                },
              },
            ];
          }

          // 3. Crida fetch dins del frame de Google Docs
          const targetUrl = opts.args[0];
          requestedUrls.push(targetUrl);

          if (targetUrl.includes('/revisions/tiles')) {
            return [
              {
                frameId: 4,
                result: {
                  ok: true,
                  status: 200,
                  body:
                    ")]}'\n" +
                    JSON.stringify({
                      firstRev: 2,
                      tileInfo: [{ start: 2, end: 3, endMillis: 1700000010000 }],
                      userMap: {
                        u_estudiant: { name: 'Jordi Serra', color: '#0284C7' },
                      },
                    }),
                },
              },
            ];
          }

          if (targetUrl.includes('/revisions/load')) {
            return [
              {
                frameId: 4,
                result: {
                  ok: true,
                  status: 200,
                  body:
                    ")]}'\n" +
                    JSON.stringify({
                      chunkedSnapshot: [[{ ty: 'is', ibi: 1, s: 'Enunciat Classroom\n' }]],
                      changelog: [
                        [{ ty: 'is', ibi: 20, s: 'Resposta escrita a classe.' }, 1700000005000, 'u_estudiant', 2],
                        [{ ty: 'is', ibi: 46, s: ' Segona frase.' }, 1700000010000, 'u_estudiant', 3],
                      ],
                    }),
                },
              },
            ];
          }

          return [{ frameId: 4, result: { ok: false, status: 404, body: '' } }];
        }),
      },
    };

    vi.stubGlobal('chrome', mockChrome);

    const candidate = await detectActiveGoogleDoc();
    expect(candidate).not.toBeNull();
    expect(candidate?.isInsideClassroom).toBe(true);
    expect(candidate?.frameId).toBe(4);
    expect(candidate?.userPrefix).toBe('u/1');

    const history = await extractGoogleDocHistory();
    expect(history.docId).toBe('DOC_CLASSROOM_99');
    expect(history.title).toBe('Treball de Socials — Alumne Prova');
    expect(history.firstRev).toBe(2);
    expect(history.lastRev).toBe(3);
    expect(history.changelog).toHaveLength(2);
    expect(history.userMap.u_estudiant.name).toBe('Jordi Serra');

    // Comprova que ha preservat /u/1/, token i tab=t.0
    expect(requestedUrls[0]).toContain('https://docs.google.com/document/u/1/d/DOC_CLASSROOM_99/revisions/tiles');
    expect(requestedUrls[0]).toContain('token=xsrf_secret_token_123');
    expect(requestedUrls[0]).toContain('tab=t.0');
  });

  it('fa fallback sense tab quan el document antic retorna HTTP 400 i gestiona errors 403 de permisos', async () => {
    let simulateForbidden = false;

    const mockChrome = {
      runtime: { id: 'mock-ext-id' },
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 7, url: 'https://docs.google.com/document/d/LEGACY_DOC/edit', title: 'Doc antic' },
        ]),
      },
      scripting: {
        executeScript: vi.fn().mockImplementation(async (opts: { args?: string[] }) => {
          if (!opts.args || opts.args.length === 0) {
            return [
              {
                frameId: 0,
                result: {
                  isGoogleDoc: true,
                  kind: 'document',
                  docId: 'LEGACY_DOC',
                  title: 'Doc antic',
                  userPrefix: '',
                  tabParam: '',
                  token: 'tok',
                  isViewOnlyHint: false,
                },
              },
            ];
          }

          const url = opts.args[0];
          if (simulateForbidden) {
            return [{ frameId: 0, result: { ok: false, status: 403, body: 'Forbidden' } }];
          }

          // Rebutja amb 400 si porta tab=t.0
          if (url.includes('tab=')) {
            return [{ frameId: 0, result: { ok: false, status: 400, body: 'Bad Request' } }];
          }

          if (url.includes('revisions/tiles')) {
            return [
              {
                frameId: 0,
                result: {
                  ok: true,
                  status: 200,
                  body: ")]}'\n" + JSON.stringify({ firstRev: 1, tileInfo: [{ start: 1, end: 1 }], userMap: {} }),
                },
              },
            ];
          }

          return [
            {
              frameId: 0,
              result: {
                ok: true,
                status: 200,
                body: ")]}'\n" + JSON.stringify({ changelog: [[{ ty: 'is', ibi: 1, s: 'Ok' }, 1700000000000, 'u1', 1]] }),
              },
            },
          ];
        }),
      },
    };

    vi.stubGlobal('chrome', mockChrome);

    const okHistory = await extractGoogleDocHistory();
    expect(okHistory.changelog).toHaveLength(1);

    simulateForbidden = true;
    await expect(extractGoogleDocHistory()).rejects.toThrowError(ExtractionError);
    await expect(extractGoogleDocHistory()).rejects.toMatchObject({
      code: 'NO_PERMISSION',
    });
  });
});
