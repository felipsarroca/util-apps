Analitzador de tiquets Bonpreu
==============================

Aplicació web (sense servidor) per gestionar i analitzar tiquets del supermercat Bonpreu a partir d’imatges JPG. Fa OCR al navegador, classifica productes en categories, suma despeses i exporta a CSV. Les dades es guarden localment a `localStorage`.

Funcionalitats
--------------

- Càrrega de tiquets: arrossega un o diversos JPG o selecciona’ls des del diàleg.
- OCR al navegador: preprocessat bàsic (escala i blanc-i-negre) i lectura amb Tesseract.js (ca, es, en).
- Extracció de dades: data del tiquet i línies “nom … preu”. Duplicats consolidades per clau normalitzada.
- Classificació en 4 categories: menjar, higiene personal, neteja de la llar, altres.
- Aprenentatge automàtic: si canvies la categoria d’un producte, queda guardada i s’aplica a:
  - totes les aparicions existents del mateix producte, i
  - les futures compres amb el mateix nom (normalitzat).
- Ordenació: els tiquets es mostren en ordre invers (els més recents a dalt). Si hi ha la mateixa data, es prioritza l’últim processat.
- Resum per tiquet: sumes per categoria i total del tiquet.
- Exportació: descarrega totes les línies a CSV (`data;fitxer;nom;preu;categoria`).
- Indicador de progrés: barra i percentatge durant l’OCR; canvia de color segons fase.
- Dades locals: es pot netejar tot amb el botó “neteja dades guardades”.

Com s’utilitza
--------------

1. Obre `index.html` amb Chrome/Edge (recomanat).
2. Arrossega JPG de tiquets a la zona o fes clic per seleccionar.
3. Espera l’OCR: veuràs el progrés. En acabar, apareixerà el tiquet amb els ítems i el resum.
4. Si cal, ajusta categories amb el selector; els canvis s’apliquen a totes les aparicions equivalents i es recorden per al futur.
5. Opcional: exporta a CSV o neteja dades.

Execució local (recomanat)
--------------------------

Alguns navegadors limiten els Web Workers/WASM si obres directament el fitxer (`file://`). Si tens cap problema de càrrega de l’OCR, serveix la carpeta amb un servidor local i obre la URL http:

- Python 3: `python -m http.server 5500` i obre `http://localhost:5500`
- Node: `npx serve -l 5500` i obre `http://localhost:5500`

Persistència i privacitat
-------------------------

- Tot el processament es fa al navegador; no s’envien imatges ni dades a cap servidor propi.
- L’aplicació descarrega, quan cal, els binaris de Tesseract (script/wasm) des d’un CDN (connexió a Internet necessària la primera vegada).
- Les dades (tiquets i mapa de productes→categoria) es guarden a `localStorage` del navegador.

Classificació i aprenentatge
----------------------------

- Regles inicials per paraules clau (heurística) i clau normalitzada del nom per aprenentatge.
- En canviar la categoria d’un ítem:
  - es desa al mapa d’aprenentatge (`productMap`), i
  - s’actualitzen totes les línies del mateix producte ja guardades.
- No hi ha suggeriments automàtics de canvi: el canvi és directe i s’aplica globalment.

Indicador de progrés d’OCR
--------------------------

- Barra i percentatge visibles mentre dura l’OCR.
- Colors per fase (càrrega, reconeixement, finalitzat).
- En alguns navegadors el percentatge és estimat per evitar limitacions tècniques amb el Worker; la barra segueix indicant activitat i finalització.

Resolució de problemes
----------------------

- “Failed to execute 'importScripts' on 'Worker' … wasm … failed to load” o l’OCR no arrenca:
  - Fes “hard reload” (Ctrl+F5) o obre via servidor local (vegeu “Execució local”).
  - Comprova la connexió a Internet (cal per baixar Tesseract la primera vegada).
- La barra es mou però no apareix cap tiquet:
  - Revisa la consola (F12) i comprova errors de càrrega.
  - Torna a provar amb servidor local.
- Noms estranys o decimals incorrectes:
  - Assegura bona qualitat de la foto (enfocada, plana, contrast).
  - Pots editar la categoria; el sistema ho recordarà.

Tecnologies
-----------

- Tesseract.js 5 (OCR, ca+es+en)
- HTML/CSS/JS sense frameworks
- Emmagatzematge local (`localStorage`)

Estructura
----------

- `index.html`: interfície i inclusió de Tesseract.js
- `styles.css`: estil i colors (inclou barra de progrés)
- `script.js`: lògica (OCR, parseig, classificació, aprenentatge, render, exportació)
- `favicon.svg`: icona de l’aplicació
