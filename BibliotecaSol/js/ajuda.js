(function () {
  const SECTIONS = [
    {
      id: "inici",
      title: "Primer cop d'ull",
      icon: "☀️",
      html: `
        <p class="help-lead">La Biblioteca de la Sol té dues cares: el <strong>catàleg</strong>, que pot consultar tothom, i la <strong>gestió</strong>, reservada al compte <strong>biblioteca@ramonpont.cat</strong>. Aquesta ajuda explica tot el que pots fer com a gestor.</p>
        <h4>Les dues pantalles del gestor</h4>
        <div class="help-cards">
          <div class="help-card"><strong>Catàleg</strong><span>Consulta, cerca, filtres i descàrrega en PDF de la llista de llibres.</span></div>
          <div class="help-card"><strong>Gestió</strong><span>Alta i edició de llibres, sol·licituds, préstecs, retards i historial.</span></div>
        </div>
        <h4>El resum de la part superior de Gestió</h4>
        <p>En entrar a Gestió veuràs quatre comptadors que t'indiquen d'un cop d'ull si hi ha feina pendent:</p>
        <div class="help-mock" aria-hidden="true">
          <section class="manager-summary">
            <div><strong>2</strong><span>Sol·licituds pendents</span></div>
            <div><strong>5</strong><span>Préstecs actius</span></div>
            <div><strong>1</strong><span>Retards</span></div>
            <div><strong>118</strong><span>Exemplars disponibles</span></div>
          </section>
        </div>
        <ul class="help-list">
          <li><strong>Sol·licituds pendents:</strong> llibres que algú ha demanat i que encara no has prestat ni rebutjat.</li>
          <li><strong>Préstecs actius:</strong> llibres que ara mateix són fora de la biblioteca.</li>
          <li><strong>Retards:</strong> préstecs que ja han passat la data de retorn.</li>
          <li><strong>Exemplars disponibles:</strong> còpies que hi ha a la biblioteca per deixar.</li>
        </ul>
        <h4>Les pestanyes</h4>
        <div class="help-mock" aria-hidden="true">
          <nav class="manager-tabs">
            <span class="manager-tab" aria-selected="true">Catàleg</span>
            <span class="manager-tab" aria-selected="false">Sol·licituds</span>
            <span class="manager-tab" aria-selected="false">Préstecs</span>
            <span class="manager-tab" aria-selected="false">Retards</span>
            <span class="manager-tab" aria-selected="false">Historial</span>
          </nav>
        </div>
        <p>Cada pestanya té el seu apartat en aquesta ajuda. Si obres l'ajuda des d'una pestanya concreta, s'obre directament a l'apartat corresponent.</p>
      `
    },
    {
      id: "alta",
      title: "Afegir un llibre",
      icon: "➕",
      html: `
        <p class="help-lead">El formulari <strong>Introduir nous llibres</strong> és a la pestanya <strong>Catàleg</strong> de Gestió. La manera més ràpida de fer-ho és començar per l'ISBN.</p>
        <ol class="help-steps">
          <li>
            <strong>Escriu, enganxa o escaneja l'ISBN.</strong>
            <span>És el número de 10 o 13 xifres que hi ha a la contraportada, sobre el codi de barres. Si tens un lector de codis de barres USB, només cal passar-lo pel llibre amb el cursor dins la casella.</span>
            <div class="help-mock" aria-hidden="true">
              <div class="isbn-lookup">
                <label>ISBN</label>
                <div class="isbn-row">
                  <input type="text" value="9788448924898" tabindex="-1" readonly>
                  <span class="button icon-search">Cercar dades</span>
                </div>
                <p class="isbn-status success">Trobat a Open Library i Google Books. S'ha omplert: títol, autor, editorial, pàgines, any, resum. Revisa-ho abans de desar.</p>
              </div>
            </div>
          </li>
          <li>
            <strong>Espera un segon o prem «Cercar dades».</strong>
            <span>L'app busca el llibre a Open Library i a Google Books i omple els camps que estiguin buits. Els camps omplerts s'il·luminen un moment en groc. Mai no esborra res que ja hagis escrit.</span>
          </li>
          <li>
            <strong>Revisa les dades.</strong>
            <span>Les bases de dades externes de vegades escriuen el títol amb Majúscules A Cada Paraula, posen la col·lecció dins del títol o hi afegeixen un resum en castellà. Corregeix el que calgui.</span>
          </li>
          <li>
            <strong>Tria l'edat, el gènere i la temàtica</strong> amb un clic (vegeu l'apartat <a href="#" data-help-go="classificar">Edat, gènere i temàtica</a>).
          </li>
          <li>
            <strong>Indica la ubicació i els exemplars.</strong>
            <span>La ubicació et suggereix les que ja existeixen (prestatgeries, zones...). <em>Exemplars totals</em> és el nombre de còpies que té la biblioteca; <em>Exemplars disponibles</em>, les que hi ha ara mateix a la prestatgeria.</span>
          </li>
          <li>
            <strong>Prem «Desar llibre».</strong>
            <span>Si tot va bé, veuràs «Llibre afegit a Supabase» i el formulari queda net per al següent llibre.</span>
            <div class="help-mock" aria-hidden="true">
              <div class="form-actions">
                <span class="button button-save icon-save">Desar llibre</span>
                <span class="button button-secondary button-warning icon-clear">Nou llibre</span>
              </div>
            </div>
          </li>
        </ol>
        <h4>Què va a cada camp</h4>
        <div class="help-table-wrap">
          <table class="help-table">
            <thead><tr><th>Camp</th><th>Què hi has de posar</th><th>Exemple</th></tr></thead>
            <tbody>
              <tr><td>Títol <em>(obligatori)</em></td><td>El títol tal com surt a la portada, sense la col·lecció.</td><td>La relativitat d'anomenar-se Albert</td></tr>
              <tr><td>Autor <em>(obligatori)</em></td><td>Nom i cognoms. Si n'hi ha més d'un, separats per comes.</td><td>Andreu Martín, Jaume Ribera</td></tr>
              <tr><td>Editorial</td><td>Només el nom, sense «S.A.» ni «Editorial».</td><td>Barcanova</td></tr>
              <tr><td>Col·lecció</td><td>Nom de la col·lecció. L'app et suggereix les que ja has fet servir.</td><td>El Vaixell de Vapor</td></tr>
              <tr><td>Número de col·lecció</td><td>El número del llibre dins la col·lecció. Admet lletres.</td><td>12</td></tr>
              <tr><td>Nombre de pàgines</td><td>El número de l'última pàgina numerada.</td><td>96</td></tr>
              <tr><td>Any de publicació</td><td>L'any de l'edició que teniu.</td><td>2009</td></tr>
              <tr><td>Llengua</td><td>Per defecte, Català. Google Books la canvia si el llibre és en una altra llengua.</td><td>Castellà</td></tr>
              <tr><td>Ubicació</td><td>On és físicament el llibre.</td><td>Prestatgeria B1</td></tr>
              <tr><td>Exemplars totals / disponibles</td><td>Còpies que té la biblioteca / que hi ha ara.</td><td>3 / 2</td></tr>
              <tr><td>Resum breu</td><td>Dues o tres frases que ajudin a triar el llibre.</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
        <div class="help-tip"><strong>Si el llibre ja hi és.</strong> Quan escrius un ISBN que ja és al catàleg, l'app t'avisa («Aquest llibre ja és al catàleg») i et proposa <em>Obrir la fitxa</em>. Si heu comprat una altra còpia, obre-la i augmenta els exemplars en lloc de crear un llibre nou.</div>
        <div class="help-tip"><strong>Si no el troba.</strong> Aproximadament 7 de cada 10 llibres es troben. Si no, l'app ho diu i només cal omplir la fitxa a mà.</div>
      `
    },
    {
      id: "classificar",
      title: "Edat, gènere i temàtica",
      icon: "🏷️",
      html: `
        <p class="help-lead">Aquests tres camps es trien amb botons perquè tots els llibres quedin classificats igual i els filtres del catàleg funcionin bé.</p>
        <div class="help-mock" aria-hidden="true">
          <div class="chip-fields">
            <div class="chip-field">
              <span class="chip-label">Edat</span>
              <div class="chip-group">
                <span class="chip">3-5 anys</span><span class="chip">6-8 anys</span><span class="chip" aria-pressed="true">9-11 anys</span><span class="chip">12-14 anys</span><span class="chip">14-16 anys</span><span class="chip">Mestres</span><span class="chip chip-new">+ Altre</span>
              </div>
            </div>
            <div class="chip-field">
              <span class="chip-label">Gènere</span>
              <div class="chip-group">
                <span class="chip">Còmic</span><span class="chip" aria-pressed="true">Conte</span><span class="chip">Narrativa</span><span class="chip">Novel·la curta</span><span class="chip">Poesia</span><span class="chip chip-new">+ Altre</span>
              </div>
            </div>
          </div>
        </div>
        <ul class="help-list">
          <li><strong>Per triar</strong>, fes clic al botó: queda de color fosc.</li>
          <li><strong>Per desfer-ho</strong>, torna a fer-hi clic.</li>
          <li>Cada camp admet <strong>un sol valor</strong>. Si un llibre encaixa en dues edats, tria la principal.</li>
          <li><strong>Per afegir-hi un valor nou</strong>, prem <em>+ Altre</em>, escriu-lo i prem <em>Afegir</em> o Enter. Quan desis el llibre, el valor nou quedarà disponible per a tothom i sortirà als filtres del catàleg.</li>
        </ul>
        <div class="help-tip help-warning"><strong>Compte amb els valors nous.</strong> Abans de crear-ne un, comprova que no existeix amb un altre nom. «Contes» i «Conte» serien dos gèneres diferents i dividirien els llibres en dos grups. Els valors que ja s'han creat no es poden esborrar des de l'app; si te n'equivoques, demana-ho a l'administrador.</div>
        <h4>Les edats</h4>
        <p>Les franges són 3-5, 6-8, 9-11, 12-14 i 14-16 anys, i hi ha «Mestres» per al material del professorat. Al catàleg s'ordenen sempre de petites a grans.</p>
      `
    },
    {
      id: "editar",
      title: "Editar i descatalogar",
      icon: "✏️",
      html: `
        <p class="help-lead">A la dreta del formulari hi ha la llista <strong>Editar catàleg</strong>, amb tots els llibres actius i un cercador.</p>
        <div class="help-mock" aria-hidden="true">
          <div class="list-panel help-mock-list">
            <article class="editor-item">
              <div class="editor-item-main">
                <span><strong>Flanagan Blues Band</strong><small>Andreu Martín, Jaume Ribera - Zona ESO</small></span>
                <span class="availability compact available"><span class="availability-dot"></span><span>2/2</span></span>
              </div>
              <div class="editor-item-actions">
                <span class="link-button icon-edit">Editar</span>
                <span class="link-button link-danger icon-archive">Descatalogar</span>
              </div>
            </article>
          </div>
        </div>
        <ul class="help-list">
          <li><strong>Cercar:</strong> escriu una part del títol, l'autor, l'ISBN, la col·lecció o la ubicació.</li>
          <li><strong>Disponibilitat:</strong> el requadre de color indica <em>disponibles/totals</em>. Verd vol dir que n'hi ha algun a la biblioteca; vermell, que tots són en préstec.</li>
          <li><strong>Editar:</strong> carrega el llibre al formulari de l'esquerra (el títol canvia a «Editar llibre»). Fes els canvis i prem <em>Desar llibre</em>.</li>
          <li><strong>Nou llibre:</strong> buida el formulari si vols deixar l'edició i començar un llibre nou.</li>
          <li><strong>Descatalogar:</strong> treu el llibre del catàleg (perquè s'ha perdut, s'ha fet malbé o s'ha donat de baixa). No demana confirmació, així que vés amb compte.</li>
        </ul>
        <div class="help-tip">Descatalogar no esborra el llibre de la base de dades: només l'amaga. Si l'has descatalogat per error, l'administrador el pot recuperar.</div>
      `
    },
    {
      id: "solicituds",
      title: "Sol·licituds",
      icon: "📥",
      html: `
        <p class="help-lead">Quan un alumne o un docent demana un llibre des del catàleg, la petició apareix a la pestanya <strong>Sol·licituds</strong>.</p>
        <div class="help-mock" aria-hidden="true">
          <article class="circulation-card">
            <div class="circulation-main">
              <strong>La brusa vermella i altres contes</strong>
              <span>Mercè Rodoreda · Prestatgeria B2</span>
              <span>nom.cognom@ramonpont.cat</span>
            </div>
            <div class="circulation-meta">
              <span class="status-pill warning">Pendent</span>
              <span>Demanat: 10/11/2026</span>
              <span>Disponibles: 1/2</span>
            </div>
            <div class="circulation-actions">
              <span class="link-button icon-save">Fer préstec</span>
              <span class="link-button icon-clear">Rebutjar</span>
              <span class="link-button icon-login">Contactar</span>
            </div>
          </article>
        </div>
        <ul class="help-list">
          <li>Les sol·licituds s'ordenen <strong>per ubicació</strong>, perquè puguis recollir tots els llibres d'una mateixa prestatgeria d'un sol cop.</li>
          <li><strong>Fer préstec:</strong> el llibre passa a <em>Préstecs</em> amb un termini de <strong>15 dies</strong> i els exemplars disponibles baixen en un. El botó queda desactivat si no en queda cap de disponible.</li>
          <li><strong>Rebutjar:</strong> tanca la sol·licitud sense fer el préstec.</li>
          <li><strong>Contactar:</strong> obre un correu adreçat a la persona que l'ha demanat.</li>
          <li>Si les dades no s'actualitzen, prem <em>Actualitzar</em>.</li>
        </ul>
        <div class="help-tip">De moment, els préstecs sempre es fan a partir d'una sol·licitud. Si algú et demana un llibre en persona, pot fer la sol·licitud des del mòbil en un moment i tu la converteixes en préstec.</div>
      `
    },
    {
      id: "prestecs",
      title: "Préstecs i devolucions",
      icon: "📚",
      html: `
        <p class="help-lead">La pestanya <strong>Préstecs</strong> mostra tots els llibres que són fora, ordenats per la data de retorn més propera.</p>
        <div class="help-mock" aria-hidden="true">
          <article class="circulation-card">
            <div class="circulation-main">
              <strong>Palestina, simfonia de la terra</strong>
              <span>Anna Tortajada · Zona ESO</span>
              <span>nom.cognom@ramonpont.cat</span>
            </div>
            <div class="circulation-meta">
              <span class="status-pill warning">En préstec</span>
              <span>Préstec: 03/11/2026</span>
              <span>Retorn previst: 18/11/2026</span>
            </div>
            <div class="circulation-actions">
              <span class="link-button icon-save">Registrar devolució</span>
              <span class="link-button icon-sort-asc">Renovar 15 dies</span>
              <span class="link-button icon-login">Contactar</span>
            </div>
          </article>
        </div>
        <ul class="help-list">
          <li><strong>Registrar devolució:</strong> fes-ho quan tinguis el llibre a les mans. L'exemplar torna a estar disponible i el préstec passa a l'<em>Historial</em>.</li>
          <li><strong>Renovar 15 dies:</strong> allarga el termini 15 dies a partir de la data prevista. Si el termini ja havia passat, compten des d'avui.</li>
          <li><strong>Contactar:</strong> obre un correu per recordar el retorn.</li>
        </ul>
      `
    },
    {
      id: "retards",
      title: "Retards i avisos",
      icon: "⏰",
      html: `
        <p class="help-lead">La pestanya <strong>Retards</strong> recull només els préstecs que ja han passat la data de retorn, de més a menys dies de retard.</p>
        <div class="help-mock" aria-hidden="true">
          <article class="circulation-card">
            <div class="circulation-main">
              <strong>Dits llargs</strong>
              <span>Roger Collinson · Prestatgeria A1</span>
              <span>nom.cognom@ramonpont.cat</span>
            </div>
            <div class="circulation-meta">
              <span class="status-pill danger">4 dies de retard</span>
              <span>Préstec: 22/10/2026</span>
              <span>Retorn previst: 06/11/2026</span>
            </div>
            <div class="circulation-actions">
              <span class="link-button icon-save">Registrar devolució</span>
              <span class="link-button icon-sort-asc">Renovar 15 dies</span>
              <span class="link-button icon-login">Contactar</span>
            </div>
          </article>
        </div>
        <p>Hi tens els mateixos botons que a Préstecs. Si el llibre ja ha tornat, registra'n la devolució i desapareixerà d'aquesta llista.</p>
        <h4>Avisos automàtics per correu</h4>
        <p>Cada matí (a les 7.30 a l'hivern i a les 8.30 a l'estiu) l'app revisa els préstecs i, si el servei de correu està configurat, envia:</p>
        <ul class="help-list">
          <li>a la persona que té el llibre, un recordatori quan falten <strong>dos dies o menys</strong>, un altre <strong>el dia del termini</strong> i un altre quan ja <strong>ha vençut</strong>;</li>
          <li>a la biblioteca, un <strong>resum dels retards</strong>;</li>
          <li>a la biblioteca, un avís cada vegada que algú fa una <strong>sol·licitud nova</strong>.</li>
        </ul>
        <p>Cada avís s'envia una sola vegada per préstec, de manera que ningú no rep correus repetits.</p>
      `
    },
    {
      id: "historial",
      title: "Historial",
      icon: "🗂️",
      html: `
        <p class="help-lead">La pestanya <strong>Historial</strong> mostra les últimes 80 devolucions registrades: quin llibre, qui el tenia i quin dia va tornar.</p>
        <div class="help-mock" aria-hidden="true">
          <article class="circulation-card">
            <div class="circulation-main">
              <strong>El gat negre i altres relats</strong>
              <span>Edgar Allan Poe · Prestatgeria C1</span>
              <span>nom.cognom@ramonpont.cat</span>
            </div>
            <div class="circulation-meta">
              <span class="status-pill">Retornat</span>
              <span>Data: 07/11/2026</span>
            </div>
            <div class="circulation-actions"></div>
          </article>
        </div>
        <p>És útil per saber si un llibre ja ha tornat o qui va ser l'últim a llegir-lo.</p>
      `
    },
    {
      id: "cataleg",
      title: "Consultar el catàleg",
      icon: "🔎",
      html: `
        <p class="help-lead">La pàgina <strong>Catàleg</strong> és la que fan servir alumnes i docents per trobar llibres. Com a gestor, també hi pots entrar des del menú superior.</p>
        <ul class="help-list">
          <li><strong>Cerca:</strong> busca alhora en el títol, l'autor, l'editorial, l'ISBN, la col·lecció, l'edat, la temàtica, el gènere, la ubicació i el resum.</li>
          <li><strong>Filtres:</strong> obre els filtres d'edat, temàtica, gènere i disponibilitat. Es poden combinar entre ells i amb la cerca.</li>
          <li><strong>Netejar filtres:</strong> torna a mostrar tots els llibres.</li>
          <li><strong>Ordena per:</strong> nom, autor, edat, temàtica, gènere, disponibilitat o any, en ordre ascendent o descendent.</li>
          <li><strong>Descarregar PDF:</strong> obre la llista que estàs veient, amb els filtres aplicats, a punt per imprimir o desar en PDF. Si no s'obre, permet les finestres emergents al navegador.</li>
        </ul>
        <p>Sota el títol de cada llibre hi ha l'editorial i l'ISBN i, en una segona línia, la col·lecció, el número i les pàgines, si s'han omplert:</p>
        <div class="help-mock" aria-hidden="true">
          <div class="help-mock-row">
            <h3>Títol del llibre</h3>
            <span class="book-kicker">Editorial · ISBN 9788400000000</span>
            <span class="book-kicker">Col·lecció Nom de la col·lecció, núm. 12 · 96 pàg.</span>
          </div>
        </div>
        <div class="help-tip">A la portada hi ha l'enllaç <em>Consultar el catàleg sense entrar</em>: mostra el catàleg a qualsevol persona, sense iniciar sessió, però sense poder demanar llibres.</div>
      `
    },
    {
      id: "lectors",
      title: "Com ho fan els lectors",
      icon: "🧒",
      html: `
        <p class="help-lead">Saber què veuen els alumnes i els docents t'ajudarà a explicar-los com demanar llibres.</p>
        <ol class="help-steps">
          <li><strong>Entren amb el correu del centre.</strong><span>A la portada escriuen el seu correu @ramonpont.cat i premen <em>Entrar</em>. No els cal contrasenya.</span></li>
          <li><strong>Busquen al catàleg.</strong><span>Fan servir la cerca i els filtres, igual que tu.</span></li>
          <li><strong>Trien els llibres.</strong><span>Cada llibre té un botó <em>Triar</em>. Poden triar-ne més d'un.</span>
            <div class="help-mock" aria-hidden="true"><span class="link-button compact-select icon-add">Triar</span> <span class="link-button compact-select button-selected icon-save">Triat</span></div>
          </li>
          <li><strong>Envien la sol·licitud.</strong><span>Al requadre <em>Sol·licitud de llibres</em> premen <em>Enviar sol·licitud</em>. A tu et surt a la pestanya Sol·licituds.</span></li>
          <li><strong>Recullen el llibre</strong> a la biblioteca i tu en registres el préstec.</li>
        </ol>
      `
    },
    {
      id: "problemes",
      title: "Dubtes i problemes",
      icon: "❓",
      html: `
        <div class="help-faq">
          <details open>
            <summary>Surt «No s'ha pogut desar el canvi. Tanca la sessió i torna a entrar com a gestor».</summary>
            <p>La sessió de gestor es renova sola mentre la pestanya del navegador és oberta. Si tanques el navegador o passa molt de temps, pot caducar. Fes clic al teu nom (a dalt a la dreta, <em>· Sortir</em>), torna a entrar amb el correu de la biblioteca i la contrasenya, i repeteix l'últim canvi.</p>
          </details>
          <details>
            <summary>L'ISBN surt com a «no vàlid».</summary>
            <p>Revisa que no falti ni sobri cap xifra. Els ISBN antics tenen 10 caràcters i poden acabar en X; els moderns en tenen 13 i comencen per 978 o 979. Els guions i els espais no importen.</p>
          </details>
          <details>
            <summary>La cerca per ISBN no troba el llibre.</summary>
            <p>Passa sobretot amb llibres catalans antics o d'editorials petites. Omple la fitxa a mà: l'ISBN es desa igualment i servirà per detectar duplicats.</p>
          </details>
          <details>
            <summary>He creat un llibre repetit.</summary>
            <p>Descataloga el duplicat i, al llibre bo, augmenta els exemplars totals i disponibles.</p>
          </details>
          <details>
            <summary>Un llibre surt amb disponibles 0, però és a la prestatgeria.</summary>
            <p>Mira a Préstecs si hi ha un préstec obert d'aquest llibre i registra'n la devolució. Si no n'hi ha cap, edita'l i corregeix els exemplars disponibles.</p>
          </details>
          <details>
            <summary>He creat un gènere o una temàtica amb una falta.</summary>
            <p>Corregeix els llibres afectats triant el valor bo. El valor mal escrit continuarà sortint com a opció fins que l'administrador l'esborri.</p>
          </details>
          <details>
            <summary>Com surto de la gestió?</summary>
            <p>Fes clic al botó amb el teu nom, a dalt a la dreta. La sessió es tanca i tornes a la portada.</p>
          </details>
          <details>
            <summary>On comunico un error o una idea?</summary>
            <p>Al peu de cada pàgina hi ha l'enllaç <em>Suggeriments i errors</em>.</p>
          </details>
        </div>
      `
    }
  ];

  const TAB_TO_SECTION = {
    catalog: "alta",
    requests: "solicituds",
    loans: "prestecs",
    overdue: "retards",
    history: "historial"
  };

  let dialog = null;

  function build() {
    dialog = document.createElement("dialog");
    dialog.className = "help-dialog";
    dialog.setAttribute("aria-labelledby", "help-title");
    dialog.innerHTML = `
      <div class="help-shell">
        <header class="help-header">
          <div class="help-heading">
            <img src="assets/logo-sol.svg" alt="" width="40" height="40">
            <div>
              <h2 id="help-title">Ajuda de la gestió</h2>
              <p>Guia per fer servir la Biblioteca de la Sol</p>
            </div>
          </div>
          <button class="dialog-close help-close" type="button" aria-label="Tancar l'ajuda"></button>
        </header>
        <div class="help-body">
          <nav class="help-nav" aria-label="Apartats de l'ajuda">
            ${SECTIONS.map((section) => `
              <button type="button" class="help-nav-item" data-help-go="${section.id}">
                <span class="help-nav-icon" aria-hidden="true">${section.icon}</span>
                <span>${section.title}</span>
              </button>
            `).join("")}
          </nav>
          <div class="help-content" tabindex="-1">
            ${SECTIONS.map((section) => `
              <section class="help-section" id="help-${section.id}" data-help-section="${section.id}" hidden>
                <h3><span aria-hidden="true">${section.icon}</span> ${section.title}</h3>
                ${section.html}
              </section>
            `).join("")}
            <div class="help-pager">
              <button type="button" class="button button-secondary" data-help-step="-1">← Anterior</button>
              <button type="button" class="button button-secondary" data-help-step="1">Següent →</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    dialog.querySelector(".help-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
        return;
      }
      const go = event.target.closest("[data-help-go]");
      if (go) {
        event.preventDefault();
        show(go.dataset.helpGo);
        return;
      }
      const step = event.target.closest("[data-help-step]");
      if (step) {
        const index = SECTIONS.findIndex((section) => section.id === dialog.dataset.current);
        const next = SECTIONS[index + Number(step.dataset.helpStep)];
        if (next) show(next.id);
      }
    });
  }

  function show(id) {
    const target = SECTIONS.some((section) => section.id === id) ? id : SECTIONS[0].id;
    dialog.dataset.current = target;
    dialog.querySelectorAll("[data-help-section]").forEach((section) => {
      section.hidden = section.dataset.helpSection !== target;
    });
    dialog.querySelectorAll(".help-nav-item").forEach((item) => {
      const active = item.dataset.helpGo === target;
      item.setAttribute("aria-current", active ? "true" : "false");
      if (active) item.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    const index = SECTIONS.findIndex((section) => section.id === target);
    const prev = dialog.querySelector('[data-help-step="-1"]');
    const next = dialog.querySelector('[data-help-step="1"]');
    prev.disabled = index === 0;
    next.disabled = index === SECTIONS.length - 1;
    next.textContent = index < SECTIONS.length - 1 ? `${SECTIONS[index + 1].title} →` : "Següent →";
    const content = dialog.querySelector(".help-content");
    content.scrollTop = 0;
  }

  function contextSection() {
    const activeTab = document.querySelector('[data-manager-tab][aria-selected="true"]');
    if (activeTab && !document.getElementById("editor-app")?.hidden) {
      return TAB_TO_SECTION[activeTab.dataset.managerTab] || "inici";
    }
    if (document.getElementById("catalog-list")) return "cataleg";
    return "inici";
  }

  function open(id) {
    if (!dialog) build();
    if (!dialog.open) dialog.showModal();
    show(id || contextSection());
    dialog.querySelector(".help-content").focus({ preventScroll: true });
  }

  window.BibliotecaSolAjuda = { open };
})();
