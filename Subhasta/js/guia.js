/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Guia pas a pas: estil visual compartit amb l'app, números de les captures i pas actiu */

const CLAU_TEMA = 'subhasta:tema';
const TEMES = ['mercat', 'llotja', 'fosca'];

function aplicaTema(tema) {
  const valid = TEMES.includes(tema) ? tema : 'mercat';
  document.documentElement.setAttribute('data-theme', valid);
  document.querySelectorAll('.btn-tema').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.tema === valid ? 'true' : 'false');
  });
  return valid;
}

let temaInicial = 'mercat';
try {
  temaInicial = localStorage.getItem(CLAU_TEMA) || 'mercat';
} catch (_) {}
aplicaTema(temaInicial);

document.querySelectorAll('.btn-tema').forEach((b) => {
  b.addEventListener('click', () => {
    const t = aplicaTema(b.dataset.tema);
    try {
      localStorage.setItem(CLAU_TEMA, t);
    } catch (_) {}
  });
});

// Relaciona cada número de la captura amb la línia de la llegenda
document.querySelectorAll('.anotada').forEach((bloc) => {
  const marca = (n, actiu) => {
    bloc.querySelectorAll(`[data-n="${n}"]`).forEach((el) => el.classList.toggle('actiu', actiu));
  };
  bloc.querySelectorAll('[data-n]').forEach((el) => {
    const n = el.dataset.n;
    el.addEventListener('mouseenter', () => marca(n, true));
    el.addEventListener('mouseleave', () => marca(n, false));
    el.addEventListener('click', () => {
      bloc.querySelectorAll('.actiu').forEach((a) => a.classList.remove('actiu'));
      marca(n, true);
    });
  });
});

// Marca al mapa el pas que s'està llegint
const enllacosMapa = new Map();
document.querySelectorAll('.mapa a').forEach((a) => enllacosMapa.set(a.getAttribute('href').slice(1), a));
if ('IntersectionObserver' in window) {
  const obs = new IntersectionObserver(
    (entrades) => {
      entrades.forEach((e) => {
        if (!e.isIntersecting) return;
        enllacosMapa.forEach((a, id) => a.setAttribute('aria-current', id === e.target.id ? 'true' : 'false'));
      });
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );
  enllacosMapa.forEach((_, id) => {
    const sec = document.getElementById(id);
    if (sec) obs.observe(sec);
  });
}

document.getElementById('btn-imprimeix')?.addEventListener('click', () => {
  document.querySelectorAll('.faq details').forEach((d) => { d.open = true; });
  window.print();
});

// Toca una captura per veure-la a mida real
document.querySelectorAll('.marc-captura img').forEach((img) => {
  img.addEventListener('click', () => window.open(img.currentSrc || img.src, '_blank', 'noopener'));
});
