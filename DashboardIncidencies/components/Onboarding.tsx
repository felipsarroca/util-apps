import React, { useState } from 'react';

interface OnboardingProps {
  onSubmit: (url: string) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onSubmit }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-8 border border-gray-200">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">Benvingut/da al Dashboard d'Incidències</h1>
        <p className="text-center text-gray-600 mb-8">
          Per començar, enganxa l'URL del teu full de càlcul de Google Sheets.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
            required
          />
          <p className="text-xs text-gray-500 mt-2">
            Exemple: <code>https://docs.google.com/spreadsheets/d/1k5Z66.../edit</code>
          </p>
          <button
            type="submit"
            className="w-full mt-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-indigo-500/50 transform hover:-translate-y-0.5"
          >
            Carregar Dades
          </button>
        </form>
        <div className="mt-8 p-4 bg-indigo-100/50 rounded-lg border border-indigo-200">
            <h3 className="font-semibold text-indigo-800 mb-2">Important: Configuració de permisos</h3>
            <p className="text-sm text-indigo-700">
                Perquè l'aplicació pugui llegir les dades, assegura't que la pestanya anomenada <code className="bg-indigo-200/50 text-indigo-800 px-1 rounded">Buidat</code> del teu full de càlcul estigui compartida públicament. Vés a "Fitxer" → "Comparteix" → "Publica al web" o comparteix-la amb "Qualsevol persona amb l'enllaç".
            </p>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;