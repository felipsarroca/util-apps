# Diagnòstic dels errors 403 de YouTube

Data: 23 de setembre de 2026.

## Causa comprovada

La instal·lació local de DescarregApp 1.2.0 incloïa `yt-dlp 2026.07.04`, Deno 2.9.3 i FFmpeg N-125551. Deno era reconegut correctament; no faltava el motor JavaScript.

Amb l'enllaç `https://www.youtube.com/watch?v=SSqgaFE9igo&list=PLh75eCNeCP7oI6kFkcjlGH6tRJKLO4wcQ` i la selecció de formats de l'app (`bv*+ba/b`, ordenació `res,fps,br`), el motor antic seleccionava `137+251` i fallava amb `HTTP Error 403: Forbidden` en descarregar el vídeo.

Amb `yt-dlp 2026.08.19`, mantenint Deno, FFmpeg i els mateixos criteris de selecció, la descàrrega completa de vídeo i àudio va funcionar: `270+251`, fusionats en MP4. També es va completar l'extracció a MP3 de 320 kbps. FFmpeg va descodificar els dos fitxers finals sense errors.

El motor antic feia servir el client `android_vr`; el nou fa servir `visionos` en aquesta prova. La release oficial incorpora precisament manteniment dels clients de YouTube, l'addició de `visionos` i la retirada d'`android_vr` dels clients predeterminats:

https://github.com/yt-dlp/yt-dlp/releases/tag/2026.08.19

El paràmetre `list=` no és la causa: `--no-playlist` ja limitava la descàrrega al vídeo indicat.

## Correcció

La versió 1.3.0 inclou el motor nou. La versió i la suma SHA-256 oficial es fixen a `scripts/tool-versions.json`; l'script de descàrrega verifica aquesta suma i `npm run build:win` rebutja un motor diferent. Les invocacions afegeixen `--ignore-config` per evitar interferències d'una configuració externa.

## Abast

La prova de la interfície empaquetada va detectar un 403 intermitent també amb el motor nou; el següent intent va completar la mateixa descàrrega. Per això la correcció incorpora un únic reintent amb una extracció nova dels enllaços. Quatre proves automatitzades (`node --test scripts/test-download-retry.js`) cobreixen recuperació, error persistent, altres errors i cancel·lació.

La prova final de DescarregApp 1.3.0 empaquetada, amb un perfil de prova independent, va afegir l'enllaç des de la interfície i va acabar amb un element completat, zero errors i un MP4 de 1080p amb àudio. No es va modificar la instal·lació 1.2.0 de l'usuari ni es va publicar cap release.

Les proves confirmen aquest cas concret; no garanteixen tots els vídeos de YouTube. Els vídeos restringits i els bloquejos temporals del servidor poden tenir altres causes. El motor es distribueix amb l'app i encara requereix una nova versió de DescarregApp per actualitzar-se als equips dels usuaris.
