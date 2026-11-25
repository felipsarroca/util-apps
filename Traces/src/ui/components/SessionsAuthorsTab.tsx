// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DocumentAnalysis } from '../../types';
import { formatDuration, formatShortDate, formatShortTime } from '../../core/exporters';
import { Icon } from './Icon';

interface SessionsAuthorsTabProps {
  analysis: DocumentAnalysis;
}

export function SessionsAuthorsTab({ analysis }: SessionsAuthorsTabProps) {
  const maxSessionSec = Math.max(
    60,
    ...analysis.sessions.map((s) => s.durationSeconds)
  );

  return (
    <div className="tab-stack">
      {/* Authors section */}
      <section className="panel-card">
        <div className="card-head">
          <h2>Autors ({analysis.authors.length})</h2>
        </div>

        <div className="authors-list">
          {analysis.authors.map((author) => (
            <div key={author.userId} className="author-card">
              <div className="author-head">
                <div className="author-identity">
                  <span
                    className="author-avatar"
                    style={{ backgroundColor: author.color }}
                  >
                    {author.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{author.name}</strong>
                    <span className="author-sub tabular">
                      {author.activeMinutes.toLocaleString('ca-ES')} min actius · {author.sessionCount}{' '}
                      {author.sessionCount === 1 ? 'sessió' : 'sessions'}
                    </span>
                  </div>
                </div>
                <div className="author-pct tabular" title="Presència al text final">
                  <strong>{author.survivingSharePct}{'\u00A0'}%</strong>
                  <span>del final</span>
                </div>
              </div>

              <div className="author-bar-track">
                <div
                  className="author-bar-fill"
                  style={{
                    width: `${author.survivingSharePct}%`,
                    backgroundColor: author.color,
                  }}
                />
              </div>

              <div className="author-metrics tabular">
                {analysis.kind === 'spreadsheet' ? (
                  <>
                    <span>{author.cellsTyped ?? 0} cel·les a mà</span>
                    {(author.cellsPasted ?? 0) > 0 && (
                      <span className="text-amber">{author.cellsPasted} enganxades</span>
                    )}
                    <span>{author.formulas ?? 0} fórmules</span>
                  </>
                ) : (
                  <>
                    <span>Escrit: {author.progressiveCharsInserted} car.</span>
                    {author.bulkCharsInserted > 0 && (
                      <span className="text-amber">Enganxat: {author.bulkCharsInserted} car.</span>
                    )}
                    {author.slidesTouched !== undefined && (
                      <span>
                        {author.slidesTouched} {author.slidesTouched === 1 ? 'diapositiva' : 'diapositives'}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {analysis.authors.length > 1 && (
          <p className="pedagogical-hint">
            Qui tecleja no sempre és qui pensa: si treballen junts en un ordinador, tot apareix a nom d’un sol alumne.
          </p>
        )}
      </section>

      {/* Sessions chronology */}
      <section className="panel-card">
        <div className="card-head">
          <h2>Sessions ({analysis.sessions.length})</h2>
          <span className="subtle-badge">
            Pausa &gt; {analysis.settings.sessionGapMinutes} min
          </span>
        </div>

        <div className="sessions-list">
          {analysis.sessions.map((sess) => {
            const widthPct = Math.max(
              6,
              Math.round((sess.durationSeconds / maxSessionSec) * 100)
            );
            return (
              <div key={sess.index} className="session-row">
                <div className="session-row-top">
                  <div className="session-when tabular">
                    <span className="session-idx">S{sess.index}</span>
                    <strong>{formatShortDate(sess.startTime)}</strong>
                    <span>
                      {formatShortTime(sess.startTime)}–{formatShortTime(sess.endTime)}
                    </span>
                  </div>
                  <div className="session-dur tabular">
                    <Icon name="clock" size={12} />
                    <strong>{formatDuration(sess.durationSeconds)}</strong>
                  </div>
                </div>

                <div className="session-bar-track">
                  <div
                    className={`session-bar-fill ${
                      sess.bulkInsertionsCount > 0 ? 'session-bar-amber' : ''
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>

                <div className="session-row-bottom tabular">
                  <span>
                    {sess.wordsAddedApprox >= 0
                      ? `+${sess.wordsAddedApprox} par. aprox.`
                      : `${sess.wordsAddedApprox} par. aprox.`}
                  </span>
                  {sess.bulkInsertionsCount > 0 && (
                    <span className="text-amber">
                      {sess.bulkInsertionsCount}{' '}
                      {sess.bulkInsertionsCount === 1 ? 'bloc' : 'blocs'}
                    </span>
                  )}
                  <span className="session-authors">
                    {sess.authors.map((a) => (
                      <span
                        key={a.userId}
                        className="author-dot"
                        style={{ backgroundColor: a.color }}
                        title={a.name}
                      />
                    ))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
