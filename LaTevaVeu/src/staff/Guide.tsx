// Guia del personal: com funciona tota l'app, amb un recorregut pas a pas per a la tutoria i un per a l'administració.

import { useEffect, useState, type ReactNode } from 'react'
import { THRESHOLD } from '../domain/feedback'
import { APP_ICON, Icon } from '../ui/common'

const TOC: { id: string; title: string; emoji: string }[] = [
  { id: 'que-es', title: 'Què és La teva veu', emoji: '🧭' },
  { id: 'rols', title: 'Qui pot fer què', emoji: '🔐' },
  { id: 'pantalla', title: 'Com es mou per l’app', emoji: '🖥️' },
  { id: 'tutoria', title: 'Pas a pas: tutoria i professorat', emoji: '📋' },
  { id: 'administracio', title: 'Pas a pas: administració', emoji: '🗂️' },
  { id: 'inici-curs', title: 'Posada en marxa del curs', emoji: '🚀' },
  { id: 'centre', title: 'Centre: persones, grups i famílies', emoji: '🏫' },
  { id: 'em-miro', title: 'Em miro pas a pas', emoji: '💭' },
  { id: 'informes-em', title: 'Informes i famílies', emoji: '📄' },
  { id: 'et-veig', title: 'Et veig… pas a pas', emoji: '👀' },
  { id: 'moderacio', title: 'Moderació dels comentaris', emoji: '🛡️' },
  { id: 'resultats', title: 'Resultats d’Et veig…', emoji: '📊' },
  { id: 'questionaris', title: 'Qüestionaris i preguntes', emoji: '✏️' },
  { id: 'confidencialitat', title: 'Confidencialitat i seguretat', emoji: '🔒' },
  { id: 'calendari', title: 'Calendari orientatiu', emoji: '🗓️' },
  { id: 'problemes', title: 'Problemes freqüents', emoji: '🧰' },
  { id: 'glossari', title: 'Glossari', emoji: '📚' },
]

function Sec({ id, children }: { id: string; children: ReactNode }) {
  const t = TOC.find((x) => x.id === id)!
  const n = TOC.indexOf(t) + 1
  return (
    <section id={`g-${id}`} className="guide-sec">
      <h2>
        <span className="guide-n">{n}</span>
        <span aria-hidden="true">{t.emoji}</span> {t.title}
      </h2>
      {children}
    </section>
  )
}

const Where = ({ children }: { children: ReactNode }) => <span className="guide-where">{children}</span>
const Tip = ({ children }: { children: ReactNode }) => (
  <div className="notice">
    <Icon name="info" />
    <div>{children}</div>
  </div>
)
const Warn = ({ children }: { children: ReactNode }) => (
  <div className="notice warn">
    <Icon name="alert" />
    <div>{children}</div>
  </div>
)

/** Guia completa per a qui administra l'app. S'obre a …/#/guia i es pot imprimir o desar en PDF. */
export function GuideScreen({ onClose }: { onClose: () => void }) {
  const [cur, setCur] = useState(TOC[0].id)
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setCur(vis[0].target.id.slice(2))
      },
      { rootMargin: '-80px 0px -65% 0px' },
    )
    document.querySelectorAll('.guide-sec').forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])
  const go = (id: string) => document.getElementById(`g-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="guide">
      <nav className="guide-toc no-print" aria-label="Índex de la guia">
        <button className="btn small" onClick={onClose}>
          <Icon name="arrowL" /> Torna a l’app
        </button>
        <b className="guide-toc-title">Índex</b>
        <ol>
          {TOC.map((t) => (
            <li key={t.id}>
              <button className={cur === t.id ? 'cur' : ''} onClick={() => go(t.id)}>
                <span aria-hidden="true">{t.emoji}</span> {t.title}
              </button>
            </li>
          ))}
        </ol>
        <button className="btn small primary" onClick={() => window.print()}>
          <Icon name="print" /> Imprimeix o desa en PDF
        </button>
      </nav>
      <label className="guide-jump no-print">
        <span className="sr-only">Ves a l’apartat</span>
        <select className="select" value={cur} onChange={(e) => go(e.target.value)}>
          {TOC.map((t, i) => (
            <option key={t.id} value={t.id}>
              {i + 1}. {t.title}
            </option>
          ))}
        </select>
      </label>

      <article className="guide-body">
        <header className="guide-cover">
          <img src={APP_ICON} alt="" />
          <div>
            <small>Escola Ramon Pont · Guia del personal</small>
            <h1>La teva veu</h1>
            <p>Com funciona l’app pas a pas: un recorregut per a la tutoria i el professorat, un per a l’administració i, després, el detall de cada pantalla.</p>
          </div>
        </header>

        <div className="guide-start no-print">
          <b>Per on començo?</b>
          <div className="guide-cards two">
            <button className="guide-card em" onClick={() => go('tutoria')}>
              <b>📋 Soc tutor, tutora o docent</b>
              <p>Què he de fer abans, durant i després de cada recollida, i com consulto el meu informe.</p>
            </button>
            <button className="guide-card ce" onClick={() => go('administracio')}>
              <b>🗂️ Faig l’administració</b>
              <p>Com es prepara el curs, com s’obre i es tanca cada recollida i com arriben els informes.</p>
            </button>
          </div>
        </div>

        <Sec id="que-es">
          <p>
            <b>La teva veu</b> recull la mirada de l’alumnat de 3r de primària a 4t d’ESO. Té dos espais independents, cadascun amb el seu color, les seves recollides i els seus informes, i un tercer espai amb les dades comunes.
          </p>
          <div className="guide-cards">
            <div className="guide-card em">
              <b>💭 Em miro</b>
              <span>Autoavaluació de l’alumnat</span>
              <p>Cada alumne pensa en com aprèn a cada matèria. La tutoria en fa el seguiment i en treu l’informe individual <b>«Així em veig»</b> per a l’alumne i la família.</p>
            </div>
            <div className="guide-card ev">
              <b>👀 Et veig…</b>
              <span>L’alumnat valora el professorat</span>
              <p>Cada alumne valora una vegada cada docent que li fa classe. Cada docent rep l’informe agregat <b>«Així et veiem»</b>; ningú no veu respostes individuals.</p>
            </div>
            <div className="guide-card ce">
              <b>🏫 Centre</b>
              <span>Dades comunes</span>
              <p>Cens de l’alumnat, accessos del personal, matèries de cada curs, apartats actius, correu i registre d’operacions. Ho fan servir tots dos espais.</p>
            </div>
          </div>
          <p>Tres principis guien tot el funcionament:</p>
          <ul>
            <li><b>Només hi entren comptes @ramonpont.cat</b>, i tenir-ne un no dona accés a res: cal constar al cens o tenir un permís.</li>
            <li><b>Cadascú veu només el que li pertoca</b>: l’alumne, el seu; el tutor, els seus grups; el docent, el seu informe.</li>
            <li><b>A «Et veig…», la confidencialitat va per davant</b>: llindar de {THRESHOLD} respostes, comentaris moderats i cap manera de saber qui ha dit què.</li>
          </ul>
          <Warn>
            <b>Estat actual:</b> la versió publicada funciona en mode de demostració, amb dades fictícies desades en el navegador. L’entrada amb Google, el servidor de l’escola i l’enviament de correus a les famílies s’activaran quan l’escola ho autoritzi. Aquesta guia ja descriu el funcionament definitiu.
          </Warn>
        </Sec>

        <Sec id="rols">
          <p>Els permisos depenen del rol de cada persona. Un mateix docent pot ser tutor (té grups) i formar part de l’Equip Directiu.</p>
          <div className="table-wrap">
            <table className="t guide-t">
              <thead>
                <tr><th>Rol</th><th>💭 Em miro</th><th>👀 Et veig…</th><th>🏫 Centre</th></tr>
              </thead>
              <tbody>
                <tr><td><b>Alumnat</b></td><td>Respon la seva autoavaluació mentre la recollida és oberta</td><td>Valora cada docent que li fa classe, una sola vegada</td><td>Pot avisar si el seu nom, curs o grup no són correctes</td></tr>
                <tr><td><b>Professorat</b></td><td>—</td><td>Fa la seva autoavaluació i veu el seu informe quan es publica</td><td>—</td></tr>
                <tr><td><b>Tutoria</b> (docent amb grups)</td><td>Tauler, respostes i informes dels seus grups</td><td>Com la resta del professorat</td><td>—</td></tr>
                <tr><td><b>Equip Directiu</b></td><td>Veu el seguiment i els informes de tot l’alumnat</td><td>Gestiona les recollides, <b>modera els comentaris</b>, fa el seguiment del professorat, veu tots els informes i la visió de centre</td><td>Correus de les famílies; decideix qui forma part de l’Equip Directiu</td></tr>
                <tr><td><b>Administració</b></td><td>Ho veu tot, crea les recollides i edita els qüestionaris</td><td>Gestiona les recollides, les preguntes i les assignacions; <b>no veu cap resultat</b></td><td>Accessos, cens, grups, famílies, matèries, apartats i registre</td></tr>
              </tbody>
            </table>
          </div>
          <Tip>Si una persona d’administració també forma part de l’Equip Directiu, té tots dos permisos. Només un membre de l’Equip Directiu pot afegir-hi o treure’n persones, i ningú no pot canviar la seva pròpia pertinença.</Tip>
        </Sec>

        <Sec id="pantalla">
          <ol className="guide-steps">
            <li><b>Pantalla d’inici.</b> En entrar, el personal veu un requadre per a cada espai al qual té accés (Em miro, Et veig… i Centre), amb el que hi pot fer. Clica <b>Entra</b> per obrir-lo.</li>
            <li><b>Menú lateral.</b> A dalt hi ha unes pestanyes per canviar d’espai. A sota, les pantalles de l’espai, separades en <b>Seguiment</b> (el dia a dia) i <b>Configuració</b> (el que es prepara abans). A baix de tot, <b>Inici</b> torna a la pantalla d’inici.</li>
            <li><b>Colors.</b> Em miro és granat, Et veig… és verd blavós i Centre és gris pissarra: el color indica en quin espai ets.</li>
            <li><b>Capçalera.</b> A la dreta hi ha el botó <b>Guia</b> (aquesta pàgina), qui ha entrat i <b>Surt</b>.</li>
            <li><b>Adreces directes.</b> …/#/em-miro, …/#/et-veig i …/#/centre obren cada espai; …/#/guia obre aquesta guia.</li>
          </ol>
          <Tip>Amb pantalles petites, l’app es compacta per mantenir la mateixa disposició. Al mòbil, el menú lateral passa a ser una barra horitzontal a sota de la capçalera.</Tip>
        </Sec>

        <Sec id="tutoria">
          <p>El recorregut d’una recollida d’<b>Em miro</b> des del punt de vista del tutor o la tutora, i el de cada docent a <b>Et veig…</b>. Si no tens tutoria, ves directament als passos 6 i 7.</p>
          <Tip>Amb el teu compte només veus l’alumnat dels grups que tens assignats. Si hi falta un grup o un alumne, demana-ho a l’administració: ho canvia a <b>Centre › Alumnat i accessos</b>.</Tip>

          <h3>1. Abans de la primera recollida</h3>
          <ol className="guide-steps">
            <li>Entra amb el compte de l’escola i, a la pantalla d’inici, clica <b>Em miro › Entra</b>.</li>
            <li>Al <Where>Tauler</Where> comprova que hi surten els teus grups. A <Where>Respostes</Where> hi ha la llista de l’alumnat: revisa que no hi falti ningú i que tothom sigui al grup correcte.</li>
            <li>A <Where>Així em veig i famílies</Where> mira la columna del correu familiar. Si un alumne no en té cap de validat, el seu informe s’haurà de lliurar en paper.</li>
          </ol>

          <h3>2. Quan s’obre la recollida</h3>
          <ol className="guide-steps">
            <li>L’administració obre la recollida del teu curs. A <Where>Recollides</Where> en veus l’estat i les dates; tu no l’has d’obrir ni tancar.</li>
            <li>Reserva una sessió amb ordinadors o tauletes. Calcula uns 5 minuts a 3r i 4t, uns 8 a 5è i 6è i uns 12 a l’ESO, més el temps d’entrar.</li>
            <li>Explica a l’alumnat per què ho fem. Per exemple: <i>«No és un examen: no hi ha respostes bones ni dolentes. Pensa en com aprens i què podries millorar. El que escriguis ho llegirà la teva família amb tu.»</i></li>
            <li>Cada alumne entra amb el seu compte de l’escola i clica <b>Comença</b>. A primària, el botó <b>Escolta</b> llegeix les preguntes en veu alta.</li>
          </ol>
          <Tip>Les respostes es desen soles. Si a algú no li dona temps, pot continuar un altre dia mentre la recollida sigui oberta.</Tip>

          <h3>3. Mentre és oberta</h3>
          <ol className="guide-steps">
            <li>Al <Where>Tauler</Where>, la barra de cada grup mostra quants alumnes han lliurat, quants van a mitges i quants no han començat.</li>
            <li>A <Where>Respostes</Where> filtra per <b>En curs</b> o <b>No iniciada</b> per saber a qui has de recordar que l’acabi.</li>
            <li>Amb <b>Veure</b> pots llegir les respostes d’un alumne que ja ha lliurat.</li>
          </ol>

          <h3>4. Quan es tanca: revisar i preparar els informes</h3>
          <ol className="guide-steps">
            <li>Quan l’administració tanca la recollida, l’alumnat ja no pot respondre.</li>
            <li>Ves a <Where>Així em veig i famílies</Where> i tria la recollida.</li>
            <li>Obre l’informe de cada alumne amb <b>Veure</b> i llegeix-lo. Si hi ha alguna cosa que t’hagi de fer parlar amb l’alumne o la família, aquest és el moment.</li>
            <li>Marca la casella <b>Canal</b> dels alumnes que no han de rebre l’informe per correu (per exemple, perquè l’hi vols lliurar en mà).</li>
            <li>Per lliurar-los en paper: <b>PDF dels que no tenen correu</b>, o selecciona alumnes i clica <b>PDF únic dels seleccionats</b>. Activa <b>Doble cara</b> si imprimeixes a dues cares.</li>
            <li>Amb <b>Prepara l’enviament</b> comproves qui rebrà cada informe, des de quin compte s’enviarà i amb quin assumpte. Res no s’envia fins a l’aprovació final.</li>
          </ol>

          <h3>5. Amb la família</h3>
          <p>L’informe «Així em veig» és la reflexió de l’alumne, no una nota. A l’entrevista, aquestes preguntes poden ajudar a començar la conversa:</p>
          <ul>
            <li>De quina matèria n’està més satisfet o satisfeta? Per què?</li>
            <li>Quin dels seus compromisos li sembla més important?</li>
            <li>Com el podem ajudar, des de casa i des de l’escola, a complir-lo?</li>
          </ul>
          <Tip>Si la família respon el correu, la resposta arriba a la tutoria, tret que l’administració hagi triat una altra adreça a <b>Centre › Correu</b>.</Tip>

          <h3>6. Et veig…: la teva autoavaluació</h3>
          <ol className="guide-steps">
            <li>Quan s’obre una recollida d’Et veig…, ves a <Where>Et veig… › La meva autoavaluació</Where>.</li>
            <li>Respon les mateixes afirmacions que l’alumnat, però en primera persona. Si fas classe a diverses etapes, en fas una per etapa. Pots afegir etiquetes de context per grup.</li>
            <li>Pots desar-la i continuar més tard. Quan la lliuris, ja no es podrà canviar. Es pot lliurar mentre la recollida és oberta o tancada.</li>
          </ol>
          <Tip>Mentrestant, l’alumnat et valora a l’aula. Ningú, tampoc l’Equip Directiu, no pot saber què ha respost cada alumne.</Tip>

          <h3>7. Et veig…: el teu informe</h3>
          <ol className="guide-steps">
            <li>Quan l’Equip Directiu el publica, apareix a <Where>Et veig… › Així et veiem</Where>. Amb el correu activat, també t’arriba un avís, sense l’informe adjunt.</li>
            <li>Comença pel <b>mirall</b>: compara com et veus amb com et veu l’alumnat. Després mira les fortaleses, el detall classe per classe i els comentaris.</li>
            <li>Al final hi ha l’espai <b>Per reflexionar</b>. El pots imprimir o desar en PDF.</li>
          </ol>
          <Warn>Si en una etapa hi ha menys de {THRESHOLD} respostes, l’informe diu «Mostra insuficient» i no en mostra res. És una protecció de l’alumnat.</Warn>

          <div className="guide-check">
            <b>Resum per a la tutoria</b>
            <label><input type="checkbox" /> Els meus grups i el meu alumnat hi són tots</label>
            <label><input type="checkbox" /> He reservat la sessió a l’aula mentre la recollida és oberta</label>
            <label><input type="checkbox" /> He recordat l’autoavaluació als que la tenien a mitges</label>
            <label><input type="checkbox" /> He llegit els informes abans de lliurar-los</label>
            <label><input type="checkbox" /> He imprès els informes dels alumnes sense correu familiar</label>
            <label><input type="checkbox" /> He fet la meva autoavaluació d’Et veig…</label>
          </div>
        </Sec>

        <Sec id="administracio">
          <p>El recorregut de l’administració durant el curs. Els apartats següents de la guia expliquen cada pantalla amb detall.</p>

          <h3>1. Setembre: preparar el curs (una vegada)</h3>
          <ol className="guide-steps">
            <li>Dona accés al personal i marca l’Equip Directiu. <Where>Centre › Alumnat i accessos</Where></li>
            <li>Revisa els grups de cada curs. <Where>Centre › Grups</Where></li>
            <li>Importa el cens de l’alumnat i marca les optatives. <Where>Centre › Alumnat i accessos › Cens</Where></li>
            <li>Importa els correus de les famílies. <Where>Centre › Famílies</Where></li>
            <li>Revisa les matèries de cada curs. <Where>Centre › Matèries</Where></li>
            <li>Indica qui fa classe a qui. <Where>Et veig… › Qui fa classe a qui</Where></li>
            <li>Comprova que hi ha qüestionaris publicats per a cada etapa. <Where>Em miro › Qüestionaris</Where> <Where>Et veig… › Preguntes</Where></li>
            <li>Indica des de quin compte s’envien els correus i revisa’n el text. <Where>Centre › Correu</Where></li>
          </ol>
          <Tip>L’apartat <b>Posada en marxa del curs</b> té aquests passos amb més detall i una llista de comprovació.</Tip>

          <h3>2. Cada avaluació: una recollida d’Em miro</h3>
          <ol className="guide-steps">
            <li><b>Crea-la</b> unes setmanes abans a <Where>Em miro › Recollides › Nova recollida</Where>, amb el nom («2a avaluació»), els cursos i les dates. Queda <i>Programada</i>.</li>
            <li><b>Avisa la tutoria</b> de les dates perquè reservi la sessió a l’aula.</li>
            <li><b>Obre-la</b> el primer dia amb <b>Obre a l’alumnat</b>. A partir d’aquí, l’alumnat la veu a la seva pantalla d’inici.</li>
            <li><b>Segueix la participació</b> al <Where>Tauler</Where>. Si cal més temps, <b>Canvia dates</b> indicant-ne el motiu.</li>
            <li><b>Tanca-la</b> l’últim dia. Si s’ha tancat massa d’hora, <b>Reobre</b> amb el motiu.</li>
            <li>Passa-la a <b>En revisió</b> perquè la tutoria llegeixi els informes, i després a <b>Informes generats</b> i <b>Validada</b>.</li>
            <li><b>Lliura els informes</b>: els de paper, amb el PDF d’<Where>Així em veig i famílies</Where>; els de correu, amb <b>Prepara l’enviament</b>, una prova al teu compte i l’aprovació final (quan el servidor estigui connectat).</li>
            <li>Marca-la com a <b>Distribuïda</b> i, al final del curs, <b>arxiva-la</b>.</li>
          </ol>

          <h3>3. Una o dues vegades l’any: una recollida d’Et veig…</h3>
          <ol className="guide-steps">
            <li>Comprova que <b>Qui fa classe a qui</b> és complet: en obrir la recollida, es congela.</li>
            <li><b>Crea-la</b> a <Where>Et veig… › Recollides i moderació</Where>, amb les etapes i les dates, i <b>obre-la</b>.</li>
            <li>Segueix-la amb el botó <b>Seguiment</b>: participació per grup i valoracions rebudes per docent. Recorda al professorat que faci la seva autoavaluació.</li>
            <li><b>Tanca-la</b> i passa-la a <b>Moderació</b>. L’Equip Directiu revisa els comentaris.</li>
            <li>L’Equip Directiu <b>genera els informes</b>, els revisa i els <b>publica</b> als docents. L’administració no en veu cap resultat.</li>
            <li>Al final del curs, <b>arxiva-la</b>: servirà de comparació per a la recollida següent.</li>
          </ol>

          <h3>4. Durant tot el curs</h3>
          <ul>
            <li><b>Altes i baixes</b>: torna a importar el cens o retoca’l a <Where>Centre › Alumnat i accessos</Where>.</li>
            <li><b>Incidències d’identitat</b>: quan un alumne d’ESO avisa que les seves dades no són correctes, surt un comptador al menú.</li>
            <li><b>Dubtes</b>: consulta <b>Problemes freqüents</b>. Cada acció queda al <Where>Centre › Registre</Where>.</li>
          </ul>
        </Sec>

        <Sec id="inici-curs">
          <p>Abans de la primera recollida del curs, segueix aquest ordre: cada pas depèn de l’anterior.</p>
          <ol className="guide-steps">
            <li><b>Dona accés al personal.</b> <Where>Centre › Alumnat i accessos › Professorat i administració</Where> Afegeix cada docent amb el seu rol i, si és tutor, els seus grups. Marca qui forma part de l’Equip Directiu.</li>
            <li><b>Configura els grups de cada curs.</b> <Where>Centre › Grups</Where> Per defecte, cada curs té un grup únic. Si un curs té més d’una línia, afegeix-hi els grups (A, B…).</li>
            <li><b>Importa el cens de l’alumnat.</b> <Where>Centre › Alumnat i accessos › Cens de l’alumnat</Where> Un CSV amb identificador, nom, cognoms, correu, curs i, si el curs té més d’un grup, el grup.</li>
            <li><b>Importa els correus de les famílies.</b> <Where>Centre › Famílies</Where> Un CSV amb l’alumne i el nom i el correu de cada responsable.</li>
            <li><b>Revisa les matèries de cada curs.</b> <Where>Centre › Matèries</Where> Ordre, optatives i matèries actives.</li>
            <li><b>Marca les optatives de cada alumne.</b> <Where>Centre › Alumnat i accessos › Cens</Where> A cada alumne només li apareixen les optatives que cursa.</li>
            <li><b>Indica qui fa classe a qui.</b> <Where>Et veig… › Qui fa classe a qui</Where> Una per una o amb el CSV de plantilla. Sense això, l’alumnat no sabrà quins docents ha de valorar.</li>
            <li><b>Revisa els qüestionaris.</b> <Where>Em miro › Qüestionaris</Where> i <Where>Et veig… › Preguntes</Where> Comprova que hi ha una versió publicada per a cada etapa.</li>
            <li><b>Comprova que els apartats estan actius.</b> <Where>Centre › Apartats</Where></li>
            <li><b>Decideix des d’on s’envien els correus.</b> <Where>Centre › Correu</Where> Compte remitent, on arriben les respostes i text dels missatges.</li>
          </ol>
          <div className="guide-check">
            <b>Llista de comprovació</b>
            <label><input type="checkbox" /> Tot el personal hi és, amb el rol i els grups correctes</label>
            <label><input type="checkbox" /> L’Equip Directiu està marcat</label>
            <label><input type="checkbox" /> Els grups de cada curs són els reals</label>
            <label><input type="checkbox" /> El cens és complet i sense incidències</label>
            <label><input type="checkbox" /> Els correus de les famílies estan importats i validats</label>
            <label><input type="checkbox" /> Les optatives estan marcades</label>
            <label><input type="checkbox" /> Cap avís de «Matèries sense docent» a Qui fa classe a qui</label>
            <label><input type="checkbox" /> Hi ha qüestionaris publicats per a CM, CS i ESO</label>
          </div>
        </Sec>

        <Sec id="centre">
          <h3>Professorat i administració</h3>
          <ul>
            <li><b>Dona accés</b>: correu de l’escola, nom, rol (Professorat o Administració) i, per al professorat, els grups que tutoritza o segueix a Em miro (com a mínim un).</li>
            <li><b>Equip Directiu</b>: interruptor a cada persona. Només el pot canviar un membre de l’Equip Directiu.</li>
            <li><b>Retira l’accés</b>: la persona ja no podrà entrar. No et pots treure el teu propi accés, i l’accés d’un membre de l’Equip Directiu només el pot retirar l’Equip Directiu.</li>
          </ul>
          <h3>Cens de l’alumnat</h3>
          <ol className="guide-steps">
            <li>Clica <b>Importa un CSV</b>. Pots triar un fitxer o enganxar-ne el contingut. El separador pot ser «;» o «,».</li>
            <li>Columnes, en qualsevol ordre: <b>identificador, nom, cognoms, correu, curs</b> i, opcionalment, <b>grup</b>. Si el curs té un grup únic, no cal posar-lo; si en té més d’un i la columna és buida, l’alumne va al primer grup. El curs s’accepta de moltes maneres: «3r ESO», «Tercer», «5è de primària»…</li>
            <li>Clica <b>Analitza</b>. L’app revisa cada fila i mostra quantes són correctes i quines tenen incidències: falta l’identificador o el nom, el correu no és de l’escola, el curs no es reconeix, hi ha duplicats o el correu ja és d’un altre alumne.</li>
            <li>Res no es desa fins que confirmes amb <b>Importa N alumnes</b>. Les files amb incidències no s’importen: corregeix-les al fitxer i torna-ho a provar.</li>
          </ol>
          <p>Si un curs té més d’un grup, la taula del cens mostra un desplegable per canviar un alumne de grup.</p>
          <h3>Grups</h3>
          <p><Where>Centre › Grups</Where> Només per a l’administració. Cada curs comença amb un <b>grup únic</b>: a tot arreu s’hi mostra només el nom del curs («2n ESO»), sense lletra.</p>
          <ul>
            <li><b>Afegeix un grup</b> quan s’obri una segona línia. Des d’aquell moment, els grups del curs es mostren amb el seu nom («2n ESO A», «2n ESO B»).</li>
            <li><b>Canvia el nom</b> d’un grup (fins a 12 caràcters, sense «-», «;» ni «,»): s’actualitza a l’alumnat, a les assignacions i als grups de la tutoria.</li>
            <li><b>Elimina</b> un grup només si no hi queda cap alumne i no és l’únic del curs.</li>
          </ul>
          <Tip>Un programa diferent de l’ESO, com un PFI, no és un grup més: necessitaria un curs propi amb el seu qüestionari. Demana-ho abans d’incorporar-lo.</Tip>
          <h3>Famílies</h3>
          <p><Where>Centre › Famílies</Where> Per a l’administració i l’Equip Directiu. Guarda el correu dels responsables de cada alumne, que és on s’enviarà l’informe «Així em veig».</p>
          <ol className="guide-steps">
            <li>Clica <b>Importa des de CSV</b>. Una fila per responsable amb les columnes <b>id_alumne</b> (o <b>correu_alumne</b>), <b>nom_responsable</b> i <b>correu_responsable</b>. Un alumne pot tenir diverses files.</li>
            <li>Clica <b>Analitza</b>. L’app detecta alumnes que no són al cens, correus mal escrits, correus repetits i el correu del mateix alumne en lloc del de la família.</li>
            <li>Confirma amb <b>Importa N correus</b>. Per a cada alumne del fitxer, els correus nous <b>substitueixen</b> els anteriors i queden validats. Els alumnes que no surten al fitxer no canvien.</li>
            <li>A la taula pots filtrar per curs, marcar un correu com a <b>Validat</b> o <b>Pendent</b> i treure’l.</li>
          </ol>
          <Tip>Només s’envia als correus validats. Els comptadors de dalt indiquen quants alumnes tenen correu validat, quants el tenen pendent i quants no en tenen (el seu informe es lliurarà en paper).</Tip>
          <h3>Incidències d’identitat</h3>
          <p>Si un alumne d’ESO clica «Les meves dades no són correctes» (a primària no surt), el seu missatge apareix a la pestanya <b>Incidències d’identitat</b>, amb un comptador al menú. Revisa-ho i corregeix el cens.</p>
          <h3>Matèries</h3>
          <ul>
            <li>Per a cada curs: ordre de presentació (fletxes), <b>Comuna / Optativa</b> i <b>Activa</b>.</li>
            <li>Els canvis s’apliquen a les recollides noves. Les ja creades conserven la llista de matèries que tenien.</li>
          </ul>
          <h3>Apartats</h3>
          <p>Activa o desactiva temporalment Em miro o Et veig… Desactivar-lo l’amaga a l’alumnat sense esborrar cap dada; és útil, per exemple, si cal aturar una recollida per un problema.</p>
          <h3>Correu</h3>
          <p><Where>Centre › Correu</Where> Només per a l’administració. Hi ha tres decisions:</p>
          <ul>
            <li><b>Compte que envia.</b> Un compte de l’escola (@ramonpont.cat). És millor un compte dedicat a l’app que el d’una persona: no depèn de qui ocupa el càrrec i tots els enviaments queden junts.</li>
            <li><b>On arriben les respostes.</b> Per defecte, al tutor o tutora del grup, que és qui coneix l’alumne. També es pot posar una adreça fixa, com la de secretaria.</li>
            <li><b>Text dels missatges.</b> Un per a les famílies, amb l’informe «Així em veig» adjunt, i un per al professorat, que només avisa que l’informe «Així et veiem» és disponible (no s’adjunta perquè és confidencial). Els marcadors entre claus, com {'{alumne}'}, es canvien per les dades de cada destinatari. A la dreta es veu com quedarà.</li>
          </ul>
          <Tip>Si es toca el text i no convenç, <b>Recupera el text original</b> el torna a deixar com era.</Tip>
          <h3>Registre d’operacions</h3>
          <p>Hi consten les accions rellevants amb data, persona i detall: permisos, canvis de configuració, canvis d’estat, impressions d’informes, consultes d’informes d’altres docents i incidències. No es pot modificar.</p>
        </Sec>

        <Sec id="em-miro">
          <h3>1. Crear les recollides</h3>
          <p><Where>Em miro › Recollides › Nova recollida</Where> Posa-hi un nom (per exemple, «2a avaluació»), tria els cursos (hi ha dreceres per a tots, primària o ESO) i les dates d’inici i de tancament. Es crea una recollida per curs.</p>
          <Tip>Cada recollida fixa el qüestionari i les matèries en el moment de crear-la: es fa servir la darrera versió publicada del qüestionari de l’etapa i les matèries actives del curs. Els canvis posteriors no l’afecten.</Tip>
          <h3>2. Cicle d’una recollida</h3>
          <div className="table-wrap">
            <table className="t guide-t">
              <thead><tr><th>Estat</th><th>Què vol dir</th><th>Botó per avançar</th></tr></thead>
              <tbody>
                <tr><td><span className="badge info">Programada</span></td><td>Creada, encara no visible per a l’alumnat</td><td>Obre a l’alumnat</td></tr>
                <tr><td><span className="badge ok">Oberta</span></td><td>L’alumnat respon. Es desa sol i es pot modificar fins al tancament</td><td>Tanca</td></tr>
                <tr><td><span className="badge warn">Tancada</span></td><td>Ja no es pot respondre. Les respostes a mitges es conserven però no compten com a lliurades</td><td>Passa a revisió · o <b>Reobre</b> (cal indicar el motiu)</td></tr>
                <tr><td><span className="badge warn">En revisió</span></td><td>La tutoria revisa les respostes</td><td>Marca informes generats</td></tr>
                <tr><td><span className="badge brand">Informes generats</span></td><td>Els informes «Així em veig» estan a punt</td><td>Valida</td></tr>
                <tr><td><span className="badge brand">Validada</span></td><td>Els informes s’han revisat i es poden lliurar</td><td>Marca com a distribuïda</td></tr>
                <tr><td><span className="badge ok">Distribuïda</span></td><td>Els informes s’han lliurat a les famílies</td><td>Arxiva</td></tr>
                <tr><td><span className="badge">Arxivada</span></td><td>Tancada definitivament; només de consulta</td><td>—</td></tr>
              </tbody>
            </table>
          </div>
          <ul>
            <li><b>Canvia dates</b> (recollides programades o obertes): cal indicar el motiu, que queda registrat.</li>
            <li>No es poden distribuir els informes d’una recollida que encara és oberta.</li>
            <li>Cada canvi d’estat demana confirmació i queda al registre.</li>
          </ul>
          <h3>3. Seguiment</h3>
          <ul>
            <li><b>Tauler</b>: participació global, recollides obertes, alumnes a mitges, sense començar i sense correu familiar validat, i participació per grup.</li>
            <li><b>Respostes</b>: estat de cada alumne (<i>No iniciada, En curs, Lliurada, Validada, Incidència</i>), progrés i última activitat. Pots cercar un alumne i veure’n les respostes.</li>
          </ul>
          <h3>4. Què veu l’alumnat</h3>
          <p>Tres experiències segons l’edat: 3r i 4t (una pregunta per pantalla, cares i lectura en veu alta), 5è i 6è (blocs curts i l’objectiu de l’avaluació anterior) i ESO (blocs de 4-5 afirmacions i una pantalla per matèria). Té opcions de lletra gran i de lectura fàcil, i la sessió es tanca sola després de 20 minuts d’inactivitat.</p>
        </Sec>

        <Sec id="informes-em">
          <p><Where>Em miro › Així em veig i famílies</Where> Tria la recollida i tindràs la llista de l’alumnat amb l’estat de la resposta, l’informe i el correu familiar, que prové de <b>Centre › Famílies</b>.</p>
          <ol className="guide-steps">
            <li><b>Previsualitza</b> l’informe de cada alumne amb <b>Veure</b>.</li>
            <li><b>Selecciona les lliurades</b> per triar de cop tots els alumnes que han acabat.</li>
            <li><b>PDF únic dels seleccionats</b> genera un sol document per imprimir. Amb <b>Doble cara</b>, cada informe comença en una cara nova.</li>
            <li><b>PDF dels que no tenen correu</b> prepara directament els informes que s’han de lliurar en paper.</li>
            <li>La casella <b>Canal</b> marca un alumne com a «no enviar per correu»: el seu informe es lliurarà en paper.</li>
            <li><b>Prepara l’enviament</b> (només amb la recollida tancada) mostra exactament qui rebrà cada informe abans d’enviar res.</li>
          </ol>
          <Warn>L’enviament per correu necessita el servidor de l’escola. Quan estigui connectat, hi haurà «Envia’m una prova» i «Aprova i envia», sense duplicats i amb registre de cada enviament. Fins aleshores, els informes es lliuren en PDF o en paper.</Warn>
          <Tip>Cada impressió d’informes queda al registre d’operacions.</Tip>
        </Sec>

        <Sec id="et-veig">
          <h3>Abans d’obrir</h3>
          <ul>
            <li>Les assignacions de <b>Qui fa classe a qui</b> han de ser completes: determinen quins docents valora cada alumne. Si un docent fa diverses matèries a un mateix alumne, només el valora una vegada.</li>
            <li>Hi ha d’haver unes <b>Preguntes</b> publicades per a cada etapa de la recollida.</li>
          </ul>
          <h3>1. Crear la recollida</h3>
          <p><Where>Et veig… › Recollides i moderació › Nova recollida</Where> Nom (per exemple, «Recollida de maig»), etapes (cicle mitjà, cicle superior, ESO) i dates. Es crea ja programada. Les recollides d’Et veig… són independents de les avaluacions d’Em miro.</p>
          <h3>2. Cicle d’una recollida</h3>
          <div className="table-wrap">
            <table className="t guide-t">
              <thead><tr><th>Estat</th><th>Què passa</th><th>Qui hi actua</th></tr></thead>
              <tbody>
                <tr><td><span className="badge info">Programada</span></td><td>Preparada, no visible per a l’alumnat. Botó <b>Obre-la ara</b></td><td>Administració o Equip Directiu</td></tr>
                <tr><td><span className="badge ok">Oberta</span></td><td><b>Les assignacions es congelen</b>: els canvis posteriors no alteren qui valora qui. L’alumnat valora; el professorat fa la seva autoavaluació. Només hi pot haver una recollida oberta per etapa. Botó <b>Tanca la recollida</b></td><td>Alumnat i professorat</td></tr>
                <tr><td><span className="badge warn">Tancada</span></td><td>Es desen els recomptes de participació per grup i es barreja l’ordre de les respostes i dels comentaris. El professorat encara pot lliurar l’autoavaluació. Es pot <b>Reobrir</b>. Botó <b>Passa a moderació</b></td><td>Administració o Equip Directiu</td></tr>
                <tr><td><span className="badge warn">Moderació</span></td><td>L’Equip Directiu revisa cada comentari. Botó <b>Genera els informes</b> (només sense comentaris pendents)</td><td>Equip Directiu</td></tr>
                <tr><td><span className="badge brand">Informes generats</span></td><td>L’Equip Directiu ja veu els informes i la visió de centre; els docents encara no. Botó <b>Publica als docents</b></td><td>Equip Directiu</td></tr>
                <tr><td><span className="badge ok">Publicada</span></td><td>Cada docent veu el seu informe. <b>S’esborra la llista de qui ha participat</b>: només en queden els recomptes per grup. Botó <b>Arxiva</b></td><td>Professorat</td></tr>
                <tr><td><span className="badge">Arxivada</span></td><td>Només de consulta; serveix de comparació per a la recollida següent</td><td>—</td></tr>
              </tbody>
            </table>
          </div>
          <h3>3. Seguiment mentre és oberta</h3>
          <p>El botó <b>Seguiment</b> de cada recollida té tres pestanyes:</p>
          <ul>
            <li><b>Participació per grup</b>: quants alumnes han valorat tots els seus docents, quants van a mitges i quants no han començat. Es compta qui ha lliurat, mai què ha respost.</li>
            <li><b>Per docent</b>: valoracions rebudes sobre les possibles, si s’ha arribat al llindar de {THRESHOLD} i si ha fet l’autoavaluació.</li>
            <li><b>Moderació</b>: vegeu l’apartat següent.</li>
          </ul>
          <h3>Seguiment del professorat (Equip Directiu)</h3>
          <p><Where>Et veig… › Professorat</Where> Tria la recollida i veuràs, per a cada docent, les valoracions rebudes sobre les possibles, si arriba al llindar i si ha fet l’autoavaluació. A dalt surt la llista de qui la té <b>pendent</b>, amb un botó per copiar-ne les adreces i enviar-los un recordatori. La casella <b>Només autoavaluació pendent</b> filtra la taula.</p>
          <Tip>Si un docent no arriba a {THRESHOLD} respostes en una etapa, el seu informe d’aquella etapa dirà «Mostra insuficient» i no mostrarà ni resultats ni comentaris. És una protecció de l’alumnat, no un error: anima els grups a participar abans de tancar.</Tip>
          <h3>4. Autoavaluació docent</h3>
          <p>Cada docent respon les mateixes afirmacions en primera persona, una vegada per etapa on fa classe, i pot marcar etiquetes de context per grup. Pot desar-la com a esborrany i lliurar-la mentre la recollida és oberta o tancada; un cop lliurada no es pot canviar. L’informe la contrasta amb la mirada de l’alumnat.</p>
        </Sec>

        <Sec id="moderacio">
          <p>Les preguntes obertes són opcionals, i cap comentari no arriba al docent sense passar per l’Equip Directiu.</p>
          <ol className="guide-steps">
            <li>Passa la recollida a <b>Moderació</b> i obre <b>Seguiment i moderació</b>.</li>
            <li>Primer surten els comentaris <b>marcats automàticament</b>: possible insult, nom propi d’un alumne o d’un docent, dades de contacte o frases que poden identificar qui ho escriu.</li>
            <li>Per a cada comentari: <b>Accepta</b> (arriba tal com és), <b>Edita</b> (arriba només el text editat, mai l’original) o <b>Descarta</b> (no arriba).</li>
            <li><b>Accepta els N sense marques</b> accepta de cop tots els pendents sense cap marca. Revisa’n abans una mostra.</li>
            <li>Quan no en quedi cap de pendent, ja pots clicar <b>Genera els informes</b>.</li>
          </ol>
          <div className="guide-cards two">
            <div className="guide-card ok"><b>Accepta o edita</b><p>Crítiques concretes i respectuoses, encara que siguin dures: «Vas massa ràpid explicant».</p></div>
            <div className="guide-card bad"><b>Edita o descarta</b><p>Insults, burles, noms d’alumnes, dades personals o qualsevol detall que permeti saber qui ho ha escrit.</p></div>
          </div>
          <Tip>A l’informe, els comentaris repetits surten una sola vegada amb el nombre de persones que els han escrit, per exemple «Els projectes en grup. (5 persones)».</Tip>
        </Sec>

        <Sec id="resultats">
          <h3>Així et veiem (informe de cada docent)</h3>
          <ul>
            <li><b>Com et veu l’alumnat</b>: per a cada bloc, la distribució de respostes i el percentatge favorable («Sovint» o «Sempre»; a cicle mitjà, «Sí!»).</li>
            <li><b>El mirall</b>: compara la mitjana de l’alumnat amb l’autoavaluació del docent i en treu quatre quadrants: <i>fortaleses confirmades</i>, <i>punts cecs</i> (el docent es valora més alt), <i>fortaleses ocultes</i> (l’alumnat el valora més alt) i <i>reptes reconeguts</i>.</li>
            <li><b>Detall per afirmació</b>: el percentatge favorable de cadascuna.</li>
            <li><b>Classe per classe</b>: respostes i percentatge favorable de cada bloc a cada grup, amb el total del docent i una fletxa quan un grup se separa 10 punts o més. Si hi ha dos grups o més amb prou respostes, també el <b>detall de cada afirmació per classe</b>. Els grups amb menys de {THRESHOLD} respostes no es mostren.</li>
            <li><b>Evolució</b> respecte de la recollida anterior.</li>
            <li><b>Comentaris moderats</b> i un espai final <b>Per reflexionar</b>.</li>
          </ul>
          <h3>Qui ho veu i quan</h3>
          <ul>
            <li><b>Equip Directiu</b>: tots els informes a partir de «Informes generats». <Where>Et veig… › Professorat</Where> té el botó <b>Informe</b> de cada docent (per llegir-lo, imprimir-lo o desar-lo en PDF i parlar-ne amb ell) i <b>Tots els informes en PDF</b>, que en genera un sol document. També es poden obrir des de la visió de centre i des d’Així et veiem. Cada consulta o descàrrega de l’informe d’un altre docent queda registrada.</li>
            <li><b>Cada docent</b>: només el seu, a partir de «Publicada».</li>
            <li><b>Administració</b>: cap resultat, si no forma part de l’Equip Directiu.</li>
          </ul>
          <h3>Visió de centre</h3>
          <p>Només per a l’Equip Directiu. Mostra la participació per etapa, les autoavaluacions fetes, les fortaleses i els reptes de cada etapa i una taula de docents ordenada alfabèticament, amb el percentatge favorable per bloc. <b>No hi ha rànquings ni notes úniques.</b> La variació respecte de la recollida anterior es mostra en punts. Es pot imprimir o desar en PDF.</p>
          <Warn>Els resultats són un retorn per reflexionar i millorar, no una avaluació del docent. Comparteix-los amb aquest sentit.</Warn>
        </Sec>

        <Sec id="questionaris">
          <h3>Versions: la regla d’or</h3>
          <p>Una versió publicada <b>no canvia mai</b>. Per modificar un qüestionari, crea’n una versió nova, edita-la i publica-la. Les recollides ja creades conserven la seva versió; les noves fan servir la darrera publicada.</p>
          <p>El botó «Escolta» llegeix les preguntes originals amb una veu catalana gravada. Una pregunta editada o nova es llegeix amb la veu del navegador fins que qui manté l’app en regeneri els àudios.</p>
          <h3>Em miro › Qüestionaris</h3>
          <ol className="guide-steps">
            <li>Tria l’etapa i clica <b>Crea la versió N</b>.</li>
            <li>Edita els apartats (títol, emoji, instrucció) i les preguntes: afirmació amb escala, resposta curta o llarga, valoració per matèria, objectiu anterior o text informatiu. Pots moure-les, duplicar-les o treure-les.</li>
            <li>Comprova-ho amb <b>Com ho veurà l’alumne</b> i amb la <b>Prova de l’informe</b> (respostes curtes o llargues) per veure que res no es talla.</li>
            <li>Resol els avisos que surtin i clica <b>Publica</b>, amb un resum dels canvis (queda registrat). Si t’hi repenses, <b>Descarta l’esborrany</b>.</li>
          </ol>
          <h3>Et veig… › Preguntes</h3>
          <ul>
            <li>Un qüestionari per etapa, agrupat en blocs. Cada afirmació té una versió per a l’alumnat i una en primera persona per a l’autoavaluació del docent.</li>
            <li>Les preguntes obertes són sempre opcionals i moderades; en pots fixar el màxim de caràcters.</li>
            <li>A ESO hi ha d’haver com a mínim 15 afirmacions. Tota afirmació ha de tenir les dues versions.</li>
            <li>Escriu afirmacions observables i que preguntin una sola cosa: «Retorna corregits els treballs en poc temps» i no «Corregeix ràpid i explica bé».</li>
          </ul>
        </Sec>

        <Sec id="confidencialitat">
          <div className="table-wrap">
            <table className="t guide-t">
              <thead><tr><th>Garantia</th><th>Com s’aplica</th></tr></thead>
              <tbody>
                <tr><td>Només comptes de l’escola</td><td>Només s’accepten comptes @ramonpont.cat verificats, i cal constar al cens o tenir un permís</td></tr>
                <tr><td>Llindar de {THRESHOLD}</td><td>Cap resultat ni comentari d’una etapa o d’un grup amb menys de {THRESHOLD} respostes</td></tr>
                <tr><td>Respostes anònimes</td><td>Les valoracions es desen sense cap identificador d’alumne; només es guarda a part qui ha participat</td></tr>
                <tr><td>Ordre barrejat</td><td>En tancar, les respostes i els comentaris es tornen a escriure en ordre aleatori</td></tr>
                <tr><td>Participació esborrada</td><td>En publicar, s’esborra la llista de qui ha participat; només en queden els recomptes</td></tr>
                <tr><td>Esborranys xifrats</td><td>Les valoracions a mitges es desen xifrades i s’esborren en lliurar-les</td></tr>
                <tr><td>Comentaris moderats</td><td>Cap comentari arriba al docent sense revisió de l’Equip Directiu</td></tr>
                <tr><td>Traçabilitat</td><td>El registre d’operacions recull els canvis de permisos i de configuració i les consultes d’informes</td></tr>
                <tr><td>Sessions</td><td>La sessió de l’alumnat es tanca sola després de 20 minuts d’inactivitat</td></tr>
              </tbody>
            </table>
          </div>
          <Tip>Si algú demana veure les respostes d’un alumne concret a «Et veig…», la resposta és que l’app no ho permet: no hi ha cap pantalla ni cap dada que ho relacioni.</Tip>
        </Sec>

        <Sec id="calendari">
          <p>Una proposta orientativa; adapta-la al calendari de l’escola.</p>
          <div className="table-wrap">
            <table className="t guide-t">
              <thead><tr><th>Quan</th><th>Què</th><th>Qui</th></tr></thead>
              <tbody>
                <tr><td>Setembre</td><td>Accessos, cens, matèries, optatives i assignacions docents</td><td>Administració</td></tr>
                <tr><td>Abans de cada avaluació</td><td>Crear i obrir la recollida d’Em miro (unes dues setmanes)</td><td>Administració</td></tr>
                <tr><td>Durant la recollida</td><td>Seguiment de la participació i recordatoris a l’aula</td><td>Tutoria</td></tr>
                <tr><td>Després de tancar</td><td>Revisió, informes «Així em veig» i lliurament a les famílies</td><td>Tutoria i administració</td></tr>
                <tr><td>Tardor i maig</td><td>Recollida d’Et veig… (unes dues o tres setmanes)</td><td>Administració o Equip Directiu</td></tr>
                <tr><td>Una setmana després de tancar Et veig…</td><td>Moderació, generació i publicació dels informes</td><td>Equip Directiu</td></tr>
              </tbody>
            </table>
          </div>
        </Sec>

        <Sec id="problemes">
          <dl className="guide-faq">
            <dt>Un alumne diu que no pot entrar.</dt>
            <dd>Comprova que entra amb el compte @ramonpont.cat i que consta al cens. Si veu «Encara no tens accés», no és al cens: afegeix-lo.</dd>
            <dt>Com a tutor, no veig un dels meus grups.</dt>
            <dd>L’administració ha d’afegir-te el grup a <b>Centre › Alumnat i accessos › Professorat i administració</b>.</dd>
            <dt>Un alumne ha lliurat massa ràpid o vol canviar una resposta.</dt>
            <dd>Mentre la recollida és oberta, pot tornar a entrar i clicar <b>Revisa les respostes</b>. Un cop tancada, ja no es pot canviar.</dd>
            <dt>Un alumne no troba la seva autoavaluació.</dt>
            <dd>La recollida del seu curs ha d’estar <b>Oberta</b> i l’apartat Em miro, actiu.</dd>
            <dt>A un alumne no li surt un docent a Et veig…, o li en surt un que no toca.</dt>
            <dd>Revisa Qui fa classe a qui i les optatives de l’alumne. Recorda que les assignacions es congelen en obrir: els canvis s’apliquen a la recollida següent.</dd>
            <dt>No puc obrir una recollida d’Et veig…</dt>
            <dd>Ja n’hi ha una altra d’oberta per a alguna de les mateixes etapes. Tanca-la primer.</dd>
            <dt>No puc generar els informes d’Et veig…</dt>
            <dd>Encara hi ha comentaris pendents de moderar.</dd>
            <dt>L’informe d’un docent diu «Mostra insuficient».</dt>
            <dd>Té menys de {THRESHOLD} respostes en aquella etapa. És intencionat i no es pot saltar.</dd>
            <dt>Com a administració no veig cap resultat d’Et veig…</dt>
            <dd>És el comportament previst: els resultats només els veu l’Equip Directiu i cada docent el seu.</dd>
            <dt>He d’esmenar un qüestionari amb una recollida oberta.</dt>
            <dd>La recollida oberta conserva la seva versió. Crea’n una de nova per a les recollides següents.</dd>
            <dt>He tancat una recollida per error.</dt>
            <dd>Fes servir <b>Reobre</b>. A Em miro cal indicar el motiu, que queda registrat.</dd>
            <dt>Una família no rep l’informe per correu.</dt>
            <dd>A <b>Centre › Famílies</b>, comprova que el correu és correcte i està <b>Validat</b>, i que a Així em veig i famílies el canal no és «no enviar per correu».</dd>
            <dt>S’obre una segona línia en un curs.</dt>
            <dd>Afegeix el grup a <b>Centre › Grups</b>, torna a importar el cens amb la columna de grup (o canvia els alumnes de grup a la taula del cens) i revisa Qui fa classe a qui.</dd>
            <dt>Vull tornar a les dades inicials de la demostració.</dt>
            <dd>Al botó «Prova la demostració» de la pantalla d’entrada, clica <b>Restaura les dades fictícies inicials</b>.</dd>
          </dl>
        </Sec>

        <Sec id="glossari">
          <dl className="guide-gloss">
            <dt>Recollida</dt><dd>Període en què l’alumnat respon. A Em miro n’hi ha una per curs i avaluació; a Et veig…, una per a diverses etapes.</dd>
            <dt>Etapa</dt><dd>Cicle mitjà (3r-4t), cicle superior (5è-6è) o ESO.</dd>
            <dt>Bloc o dimensió</dt><dd>Grup d’afirmacions d’Et veig… sobre un mateix aspecte (per exemple, «Explicacions i domini»).</dd>
            <dt>Favorable</dt><dd>Percentatge de respostes «Sovint» o «Sempre» (a cicle mitjà, «Sí!»).</dd>
            <dt>Llindar</dt><dd>Mínim de {THRESHOLD} respostes per mostrar resultats.</dd>
            <dt>Moderació</dt><dd>Revisió dels comentaris per part de l’Equip Directiu abans que arribin al docent.</dd>
            <dt>Versió</dt><dd>Estat fix d’un qüestionari. Un cop publicada no canvia.</dd>
            <dt>Grup</dt><dd>Classe d’un curs. Amb un grup únic, es mostra només el nom del curs.</dd>
            <dt>Responsable</dt><dd>Familiar o tutor legal que rep l’informe «Així em veig» per correu.</dd>
            <dt>Assignació</dt><dd>Quin docent fa cada matèria a cada grup.</dd>
            <dt>Registre</dt><dd>Llista inalterable de les operacions rellevants.</dd>
          </dl>
        </Sec>
        <p className="guide-end muted">La teva veu · Escola Ramon Pont · Guia del personal</p>
      </article>
    </div>
  )
}
