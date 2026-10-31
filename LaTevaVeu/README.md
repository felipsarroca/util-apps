# La teva veu

*La teva mirada ens ajuda a millorar.* Aplicació web de l'Escola Ramon Pont per a l'alumnat de 3r de primària a 4t d'ESO, amb dos apartats que es poden activar o desactivar:

- **Em miro**: l'alumne s'autoavalua en cada avaluació i en surt l'informe individual **Així em veig**.
- **Et veig**: l'alumne valora una vegada cada docent que li fa classe, i en surt l'informe agregat **Així et veiem**, contrastat amb l'autoavaluació del docent.

Implementa les fases 1 i 2 del [pla mestre v2](La_teva_veu_pla_mestre_v2.md). Publicada a <https://felipsarroca.github.io/util-apps/LaTevaVeu/> (l'adreça antiga `MAvaluo/` hi redirigeix).

**Estat (31 d'octubre de 2026):** la versió publicada funciona en **mode de demostració**: el botó «Prova la demostració» de la pantalla d'entrada obre una finestra per triar el perfil (alumnat, professorat, Equip Directiu, administració) amb dades fictícies desades només al navegador, que es poden restaurar. «Et veig» ja té servidor i base de dades de proves (vegeu *Mode connectat*); encara no hi ha allotjament definitiu ni enviament de correus.

## Dos espais ben separats

- **Em miro** (color granat): autoavaluació de l'alumnat. La tutoria en fa el seguiment i l'informe «Així em veig».
- **Et veig** (color verd blavós): l'alumnat valora el professorat; cada docent rep l'informe «Així et veiem».
- **Centre** (color pissarra): dades comunes (cens, accessos, matèries, apartats i registre).

El personal entra a una pantalla d'inici amb un requadre per espai i només hi veu el que li pertoca. Dins de cada espai, el menú separa **Seguiment** (ús) de **Configuració**, i unes pestanyes permeten canviar d'espai. L'alumnat veu els dos espais com dos requadres diferenciats a la pantalla d'inici.

## Requisit d'entrada

Només s'hi pot entrar amb un compte **@ramonpont.cat**. Tenir aquest compte no dona accés a cap dada:

| Compte | Què veu |
| --- | --- |
| Alumne al cens | Només la seva autoavaluació, el seu curs i les seves matèries |
| Professorat | A «Em miro», només els grups que té assignats; a «Et veig», la seva autoavaluació i el seu informe quan es publica |
| Equip Directiu | Tots els informes d'«Et veig», la visió de centre i la moderació de comentaris; mai qui ha dit què. Només un membre de l'Equip Directiu pot afegir-hi o treure'n persones (a «Alumnat i accessos») |
| Administració | La configuració, amb registre de cada acció; no veu resultats d'«Et veig» |
| Compte de l'escola fora del cens | Pantalla «Encara no tens accés», sense cap dada |
| Compte d'un altre domini | Rebutjat abans d'entrar |

Amb Google real, el botó demana el domini de l'escola (`hd=ramonpont.cat`) i es comproven el domini i el correu verificat. **En producció, el servidor ha de tornar a verificar la signatura del testimoni**: la comprovació del navegador és només la primera barrera.

## Què fa

**Alumnat**
- Pantalla d'inici amb nom, curs i grup ja assignats, i un enllaç per avisar si són incorrectes.
- Tres experiències segons l'edat: 3r-4t (una pregunta per pantalla, targetes grans amb emojis, avanç automàtic i lectura en veu alta), 5è-6è (blocs curts, objectiu de l'avaluació anterior) i ESO (blocs de 4-5 afirmacions, una pantalla per matèria amb tres valoracions i observació opcional).
- Desa automàticament; es pot parar i continuar. Revisió final amb les respostes pendents. Es pot modificar fins al tancament.
- Lletra gran, lletra de lectura fàcil (Atkinson Hyperlegible), navegació amb teclat i tancament automàtic de la sessió després de 20 minuts d'inactivitat.

**Et veig: alumnat**
- Llista dels seus docents (també especialistes), en ordre aleatori estable; cada docent es valora una sola vegada per recollida, no per matèria.
- Preguntes per etapa: cicle mitjà (6 afirmacions, una per pantalla, escala de cares), cicle superior (12) i ESO (18), agrupades en dimensions. Sempre hi ha l'opció «No ho sé / No ho puc valorar».
- Comentaris opcionals, confirmació abans de lliurar; un cop lliurat no es pot canviar.

**Et veig: professorat i Equip Directiu**
- Autoavaluació del docent: una per etapa, amb les mateixes afirmacions en primera persona i etiquetes opcionals de context per grup.
- Informe «Així et veiem»: dimensions, mirall alumnat-docent amb quatre quadrants, detall per afirmació, resultats per grup, evolució i comentaris moderats. Imprimible en A4.
- Confidencialitat: les respostes es desen sense identificar l'alumne; no es mostra cap agregat amb menys de 15 respostes.
- Visió de centre (Equip Directiu): participació, dimensions per etapa amb la variació respecte de la recollida anterior, i mapa de calor del professorat en ordre alfabètic. Es pot imprimir o desar en PDF (A4).
- Recollides independents de les avaluacions: `Esborrany → Programada → Oberta → Tancada → Moderació → Informes generats → Publicada → Arxivada`. Les assignacions es congelen en obrir-les.
- Moderació de comentaris amb marques automàtiques (insults, noms propis, dades de contacte, frases que identifiquen).
- Configuració: apartats actius, assignacions docents per grup i matèria, i editor de preguntes amb versions.

**Em miro: professorat i administració**
- Tauler amb participació per grup i activitat recent.
- Respostes: estat i progrés de cada alumne, amb l'informe.
- Informes i famílies: informe A4 paginat, un sol PDF dels seleccionats o només dels que no tenen correu familiar, opció de doble cara (cada informe comença en cara nova), acusament de lectura retallable i preparació de l'enviament amb els destinataris validats.
- Recollides: cicle `Programada → Oberta → Tancada → … → Arxivada`, canvi de dates amb motiu registrat, creació per a diversos cursos alhora.
- Qüestionaris: editor sense programar (apartats, preguntes, escales, obligatorietat, límits, etiquetes de PDF), previsualització d'alumne, prova de l'informe amb respostes curtes i llargues, versions immutables un cop publicades.
- Matèries per curs: ordre, comunes i optatives, activació.
- Alumnat i accessos: permisos per grup, cens amb optatives, importació CSV amb validació prèvia, incidències d'identitat.
- Registre d'operacions.

## Adreces dels apartats

- <https://felipsarroca.github.io/util-apps/LaTevaVeu/#/em-miro> obre «Em miro».
- <https://felipsarroca.github.io/util-apps/LaTevaVeu/#/et-veig> obre «Et veig».

Si cal, primer es demana el compte de l'escola. Si l'apartat no està actiu, s'obre la pantalla d'inici.

## Comptes de prova

Es trien a la finestra de «Prova la demostració». Amb el servidor real (sense `VITE_DEV_AUTH`), aquest botó desapareix i només es pot entrar amb Google.

| Compte | Per provar |
| --- | --- |
| Alumne de 3r, Alumna de 5è, Alumne de 2n d'ESO | Les dues experiències de cada etapa |
| Marta Riera | Docent i tutora d'ESO: autoavaluació i el seu informe |
| Sergi Prat | Especialista d'EF a les tres etapes |
| Equip Directiu | Visió de centre, tots els informes i moderació |
| Administració | Configuració, sense accés als resultats |

## Desenvolupament

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # proves del motor i dels permisos (vitest)
npm run lint
npm run build    # genera dist/
```

> A la unitat de Google Drive (`W:`) `npm install` falla (EBADF). Cal treballar en una còpia local (p. ex. `%LOCALAPPDATA%\mavaluo-nm`) i copiar-hi el codi.

Per activar Google real: copia `.env.example` a `.env.local` i posa-hi `VITE_GOOGLE_CLIENT_ID` (client OAuth «Aplicació web» del Google Cloud de l'escola, amb l'origen autoritzat de l'URL publicada).

## Estructura

| Carpeta | Contingut |
| --- | --- |
| `src/domain` | Model, catàleg de cursos i matèries, plantilles, motor de qüestionaris, CSV |
| `src/data` | Identificació i capa de dades (`api.ts`: simula el servidor amb control de permisos) |
| `src/student` | Flux de l'alumnat i components de pregunta |
| `src/staff` | Pantalles de professorat i administració |
| `src/report` | Informes A4 «Així em veig» i «Així et veiem», amb paginació per blocs |
| `db/schema.sql` | Esquema previst per a Neon PostgreSQL |
| `server` | Base del servidor (Fastify): verificació del testimoni de Google, permisos i API d'«Et veig» |
| `docs` | Dossier de privacitat, textos informatius, kit del claustre i de la prova pilot |
| `scripts` | Generació dels documents de revisió i de la plantilla d'assignacions (`npm run docs`) |
| `tests`, `server/tests` | Proves dels criteris d'acceptació del pla mestre (prototip i servidor) |

## Pendent abans d'utilitzar-la amb dades reals

1. Revisió amb direcció i la persona delegada de protecció de dades.
2. Client OAuth de Google aprovat a la consola de Google Workspace (els comptes de menors poden tenir bloquejades les apps de tercers no configurades).
3. Completar el servidor (vegeu l'apartat següent) i connectar-hi el frontend.
4. Inventari real de les matèries d'ESO per curs (el catàleg actual és provisional).
5. Servei de correu institucional amb cua idempotent; emmagatzematge privat dels PDF.
6. Prova amb alumnat real de cada etapa per ajustar preguntes, durada i obligatorietat.

## Servidor (fase 5, sense desplegar)

La carpeta `server` conté el backend d'«Et veig». Encara no està desplegat a cap allotjament.

- Cada petició porta el testimoni d'identitat de Google (`Authorization: Bearer …`). El servidor en comprova la signatura, l'emissor, l'audiència, el domini `ramonpont.cat` i el correu verificat.
- Tenir compte de l'escola no dona accés: cal ser al cens de l'alumnat o tenir un rol (administració, docent, direcció).
- Les respostes es desen sense cap identificador d'alumne; els esborranys, xifrats (AES-256-GCM) i esborrats en lliurar.
- En tancar la recollida, es desen els recomptes de participació per grup i les respostes i els comentaris es tornen a escriure en ordre aleatori. En publicar-la, s'esborra la llista de qui ha participat.
- El llindar de 15 respostes i la moderació (només direcció) s'apliquen al servidor amb el mateix codi del domini que el prototip.

### Mode connectat

Amb `VITE_API_URL`, l'app parla amb el servidor: l'alumnat valora el professorat i el personal gestiona les recollides, fa la seva autoavaluació docent, modera els comentaris i consulta els informes. Cada petició carrega només la recollida i l'alumne que necessita, amb les consultes en paral·lel. «Em miro» i la configuració (cens, assignacions, preguntes) encara funcionen només en demostració.

Per provar-ho tot en local amb dades fictícies:

```bash
npm run server:local                                              # servidor a 127.0.0.1:8787, base de dades en memòria
VITE_API_URL=http://127.0.0.1:8787 VITE_DEV_AUTH=1 npm run dev -- --port 5191
```

### Base de dades

- Projecte de Neon «La teva veu» (Frankfurt, PostgreSQL 17), branca `proves` amb `db/schema.sql` i `db/dades-prova.sql` (tot fictici). La branca `integracio` serveix per passar-hi les proves.
- `npm run docs` regenera `db/dades-prova.sql`. `scripts/aplica-sql.ts` aplica fitxers SQL a la base de dades de `DATABASE_URL` (la cadena de connexió no s'escriu mai en cap fitxer).

Ordres:

```bash
npm test                 # inclou les proves del servidor amb PostgreSQL en memòria (PGlite)
TEST_DATABASE_URL=… npx vitest run server --testTimeout=120000   # les mateixes proves contra Neon
npm run server:build     # genera dist-server/main.js
```

Pendent:

1. Triar l'allotjament del servidor (UE) i desplegar-lo: cal l'aprovació de direcció i de la persona delegada de protecció de dades.
2. API d'«Em miro», de l'autoavaluació docent a la interfície connectada i de la gestió (cens, personal, assignacions, càrrega de CSV).
3. Rols i permisos de la base de dades (usuari de l'aplicació sense permisos d'esborrat sobre l'auditoria).
4. Rendiment: cada petició carrega totes les dades de la recollida; caldrà consultes específiques abans d'usar-ho amb tot el centre.
