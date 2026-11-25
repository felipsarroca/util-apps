// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisSettings, DocumentAnalysis, RawDocumentHistory } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { analyzeDocumentHistory, computeDeadlineStats, toStoredSummary } from '../core/metrics';
import { DEMO_SCENARIOS } from '../core/demoData';
import { buildSummaryText, exportAnalysisCsv, exportRawJson, printAnalysisReport } from '../core/exporters';
import { loadDueInfo, saveClassSummary, saveManualDue } from '../core/classStore';
import { findDueDateInText, parseLooseDate } from '../core/dates';
import {
  detectActiveGoogleDoc,
  docBaseUrl,
  ExtractionError,
  extractGoogleDocHistory,
  isChromeExtensionContext,
  type ActiveDocCandidate,
  type ExtractionProgress,
} from '../extractor/gdocsExtractor';
import { Icon } from './components/Icon';
import { checkForUpdate, getCurrentVersion, type UpdateInfo } from '../core/updateCheck';
import { SummaryTab } from './components/SummaryTab';
import { TextTab } from './components/TextTab';
import { SessionsAuthorsTab } from './components/SessionsAuthorsTab';
import { SettingsDrawer } from './components/SettingsDrawer';
import { HelpModal } from './components/HelpModal';
import { ClassView } from './components/ClassView';

type TabKey = 'resum' | 'text' | 'sessions';

const STORAGE_KEY = 'traces_settings_v1';

async function loadStoredSettings(): Promise<AnalysisSettings> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const res = await chrome.storage.local.get(STORAGE_KEY);
      if (res && res[STORAGE_KEY]) return { ...DEFAULT_SETTINGS, ...res[STORAGE_KEY] };
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

/** El panell s'ha obert des del botó «Analitza la classe»? */
async function consumeOpenViewFlag(): Promise<boolean> {
  if (new URLSearchParams(window.location.search).get('view') === 'classe') return true;
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return false;
  try {
    const res = await chrome.storage.local.get('traces_open_view');
    const flag = res?.traces_open_view as { view: string; at: number } | undefined;
    if (flag && flag.view === 'classe' && Date.now() - flag.at < 30_000) {
      await chrome.storage.local.remove('traces_open_view');
      return true;
    }
  } catch {
    // Ignora
  }
  return false;
}

const ERROR_TITLES: Record<string, string> = {
  NO_PERMISSION: 'Sense accés a l’historial',
  NO_DOC: 'Cap fitxer de Google obert',
  FORMAT_CHANGED: 'Format no reconegut',
};

export function App() {
  const isEmbeddedInDoc = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('embedded') === '1' && isChromeExtensionContext();
  }, []);

  const [settings, setSettings] = useState<AnalysisSettings>(DEFAULT_SETTINGS);
  const [rawHistory, setRawHistory] = useState<RawDocumentHistory | null>(null);
  const [activeDocCandidate, setActiveDocCandidate] = useState<ActiveDocCandidate | null>(null);
  const [loading, setLoading] = useState<ExtractionProgress | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const [view, setView] = useState<'analisi' | 'classe'>('analisi');
  const [activeTab, setActiveTab] = useState<TabKey>('resum');
  const [focusedOpId, setFocusedOpId] = useState<number | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [due, setDue] = useState<{ ts: number; source: 'classroom' | 'manual' } | null>(null);

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

  const deadlineStats = useMemo(
    () => (analysis && due ? computeDeadlineStats(analysis, due.ts) : null),
    [analysis, due]
  );

  // Data de lliurament (Classroom o manual) i resum per a la taula de la classe
  useEffect(() => {
    if (!analysis || analysis.isDemo) {
      setDue(null);
      return;
    }
    let alive = true;
    void (async () => {
      const info = await loadDueInfo(analysis.docId);
      if (!alive) return;
      if (info.manual) setDue({ ts: info.manual, source: 'manual' });
      else {
        const ts = info.text ? findDueDateInText(info.text) ?? parseLooseDate(info.text) : null;
        setDue(ts ? { ts, source: 'classroom' } : null);
      }
    })();
    void saveClassSummary(toStoredSummary(analysis, `${docBaseUrl(analysis.kind, analysis.docId)}/edit`));
    return () => {
      alive = false;
    };
  }, [analysis]);

  const updateSettings = useCallback((partial: Partial<AnalysisSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      void saveStoredSettings(next);
      return next;
    });
  }, []);

  const runLiveExtraction = useCallback(async () => {
    setError(null);
    setShowMore(false);
    setView('analisi');
    setLoading({ phase: 'detectant', message: 'Connectant amb el fitxer…', percent: 10 });

    try {
      const history = await extractGoogleDocHistory((prog) => setLoading(prog));
      lastAnalyzedDocKeyRef.current = `${history.docId}:${history.tabId || ''}`;
      setRawHistory(history);
      setFocusedOpId(null);
      setActiveTab('resum');
    } catch (err) {
      if (err instanceof ExtractionError) {
        setError({ code: err.code, message: err.message });
      } else {
        setError({
          code: 'UNKNOWN',
          message: err instanceof Error ? err.message : 'S’ha produït un error inesperat.',
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

      if (await consumeOpenViewFlag()) {
        setView('classe');
        return;
      }

      if (isChromeExtensionContext()) {
        const candidate = await detectActiveGoogleDoc();
        if (!mounted) return;
        setActiveDocCandidate(candidate);
        if (candidate || isEmbeddedInDoc) void runLiveExtraction();
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
      if (ev.data?.type === 'TRACES_REFRESH_REQUEST' && !rawHistory && !loading) void runLiveExtraction();
    };
    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, [rawHistory, loading, runLiveExtraction]);

  useEffect(() => {
    if (!isChromeExtensionContext() || !chrome.runtime?.onMessage) return;

    const listener = (msg: { type?: string }) => {
      if (msg?.type === 'TRACES_SHOW_CLASS' && !isEmbeddedInDoc) {
        setView('classe');
        return;
      }
      if (msg?.type !== 'TRACES_TAB_CHANGED') return;
      if (isEmbeddedInDoc) return; // L'iframe incrustat pertany al seu propi fitxer
      void (async () => {
        const candidate = await detectActiveGoogleDoc();
        setActiveDocCandidate(candidate);
        if (!candidate) return;
        const key = `${candidate.docId}:${candidate.tabParam || ''}`;
        if (settings.autoAnalyzeOnSwitch && key !== lastAnalyzedDocKeyRef.current) void runLiveExtraction();
      })();
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [settings.autoAnalyzeOnSwitch, runLiveExtraction, isEmbeddedInDoc]);

  const loadDemoScenario = (id: string) => {
    const found = DEMO_SCENARIOS.find((d) => d.id === id) ?? DEMO_SCENARIOS[0];
    setError(null);
    setFocusedOpId(null);
    setView('analisi');
    setRawHistory(found.build());
    setActiveTab('resum');
  };

  const summaryText = () => (analysis ? buildSummaryText(analysis, deadlineStats) : '');

  const handleCopySummary = async () => {
    if (!analysis) return;
    try {
      await navigator.clipboard.writeText(summaryText());
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 1800);
    } catch {
      // Sense porta-retalls
    }
  };

  const handleComment = async (): Promise<boolean> => {
    const text = summaryText();
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'TRACES_BG_FILL_COMMENT', text });
      if (resp?.ok) return true;
    } catch {
      // Continua amb el porta-retalls
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignora
    }
    return false;
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as RawDocumentHistory;
        if (!parsed || !Array.isArray(parsed.changelog)) throw new Error('JSON no vàlid');
        setError(null);
        setView('analisi');
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
        setError({ code: 'IMPORT', message: 'El fitxer no conté un historial de Traces vàlid.' });
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
      `${activeDocCandidate.docId}:${activeDocCandidate.tabParam || ''}` !== `${rawHistory.docId}:${rawHistory.tabId || ''}`);

  const canComment = Boolean(activeDocCandidate?.isInsideClassroom) && Boolean(analysis) && !analysis?.isDemo;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            <img src="./favicon.svg" alt="" width="26" height="26" />
          </span>
          <div className="brand-titles">
            <span className="brand-name">Traces</span>
            {analysis && view === 'analisi' && (
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
              title="Torna a analitzar"
              aria-label="Torna a analitzar"
            >
              <Icon name="refresh" size={15} />
            </button>
          )}

          {analysis && view === 'analisi' && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => printAnalysisReport(analysis, deadlineStats)}
              title="Informe d’una pàgina (imprimir o desar en PDF)"
              aria-label="Informe"
            >
              <Icon name="printer" size={15} />
            </button>
          )}

          {!isEmbeddedInDoc && (
            <button
              type="button"
              className={`icon-btn ${view === 'classe' ? 'icon-btn-on' : ''}`}
              onClick={() => setView((v) => (v === 'classe' ? 'analisi' : 'classe'))}
              title="Taula de la classe"
              aria-label="Taula de la classe"
            >
              <Icon name="table" size={15} />
            </button>
          )}

          {analysis && (
            <div className="dropdown-anchor">
              <button
                type="button"
                className={`icon-btn ${copiedSummary ? 'icon-btn-ok' : ''}`}
                onClick={() => setShowMore((s) => !s)}
                title="Més opcions"
                aria-label="Més opcions"
                aria-expanded={showMore}
              >
                <Icon name={copiedSummary ? 'check-circle' : 'more'} size={15} />
              </button>
              {showMore && (
                <div className="dropdown-menu" onMouseLeave={() => setShowMore(false)}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMore(false);
                      void handleCopySummary();
                    }}
                  >
                    <Icon name="copy" size={14} /> Copia el resum
                  </button>
                  {settings.showAdvanced && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMore(false);
                          exportAnalysisCsv(analysis);
                        }}
                      >
                        <Icon name="file-text" size={14} /> Dades (CSV)
                      </button>
                      {rawHistory && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMore(false);
                            exportRawJson(rawHistory);
                          }}
                        >
                          <Icon name="download" size={14} /> Historial (JSON)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setShowMore(false);
                          fileInputRef.current?.click();
                        }}
                      >
                        <Icon name="upload" size={14} /> Obre un historial
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowMore(false);
                      setShowSettings(true);
                    }}
                  >
                    <Icon name="settings" size={14} /> Opcions
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMore(false);
                      setShowHelp(true);
                    }}
                  >
                    <Icon name="help" size={14} /> Ajuda i privadesa
                  </button>
                </div>
              )}
            </div>
          )}

          {!analysis && (
            <button type="button" className="icon-btn" onClick={() => setShowHelp(true)} title="Ajuda" aria-label="Ajuda">
              <Icon name="help" size={15} />
            </button>
          )}

          {isEmbeddedInDoc && (
            <>
              <button
                type="button"
                className="icon-btn"
                onClick={() => window.parent.postMessage({ type: 'TRACES_TOGGLE_WIDTH' }, '*')}
                title="Panell més ample o més estret"
                aria-label="Canvia l'amplada del panell"
              >
                <Icon name="maximize" size={14} />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => window.parent.postMessage({ type: 'TRACES_CLOSE_DRAWER' }, '*')}
                title="Tanca"
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
            <strong>Versió {updateInfo.version} disponible</strong>
            {updateInfo.notes[0] && <span className="truncate">{updateInfo.notes[0]}</span>}
          </div>
          <a className="btn btn-primary btn-xs" href={updateInfo.url} target="_blank" rel="noopener noreferrer">
            Actualitza
          </a>
          <button type="button" className="icon-btn" onClick={() => setUpdateDismissed(true)} aria-label="Amaga l'avís">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {view === 'analisi' && pendingDifferentDoc && !loading && (
        <div className="switch-doc-bar">
          <div className="switch-doc-info">
            <span className="live-dot" />
            <span className="truncate">
              <strong>{activeDocCandidate.title}</strong>
            </span>
          </div>
          <button type="button" className="btn btn-primary btn-xs" onClick={() => void runLiveExtraction()}>
            Analitza
          </button>
        </div>
      )}

      {view === 'analisi' && analysis?.isDemo && !loading && (
        <div className="demo-bar">
          <span className="demo-tag">
            <Icon name="beaker" size={12} /> Exemple
          </span>
          <div className="demo-pills">
            {DEMO_SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                type="button"
                className={`demo-pill ${analysis.demoId === sc.id ? 'demo-pill-active' : ''}`}
                onClick={() => loadDemoScenario(sc.id)}
                title={sc.subtitle}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".json,application/json" hidden onChange={handleImportJson} />

      {view === 'classe' ? (
        <main className="panel-content">
          <ClassView onClose={() => setView('analisi')} />
        </main>
      ) : (
        <>
          {loading && (
            <main className="center-state">
              <div className="loader-card">
                <div className="spinner" aria-hidden="true" />
                <h2>Analitzant</h2>
                <p>{loading.message}</p>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${loading.percent}%` }} />
                </div>
              </div>
            </main>
          )}

          {!loading && error && (
            <div className="error-box" role="alert">
              <div className="error-head">
                <Icon name="alert-triangle" size={16} />
                <strong>{ERROR_TITLES[error.code] ?? 'No s’ha pogut analitzar'}</strong>
              </div>
              <p>{error.message}</p>
              <div className="error-actions">
                {isChromeExtensionContext() && (
                  <button type="button" className="btn btn-primary btn-xs" onClick={() => void runLiveExtraction()}>
                    <Icon name="refresh" size={13} /> Torna-ho a provar
                  </button>
                )}
                <button type="button" className="btn btn-soft btn-xs" onClick={() => loadDemoScenario('mixt')}>
                  <Icon name="beaker" size={13} /> Exemple
                </button>
              </div>
            </div>
          )}

          {!loading && !analysis && !error && (
            <main className="center-state">
              <div className="welcome-card">
                <div className="welcome-icon">
                  <img src="./favicon.svg" alt="" width="48" height="48" />
                </div>
                <h1>Obriu un treball de Google</h1>
                <div className="welcome-kinds" aria-label="Tipus de fitxer">
                  <span>
                    <Icon name="file-text" size={15} /> Documents
                  </span>
                  <span>
                    <Icon name="slides" size={15} /> Presentacions
                  </span>
                  <span>
                    <Icon name="grid" size={15} /> Fulls de càlcul
                  </span>
                </div>
                <p>
                  Premeu el botó <strong>Traces</strong> del fitxer, o obriu una tasca de Classroom i premeu{' '}
                  <strong>Analitza la classe</strong>.
                </p>
                <div className="welcome-actions">
                  <button type="button" className="btn btn-primary" onClick={() => void runLiveExtraction()}>
                    <Icon name="refresh" size={15} /> Analitza la pestanya
                  </button>
                  <button type="button" className="btn btn-soft" onClick={() => loadDemoScenario('mixt')}>
                    <Icon name="beaker" size={15} /> Exemple
                  </button>
                </div>
              </div>
            </main>
          )}

          {!loading && analysis && (
            <>
              <nav className="tabs-nav" aria-label="Apartats">
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'resum' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('resum')}
                >
                  Resum
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'text' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('text')}
                >
                  {analysis.kind === 'spreadsheet' ? 'Dades' : 'Text'}
                  {(analysis.kind === 'spreadsheet' ? analysis.sheet?.pastes.length ?? 0 : analysis.bulkInsertions.length) > 0 && (
                    <span className="tab-count tabular">
                      {analysis.kind === 'spreadsheet' ? analysis.sheet?.pastes.length : analysis.bulkInsertions.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'sessions' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('sessions')}
                >
                  Sessions
                </button>
              </nav>

              <main className="panel-content">
                {activeTab === 'resum' && (
                  <SummaryTab
                    analysis={analysis}
                    deadline={deadlineStats}
                    deadlineSource={due?.source ?? null}
                    onSetDeadline={(ts) => {
                      setDue(ts ? { ts, source: 'manual' } : null);
                      if (!analysis.isDemo) void saveManualDue(analysis.docId, ts);
                    }}
                    canComment={canComment}
                    onComment={handleComment}
                    onJumpToText={(opId) => {
                      setFocusedOpId(opId ?? null);
                      setActiveTab('text');
                    }}
                    onJumpToSessions={() => setActiveTab('sessions')}
                  />
                )}

                {activeTab === 'text' && (
                  <TextTab
                    analysis={analysis}
                    focusedOpId={focusedOpId}
                    showAdvanced={settings.showAdvanced}
                    onFocusOp={setFocusedOpId}
                    onChangeThreshold={(chars) => updateSettings({ bulkThresholdChars: chars })}
                  />
                )}

                {activeTab === 'sessions' && <SessionsAuthorsTab analysis={analysis} />}
              </main>
            </>
          )}
        </>
      )}

      {showSettings && (
        <SettingsDrawer
          settings={settings}
          isEmbedded={isEmbeddedInDoc}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showHelp && <HelpModal version={getCurrentVersion()} onClose={() => setShowHelp(false)} />}
    </div>
  );
}
