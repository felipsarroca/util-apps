# Pentabilities

Aplicacio web per gestionar cicles, sessions i valoracions Pentabilities de l'Escola Ramon Pont.

## URL prevista

Quan el repositori `util-apps` estigui publicat amb GitHub Pages, aquesta app hauria de quedar disponible a:

```text
https://felipsarroca.github.io/util-apps/pentabilities/
```

La carpeta es diu `pentabilities` i conte l'`index.html` directament a l'arrel perque la ruta funcioni sense configuracions addicionals.

Si GitHub Desktop encara mostra la carpeta com `Pentabilities`, reanomena-la a `pentabilities` abans del commit. GitHub Pages diferencia majuscules i minuscules a la URL.

## Estructura

```text
pentabilities/
  index.html
  styles.css
  app.js
  config.js
  config.example.js
  manifest.webmanifest
  service-worker.js
  assets/
  apps-script/
  supabase/
  docs/
```

- `index.html`, `styles.css`, `app.js`: app estatica que publica GitHub Pages.
- `config.js`: configuracio activa del frontend. Nomes ha de contenir URLs i claus publiques.
- `config.example.js`: plantilla de configuracio.
- `assets/`: icones i logos necessaris per a l'app.
- `apps-script/`: backend de Google Apps Script i sincronitzacio amb Google Sheets.
- `supabase/`: configuracio i migracions SQL de Supabase.
- `docs/`: documentacio tecnica i materials de referencia.

## Notes de seguretat

- No publiquis mai claus `service_role`, contrasenyes ni tokens privats.
- `.clasp.json` queda ignorat per Git perque conte l'identificador local del projecte Apps Script.
- `supabase/.temp/` queda ignorat perque es una carpeta temporal de la CLI.
- La clau `sb_publishable_...` de Supabase del frontend es publica expressament: es una clau publica i ha d'estar protegida amb RLS i permisos correctes a la base de dades.

## Publicacio amb GitHub Desktop

1. Obre el repositori `util-apps` amb GitHub Desktop.
2. Revisa que els canvis siguin dins `pentabilities/` i `.gitignore`.
3. Fes un commit amb un missatge com:

```text
Afegeix app Pentabilities
```

4. Fes `Push origin`.
5. Comprova GitHub Pages a l'adreca indicada mes amunt.
