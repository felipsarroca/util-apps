// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DocumentAnalysis } from '../../types';
import { formatDateTime, formatDuration } from '../../core/exporters';
import { EvolutionChart } from './EvolutionChart';
import { Icon } from './Icon';

interface SummaryTabProps {
  analysis: DocumentAnalysis;
  onJumpToInsertions: (opId?: number) => void;
  onJumpToMap: () => void;
  onJumpToSessions: () => void;
}

export function SummaryTab({
  analysis,
  onJumpToInsertions,
  onJumpToMap,
  onJumpToSessions,
}: SummaryTabProps) {
  const keptBulks = analysis.bulkInsertions.filter((b) => b.status === 'conservat').length;
  const reworkedBulks = analysis.bulkInsertions.filter((b) => b.status === 'reelaborat').length;
  const deletedBulks = analysis.bulkInsertions.filter((b) => b.status === 'eliminat').length;
  const wordsPerMin =
    analysis.totalActiveSeconds > 0
      ? Math.round(analysis.finalWordCount / Math.max(0.4, analysis.totalActiveSeconds / 60))
      : 0;

  // Objective process profile badge
  let profileTone: 'calm' | 'mixed' | 'attention' = 'calm';
  let profileTitle = 'Redacció majoritàriament progressiva';
  let profileDetail = `${analysis.progressivePct}\u00A0% del text final escrit pas a pas en ${analysis.sessionCount} ${
    analysis.sessionCount === 1 ? 'sessió' : 'sessions'
  }.`;

  if (analysis.bulkPct >= 55) {
    profileTone = 'attention';
    profileTitle = 'Predomini d’insercions en bloc';
    profileDetail = `El ${analysis.bulkPct}\u00A0% del text final prové de fragments incorporats de cop (temps actiu: ${formatDuration(
      analysis.totalActiveSeconds
    )}).`;
  } else if (analysis.bulkPct >= 20 || analysis.bulkInsertions.length > 0) {
    profileTone = 'mixed';
    profileTitle = 'Procés mixt (escriptura i blocs)';
    profileDetail =
      reworkedBulks > 0
        ? `Combina redacció pròpia (${analysis.progressivePct}\u00A0%) amb blocs, ${reworkedBulks} dels quals reelaborats.`
        : `Combina redacció progressiva (${analysis.progressivePct}\u00A0%) i ${analysis.bulkInsertions.length} ${
            analysis.bulkInsertions.length === 1 ? 'inserció' : 'insercions'
          } en bloc (${analysis.bulkPct}\u00A0%).`;
  }

  return (
    <div className="tab-stack">
      {/* Coverage warning only when partial or notable */}
      {analysis.coverage.notes.length > 0 && (
        <div
          className={`coverage-banner coverage-${analysis.coverage.level}`}
          role="status"
        >
          <Icon
            name={analysis.coverage.level === 'alta' ? 'check-circle' : 'alert-triangle'}
            size={15}
          />
          <div>
            {analysis.coverage.notes.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </div>
        </div>
      )}

      {/* Visual diagnostic strip */}
      <div className={`process-banner tone-${profileTone}`}>
        <div className="process-banner-head">
          <span className="process-dot" />
          <strong>{profileTitle}</strong>
        </div>
        <p>{profileDetail}</p>
      </div>

      {/* 4 compact KPI cards */}
      <div className="kpi-grid">
        <button
          type="button"
          className="kpi-card kpi-interactive"
          onClick={onJumpToSessions}
          title="Mostra el detall de sessions"
        >
          <div className="kpi-top">
            <Icon name="clock" size={14} />
            <span>Temps actiu</span>
          </div>
          <strong className="kpi-value tabular">
            {formatDuration(analysis.totalActiveSeconds)}
          </strong>
          <span className="kpi-sub tabular">
            {analysis.sessionCount}{' '}
            {analysis.sessionCount === 1 ? 'sessió' : 'sessions'}
          </span>
        </button>

        <button
          type="button"
          className="kpi-card kpi-interactive"
          onClick={onJumpToMap}
          title="Obre el mapa acolorit del text"
        >
          <div className="kpi-top">
            <Icon name="file-text" size={14} />
            <span>Paraules finals</span>
          </div>
          <strong className="kpi-value tabular">{analysis.finalWordCount}</strong>
          <span className="kpi-sub tabular">{analysis.totalOperations} edicions</span>
        </button>

        <button
          type="button"
          className="kpi-card kpi-interactive"
          onClick={() => onJumpToInsertions()}
          title="Inspecciona les insercions en bloc"
        >
          <div className="kpi-top">
            <Icon name="scissors" size={14} />
            <span>Blocs (&ge;{analysis.settings.bulkThresholdChars})</span>
          </div>
          <strong
            className={`kpi-value tabular ${
              analysis.bulkInsertions.length > 0 ? 'text-amber' : ''
            }`}
          >
            {analysis.bulkInsertions.length}
          </strong>
          <span className="kpi-sub tabular">
            {analysis.bulkInsertions.length === 0
              ? 'Cap bloc gran'
              : `${keptBulks} cons. · ${reworkedBulks} reelab.${
                  deletedBulks > 0 ? ` · ${deletedBulks} elim.` : ''
                }`}
          </span>
        </button>

        <button
          type="button"
          className="kpi-card kpi-interactive"
          onClick={onJumpToSessions}
          title="Mostra l'activitat per autor"
        >
          <div className="kpi-top">
            <Icon name="users" size={14} />
            <span>Autors</span>
          </div>
          <strong className="kpi-value tabular">{analysis.authors.length}</strong>
          <span className="kpi-sub truncate">
            {analysis.authors[0]?.name || '—'}
          </span>
        </button>
      </div>

      {/* Stacked bar: Composition of final document */}
      <section className="panel-card">
        <div className="card-head">
          <h2>Composició del text final</h2>
          <button type="button" className="link-btn" onClick={onJumpToMap}>
            Mapa del text <Icon name="chevron-right" size={13} />
          </button>
        </div>

        <div
          className="composition-bar"
          role="img"
          aria-label={`Progressiu ${analysis.progressivePct}%, en bloc ${analysis.bulkPct}%, plantilla ${analysis.templatePct}%`}
        >
          {analysis.progressivePct > 0 && (
            <div
              className="comp-seg comp-progressive"
              style={{ width: `${analysis.progressivePct}%` }}
              title={`Escriptura progressiva: ${analysis.progressivePct} %`}
            />
          )}
          {analysis.bulkPct > 0 && (
            <div
              className="comp-seg comp-bulk"
              style={{ width: `${analysis.bulkPct}%` }}
              title={`Inserit en bloc i conservat: ${analysis.bulkPct} %`}
            />
          )}
          {analysis.templatePct > 0 && (
            <div
              className="comp-seg comp-template"
              style={{ width: `${analysis.templatePct}%` }}
              title={`Plantilla inicial: ${analysis.templatePct} %`}
            />
          )}
        </div>

        <div className="comp-legend">
          <div className="comp-item">
            <span className="swatch swatch-progressive" />
            <span>Progressiu</span>
            <strong className="tabular">{analysis.progressivePct} %</strong>
          </div>
          <div className="comp-item">
            <span className="swatch swatch-bulk" />
            <span>En bloc</span>
            <strong className="tabular">{analysis.bulkPct} %</strong>
          </div>
          {analysis.templatePct > 0 && (
            <div className="comp-item">
              <span className="swatch swatch-template" />
              <span>Plantilla</span>
              <strong className="tabular">{analysis.templatePct} %</strong>
            </div>
          )}
        </div>
      </section>

      {/* Evolution SVG chart */}
      <section className="panel-card">
        <div className="card-head">
          <h2>Evolució de paraules</h2>
          <div className="head-badges">
            {wordsPerMin > 0 && (
              <span className="subtle-badge tabular" title="Ritme aparent (paraules finals / minut actiu)">
                ~{wordsPerMin} par./min
              </span>
            )}
            <span className="subtle-badge tabular">
              {analysis.sessions.length}{' '}
              {analysis.sessions.length === 1 ? 'sessió' : 'sessions'}
            </span>
          </div>
        </div>
        {analysis.firstEditTime && analysis.lastEditTime && (
          <div className="timespan-strip tabular">
            <span>Inici: {formatDateTime(analysis.firstEditTime)}</span>
            <span>Darrera edició: {formatDateTime(analysis.lastEditTime)}</span>
          </div>
        )}
        <EvolutionChart
          points={analysis.timeline}
          onSelectBulkInsertion={(opId) => onJumpToInsertions(opId)}
        />
      </section>
    </div>
  );
}
