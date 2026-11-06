# AvaluApp

AvaluApp és una aplicació web per analitzar les qualificacions d'un grup a
partir d'un fitxer Excel amb dades de la primera, la segona i/o la tercera
avaluació.

Està pensada per a dos moments de la feina del tutor o tutora:

1. **Preparar la junta d'avaluació**: graella de notes amb indicadors de
   seguiment, resum automàtic per a l'acta, anotació d'acords i exportació de
   l'acta (PDF) i de la graella (Excel).
2. **Informar l'alumnat i les famílies**: un informe A4 per alumne, en
   llenguatge planer, amb el nivell d'assoliment, la tendència, els punts
   forts, el que cal reforçar i un missatge personal del tutor o tutora.

Tot el processament es fa localment al navegador.

## Flux de treball recomanat

1. Carrega l'Excel (o prova l'app amb **dades d'exemple**).
2. **Grup**: revisa la visió global i els nivells d'assoliment per matèria.
3. **Junta**: filtra l'alumnat que necessita seguiment, copia el resum per a
   l'acta i anota els acords de cada alumne.
4. **Alumnat**: recorre les fitxes amb les fletxes ← → del teclat i escriu el
   missatge per a cada família.
5. **Descàrregues**: baixa l'acta, la graella en Excel i els informes per a les
   famílies.

## Funcionalitats

### Anàlisi del grup

- Mitjana general del grup.
- Mitjanes i suspensos per matèria.
- Nombre d'alumnes sense cap suspens.
- Evolució de les mitjanes entre avaluacions.
- Comparació de dues o tres avaluacions seleccionades.
- Canvis individuals respecte de l'avaluació anterior seleccionada.
- Gràfiques generals equivalents als informes de referència.

### Junta d'avaluació

- Graella alumnat × matèries amb colors per nivell (NA, AS, AN, AE) i fletxes
  quan una matèria puja o baixa de nivell respecte de l'avaluació anterior.
- Mitjana, variació i nombre de suspensos de cada alumne; mitjana i suspensos
  de cada matèria al peu.
- Indicadors automàtics: 3 o més suspensos, suspensos repetits, nous
  suspensos, baixada o millora de la mitjana (±0,25), matèries recuperades,
  rendiment excel·lent (sense suspensos i mitjana d'AE, ≥ 3,8) i notes pendents.
- Filtres (necessiten seguiment, milloren, excel·lents, sense suspensos),
  cerca i ordenació.
- Resum en text per a l'acta, amb botó per copiar-lo.
- Camp d'acords per alumne. Fent clic en un nom s'obre la seva fitxa.

### Anàlisi individual

- Navegació entre alumnes amb botons o amb les fletxes del teclat.
- Indicadors de seguiment de l'alumne.
- Acords de la junta (interns) i missatge per a la família.

- Selector d'alumne i d'avaluacions.
- Mitjana, suspensos i variació respecte de l'avaluació anterior.
- Resultats de l'alumne comparats amb la mitjana del grup.
- Gràfic radar de les matèries.
- Evolució global entre avaluacions.
- Evolució específica de cada matèria.
- Detall de totes les qualificacions disponibles.

### Informe per a la família

Una pàgina A4 per alumne amb:

- Capçalera amb el centre, el grup, el curs i l'avaluació.
- Mitjana i resum en llenguatge planer.
- Qualificació i nivell d'assoliment de cada matèria a totes les avaluacions
  fins a la seleccionada, tendència i (opcionalment) mitjana del grup.
- Punts forts i matèries que cal reforçar.
- Gràfic d'evolució (o perfil per matèries si només hi ha una avaluació).
- Missatge del tutor o tutora (o línies en blanc per escriure-hi a mà).
- Llegenda dels nivells i, opcionalment, espai per a signatures.

No hi apareix cap dada d'altres alumnes. Les dades de capçalera (centre, grup,
tutor/a i curs) es recorden al navegador; els noms i les notes, no.

### Descàrregues

- Acta de la junta (PDF apaïsat: graella, indicadors, resum i acords).
- Graella de la junta (Excel amb tres pestanyes: alumnat, matèries i resum).
- Informe gràfic del grup (PDF).
- Informes per a les famílies: de tot el grup o d'un sol alumne (PDF).
- Gràfiques del grup en PNG, inclosa la distribució per nivells d'assoliment.
- Dossiers de radars i d'evolució, amb una pàgina per alumne.

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

S'utilitza el primer full del llibre que tingui una columna `Alumne`. Des de
l'ajuda de la pantalla inicial es pot baixar una plantilla.

El full ha de contenir:

- Una columna titulada exactament `Alumne`.
- Una columna amb l'avaluació (`1a`, `2a` o `3a`). Si es titula `Avaluació`
  pot estar a qualsevol lloc; si no, ha d'estar just a la dreta d'`Alumne`.
- Una columna per cada matèria.

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

- Nivells d'assoliment: NA (menys de 1,96), AS (de 1,96 a 2,95), AN (de 2,96
  a 3,79) i AE (de 3,8 a 4).
- Una qualificació inferior a `1,96` (NA) es considera suspesa.
- Les comparacions de la junta i dels informes per a les famílies es fan amb
  l'avaluació immediatament anterior disponible.
- Les mitjanes només inclouen les cel·les amb una qualificació vàlida.
- Una avaluació només apareix als selectors si conté dades.
- Les comparatives utilitzen exclusivament les avaluacions seleccionades.
- Si es repeteix una fila del mateix alumne i avaluació, preval l'última.

## Privacitat

AvaluApp funciona íntegrament al navegador:

- L'Excel no s'envia a cap servidor.
- No s'emmagatzemen noms ni qualificacions.
- Els acords i els missatges només es mantenen mentre la pestanya és oberta;
  l'app avisa abans de tancar-la. Per conservar-los, baixa la graella en
  Excel.
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

## Adaptació a la pantalla

En ordinadors amb ratolí la interfície s'escala uniformement (fins al 75 %)
quan l'espai útil és inferior a 1440 × 800 px, com a edu-apps/Equacions, de
manera que un portàtil de 1366 × 768 (també amb escalat del 125 % o 150 %)
manté la disposició d'escriptori. En mòbils, tauletes i finestres de menys de
1000 px s'aplica la disposició responsiva. Les exportacions no depenen de
l'escala de la pantalla.

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
│   ├── App.css / features.css
│   ├── App.tsx          (navegació, vistes de grup i d'alumne, descàrregues)
│   ├── JuntaView.tsx    (graella de la junta i acta en PDF)
│   ├── FamilyReport.tsx (informe A4 per a la família)
│   ├── charts.tsx       (gràfiques)
│   ├── icons.tsx
│   ├── data.ts          (lectura de l'Excel, càlculs i indicadors)
│   ├── junta.ts         (exportació a Excel)
│   ├── settings.ts      (anotacions i dades de l'informe)
│   ├── export.ts        (PNG, PDF i XLSX)
│   └── main.tsx
├── index.html
├── package.json
└── vite.config.ts
```

## Limitacions actuals

- Només es llegeix un full del llibre Excel.
- Els acords i missatges no es poden tornar a carregar des de l'Excel exportat.
- L'escala de qualificacions és de 0 a 4.
- S'admeten com a màxim tres avaluacions.
- La qualitat i l'estructura dels informes depenen que els noms de les
  matèries siguin breus i entenedors.

## Autoria i llicència

Aplicació creada per [Felip Sarroca](https://ja.cat/felipsarroca) amb
assistència de la IA.

Obra publicada sota la llicència
[Creative Commons BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ca).
