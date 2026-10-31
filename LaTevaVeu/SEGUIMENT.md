# Seguiment de la feina

Document per reprendre el projecte des de qualsevol ordinador. Última actualització: 31 d'octubre de 2026.

## On és cada cosa

| Què | On |
| --- | --- |
| Codi (font canònica) | Repositori `felipsarroca/util-apps`, carpeta `LaTevaVeu`, branca `main` |
| App publicada | <https://felipsarroca.github.io/util-apps/LaTevaVeu/> · enllaç curt <https://ja.cat/tensveu> |
| Presentació del projecte | <https://felipsarroca.github.io/util-apps/LaTevaVeu/#/projecte> |
| Guia d'administració | Dins de l'app, botó «Guia» (perfil d'administració o Equip Directiu), o `#/guia` |
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
4. Quan acabis, copia els canvis al repositori (el mateix `tar` al revés, sense `node_modules`, `dist` ni `dist-server`), fes el commit i el `push`. En aquest ordinador ho fa `sync-back.sh`, que no es puja al repositori.

Ordres habituals (a la còpia local):

```bash
npm run dev                 # demostració a http://localhost:5173
npm test                    # proves del prototip i del servidor (PGlite)
npx tsc -b && npx eslint src server
npm run build && npm run server:build
npm run docs                # regenera db/dades-prova.sql i els documents de revisió
npm run server:local        # servidor de proves en memòria (127.0.0.1:8787)
VITE_API_URL=http://127.0.0.1:8787 VITE_DEV_AUTH=1 npx vite --port 5191   # app connectada al servidor de proves
```

Proves contra Neon (cal haver iniciat sessió a `neonctl`; la cadena de connexió no s'escriu mai enlloc):

```bash
npx neonctl branches reset integracio --parent --project-id sparkling-field-60524633
TEST_DATABASE_URL="$(npx neonctl connection-string integracio --project-id sparkling-field-60524633 --database-name latevaveu --role-name latevaveu_owner)" npx vitest run server --testTimeout=120000
```

## Fet fins ara

- **Prototip complet en mode de demostració**: espais «Em miro», «Et veig…» i «Centre»; qüestionaris per etapa; informes PDF «Així em veig» i «Així et veiem» (amb comentaris agrupats i detall classe per classe); grups configurables per curs; correus de les famílies per CSV; seguiment del professorat per a l'Equip Directiu; guia d'administració.
- **Servidor (Fastify + PostgreSQL)**, sense desplegar:
  - «Et veig…» amb rutes confidencials (respostes sense identificador, esborranys xifrats, llindar de 15 respostes, moderació).
  - «Em miro» i la gestió del centre: `GET /api/state` (dades retallades per rol) i `POST /api/ops` (operacions validades al servidor amb les mateixes regles que la demostració).
  - Registre d'operacions inalterable i rol `latevaveu_app` sense permisos per modificar-lo (`db/permisos.sql`).
- **Mode connectat del client**: amb `VITE_API_URL`, tota l'app treballa amb el servidor i no desa dades al navegador.
- **Capçalera**: sota el nom surt el tipus d'usuari (Alumnat ESO · 2n d'ESO, Professorat EP i ESO, Equip Directiu · Administració…).
- **Pantalla d'entrada**: capçalera amb el logo i el nom de l'escola, avís discret del domini, botons petits «Prova la demostració» i «Per què La teva veu?».
- **Presentació del projecte** (`#/projecte`): sentit, marc normatiu citat de fonts oficials (Convenció sobre els Drets de l'Infant art. 12; LOE-LOMLOE art. 1 i 91; Decret 175/2022 art. 22, 23 i 24), què fa l'app, com funciona, beneficis i privacitat.

## Pendent

1. Revisió amb l'Equip Directiu i la persona delegada de protecció de dades.
2. Triar l'allotjament del servidor (a la UE) i desplegar-lo. Abans, crear el rol `latevaveu_app` a Neon i aplicar `db/permisos.sql` (ordres dins del fitxer).
3. Client OAuth de Google aprovat a la consola de Google Workspace de l'escola.
4. Enviament real dels informes per correu a les famílies (servei institucional, cua idempotent).
5. Inventari real de les matèries d'ESO per curs i prova pilot amb alumnat de cada etapa.
6. PFI: caldria un curs i un qüestionari propis (no es pot tractar com un grup).

## Precaucions

- No pujar mai dades reals ni CSV personals al repositori; tot el que hi ha és fictici.
- No escriure claus ni cadenes de connexió (ja.cat, Neon) en fitxers, ordres o missatges: es llegeixen de l'entorn.
- No confirmar els fitxers temporals d'Office (`~$…`).
