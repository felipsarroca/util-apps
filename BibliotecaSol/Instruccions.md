Aquí tens el redactat ja preparat en **format Markdown** per copiar-lo directament en un fitxer, per exemple:

`biblioteca-de-la-sol-instruccions.md`

He tingut en compte especialment la part de seguretat: Supabase permet treballar des del navegador sempre que s’activi correctament la **Row Level Security**; la clau pública/anon pot aparèixer al codi frontend si les polítiques RLS estan ben configurades, però la **service role key no s’ha de posar mai al navegador**. També convé configurar bé les URL de redirecció d’autenticació i, per restringir registres a `@ramonpont.cat`, la solució més segura és combinar validació visual al formulari amb una restricció real al backend mitjançant un **Before User Created Hook**. ([Supabase][1])

````md
# Biblioteca de la Sol

## Descripció general del projecte

**Biblioteca de la Sol** serà una aplicació web per gestionar i consultar el catàleg de la biblioteca escolar.

En una primera fase, l’aplicació tindrà una funció senzilla però molt útil: permetre introduir llibres, organitzar-los en un catàleg i facilitar-ne la consulta. Més endavant, l’aplicació podrà créixer per gestionar préstecs, reserves, devolucions, avisos automàtics i diferents perfils d’usuari.

L’aplicació estarà pensada per a l’entorn de l’Escola Ramon Pont i només hi podran accedir usuaris amb correu institucional acabat en:

`@ramonpont.cat`

El desenvolupament es farà amb tecnologies senzilles i conegudes:

- HTML
- CSS
- JavaScript
- Supabase com a backend
- GitHub Pages com a sistema de publicació

No es farà servir React ni Vite, per tal que el projecte sigui més fàcil d’entendre, editar i publicar.

---

## Nom, identitat visual i estil

El nom de l’aplicació serà:

**Biblioteca de la Sol**

El títol principal visible de l’aplicació serà:

**Biblioteca de la Sol**

El subtítol visible serà:

**Escola Ramon Pont**

La icona principal de l’aplicació serà un **sol lluent**, amable i fàcilment identificable. Aquest sol hauria d’aparèixer:

- a la pantalla inicial;
- a la capçalera de l’aplicació;
- com a favicon del navegador;
- eventualment, com a icona si l’aplicació es converteix en PWA instal·lable.

L’estètica general hauria de ser clara, escolar, amable i lluminosa. Els colors principals podrien combinar:

- groc suau o daurat per al sol;
- blanc o crema per al fons;
- blau o verd suau per als botons i elements de navegació;
- gris fosc per als textos.

La interfície hauria de ser molt neta, sense excés d’elements, perquè pugui ser utilitzada fàcilment per docents, alumnat i personal del centre.

El disseny ha de ser **responsiu** i adaptar-se correctament a mòbil, tauleta, portàtil i pantalla ampla. L’aplicació ha d’aprofitar sempre l’amplada disponible de la pantalla amb marges laterals moderats, evitant contenidors massa estrets quan hi ha espai.

Les mides de lletra han de ser proporcionades a una eina de gestió escolar: clares i llegibles, però sense títols excessivament grans ni espais verticals innecessaris. A les pantalles de catàleg i editor s’ha de prioritzar la densitat ordenada de la informació.

El catàleg de llibres **no inclourà fotografies ni portades**. S’ha de presentar com una consulta neta, ordenada i pràctica, amb la informació necessària per identificar i localitzar cada llibre.

---

## Peu de pàgina i autoria

A la part inferior de l’aplicació hi haurà un peu de pàgina discret, semblant al model de referència de MendelSim, però adaptat al projecte.

El peu de pàgina hauria de tenir aquest estil:

**[Felip Sarroca](https://ja.cat/felipsarroca) — Biblioteca de la Sol v1.0**

A sota, en una segona línia, es podria afegir:

**Codi: AGPLv3 · Continguts: CC BY-NC-SA 4.0 · © 2026 · Suggeriments i errors**

L’enllaç del nom **Felip Sarroca** ha de portar a:

```text
https://ja.cat/felipsarroca
```

El text hauria d’estar situat a la part inferior de la pantalla, amb una mida petita, alineació centrada, color discret i sense interferir en l’ús normal de l’aplicació.

---

## Plataforma tècnica recomanada

El backend de l’aplicació serà **Supabase**.

Supabase és adequat per a aquest projecte perquè permet tenir:

- una base de dades relacional;
- registre i inici de sessió d’usuaris;
- control de permisos;
- polítiques de seguretat;
- possibilitat de créixer cap a préstecs, reserves i avisos;
- connexió directa des d’una app feta amb HTML, CSS i JavaScript.

La informació de llibres, exemplars, usuaris, reserves, préstecs i devolucions quedarà guardada a Supabase.

GitHub Pages només servirà per publicar la part visible de l’aplicació, és a dir, el frontend.

---

## Arquitectura general

L’aplicació tindrà aquesta estructura:

```text
Frontend:
HTML + CSS + JavaScript
Publicat a GitHub Pages

Backend:
Supabase
Base de dades PostgreSQL
Autenticació d’usuaris
Polítiques de seguretat RLS
````

El frontend serà públic en el sentit que el codi estarà penjat a GitHub Pages, però les dades no quedaran exposades si Supabase està ben configurat.

Això vol dir que el codi podrà contenir la URL pública de Supabase i la clau pública del projecte, però mai no haurà de contenir claus secretes ni la service role key.

---

## Accés d’usuaris

L’aplicació tindrà una pantalla d’inici de sessió senzilla.

Per als usuaris de consulta, n’hi haurà prou amb introduir un correu institucional acabat en:

`@ramonpont.cat`

Els usuaris de consulta podran cercar llibres, consultar disponibilitat i, en fases futures, fer reserves.

Només els usuaris amb permisos d’editor hauran d’introduir contrasenya, perquè poden modificar dades del catàleg, afegir llibres, registrar devolucions o descatalogar exemplars.

Perfils locals de prova:

* `alumnat@ramonpont.cat`: usuari de consulta.
* `biblioteca@ramonpont.cat`: usuari editor amb contrasenya.

La validació del domini del correu s’haurà de fer en dos nivells:

### Validació al frontend

El formulari comprovarà que el correu acaba en:

`@ramonpont.cat`

Si no és així, mostrarà un missatge com:

> Només es poden registrar usuaris amb correu institucional acabat en @ramonpont.cat.

Aquesta validació millora l’experiència d’usuari, però no és suficient com a mesura de seguretat.

### Validació real a Supabase

També caldrà impedir el registre des del backend. Per això s’haurà de configurar Supabase perquè rebutgi registres amb correus que no siguin del domini permès.

La manera recomanada és utilitzar un **Before User Created Hook** de Supabase. Aquest hook comprovarà el correu abans de crear l’usuari i només acceptarà els correus acabats en:

`@ramonpont.cat`

Això evitarà que algú esquivi la validació del frontend.

---

## Confirmació del correu electrònic

Supabase haurà de tenir activada la confirmació de correu electrònic.

Això vol dir que un usuari no podrà iniciar sessió fins que hagi confirmat el seu correu.

Aquesta opció és important perquè:

* evita registres falsos;
* comprova que l’usuari té accés real al correu institucional;
* reforça la seguretat de l’aplicació.

Caldrà configurar correctament les URL de redirecció de Supabase perquè, després de confirmar el correu, l’usuari torni a l’aplicació publicada a GitHub Pages.

---

## Perfils d’usuari

L’aplicació tindrà tres perfils previstos, encara que al principi només se’n facin servir dos.

### Administrador

Pot gestionar la configuració general de l’aplicació.

Funcions possibles:

* assignar rols;
* gestionar editors;
* revisar dades generals;
* accedir a totes les funcions.

### Editor o bibliotecari

Pot gestionar el catàleg.

Funcions inicials:

* afegir llibres;
* editar llibres;
* afegir exemplars;
* modificar ubicacions;
* marcar llibres o exemplars com a descatalogats;
* revisar l’estat dels exemplars.

Funcions futures:

* confirmar préstecs;
* confirmar devolucions;
* gestionar reserves;
* marcar llibres com a perduts o malmesos.

### Usuari de consulta o lector

Pot consultar el catàleg.

Funcions inicials:

* veure llibres disponibles;
* cercar per títol, autor, temàtica o edat;
* consultar la ubicació d’un llibre.

Funcions futures:

* fer reserves;
* consultar els seus préstecs;
* rebre avisos de devolució.

---

## Fase 1: Catàleg i consulta

La primera fase de l’aplicació tindrà com a objectiu construir un catàleg funcional.

### Funcions principals

L’aplicació haurà de permetre:

* registrar usuaris amb correu institucional;
* iniciar sessió;
* consultar llibres;
* cercar llibres;
* filtrar llibres amb diversos criteris combinables;
* introduir nous llibres;
* editar dades dels llibres;
* crear exemplars;
* assignar una ubicació física;
* generar un codi únic per a cada exemplar;
* marcar llibres o exemplars com a actius o descatalogats.

### Camps recomanats per als llibres

Cada llibre podria tenir aquests camps:

* títol;
* autor;
* editorial;
* ISBN;
* any de publicació;
* llengua;
* edat recomanada;
* etapa o curs recomanat;
* temàtica;
* gènere;
* resum breu;
* paraules clau;
* estat del registre;
* data d’alta;
* usuari que l’ha creat.

Els camps com **edat**, **temàtica**, **gènere** i **ubicació** han de tenir categories preestablertes. Si un editor introdueix una categoria nova, l’aplicació l’ha de guardar i oferir-la com a opció en futures introduccions de llibres.

### Diferència entre llibre i exemplar

És important diferenciar entre **llibre** i **exemplar**.

Un llibre és l’obra general.

Per exemple:

> El petit príncep

Un exemplar és una còpia física concreta d’aquest llibre.

Per exemple:

> Exemplar RP-000123 d’El petit príncep

Això és important perquè la biblioteca pot tenir diversos exemplars del mateix llibre. Cada exemplar pot tenir una ubicació, un estat i una disponibilitat diferent.

---

## Codi únic de cada exemplar

Cada exemplar tindrà un codi únic.

Es recomana utilitzar codis senzills, estables i fàcils d’imprimir:

```text
RP-000001
RP-000002
RP-000003
```

El codi no hauria d’intentar contenir massa informació. És millor que sigui simple i que la resta d’informació estigui guardada a la base de dades.

Més endavant, aquest codi es podria convertir en:

* QR;
* codi de barres;
* etiqueta adhesiva per al llom o l’interior del llibre.

El codi servirà per localitzar ràpidament l’exemplar dins de l’aplicació.

---

## Fase 2: Préstecs, reserves i devolucions

En una segona fase, l’aplicació podrà incorporar la gestió de préstecs.

### Funcions noves

L’aplicació haurà de permetre:

* sol·licitar una reserva;
* veure si un llibre està disponible;
* registrar un préstec;
* calcular la data límit de devolució;
* consultar préstecs actius;
* consultar préstecs vençuts;
* registrar la devolució d’un llibre;
* mantenir l’historial de préstecs.

### Confirmació de préstec

El préstec no hauria de quedar confirmat automàticament només perquè l’usuari el demani.

El procés recomanat seria:

1. L’usuari sol·licita el préstec o la reserva.
2. L’editor comprova físicament el llibre.
3. L’editor confirma el préstec.
4. L’aplicació registra la data de sortida.
5. L’aplicació calcula la data prevista de devolució.

### Confirmació de devolució

La devolució l’hauria de confirmar un editor.

Això és important perquè evita que un usuari marqui com a retornat un llibre que encara no ha tornat físicament.

El procés recomanat seria:

1. L’usuari retorna el llibre.
2. L’editor comprova l’exemplar.
3. L’editor marca el préstec com a retornat.
4. L’aplicació registra la data real de devolució.
5. L’exemplar torna a aparèixer com a disponible.

---

## Fase 3: Avisos automàtics i millores avançades

En una tercera fase, l’aplicació podrà incorporar avisos automàtics.

### Avisos possibles

L’aplicació podria enviar correus quan:

* s’apropa la data de devolució;
* el termini de devolució ja ha vençut;
* una reserva ha estat acceptada;
* una reserva està a punt de caducar;
* un llibre reservat ja està disponible.

### Enviament de correus

Els correus no s’haurien d’enviar directament des del frontend.

S’haurien d’enviar des d’un entorn segur, com ara:

* Supabase Edge Functions;
* una funció programada;
* Apps Script connectat a Supabase;
* un servei extern d’enviament de correus.

Aquesta part es deixarà per a una fase posterior, quan el catàleg i els préstecs ja funcionin correctament.

---

## Estructura inicial de la base de dades

La base de dades inicial podria tenir aquestes taules:

### Taula `profiles`

Guarda informació pública dels usuaris registrats.

Camps recomanats:

* `id`
* `email`
* `nom`
* `cognoms`
* `rol`
* `created_at`

El camp `id` hauria d’estar relacionat amb l’usuari d’autenticació de Supabase.

### Taula `llibres`

Guarda la informació general de cada llibre.

Camps recomanats:

* `id`
* `titol`
* `autor`
* `editorial`
* `isbn`
* `any_publicacio`
* `llengua`
* `nivell_recomanat`
* `tematica`
* `genere`
* `resum`
* `paraules_clau`
* `imatge_portada`
* `actiu`
* `created_at`
* `created_by`

### Taula `exemplars`

Guarda cada còpia física d’un llibre.

Camps recomanats:

* `id`
* `llibre_id`
* `codi_exemplar`
* `ubicacio`
* `estat`
* `disponible`
* `descatalogat`
* `observacions`
* `created_at`

### Taula `prestecs`

Es pot crear a la fase 2.

Camps recomanats:

* `id`
* `exemplar_id`
* `usuari_id`
* `data_prestec`
* `data_prevista_devolucio`
* `data_devolucio`
* `estat`
* `confirmat_per`
* `created_at`

### Taula `reserves`

Es pot crear a la fase 2.

Camps recomanats:

* `id`
* `llibre_id`
* `exemplar_id`
* `usuari_id`
* `data_reserva`
* `estat`
* `data_limit_recollida`
* `created_at`

---

## Seguretat i permisos

La seguretat serà una part essencial del projecte.

Caldrà activar la **Row Level Security** en totes les taules públiques de Supabase.

La idea general serà:

* els usuaris no autenticats no poden veure ni modificar dades;
* els usuaris autenticats poden consultar el catàleg;
* només els editors poden crear, editar o descatalogar llibres;
* només els editors poden confirmar préstecs i devolucions;
* cada usuari només pot veure les seves pròpies reserves i préstecs, excepte els editors i administradors.

No s’ha de confiar mai només en el JavaScript del frontend per protegir les dades. Els permisos importants han d’estar definits a Supabase mitjançant polítiques RLS.

---

## Claus de Supabase i codi obert

Com que l’aplicació es publicarà a GitHub Pages, el codi serà visible.

Això no és un problema si es fa correctament.

Es pot incloure al frontend:

* la URL pública del projecte Supabase;
* la clau pública anon o publishable.

No s’ha d’incloure mai:

* la service role key;
* claus secretes;
* tokens privats;
* contrasenyes;
* credencials d’administrador.

La seguretat real no dependrà d’amagar la clau pública, sinó de tenir ben configurades les polítiques RLS.

---

## Estructura recomanada del projecte

El projecte podria tenir aquesta estructura de fitxers:

```text
biblioteca-de-la-sol/
│
├── index.html
├── login.html
├── cataleg.html
├── editor.html
│
├── css/
│   └── styles.css
│
├── js/
│   ├── config.js
│   ├── auth.js
│   ├── cataleg.js
│   ├── editor.js
│   └── supabaseClient.js
│
├── assets/
│   ├── logo-sol.svg
│   ├── favicon.ico
│   └── portada-placeholder.png
│
└── README.md
```

### `index.html`

Pantalla inicial de l’aplicació.

Ha d’incloure:

* nom de l’aplicació;
* icona del sol;
* botó d’iniciar sessió;
* peu de pàgina amb autoria.

### `login.html`

Pantalla d’inici de sessió.

Ha d’incloure:

* formulari d’inici de sessió per a usuaris de consulta només amb correu;
* formulari d’inici de sessió per a editors amb correu i contrasenya;
* validació del domini `@ramonpont.cat`;
* missatges d’error clars.

### `cataleg.html`

Pantalla principal de consulta.

Ha d’incloure:

* cercador;
* filtres combinables;
* possibilitat de seleccionar més d’un valor dins d’un mateix criteri, per exemple diverses edats, temàtiques o gèneres;
* llistat de llibres;
* disponibilitat;
* ubicació;
* codi d’exemplar.

### `editor.html`

Pantalla només accessible per a editors.

Ha d’incloure:

* formulari per afegir llibres;
* formulari per editar llibres;
* gestió d’exemplars;
* opció de descatalogar llibres o exemplars.

---

## Procés de desenvolupament recomanat

### Pas 1: Crear el repositori a GitHub

Crear un repositori anomenat:

```text
biblioteca-de-la-sol
```

Aquest repositori contindrà tots els fitxers HTML, CSS i JavaScript.

### Pas 2: Crear el projecte a Supabase

Crear un projecte nou a Supabase amb el nom:

```text
Biblioteca de la Sol
```

Configurar:

* autenticació per correu electrònic;
* confirmació de correu;
* URL del lloc;
* URL de redirecció de GitHub Pages;
* polítiques de seguretat.

### Pas 3: Crear les taules inicials

Crear les taules:

* `profiles`
* `llibres`
* `exemplars`

Les taules de préstecs i reserves es poden deixar per més endavant.

### Pas 4: Activar RLS

Activar Row Level Security a totes les taules.

Crear polítiques perquè:

* els usuaris autenticats puguin consultar llibres i exemplars;
* només els editors puguin inserir o modificar llibres;
* només els editors puguin modificar exemplars;
* cada usuari només pugui modificar el seu propi perfil bàsic.

### Pas 5: Configurar la restricció del domini

Configurar un sistema perquè només es puguin registrar correus acabats en:

```text
@ramonpont.cat
```

Aquesta restricció s’ha d’aplicar tant al formulari com al backend.

### Pas 6: Crear la interfície inicial

Crear les primeres pantalles:

* pantalla inicial;
* login/registre;
* catàleg;
* pantalla d’editor.

### Pas 7: Connectar JavaScript amb Supabase

Crear un fitxer `supabaseClient.js` amb la configuració pública del projecte.

Aquest fitxer servirà per connectar l’aplicació amb Supabase.

### Pas 8: Publicar a GitHub Pages

Quan la primera versió funcioni en local, publicar el projecte a GitHub Pages.

Després caldrà comprovar:

* que el registre funciona;
* que el correu de confirmació arriba;
* que la redirecció torna correctament a l’aplicació;
* que només es poden registrar correus `@ramonpont.cat`;
* que els usuaris sense rol d’editor no poden modificar el catàleg.

---

## Decisions tècniques importants

### No fer servir React ni Vite

L’aplicació es farà amb HTML, CSS i JavaScript pur.

Això facilitarà:

* entendre el codi;
* modificar-lo manualment;
* publicar-lo a GitHub Pages;
* evitar configuracions de compilació;
* mantenir el projecte més senzill.

### No utilitzar Google Sheets com a backend principal

Google Sheets es podrà utilitzar com a eina auxiliar per preparar o importar dades, però no com a base de dades principal.

El backend principal serà Supabase.

### No posar secrets al codi

El frontend no ha d’incloure cap clau privada.

Només es podrà utilitzar la clau pública de Supabase.

### Preparar el projecte per créixer

Encara que la primera fase sigui senzilla, la base de dades s’ha de dissenyar pensant en el futur.

Per això es diferenciarà entre:

* llibres;
* exemplars;
* usuaris;
* préstecs;
* reserves.

---

## Resultat esperat de la fase 1

Al final de la fase 1, l’aplicació hauria de permetre:

* registrar-se només amb correu `@ramonpont.cat`;
* iniciar sessió;
* consultar el catàleg;
* cercar llibres;
* veure informació bàsica dels llibres;
* veure exemplars disponibles;
* saber on es troba un llibre;
* entrar llibres nous si l’usuari és editor;
* editar o descatalogar llibres si l’usuari és editor;
* impedir que els usuaris normals modifiquin dades.

Aquesta fase ja seria útil per a la biblioteca escolar encara que encara no gestionés préstecs.

---

## Resultat esperat de les fases futures

En fases posteriors, l’aplicació podrà permetre:

* fer reserves;
* registrar préstecs;
* confirmar devolucions;
* veure préstecs vençuts;
* enviar recordatoris;
* generar codis QR;
* consultar estadístiques;
* importar llibres des d’un full de càlcul;
* exportar dades;
* consultar l’historial de cada exemplar.

---

## Criteri general del projecte

La prioritat del projecte serà construir una aplicació:

* útil;
* senzilla;
* segura;
* fàcil de mantenir;
* adaptada a una escola;
* preparada per créixer sense haver de començar de zero.

La primera versió no ha d’intentar fer-ho tot.

Ha de fer molt bé tres coses:

1. registrar usuaris de l’escola;
2. gestionar el catàleg;
3. permetre trobar llibres fàcilment.

Quan això funcioni bé, es podrà avançar cap a préstecs, reserves i avisos.

```
::contentReference[oaicite:1]{index=1}
```

[1]: https://supabase.com/docs/guides/database/postgres/row-level-security?utm_source=chatgpt.com "Row Level Security | Supabase Docs"
