// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DocumentAnalysis, RawDocumentHistory } from '../types';

export function formatDateTime(ts: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('ca-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('ca-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('ca-ES', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${Math.max(1, Math.round(totalSeconds))} s`;
  }
  const totalMin = Math.round(totalSeconds / 60);
  if (totalMin < 60) {
    return `${totalMin} min`;
  }
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'document'
  );
}

export function exportAnalysisCsv(analysis: DocumentAnalysis): void {
  const esc = (val: string | number | null | undefined) => {
    const s = String(val ?? '').replace(/\r?\n/g, ' ');
    if (/[";,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines: string[] = [
    '# Resum del document',
    'Document;Paraules finals;Temps actiu (min);Sessions;Operacions;Progressiu (%);En bloc (%);Plantilla (%)',
    [
      esc(analysis.title),
      analysis.finalWordCount,
      analysis.totalActiveMinutes,
      analysis.sessionCount,
      analysis.totalOperations,
      analysis.progressivePct,
      analysis.bulkPct,
      analysis.templatePct,
    ].join(';'),
    '',
    `# Insercions en bloc (>= ${analysis.settings.bulkThresholdChars} caracters)`,
    'Data i hora;Autor;Paraules;Caracters;Estat;Conservat (%);Paragraf;Fragment',
    ...analysis.bulkInsertions.map((ins) =>
      [
        esc(formatDateTime(ins.timestamp)),
        esc(ins.authorName),
        ins.wordCount,
        ins.charCount,
        esc(ins.status),
        Math.round(ins.retentionRatio * 100),
        ins.paragraphNumber ?? 'Eliminat',
        esc(ins.previewSnippet),
      ].join(';')
    ),
    '',
    '# Sessions de treball',
    'Sessio;Inici;Final;Durada (min);Operacions;Caracters inserits;Caracters eliminats;Insercions en bloc;Autors',
    ...analysis.sessions.map((s) =>
      [
        s.index,
        esc(formatDateTime(s.startTime)),
        esc(formatDateTime(s.endTime)),
        s.durationMinutes,
        s.operationCount,
        s.charsInserted,
        s.charsDeleted,
        s.bulkInsertionsCount,
        esc(s.authors.map((a) => a.name).join(', ')),
      ].join(';')
    ),
  ];

  downloadBlob(
    '\uFEFF' + lines.join('\r\n'),
    `traces-${slugify(analysis.title)}.csv`,
    'text/csv;charset=utf-8'
  );
}

export function exportRawJson(history: RawDocumentHistory): void {
  downloadBlob(
    JSON.stringify(history, null, 2),
    `traces-historial-${slugify(history.title)}.json`,
    'application/json;charset=utf-8'
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printAnalysisReport(analysis: DocumentAnalysis): void {
  const statusLabel: Record<string, string> = {
    conservat: 'Conservat',
    reelaborat: 'Reelaborat',
    eliminat: 'Eliminat',
  };

  const html = `<!doctype html>
<html lang="ca">
<head>
  <meta charset="utf-8">
  <title>Informe Traces — ${escapeHtml(analysis.title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 28px 36px; line-height: 1.45; font-size: 13px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; color: #1e293b; }
    .meta { color: #475569; font-size: 12px; margin-bottom: 16px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; background: #f8fafc; }
    .kpi strong { display: block; font-size: 18px; color: #0f172a; }
    .kpi span { font-size: 11px; color: #475569; }
    .bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; background: #e2e8f0; margin: 6px 0 4px; }
    .seg-prog { background: #0d9488; }
    .seg-bulk { background: #d97706; }
    .seg-tpl { background: #94a3b8; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    .note { margin-top: 18px; padding: 10px 12px; background: #f8fafc; border-left: 3px solid #0284c7; font-size: 11.5px; color: #334155; text-align: justify; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>Traces — Informe d'elaboració del document</h1>
  <div class="meta">
    <strong>Document:</strong> ${escapeHtml(analysis.title)} ·
    <strong>Data d'anàlisi:</strong> ${escapeHtml(formatDateTime(analysis.analyzedAt))} ·
    <strong>Cobertura:</strong> ${escapeHtml(analysis.coverage.label)}
  </div>

  <div class="kpis">
    <div class="kpi"><strong>${escapeHtml(formatDuration(analysis.totalActiveSeconds))}</strong><span>Temps actiu estimat</span></div>
    <div class="kpi"><strong>${analysis.sessionCount}</strong><span>Sessions (pausa &gt; ${analysis.settings.sessionGapMinutes} min)</span></div>
    <div class="kpi"><strong>${analysis.finalWordCount}</strong><span>Paraules finals (${analysis.totalOperations} edicions)</span></div>
    <div class="kpi"><strong>${analysis.bulkInsertions.length}</strong><span>Insercions en bloc (&ge; ${analysis.settings.bulkThresholdChars} car.)</span></div>
  </div>

  <h2>Origen del text final</h2>
  <div class="bar">
    <div class="seg-prog" style="width:${analysis.progressivePct}%"></div>
    <div class="seg-bulk" style="width:${analysis.bulkPct}%"></div>
    <div class="seg-tpl" style="width:${analysis.templatePct}%"></div>
  </div>
  <div>
    Escriptura progressiva: <strong>${analysis.progressivePct} %</strong> ·
    Inserit en bloc i conservat: <strong>${analysis.bulkPct} %</strong>
    ${analysis.templatePct > 0 ? ` · Plantilla inicial: <strong>${analysis.templatePct} %</strong>` : ''}
  </div>

  <h2>Insercions en bloc detectades (&ge; ${analysis.settings.bulkThresholdChars} caràcters)</h2>
  ${
    analysis.bulkInsertions.length === 0
      ? '<p>No s’ha detectat cap inserció en bloc amb el llindar actual.</p>'
      : `<table>
    <thead><tr><th>Data i hora</th><th>Autor</th><th>Mida</th><th>Ubicació</th><th>Estat</th><th>Text inserit</th></tr></thead>
    <tbody>
      ${analysis.bulkInsertions
        .map(
          (ins) => `<tr>
        <td>${escapeHtml(formatDateTime(ins.timestamp))}</td>
        <td>${escapeHtml(ins.authorName)}</td>
        <td>${ins.wordCount} par. (${ins.charCount} car.)</td>
        <td>${ins.paragraphNumber ? `Paràgraf ${ins.paragraphNumber}` : '—'}</td>
        <td>${escapeHtml(statusLabel[ins.status] || ins.status)} (${Math.round(ins.retentionRatio * 100)} %)</td>
        <td>${escapeHtml(ins.previewSnippet)}</td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>`
  }

  <h2>Sessions de treball</h2>
  <table>
    <thead><tr><th>#</th><th>Inici</th><th>Final</th><th>Durada</th><th>Edicions</th><th>Autors</th></tr></thead>
    <tbody>
      ${analysis.sessions
        .map(
          (s) => `<tr>
        <td>${s.index}</td>
        <td>${escapeHtml(formatDateTime(s.startTime))}</td>
        <td>${escapeHtml(formatShortTime(s.endTime))}</td>
        <td>${escapeHtml(formatDuration(s.durationSeconds))}</td>
        <td>${s.operationCount}</td>
        <td>${escapeHtml(s.authors.map((a) => a.name).join(', '))}</td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>

  <h2>Participació per autor</h2>
  <table>
    <thead><tr><th>Autor</th><th>Temps actiu</th><th>Sessions</th><th>Edicions</th><th>Presència al text final</th></tr></thead>
    <tbody>
      ${analysis.authors
        .map(
          (a) => `<tr>
        <td>${escapeHtml(a.name)}</td>
        <td>${a.activeMinutes} min</td>
        <td>${a.sessionCount}</td>
        <td>${a.operationCount} (${a.operationSharePct} %)</td>
        <td>${a.survivingSharePct} %</td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>

  <div class="note">
    <strong>Nota metodològica:</strong> Traces mostra evidències objectives sobre el procés temporal d’escriptura a Google Docs. Una inserció en bloc indica que un fragment s’ha incorporat d’una sola vegada (pot correspondre a copiar i enganxar, esborrany previ en un altre suport, dictat per veu, traducció o sincronització fora de línia) i no demostra per si mateixa plagi ni ús d’intel·ligència artificial. Valoreu sempre les dades en context amb l’alumne.
  </div>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=880,height=760');
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
}
