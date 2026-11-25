// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AnalysisSettings } from '../../types';
import { Icon } from './Icon';

interface SettingsDrawerProps {
  settings: AnalysisSettings;
  onUpdate: (partial: Partial<AnalysisSettings>) => void;
  onClose: () => void;
}

export function SettingsDrawer({ settings, onUpdate, onClose }: SettingsDrawerProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="drawer-sheet"
        role="dialog"
        aria-label="Paràmetres d'anàlisi"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <h2>Opcions d’anàlisi</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Tanca les opcions"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="drawer-body">
          <div className="setting-group">
            <label>Pausa per separar sessions</label>
            <p className="setting-help">
              Temps d’inactivitat a partir del qual comença una sessió nova.
            </p>
            <div className="chip-group">
              {[3, 5, 10, 15].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={`chip tabular ${
                    settings.sessionGapMinutes === mins ? 'chip-active' : ''
                  }`}
                  onClick={() => onUpdate({ sessionGapMinutes: mins })}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          <div className="setting-group">
            <label>Llindar d’inserció en bloc</label>
            <p className="setting-help">
              Caràcters mínims afegits d’un sol cop per marcar-los com a bloc.
            </p>
            <div className="chip-group">
              {[25, 50, 100, 500, 1000].map((chars) => (
                <button
                  key={chars}
                  type="button"
                  className={`chip tabular ${
                    settings.bulkThresholdChars === chars ? 'chip-active' : ''
                  }`}
                  onClick={() => onUpdate({ bulkThresholdChars: chars })}
                >
                  {chars} car.
                </button>
              ))}
            </div>
          </div>

          <div className="setting-group">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.autoAnalyzeOnSwitch}
                onChange={(e) =>
                  onUpdate({ autoAnalyzeOnSwitch: e.target.checked })
                }
              />
              <span>
                Analitza automàticament en canviar d’alumne o de pestanya
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
