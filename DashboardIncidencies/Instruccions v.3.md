

## Instruccions de funcionament de l’aplicació

Fes l'aplicació seguint les instruccions. Cal que pugui llegir els fitxers de google drive a partir de l'URL normal com aquesta: [https://docs.google.com/spreadsheets/d/1k5Z66CPM72x2xhpzPNaUoyHGNX6N9Oy4bBWGjAebXFk/edit?gid=539856522\#gid=539856522](https://docs.google.com/spreadsheets/d/1k5Z66CPM72x2xhpzPNaUoyHGNX6N9Oy4bBWGjAebXFk/edit?gid=539856522#gid=539856522).

A més, cal que estigui compliada de manera que la pugui executar en local o executar-la des de Github sense problema.

Fes que el disseny sigui atractiu, amb colors i molt visual.

### 1\. Lectura inicial de dades

* Quan l’usuari accedeix per primera vegada, l’aplicació li demana **l’URL del Google Sheets** (per exemple, el següent):  
    
  https://docs.google.com/spreadsheets/d/1k5Z66CPM72x2xhpzPNaUoyHGNX6N9Oy4bBWGjAebXFk/edit?gid=539856522\#gid=539856522  
    
* L’aplicació transforma automàticament aquesta URL per accedir **a la pestanya “Buidat”**, publicable com CSV o mitjançant `gviz`, i el **desa localment** (per reutilitzar-la en sessions futures).  
    
* Si hi ha problemes d’accés (CORS, permisos), l’aplicació mostra un **missatge d’error clar** i instruccions perquè l’usuari configuri la pestanya “Buidat” com a pública o la comparteixi correctament.

### 2\. Dades a extreure i neteja inicial

* **Columnes mínimes** necessàries:  
    
  * `Alumne` (nom en format “Cognoms, Nom”)  
  * `Curs` (ex: “1rESO”, “Tercer d’ESO”… es normalitza a “1r ESO” / “2n ESO” / “3r ESO” / “4t ESO”)  
  * `Tipus` (plur de categories oficials; es normalitza i es validen)  
  * `Quantitat` (valor numèric final de fila per classes Absències, Retard o Deures; per altres Tipus, si manca, es pren valor null o 1\)


* **Files sense Tipus** → s’ignoren completament.  
    
* **Tipus desconeguts** (fora de la llista oficial) → s’exclouen, i l’aplicació mostra un **avís visible** amb el/els valor(s) desconegut(s) i quantes files s’han descartar, a fi que l’usuari ho corregeixi al Google Sheets.  
    
* Per a Tipus com “Faltes respecte” o variants lingüístiques, es realitza una **normalització** a les formes oficials:  
    
  * Absències, Deures, Retard, Mòbil requisat, **Falta de respecte**, Expulsat de classe, Full d’incidència.


* Si no apareix un nombre a la fila per Absències / Retard / Deures → es presumeix que el valor és **1**, però preferiblement s’hauria de revisar.

### 3\. Filtrat i interacció amb l’usuari

L’usuari pot filtrar la vista per:

1. **Alumne** — veure totes les seves incidències (tipus \+ quantitat) i KPIs desglossats.  
2. **Curs** — seleccionar una classe (1r ESO, 2n ESO, 3r ESO o 4t ESO) i veure l’estat global i comparativa entre classes. Adaptar la nomenclatura: Quart d’ESO \= 4t ESO o Tercer d’ESO \= 3r ESO.  
3. **Tipus** — veure en quina o quines classes i alumnes s’ha concentrat aquesta incidència.  
* Els filtres són **combinables** (p. ex., Curs \= 2n ESO \+ Tipus \= Retard \+ Alumne \= “X”).

### 4\. Resultats i visualitzacions

#### KPIs (del conjunt filtrat)

* **Targetes per Tipus** amb el valor numèric de cada Tipus (ex.: “Retard: 24”).  
* **Total per alumne** (suma de tots els tipus).  
* **Alumnes afectats (únics)** i **mitjana incidències/alumne**.  
* **Top 3 Tipus** (amb nom i nombre).

#### Gràfics

* **Distribució per Tipus**: donut o barres (visualització clara del pes de cada Tipus).  
* **Comparativa per Curs**: gràfic de barres amb les quatre columnes fixes (1r / 2n / 3r / 4t ESO), mostrant el número o %, amb seleccionador de Tipus o dades agregades.  
* **Ranking d’alumnes (Top 10\)** per Tipus o total, amb visualitzacions en barres i opcions de cerca.

#### Taules

* **Incidències filtrades**: Alumne | Curs | Tipus | Quantitat.  
    
* **Agrupació per alumne**: columns per Tipus \+ **Total personal** (sumatori). Ex.:  
    
  Alumne               | Retard | Absències | Deures | Mòbil requisat | Falta de respecte | Expulsat | Full d’incidència | Total  
    
  \----------------------------------------------------------------------------------------------------  
    
  Daniel Adelantado ...| 3      | 1         | 0      | 2              | 0                 | 1        | 0                 | 7  
    
* **Botó d’exportació CSV** del conjunt filtrat, incloent total per alumne i desglossament per Tipus.

### 5\. Disseny i experiència d’usuari

* **Botons 3D** amb ombres suaus i transicions, **paleta de colors coherent**, llegibilitat i contrast accessibles.  
    
* **Targetes KPI** destacades, amb icones i etiquetes clares.  
    
* **Llegendes i dades numèriques visibles directament** a les gràfics (sense necessitat de hover).  
    
* **Avís visible i no intrusiu** quan hi ha Tipus desconeguts o dades per revisar.  
    
* **Filtres persistents** (xips selectables) amb botó de “Neteja filtres”.  
    
* **Panel configuració/Onboarding**:  
    
  * Primer ús: mostrar input per enllaç del Google Sheet.  
  * Opció per “Canvia full” i “Reiniciar mapatge capçaleres”.  
  * Mantenir aquesta configuració localment (localStorage o similar).

