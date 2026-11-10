const LOGO = 'logo.png';

const MOTIUS = [
  ['projecte','📚'], ['proximitat','🏠'], ['tracte','🤗'],
  ['reputacio','⭐'], ['installacions','🏫'], ['serveis','🍽️']
];
const VALORS = [['adaptacio','😊'], ['atencio','👩‍🏫'], ['comunicacio','💬'], ['clima','🤝']];

const T = {
  ca: {
    nom:'Català', veu:'ca',
    hola:'La vostra opinió ens importa',
    info:['Són 4 preguntes', 'Trigareu uns 2 minuts', 'És anònim: no cal posar el nom'],
    comencar:'Començar', seguent:'Següent', enrere:'Enrere', enviar:'Enviar', enviant:'Enviant…',
    p1:'Per què vau triar la nostra escola?', p1s:'Trieu fins a 3 respostes',
    motius:{projecte:'Projecte educatiu i metodologia', proximitat:'A prop de casa o de la feina', tracte:'Tracte familiar, proper i acollidor', reputacio:"Bona fama / Ens la van recomanar altres famílies", installacions:'Instal·lacions, patis i aules', serveis:"Serveis d'acollida, menjador o extraescolars"},
    altreMotiu:'Una altra raó', escriviu:'Escriviu-la aquí',
    max:'Ja n\'heu triat 3. Traieu-ne una per triar-ne una altra.',
    p2:'Després d\'aquests primers mesos, què és el que més valoreu?', p2s:'Podeu triar-ne més d\'una',
    valors:{adaptacio:"L'adaptació i el benestar del meu fill o filla", atencio:"L'atenció i l'acompanyament de les mestres", comunicacio:'La comunicació i la relació amb la meva família', clima:'La convivència i el bon ambient de l\'escola'},
    altreValor:'Una altra cosa',
    p3:'Si haguéssiu de recomanar la nostra escola a una família nova, què li diríeu en una sola frase?',
    p3s:'Podeu escriure en la llengua que vulgueu', p3ph:'Escriviu aquí la vostra frase…',
    p3opc:'Si no voleu escriure, podeu passar a la pregunta següent.',
    p4:'De l\'1 al 10, recomanaríeu la nostra escola a altres famílies?',
    p4baix:'Gens probable', p4alt:'Molt probable',
    gracies:'Moltes gràcies!', graciesTxt:'Les vostres respostes ens ajuden a millorar i a donar a conèixer l\'escola.',
    jaFet:'Ja heu respost aquest curs. Moltes gràcies!', altraVegada:'Respondre una altra vegada',
    error:'No s\'ha pogut enviar. Comproveu la connexió i torneu-ho a provar.'
  },
  es: {
    nom:'Español', veu:'es',
    hola:'Vuestra opinión es muy importante para nosotros',
    info:['Son 4 preguntas', 'Tardaréis unos 2 minutos', 'Es anónimo: no hace falta poner el nombre'],
    comencar:'Empezar', seguent:'Siguiente', enrere:'Atrás', enviar:'Enviar', enviant:'Enviando…',
    p1:'¿Por qué elegisteis nuestra escuela?', p1s:'Elegid hasta 3 respuestas',
    motius:{projecte:'El proyecto educativo y la forma de enseñar', proximitat:'Está cerca de casa o del trabajo', tracte:'Trato familiar, cercano y acogedor', reputacio:'Buena fama / Nos la recomendaron otras familias', installacions:'Instalaciones, patios y aulas', serveis:'Servicio de acogida, comedor o extraescolares'},
    altreMotiu:'Otro motivo', escriviu:'Escribidlo aquí',
    max:'Ya habéis elegido 3. Quitad una para elegir otra.',
    p2:'Después de estos primeros meses, ¿qué es lo que más valoráis?', p2s:'Podéis elegir más de una',
    valors:{adaptacio:'La adaptación y el bienestar de mi hijo o hija', atencio:'La atención y el acompañamiento de las maestras', comunicacio:'La comunicación y la relación con mi familia', clima:'La convivencia y el buen ambiente de la escuela'},
    altreValor:'Otra cosa',
    p3:'Si tuvierais que recomendar nuestra escuela a una familia nueva, ¿qué le diríais en una sola frase?',
    p3s:'Podéis escribir en el idioma que queráis', p3ph:'Escribid aquí vuestra frase…',
    p3opc:'Si no queréis escribir, podéis pasar a la siguiente pregunta.',
    p4:'Del 1 al 10, ¿recomendaríais nuestra escuela a otras familias?',
    p4baix:'Nada probable', p4alt:'Muy probable',
    gracies:'¡Muchas gracias!', graciesTxt:'Vuestras respuestas nos ayudan a mejorar y a dar a conocer la escuela.',
    jaFet:'Ya habéis respondido este curso. ¡Muchas gracias!', altraVegada:'Responder otra vez',
    error:'No se ha podido enviar. Comprobad la conexión y volved a intentarlo.'
  },
  ar: {
    nom:'الدارجة', veu:'ar',
    hola:'الرأي ديالكم مهم بزاف عندنا',
    info:['كاينين 4 ديال الأسئلة', 'غادي تاخد ليكم شي دقيقتين', 'ما خاصكمش تكتبو السمية ديالكم'],
    comencar:'يلاه نبداو', seguent:'اللي من بعد', enrere:'رجع', enviar:'صيفط', enviant:'كنصيفطو…',
    p1:'علاش ختاريتو المدرسة ديالنا؟', p1s:'ختارو حتى 3 ديال الأجوبة',
    motius:{projecte:'المشروع التربوي وطريقة التعليم', proximitat:'قريبة من الدار ولا من الخدمة', tracte:'المعاملة زوينة وقريبة بحال العائلة', reputacio:'سمعتها مزيانة / نصحونا بيها عائلات أخرين', installacions:'البناية، الساحات والأقسام', serveis:'الاستقبال فالصباح، المطعم ولا الأنشطة من بعد القراية'},
    altreMotiu:'سبب آخر', escriviu:'كتبوه هنا',
    max:'ختاريتو 3 ديجا. حيدو وحدة باش تختارو وحدة أخرى.',
    p2:'من بعد هاد الشهور الأولى، شنو اللي عجبكم كثر؟', p2s:'تقدرو تختارو كثر من وحدة',
    valors:{adaptacio:'ولدي ولا بنتي تأقلم ومرتاح فالمدرسة', atencio:'الاهتمام والمرافقة ديال المعلمات', comunicacio:'التواصل والعلاقة مع العائلة ديالي', clima:'الجو المزيان والتعايش فالمدرسة'},
    altreValor:'حاجة أخرى',
    p3:'إلا بغيتو تنصحو عائلة جديدة بالمدرسة ديالنا، شنو غادي تقولو ليها فجملة وحدة؟',
    p3s:'تقدرو تكتبو باللغة اللي بغيتو', p3ph:'كتبو الجملة ديالكم هنا…',
    p3opc:'إلا ما بغيتوش تكتبو، دوزو للسؤال اللي من بعد.',
    p4:'من 1 حتى 10، واش غادي تنصحو عائلات أخرين بالمدرسة ديالنا؟',
    p4baix:'لا، ما غاديش', p4alt:'إيه، بزاف',
    gracies:'شكرا بزاف!', graciesTxt:'الأجوبة ديالكم كتعاونا باش نتحسنو ونعرّفو الناس بالمدرسة.',
    jaFet:'ديجا جاوبتو هاد العام. شكرا بزاف!', altraVegada:'جاوب مرة أخرى',
    error:'ما تصيفطش. شوفو الإنترنت وعاودو جربو.'
  }
};

const COLORS_NOTA = ['#C62828','#D84315','#E65100','#EF6C00','#F57C00','#F9A825','#C0A000','#9E9D24','#558B2F','#2E7D32'];
const CARES = ['😞','😞','🙁','🙁','😐','😐','🙂','🙂','😃','😍'];

const estat = {
  idioma:null, pas:'idioma',
  motius:[], altreMotiuOn:false, altreMotiu:'',
  valors:[], altreValorOn:false, altreValor:'',
  frase:'', nota:null
};
const PASSOS = ['inici','p1','p2','p3','p4'];
const app = document.getElementById('app');
const t = () => T[estat.idioma || 'ca'];

function cursEscolar(d){ const a=d.getFullYear(); return d.getMonth()>=8 ? a+'-'+(a+1) : (a-1)+'-'+a; }
const CURS = cursEscolar(new Date());
const CLAU = 'valoracio-escola-enviada';
function llegeix(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function desa(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }

function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* Lectura en veu alta, només si el dispositiu té una veu de l'idioma */
function veuPer(lang){
  if(!('speechSynthesis' in window)) return null;
  const veus = speechSynthesis.getVoices();
  return veus.find(v => v.lang.toLowerCase().startsWith(lang+'-ma')) ||
         veus.find(v => v.lang.toLowerCase().startsWith(lang)) || null;
}
if('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { if(estat.pas!=='idioma') pinta(); };
/* En darija hi ha àudios gravats (audio/ar-*.mp3): sonen a tots els dispositius. */
const AUDIOS_AR = ['inici','p1','p2','p3','p4'];
let audioActual = null;
function botoEscolta(text, clau){
  if(estat.idioma==='ar' && AUDIOS_AR.includes(clau))
    return `<button class="escolta" type="button" aria-label="🔊" data-audio="audio/ar-${clau}.mp3">🔊</button>`;
  if(!veuPer(t().veu)) return '';
  return `<button class="escolta" type="button" aria-label="🔊" data-diu="${esc(text)}">🔊</button>`;
}
function aturaAudio(){
  if(audioActual){ audioActual.pause(); audioActual = null; }
  if('speechSynthesis' in window) speechSynthesis.cancel();
}
function parla(boto){
  const sonava = boto.classList.contains('parla');
  aturaAudio();
  document.querySelectorAll('.escolta.parla').forEach(b=>b.classList.remove('parla'));
  if(sonava) return;
  if(boto.dataset.audio){
    const a = new Audio(boto.dataset.audio);
    audioActual = a;
    a.onended = a.onerror = () => { boto.classList.remove('parla'); if(audioActual===a) audioActual=null; };
    boto.classList.add('parla');
    a.play().catch(() => boto.classList.remove('parla'));
    return;
  }
  const u = new SpeechSynthesisUtterance(boto.dataset.diu);
  const v = veuPer(t().veu); if(v){ u.voice=v; u.lang=v.lang; }
  u.rate = .92;
  u.onend = u.onerror = () => boto.classList.remove('parla');
  boto.classList.add('parla');
  speechSynthesis.speak(u);
}

function posaIdioma(codi){
  estat.idioma = codi;
  document.documentElement.lang = codi==='ar' ? 'ary' : codi;
  document.documentElement.dir = codi==='ar' ? 'rtl' : 'ltr';
  document.getElementById('nomIdioma').textContent = T[codi].nom;
  document.getElementById('canviaIdioma').classList.remove('amaga');
}

function vesA(pas){
  aturaAudio();
  estat.pas = pas;
  pinta();
  window.scrollTo({top:0, behavior:'smooth'});
}

function pinta(){
  const p = estat.pas, tx = t();
  const enQuestio = /^p\d$/.test(p);
  document.getElementById('progres').classList.toggle('amaga', !enQuestio);
  document.getElementById('navegacio').classList.toggle('amaga', !(enQuestio || p==='inici'));
  if(enQuestio){
    const n = +p[1];
    document.getElementById('progres').innerHTML = [1,2,3,4].map(i =>
      `<span class="${i<n?'fet':i===n?'actual':''}">${i<n?'✓':i}</span>`).join('');
  }
  const html = { idioma:pIdioma, inici:pInici, p1:pP1, p2:pP2, p3:pP3, p4:pP4, gracies:pGracies, jaFet:pJaFet }[p]();
  app.innerHTML = `<section class="pantalla">${html}</section>`;
  actualitzaNav();
}

function actualitzaNav(){
  const p = estat.pas, tx = t();
  const seg = document.getElementById('seguent');
  document.getElementById('txtEnrere').textContent = tx.enrere;
  document.getElementById('enrere').classList.toggle('amaga', p==='inici');
  seg.classList.toggle('enviar', p==='p4');
  document.getElementById('txtSeguent').textContent = p==='inici' ? tx.comencar : p==='p4' ? tx.enviar : tx.seguent;
  const fl = seg.querySelector('.fletxa');
  fl.textContent = p==='p4' ? '✓' : '→';
  fl.classList.toggle('sense-gir', p==='p4');
  seg.disabled = !valid(p);
}

function valid(p){
  if(p==='p1') return estat.motius.length>0 || (estat.altreMotiuOn && estat.altreMotiu.trim());
  if(p==='p2') return estat.valors.length>0 || (estat.altreValorOn && estat.altreValor.trim());
  if(p==='p4') return estat.nota!==null;
  return true;
}

/* ---- Pantalles ---- */
function pIdioma(){
  return `<div class="benvinguda">
    <img src="${LOGO}" alt="Escola Ramon Pont">
    <div class="salutacio">Benvinguts · Bienvenidos<br><span class="ar" dir="rtl">مرحبا بيكم</span></div>
    <div class="idiomes">
      <button class="idioma" data-idioma="ca" type="button"><span class="bombolla">👋</span><span>Català<small>Catalan</small></span></button>
      <button class="idioma" data-idioma="es" type="button"><span class="bombolla">👋</span><span>Español<small>Castellano</small></span></button>
      <button class="idioma" data-idioma="ar" type="button"><span class="bombolla">👋</span><span class="ar" dir="rtl">الدارجة<small>Darija · العربية المغربية</small></span></button>
    </div>
    ${window.VALORACIO && VALORACIO.clientId ? '<button class="boto-estadistiques" id="obreEstadistiques" type="button" lang="ca">📊 Estadístiques</button>' : ''}
  </div>`;
}
function pInici(){
  const tx=t(), ics=['❓','⏱️','🔒'];
  return `<div class="fila-titol"><h1 class="titol">${esc(tx.hola)}</h1>${botoEscolta(tx.hola+'. '+tx.info.join('. '),'inici')}</div>
    <div class="xips">${tx.info.map((s,i)=>`<div class="xip"><span class="ic">${ics[i]}</span>${esc(s)}</div>`).join('')}</div>`;
}
function targeta(clau, ic, text, premut){
  return `<button class="opcio" type="button" data-clau="${clau}" aria-pressed="${premut}">
    <span class="marca" aria-hidden="true">✓</span><span class="ic" aria-hidden="true">${ic}</span><span>${esc(text)}</span></button>`;
}
function pP1(){
  const tx=t(), n = estat.motius.length + (estat.altreMotiuOn?1:0);
  return `<div class="fila-titol"><h1 class="titol">${esc(tx.p1)}</h1>${botoEscolta(tx.p1+' '+tx.p1s+'. '+MOTIUS.map(m=>tx.motius[m[0]]).join('. '),'p1')}</div>
    <div class="comptador">${[0,1,2].map(i=>`<i class="${i<n?'ple':''}"></i>`).join('')} <span>${esc(tx.p1s)}</span></div>
    <div class="avis amaga" id="avisMax" style="margin:0 0 1rem">✋ ${esc(tx.max)}</div>
    <div class="opcions">${MOTIUS.map(([k,ic])=>targeta(k,ic,tx.motius[k],estat.motius.includes(k))).join('')}
      ${targeta('altre','✏️',tx.altreMotiu,estat.altreMotiuOn)}</div>
    ${estat.altreMotiuOn?`<input class="camp" id="altre" maxlength="300" placeholder="${esc(tx.escriviu)}" value="${esc(estat.altreMotiu)}">`:''}`;
}
function pP2(){
  const tx=t();
  return `<div class="fila-titol"><h1 class="titol">${esc(tx.p2)}</h1>${botoEscolta(tx.p2+' '+tx.p2s+'. '+VALORS.map(m=>tx.valors[m[0]]).join('. '),'p2')}</div>
    <p class="subtitol">${esc(tx.p2s)}</p>
    <div class="opcions">${VALORS.map(([k,ic])=>targeta(k,ic,tx.valors[k],estat.valors.includes(k))).join('')}
      ${targeta('altre','✏️',tx.altreValor,estat.altreValorOn)}</div>
    ${estat.altreValorOn?`<input class="camp" id="altre" maxlength="300" placeholder="${esc(tx.escriviu)}" value="${esc(estat.altreValor)}">`:''}`;
}
function pP3(){
  const tx=t();
  return `<div class="fila-titol"><h1 class="titol">${esc(tx.p3)}</h1>${botoEscolta(tx.p3+' '+tx.p3s,'p3')}</div>
    <p class="subtitol">💬 ${esc(tx.p3s)}</p>
    <textarea class="camp gran" id="frase" maxlength="600" placeholder="${esc(tx.p3ph)}">${esc(estat.frase)}</textarea>
    <p class="ajuda">${esc(tx.p3opc)}</p>`;
}
function pP4(){
  const tx=t(), n=estat.nota;
  return `<div class="fila-titol"><h1 class="titol">${esc(tx.p4)}</h1>${botoEscolta(tx.p4+' 1: '+tx.p4baix+'. 10: '+tx.p4alt,'p4')}</div>
    <div class="cara" aria-hidden="true">${n?CARES[n-1]:'🤔'}</div>
    <div class="escala" dir="ltr">${[1,2,3,4,5,6,7,8,9,10].map(i=>
      `<button class="nota" type="button" data-nota="${i}" aria-pressed="${n===i}" style="background:${COLORS_NOTA[i-1]}">${i}</button>`).join('')}</div>
    <div class="extrems" dir="ltr"><span><b>1</b> <bdi>${esc(tx.p4baix)}</bdi></span><span><bdi>${esc(tx.p4alt)}</bdi> <b>10</b></span></div>
    <div class="avis amaga" id="avisError"></div>`;
}
function pGracies(){
  const tx=t();
  return `<div class="final"><div class="gran-ic">💛</div><h1 class="titol">${esc(tx.gracies)}</h1>
    <p class="subtitol">${esc(tx.graciesTxt)}</p></div>`;
}
function pJaFet(){
  const tx=t();
  return `<div class="final"><div class="gran-ic">💛</div><h1 class="titol">${esc(tx.jaFet)}</h1>
    <button class="secundari" id="tornar" type="button">${esc(tx.altraVegada)}</button></div>`;
}

/* ---- Interacció ---- */
app.addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  if(b.classList.contains('escolta')) return parla(b);
  if(b.dataset.idioma){
    posaIdioma(b.dataset.idioma);
    return vesA(llegeix(CLAU)===CURS ? 'jaFet' : 'inici');
  }
  if(b.id==='tornar') return vesA('inici');
  if(b.id==='obreEstadistiques') return window.Estadistiques && Estadistiques.obre();
  if(b.dataset.nota){ estat.nota=+b.dataset.nota; return pinta(); }
  if(b.dataset.clau){
    const k=b.dataset.clau;
    if(estat.pas==='p1'){
      const n = estat.motius.length + (estat.altreMotiuOn?1:0);
      const actiu = k==='altre' ? estat.altreMotiuOn : estat.motius.includes(k);
      if(!actiu && n>=3){
        b.classList.remove('no'); void b.offsetWidth; b.classList.add('no');
        document.getElementById('avisMax').classList.remove('amaga');
        return;
      }
      if(k==='altre') estat.altreMotiuOn=!actiu;
      else estat.motius = actiu ? estat.motius.filter(x=>x!==k) : estat.motius.concat(k);
    } else {
      const actiu = k==='altre' ? estat.altreValorOn : estat.valors.includes(k);
      if(k==='altre') estat.altreValorOn=!actiu;
      else estat.valors = actiu ? estat.valors.filter(x=>x!==k) : estat.valors.concat(k);
    }
    pinta();
    if(k==='altre'){ const c=document.getElementById('altre'); if(c) c.focus(); }
  }
});
app.addEventListener('input', e => {
  if(e.target.id==='altre'){ estat.pas==='p1' ? estat.altreMotiu=e.target.value : estat.altreValor=e.target.value; }
  if(e.target.id==='frase') estat.frase=e.target.value;
  document.getElementById('seguent').disabled = !valid(estat.pas);
});

document.getElementById('enrere').addEventListener('click', () => {
  const i = PASSOS.indexOf(estat.pas); if(i>0) vesA(PASSOS[i-1]);
});
document.getElementById('seguent').addEventListener('click', () => {
  if(!valid(estat.pas)) return;
  if(estat.pas==='p4') return envia();
  vesA(PASSOS[PASSOS.indexOf(estat.pas)+1]);
});
document.getElementById('canviaIdioma').addEventListener('click', () => vesA('idioma'));

function envia(){
  const seg = document.getElementById('seguent'), tx=t();
  seg.disabled = true;
  document.getElementById('txtSeguent').textContent = tx.enviant;
  const dades = {
    idioma: estat.idioma,
    motius: estat.motius, altreMotiu: estat.altreMotiuOn ? estat.altreMotiu : '',
    valors: estat.valors, altreValor: estat.altreValorOn ? estat.altreValor : '',
    frase: estat.frase, nota: estat.nota
  };
  crida({accio:'resposta', resposta:dades})
    .then(r => {
      if(!r || !r.ok) throw new Error(r && r.error);
      desa(CLAU, CURS);
      Object.assign(estat, {motius:[], altreMotiuOn:false, altreMotiu:'', valors:[], altreValorOn:false, altreValor:'', frase:'', nota:null});
      vesA('gracies');
    })
    .catch(() => {
      const a = document.getElementById('avisError');
      if(!a) return;
      a.textContent = '⚠️ ' + tx.error; a.classList.remove('amaga');
      actualitzaNav();
    });
}

/* Crida al servidor d'Apps Script. El text pla evita la petició prèvia CORS. */
function crida(cos, ms){
  const ctrl = new AbortController();
  const temps = setTimeout(() => ctrl.abort(), ms || 30000);
  return fetch(VALORACIO.api, {
    method:'POST', body:JSON.stringify(cos), signal:ctrl.signal,
    headers:{'Content-Type':'text/plain;charset=utf-8'}
  }).then(r => { if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .finally(() => clearTimeout(temps));
}

window.ValoracioApp = { crida, vesA, esc };

pinta();
