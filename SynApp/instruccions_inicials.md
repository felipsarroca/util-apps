# SynApp

**Subtítol:** Generador de grups cooperatius - Escola Ramon Pont

## 1. Objectiu de l'app

SynApp serà una aplicació interna de l'Escola Ramon Pont per generar grups cooperatius de manera ràpida, visual i pràctica. Ha de servir tant per al professorat que ja fa servir eines digitals com per al professorat que pensa que fer els grups manualment és més ràpid.

La idea central és que l'app permeti passar de "tinc la classe" a "tinc uns grups raonables i copiables" en menys d'un minut.

## 2. Àmbit d'ús

Per ara l'app es planteja només per a l'Escola Ramon Pont.

Decisions acordades:

- L'app es dirà **SynApp**.
- El subtítol serà **Generador de grups cooperatius - Escola Ramon Pont**.
- Hi haurà una clau d'accés inicial: `SoL`.
- Les dades de l'alumnat es guardaran en un únic Google Sheets central del centre.
- L'app estarà penjada a GitHub Pages perquè s'hi pugui accedir fàcilment des d'un navegador.

## 3. Advertiment sobre seguretat

La clau `SoL` és una barrera simple d'accés, però no és una mesura de seguretat forta si l'app està publicada a GitHub Pages. El codi JavaScript d'una app estàtica és visible per a qualsevol persona amb coneixements tècnics.

Per això, l'arquitectura recomanada és:

```text
GitHub Pages
    ↓
Google Apps Script
    ↓
Google Sheets central de l'Escola Ramon Pont
```

El Google Apps Script haurà de fer d'intermediari:

- validar la clau d'accés;
- llegir només les dades necessàries;
- escriure resultats al full;
- evitar exposar directament l'ID del Google Sheets al frontend;
- facilitar canvis futurs sense tocar tota l'app.

Si l'app es publica a GitHub Pages i es comunica amb Apps Script, cal tenir present els problemes de CORS. Una solució tècnica viable és JSONP, però amb dades reals d'alumnat no hauria de ser l'única protecció. La versió de producció hauria de restringir l'accés al domini escolar, si és possible, o reforçar l'autenticació més enllà de la clau simple `SoL`.

## 4. Estructura de dades proposada al Google Sheets

El Google Sheets central podria tenir aquestes pestanyes:

| Pestanya | Funció |
|---|---|
| `Classes` | Llista de grups disponibles |
| `Alumnes` | Dades bàsiques de l'alumnat |
| `Tipologies` | Assignació A/B/C per alumne i classe |
| `Condicions` | Incompatibilitats i agrupaments forçats |
| `Equips` | Històric dels equips generats |
| `Configuració` | Valors generals de l'app |

### 4.1. Pestanya `Classes`

| id_classe | nom_classe | etapa | curs | grup | activa |
|---|---|---|---|---|---|
| eso1a | 1r ESO A | ESO | 1r | A | sí |

### 4.2. Pestanyes de classe

El model pràctic del full és tenir una pestanya visible per cada classe. El professorat només ha d'omplir `Nom` i `Cognoms`.

Exemple de pestanya `4t. ESO`:

| Nom | Cognoms | Tipologia | Actiu | Observacions |
|---|---|---|---|---|
| Laia | Garcia |  | sí |  |

La columna `Tipologia` és opcional. Si queda buida, SynApp assigna `B` per defecte.

Les pestanyes tècniques (`Classes`, `Tipologies`, `Condicions`, `Equips`, etc.) poden quedar ocultes. El professorat no les hauria de tocar en l'ús habitual.

### 4.3. Pestanya tècnica `Tipologies`

| id_alumne | id_classe | tipologia | data_actualitzacio |
|---|---|---|---|
| a001 | eso1a | B | 2026-06-27 |

### 4.4. Pestanya `Condicions`

| id_condicio | id_classe | tipus | força | alumnes | notes |
|---|---|---|---|---|---|
| c001 | eso1a | incompatibilitat | obligatoria | a001,a002 |  |
| c002 | eso1a | agrupament_forcat | preferent | a003,a004 |  |

Valors previstos:

- `tipus`: `incompatibilitat` o `agrupament_forcat`
- `força`: `obligatoria` o `preferent`

### 4.5. Pestanya `Equips`

| id_generacio | data | id_classe | mida | tipus_generacio | compliment_global | equips_json |
|---|---|---|---|---|---|---|
| g001 | 2026-06-27 | eso1a | 4 | equilibrats | 92 | [...] |

## 5. Conceptes principals

### 5.1. Tipologies A/B/C

L'app mantindrà una classificació senzilla:

- **A**: alumnat més autònom o que pot ajudar.
- **B**: alumnat amb funcionament intermedi.
- **C**: alumnat que necessita més suport.

La interfície ha d'evitar que aquesta classificació sigui feixuga. La manera més pràctica és una taula d'alumnes amb botons A/B/C, no tres caixes de text separades.

### 5.2. Incompatibilitats

Les incompatibilitats indiquen alumnes que no han d'anar junts.

Hi haurà dos nivells:

- **Obligatòria**: l'app ho ha de respectar sempre que sigui possible.
- **Preferent**: l'app ho ha d'intentar respectar, però pot incomplir-ho si cal.

Nom visible recomanat:

- **No poden anar junts**

### 5.3. Agrupaments forçats

Els agrupaments forçats indiquen alumnes que han d'anar junts.

Hi haurà dos nivells:

- **Obligatori**: l'app ha de mantenir junts aquests alumnes sempre que sigui possible.
- **Preferent**: l'app ho ha d'intentar, però pot separar-los si el conjunt de criteris ho fa necessari.

Nom acordat:

- **Agrupaments forçats**

Text visible recomanat:

- **Han d'anar junts**

## 6. Pantalles de l'app

### 6.1. Accés

Elements:

- Títol: **SynApp**
- Subtítol: **Generador de grups cooperatius - Escola Ramon Pont**
- Camp per introduir la clau.
- Botó **Entra**.

En la primera versió, la clau serà `SoL`.

### 6.2. Inici

Elements:

- Selector de classe.
- Resum ràpid del nombre d'alumnes.
- Botó principal **Genera grups**.
- Accés a gestió d'alumnat i condicions.

### 6.3. Alumnat

Elements:

- Taula compacta.
- Cerca per nom.
- L'alumnat es mostra en format `Nom Cognoms`, però s'ordena per cognoms per facilitar trobar-lo ràpidament.
- Columnes:
  - nom;
  - tipologia;
  - estat;
  - observacions breus.
- Canvi de tipologia amb un clic.
- Canvi d'estat amb un clic: `Actiu` en verd i `Inactiu` en vermell.
- Els alumnes inactius no entren en la generació de grups ni es poden seleccionar per crear condicions noves.
- Afegir alumne de manera ràpida.

### 6.4. Condicions

Elements:

- Bloc **Incompatibilitats**.
- Bloc **Agrupaments forçats**.
- Selector d'alumnes.
- Selector de força:
  - obligatori;
  - preferent.
- Llistat de condicions creades amb opció d'eliminar.

Ha de ser molt intuïtiu. El professorat no hauria de pensar en conceptes tècnics.

### 6.5. Generador

Opcions visibles:

- Mida del grup: 2, 3, 4, 5 o 6.
- Tipus de grup:
  - equilibrats;
  - semblants;
  - aleatoris.
- Sobrants:
  - repartir;
  - crear grup petit.

Opcions avançades, plegades:

- respectar agrupaments obligatoris;
- prioritzar preferències;
- evitar repetir equips anteriors;
- equilibrar rols cooperatius en una fase posterior.

### 6.6. Resultats

Elements:

- Targetes d'equip.
- Colors per tipologia.
- Indicador de composició: per exemple `1A · 2B · 1C`.
- Botons:
  - **Torna a generar**;
  - **Copia**;
  - **Desa al Sheets**;
  - **Exporta CSV**;
  - **Imprimeix**.

En una fase posterior:

- arrossegar alumnes entre equips;
- bloquejar equips;
- bloquejar alumnes;
- comparar amb generacions anteriors.

## 7. Informe de compliment

SynApp ha de mostrar un percentatge de compliment dels criteris sol·licitats.

Exemple:

```text
Compliment global: 92%

Obligatori: 6 de 6 condicions complertes
Preferent: 4 de 6 preferències respectades
Mida dels equips: correcta
Equilibri A/B/C: millorable en 1 equip
```

El percentatge ha de ser explicable. No ha de ser un número misteriós.

### 7.1. Criteris de càlcul

L'informe hauria de considerar:

- incompatibilitats obligatòries;
- agrupaments forçats obligatoris;
- incompatibilitats preferents;
- agrupaments forçats preferents;
- mida dels equips;
- equilibri de tipologies.

Les condicions obligatòries han de pesar més que les preferents.

### 7.2. Avisos

L'app ha d'explicar problemes concrets:

- contradiccions entre condicions;
- agrupaments obligatoris massa grans per a la mida de grup triada;
- incompatibilitats impossibles de respectar;
- equips amb desequilibri important;
- alumnes sense tipologia assignada.

## 8. Funcionament de l'algoritme

L'algoritme hauria de seguir aquesta prioritat:

1. Validar dades i detectar contradiccions.
2. Respectar incompatibilitats obligatòries.
3. Respectar agrupaments forçats obligatoris.
4. Maximitzar condicions preferents.
5. Equilibrar les tipologies A/B/C.
6. Ajustar la mida dels equips.
7. Generar un informe clar de compliment.

Si no es pot complir tot, l'app no ha de fallar silenciosament. Ha de generar la millor proposta possible i explicar què no ha pogut respectar.

## 9. Criteris d'experiència d'usuari

L'app ha de ser:

- ràpida;
- visual;
- intuïtiva;
- usable sense coneixements informàtics;
- útil en el dia a dia;
- compacta, sense pantalles llargues innecessàries;
- clara en els avisos;
- preparada per copiar o projectar els resultats.

Regla pràctica:

> Un professor ha de poder obrir l'app, triar la classe, generar grups i copiar el resultat en menys d'un minut.

## 10. Desenvolupament per fases

### Fase 1. Prototip local

- App HTML/CSS/JavaScript.
- Clau `SoL`.
- Dades demo.
- Generació d'equips.
- Incompatibilitats.
- Agrupaments forçats.
- Obligatori/preferent.
- Informe de compliment.
- Guardat temporal al navegador.

### Fase 2. Google Sheets central

- Crear el Google Sheets real.
- Crear Google Apps Script.
- Connectar l'app amb Apps Script.
- Llegir classes i alumnat.
- Escriure equips generats.
- Validar la clau des de servidor.

### Fase 3. Millores d'ús habitual

- Històric d'equips.
- Exportació CSV/PDF.
- Còpia per Google Classroom.
- Arrossegar alumnes entre equips.
- Bloquejar equips.
- Vista d'impressió.

### Fase 4. Millores pedagògiques

- Rols cooperatius.
- Plantilles d'agrupament.
- Evitar repeticions respecte d'equips anteriors.
- Informes més complets.

## 11. Estat inicial de programació

La primera base de l'app ha de prioritzar:

- estructura clara;
- navegació per pestanyes;
- funcionament sense backend;
- codi fàcil de connectar després amb Apps Script;
- interfície pensada per a docents;
- resultats visuals;
- informe de compliment.

## 12. Millores visuals i d'ús incorporades

- Capçalera més compacta, sense el text superior repetit d'Escola Ramon Pont.
- Icona pròpia en SVG reutilitzada com a marca visual i com a `favicon.svg`.
- Vista única compacta: alumnat a l'esquerra, condicions amb més amplada a la dreta i resultats a sota.
- Mides de lletra i espais reduïts per aprofitar millor la pantalla.
- Condicions més fàcils de crear: els alumnes es trien amb botons clicables en tres columnes en pantalla ampla, sense haver d'usar Ctrl o Shift.
- Estat `Actiu/Inactiu` sincronitzat amb el Google Sheets central.
- Botons principals amb icones SVG.
- Adaptació responsiva comprovada en vista d'escriptori i mòbil.
