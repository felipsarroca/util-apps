# Analitzador de tiquets Bonpreu

App web per separar les despeses de cada compra en **menjar, neteja de la llar, higiene personal i altres**. Funciona al navegador i conserva els tiquets i les correccions al mateix navegador i adreça web.

## Ús

1. Arrossega imatges JPG, PNG o WebP, o selecciona-les amb el botó de càrrega.
2. El darrer tiquet importat queda actiu. Consulta els imports al resum i canvia les categories amb els selectors dels articles.
3. Obre **Altres tiquets** per seleccionar una compra anterior. L’historial es plega quan la selecciones.
4. **Exporta CSV** descarrega els articles de totes les compres.

El resum queda visible mentre recorres els articles. Al mòbil es presenta en format compacte. La categoria es modifica sense reconstruir la llista, per mantenir la posició i el focus.

## Lectura i classificació

- Retalla marges blancs, amplia la lletra petita i processa els píxels sense recompressió JPEG.
- Detecta imatges estretes amb fons blanc i hi aplica el reconeixedor clàssic de Tesseract, que ha llegit millor els preus de les dues mostres digitals. Per a altres imatges utilitza el reconeixedor habitual amb català, castellà i anglès.
- Reutilitza el motor OCR entre imatges consecutives del mateix tipus.
- Agrupa només noms complets equivalents i indica les repeticions amb ×2, ×3, etc. L’import agrupat és la suma de les aparicions.
- Identifica les capçaleres fiscals sense eliminar articles que continguin fragments com «iva» dins del nom.
- Classifica per paraules completes i prioritza expressions específiques d’higiene i neteja.
- Les correccions explícites tenen preferència. Les variants molt properes del nom també poden recuperar-les, sempre que no hi hagi categories en conflicte.
- Els noms ja desats aprofiten les regles noves en obrir l’app. Per tornar a llegir una imatge cal importar-la de nou; les agrupacions antigues no es poden reconstruir sense l’original.

No incorpora informes de desquadraments ni llistes de revisió. El total visible és la suma dels articles llegits; no es concilia amb el total imprès ni es reparteixen descomptes entre categories.

## Dades

Es mantenen les claus anteriors de `localStorage`, per conservar tiquets i categories apreses. **Esborra tots els tiquets** conserva l’aprenentatge. Les dades no se sincronitzen entre navegadors ni ordinadors. El CSV exporta articles, no és una còpia completa de la memòria de categories.

Les imatges es processen localment. Cal connexió per descarregar Tesseract.js i els seus models d’idioma. La lectura de lletra molt petita pot continuar tenint errors.

## Execució local

Des de la carpeta del projecte:

```sh
python -m http.server 5500
```

Obre `http://localhost:5500`. Utilitza la mateixa adreça i navegador per recuperar les dades desades.

## Comprovacions

```sh
node --test tests/receipts.test.cjs
node --check script.js
```

Les proves cobreixen confusions entre menjar, higiene i neteja; variants de noms apresos; agrupacions; lectura de preus; i representació segura dels noms.
