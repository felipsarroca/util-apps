import React, { useState, useEffect } from 'react';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import { useData } from './hooks/useData';
import { ErrorIcon } from './components/common/Icons';

const LOCAL_STORAGE_KEY = 'googleSheetUrl';

const App: React.FC = () => {
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  
  useEffect(() => {
    const savedUrl = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedUrl) {
      setSheetUrl(savedUrl);
    }
  }, []);

  const { data, isLoading, error, warnings } = useData(sheetUrl);

  const handleUrlSubmit = (url: string) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, url);
    setSheetUrl(url);
  };
  
  const handleReset = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setSheetUrl(null);
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-700">
            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-indigo-500"></div>
            <p className="mt-4 text-lg">Processant dades...</p>
        </div>
      );
    }

    if (error) {
       return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
             <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 border border-red-300">
                <div className="flex items-center mb-4">
                    <ErrorIcon />
                    <h2 className="text-2xl font-bold text-red-700">Error en Carregar les Dades</h2>
                </div>
                <p className="text-red-800 bg-red-100 p-4 rounded-md">{error}</p>
                <button onClick={handleReset} className="w-full mt-6 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-red-500/50">
                    Intenta-ho de nou amb un altre URL
                </button>
             </div>
        </div>
       )
    }
    
    if (sheetUrl) {
      return <Dashboard data={data} warnings={warnings} onReset={handleReset} />;
    }
    
    return <Onboarding onSubmit={handleUrlSubmit} />;
  }

  return (
    <div>
        {renderContent()}
    </div>
  );
};

export default App;