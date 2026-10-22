# DescarregApp 1.5.0

Data de verificació: 22 d'octubre de 2026.

## Canvi

Actualització del motor inclòs de `yt-dlp 2026.08.19` a `2026.10.21`. Aquesta versió incorpora correccions de compatibilitat i de seguretat dels executables, segons les [notes oficials](https://github.com/yt-dlp/yt-dlp/releases/tag/2026.10.21).

L'executable s'ha descarregat directament de la release oficial, sense utilitzar l'autoactualitzador de l'antic motor. La suma del fitxer descarregat i del binari empaquetat coincideix amb `SHA2-256SUMS` i amb el digest publicat a l'API de GitHub:

```text
33121d192d706e62f684a06f80918e3f3a8ba52ac3a65213b6951c39c7d9f555
```

Es mantenen Deno 2.9.3, FFmpeg N-125551-ga09be9b91e-20260712 i Electron 41.2.1. La versió de l'aplicació passa a 1.5.0 perquè l'actualitzador distribueixi el nou motor amb l'instal·lador complet.

## Verificacions

- `npm run tools:check`: versió i SHA-256 correctes; les tres eines s'executen.
- `node --test scripts/test-download-retry.js scripts/test-update-check.js`: 8 proves superades. S'ha afegit `AbortSignal` al context simulat de les proves, necessari per comprovar l'actualitzador actual.
- `npm run tools:health`: les quatre descàrregues breus passen (MP4 i MP3 de YouTube i 3Cat).
- Aplicació empaquetada: versió 1.5.0 als recursos de Windows i a Electron; les eines incloses estan disponibles.
- Descàrrega completa des de la interfície empaquetada de `https://www.youtube.com/watch?v=SSqgaFE9igo`: MP4 de 1920 × 1080 amb àudio, 55.774.999 bytes, un element completat i zero errors. Revisió visual de l'estat final i cap error JavaScript detectat.
- FFmpeg descodifica el fitxer MP4 complet sense errors.

La prova de la interfície utilitza un perfil i una carpeta de descàrregues temporals independents. Les proves de fonts cobreixen els exemples indicats, no tots els continguts dels serveis.

## Construcció i distribució

Les dependències locals de la còpia de Google Drive eren incompletes. La construcció s'ha fet des d'una còpia temporal local del projecte amb `npm ci` i `npm run build:win -- --publish never`, conservant el fitxer de bloqueig de dependències.

Etiqueta de publicació: `descarregapp-v1.5.0`. Fitxer: `DescarregApp-Setup.exe`. El workflow existent replica l'instal·lador a `descarregapp-latest`, que és la destinació de l'enllaç públic `https://ja.cat/descarregapp`.
