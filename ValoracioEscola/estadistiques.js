/* Estadístiques per a l'equip directiu.
 * L'accés el decideix el servidor: només hi entren els comptes de Google que
 * tenen el full de respostes compartit (propietari, editors o lectors).
 * Si el compte no hi té accés, es torna a l'app sense mostrar res. */
(function(){
  const CFG = window.VALORACIO || {};
  const { crida, esc } = window.ValoracioApp;
  const CLAU_SESSIO = 'valoracio-credencial';
  const $ = id => document.getElementById(id);
  const porta = $('porta'), tauler = $('tauler');

  const IC_MOTIUS = { projecte:'📚', proximitat:'🏠', tracte:'🤗', reputacio:'⭐', installacions:'🏫', serveis:'🍽️' };
  const IC_VALORS = { adaptacio:'😊', atencio:'👩‍🏫', comunicacio:'💬', clima:'🤝' };
  const IDIOMES = { es:['Castellà','#C9971C'], ar:['Darija','#2E7D32'], ca:['Català','#8B1E14'] };
  const COLORS_NOTA = ['#C62828','#D84315','#E65100','#EF6C00','#F57C00','#F9A825','#C0A000','#9E9D24','#558B2F','#2E7D32'];

  let dades = null, curs = null, gisCarregat = null, focusAnterior = null;

  function llegeix(){ try{ return sessionStorage.getItem(CLAU_SESSIO); }catch(e){ return null; } }
  function desa(v){ try{ v ? sessionStorage.setItem(CLAU_SESSIO, v) : sessionStorage.removeItem(CLAU_SESSIO); }catch(e){} }

  function avis(text){
    const a = $('avisFlotant');
    a.textContent = text; a.classList.remove('amaga');
    clearTimeout(avis.t); avis.t = setTimeout(() => a.classList.add('amaga'), 3500);
  }

  function carregaGis(){
    if(gisCarregat) return gisCarregat;
    gisCarregat = new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => {
        google.accounts.id.initialize({
          client_id: CFG.clientId, callback: r => entra(r.credential),
          auto_select: false, cancel_on_tap_outside: true, ux_mode: 'popup',
          use_fedcm_for_button: true
        });
        ok();
      };
      s.onerror = () => { gisCarregat = null; ko(new Error('gis')); };
      document.head.appendChild(s);
    });
    return gisCarregat;
  }

  function mostraPorta(){
    focusAnterior = document.activeElement;
    $('portaEstat').textContent = '';
    porta.classList.remove('amaga');
    document.body.classList.add('sense-scroll');
    carregaGis().then(() => {
      const caixa = $('botoGoogle');
      caixa.innerHTML = '';
      google.accounts.id.renderButton(caixa, {
        type:'standard', theme:'outline', size:'large', shape:'pill',
        text:'signin_with', locale:'ca', logo_alignment:'left'
      });
      setTimeout(() => { const b = caixa.querySelector('[role=button]'); if(b) b.focus(); }, 300);
    }).catch(() => { $('portaEstat').textContent = "No s'ha pogut carregar l'inici de sessió de Google."; });
  }

  function tancaPorta(){
    porta.classList.add('amaga');
    document.body.classList.remove('sense-scroll');
    if(focusAnterior && focusAnterior.focus) focusAnterior.focus();
  }

  /* Torna a l'app tal com estava, sense explicacions. */
  function tornaApp(text){
    tancaPorta();
    tauler.classList.add('amaga');
    tauler.innerHTML = '';
    document.body.classList.remove('sense-scroll', 'amb-tauler');
    dades = null;
    if(text) avis(text);
  }

  function entra(credencial){
    $('portaEstat').textContent = 'Comprovant l\'accés…';
    crida({ accio:'estadistiques', credencial }, 45000)
      .then(r => {
        if(r && r.ok){ desa(credencial); dades = r; tancaPorta(); return mostraTauler(); }
        desa(null);
        if(r && r.error === 'acces') return tornaApp('Aquest compte no té accés a les estadístiques.');
        tornaApp('Ara no es poden consultar les estadístiques.');
      })
      .catch(() => tornaApp('Ara no es poden consultar les estadístiques.'));
  }

  function obre(){
    const guardada = llegeix();
    if(guardada){ focusAnterior = document.activeElement; return entra(guardada); }
    mostraPorta();
  }

  function surt(){
    desa(null);
    try{ google.accounts.id.disableAutoSelect(); }catch(e){}
    tornaApp();
  }

  /* ---------- Càlculs ---------- */
  const pct = (n, total) => total ? Math.round(100 * n / total) : 0;
  const fmt = n => String(n).replace('.', ',');

  function resum(files){
    const total = files.length;
    const compta = (clau, cataleg) => Object.keys(cataleg).map(k => ({
      k, nom: cataleg[k], n: files.filter(f => f[clau].indexOf(k) >= 0).length
    }));
    const notes = [1,2,3,4,5,6,7,8,9,10].map(n => files.filter(f => f.nota === n).length);
    const suma = files.reduce((s, f) => s + f.nota, 0);
    const alts = files.filter(f => f.nota >= 9).length;
    const baixos = files.filter(f => f.nota <= 6).length;
    return {
      total,
      mitjana: total ? Math.round(10 * suma / total) / 10 : null,
      alts, mitjos: total - alts - baixos, baixos,
      nps: total ? Math.round(100 * (alts - baixos) / total) : null,
      motius: compta('motius', dades.motius),
      valors: compta('valors', dades.valors),
      altresMotius: files.filter(f => f.altreMotiu).length,
      altresValors: files.filter(f => f.altreValor).length,
      notes,
      idiomes: Object.keys(IDIOMES).map(k => ({ k, n: files.filter(f => f.idioma === k).length }))
    };
  }

  /* ---------- Pintat ---------- */
  function barres(llista, icones, total, color, altres){
    const max = Math.max(1, ...llista.map(x => x.n));
    const files = llista.slice().sort((a, b) => b.n - a.n).map(x => `
      <li class="${x.n === max && x.n > 0 ? 'top' : ''}">
        <span class="b-ic" aria-hidden="true">${icones[x.k] || '•'}</span>
        <span class="b-nom">${esc(x.nom)}</span>
        <span class="b-xifra"><b>${x.n}</b> · ${pct(x.n, total)}%</span>
        <span class="b-pista"><span style="width:${pct(x.n, total)}%;background:${color}"></span></span>
      </li>`).join('');
    const altre = altres ? `<li class="altre"><span class="b-ic" aria-hidden="true">✏️</span>
      <span class="b-nom">Una altra resposta <a href="#altres">(vegeu-les)</a></span>
      <span class="b-xifra"><b>${altres}</b> · ${pct(altres, total)}%</span>
      <span class="b-pista"><span style="width:${pct(altres, total)}%;background:#9AA0A6"></span></span></li>` : '';
    return `<ol class="barres">${files}${altre}</ol>`;
  }

  function columnesNotes(r){
    const max = Math.max(1, ...r.notes);
    return `<div class="notes-dins"><div class="columnes" role="img" aria-label="Distribució de les notes de l'1 al 10">
      ${r.notes.map((n, i) => `<div class="col">
        <span class="col-n">${n || ''}</span>
        <span class="col-barra" style="height:${Math.round(100 * n / max)}%;background:${COLORS_NOTA[i]}"></span>
        <span class="col-et">${i + 1}</span></div>`).join('')}
    </div>
    <div class="notes-resum"><div class="semafor" aria-hidden="true">
      <span style="flex:${r.baixos};background:#C62828"></span>
      <span style="flex:${r.mitjos};background:#F2B400"></span>
      <span style="flex:${r.alts};background:#2E7D32"></span>
    </div>
    <ul class="llegenda">
      <li><i style="background:#2E7D32"></i>Recomanarien molt (9-10): <b>${r.alts}</b> · ${pct(r.alts, r.total)}%</li>
      <li><i style="background:#F2B400"></i>En dubte (7-8): <b>${r.mitjos}</b> · ${pct(r.mitjos, r.total)}%</li>
      <li><i style="background:#C62828"></i>Poc probable (1-6): <b>${r.baixos}</b> · ${pct(r.baixos, r.total)}%</li>
    </ul></div></div>`;
  }

  function idiomes(r){
    return `<div class="idiomes-barra" aria-hidden="true">${r.idiomes.map(x =>
      `<span style="flex:${x.n};background:${IDIOMES[x.k][1]}"></span>`).join('')}</div>
      <ul class="llegenda fila">${r.idiomes.map(x =>
      `<li><i style="background:${IDIOMES[x.k][1]}"></i>${IDIOMES[x.k][0]}: <b>${x.n}</b></li>`).join('')}</ul>`;
  }

  function frases(files){
    const amb = files.filter(f => f.frase).sort((a, b) => b.nota - a.nota || (b.data > a.data ? 1 : -1));
    if(!amb.length) return '<p class="buit">Encara no hi ha frases en aquest curs.</p>';
    return `<div class="frases">${amb.map(f => {
      const trad = f.fraseCa && f.fraseCa !== f.frase;
      return `<figure class="frase">
        <blockquote dir="auto" lang="${f.idioma === 'ar' ? 'ary' : f.idioma}">${esc(f.frase)}</blockquote>
        ${trad ? `<p class="traduccio">${esc(f.fraseCa)}</p>` : ''}
        <figcaption><span class="xip-idioma" style="--c:${IDIOMES[f.idioma][1]}">${IDIOMES[f.idioma][0]}</span>
          <span class="xip-nota" style="background:${COLORS_NOTA[f.nota - 1]}">${f.nota}</span></figcaption>
      </figure>`;
    }).join('')}</div>`;
  }

  function altres(files){
    const llista = [];
    files.forEach(f => {
      if(f.altreMotiu) llista.push(['Motiu de tria', f.altreMotiu]);
      if(f.altreValor) llista.push(['Allò que valoren', f.altreValor]);
    });
    if(!llista.length) return '';
    return `<article class="carta ampla" id="altres"><h3>✏️ Altres respostes escrites</h3>
      <ul class="altres">${llista.map(([tipus, text]) => {
        const [orig, ca] = text.split('\n→ ');
        return `<li><span class="tipus">${tipus}</span><span dir="auto">${esc(orig)}</span>${ca ? `<span class="traduccio">${esc(ca)}</span>` : ''}</li>`;
      }).join('')}</ul></article>`;
  }

  function evolucio(cursos){
    if(cursos.length < 2) return '';
    return `<article class="carta ampla"><h3>📈 Evolució per cursos</h3>
      <div class="taula-ample"><table class="evolucio"><thead><tr><th>Curs</th><th>Respostes</th><th>Nota mitjana</th><th>Recomanen molt</th></tr></thead>
      <tbody>${cursos.map(c => { const r = resum(dades.files.filter(f => f.curs === c));
        return `<tr class="${c === curs ? 'actiu' : ''}"><td>${c}</td><td>${r.total}</td><td>${r.mitjana === null ? '—' : fmt(r.mitjana)}</td><td>${pct(r.alts, r.total)}%</td></tr>`; }).join('')}
      </tbody></table></div></article>`;
  }

  function mostraTauler(){
    const cursos = [...new Set(dades.files.map(f => f.curs).concat(dades.cursActual))].sort().reverse();
    if(!curs || cursos.indexOf(curs) < 0) curs = cursos.indexOf(dades.cursActual) >= 0 ? dades.cursActual : cursos[0];
    const files = dades.files.filter(f => f.curs === curs);
    const r = resum(files);
    const buit = !r.total;

    tauler.innerHTML = `
      <div class="t-capcalera">
        <div class="t-titol"><span aria-hidden="true">📊</span><div><h2>Què en pensen les famílies?</h2>
          <p>Escola Ramon Pont · La vostra opinió</p></div></div>
        <div class="t-accions">
          <a class="t-boto" href="${esc(dades.full)}" target="_blank" rel="noopener noreferrer">🗂️ Full de càlcul</a>
          <button class="t-boto" type="button" data-accio="surt" title="Tanca la sessió">↩ Surt</button>
          <button class="t-boto tanca-t" type="button" data-accio="tanca" aria-label="Torna al qüestionari">✕</button>
        </div>
      </div>
      <div class="t-cos">
        <div class="t-cursos" role="tablist" aria-label="Curs escolar">
          <span>Curs escolar</span>
          ${cursos.map(c => `<button type="button" role="tab" aria-selected="${c === curs}" data-curs="${c}">${c}</button>`).join('')}
          <span class="t-compte" title="Compte">👤 ${esc(dades.correu)}</span>
        </div>
        <div class="kpis">
          <div class="kpi"><span class="kpi-et">Respostes</span><b>${r.total}</b><span class="kpi-sub">famílies</span></div>
          <div class="kpi"><span class="kpi-et">Nota mitjana</span><b>${r.mitjana === null ? '—' : fmt(r.mitjana)}</b><span class="kpi-sub">sobre 10</span></div>
          <div class="kpi verd"><span class="kpi-et">Recomanen molt</span><b>${buit ? '—' : pct(r.alts, r.total) + '%'}</b><span class="kpi-sub">notes de 9 i 10</span></div>
          <div class="kpi"><span class="kpi-et">Idiomes</span>${buit ? '<b>—</b>' : idiomes(r)}</div>
        </div>
        ${buit ? '<p class="buit gran">Encara no hi ha respostes en aquest curs.</p>' : `
        <div class="graella">
          <article class="carta"><h3>1 · Per què van triar l'escola?<small>màxim 3 respostes per família</small></h3>
            ${barres(r.motius, IC_MOTIUS, r.total, '#8B1E14', r.altresMotius)}</article>
          <article class="carta"><h3>2 · Què és el que més valoren?<small>poden triar-ne més d'una</small></h3>
            ${barres(r.valors, IC_VALORS, r.total, '#C9971C', r.altresValors)}</article>
          <article class="carta ampla notes"><h3>4 · Recomanarien l'escola?<small>de l'1 al 10</small></h3>
            ${columnesNotes(r)}</article>
          <article class="carta ampla"><h3>3 · Com la recomanarien en una frase<small>${files.filter(f => f.frase).length} frases · ordenades per nota</small></h3>
            ${frases(files)}</article>
          ${altres(files)}
          ${evolucio(cursos)}
        </div>`}
        <p class="t-peu">Dades anònimes. Els percentatges es calculen sobre el total de famílies que han respost en el curs triat.</p>
      </div>`;
    tauler.classList.remove('amaga');
    document.body.classList.add('sense-scroll', 'amb-tauler');
    tauler.scrollTop = 0;
    const tanca = tauler.querySelector('[data-accio=tanca]');
    if(tanca) tanca.focus({ preventScroll:true });
  }

  tauler.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.curs){ curs = b.dataset.curs; const y = tauler.scrollTop; mostraTauler(); tauler.scrollTop = y; return; }
    if(b.dataset.accio === 'tanca') return tornaApp();
    if(b.dataset.accio === 'surt') return surt();
  });
  $('portaTanca').addEventListener('click', () => tornaApp());
  porta.addEventListener('click', e => { if(e.target === porta) tornaApp(); });
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    if(!porta.classList.contains('amaga') || !tauler.classList.contains('amaga')) tornaApp();
  });

  window.Estadistiques = { obre };
})();
