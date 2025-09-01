import React, { useState } from 'react';
import { LinkIcon } from './shared/Icon';

interface UrlInputProps {
  onSubmit: (url: string) => void;
}

export const UrlInput: React.FC<UrlInputProps> = ({ onSubmit }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-8 bg-surface rounded-2xl shadow-lg border border-border-color">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-brand-primary">
          <LinkIcon />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-text-primary">Connecta el teu Google Sheet</h2>
        <p className="mt-2 text-md text-text-secondary">
          Enganxa l'enllaç a la teva fulla de càlcul per començar a analitzar les dades.
          Assegura't que la pestanya es diu "Buidat" i que el document és públic.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="rounded-md shadow-sm -space-y-px">
          <div>
            <label htmlFor="sheet-url" className="sr-only">
              URL del Google Sheet
            </label>
            <input
              id="sheet-url"
              name="url"
              type="url"
              required
              className="appearance-none rounded-md relative block w-full px-4 py-3 border border-slate-300 bg-white placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-brand-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-brand-primary transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg shadow-blue-500/20"
          >
            Carrega Dades
          </button>
        </div>
      </form>
    </div>
  );
};