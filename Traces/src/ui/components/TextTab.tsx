// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BulkInsertion, DocumentAnalysis, ParagraphBlock, RetentionStatus } from '../../types';
import { formatDateTime } from '../../core/exporters';
import { Icon } from './Icon';

interface TextTabProps {
  analysis: DocumentAnalysis;
  focusedOpId: number | null;
  showAdvanced: boolean;
  onFocusOp: (opId: number | null) => void;
  onChangeThreshold: (chars: number) => void;
}

const STATUS_LABELS: Record<RetentionStatus, string> = {
  conservat: 'Conservat',
  reelaborat: 'Reelaborat',
  eliminat: 'Eliminat',
};

function groupHeader(p: ParagraphBlock, prev: ParagraphBlock | undefined): string | null {
  if (p.slideNumber !== undefined) {
    const changed = !prev || prev.slideNumber !== p.slideNumber || Boolean(prev.isNotes) !== Boolean(p.isNotes);
    return changed ? `Diapositiva ${p.slideNumber}${p.isNotes ? ' · notes' : ''}` : null;
  }
  if (p.tabName) return !prev || prev.tabName !== p.tabName ? p.tabName : null;
  return null;
}

export function TextTab({ analysis: a, focusedOpId, showAdvanced, onFocusOp, onChangeThreshold }: TextTabProps) {
  const [mode, setMode] = useState<'mapa' | 'reproductor'>('mapa');
  const [listOpen, setListOpen] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const paraRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Reproductor
  const steps = a.replayCheckpoints;
  const [stepIdx, setStepIdx] = useState(Math.max(0, steps.length - 1));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 4 | 12>(4);

  useEffect(() => {
    setStepIdx(Math.max(0, steps.length - 1));
    setPlaying(false);
  }, [a.docId, steps.length]);

  useEffect(() => {
    if (focusedOpId === null) return;
    setMode('mapa');
    setExpanded(focusedOpId);
    const ins = a.bulkInsertions.find((b) => b.opId === focusedOpId);
    const para = ins?.paragraphNumber;
    if (para) {
      window.setTimeout(() => paraRefs.current[para]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    }
  }, [focusedOpId, a.bulkInsertions]);

  useEffect(() => {
    if (!playing) return;
    const maxIdx = steps.length - 1;
    if (stepIdx >= maxIdx) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setStepIdx((p) => Math.min(maxIdx, p + 1)), Math.max(45, Math.round(380 / speed)));
    return () => window.clearTimeout(timer);
  }, [playing, speed, stepIdx, steps.length]);

  const bulkSteps = useMemo(() => steps.map((s, i) => (s.isBulkStep ? i : -1)).filter((i) => i >= 0), [steps]);
  const nextBulk = bulkSteps.find((i) => i > stepIdx);

  const copySnippet = async (ins: BulkInsertion) => {
    try {
      await navigator.clipboard.writeText(ins.originalText.trim().split('\n')[0].slice(0, 90));
      setCopiedId(ins.opId);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Sense porta-retalls
    }
  };

  /* ── Fulls de càlcul: llista d'enganxats ── */
  if (a.kind === 'spreadsheet') {
    const pastes = a.sheet?.pastes ?? [];
    return (
      <div className="tab-stack">
        <section className="panel-card">
          <div className="card-head">
            <h2>Dades enganxades ({pastes.length})</h2>
          </div>
          {pastes.length === 0 ? (
            <div className="empty-mini">Cap enganxat de 3 o més cel·les.</div>
          ) : (
            <div className="paste-list">
              {pastes.map((p) => (
                <div key={p.opId} className="paste-row">
                  <div className="paste-top">
                    <strong className="tabular">
                      {p.sheetName} · {p.rangeLabel}
                    </strong>
                    <span className="tabular">
                      {p.cells} cel·les{p.formulas > 0 ? ` · ${p.formulas} fórmules` : ''}
                    </span>
                  </div>
                  <div className="ins-sub-meta">
                    <span className="author-inline">
                      <span className="author-dot" style={{ backgroundColor: p.authorColor }} />
                      {p.authorName}
                    </span>
                    <span className="tabular">{formatDateTime(p.timestamp)}</span>
                  </div>
                  {p.preview && <p className="ins-snippet">{p.preview}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="tab-stack">
      <div className="submode-switch" role="tablist" aria-label="Vista del text">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'mapa'}
          className={`submode-btn ${mode === 'mapa' ? 'submode-active' : ''}`}
          onClick={() => {
            setPlaying(false);
            setMode('mapa');
          }}
        >
          <Icon name="eye" size={13} /> Origen del text
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'reproductor'}
          className={`submode-btn ${mode === 'reproductor' ? 'submode-active' : ''}`}
          onClick={() => setMode('reproductor')}
        >
          <Icon name="play" size={13} /> Reprodueix
        </button>
      </div>

      {mode === 'mapa' ? (
        <>
          {/* Fragments enganxats */}
          <section className="panel-card">
            <button type="button" className="card-head card-toggle" onClick={() => setListOpen((o) => !o)} aria-expanded={listOpen}>
              <h2>
                Fragments enganxats <span className="tab-count tabular">{a.bulkInsertions.length}</span>
              </h2>
              <Icon name={listOpen ? 'chevron-down' : 'chevron-right'} size={14} />
            </button>

            {listOpen && showAdvanced && (
              <div className="chip-group threshold-row" role="group" aria-label="Mida mínima del fragment">
                <span className="filter-label">Mida mínima</span>
                {[25, 50, 100, 500].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`chip tabular ${a.settings.bulkThresholdChars === n ? 'chip-active' : ''}`}
                    onClick={() => onChangeThreshold(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}

            {listOpen &&
              (a.bulkInsertions.length === 0 ? (
                <div className="empty-mini">
                  <Icon name="check-circle" size={14} /> Cap fragment enganxat de {a.settings.bulkThresholdChars} o més caràcters.
                </div>
              ) : (
                <div className="insertion-list">
                  {a.bulkInsertions.map((ins) => {
                    const open = expanded === ins.opId;
                    const pct = Math.round(ins.retentionRatio * 100);
                    return (
                      <article key={ins.opId} className={`insertion-card ${focusedOpId === ins.opId ? 'insertion-highlighted' : ''}`}>
                        <button
                          type="button"
                          className="insertion-summary"
                          onClick={() => {
                            setExpanded(open ? null : ins.opId);
                            onFocusOp(open ? null : ins.opId);
                          }}
                          aria-expanded={open}
                        >
                          <div className="ins-main-meta">
                            <span className={`status-pill status-${ins.status}`} title={`${pct} % es manté al text final`}>
                              {STATUS_LABELS[ins.status]}
                            </span>
                            <strong className="ins-size tabular">{ins.wordCount} par.</strong>
                            {ins.slideNumber ? (
                              <span className="para-badge tabular">Diap. {ins.slideNumber}</span>
                            ) : ins.paragraphNumber ? (
                              <span className="para-badge tabular">P{ins.paragraphNumber}</span>
                            ) : null}
                            <span className="ins-when tabular">{formatDateTime(ins.timestamp)}</span>
                          </div>
                          {!open && <p className="ins-snippet">{ins.previewSnippet}</p>}
                        </button>
                        {open && (
                          <div className="insertion-detail">
                            <div className="ins-full-text">{ins.originalText}</div>
                            <div className="ins-actions">
                              <span className="author-inline">
                                <span className="author-dot" style={{ backgroundColor: ins.authorColor }} />
                                {ins.authorName}
                              </span>
                              <button
                                type="button"
                                className="btn btn-soft btn-xs"
                                onClick={() => void copySnippet(ins)}
                                title="Copia l’inici per cercar-lo al fitxer (Ctrl+F) o a internet"
                              >
                                <Icon name={copiedId === ins.opId ? 'check-circle' : 'copy'} size={13} />
                                {copiedId === ins.opId ? 'Copiat' : 'Copia l’inici'}
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ))}
          </section>

          {/* Mapa del text final */}
          <div className="map-legend-bar">
            <span>
              <i className="swatch swatch-progressive" /> Escrit
            </span>
            <span>
              <i className="swatch swatch-bulk" /> Enganxat
            </span>
            {a.movedInsertionsCount > 0 && (
              <span>
                <i className="swatch swatch-moved" /> Mogut
              </span>
            )}
            {a.templatePct > 0 && (
              <span>
                <i className="swatch swatch-template" /> Plantilla
              </span>
            )}
          </div>

          {a.paragraphs.length === 0 ? (
            <div className="empty-card">El fitxer no té text visible.</div>
          ) : (
            <div className="doc-map-sheet">
              {a.paragraphs.map((para, i) => {
                const header = groupHeader(para, a.paragraphs[i - 1]);
                return (
                  <div key={para.paragraphNumber}>
                    {header && <div className="map-group-head">{header}</div>}
                    <div
                      ref={(el) => {
                        paraRefs.current[para.paragraphNumber] = el;
                      }}
                      className="map-paragraph"
                    >
                      <span className="para-gutter tabular">P{para.paragraphNumber}</span>
                      <p className="para-content">
                        {para.segments.map((seg, sIdx) => {
                          if (seg.origin === 'bulk' && seg.bulkOpId) {
                            return (
                              <mark
                                key={sIdx}
                                className={`seg-bulk-mark ${focusedOpId === seg.bulkOpId ? 'seg-bulk-focused' : ''}`}
                                title={`Enganxat per ${seg.authorName} · ${formatDateTime(seg.timestamp)}`}
                                onClick={() => {
                                  setListOpen(true);
                                  setExpanded(seg.bulkOpId!);
                                  onFocusOp(seg.bulkOpId!);
                                }}
                              >
                                {seg.text}
                              </mark>
                            );
                          }
                          if (seg.origin === 'template') {
                            return (
                              <span key={sIdx} className="seg-template-span" title="Text que ja hi havia en crear el fitxer">
                                {seg.text}
                              </span>
                            );
                          }
                          return (
                            <span
                              key={sIdx}
                              className={seg.moved ? 'seg-moved-span' : 'seg-prog-span'}
                              title={seg.moved ? `Mogut dins del fitxer per ${seg.authorName}` : `Escrit per ${seg.authorName}`}
                            >
                              {seg.text}
                            </span>
                          );
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="replay-box">
          {steps.length === 0 ? (
            <div className="empty-card">No hi ha passos per reproduir.</div>
          ) : (
            <>
              <div className="replay-controls">
                <button
                  type="button"
                  className="btn btn-primary btn-sm replay-play-btn"
                  onClick={() => {
                    if (!playing && stepIdx >= steps.length - 1) setStepIdx(0);
                    setPlaying((p) => !p);
                  }}
                  aria-label={playing ? 'Pausa' : 'Reprodueix'}
                >
                  <Icon name={playing ? 'pause' : 'play'} size={14} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, steps.length - 1)}
                  value={stepIdx}
                  onChange={(e) => {
                    setPlaying(false);
                    setStepIdx(Number(e.target.value));
                  }}
                  className="replay-slider"
                  aria-label="Pas de l’elaboració"
                />
                <div className="speed-group" role="group" aria-label="Velocitat">
                  {([1, 4, 12] as const).map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      className={`chip tabular ${speed === sp ? 'chip-active' : ''}`}
                      onClick={() => setSpeed(sp)}
                    >
                      {sp}×
                    </button>
                  ))}
                </div>
              </div>

              {bulkSteps.length > 0 && (
                <button
                  type="button"
                  className="btn btn-soft btn-xs next-bulk-btn"
                  disabled={nextBulk === undefined}
                  onClick={() => {
                    setPlaying(false);
                    if (nextBulk !== undefined) setStepIdx(nextBulk);
                  }}
                >
                  <Icon name="skip-forward" size={13} />
                  {nextBulk === undefined ? 'No hi ha més enganxats' : 'Següent enganxat'}
                </button>
              )}

              {steps[stepIdx] && (
                <div className={`replay-meta-strip ${steps[stepIdx].isBulkStep ? 'replay-meta-bulk' : ''}`}>
                  <div className="replay-meta-top tabular">
                    <strong>
                      {stepIdx + 1}/{steps.length}
                    </strong>
                    <span>{formatDateTime(steps[stepIdx].timestamp)}</span>
                    <span>{steps[stepIdx].wordCount} par.</span>
                  </div>
                  <div className="replay-meta-bottom">
                    <span>{steps[stepIdx].authorName}</span>
                    <span className="replay-delta">{steps[stepIdx].deltaSummary}</span>
                  </div>
                </div>
              )}

              <div className="replay-paper">
                {steps[stepIdx]?.text ? (
                  steps[stepIdx].text.split('\n').map((line, idx) => <p key={idx}>{line || ' '}</p>)
                ) : (
                  <p className="text-muted">En blanc…</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
