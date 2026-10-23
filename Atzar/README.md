# Atzar a l’aula

**Que la sort reparteixi el joc.** Vuit eines per triar, repartir, jugar i mesurar el temps. En català, sense anuncis ni registre, i pensades per projectar.

[**Obre Atzar a l’aula →**](https://ja.cat/atzar) · [Accés directe](https://felipsarroca.github.io/util-apps/Atzar/)

## Les apps

| App | Enllaç | Què fa | A l’aula |
| --- | --- | --- | --- |
| [Ruleta](Ruleta/) | [ja.cat/ruletapp](https://ja.cat/ruletapp) | Roda de noms o de 600 propostes en 30 temes, sense repeticions | Torns, dinàmiques de conversa i creativitat |
| [Sorteig](Sorteig/) | [ja.cat/sorteigapp](https://ja.cat/sorteigapp) | Paperets d’un barret: triar-ne uns quants o ordenar tota la llista | Ordre d’exposicions, càrrecs, temes de treball |
| [Equips](Equips/) | [ja.cat/equipsapp](https://ja.cat/equipsapp) | Grups equilibrats amb condicions (junts o separats), nivells, edició a mà i rols cooperatius | Equips de base, parelles, trencaclosques |
| [Temps](Temps/) | [ja.cat/tempsapp](https://ja.cat/tempsapp) | Compte enrere amb anell, cronòmetre amb marques, patata calenta i fases encadenades | 1-2-4, debats, estacions, educació física |
| [Moneda](Moneda/) | [ja.cat/monedapp](https://ja.cat/monedapp) | D’1 a 10 monedes, ratxes, predicció abans de simular i repte «inventa’t 100 tirades» | Llei dels grans nombres, fal·làcia del jugador |
| [Daus](Daus/) | [ja.cat/dausapp](https://ja.cat/dausapp) | D’1 a 6 daus D4–D20 o daus amb paraules, suma o producte, distribució teòrica i observada | Per què surt tant el 7?, càlcul mental, daus de conversa |
| [Cartes](Cartes/) | [ja.cat/cartesapp](https://ja.cat/cartesapp) | Baralla espanyola (40/48) o francesa (52/54), amb reposició o sense, i com canvia la probabilitat | Probabilitat condicionada, joc del 24 |
| [Nombres](Nombres/) | [ja.cat/nombresapp](https://ja.cat/nombresapp) | Nombres en un interval, nombre secret, bombo amb tauler i veu en 12 llengües, lletres, dígrafs i categories | Bingo de càlcul, nombres en diverses llengües, l’Stop |

Cada app inclou un apartat **Idees per a l’aula** amb propostes concretes. No n’hi ha cap de forçada: només s’hi recullen els usos que encaixen de manera natural amb l’eina.

## Elements comuns

- **Mode aula**: amaga el panell, demana pantalla completa i amplia l’objecte principal.
- **Tema clar o fosc** i **so** compartits entre totes les apps (excepte la Ruleta, que conserva els seus ajustos).
- **Barra d’espai** per a l’acció principal; **Esc** per sortir del mode aula.
- **Historial** exportable en CSV i, quan té sentit, botó per copiar el resultat.
- **Classes compartides**: les classes desades a la Ruleta apareixen també a Sorteig i Equips (només lectura); les que es desen des d’aquestes dues apps són comunes a totes dues.
- **Qui falta avui?**: les persones marcades com a absents queden fora de la Ruleta, el Sorteig i els Equips fins a mitjanit.
- **Desfés**: esborrar historials, estadístiques, marques o classes es pot desfer des de l’avís que apareix.
- Botó **⊞** a la capçalera per tornar al menú.

## Com funciona l’atzar

Totes les apps fan servir `crypto.getRandomValues` amb mostreig per rebuig, que evita el biaix del mòdul. **El resultat es tria abans de l’animació**: la durada o la trajectòria no influeixen en el que surt. Les ordenacions completes són permutacions de Fisher-Yates. A Moneda i Daus, les simulacions ràpides fan servir el mateix generador.

## Privacitat i ús sense connexió

Les llistes, els ajustos i els historials es desen només al navegador del dispositiu (`localStorage`). No hi ha comptes, anuncis ni peticions a servidors externs. Des del menú (**Les teves dades**) es pot exportar una còpia en JSON i importar-la en un altre ordinador; la importació es pot desfer.

Atzar a l’aula és una aplicació web instal·lable (PWA): un cop oberta, un *service worker* en desa una còpia i funciona sense connexió. També es pot descarregar tota la carpeta `Atzar` i obrir `index.html`.

## Estructura

```text
Atzar/
├── index.html, style.css, script.js, favicon.svg   # Menú
├── manifest.webmanifest, sw.js, icons/             # Instal·lació i ús sense connexió
├── shared/          # atzar.css i atzar.js: estils, atzar, so, tema, mode aula, gràfics
├── Ruleta/          # App autònoma amb biblioteca i proves pròpies
├── Sorteig/  Equips/  Temps/
├── Moneda/   Daus/    Cartes/  Nombres/
└── tests/          # smoke.cjs (totes les apps en 3 mides) i logic.cjs (atzar, condicions, fases…)
```

L’antiga adreça `util-apps/Ruleta/` redirigeix a `Atzar/Ruleta/`.

## Proves

```sh
npm ci
npm test                 # prova de fum en 3 mides i proves de lògica
SHOTS=captures npm test  # desa captures de cada app (escriptori, mòbil, 320 px i tema fosc)
```

La Ruleta manté la seva bateria completa a `Ruleta/tests`.

## Autoria i llicència

Aplicacions creades per **Felip Sarroca** amb assistència de la IA. [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ca).
