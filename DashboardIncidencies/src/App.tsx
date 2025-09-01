import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { fetchSheetData } from './services/googleSheetService';
import { processCsvData } from './utils/dataProcessor';
import type { Incident, UnknownTypeInfo, Filters } from './types';
import { UrlInput } from './components/UrlInput';
import { Dashboard } from './components/Dashboard';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { ErrorMessage } from './components/shared/ErrorMessage';
import { GithubIcon } from './components/shared/Icon';

const App: React.FC = () => {
  const [sheetUrl, setSheetUrl] = useLocalStorage<string | null>('googleSheetUrl', null);
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [filteredIncidents, setFilteredIncidents] = useState<Incident[]>([]);
  const [unknownTypes, setUnknownTypes] = useState<UnknownTypeInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    curs: [],
    tipus: [],
    alumne: [],
  });

  const handleUrlSubmit = (url: string) => {
    setError(null);
    setAllIncidents([]);
    setFilteredIncidents([]);
    setUnknownTypes([]);
    setFilters({ curs: [], tipus: [], alumne: [] });
    setSheetUrl(url);
  };

  const clearUrl = () => {
    setSheetUrl(null);
    setAllIncidents([]);
    setFilteredIncidents([]);
  };

  const loadData = useCallback(async () => {
    if (!sheetUrl) return;

    setIsLoading(true);
    setError(null);

    try {
      const csvData = await fetchSheetData(sheetUrl);
      const { cleanedData, unknownTypes: newUnknownTypes } = processCsvData(csvData);
      setAllIncidents(cleanedData);
      setUnknownTypes(newUnknownTypes);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ha ocorregut un error desconegut.');
      }
      setAllIncidents([]);
    } finally {
      setIsLoading(false);
    }
  }, [sheetUrl]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const newFilteredData = allIncidents.filter(incident => {
      const filterCurs = filters.curs.length === 0 || filters.curs.includes(incident.curs);
      const filterTipus = filters.tipus.length === 0 || filters.tipus.includes(incident.tipus);
      const filterAlumne = filters.alumne.length === 0 || filters.alumne.includes(incident.alumne);
      return filterCurs && filterTipus && filterAlumne;
    });
    setFilteredIncidents(newFilteredData);
  }, [filters, allIncidents]);
  
  const uniqueStudents = useMemo(() => Array.from(new Set(allIncidents.map(i => i.alumne))).sort(), [allIncidents]);

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-10">
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-border-color">
        <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-secondary">
          Analitzador d'Incidències
        </h1>
        <a href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-text-primary transition-colors">
          <GithubIcon />
        </a>
      </header>
      
      <main>
        {isLoading && <LoadingSpinner />}
        {error && <ErrorMessage message={error} onRetry={loadData} />}
        
        {!isLoading && !error && !sheetUrl && <UrlInput onSubmit={handleUrlSubmit} />}
        
        {!isLoading && !error && sheetUrl && allIncidents.length > 0 && (
          <Dashboard
            allIncidents={allIncidents}
            filteredIncidents={filteredIncidents}
            filters={filters}
            setFilters={setFilters}
            unknownTypes={unknownTypes}
            onClearUrl={clearUrl}
            onRefresh={loadData}
            uniqueStudents={uniqueStudents}
          />
        )}

        {!isLoading && !error && sheetUrl && allIncidents.length === 0 && (
           <div className="text-center p-8 bg-surface rounded-lg border border-border-color">
             <p className="text-lg text-text-secondary">No s'han trobat dades vàlides a la fulla de càlcul.</p>
             <p className="text-sm text-slate-500 mt-2">Assegura't que el format és correcte i hi ha dades a les columnes 'Alumne', 'Curs' i 'Tipus'.</p>
             <button
                onClick={clearUrl}
                className="mt-6 bg-brand-primary text-white font-bold py-2 px-6 rounded-lg shadow-md hover:bg-blue-700 transition-all duration-200 transform hover:-translate-y-0.5"
              >
                Canvia el full de càlcul
              </button>
           </div>
        )}
      </main>
    </div>
  );
};

export default App;