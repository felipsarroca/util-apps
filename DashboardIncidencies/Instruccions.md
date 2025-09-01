# Flux de dades

* **Primera vegada (onboarding):**

  1. L’usuari enganxa l’URL del Google Sheets:
     `https://docs.google.com/spreadsheets/d/1k5Z66CPM72x2xhpzPNaUoyHGNX6N9Oy4bBWGjAebXFk/edit?gid=539856522#gid=539856522`
  2. L’app el **transforma automàticament** a un enllaç llegible (CSV o GVIZ) i comprova l’accés a la **primera pestanya “Buidat”**.
  3. Si tot és correcte, l’URL queda **emmagatzemat localment** (p. ex. `localStorage`) com a “URL actiu del centre”.
* **Usos posteriors:** l’app **recorda l’URL** i carrega directament “Buidat” sense demanar res.

  * A “Configuració” hi haurà un botó “Canvia l’URL del full” per **actualitzar** o **oblidar** l’actual.

# Columnes d’interès (dates fora)

* Necessàries: **Alumne**, **Curs** (1r/2n/3r/4t ESO), **Tipus**.
* Files **sense `Tipus`** → s’**ignoren** (no compten).
* **Dates no s’usen** (no hi ha gràfiques temporals ni KPIs per períodes).

# Tipus d’incidència (llista tancada)

* **Vàlids (normalitzats):**
  Absències · Deures · Retard · Mòbil requisat · Falta de respecte · Expulsat de classe · Full d’incidència
  *(“Faltes respecte” es normalitza a “Falta de respecte”.)*
* **Variants d’accents/idioma** es normalitzen (“Móvil requisado” → “Mòbil requisat”, etc.).

## Política davant TIPUS desconeguts → **Opció C**

* Si apareix un valor de `Tipus` **fora de la llista**:

  * L’app **no es trenca** i **carrega la resta** de dades.
  * **No** classifica aquest valor com “Altres”.
  * Mostra un **avís visible** amb:

    * el(s) **valor(s) desconegut(s)** detectat(s),
    * el **recompte** d’entrades afectades,
    * una **recomanació** de correcció al Google Sheets (p. ex. “revisa ortografia/accents”).
  * Aquestes files **no** es compten a cap gràfic/KPI/taula fins que es corregeixin al full.
  * Un botó “Torna a comprovar” (Reload) permet refrescar un cop corregit.

# Filtres i comparatives

* **Filtre Alumne**: mostra totes les seves incidències (ordenades per Tipus), KPIs de l’alumne i percentatge de pes dins del seu curs.
* **Filtre Curs (= una classe per curs)**: tria **1r / 2n / 3r / 4t ESO**.
* **Filtre Tipus**: permet veure on es concentra (per alumnes i per cursos).
* **Combinables** (p. ex. Curs=2n ESO + Tipus=Retard).
* **Comparativa fixa entre cursos**: sempre **1r vs 2n vs 3r vs 4t ESO**, en barres (valors absoluts i opció de % sobre total).

# Pantalla principal (sense dates)

* **KPIs (conjunt filtrat):** Total incidències · Alumnes afectats · Mitjana incidències/alumne · Top 3 Tipus.
* **Gràfiques:**

  * Distribució per **Tipus** (donut o barres).
  * Distribució per **Curs** (barres: 1r, 2n, 3r, 4t).
  * **Ranking d’alumnes** (Top 10; opcional “veure tots”).
* **Taules:**

  * Incidències filtrades: **Alumne | Curs | Tipus**.
  * Agrupació per alumne: **Alumne | Curs | Total | (per Tipus opcional)**.
  * **Exporta CSV** del conjunt filtrat.

# Disseny i UX

* **Visual atractiu**, amb **botons 3D** (ombra suau, press effect), **paleta coherent** i contrast adequat.
* **Targetes** per KPIs/gràfics, tipografia clara, icones netes.
* Si falta alguna columna (**Alumne/Curs/Tipus**), s’amaga **només** el contingut dependent i es mostra un **missatge d’ajuda**.
  *(Ex.: si manca `Tipus`, no es pinta la donut de Tipus, però la resta continua.)*

# Diagnòstic i ajuda

* **Prova d’enllaç** (primer ús i quan es canvia l’URL): confirma que la pestanya “Buidat” és accessible i mostra una **vista prèvia de capçaleres**.
* **Mapatge manual** de capçaleres (si l’auto-detecció falla) i **persistència** del mapatge per a aquest full.
* **Banner d’errors** clar (accés al CSV, CORS, capçaleres no trobades, tipus desconeguts), sense bloquejar la resta de visors.

# Persistència local

* **URL del Google Sheets** (actiu) → **guardat localment** després del primer ús; s’utilitza automàticament en sessions futures.
* **Mapatge de capçaleres** personalitzat (si cal) → també es guarda per a **aquest** full (id i gid).
* Opcions “Canvia l’URL” i “Reinicia mapatge” a Configuració.


