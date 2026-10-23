/* Atzar a l'aula — menú de les apps. */
(() => {
  "use strict";
  const A = window.Atzar;
  const GROUPS = [
    {
      title: "Gestió de l’aula",
      apps: [
        { dir: "Ruleta", name: "ruleta", link: "ruletapp", tint: "--pastel-peach", text: "Una roda amb els noms de la classe o amb 600 propostes de 30 temes. Sense repeticions i amb historial.", tags: ["Torns", "Dinàmiques", "Biblioteca"] },
        { dir: "Sorteig", name: "sorteig", link: "sorteigapp", tint: "--pastel-mint", text: "Paperets que surten d’un barret: tria’n uns quants o ordena tota la llista.", tags: ["Exposicions", "Càrrecs", "Temes"] },
        { dir: "Equips", name: "equips", link: "equipsapp", tint: "--pastel-blue", text: "Grups equilibrats a l’atzar, amb noms d’equip i rols cooperatius.", tags: ["Cooperatiu", "Parelles", "Tornejos"] },
        { dir: "Temps", name: "temps", link: "tempsapp", tint: "--pastel-sand", text: "Compte enrere amb anell de colors, cronòmetre amb marques i patata calenta amb durada secreta.", tags: ["Temps de treball", "Educació física", "Jocs"] },
      ],
    },
    {
      title: "Jocs i probabilitat",
      apps: [
        { dir: "Moneda", name: "moneda", link: "monedapp", tint: "--pastel-sand", text: "D’una a deu monedes, cara i creu personalitzables i la llei dels grans nombres en directe.", tags: ["Probabilitat", "Decisions"] },
        { dir: "Daus", name: "daus", link: "dausapp", tint: "--pastel-rose", text: "Fins a sis daus de 4 a 20 cares, amb suma o producte i la distribució dels resultats.", tags: ["Càlcul", "Estadística", "Jocs"] },
        { dir: "Cartes", name: "cartes", link: "cartesapp", tint: "--pastel-blue", text: "Baralla espanyola o francesa, amb reposició o sense, i les probabilitats de les que queden.", tags: ["Probabilitat", "Repartiment"] },
        { dir: "Nombres", name: "nombres", link: "nombresapp", tint: "--pastel-lilac", text: "Nombres en un interval, nombre secret, bombo amb tauler i veu, i lletres per a l’Stop.", tags: ["Bingo", "Llengua", "Matemàtiques"] },
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
      const card = document.createElement("a");
      card.className = "app-card";
      card.href = `${app.dir}/`;
      card.style.setProperty("--tint", `var(${app.tint})`);
      card.innerHTML = `<div class="card-top"><img src="${app.dir}/favicon.svg" alt="" width="76" height="76" /><span class="card-arrow" aria-hidden="true">→</span></div><h3>${app.name}<span>.</span></h3><p></p><div class="tags"></div><div class="short-link"><span>Enllaç curt: <code>ja.cat/${app.link}</code></span><button type="button" class="copy-link" aria-label="Copia l’enllaç ja.cat/${app.link}">Copia</button></div>`;
      card.querySelector("p").textContent = app.text;
      card.querySelector(".tags").append(
        ...app.tags.map((t) => {
          const span = document.createElement("span");
          span.textContent = t;
          return span;
        }),
      );
      card.querySelector(".copy-link").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        A.copyText(`https://ja.cat/${app.link}`);
      });
      cards.append(card);
    }
    section.append(h2, cards);
    host.append(section);
  }
  A.init();
})();
