# SynApp

Generador de grups cooperatius per a l'Escola Ramon Pont.

## Estat actual

Primera versió connectada al Google Sheets central:

- accés amb clau `SoL`;
- selector de classe;
- vista única compacta amb alumnat, condicions, equips i informe a la mateixa pantalla;
- capçalera amb icona pròpia i `favicon.svg`;
- taula d'alumnat amb tipologies A/B/C;
- alumnat ordenat per cognoms, tot i mostrar-se com a `Nom Cognoms`;
- botó `Actiu/Inactiu` per excloure temporalment alumnes dels grups;
- incompatibilitats;
- agrupaments forçats;
- condicions obligatòries i preferents;
- selector visual d'alumnes per crear condicions sense usar Ctrl;
- generació d'equips;
- informe de compliment;
- còpia, exportació CSV i impressió;
- backend d'Apps Script desplegat;
- càrrega de classes des del Google Sheets central.
- una pestanya visible per classe al Google Sheets.
- lectura automàtica de l'alumnat des de les pestanyes de classe.

## Com provar-la

Obre `index.html` amb el navegador i entra amb la clau:

```text
SoL
```

En aquesta fase les classes i l'alumnat ja es carreguen del Google Sheets central. Per afegir alumnat, cal escriure'l directament a la pestanya de la seva classe.

Columnes que cal omplir:

- `Nom`
- `Cognoms`

Columnes opcionals:

- `Tipologia`: `A`, `B` o `C`. Si queda buida, l'app interpreta `B`.
- `Actiu`: `sí` o `no`. Si queda buida, l'app interpreta `sí`. També es pot canviar des de l'app amb el botó verd/vermell; els alumnes inactius no entren en els grups.
- `Observacions`: camp intern per al centre.

## Publicació a GitHub Pages

Quan el repositori estigui a GitHub:

1. Ves a `Settings`.
2. Obre `Pages`.
3. Tria la branca principal.
4. Selecciona la carpeta arrel.
5. Desa la configuració.

## Connexió amb Google Sheets

La carpeta `apps-script/` conté la plantilla del backend.

Quan tinguem el Google Sheets central:

1. Crear o vincular el projecte Apps Script amb `clasp`.
2. Configurar la propietat `SYNAPP_SPREADSHEET_ID`.
3. Pujar el codi amb `clasp push`.
4. Executar `setupSpreadsheet()`.
5. Desplegar com a web app.
6. Posar la URL del desplegament a `APPS_SCRIPT_URL` dins `app.js`.

La URL operativa actual ja està configurada al frontend i el `bootstrap` retorna les classes del full central.

La comunicació amb Apps Script està preparada amb JSONP, perquè GitHub Pages i Apps Script són dominis diferents i així evitem els problemes habituals de CORS. Google documenta aquest patró per cridar serveis JSON des del navegador, però també avisa que cal anar amb cura amb JSONP. Per dades reals d'alumnat, la versió de producció hauria de restringir l'accés al domini escolar o reforçar l'autenticació.

## Notes de seguretat

La clau `SoL` és una protecció simple. Serveix com a primera barrera d'ús intern, però no equival a autenticació forta. La validació important s'haurà de fer a Apps Script.
