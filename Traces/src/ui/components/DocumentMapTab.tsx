// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef, useState } from 'react';
import type { DocumentAnalysis } from '../../types';
import { formatDateTime } from '../../core/exporters';
import { Icon } from './Icon';

interface DocumentMapTabProps {
  analysis: DocumentAnalysis;
  focusedBulkOpId: number | null;
  focusedParagraph: number | null;
  onSelectBulkInsertion: (opId: number) => void;
}

export function DocumentMapTab({
  analysis,
  focusedBulkOpId,
  focusedParagraph,
  onSelectBulkInsertion,
}: DocumentMapTabProps) {
  const [mode, setMode] = useState<'mapa' | 'reproductor'>('mapa');
  const [stepIdx, setStepIdx] = useState<number>(
    Math.max(0, analysis.replayCheckpoints.length - 1)
  );
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 4 | 12>(4);
  const paraRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    setStepIdx(Math.max(0, analysis.replayCheckpoints.length - 1));
    setPlaying(false);
  }, [analysis.docId, analysis.replayCheckpoints.length]);

  useEffect(() => {
    if (focusedParagraph && paraRefs.current[focusedParagraph]) {
      setMode('mapa');
      paraRefs.current[focusedParagraph]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [focusedParagraph, focusedBulkOpId]);

  useEffect(() => {
    if (!playing) return;
    const maxIdx = analysis.replayCheckpoints.length - 1;
    if (stepIdx >= maxIdx) {
      setPlaying(false);
      return;
    }
    const intervalMs = Math.max(45, Math.round(380 / speed));
    const timer = window.setInterval(() => {
      setStepIdx((prev) => {
        if (prev >= maxIdx) {
          setPlaying(false);
          return maxIdx;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [playing, speed, stepIdx, analysis.replayCheckpoints.length]);

  const currentStep =
    analysis.replayCheckpoints[
      Math.min(stepIdx, Math.max(0, analysis.replayCheckpoints.length - 1))
    ];

  const handleTogglePlay = () => {
    const maxIdx = analysis.replayCheckpoints.length - 1;
    if (!playing && stepIdx >= maxIdx) {
      setStepIdx(0);
    }
    setPlaying((p) => !p);
  };

  return (
    <div className="tab-stack">
      <div className="submode-switch" role="tablist" aria-label="Vista del document">
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
          Mapa d’origen del text
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'reproductor'}
          className={`submode-btn ${mode === 'reproductor' ? 'submode-active' : ''}`}
          onClick={() => setMode('reproductor')}
        >
          Reprodueix el procés
        </button>
      </div>

      {mode === 'mapa' ? (
        <>
          <div className="map-legend-bar">
            <span>
              <i className="swatch swatch-progressive" /> Progressiu
            </span>
            <span>
              <i className="swatch swatch-bulk" /> Inserit en bloc (clicable)
            </span>
            {analysis.templatePct > 0 && (
              <span>
                <i className="swatch swatch-template" /> Plantilla
              </span>
            )}
          </div>

          {analysis.paragraphs.length === 0 ? (
            <div className="empty-card">El document final no conté text visible.</div>
          ) : (
            <div className="doc-map-sheet">
              {analysis.paragraphs.map((para) => (
                <div
                  key={para.paragraphNumber}
                  ref={(el) => {
                    paraRefs.current[para.paragraphNumber] = el;
                  }}
                  className={`map-paragraph ${
                    focusedParagraph === para.paragraphNumber
                      ? 'map-paragraph-focused'
                      : ''
                  }`}
                >
                  <span className="para-gutter tabular" title={`Paràgraf ${para.paragraphNumber}`}>
                    P{para.paragraphNumber}
                  </span>
                  <p className="para-content">
                    {para.segments.map((seg, sIdx) => {
                      if (seg.origin === 'bulk' && seg.bulkOpId) {
                        const isFocused = focusedBulkOpId === seg.bulkOpId;
                        return (
                          <mark
                            key={sIdx}
                            className={`seg-bulk-mark ${
                              isFocused ? 'seg-bulk-focused' : ''
                            }`}
                            title={`Inserit en bloc per ${seg.authorName} (${formatDateTime(
                              seg.timestamp
                            )}) — Clica per al detall`}
                            onClick={() => onSelectBulkInsertion(seg.bulkOpId!)}
                          >
                            {seg.text}
                          </mark>
                        );
                      }
                      if (seg.origin === 'template') {
                        return (
                          <span
                            key={sIdx}
                            className="seg-template-span"
                            title="Plantilla o text inicial del document"
                          >
                            {seg.text}
                          </span>
                        );
                      }
                      return (
                        <span
                          key={sIdx}
                          className="seg-prog-span"
                          title={`Escrit progressivament per ${seg.authorName}`}
                        >
                          {seg.text}
                        </span>
                      );
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="replay-box">
          {analysis.replayCheckpoints.length === 0 ? (
            <div className="empty-card">No hi ha passos per reproduir.</div>
          ) : (
            <>
              <div className="replay-controls">
                <button
                  type="button"
                  className="btn btn-primary btn-sm replay-play-btn"
                  onClick={handleTogglePlay}
                  aria-label={playing ? 'Pausa' : 'Reprodueix'}
                >
                  <Icon name={playing ? 'pause' : 'play'} size={14} />
                  <span>{playing ? 'Pausa' : 'Reprodueix'}</span>
                </button>

                <input
                  type="range"
                  min={0}
                  max={Math.max(0, analysis.replayCheckpoints.length - 1)}
                  value={stepIdx}
                  onChange={(e) => {
                    setPlaying(false);
                    setStepIdx(Number(e.target.value));
                  }}
                  className="replay-slider"
                  aria-label="Pas de construcció del document"
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

              {currentStep && (
                <div
                  className={`replay-meta-strip ${
                    currentStep.isBulkStep ? 'replay-meta-bulk' : ''
                  }`}
                >
                  <div className="replay-meta-top tabular">
                    <strong>
                      Pas {stepIdx + 1}/{analysis.replayCheckpoints.length}
                    </strong>
                    <span>{formatDateTime(currentStep.timestamp)}</span>
                    <span>{currentStep.wordCount} paraules</span>
                  </div>
                  <div className="replay-meta-bottom">
                    <span>{currentStep.authorName}</span>
                    <span className="replay-delta">{currentStep.deltaSummary}</span>
                  </div>
                </div>
              )}

              <div className="replay-paper">
                {currentStep?.text ? (
                  currentStep.text.split('\n').map((line, idx) => (
                    <p key={idx}>{line || '\u00A0'}</p>
                  ))
                ) : (
                  <p className="text-muted">Document en blanc…</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
