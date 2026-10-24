/* Atzar a l'aula — menú de les apps. */
(() => {
  "use strict";
  const A = window.Atzar;
  const GROUPS = [
    {
      title: "Gestió de l’aula",
      apps: [
        { dir: "Ruleta", name: "ruleta", link: "ruletapp", tint: "--pastel-peach", text: "Una roda amb els noms de la classe o amb 600 propostes de 30 temes. Sense repeticions i amb historial." },
        { dir: "Sorteig", name: "sorteig", link: "sorteigapp", tint: "--pastel-mint", text: "Paperets que surten d’un barret: tria’n uns quants o ordena tota la llista." },
        { dir: "Equips", name: "equips", link: "equipsapp", tint: "--pastel-blue", text: "Grups equilibrats a l’atzar, amb condicions, nivells, noms d’equip i rols cooperatius." },
        { dir: "Temps", name: "temps", link: "tempsapp", tint: "--pastel-sand", text: "Compte enrere amb anell de colors, cronòmetre amb marques, patata calenta i fases encadenades (1-2-4, debat, Tabata)." },
      ],
    },
    {
      title: "Jocs i probabilitat",
      apps: [
        { dir: "Moneda", name: "moneda", link: "monedapp", tint: "--pastel-sand", text: "D’una a deu monedes, cara i creu personalitzables i la llei dels grans nombres en directe." },
        { dir: "Daus", name: "daus", link: "dausapp", tint: "--pastel-rose", text: "Fins a sis daus de 4 a 20 cares, amb suma o producte i la distribució dels resultats." },
        { dir: "Cartes", name: "cartes", link: "cartesapp", tint: "--pastel-blue", text: "Baralla espanyola o francesa, amb reposició o sense, i les probabilitats de les que queden." },
        { dir: "Nombres", name: "nombres", link: "nombresapp", tint: "--pastel-lilac", text: "Nombres en un interval, nombre secret, bombo amb tauler i veu, i lletres per a l’Stop." },
      ],
    },
  ];
  const host = document.getElementById("groups");
  for (const group of GROUPS) {
    const section = document.createElement("section"),
      h2 = document.createElement("h2"),
      cards = document.createElement("div");
    section.className = "group";
    h2.textContent = group.title;
    cards.className = "cards";
    for (const app of group.apps) {
      // Tota la targeta és clicable gràcies a l'enllaç del títol; el botó Copia en queda fora.
      const card = document.createElement("article");
      card.className = "app-card";
      card.style.setProperty("--tint", `var(${app.tint})`);
      card.innerHTML = `<div class="card-top"><img src="${app.dir}/favicon.svg" alt="" width="76" height="76" /><span class="card-arrow" aria-hidden="true">→</span></div><h3><a class="card-link" href="${app.dir}/">${app.name}<span>.</span></a></h3><p></p><div class="short-link"><span>Enllaç curt: <code>ja.cat/${app.link}</code></span><button type="button" class="copy-link" aria-label="Copia l’enllaç ja.cat/${app.link}">Copia</button></div>`;
      card.querySelector("p").textContent = app.text;
      card.querySelector(".copy-link").addEventListener("click", () => A.copyText(`https://ja.cat/${app.link}`));
      cards.append(card);
    }
    section.append(h2, cards);
    host.append(section);
  }

  /* Còpia de seguretat de les dades de totes les apps (només claus pròpies d'Atzar). */
  const OWN = /^felip\.(atzar|ruleta)\./,
    MAX_IMPORT = 4 * 1024 * 1024;
  const ownKeys = () => {
    try {
      return Object.keys(localStorage).filter((k) => OWN.test(k));
    } catch {
      return [];
    }
  };
  const note = (text) => (document.getElementById("dataNote").textContent = text);
  function refreshNote() {
    const n = ownKeys().length;
    note(n ? `Hi ha ${n > 1 ? `${n} apartats` : "un apartat"} amb dades en aquest navegador.` : "Encara no hi ha dades desades en aquest navegador.");
  }
  document.getElementById("exportData").addEventListener("click", () => {
    const data = {};
    for (const k of ownKeys()) data[k] = localStorage.getItem(k);
    if (!Object.keys(data).length) return A.toast("Encara no hi ha dades per exportar.");
    const day = new Date().toISOString().slice(0, 10);
    A.download(`atzar-dades-${day}.json`, JSON.stringify({ app: "Atzar a l’aula", version: 1, date: new Date().toISOString(), data }, null, 2), "application/json");
  });
  document.getElementById("importData").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT) return A.toast("El fitxer és massa gran per ser una còpia d’Atzar.");
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return A.toast("No s’ha pogut llegir el fitxer: no és un JSON vàlid.");
    }
    const entries = parsed && typeof parsed.data === "object" && parsed.data ? Object.entries(parsed.data).filter(([k, v]) => OWN.test(k) && typeof v === "string") : [];
    if (!entries.length) return A.toast("Aquest fitxer no conté dades d’Atzar a l’aula.");
    // Es desa l'estat actual per poder-lo recuperar amb «Desfés».
    const before = {};
    for (const k of ownKeys()) before[k] = localStorage.getItem(k);
    try {
      for (const [k, v] of entries) localStorage.setItem(k, v);
    } catch {
      for (const [k] of entries) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(before)) localStorage.setItem(k, v);
      return A.toast("No hi ha prou espai al navegador per importar la còpia.");
    }
    refreshNote();
    A.undoable(`${entries.length > 1 ? `S’han importat ${entries.length} apartats` : "S’ha importat un apartat"}. Obre qualsevol app per veure-ho.`, () => {
      for (const k of ownKeys()) if (!(k in before)) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(before)) localStorage.setItem(k, v);
      refreshNote();
    });
  });
  refreshNote();
  A.init();
})();
