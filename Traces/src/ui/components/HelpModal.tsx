// SPDX-License-Identifier: AGPL-3.0-or-later
import { Icon } from './Icon';

interface HelpModalProps {
  version: string;
  onClose: () => void;
}

export function HelpModal({ version, onClose }: HelpModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="drawer-sheet"
        role="dialog"
        aria-label="Guia d'interpretació i privadesa"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <h2>Com interpretar les dades</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Tanca l'ajuda"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="drawer-body help-copy">
          <h3>Què mostra Traces</h3>
          <ul>
            <li>
              <strong>Temps actiu estimat:</strong> suma de les sessions d’edició al document separades per pauses d’inactivitat. No inclou el temps dedicat a llegir, pensar o buscar informació fora del fitxer.
            </li>
            <li>
              <strong>Inserció en bloc:</strong> text incorporat en una única operació. Pot correspondre a copiar i enganxar, però també a un esborrany propi fet en un altre document, dictat per veu, traducció o treball fora de línia.
            </li>
            <li>
              <strong>Conservat vs. reelaborat:</strong> distingeix si un bloc enganxat ha quedat gairebé idèntic al treball final o si l’alumne l’ha editat i transformat a fons.
            </li>
          </ul>

          <h3>Criteri docent i privadesa</h3>
          <p>
            Traces <strong>no és un detector d’IA</strong> ni emet judicis automàtics d’autoria: aporta evidències visuals per guiar la conversa pedagògica amb l’alumnat.
          </p>
          <p>
            Tot el processament es fa <strong>100 % en local al navegador</strong>, només quan el docent ho demana i sense enviar cap text ni dada personal a servidors externs.
          </p>

          <h3>Versió i actualitzacions</h3>
          <p>
            Versió instal·lada: <strong>{version === '0.0.0' ? 'demostració web' : version}</strong>. Quan es publica una versió nova, Traces mostra un avís a dalt del panell i una fletxa taronja a la icona.{' '}
            <a
              href="https://felipsarroca.github.io/util-apps/Traces/#actualitzar"
              target="_blank"
              rel="noopener noreferrer"
            >
              Com actualitzar
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
