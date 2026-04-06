# Gestió RPPO

Primera base funcional de l'aplicació de gestió d'ordinadors de préstec.

## Estructura actual

- `index.html`: pàgina principal
- `styles.css`: estils de l'aplicació
- `data.js`: dades de prova i configuració bàsica
- `app.js`: lògica principal de la interfície
- `supabase-config.js`: URL i clau pública de Supabase
- `supabase.js`: client base de Supabase
- `instruccions.md`: document funcional per a programadors
- `supabase-schema.sql`: esquema inicial de taules per a Supabase

## Prova local

Com que ara és una web estàtica, es pot obrir directament `index.html` al navegador.

Si algun navegador bloqueja imports locals de mòduls, fes servir un servidor local simple. Per exemple, amb VS Code Live Server o qualsevol servidor estàtic.

## Publicació a Github Pages

Es pot publicar directament perquè no depèn de cap procés de compilació.

## Proper pas

Executar `supabase-schema.sql` dins del panell SQL de Supabase i, després, començar a connectar les lectures i escriptures reals.
