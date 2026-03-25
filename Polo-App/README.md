# Registre de polo ESO

Aplicació web pensada per usar-se des del mòbil per registrar ràpidament quin alumnat de l'ESO no porta el polo i consultar resums bàsics.

## Què fa

- Permet triar un curs i carregar-ne l'alumnat.
- Permet marcar un alumne com a incidència del dia.
- Evita duplicats el mateix dia.
- Mostra consultes resum per curs, alumne, dia i vista general.
- Es pot instal·lar al mòbil com si fos una app quan està publicada en `https`.

## Estructura del projecte

- `index.html`: interfície principal.
- `css/styles.css`: estils mobile-first.
- `js/app.js`: lògica del frontend, consultes al backend i gestió de la instal·lació PWA.
- `manifest.webmanifest`: configuració perquè el navegador la pugui instal·lar com a app.
- `service-worker.js`: memòria cau bàsica per fer-la instal·lable i més robusta.
- `assets/icon-192.png`: icona principal i icona PWA de 192 px.
- `assets/icon-512.png`: icona PWA de 512 px.
- `Code.gs`: backend de Google Apps Script.

## Backend

El backend està fet amb Google Apps Script i treballa sobre un Google Sheets amb dues pestanyes:

- `Alumnat`
- `Registres`

Funcions principals del backend:

- obtenir alumnat per curs
- registrar un alumne
- evitar duplicats el mateix dia
- generar resums per a les consultes

## Instal·lació com a app al mòbil

Perquè el navegador mostri la instal·lació com a app, calen aquestes condicions:

1. Publicar el frontend en una URL `https`.
2. Servir correctament `index.html`, `manifest.webmanifest` i `service-worker.js`.
3. Obrir la web des del mòbil una vegada perquè el navegador detecti que és instal·lable.

Com es comporta ara:

- A Android, si el navegador admet `beforeinstallprompt`, apareix un avís amb el botó d'instal·lació.
- A iPhone o iPad, es mostra un avís amb els passos per fer `Compartir > Afegeix a la pantalla d'inici`, perquè Safari no obre un prompt automàtic equivalent.

## Desplegament recomanat

L'opció més pràctica és publicar el frontend amb GitHub Pages:

1. Puja aquest repositori a GitHub.
2. Activa GitHub Pages des de la branca principal.
3. Comprova que la web es carrega amb `https`.
4. Obre-la des del mòbil i instal·la-la.

## Flux actual

1. Seleccionar curs.
2. Carregar alumnat.
3. Marcar un alumne.
4. Evitar duplicats del mateix dia.
5. Consultar resums.
