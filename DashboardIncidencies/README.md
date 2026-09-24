# Dashboard d'incidències

Aplicació estàtica per analitzar la pestanya **Buidat** d'un Google Sheets de l'Escola Ramon Pont. Publicació: https://felipsarroca.github.io/util-apps/DashboardIncidencies/

## Ús

Enganxa un enllaç normal del full de càlcul, com ara `https://docs.google.com/spreadsheets/d/ID/edit?gid=123`. La pestanya que tingui oberta l'enllaç és indiferent: l'aplicació llegeix **Buidat**. El full ha de ser accessible sense iniciar sessió (per exemple, «Qualsevol persona amb l'enllaç» amb permís de lector). L'enllaç es desa al navegador per a la sessió següent; les files no es desen ni s'envien a cap servidor de l'app.

La pestanya ha d'incloure les capçaleres `Alumne`, `Curs`, `Tipus` i `Quantitat`. Les files sense `Tipus` s'ignoren. Els tipus desconeguts o cursos no reconeguts es descarten amb un avís. Quan `Quantitat` és buida, `-` o no és numèrica, es compta com a 1 i es mostra un avís.

## Estructura

- `index.html`: estructura de la pàgina i peu corporatiu.
- `styles.css`: disseny i adaptació a pantalles petites.
- `src/data.js`: enllaços, lectura CSV, validació i normalització.
- `src/app.js`: estat, filtres, indicadors, gràfics, taules i exportació.
- `tests/data.test.js`: proves de lectura i tractament de dades.

No cal compilar ni instal·lar dependències. Per provar-la en local (cal Node.js), executa `npm run serve` i obre `http://localhost:4173`. Per executar les proves: `npm test`. GitHub Pages serveix aquests mateixos fitxers directament.
