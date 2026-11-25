// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import type { DocumentAnalysis } from '../../types';
import type { DeadlineStats } from '../../core/metrics';
import { formatDateTime, formatDuration } from '../../core/exporters';
import { EvolutionChart } from './EvolutionChart';
import { DayStrip } from './DayStrip';
import { Icon } from './Icon';

export const SUGGESTIONS_URL = 'https://github.com/felipsarroca/util-apps/issues/new?template=traces.yml';

interface SummaryTabProps {
  analysis: DocumentAnalysis;
  deadline: DeadlineStats | null;
  deadlineSource: 'classroom' | 'manual' | null;
  onSetDeadline: (ts: number | null) => void;
  canComment: boolean;
  onComment: () => Promise<boolean>;
  onJumpToText: (opId?: number) => void;
  onJumpToSessions: () => void;
}

type Signal = { tone: 'calm' | 'info' | 'attention'; icon: Parameters<typeof Icon>[0]['name']; label: string; hint: string };

function toLocalInput(ts: number): string {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

function buildSignals(a: DocumentAnalysis): Signal[] {
  const out: Signal[] = [];
  if (a.kind !== 'spreadsheet' && a.revision.fewCorrections) {
    out.push({
      tone: 'attention',
      icon: 'alert-triangle',
      label: 'Poques correccions',
      hint: `Text llarg escrit pas a pas gairebé sense esborrar (${a.revision.deletionPct} %). És poc habitual quan es redacta de memòria: pot ser una còpia teclejada.`,
    });
  } else if (a.kind !== 'spreadsheet' && a.revision.level === 'moltes') {
    out.push({
      tone: 'calm',
      icon: 'check-circle',
      label: 'Text revisat',
      hint: `S’ha esborrat o corregit el ${a.revision.deletionPct} % del que s’havia escrit.`,
    });
  }
  if (a.workDays.length === 1 && a.totalActiveSeconds > 20 * 60) {
    out.push({ tone: 'info', icon: 'calendar', label: 'Tot en un dia', hint: 'Tot el treball es va fer el mateix dia.' });
  } else if (a.workDays.length > 1 && a.lastDaySharePct >= 70) {
    out.push({
      tone: 'info',
      icon: 'calendar',
      label: `${a.lastDaySharePct} % l’últim dia`,
      hint: 'La major part del temps de treball es concentra en l’últim dia.',
    });
  }
  if (a.kind !== 'spreadsheet' && a.ownWordsPerMinute > 35) {
    out.push({
      tone: 'attention',
      icon: 'clock',
      label: `${a.ownWordsPerMinute} paraules/min`,
      hint: 'Ritme molt alt per a text escrit pas a pas (habitualment, menys de 20 paraules per minut de treball).',
    });
  }
  if (a.movedInsertionsCount > 0) {
    out.push({
      tone: 'calm',
      icon: 'move',
      label: `${a.movedInsertionsCount} ${a.movedInsertionsCount === 1 ? 'fragment mogut' : 'fragments moguts'}`,
      hint: 'Text propi retallat i enganxat dins del mateix fitxer: no compta com a enganxat.',
    });
  }
  if (a.authors.length > 1) {
    out.push({
      tone: 'info',
      icon: 'users',
      label: `${a.authors.length} autors`,
      hint: a.authors.map((x) => `${x.name}: ${x.survivingSharePct} %`).join(' · '),
    });
  }
  return out;
}

export function SummaryTab({
  analysis: a,
  deadline,
  deadlineSource,
  onSetDeadline,
  canComment,
  onComment,
  onJumpToText,
  onJumpToSessions,
}: SummaryTabProps) {
  const [showCoverage, setShowCoverage] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [commentState, setCommentState] = useState<'idle' | 'ok' | 'fail'>('idle');

  const isSheet = a.kind === 'spreadsheet';
  const isSlides = a.kind === 'presentation';
  const signals = buildSignals(a);

  const coverageLabel = a.coverage.formatUnrecognized ? 'Format no reconegut' : a.coverage.label;

  const big = isSheet
    ? [
        { label: 'Treball', value: formatDuration(a.totalActiveSeconds), tone: '' },
        { label: 'Cel·les a mà', value: String(a.sheet?.cellsTyped ?? 0), tone: 'prog' },
        { label: 'Enganxades', value: String(a.sheet?.cellsPasted ?? 0), tone: (a.sheet?.cellsPasted ?? 0) > 0 ? 'bulk' : '' },
      ]
    : [
        { label: 'Treball', value: formatDuration(a.totalActiveSeconds), tone: '' },
        { label: 'Escrit pas a pas', value: `${a.progressivePct} %`, tone: 'prog' },
        { label: 'Enganxat', value: `${a.bulkPct} %`, tone: a.bulkPct > 0 ? 'bulk' : '' },
      ];

  const meta: string[] = [];
  if (!isSheet) meta.push(`${a.finalWordCount} paraules`);
  if (isSlides && a.slides) meta.push(`${a.slides.length} diapositives`);
  if (isSheet && a.sheet) meta.push(`${a.sheet.formulasTyped + a.sheet.formulasPasted} fórmules`);
  meta.push(`${a.sessionCount} ${a.sessionCount === 1 ? 'sessió' : 'sessions'}`);
  meta.push(`${a.workDays.length} ${a.workDays.length === 1 ? 'dia' : 'dies'}`);

  return (
    <div className="tab-stack">
      {a.coverage.formatUnrecognized && (
        <div className="coverage-banner coverage-limitada" role="alert">
          <Icon name="alert-triangle" size={15} />
          <div>
            <p>
              <strong>Google pot haver canviat el format intern.</strong> Les dades poden ser incompletes.
            </p>
            <a href={SUGGESTIONS_URL} target="_blank" rel="noopener noreferrer">
              Avisa’ns
            </a>
          </div>
        </div>
      )}

      {/* Fitxa d'un cop d'ull */}
      <section className="student-card">
        <div className="student-head">
          <span className="author-avatar" style={{ backgroundColor: a.authors[0]?.color || '#0284C7' }}>
            {(a.mainAuthorName || '?').slice(0, 1).toUpperCase()}
          </span>
          <div className="student-id">
            <strong className="truncate">{a.mainAuthorName || 'Autor desconegut'}</strong>
            <span className="student-meta tabular">{meta.join(' · ')}</span>
          </div>
          <button
            type="button"
            className={`coverage-seal seal-${a.coverage.formatUnrecognized ? 'limitada' : a.coverage.level}`}
            onClick={() => setShowCoverage((s) => !s)}
            title="Fiabilitat de les dades"
            aria-expanded={showCoverage}
          >
            <Icon name="shield" size={13} />
            {coverageLabel}
          </button>
        </div>

        {showCoverage && (
          <ul className="coverage-notes">
            {(a.coverage.notes.length ? a.coverage.notes : ['S’ha llegit tot l’historial d’edicions del fitxer.']).map(
              (n, i) => (
                <li key={i}>{n}</li>
              )
            )}
          </ul>
        )}

        <div className="big-numbers">
          {big.map((b, i) => (
            <button
              key={b.label}
              type="button"
              className={`big-num ${b.tone ? `big-${b.tone}` : ''}`}
              onClick={i === 0 ? onJumpToSessions : () => onJumpToText()}
            >
              <strong className="tabular">{b.value}</strong>
              <span>{b.label}</span>
            </button>
          ))}
        </div>

        {!isSheet && (
          <div
            className="composition-bar"
            role="img"
            aria-label={`Escrit pas a pas ${a.progressivePct} %, enganxat ${a.bulkPct} %, plantilla ${a.templatePct} %`}
          >
            {a.progressivePct > 0 && <div className="comp-seg comp-progressive" style={{ width: `${a.progressivePct}%` }} />}
            {a.bulkPct > 0 && <div className="comp-seg comp-bulk" style={{ width: `${a.bulkPct}%` }} />}
            {a.templatePct > 0 && <div className="comp-seg comp-template" style={{ width: `${a.templatePct}%` }} />}
          </div>
        )}

        <DayStrip days={a.workDays} deadline={deadline?.deadline ?? null} />

        {signals.length > 0 && (
          <div className="signal-row">
            {signals.map((s) => (
              <span key={s.label} className={`signal signal-${s.tone}`} title={s.hint}>
                <Icon name={s.icon} size={12} />
                {s.label}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Termini de lliurament */}
      <section className="panel-card deadline-card">
        {editingDeadline ? (
          <div className="deadline-edit">
            <Icon name="calendar" size={14} />
            <input
              type="datetime-local"
              defaultValue={deadline ? toLocalInput(deadline.deadline) : ''}
              onChange={(e) => {
                const ts = e.target.value ? new Date(e.target.value).getTime() : null;
                onSetDeadline(ts);
              }}
              aria-label="Data de lliurament"
            />
            <button type="button" className="btn btn-soft btn-xs" onClick={() => setEditingDeadline(false)}>
              Fet
            </button>
          </div>
        ) : deadline ? (
          <div className="deadline-row">
            <Icon name="calendar" size={14} />
            <div className="deadline-text">
              <strong className="tabular">Lliurament {formatDateTime(deadline.deadline)}</strong>
              <span className="tabular">
                {deadline.startedDaysBefore !== null && deadline.startedDaysBefore > 0
                  ? `Començat ${deadline.startedDaysBefore} ${deadline.startedDaysBefore === 1 ? 'dia' : 'dies'} abans`
                  : 'Començat el mateix dia'}
                {' · '}
                {deadline.last24hPct} % les últimes 24 h
                {deadline.lateSeconds > 0 && (
                  <span className="text-amber"> · {formatDuration(deadline.lateSeconds)} fora de termini</span>
                )}
              </span>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setEditingDeadline(true)}
              title={deadlineSource === 'classroom' ? 'Data llegida de Classroom. Canvia-la' : 'Canvia la data'}
              aria-label="Canvia la data de lliurament"
            >
              <Icon name="settings" size={13} />
            </button>
          </div>
        ) : (
          <button type="button" className="link-btn" onClick={() => setEditingDeadline(true)}>
            <Icon name="calendar" size={13} /> Afegeix la data de lliurament
          </button>
        )}
      </section>

      {/* Evolució sobre el temps real de treball */}
      <section className="panel-card">
        <div className="card-head">
          <h2>{isSheet ? 'Cel·les amb contingut' : 'Evolució del text'}</h2>
          {!isSheet && a.ownWordsPerMinute > 0 && (
            <span className="subtle-badge tabular" title="Paraules escrites pas a pas per minut de treball">
              {a.ownWordsPerMinute} par. pròpies/min
            </span>
          )}
        </div>
        <EvolutionChart
          points={a.timeline}
          totalActiveSeconds={a.totalActiveSeconds}
          unitLabel={isSheet ? 'cel·les' : 'par.'}
          onSelectBulkInsertion={(opId) => onJumpToText(opId)}
        />
      </section>

      {isSlides && a.slides && a.slides.length > 0 && (
        <section className="panel-card">
          <div className="card-head">
            <h2>Diapositives</h2>
            {(a.imagesInserted ?? 0) > 0 && (
              <span className="subtle-badge tabular">
                <Icon name="image" size={11} /> {a.imagesInserted}
              </span>
            )}
          </div>
          <div className="slide-list">
            {a.slides.map((s) => (
              <div key={s.slideId} className="slide-row">
                <span className="slide-num tabular">{s.number}</span>
                <span className="slide-title truncate">{s.title || 'Sense títol'}</span>
                <span className="slide-meta tabular">
                  {s.words} par.
                  {s.images > 0 && (
                    <>
                      {' · '}
                      <Icon name="image" size={11} /> {s.images}
                    </>
                  )}
                  {s.bulkCount > 0 && <span className="text-amber"> · {s.bulkCount} eng.</span>}
                </span>
                <span className="slide-authors">
                  {s.authors.map((au) => (
                    <span
                      key={au.userId}
                      className="author-dot"
                      style={{ backgroundColor: au.color }}
                      title={`${au.name}: ${au.chars} caràcters`}
                    />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="summary-actions">
        {canComment && (
          <button
            type="button"
            className={`btn btn-soft btn-sm ${commentState === 'ok' ? 'btn-ok' : ''}`}
            onClick={async () => {
              const ok = await onComment();
              setCommentState(ok ? 'ok' : 'fail');
              setTimeout(() => setCommentState('idle'), 2600);
            }}
            title="Escriu el resum al comentari privat de Classroom (sense enviar-lo)"
          >
            <Icon name={commentState === 'ok' ? 'check-circle' : 'message'} size={14} />
            {commentState === 'ok'
              ? 'Afegit: reviseu-lo i envieu'
              : commentState === 'fail'
                ? 'Copiat: enganxeu-lo al comentari'
                : 'Al comentari privat'}
          </button>
        )}
      </div>
    </div>
  );
}
