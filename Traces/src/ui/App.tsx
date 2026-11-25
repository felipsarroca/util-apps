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
    // Ignore storage read errors
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
    // Ignore storage write errors
  }
}

export function App() {
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastAnalyzedDocKeyRef = useRef<string>('');

  // Recompute instant analysis whenever rawHistory or settings change (0 network requests!)
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

  // Initial boot: load settings & detect active Google Doc
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
        if (candidate) {
          void runLiveExtraction();
        }
      } else {
        // Standalone preview mode (outside Chrome extension): load realistic Classroom demo immediately
        setRawHistory(DEMO_SCENARIOS[0].build());
      }
    })();

    return () => {
      mounted = false;
    };
  }, [runLiveExtraction]);

  // React to tab/student switches in Chrome
  useEffect(() => {
    if (!isChromeExtensionContext() || !chrome.runtime?.onMessage) return;

    const listener = (msg: { type?: string }) => {
      if (msg?.type !== 'TRACES_TAB_CHANGED') return;
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
  }, [settings.autoAnalyzeOnSwitch, runLiveExtraction]);

  const loadDemoScenario = (id: string) => {
    const found = DEMO_SCENARIOS.find((d) => d.id === id) ?? DEMO_SCENARIOS[0];
    setError(null);
    setSelectedInsertionOpId(null);
    setFocusedParagraph(null);
    setRawHistory(found.build());
    setActiveTab('resum');
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
    activeDocCandidate &&
    (!rawHistory ||
      rawHistory.isDemo ||
      `${activeDocCandidate.docId}:${activeDocCandidate.tabParam || ''}` !==
        `${rawHistory.docId}:${rawHistory.tabId || ''}`);

  return (
    <div className="app-shell">
      {/* Compact top bar */}
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="traces" size={17} />
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
        </div>
      </header>

      {/* Prompt bar if user switched to another Google Doc while viewing demo or previous doc */}
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

      {/* Demo mode switcher bar when inspecting demo scenarios */}
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

      {/* Loading state */}
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

      {/* Error banner */}
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

      {/* Empty welcome state when opened on a non-Docs tab without active analysis */}
      {!loading && !analysis && !error && (
        <main className="center-state">
          <div className="welcome-card">
            <div className="welcome-icon">
              <Icon name="traces" size={28} />
            </div>
            <h1>Obriu un document de Google Docs</h1>
            <p>
              Entreu a qualsevol treball de Google Docs o al qualificador de Google Classroom i premeu <strong>Analitza</strong> per veure el temps actiu, les sessions i les insercions en bloc.
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

      {/* Main tabbed analysis dashboard */}
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

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
