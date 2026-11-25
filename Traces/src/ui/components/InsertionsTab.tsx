// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'react';
import type { BulkInsertion, DocumentAnalysis, RetentionStatus } from '../../types';
import { formatDateTime } from '../../core/exporters';
import { Icon } from './Icon';

const THRESHOLD_PRESETS = [25, 50, 100, 500, 1000];

interface InsertionsTabProps {
  analysis: DocumentAnalysis;
  selectedOpId: number | null;
  onChangeThreshold: (chars: number) => void;
  onLocateInMap: (opId: number, paragraphNumber: number | null) => void;
}

const STATUS_LABELS: Record<RetentionStatus, string> = {
  conservat: 'Conservat',
  reelaborat: 'Reelaborat',
  eliminat: 'Eliminat',
};

export function InsertionsTab({
  analysis,
  selectedOpId,
  onChangeThreshold,
  onLocateInMap,
}: InsertionsTabProps) {
  const [statusFilter, setStatusFilter] = useState<'tots' | RetentionStatus>('tots');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (selectedOpId !== null) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(selectedOpId);
        return next;
      });
    }
  }, [selectedOpId]);

  const toggleExpand = (opId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(opId)) next.delete(opId);
      else next.add(opId);
      return next;
    });
  };

  const copySearchSnippet = async (ins: BulkInsertion) => {
    const clean = ins.originalText.trim().split('\n')[0].slice(0, 90);
    try {
      await navigator.clipboard.writeText(clean);
      setCopiedId(ins.opId);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const filtered = analysis.bulkInsertions.filter(
    (b) => statusFilter === 'tots' || b.status === statusFilter
  );

  return (
    <div className="tab-stack">
      {/* Threshold filter chips */}
      <div className="filter-bar">
        <div className="filter-row">
          <span className="filter-label">Mida mínima (car.):</span>
          <div className="chip-group" role="group" aria-label="Llindar de caràcters">
            {THRESHOLD_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`chip tabular ${
                  analysis.settings.bulkThresholdChars === preset ? 'chip-active' : ''
                }`}
                onClick={() => onChangeThreshold(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-row">
          <span className="filter-label">Estat final:</span>
          <div className="chip-group" role="group" aria-label="Filtre per estat">
            {(
              [
                ['tots', 'Tots'],
                ['conservat', 'Conservat'],
                ['reelaborat', 'Reelaborat'],
                ['eliminat', 'Eliminat'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`chip ${statusFilter === val ? 'chip-active' : ''}`}
                onClick={() => setStatusFilter(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-card">
          <Icon name="check-circle" size={22} />
          <p>
            Cap inserció de <strong>{analysis.settings.bulkThresholdChars} o més caràcters</strong>
            {statusFilter !== 'tots' ? ` amb l’estat «${STATUS_LABELS[statusFilter]}»` : ''}.
          </p>
          {analysis.allCandidateInsertions.length > 0 &&
            analysis.settings.bulkThresholdChars > 25 && (
              <button
                type="button"
                className="btn btn-soft btn-sm"
                onClick={() => onChangeThreshold(25)}
              >
                Prova amb el llindar de 25 caràcters
              </button>
            )}
        </div>
      ) : (
        <div className="insertion-list">
          {filtered.map((ins) => {
            const isOpen = expandedIds.has(ins.opId);
            const pct = Math.round(ins.retentionRatio * 100);
            return (
              <article
                key={ins.opId}
                className={`insertion-card ${
                  selectedOpId === ins.opId ? 'insertion-highlighted' : ''
                }`}
              >
                <button
                  type="button"
                  className="insertion-summary"
                  onClick={() => toggleExpand(ins.opId)}
                  aria-expanded={isOpen}
                >
                  <div className="ins-main-meta">
                    <span
                      className={`status-pill status-${ins.status}`}
                      title={`${pct} % conservat al document final`}
                    >
                      {STATUS_LABELS[ins.status]}
                      {ins.status !== 'eliminat' ? ` · ${pct}%` : ''}
                    </span>
                    <strong className="ins-size tabular">
                      {ins.wordCount} par. · {ins.charCount} car.
                    </strong>
                    {ins.paragraphNumber && (
                      <span className="para-badge tabular">
                        Par. {ins.paragraphNumber}
                      </span>
                    )}
                  </div>

                  <div className="ins-sub-meta">
                    <span className="author-inline">
                      <span
                        className="author-dot"
                        style={{ backgroundColor: ins.authorColor }}
                      />
                      {ins.authorName}
                    </span>
                    <span className="tabular">{formatDateTime(ins.timestamp)}</span>
                    <Icon
                      name={isOpen ? 'chevron-down' : 'chevron-right'}
                      size={14}
                    />
                  </div>

                  {!isOpen && (
                    <p className="ins-snippet">{ins.previewSnippet}</p>
                  )}
                </button>

                {isOpen && (
                  <div className="insertion-detail">
                    <div className="ins-full-text">{ins.originalText}</div>
                    <div className="ins-actions">
                      {ins.status !== 'eliminat' && (
                        <button
                          type="button"
                          className="btn btn-soft btn-xs"
                          onClick={() =>
                            onLocateInMap(ins.opId, ins.paragraphNumber)
                          }
                        >
                          <Icon name="eye" size={13} /> Veure al mapa del text
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-soft btn-xs"
                        onClick={() => copySearchSnippet(ins)}
                        title="Copia l'inici del bloc per cercar-lo amb Ctrl+F a Google Docs"
                      >
                        <Icon name="copy" size={13} />
                        {copiedId === ins.opId ? 'Copiat per a Ctrl+F' : 'Copia per cercar (Ctrl+F)'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
