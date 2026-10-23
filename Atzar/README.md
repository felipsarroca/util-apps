# Atzar a l’aula

**Que la sort reparteixi el joc.** Vuit eines per triar, repartir, jugar i mesurar el temps. En català, sense anuncis ni registre, i pensades per projectar.

[**Obre Atzar a l’aula →**](https://ja.cat/atzar) · [Accés directe](https://felipsarroca.github.io/util-apps/Atzar/)

## Les apps

| App | Enllaç | Què fa | A l’aula |
| --- | --- | --- | --- |
| [Ruleta](Ruleta/) | [ja.cat/ruletapp](https://ja.cat/ruletapp) | Roda de noms o de 600 propostes en 30 temes, sense repeticions | Torns, dinàmiques de conversa i creativitat |
| [Sorteig](Sorteig/) | [ja.cat/sorteigapp](https://ja.cat/sorteigapp) | Paperets d’un barret: triar-ne uns quants o ordenar tota la llista | Ordre d’exposicions, càrrecs, temes de treball |
| [Equips](Equips/) | [ja.cat/equipsapp](https://ja.cat/equipsapp) | Grups equilibrats, amb noms d’equip i rols cooperatius | Equips de base, parelles, trencaclosques |
| [Temps](Temps/) | [ja.cat/tempsapp](https://ja.cat/tempsapp) | Compte enrere amb anell, cronòmetre amb marques i patata calenta | Temps de treball, educació física, jocs de repàs |
| [Moneda](Moneda/) | [ja.cat/monedapp](https://ja.cat/monedapp) | D’1 a 10 monedes, etiquetes de cara i creu, simulacions i estadística | Llei dels grans nombres, fal·làcia del jugador |
| [Daus](Daus/) | [ja.cat/dausapp](https://ja.cat/dausapp) | D’1 a 6 daus D4–D20, suma o producte, distribució teòrica i observada | Per què surt tant el 7?, càlcul mental, coordenades |
| [Cartes](Cartes/) | [ja.cat/cartesapp](https://ja.cat/cartesapp) | Baralla espanyola (40/48) o francesa (52/54), amb reposició o sense | Probabilitat condicionada, joc del 24 |
| [Nombres](Nombres/) | [ja.cat/nombresapp](https://ja.cat/nombresapp) | Nombres en un interval, nombre secret, bombo amb tauler i veu, lletres | Bingo de càlcul, nombres en català, l’Stop |

Cada app inclou un apartat **Idees per a l’aula** amb propostes concretes. No n’hi ha cap de forçada: només s’hi recullen els usos que encaixen de manera natural amb l’eina.

## Elements comuns

- **Mode aula**: amaga el panell, demana pantalla completa i amplia l’objecte principal.
- **Tema clar o fosc** i **so** compartits entre totes les apps (excepte la Ruleta, que conserva els seus ajustos).
- **Barra d’espai** per a l’acció principal; **Esc** per sortir del mode aula.
- **Historial** exportable en CSV i, quan té sentit, botó per copiar el resultat.
- **Classes compartides**: les classes desades a la Ruleta apareixen també a Sorteig i Equips (només lectura); les que es desen des d’aquestes dues apps són comunes a totes dues.
- Botó **⊞** a la capçalera per tornar al menú.

## Com funciona l’atzar

Totes les apps fan servir `crypto.getRandomValues` amb mostreig per rebuig, que evita el biaix del mòdul. **El resultat es tria abans de l’animació**: la durada o la trajectòria no influeixen en el que surt. Les ordenacions completes són permutacions de Fisher-Yates. A Moneda i Daus, les simulacions ràpides fan servir el mateix generador.

## Privacitat i ús sense connexió

Les llistes, els ajustos i els historials es desen només al navegador del dispositiu (`localStorage`). No hi ha comptes, anuncis ni peticions a servidors externs. Per fer-les servir sense connexió, descarrega **tota la carpeta `Atzar`** i obre `index.html`: les apps comparteixen la carpeta `shared/`.

## Estructura

```text
Atzar/
├── index.html, style.css, script.js, favicon.svg   # Menú
├── shared/          # atzar.css i atzar.js: estils, atzar, so, tema, mode aula, gràfics
├── Ruleta/          # App autònoma amb biblioteca i proves pròpies
├── Sorteig/  Equips/  Temps/
├── Moneda/   Daus/    Cartes/  Nombres/
└── tests/smoke.cjs  # Prova de fum de totes les apps
```

L’antiga adreça `util-apps/Ruleta/` redirigeix a `Atzar/Ruleta/`.

## Proves

```sh
npm ci
npm test                 # totes les apps: errors, acció principal i amplada en 3 mides
SHOTS=captures npm test  # desa captures de cada app (escriptori, mòbil, 320 px i tema fosc)
```

La Ruleta manté la seva bateria completa a `Ruleta/tests`.

## Autoria i llicència

Aplicacions creades per **Felip Sarroca** amb assistència de la IA. [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ca).
