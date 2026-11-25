// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import type { TimelinePoint } from '../../types';
import { formatDateTime } from '../../core/exporters';

interface EvolutionChartProps {
  points: TimelinePoint[];
  onSelectBulkInsertion: (opId: number) => void;
}

export function EvolutionChart({ points, onSelectBulkInsertion }: EvolutionChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div className="empty-mini">
        Sense dades temporals suficients per traçar l’evolució.
      </div>
    );
  }

  const width = 340;
  const height = 114;
  const padLeft = 30;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 20;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const maxWords = Math.max(20, ...points.map((p) => p.wordCount));
  const niceMax = Math.ceil(maxWords / 10) * 10;

  const getX = (idx: number) =>
    points.length === 1
      ? padLeft + innerW / 2
      : padLeft + (idx / (points.length - 1)) * innerW;

  const getY = (wc: number) => padTop + innerH - (wc / niceMax) * innerH;

  // Detect session boundaries for subtle vertical dividers
  const sessionBreaks: number[] = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i].sessionIndex !== points[i - 1].sessionIndex) {
      sessionBreaks.push((getX(i - 1) + getX(i)) / 2);
    }
  }

  const linePath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(pt.wordCount).toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${getX(points.length - 1).toFixed(1)} ${(padTop + innerH).toFixed(
    1
  )} L ${getX(0).toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`;

  const bulkPoints = points
    .map((pt, idx) => ({ pt, idx }))
    .filter((item) => Boolean(item.pt.bulkInsertion));

  const hovered = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="evo-svg"
        role="img"
        aria-label="Gràfic d'evolució de paraules del document"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="tracesAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0284C7" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0284C7" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((ratio) => {
          const y = padTop + innerH * (1 - ratio);
          const val = Math.round(niceMax * ratio);
          return (
            <g key={ratio}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#E2E8F0"
                strokeWidth="1"
                strokeDasharray={ratio === 0 ? undefined : '3 3'}
              />
              <text
                x={padLeft - 6}
                y={y + 3.5}
                textAnchor="end"
                fontSize="9.5"
                fill="#64748B"
                className="tabular"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Session boundary dividers */}
        {sessionBreaks.map((bx, idx) => (
          <g key={idx}>
            <line
              x1={bx}
              y1={padTop}
              x2={bx}
              y2={padTop + innerH}
              stroke="#CBD5E1"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          </g>
        ))}

        {/* Area & main line */}
        <path d={areaPath} fill="url(#tracesAreaGrad)" />
        <path
          d={linePath}
          fill="none"
          stroke="#0284C7"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover vertical indicator */}
        {hoveredIdx !== null && (
          <line
            x1={getX(hoveredIdx)}
            y1={padTop}
            x2={getX(hoveredIdx)}
            y2={padTop + innerH}
            stroke="#94A3B8"
            strokeWidth="1"
          />
        )}

        {/* Interactive invisible columns for smooth hover */}
        {points.map((pt, idx) => {
          const colW = Math.max(3, innerW / Math.max(1, points.length));
          return (
            <rect
              key={pt.index}
              x={getX(idx) - colW / 2}
              y={padTop}
              width={colW}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoveredIdx(idx)}
              onClick={() => {
                if (pt.bulkInsertion) {
                  onSelectBulkInsertion(pt.bulkInsertion.opId);
                }
              }}
              style={{ cursor: pt.bulkInsertion ? 'pointer' : 'crosshair' }}
            />
          );
        })}

        {/* Highlighted hover dot */}
        {hoveredIdx !== null && hovered && !hovered.bulkInsertion && (
          <circle
            cx={getX(hoveredIdx)}
            cy={getY(hovered.wordCount)}
            r="3.6"
            fill="#0284C7"
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />
        )}

        {/* Amber markers for bulk insertions */}
        {bulkPoints.map(({ pt, idx }) => {
          const b = pt.bulkInsertion!;
          const cx = getX(idx);
          const cy = getY(pt.wordCount);
          const isElim = b.status === 'eliminat';
          return (
            <g
              key={b.opId}
              className="bulk-dot-group"
              onClick={() => onSelectBulkInsertion(b.opId)}
              onMouseEnter={() => setHoveredIdx(idx)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={hoveredIdx === idx ? 6 : 4.6}
                fill={isElim ? '#94A3B8' : '#F59E0B'}
                stroke="#FFFFFF"
                strokeWidth="1.7"
              />
            </g>
          );
        })}

        {/* X-axis labels */}
        <text x={padLeft} y={height - 5} fontSize="9.5" fill="#64748B">
          Inici
        </text>
        {sessionBreaks.length > 0 && (
          <text
            x={padLeft + innerW / 2}
            y={height - 5}
            textAnchor="middle"
            fontSize="9"
            fill="#94A3B8"
          >
            {sessionBreaks.length + 1} sessions (línies discontínues)
          </text>
        )}
        <text
          x={width - padRight}
          y={height - 5}
          textAnchor="end"
          fontSize="9.5"
          fill="#64748B"
        >
          Final
        </text>
      </svg>

      {/* Compact contextual bar below chart */}
      <div className="chart-caption">
        {hovered ? (
          <span className="chart-tooltip-inline tabular">
            <strong>{hovered.wordCount} par.</strong> · Sessió {hovered.sessionIndex} ·{' '}
            {formatDateTime(hovered.timestamp)}
            {hovered.bulkInsertion && (
              <span className="tooltip-bulk-tag">
                Blocs +{hovered.bulkInsertion.wordCount} par. (clica per obrir)
              </span>
            )}
          </span>
        ) : bulkPoints.length > 0 ? (
          <span className="chart-legend-inline">
            <span className="legend-dot amber" /> Clica els punts taronja per inspeccionar cada inserció en bloc
          </span>
        ) : (
          <span className="chart-legend-inline">
            <span className="legend-dot blue" /> Evolució contínua sense insercions en bloc
          </span>
        )}
      </div>
    </div>
  );
}
