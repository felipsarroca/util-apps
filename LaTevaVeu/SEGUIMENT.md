# Seguiment de la feina

Document per reprendre el projecte des de qualsevol ordinador. Última actualització: 31 d'octubre de 2026.

## On ho hem deixat

L'app funciona sencera en mode de demostració i té el servidor fet, però sense desplegar. L'última feina ha estat d'usabilitat i documentació: entrada i inici de l'alumnat més lleugers, configuració del correu, guia amb recorreguts per a la tutoria i l'administració, i README amb captures. El següent pas que depèn de l'escola és la revisió amb l'Equip Directiu i la DPD; el següent pas tècnic, l'enviament real de correus (punt 4 de *Pendent*).

## On és cada cosa

| Què | On |
| --- | --- |
| Codi (font canònica) | Repositori `felipsarroca/util-apps`, carpeta `LaTevaVeu`, branca `main` |
| App publicada | <https://felipsarroca.github.io/util-apps/LaTevaVeu/> · enllaç curt <https://ja.cat/tensveu> |
| Presentació del projecte | <https://felipsarroca.github.io/util-apps/LaTevaVeu/#/projecte> |
| Guia del personal | Dins de l'app, botó «Guia» (tot el personal), o `#/guia` |
| Base de dades de proves | Neon, projecte «La teva veu» (`sparkling-field-60524633`), base de dades `latevaveu`; branques `proves` i `integracio` |
| Publicació | GitHub Pages es publica sol a cada `git push` a `main` (acció «Publica util-apps a GitHub Pages») |

## Com continuar des d'un altre ordinador

1. Obre Claude Code a `Gestió de Claude` i fes `/sincronitza` perquè l'entorn (skills, memòries, MCP) sigui igual.
2. Actualitza el repositori: `git -C "<ruta>/util-apps" pull`.
3. Treballa en una còpia local fora de Google Drive (els `node_modules` a la unitat W: van molt lents i se sincronitzen):
   ```bash
   mkdir -p ~/AppData/Local/mavaluo-nm
   cd "<ruta>/util-apps/LaTevaVeu" && tar --exclude=node_modules --exclude=dist -cf - . | (cd ~/AppData/Local/mavaluo-nm && tar -xf -)
   cd ~/AppData/Local/mavaluo-nm && npm ci
   ```
   Si no vols fer servir `tar`, n'hi ha prou de copiar `src`, `public`, `server`, `db`, `tests`, `index.html`, `package*.json`, `vite.config.ts` i `tsconfig*.json` a una carpeta temporal i fer-hi `npm ci`.
4. Quan acabis, copia els canvis al repositori (el mateix `tar` al revés, sense `node_modules`, `dist` ni `dist-server`), fes el commit i el `push`. En aquest ordinador ho fa `sync-back.sh`, que no es puja al repositori.

Ordres habituals (a la còpia local):

```bash
npm run dev                 # demostració a http://localhost:5173
npm test                    # proves del prototip i del servidor (PGlite)
npx tsc -b && npx eslint src server
npm run build && npm run server:build
npm run docs                # regenera db/dades-prova.sql i els documents de revisió
npm run audios              # genera els àudios que falten (cal edge-tts: pip install edge-tts)
npm run server:local        # servidor de proves en memòria (127.0.0.1:8787)
VITE_API_URL=http://127.0.0.1:8787 VITE_DEV_AUTH=1 npx vite --port 5191   # app connectada al servidor de proves
```

Proves contra Neon (cal haver iniciat sessió a `neonctl`; la cadena de connexió no s'escriu mai enlloc):

```bash
npx neonctl branches reset integracio --parent --project-id sparkling-field-60524633
TEST_DATABASE_URL="$(npx neonctl connection-string integracio --project-id sparkling-field-60524633 --database-name latevaveu --role-name latevaveu_owner)" npx vitest run server --testTimeout=120000
```

## Captures del README

Són a `docs/captures` i es fan amb `scripts/captures.mjs`, que entra a la demostració amb cada perfil:

```bash
npm run build && npx vite preview --port 5180 &
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9335 --user-data-dir="$TEMP/chrome-captures" about:blank &
node scripts/captures.mjs 9335 docs/captures
```

Torna-les a fer quan canviï alguna de les pantalles que surten al README.

## Fet fins ara

- **Prototip complet en mode de demostració**: espais «Em miro», «Et veig…» i «Centre»; qüestionaris per etapa; informes PDF «Així em veig» i «Així et veiem» (amb comentaris agrupats i detall classe per classe); grups configurables per curs; correus de les famílies per CSV; seguiment del professorat per a l'Equip Directiu; guia d'administració.
- **Servidor (Fastify + PostgreSQL)**, sense desplegar:
  - «Et veig…» amb rutes confidencials (respostes sense identificador, esborranys xifrats, llindar de 15 respostes, moderació).
  - «Em miro» i la gestió del centre: `GET /api/state` (dades retallades per rol) i `POST /api/ops` (operacions validades al servidor amb les mateixes regles que la demostració).
  - Registre d'operacions inalterable i rol `latevaveu_app` sense permisos per modificar-lo (`db/permisos.sql`).
- **Mode connectat del client**: amb `VITE_API_URL`, tota l'app treballa amb el servidor i no desa dades al navegador.
- **Capçalera**: sota el nom surt el tipus d'usuari (Alumnat ESO · 2n d'ESO, Professorat EP i ESO, Equip Directiu · Administració…).
- **Pantalla d'entrada**: capçalera amb el logo i el nom de l'escola; targeta que ocupa gairebé tota l'alçada; «Em miro» i «Et veig…» amb els seus colors; rajoles per a «Prova la demostració» i «Per què La teva veu?».
- **Inici de l'alumnat**: sense la fitxa amb el nom complet; el curs, com a etiqueta discreta perquè el docent comprovi el compte. A primària s'amaguen descripcions, dates, curs escolar i l'avís de dades incorrectes (es manté a l'ESO). Més ample en ordinadors.
- **Correu** (`Centre › Correu`, administració): compte de l'escola que envia, on arriben les respostes (tutoria o adreça fixa) i text editable dels dos missatges amb previsualització. Famílies: «Així em veig» adjunt, text basat en el de VeuAlumnat. Professorat: avís que «Així et veiem» és disponible, sense adjunt. Es desa a `app_settings ('mail')`. «Prepara l'enviament» ja mostra el remitent i l'assumpte real.
- **Guia del personal**: oberta a tot el personal, amb dos recorreguts pas a pas (tutoria i professorat; administració) abans del detall de cada pantalla, i dubtes freqüents de la tutoria.
- **README** reorganitzat, amb 13 captures de la demostració.
- **Pantalles de l'alumnat més netes**: sense targetes dins de targetes (inici, llista de docents, preguntes en files amb línia divisòria, resum final); fora textos sobrers (frase de la llista de docents, avís blau de confidencialitat reduït a una línia, rètols «Bloc» i «Abans d'enviar», ajudes repetides); a primària, sense dates.
- **Lectura en veu alta**: àudios MP3 pregenerats amb la veu neuronal catalana `ca-ES-JoanaNeural` (edge-tts), com a VoltaMon: `public/audio/<clau>.mp3`, un per fragment (pregunta, ajuda, matèria, opcions d'una escala), i `index.json` amb la llista. La clau és un resum del text (`src/domain/speech.ts`): si l'escola edita una pregunta, aquell fragment es llegeix amb la millor veu catalana del navegador fins que es regenerin els àudios amb `npm run audios`. Una prova falla si algun text dels qüestionaris inicials no té àudio.
- **Barra inferior i entrada sense caixes de més**: a la barra «Enrere / Següent / Lliura» només destaca el botó principal; a l'entrada, «Em miro» i «Et veig…» ja no van dins de requadres.
- **Presentació del projecte** (`#/projecte`): sentit, marc normatiu citat de fonts oficials (Convenció sobre els Drets de l'Infant art. 12; LOE-LOMLOE art. 1 i 91; Decret 175/2022 art. 22, 23 i 24), què fa l'app, com funciona, beneficis i privacitat.

## Pendent

1. Revisió amb l'Equip Directiu i la persona delegada de protecció de dades.
2. Triar l'allotjament del servidor (a la UE) i desplegar-lo. Abans, crear el rol `latevaveu_app` a Neon i aplicar `db/permisos.sql` (ordres dins del fitxer).
3. Client OAuth de Google aprovat a la consola de Google Workspace de l'escola.
4. **Decidir el compte que envia els correus** (recomanat: un compte dedicat, com `latevaveu@ramonpont.cat`) i autoritzar el servidor a enviar en nom seu (Gmail API amb delegació de domini o SMTP de Google Workspace). Després, implementar l'enviament real: cua idempotent, «Envia'm una prova», «Aprova i envia» i registre de cada missatge, fent servir `renderMail` de `src/domain/mail.ts`.
5. Inventari real de les matèries d'ESO per curs i prova pilot amb alumnat de cada etapa.
6. PFI: caldria un curs i un qüestionari propis (no es pot tractar com un grup).

## Precaucions

- No pujar mai dades reals ni CSV personals al repositori; tot el que hi ha és fictici.
- No escriure claus ni cadenes de connexió (ja.cat, Neon) en fitxers, ordres o missatges: es llegeixen de l'entorn.
- No confirmar els fitxers temporals d'Office (`~$…`).
