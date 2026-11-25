// SPDX-License-Identifier: AGPL-3.0-or-later
import { Icon } from './Icon';
import { SUGGESTIONS_URL } from './SummaryTab';

const SITE = 'https://felipsarroca.github.io/util-apps/Traces/';

interface HelpModalProps {
  version: string;
  onClose: () => void;
}

export function HelpModal({ version, onClose }: HelpModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="drawer-sheet" role="dialog" aria-label="Ajuda" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>Com llegir Traces</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tanca l'ajuda">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="drawer-body help-copy">
          <ul className="help-list">
            <li>
              <strong>Treball:</strong> temps que el fitxer s’ha estat editant. No compta el temps de llegir o pensar fora del fitxer.
            </li>
            <li>
              <strong>Escrit pas a pas:</strong> text que ha anat apareixent a poc a poc, com quan s’escriu.
            </li>
            <li>
              <strong>Enganxat:</strong> fragment que ha entrat d’un sol cop. Pot ser copiat, però també un esborrany propi, un dictat o una traducció.
            </li>
            <li>
              <strong>Mogut:</strong> text propi retallat i enganxat dins del mateix fitxer. No compta com a enganxat.
            </li>
            <li>
              <strong>Poques correccions:</strong> molt text escrit sense esborrar res. Pot indicar que s’ha copiat a mà.
            </li>
          </ul>

          <p className="help-callout">
            <Icon name="alert-triangle" size={14} /> No és un detector d’IA ni prova res per si sol: és un punt de partida per parlar amb l’alumne.
          </p>

          <h3>
            <Icon name="shield" size={14} /> Privadesa
          </h3>
          <p>
            Tot es calcula en aquest navegador i només quan ho demaneu. No s’envia cap text ni cap dada a cap servidor. La taula de la classe desa només números, mai el text.
          </p>
          <div className="help-links">
            <a href={`${SITE}privadesa.html`} target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={12} /> Privadesa i full per a famílies
            </a>
            <a href={SUGGESTIONS_URL} target="_blank" rel="noopener noreferrer">
              <Icon name="message" size={12} /> Errors i suggeriments
            </a>
            <a href={`${SITE}#actualitzar`} target="_blank" rel="noopener noreferrer">
              <Icon name="refresh" size={12} /> Com actualitzar
            </a>
          </div>
          <p className="help-version tabular">Versió {version === '0.0.0' ? 'de demostració' : version}</p>
        </div>
      </div>
    </div>
  );
}
