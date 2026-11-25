// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useMemo, useState } from 'react';
import type { StoredSummary } from '../../types';
import { loadClassSummaries, removeClassSummaries } from '../../core/classStore';
import { exportClassCsv, formatDuration, formatShortDate } from '../../core/exporters';
import { Icon } from './Icon';

type SortKey = 'mainAuthor' | 'activeSeconds' | 'days' | 'progressivePct' | 'bulkPct' | 'lastDaySharePct';

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: 'mainAuthor', label: 'Alumne', title: 'Autor principal' },
  { key: 'activeSeconds', label: 'Temps', title: 'Temps de treball actiu' },
  { key: 'days', label: 'Dies', title: 'Dies amb activitat' },
  { key: 'progressivePct', label: 'Escrit', title: '% del text escrit pas a pas' },
  { key: 'bulkPct', label: 'Eng.', title: '% del text enganxat' },
  { key: 'lastDaySharePct', label: 'Últ. dia', title: '% del temps l’últim dia' },
];

interface ClassViewProps {
  onClose: () => void;
}

export function ClassView({ onClose }: ClassViewProps) {
  const [all, setAll] = useState<Record<string, StoredSummary>>({});
  const [group, setGroup] = useState<string>('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'mainAuthor', dir: 1 });
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const refresh = () => void loadClassSummaries().then(setAll);
    refresh();
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
    const listener = (msg: { type?: string }) => {
      if (msg?.type === 'TRACES_CLASS_UPDATED') refresh();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // Tasques ordenades per l'anàlisi més recent
  const groups = useMemo(() => {
    const latest = new Map<string, number>();
    for (const s of Object.values(all)) latest.set(s.group, Math.max(latest.get(s.group) ?? 0, s.analyzedAt));
    return Array.from(latest.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => g);
  }, [all]);

  const activeGroup = group && groups.includes(group) ? group : groups[0] ?? '';

  const rows = useMemo(() => {
    const list = Object.values(all).filter((s) => s.group === activeGroup);
    return list.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb, 'ca') * sort.dir;
      return ((va as number) - (vb as number)) * sort.dir;
    });
  }, [all, activeGroup, sort]);

  const median = (vals: number[]) => {
    if (!vals.length) return 0;
    const v = [...vals].sort((x, y) => x - y);
    return v[Math.floor(v.length / 2)];
  };
  const medTime = median(rows.map((r) => r.activeSeconds));

  return (
    <div className="tab-stack class-view">
      <div className="class-head">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Torna a l’anàlisi" title="Torna">
          <Icon name="chevron-right" size={15} className="flip" />
        </button>
        <h2>Classe</h2>
        {groups.length > 0 && (
          <select value={activeGroup} onChange={(e) => setGroup(e.target.value)} aria-label="Tasca">
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="empty-card">
          <Icon name="table" size={22} />
          <p>
            Obriu una tasca a Classroom i premeu <strong>Analitza la classe</strong>, o analitzeu els treballs d’un en un.
          </p>
        </div>
      ) : (
        <>
          <div className="class-table-wrap">
            <table className="class-table">
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} title={c.title}>
                      <button
                        type="button"
                        onClick={() =>
                          setSort((s) => ({ key: c.key, dir: s.key === c.key ? ((-s.dir) as 1 | -1) : c.key === 'mainAuthor' ? 1 : -1 }))
                        }
                      >
                        {c.label}
                        {sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.docId}>
                    <td className="cell-name">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer" title={r.title}>
                          {r.mainAuthor}
                        </a>
                      ) : (
                        <span title={r.title}>{r.mainAuthor}</span>
                      )}
                      {r.authors > 1 && <span className="cell-extra"> +{r.authors - 1}</span>}
                    </td>
                    <td className={`tabular ${medTime && r.activeSeconds < medTime / 3 ? 'cell-low' : ''}`}>
                      {formatDuration(r.activeSeconds)}
                    </td>
                    <td className="tabular">{r.days}</td>
                    <td className="tabular">{r.kind === 'spreadsheet' ? '—' : `${r.progressivePct} %`}</td>
                    <td className={`tabular ${r.bulkPct >= 55 ? 'cell-high' : r.bulkPct >= 20 ? 'cell-mid' : ''}`}>
                      {r.kind === 'spreadsheet' ? r.bulkCount : `${r.bulkPct} %`}
                    </td>
                    <td className={`tabular ${r.days > 1 && r.lastDaySharePct >= 80 ? 'cell-mid' : ''}`}>
                      {r.lastDaySharePct} %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="class-foot">
            <span className="tabular text-muted">
              {rows.length} treballs · mitjana {formatDuration(medTime)} · {formatShortDate(Math.max(...rows.map((r) => r.analyzedAt)))}
            </span>
            <div className="class-actions">
              <button type="button" className="btn btn-soft btn-xs" onClick={() => exportClassCsv(rows, activeGroup)}>
                <Icon name="download" size={13} /> CSV
              </button>
              {confirmClear ? (
                <button
                  type="button"
                  className="btn btn-soft btn-xs text-amber"
                  onClick={async () => {
                    await removeClassSummaries(rows.map((r) => r.docId));
                    setConfirmClear(false);
                    setAll(await loadClassSummaries());
                  }}
                >
                  <Icon name="trash" size={13} /> Confirma
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-soft btn-xs"
                  onClick={() => setConfirmClear(true)}
                  title="Esborra aquesta tasca de la taula"
                >
                  <Icon name="trash" size={13} />
                </button>
              )}
            </div>
          </div>
          <p className="pedagogical-hint">
            Només es desen resums numèrics en aquest navegador, mai el text de l’alumnat.
          </p>
        </>
      )}
    </div>
  );
}
