// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DocumentAnalysis, RawDocumentHistory, StoredSummary } from '../types';

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

function reportChartSvg(analysis: DocumentAnalysis): string {
  const pts = analysis.timeline;
  if (pts.length < 2) return '';
  const W = 520;
  const H = 120;
  const max = Math.max(10, ...pts.map((p) => p.wordCount));
  const x = (v: number) => 30 + v * (W - 40);
  const y = (v: number) => 10 + (1 - v / max) * (H - 30);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.activeX).toFixed(1)} ${y(p.wordCount).toFixed(1)}`).join(' ');
  const dots = pts
    .filter((p) => p.bulkInsertion)
    .map(
      (p) =>
        `<circle cx="${x(p.activeX).toFixed(1)}" cy="${y(p.wordCount).toFixed(1)}" r="4" fill="#F59E0B" stroke="#fff" stroke-width="1.5"/>`
    )
    .join('');
  const breaks: string[] = [];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].sessionIndex !== pts[i - 1].sessionIndex) {
      const bx = x((pts[i].activeX + pts[i - 1].activeX) / 2).toFixed(1);
      breaks.push(`<line x1="${bx}" y1="10" x2="${bx}" y2="${H - 20}" stroke="#CBD5E1" stroke-dasharray="2 2"/>`);
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <line x1="30" y1="${H - 20}" x2="${W - 10}" y2="${H - 20}" stroke="#E2E8F0"/>
    ${breaks.join('')}
    <path d="${line}" fill="none" stroke="#0284C7" stroke-width="2"/>
    ${dots}
    <text x="26" y="14" text-anchor="end" font-size="9" fill="#64748B">${max}</text>
    <text x="30" y="${H - 6}" font-size="9" fill="#64748B">0</text>
    <text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="9" fill="#94A3B8">temps de treball</text>
    <text x="${W - 10}" y="${H - 6}" text-anchor="end" font-size="9" fill="#64748B">${escapeHtml(
      formatDuration(analysis.totalActiveSeconds)
    )}</text>
  </svg>`;
}

function reportDaysHtml(analysis: DocumentAnalysis): string {
  const max = Math.max(60, ...analysis.workDays.map((d) => d.activeSeconds));
  return analysis.workDays
    .map((d) => {
      const h = Math.max(8, Math.round((d.activeSeconds / max) * 44));
      const dt = new Date(d.dayStart);
      return `<div class="day"><div class="dbar${d.bulkCount ? ' dbulk' : ''}" style="height:${h}px"></div><span>${dt.getDate()}/${
        dt.getMonth() + 1
      }</span><small>${escapeHtml(formatDuration(d.activeSeconds))}</small></div>`;
    })
    .join('');
}

export interface ReportDeadline {
  deadline: number;
  last24hPct: number;
  lateSeconds: number;
}

/** Informe d'una pàgina, net i imprimible (o desable en PDF). */
export function printAnalysisReport(analysis: DocumentAnalysis, deadline?: ReportDeadline | null): void {
  const a = analysis;
  const isSheet = a.kind === 'spreadsheet';
  const kindLabel = a.kind === 'presentation' ? 'Presentació' : isSheet ? 'Full de càlcul' : 'Document';
  const big: Array<[string, string]> = isSheet
    ? [
        [formatDuration(a.totalActiveSeconds), 'de treball actiu'],
        [String(a.sheet?.cellsTyped ?? 0), 'cel·les escrites a mà'],
        [String(a.sheet?.cellsPasted ?? 0), 'cel·les enganxades'],
      ]
    : [
        [formatDuration(a.totalActiveSeconds), 'de treball actiu'],
        [`${a.progressivePct} %`, 'escrit pas a pas'],
        [`${a.bulkPct} %`, 'enganxat'],
      ];
  const facts = [
    `${a.sessionCount} ${a.sessionCount === 1 ? 'sessió' : 'sessions'}`,
    `${a.workDays.length} ${a.workDays.length === 1 ? 'dia' : 'dies'}`,
    isSheet ? `${(a.sheet?.formulasTyped ?? 0) + (a.sheet?.formulasPasted ?? 0)} fórmules` : `${a.finalWordCount} paraules`,
    a.firstEditTime ? `del ${formatDateTime(a.firstEditTime)} al ${formatDateTime(a.lastEditTime)}` : '',
  ].filter(Boolean);
  const statusLabel: Record<string, string> = { conservat: 'conservat', reelaborat: 'reelaborat', eliminat: 'eliminat' };
  const pasteRows = isSheet
    ? (a.sheet?.pastes ?? []).slice(0, 6).map(
        (p) =>
          `<tr><td>${escapeHtml(formatDateTime(p.timestamp))}</td><td>${escapeHtml(p.sheetName)} · ${escapeHtml(
            p.rangeLabel
          )}</td><td>${p.cells} cel·les</td><td>${escapeHtml(p.preview)}</td></tr>`
      )
    : a.bulkInsertions
        .slice(0, 6)
        .map(
          (b) =>
            `<tr><td>${escapeHtml(formatDateTime(b.timestamp))}</td><td>${b.wordCount} par.</td><td>${escapeHtml(
              statusLabel[b.status] ?? b.status
            )}</td><td>${escapeHtml(b.previewSnippet)}</td></tr>`
        );
  const totalPastes = isSheet ? a.sheet?.pastes.length ?? 0 : a.bulkInsertions.length;
  const more = totalPastes - pasteRows.length;

  const html = `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<title>Traces — ${escapeHtml(a.title)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0f172a; margin: 16px auto; max-width: 182mm; font-size: 12px; line-height: 1.45; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0284C7; padding-bottom: 8px; margin-bottom: 14px; }
  h1 { font-size: 19px; margin: 0; }
  .sub { color: #475569; font-size: 11.5px; }
  .brand { color: #0284C7; font-weight: 700; font-size: 13px; text-align: right; }
  .big { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px; }
  .big div { border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 12px; background: #F8FAFC; }
  .big strong { display: block; font-size: 22px; }
  .big span { color: #475569; font-size: 11px; }
  .big .prog strong { color: #0F766E; } .big .bulk strong { color: #B45309; }
  .facts { color: #334155; margin: 0 0 10px; }
  .bar { display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: #E2E8F0; margin: 6px 0 14px; }
  .p { background: #0D9488; } .b { background: #D97706; } .t { background: #94A3B8; }
  h2 { font-size: 12px; margin: 14px 0 6px; color: #1E293B; text-transform: uppercase; letter-spacing: .04em; }
  .days { display: flex; gap: 6px; align-items: flex-end; flex-wrap: wrap; }
  .day { display: flex; flex-direction: column; align-items: center; width: 44px; }
  .dbar { width: 18px; background: #0284C7; border-radius: 3px 3px 0 0; } .dbulk { background: #D97706; }
  .day span { font-size: 10px; color: #334155; } .day small { font-size: 9px; color: #64748B; }
  .deadline { margin: 8px 0 0; padding: 6px 10px; border-left: 3px solid #0284C7; background: #F0F9FF; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border-bottom: 1px solid #E2E8F0; padding: 4px 6px; text-align: left; vertical-align: top; }
  .note { margin-top: 16px; font-size: 10.5px; color: #475569; text-align: justify; border-top: 1px solid #E2E8F0; padding-top: 8px; }
</style>
</head>
<body>
<header>
  <div>
    <h1>${escapeHtml(a.mainAuthorName || a.title)}</h1>
    <div class="sub">${escapeHtml(kindLabel)}: ${escapeHtml(a.title)} · analitzat el ${escapeHtml(
      formatDateTime(a.analyzedAt)
    )} · dades: ${escapeHtml(a.coverage.label.toLowerCase())}</div>
  </div>
  <div class="brand">Traces<br><span class="sub">Procés d’elaboració</span></div>
</header>

<div class="big">
  ${big
    .map(
      (b, i) =>
        `<div class="${i === 1 ? 'prog' : i === 2 ? 'bulk' : ''}"><strong>${escapeHtml(b[0])}</strong><span>${escapeHtml(b[1])}</span></div>`
    )
    .join('')}
</div>
<p class="facts">${facts.map(escapeHtml).join(' · ')}</p>
${
  isSheet
    ? ''
    : `<div class="bar"><div class="p" style="width:${a.progressivePct}%"></div><div class="b" style="width:${a.bulkPct}%"></div><div class="t" style="width:${a.templatePct}%"></div></div>`
}

<h2>Dies de treball</h2>
<div class="days">${reportDaysHtml(a)}</div>
${
  deadline
    ? `<p class="deadline">Lliurament: <strong>${escapeHtml(formatDateTime(deadline.deadline))}</strong> · ${
        deadline.last24hPct
      } % del treball les últimes 24 h${
        deadline.lateSeconds > 0 ? ` · ${escapeHtml(formatDuration(deadline.lateSeconds))} després del termini` : ''
      }</p>`
    : ''
}

<h2>Evolució sobre el temps de treball</h2>
${reportChartSvg(a)}

<h2>${isSheet ? 'Dades enganxades' : 'Fragments enganxats'}</h2>
${
  pasteRows.length
    ? `<table><tbody>${pasteRows.join('')}</tbody></table>${more > 0 ? `<p class="sub">I ${more} més.</p>` : ''}`
    : '<p class="sub">Cap.</p>'
}

${
  a.authors.length > 1
    ? `<h2>Autors</h2><table><tbody>${a.authors
        .map(
          (x) =>
            `<tr><td>${escapeHtml(x.name)}</td><td>${x.activeMinutes} min</td><td>${x.survivingSharePct} % del resultat final</td></tr>`
        )
        .join('')}</tbody></table>`
    : ''
}

<p class="note">Traces descriu com s’ha construït el fitxer a partir del seu historial d’edicions. «Enganxat» vol dir que un fragment va entrar d’un sol cop: pot ser copiat, però també un esborrany propi, un dictat o una traducció. No és un detector d’IA ni prova res per si sol: és un punt de partida per parlar amb l’alumne.</p>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=800');
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch {
        // L'usuari pot imprimir amb Ctrl+P
      }
    }, 400);
  }
}

/** Taula de la classe en CSV (només resums). */
export function exportClassCsv(rows: StoredSummary[], group: string): void {
  const esc = (val: string | number | null | undefined) => {
    const s = String(val ?? '').replace(/\r?\n/g, ' ');
    return /[";,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    'Alumne;Fitxer;Temps actiu (min);Sessions;Dies;Paraules;Escrit pas a pas (%);Enganxat (%);Fragments enganxats;Correccions (%);Ultim dia (%);Primera edicio;Ultima edicio;Enllac',
    ...rows.map((r) =>
      [
        esc(r.mainAuthor),
        esc(r.title),
        Math.round(r.activeSeconds / 60),
        r.sessions,
        r.days,
        r.words,
        r.progressivePct,
        r.bulkPct,
        r.bulkCount,
        r.deletionPct,
        r.lastDaySharePct,
        esc(formatDateTime(r.firstEdit)),
        esc(formatDateTime(r.lastEdit)),
        esc(r.url ?? ''),
      ].join(';')
    ),
  ];
  downloadBlob('﻿' + lines.join('\r\n'), `traces-classe-${slugify(group)}.csv`, 'text/csv;charset=utf-8');
}

/** Frase breu i neutra per a notes o per al comentari privat de Classroom. */
export function buildSummaryText(
  analysis: DocumentAnalysis,
  deadline?: { deadline: number; last24hPct: number; lateSeconds: number } | null
): string {
  const parts: string[] = [];
  const days = analysis.workDays.length;
  parts.push(
    `${formatDuration(analysis.totalActiveSeconds)} de treball actiu en ${analysis.sessionCount} ${
      analysis.sessionCount === 1 ? 'sessió' : 'sessions'
    } (${days} ${days === 1 ? 'dia' : 'dies'}).`
  );
  if (analysis.kind === 'spreadsheet' && analysis.sheet) {
    const s = analysis.sheet;
    parts.push(
      `${s.cellsTyped} cel·les escrites a mà, ${s.cellsPasted} enganxades i ${s.formulasTyped + s.formulasPasted} fórmules.`
    );
  } else {
    parts.push(
      `${analysis.progressivePct} % del text escrit pas a pas i ${analysis.bulkPct} % incorporat en blocs enganxats (${analysis.finalWordCount} paraules).`
    );
  }
  if (deadline) {
    if (deadline.lateSeconds > 0) parts.push(`${formatDuration(deadline.lateSeconds)} de treball després de la data de lliurament.`);
    else if (deadline.last24hPct >= 60) parts.push(`El ${deadline.last24hPct} % del treball es va fer les últimes 24 hores.`);
  }
  return `Procés de treball (Traces): ${parts.join(' ')}`;
}
