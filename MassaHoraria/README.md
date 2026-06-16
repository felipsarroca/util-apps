# Massa horària

Aplicació de gestió de la massa horària de l'Escola Ramon Pont.

## Estructura

- `app/src`: projecte de Google Apps Script sincronitzat amb `clasp`.
- `tools/generate_seed.py`: genera les dades inicials a partir de l'Excel.
- `Massa Horària - Curs 2025-26.xlsx`: document d'origen.

## Flux de treball

```powershell
python tools/generate_seed.py
clasp status
clasp push
```

La base de dades de Google Sheets s'inicialitza una sola vegada des del menú
`Massa horària > Inicialitza la base de dades`.

## Prova local

```powershell
node tools/local_server.mjs
```

L'aplicació local utilitza una còpia de les dades a `.tmp/local-state.json`.

## Accés via GitHub Pages

La porta d'entrada estàtica és:

`https://felipsarroca.github.io/util-apps/MassaHoraria/`
