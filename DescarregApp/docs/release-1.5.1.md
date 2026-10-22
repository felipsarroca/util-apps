# DescarregApp 1.5.1

La interfície s'adapta automàticament a l'espai útil de la finestra. En portàtils de 1366 × 760/768 es redueix proporcionalment per conservar les dues columnes i mantenir visibles els controls i el peu.

- L'ajust es recalcula en obrir, redimensionar i canviar de monitor, tenint en compte l'escalat del sistema.
- Es respecta el zoom manual. **Visualització → Ajusta automàticament a la finestra** recupera l'ajust automàtic.
- En finestres molt petites es limita la reducció i es permet el desplaçament vertical.
- Inclou el motor yt-dlp 2026.10.21 de la versió 1.5.0.

## Instal·lació

Des de DescarregApp 1.4.0 o posterior: **Actualitza → Comprova si hi ha actualitzacions**, **Descarregar i instal·lar** i **Instal·lar ara**. També es pot descarregar i executar `DescarregApp-Setup.exe` adjunt a aquesta publicació.

## Verificació

- Proves de disposició amb Electron real en pantalla gran, portàtil, espai equivalent a escalat del 125 %, pantalla vertical i finestra petita. Comprovat també el retorn a pantalla gran i el respecte del zoom manual.
- Revisió visual de captures: sense retalls en els casos de pantalla gran i portàtil verificats.
- Vuit proves de l'actualitzador i dels reintents de descàrrega superades.
- Construcció de Windows completada amb Electron 41.2.1 i comprovació de les eines incloses. Versió de l'executable: 1.5.1.

Etiqueta: `descarregapp-v1.5.1`. Instal·lador: `DescarregApp-Setup.exe`.
