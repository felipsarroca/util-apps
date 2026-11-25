// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AnalysisSettings } from '../../types';
import { Icon } from './Icon';

interface SettingsDrawerProps {
  settings: AnalysisSettings;
  isEmbedded: boolean;
  onUpdate: (partial: Partial<AnalysisSettings>) => void;
  onClose: () => void;
}

export function SettingsDrawer({ settings, isEmbedded, onUpdate, onClose }: SettingsDrawerProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="drawer-sheet" role="dialog" aria-label="Opcions" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>Opcions</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tanca les opcions">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="drawer-body">
          <div className="setting-group">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.autoAnalyzeOnSwitch}
                onChange={(e) => onUpdate({ autoAnalyzeOnSwitch: e.target.checked })}
              />
              <span>Analitza en canviar d’alumne o de pestanya</span>
            </label>
          </div>

          <div className="setting-group">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.pushDocument}
                onChange={(e) => {
                  onUpdate({ pushDocument: e.target.checked });
                  if (isEmbedded) window.parent.postMessage({ type: 'TRACES_SET_PUSH', value: e.target.checked }, '*');
                }}
              />
              <span>Fes lloc al panell estrenyent el fitxer</span>
            </label>
          </div>

          <div className="setting-group">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.showAdvanced}
                onChange={(e) => onUpdate({ showAdvanced: e.target.checked })}
              />
              <span>Vista completa (llindars i exportació de dades)</span>
            </label>
          </div>

          {settings.showAdvanced && (
            <>
              <div className="setting-group">
                <label>Pausa que separa sessions</label>
                <div className="chip-group">
                  {[3, 5, 10, 15].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={`chip tabular ${settings.sessionGapMinutes === mins ? 'chip-active' : ''}`}
                      onClick={() => onUpdate({ sessionGapMinutes: mins })}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-group">
                <label>Mida mínima d’un fragment enganxat</label>
                <div className="chip-group">
                  {[25, 50, 100, 500, 1000].map((chars) => (
                    <button
                      key={chars}
                      type="button"
                      className={`chip tabular ${settings.bulkThresholdChars === chars ? 'chip-active' : ''}`}
                      onClick={() => onUpdate({ bulkThresholdChars: chars })}
                    >
                      {chars} car.
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
