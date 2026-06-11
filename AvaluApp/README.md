# AvaluApp

AvaluApp és una aplicació web per analitzar les qualificacions d'un grup a
partir d'un fitxer Excel amb dades de la primera, la segona i/o la tercera
avaluació.

L'aplicació detecta automàticament l'alumnat, les matèries i les avaluacions,
genera indicadors i gràfiques, permet consultar cada alumne i ofereix
exportacions en PNG i PDF. Tot el processament es fa localment al navegador.

## Funcionalitats

### Anàlisi del grup

- Mitjana general del grup.
- Mitjanes i suspensos per matèria.
- Nombre d'alumnes sense cap suspens.
- Evolució de les mitjanes entre avaluacions.
- Comparació de dues o tres avaluacions seleccionades.
- Canvis individuals respecte de l'avaluació anterior seleccionada.
- Gràfiques generals equivalents als informes de referència.

### Anàlisi individual

- Selector d'alumne i d'avaluacions.
- Mitjana, suspensos i variació respecte de l'avaluació anterior.
- Resultats de l'alumne comparats amb la mitjana del grup.
- Gràfic radar de les matèries.
- Evolució global entre avaluacions.
- Evolució específica de cada matèria.
- Detall de totes les qualificacions disponibles.

### Descàrregues

El centre de descàrregues permet generar:

1. Resum general del grup.
2. Mitjanes per matèria.
3. Suspensos per matèria.
4. Mitjanes individuals.
5. Suspensos individuals.
6. Comparativa entre avaluacions.
7. Informe complet del grup.
8. Dossier de radars, amb una pàgina per alumne.
9. Dossier d'evolució, amb una pàgina per alumne.

Cada gràfic també es pot descarregar individualment en format PNG. Les vistes
de grup i d'alumne es poden exportar en PDF.

## Preparació del fitxer Excel

Des de la pantalla inicial es pot obrir el botó **Com ha de ser el fitxer?**,
que mostra aquestes instruccions dins de l'aplicació:

1. Descarrega l'Excel de notes de Clickedu.
2. Elimina les files i les columnes innecessàries. Deixa només les que
   contenen l'alumnat i les matèries.
3. Canvia les abreviatures per noms clars. Per exemple, `CL` per
   `Comp. Lectora`.
4. Anonimitza els noms abans de carregar el fitxer. Per exemple,
   `Pedrosa, Jaume` per `Jaume P.`.

S'admeten fitxers `.xlsx` i `.xls`.

## Estructura esperada

El full ha de contenir:

- Una columna titulada exactament `Alumne`.
- Just a la dreta, una columna amb l'avaluació: `1a`, `2a` o `3a`.
- A continuació, una columna per cada matèria.

Exemple:

| Alumne | Avaluació | Català | Matemàtiques | Anglès |
| --- | --- | ---: | ---: | ---: |
| Jaume P. | 1a | 2,3 | 3.1 | 2,8 |
|  | 2a | 2,8 | 3.4 | 3,0 |
| Laia M. | 1a | 3,2 | 2.7 | 3,5 |

El nom de l'alumne pot aparèixer només a la primera fila del seu bloc.
AvaluApp manté aquest nom per a les files següents fins que en troba un de nou.

### Format de les qualificacions

- S'accepten nombres reals d'Excel.
- S'accepten decimals escrits amb coma, com `2,3`.
- S'accepten decimals escrits amb punt, com `2.3`.
- Les cel·les buides s'ignoren i no compten com a zero.
- Les qualificacions vàlides han d'estar entre `0` i `4`.
- Els valors fora d'aquest interval s'ignoren i generen un avís.

## Criteris de càlcul

- Una qualificació inferior a `2` es considera suspesa.
- Les mitjanes només inclouen les cel·les amb una qualificació vàlida.
- Una avaluació només apareix als selectors si conté dades.
- Les comparatives utilitzen exclusivament les avaluacions seleccionades.
- Si es repeteix una fila del mateix alumne i avaluació, preval l'última.

## Privacitat

AvaluApp funciona íntegrament al navegador:

- L'Excel no s'envia a cap servidor.
- No s'emmagatzemen noms ni qualificacions.
- No hi ha base de dades ni sistema d'usuaris.
- Els hipervincles i identificadors interns de l'Excel s'ignoren.

Tot i això, es recomana anonimitzar sempre l'alumnat abans de carregar el
fitxer, especialment si l'aplicació s'utilitza en un ordinador compartit.

## Tecnologies

- React 19
- TypeScript
- Vite
- SheetJS (`xlsx`) per llegir els fitxers Excel
- `html2canvas` per generar imatges
- `jsPDF` per crear els documents PDF
- CSS propi, sense cap biblioteca visual externa

## Desenvolupament local

Cal tenir instal·lat Node.js.

```bash
npm install
npm run dev
```

Vite mostrarà l'adreça local de l'aplicació, habitualment
`http://localhost:5173`.

### Comprovacions

```bash
npm run lint
npm run build
npm run preview
```

La versió compilada es genera a la carpeta `dist`.

## Publicació a GitHub Pages

AvaluApp forma part del repositori `util-apps`. El flux automàtic
`../.github/workflows/deploy-pages.yml` compila l'aplicació i la publica
juntament amb el portal principal quan es fa un `push` a la branca `main`.

L'adreça pública és:
`https://felipsarroca.github.io/util-apps/AvaluApp/`.

L'aplicació és estàtica i no necessita cap servidor propi. Pot publicar-se a
GitHub Pages i utilitzar-se des de qualsevol navegador modern.

## Estructura principal del projecte

```text
AvaluApp/
├── public/
├── src/
│   ├── assets/
│   ├── App.css
│   ├── App.tsx
│   ├── data.ts
│   ├── export.ts
│   └── main.tsx
├── index.html
├── package.json
└── vite.config.ts
```

## Limitacions actuals

- Només es llegeix el primer full del llibre Excel.
- La columna d'avaluació ha d'estar immediatament a la dreta d'`Alumne`.
- L'escala de qualificacions és de 0 a 4.
- S'admeten com a màxim tres avaluacions.
- La qualitat i l'estructura dels informes depenen que els noms de les
  matèries siguin breus i entenedors.

## Autoria i llicència

Aplicació creada per [Felip Sarroca](https://ja.cat/felipsarroca) amb
assistència de la IA.

Obra publicada sota la llicència
[Creative Commons BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ca).
