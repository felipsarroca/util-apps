# Apps Script de SynApp

Aquesta carpeta conté la plantilla inicial del backend de SynApp per connectar GitHub Pages amb un Google Sheets central de l'Escola Ramon Pont.

## Estat actual

El projecte ja està vinculat localment amb `clasp` i desplegat com a web app. La propietat privada `SYNAPP_SPREADSHEET_ID` ja apunta al Google Sheets central.

## Passos fets

1. Google Sheets central creat.
2. Projecte Apps Script creat amb `clasp`.
3. Fitxers `Code.gs` i `appsscript.json` pujats amb `clasp push --force`.
4. Web app desplegada.
5. Propietat `SYNAPP_SPREADSHEET_ID` configurada.
6. `bootstrap` verificat.

## Passos següents

1. Afegir alumnat real a la pestanya `Alumnes`.
2. Afegir tipologies inicials a `Tipologies`, si ja es coneixen.
3. Afegir condicions inicials a `Condicions`, si cal.
4. Provar generació real des del frontend.

## Accions previstes

- `bootstrap`: retorna classes, alumnes, tipologies i condicions.
- `saveTeams`: desa una generació d'equips.
- `saveStudentType`: desa un canvi de tipologia.

El frontend fa servir JSONP perquè GitHub Pages i Apps Script viuen en dominis diferents. Això evita els problemes habituals de CORS amb `fetch` i manté l'app estàtica publicable a GitHub Pages.

Important: JSONP no ha de ser l'única protecció quan hi hagi dades reals d'alumnat. En producció caldria restringir el desplegament al domini escolar si és possible o reforçar l'autenticació.

La clau `SoL` hi és com a protecció inicial. En una fase posterior convindrà substituir-la o reforçar-la.
