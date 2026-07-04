# Desplegament

## Arquitectura acordada

L'app queda basada en Google Apps Script i Google Sheets.

- Google Apps Script serveix la interfície web i valida rols/permisos.
- Google Sheets és la base de dades principal.
- Les pestanyes editables permeten mantenir alumnat, correus i professorat.
- Les pestanyes internes desen cicles, sessions, comportaments seleccionats i valoracions.
- Supabase queda aturat perquè el compte gratuït no permet crear un tercer projecte actiu.

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

La carpeta `supabase/` queda com a material de treball no actiu. No és necessària per desplegar ni fer servir l'app actual.
