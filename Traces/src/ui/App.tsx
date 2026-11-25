// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AnalysisSettings,
  DocumentAnalysis,
  RawDocumentHistory,
} from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { analyzeDocumentHistory } from '../core/metrics';
import { DEMO_SCENARIOS } from '../core/demoData';
import {
  exportAnalysisCsv,
  exportRawJson,
  formatDuration,
  printAnalysisReport,
} from '../core/exporters';
import {
  detectActiveGoogleDoc,
  ExtractionError,
  extractGoogleDocHistory,
  isChromeExtensionContext,
  type ActiveDocCandidate,
  type ExtractionProgress,
} from '../extractor/gdocsExtractor';
import { Icon } from './components/Icon';
import { checkForUpdate, getCurrentVersion, type UpdateInfo } from '../core/updateCheck';
import { SummaryTab } from './components/SummaryTab';
import { InsertionsTab } from './components/InsertionsTab';
import { DocumentMapTab } from './components/DocumentMapTab';
import { SessionsAuthorsTab } from './components/SessionsAuthorsTab';
import { SettingsDrawer } from './components/SettingsDrawer';
import { HelpModal } from './components/HelpModal';

type TabKey = 'resum' | 'insercions' | 'mapa' | 'sessions';

const STORAGE_KEY = 'traces_settings_v1';

async function loadStoredSettings(): Promise<AnalysisSettings> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const res = await chrome.storage.local.get(STORAGE_KEY);
      if (res && res[STORAGE_KEY]) {
        return { ...DEFAULT_SETTINGS, ...res[STORAGE_KEY] };
      }
    } else {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // Ignora errors de lectura
  }
  return DEFAULT_SETTINGS;
}

async function saveStoredSettings(settings: AnalysisSettings): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: settings });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  } catch {
    // Ignora errors d'escriptura
  }
}

export function App() {
  const isEmbeddedInDoc = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('embedded') === '1' && isChromeExtensionContext();
  }, []);

  const [settings, setSettings] = useState<AnalysisSettings>(DEFAULT_SETTINGS);
  const [rawHistory, setRawHistory] = useState<RawDocumentHistory | null>(null);
  const [activeDocCandidate, setActiveDocCandidate] =
    useState<ActiveDocCandidate | null>(null);
  const [loading, setLoading] = useState<ExtractionProgress | null>(null);
  const [error, setError] = useState<{
    code: string;
    message: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('resum');
  const [selectedInsertionOpId, setSelectedInsertionOpId] = useState<number | null>(
    null
  );
  const [focusedParagraph, setFocusedParagraph] = useState<number | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  useEffect(() => {
    if (!isChromeExtensionContext()) return;
    void checkForUpdate(getCurrentVersion()).then(setUpdateInfo);
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastAnalyzedDocKeyRef = useRef<string>('');

  const analysis: DocumentAnalysis | null = useMemo(() => {
    if (!rawHistory) return null;
    return analyzeDocumentHistory(rawHistory, settings);
  }, [rawHistory, settings]);

  const updateSettings = useCallback((partial: Partial<AnalysisSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      void saveStoredSettings(next);
      return next;
    });
  }, []);

  const runLiveExtraction = useCallback(async () => {
    setError(null);
    setShowExportMenu(false);
    setLoading({
      phase: 'detectant',
      message: 'Connectant amb Google Docs…',
      percent: 10,
    });

    try {
      const history = await extractGoogleDocHistory((prog) => {
        setLoading(prog);
      });
      lastAnalyzedDocKeyRef.current = `${history.docId}:${history.tabId || ''}`;
      setRawHistory(history);
      setSelectedInsertionOpId(null);
      setFocusedParagraph(null);
      setActiveTab('resum');
    } catch (err) {
      if (err instanceof ExtractionError) {
        setError({ code: err.code, message: err.message });
      } else {
        setError({
          code: 'UNKNOWN',
          message:
            err instanceof Error
              ? err.message
              : 'S’ha produït un error inesperat durant l’anàlisi.',
        });
      }
    } finally {
      setLoading(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const loaded = await loadStoredSettings();
      if (!mounted) return;
      setSettings(loaded);

      if (isChromeExtensionContext()) {
        const candidate = await detectActiveGoogleDoc();
        if (!mounted) return;
        setActiveDocCandidate(candidate);
        if (candidate || isEmbeddedInDoc) {
          void runLiveExtraction();
        }
      } else {
        setRawHistory(DEMO_SCENARIOS[0].build());
      }
    })();

    return () => {
      mounted = false;
    };
  }, [runLiveExtraction, isEmbeddedInDoc]);

  useEffect(() => {
    const onWindowMessage = (ev: MessageEvent) => {
      if (ev.data?.type === 'TRACES_REFRESH_REQUEST' && !rawHistory && !loading) {
        void runLiveExtraction();
      }
    };
    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, [rawHistory, loading, runLiveExtraction]);

  useEffect(() => {
    if (!isChromeExtensionContext() || !chrome.runtime?.onMessage) return;

    const listener = (msg: { type?: string }) => {
      if (msg?.type !== 'TRACES_TAB_CHANGED') return;
      if (isEmbeddedInDoc) return; // L'iframe incrustat pertany al seu propi document
      void (async () => {
        const candidate = await detectActiveGoogleDoc();
        setActiveDocCandidate(candidate);
        if (!candidate) return;

        const candidateKey = `${candidate.docId}:${candidate.tabParam || ''}`;
        if (
          settings.autoAnalyzeOnSwitch &&
          candidateKey !== lastAnalyzedDocKeyRef.current
        ) {
          void runLiveExtraction();
        }
      })();
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [settings.autoAnalyzeOnSwitch, runLiveExtraction, isEmbeddedInDoc]);

  const loadDemoScenario = (id: string) => {
    const found = DEMO_SCENARIOS.find((d) => d.id === id) ?? DEMO_SCENARIOS[0];
    setError(null);
    setSelectedInsertionOpId(null);
    setFocusedParagraph(null);
    setRawHistory(found.build());
    setActiveTab('resum');
  };

  const handleCopyQuickSummary = async () => {
    if (!analysis) return;
    const summaryLine =
      `Traces (${analysis.title}): Temps actiu ${formatDuration(
        analysis.totalActiveSeconds
      )} en ${analysis.sessionCount} ${
        analysis.sessionCount === 1 ? 'sessió' : 'sessions'
      } · ${analysis.finalWordCount} paraules · ${
        analysis.progressivePct
      }% progressiu / ${analysis.bulkPct}% en bloc (${
        analysis.bulkInsertions.length
      } blocs >=${analysis.settings.bulkThresholdChars} car.)`;
    try {
      await navigator.clipboard.writeText(summaryLine);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 1800);
    } catch {
      // Ignora si no hi ha porta-retalls
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as RawDocumentHistory;
        if (!parsed || !Array.isArray(parsed.changelog)) {
          throw new Error('Fitxer JSON no vàlid');
        }
        setError(null);
        setRawHistory({
          ...parsed,
          docId: parsed.docId || 'importat',
          title: parsed.title || file.name.replace(/\.json$/i, ''),
          firstRev: parsed.firstRev || 1,
          lastRev: parsed.lastRev || parsed.changelog.length,
          userMap: parsed.userMap || {},
        });
        setActiveTab('resum');
      } catch {
        setError({
          code: 'IMPORT',
          message: 'El fitxer seleccionat no conté un historial JSON de Traces vàlid.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const pendingDifferentDoc =
    !isEmbeddedInDoc &&
    activeDocCandidate &&
    (!rawHistory ||
      rawHistory.isDemo ||
      `${activeDocCandidate.docId}:${activeDocCandidate.tabParam || ''}` !==
        `${rawHistory.docId}:${rawHistory.tabId || ''}`);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            <img src="./favicon.svg" alt="" width="28" height="28" />
          </span>
          <div className="brand-titles">
            <span className="brand-name">Traces</span>
            {analysis && (
              <span className="doc-title-pill" title={analysis.title}>
                {analysis.isDemo ? `Exemple: ${analysis.title}` : analysis.title}
              </span>
            )}
          </div>
        </div>

        <div className="topbar-actions">
          {isChromeExtensionContext() && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => void runLiveExtraction()}
              disabled={Boolean(loading)}
              title="Torna a analitzar el document obert"
              aria-label="Torna a analitzar"
            >
              <Icon name="refresh" size={15} />
            </button>
          )}

          {analysis && (
            <button
              type="button"
              className={`icon-btn ${copiedSummary ? 'icon-btn-ok' : ''}`}
              onClick={() => void handleCopyQuickSummary()}
              title={
                copiedSummary
                  ? 'Resum copiat al porta-retalls!'
                  : 'Copia una síntesi en text per a les teves notes'
              }
              aria-label="Copia el resum"
            >
              <Icon name={copiedSummary ? 'check-circle' : 'copy'} size={15} />
            </button>
          )}

          {analysis && rawHistory && (
            <div className="dropdown-anchor">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowExportMenu((s) => !s)}
                title="Exporta o imprimeix l'informe"
                aria-label="Exporta"
              >
                <Icon name="download" size={15} />
              </button>
              {showExportMenu && (
                <div
                  className="dropdown-menu"
                  onMouseLeave={() => setShowExportMenu(false)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      printAnalysisReport(analysis);
                    }}
                  >
                    <Icon name="printer" size={14} /> Informe PDF / Imprimeix
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      exportAnalysisCsv(analysis);
                    }}
                  >
                    <Icon name="file-text" size={14} /> Taula de dades (CSV)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      exportRawJson(rawHistory);
                    }}
                  >
                    <Icon name="download" size={14} /> Historial brut (JSON)
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowSettings(true)}
            title="Opcions i llindars"
            aria-label="Opcions"
          >
            <Icon name="settings" size={15} />
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowHelp(true)}
            title="Com interpretar les dades i privadesa"
            aria-label="Ajuda"
          >
            <Icon name="help" size={15} />
          </button>

          {isEmbeddedInDoc && (
            <>
              <button
                type="button"
                className="icon-btn"
                onClick={() =>
                  window.parent.postMessage({ type: 'TRACES_TOGGLE_WIDTH' }, '*')
                }
                title="Alterna entre amplada normal (480 px) i vista ampla (660 px)"
                aria-label="Canvia l'amplada del panell"
              >
                <Icon name="maximize" size={14} />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() =>
                  window.parent.postMessage({ type: 'TRACES_CLOSE_DRAWER' }, '*')
                }
                title="Tanca el panell de Traces"
                aria-label="Tanca el panell"
              >
                <Icon name="x" size={16} />
              </button>
            </>
          )}
        </div>
      </header>

      {updateInfo && !updateDismissed && (
        <div className="update-bar" role="status">
          <div className="update-info">
            <strong>Nova versió {updateInfo.version} disponible</strong>
            {updateInfo.notes[0] && <span className="truncate">{updateInfo.notes[0]}</span>}
          </div>
          <a
            className="btn btn-primary btn-xs"
            href={updateInfo.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Com actualitzar
          </a>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setUpdateDismissed(true)}
            aria-label="Amaga l'avís"
            title="Amaga l'avís"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {pendingDifferentDoc && !loading && (
        <div className="switch-doc-bar">
          <div className="switch-doc-info">
            <span className="live-dot" />
            <span className="truncate">
              {activeDocCandidate.isInsideClassroom ? 'Classroom: ' : ''}
              <strong>{activeDocCandidate.title}</strong>
            </span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-xs"
            onClick={() => void runLiveExtraction()}
          >
            Analitza
          </button>
        </div>
      )}

      {analysis?.isDemo && !loading && (
        <div className="demo-bar">
          <div className="demo-bar-top">
            <span className="demo-tag">
              <Icon name="beaker" size={12} /> Mode de mostra
            </span>
            <button
              type="button"
              className="link-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="upload" size={12} /> Carrega JSON
            </button>
          </div>
          <div className="demo-pills">
            {DEMO_SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                type="button"
                className={`demo-pill ${
                  analysis.demoId === sc.id ? 'demo-pill-active' : ''
                }`}
                onClick={() => loadDemoScenario(sc.id)}
                title={sc.subtitle}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={handleImportJson}
      />

      {loading && (
        <main className="center-state">
          <div className="loader-card">
            <div className="spinner" aria-hidden="true" />
            <h2>Analitzant el document</h2>
            <p>{loading.message}</p>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${loading.percent}%` }}
              />
            </div>
          </div>
        </main>
      )}

      {!loading && error && (
        <div className="error-box" role="alert">
          <div className="error-head">
            <Icon name="alert-triangle" size={16} />
            <strong>
              {error.code === 'NO_PERMISSION'
                ? 'Sense accés a l’historial d’edicions'
                : error.code === 'NO_DOC'
                  ? 'Cap document de Google Docs actiu'
                  : 'No s’ha pogut completar l’anàlisi'}
            </strong>
          </div>
          <p>{error.message}</p>
          <div className="error-actions">
            {isChromeExtensionContext() && (
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={() => void runLiveExtraction()}
              >
                <Icon name="refresh" size={13} /> Torna-ho a provar
              </button>
            )}
            <button
              type="button"
              className="btn btn-soft btn-xs"
              onClick={() => loadDemoScenario('mixt')}
            >
              <Icon name="beaker" size={13} /> Veure exemple interactiu
            </button>
          </div>
        </div>
      )}

      {!loading && !analysis && !error && (
        <main className="center-state">
          <div className="welcome-card">
            <div className="welcome-icon">
              <img src="./favicon.svg" alt="" width="52" height="52" />
            </div>
            <h1>Obriu un document de Google Docs</h1>
            <p>
              Entreu a qualsevol treball de Google Docs o al qualificador de Google Classroom i premeu el botó <strong>Traces</strong> de dalt a la dreta per veure el temps actiu, les sessions i les insercions en bloc.
            </p>

            <div className="welcome-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void runLiveExtraction()}
              >
                <Icon name="refresh" size={15} /> Analitza la pestanya actual
              </button>
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => loadDemoScenario('mixt')}
              >
                <Icon name="beaker" size={15} /> Explora un cas de mostra
              </button>
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="upload" size={15} /> Obre un historial JSON
              </button>
            </div>
          </div>
        </main>
      )}

      {!loading && analysis && (
        <>
          <nav className="tabs-nav" aria-label="Apartats de l'anàlisi">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'resum' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('resum')}
            >
              Resum
            </button>
            <button
              type="button"
              className={`tab-btn ${
                activeTab === 'insercions' ? 'tab-active' : ''
              }`}
              onClick={() => setActiveTab('insercions')}
            >
              Insercions
              {analysis.bulkInsertions.length > 0 && (
                <span className="tab-count tabular">
                  {analysis.bulkInsertions.length}
                </span>
              )}
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'mapa' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('mapa')}
            >
              Mapa
            </button>
            <button
              type="button"
              className={`tab-btn ${
                activeTab === 'sessions' ? 'tab-active' : ''
              }`}
              onClick={() => setActiveTab('sessions')}
            >
              Sessions
            </button>
          </nav>

          <main className="panel-content">
            {activeTab === 'resum' && (
              <SummaryTab
                analysis={analysis}
                onJumpToInsertions={(opId) => {
                  setSelectedInsertionOpId(opId ?? null);
                  setActiveTab('insercions');
                }}
                onJumpToMap={() => {
                  setFocusedParagraph(null);
                  setActiveTab('mapa');
                }}
                onJumpToSessions={() => setActiveTab('sessions')}
              />
            )}

            {activeTab === 'insercions' && (
              <InsertionsTab
                analysis={analysis}
                selectedOpId={selectedInsertionOpId}
                onChangeThreshold={(chars) =>
                  updateSettings({ bulkThresholdChars: chars })
                }
                onLocateInMap={(opId, paraNum) => {
                  setSelectedInsertionOpId(opId);
                  setFocusedParagraph(paraNum);
                  setActiveTab('mapa');
                }}
              />
            )}

            {activeTab === 'mapa' && (
              <DocumentMapTab
                analysis={analysis}
                focusedBulkOpId={selectedInsertionOpId}
                focusedParagraph={focusedParagraph}
                onSelectBulkInsertion={(opId) => {
                  setSelectedInsertionOpId(opId);
                  setActiveTab('insercions');
                }}
              />
            )}

            {activeTab === 'sessions' && (
              <SessionsAuthorsTab analysis={analysis} />
            )}
          </main>
        </>
      )}

      {showSettings && (
        <SettingsDrawer
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showHelp && <HelpModal version={getCurrentVersion()} onClose={() => setShowHelp(false)} />}
    </div>
  );
}
