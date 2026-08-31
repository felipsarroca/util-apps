# Desplegament

## Arquitectura d'aquesta implementació

L'app queda basada en Google Apps Script i Google Sheets.

- Google Apps Script serveix la interfície web i valida rols/permisos.
- Google Sheets és la base de dades principal.
- Les pestanyes editables permeten mantenir alumnat, correus i professorat.
- Les pestanyes internes desen cicles, sessions, comportaments seleccionats i valoracions.
- La interfície d'Apps Script es conserva com a implementació anterior.

L'aplicació canònica publicada a GitHub Pages utilitza Supabase i autenticació amb Google. El seu desplegament es descriu a `../SUPABASE_GOOGLE_AUTH.md`.

## Configuració necessària

Al projecte Apps Script cal definir aquesta propietat:

- `PENTABILITIES_TEACHER_PASSWORD`: contrasenya comuna del professorat.

No posis aquesta contrasenya al codi ni al frontend.

## Passos

1. Executa `clasp push` des de la carpeta `pentabilities-app`.
2. Obre el projecte amb `clasp open`.
3. Executa manualment `appHealthcheck` una primera vegada per autoritzar permisos.
4. Revisa que s'ha creat o detectat el Google Sheets `Pentabilities - Base de dades`.
5. Desplega com a aplicació web.
6. Mantén l'execució com a usuari que desplega.

## Dades

La primera execució crea automàticament un Google Sheets anomenat `Pentabilities - Base de dades` i hi prepara les pestanyes necessàries.

Pestanyes editables:

- `1r dESO`
- `2n dESO`
- `3r dESO`
- `4t dESO`
- `Professorat`

Pestanyes internes:

- `Alumnes`
- `Professorat_App`
- `Cursos_Escolars`
- `Habilitats`
- `Comportaments`
- `Cicles`
- `Sessions`
- `Sessio_Comportaments`
- `Sessio_Heteroalumnes`
- `Avaluacions`

## Notes sobre Supabase

Aquest procediment només desplega la implementació d'Apps Script. No configura ni publica l'aplicació canònica de GitHub Pages i Supabase.
