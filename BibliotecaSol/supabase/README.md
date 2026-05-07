# Estructura de Supabase

Aquest directori prepara la base de dades de la Biblioteca de la Sol.

## Fitxer principal

- `schema.sql`: crea taules, índexs, funcions, polítiques RLS i opcions inicials.

## Connexió amb l'app

Després d'executar `schema.sql`, copia a `js/config.js`:

```js
supabaseUrl: "https://EL_TEU_PROJECTE.supabase.co",
supabaseAnonKey: "LA_TEVA_ANON_KEY",
```

Amb aquests valors:

- el catàleg es carregarà de Supabase;
- els accessos quedaran registrats a `app_users` i `access_logs`;
- les reserves es desaran a `reservations`;
- el gestor podrà convertir reserves en préstecs, renovar 15 dies i registrar devolucions;
- si Supabase no està configurat o falla, l'app continuarà funcionant amb `localStorage`.

Important: quan Supabase estigui configurat correctament, el catàleg vindrà de la taula `books`. Si aquesta taula encara és buida, l'app mostrarà 0 llibres. Després d'executar l'esquema caldrà importar els llibres reals o donar-los d'alta amb el gestor quan tinguem l'autenticació de Supabase activada.

## Taules

- `app_users`: usuaris que entren a l'app. Es creen o actualitzen quan introdueixen el correu.
- `access_logs`: historial d'accessos. Cada entrada queda registrada.
- `books`: catàleg de llibres, amb exemplars totals i exemplars disponibles.
- `reservations`: reserves demanades pels usuaris.
- `loans`: préstecs actius o retornats.
- `returns`: registre específic de devolucions.
- `book_options`: opcions reutilitzables per edat, temàtica, gènere i ubicació.
- `email_notifications`: registre dels avisos de correu enviats, omesos o fallits.

## Avisos per correu

Hi ha dues Edge Functions preparades:

- `notify-reservation`: s'executa quan es registra una reserva i avisa `biblioteca@ramonpont.cat`.
- `daily-loan-reminders`: revisa préstecs actius i envia avisos de cortesia quan falten pocs dies, quan venç el termini o quan ja s'ha superat.

Per enviar correus reals hi ha dues opcions. La principal és Google Apps Script, perquè permet enviar des del compte de Gmail de la biblioteca sense tocar DNS:

```powershell
supabase secrets set GOOGLE_MAIL_WEBHOOK_URL="URL_DE_L_APPS_SCRIPT" GOOGLE_MAIL_WEBHOOK_TOKEN="TOKEN_SECRET" LIBRARY_EMAIL=biblioteca@ramonpont.cat --project-ref jqabmywmbvvlacpzujup
```

També queda preparada l'alternativa amb Resend:

```powershell
supabase secrets set RESEND_API_KEY=LA_TEVA_CLAU RESEND_FROM="Biblioteca de la Sol <avisos@el-teu-domini.cat>" LIBRARY_EMAIL=biblioteca@ramonpont.cat --project-ref jqabmywmbvvlacpzujup
```

Si no hi ha cap sistema configurat, les funcions no fallen: deixen la notificació marcada com a `skipped` perquè l'app pugui continuar funcionant.

La funció `daily-loan-reminders` s'ha de programar al Dashboard de Supabase com a tasca diària, per exemple cada matí. La funció de reserves s'invoca directament des de l'app quan es crea una reserva.

## Criteri de seguretat

- El catàleg actiu es pot consultar públicament.
- Qualsevol correu `@ramonpont.cat` pot quedar registrat i fer reserves.
- La gestió real de llibres, préstecs i devolucions queda preparada per a Supabase Auth amb `biblioteca@ramonpont.cat`.

No convé permetre que la gestió depengui només d'una contrasenya guardada al JavaScript del navegador, perquè es podria inspeccionar. Per això l'esquema ja preveu el pas segur: autenticar el compte de biblioteca amb Supabase Auth abans d'escriure dades de gestió.
