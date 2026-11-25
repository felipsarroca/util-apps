// SPDX-License-Identifier: AGPL-3.0-or-later
import type { WorkDay } from '../../types';
import { formatDuration } from '../../core/exporters';

interface DayStripProps {
  days: WorkDay[];
  deadline?: number | null;
}

const DAY_MS = 24 * 3600_000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** Franja de dies: una columna per dia, alçada segons el temps actiu. */
export function DayStrip({ days, deadline }: DayStripProps) {
  if (days.length === 0) return null;

  const byDay = new Map(days.map((d) => [d.dayStart, d]));
  let first = days[0].dayStart;
  let last = days[days.length - 1].dayStart;
  const deadlineDay = deadline ? startOfDay(deadline) : null;
  if (deadlineDay !== null) {
    if (deadlineDay > last && (deadlineDay - first) / DAY_MS <= 30) last = deadlineDay;
    if (deadlineDay < first && (last - deadlineDay) / DAY_MS <= 30) first = deadlineDay;
  }

  // Calendari continu si és curt; si no, només els dies amb activitat
  const span = Math.round((last - first) / DAY_MS) + 1;
  const slots: number[] = [];
  if (span <= 24) {
    for (let t = first; t <= last + 1000; t = startOfDay(t + DAY_MS + 3 * 3600_000)) slots.push(t);
  } else {
    slots.push(...days.map((d) => d.dayStart));
  }

  const max = Math.max(60, ...days.map((d) => d.activeSeconds));

  return (
    <div className="day-strip" role="img" aria-label={`Treball repartit en ${days.length} dies`}>
      {slots.map((t) => {
        const d = byDay.get(t);
        const h = d ? Math.max(10, Math.round((d.activeSeconds / max) * 100)) : 0;
        const isDeadline = deadlineDay === t;
        const late = deadline && d && t > deadlineDay!;
        return (
          <div
            key={t}
            className={`day-col ${isDeadline ? 'day-deadline' : ''}`}
            title={
              d
                ? `${new Date(t).toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' })}: ${formatDuration(
                    d.activeSeconds
                  )}, ${d.sessions} ${d.sessions === 1 ? 'sessió' : 'sessions'}${d.bulkCount ? `, ${d.bulkCount} enganxats` : ''}`
                : `${new Date(t).toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' })}: sense activitat`
            }
          >
            <div className="day-bar-area">
              {d && (
                <div
                  className={`day-bar ${d.bulkCount ? 'day-bar-bulk' : ''} ${late ? 'day-bar-late' : ''}`}
                  style={{ height: `${h}%` }}
                />
              )}
            </div>
            <span className="day-label tabular">{dayLabel(t)}</span>
          </div>
        );
      })}
    </div>
  );
}
