// Ajuda: com s'obté de Clickedu el llistat de pares i mares (basada en la guia de VeuAlumnat).
// Les il·lustracions són esquemes fets amb HTML, no captures de Clickedu, i porten dades inventades.

import { Modal } from '../ui/common'

const Box = ({ on }: { on?: boolean }) => <span className={`ck-box${on ? ' on' : ''}`} aria-hidden="true">{on ? '✓' : ''}</span>

export function ClickeduHelp({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Com s’obté el llistat de famílies de Clickedu" onClose={onClose} wide>
      <div className="ck-help">
        <p>
          Els correus de les famílies surten de Clickedu en un fitxer CSV. Clickedu no té el correu de l’alumnat, però no cal: l’app troba cada alumne pel <b>nom</b> dins del seu <b>curs</b>. Només necessita quatre dades:
          curs, nom de l’alumne, nom del responsable i correu.
        </p>

        <h3>1. Exportar el llistat des de Clickedu</h3>
        <figure>
          <div className="ck-path" aria-label="Camí de menús a Clickedu">
            <b>Administració</b><i>›</i><b>Gestió d’usuaris</b><i>›</i><b>Llistats</b><i>›</i><b>Llistat de pares i mares</b>
          </div>
        </figure>
        <ol className="ck-steps">
          <li>A Clickedu, ves a <span className="ck-ui">Administració</span> › <span className="ck-ui">Gestió d’usuaris</span> › <span className="ck-ui">Llistats</span> › <span className="ck-ui">Llistat de pares i mares</span>.</li>
          <li>Selecciona <b>totes les classes, de 3r de primària a 4t d’ESO</b>, i fes clic a <span className="ck-ui">Generar</span>.</li>
          <li>A les dades bàsiques, marca <b>Nom alumne</b>, <b>Nom i cognoms</b> i <b>Correu electrònic</b>. La resta no cal: com menys dades personals, millor.</li>
          <li>Deixa marcat <b>Ordenar per classe i alumne</b> i torna a fer clic a <span className="ck-ui">Generar</span>.</li>
          <li>Quan aparegui el llistat, al menú de dalt fes clic a <span className="ck-ui">Exportar a excel</span>.</li>
          <li>El navegador desa un fitxer amb un nom com <span className="ck-file">llistat_responsables_20261031_211211.csv</span> a la carpeta <b>Baixades</b>. Deixa’l allà: no el moguis a Drive ni a cap carpeta compartida.</li>
        </ol>

        <figure>
          <div className="ck-screen" role="img" aria-label="Il·lustració de les opcions del llistat de pares i mares">
            <div className="ck-bar"><div className="ck-dots"><i /><i /><i /></div><div className="ck-url">Clickedu · Llistat de pares i mares</div></div>
            <div className="ck-body">
              <div className="ck-label">Classes</div>
              <div className="ck-checks" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))' }}>
                {['3r Primària', '4t Primària', '5è Primària', '6è Primària', '1r ESO', '2n ESO', '3r ESO', '4t ESO'].map((c) => <label key={c}><Box on />{c}</label>)}
              </div>
              <div className="ck-label">Dades bàsiques</div>
              <div className="ck-checks" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                <label><Box on />Nom alumne</label><label><Box on />Nom i cognoms</label><label><Box on />Correu electrònic</label><label><Box />Telèfon</label><label><Box />Adreça</label>
              </div>
              <div className="ck-checks"><label><Box on />Ordenar per classe i alumne</label></div>
              <div className="ck-row"><span className="ck-btn hl">Generar</span><span className="ck-stat">→ després, a dalt: <b>Exportar a excel</b></span></div>
            </div>
          </div>
          <figcaption>Esquema de les opcions que cal marcar (no és una captura de Clickedu).</figcaption>
        </figure>

        <p>El fitxer té aquesta forma (dades inventades). Pot venir amb capçalera o sense, i amb les columnes en un altre ordre:</p>
        <div className="ck-sheet">
          <table>
            <tbody>
              <tr><td className="hd">Núm.</td><td className="hd">Curs</td><td className="hd">Nom alumne</td><td className="hd">Nom i cognoms</td><td className="hd">Correu electrònic</td></tr>
              <tr><td>1</td><td>Quart d’ESO</td><td>Anna Exemple Mostra</td><td>Exemple Riu, Jordi</td><td>familia.exemple@correu.cat</td></tr>
              <tr><td>2</td><td>Quart d’ESO</td><td>Anna Exemple Mostra</td><td>Mostra Pla, Marta</td><td>marta.mostra@correu.cat</td></tr>
            </tbody>
          </table>
        </div>
        <p className="muted">Si Clickedu canvia l’ordre de les columnes, el separador, els accents del fitxer o la manera d’escriure el curs («4t ESO», «Quart d’ESO»…), l’app ho continua entenent.</p>

        <h3>2. Carregar-lo a l’app</h3>
        <ol className="ck-steps">
          <li>A <span className="ck-ui">Famílies</span>, clica <span className="ck-ui">Importa des de CSV</span> i tria el fitxer de Baixades.</li>
          <li>L’app relaciona cada fila amb un alumne del cens pel nom, encara que estigui escrit en un altre ordre, sense accents, amb un cognom de més o amb inicials («Rita A.» i «Rita Amina»).</li>
          <li>Si un nom s’assembla al d’un alumne però no és segur, surt com a <b>proposta</b> sense marcar. Marca-la si és correcta.</li>
          <li>Els noms que no són al cens i les famílies sense correu surten a la llista d’incidències: no s’importen. Revisa-les a Clickedu o al cens.</li>
          <li>Clica <span className="ck-ui">Importa N correus</span>. Per a cada alumne del fitxer, els correus nous substitueixen els anteriors i queden validats.</li>
          <li><b>Esborra el CSV de Baixades</b> i buida la paperera: conté dades personals de totes les famílies.</li>
        </ol>

        <figure>
          <div className="ck-screen" role="img" aria-label="Il·lustració de la revisió de propostes">
            <div className="ck-bar"><div className="ck-dots"><i /><i /><i /></div><div className="ck-url">La teva veu · Famílies</div></div>
            <div className="ck-body">
              <div className="ck-row"><span className="ck-pill ok">412 correus correctes (216 alumnes)</span><span className="ck-pill bad">3 incidències</span></div>
              <div className="ck-row"><Box /><span className="ck-stat"><b>Fila 17 · «Carles Exemple Mostra»</b> → potser és <b>Carles E. Mostra</b></span></div>
              <div className="ck-row"><span className="ck-stat">Fila 23 · No es troba «Laia Assaig Ficció» a 3r ESO al cens.</span></div>
              <div className="ck-row"><span className="ck-stat">Fila 40 · Pau Prova Model: la família no té correu a Clickedu.</span></div>
              <div className="ck-row"><span className="ck-btn hl">Importa 412 correus</span></div>
            </div>
          </div>
          <figcaption>Il·lustració amb noms inventats. La proposta dubtosa surt sense marcar: només s’importa si la marques.</figcaption>
        </figure>

        <h3>Quan cal fer-ho</h3>
        <ul>
          <li>Un cop a l’inici de curs, després d’importar el cens i el nou 3r de primària.</li>
          <li>Quan hi hagi canvis de famílies a Clickedu: es pot tornar a importar tot el fitxer. Els alumnes que no hi surten no canvien.</li>
        </ul>
      </div>
    </Modal>
  )
}
