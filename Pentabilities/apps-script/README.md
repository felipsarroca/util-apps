# Pentabilities

Aplicació web interna per gestionar cicles, sessions i valoracions Pentabilities amb Google Apps Script i Google Sheets.

## Funcions principals

- Detecció de rol per correu.
- Contrasenya comuna per al professorat configurada a propietats del projecte.
- Creació de cicles i sessions.
- Selecció visual de comportaments.
- Codi de sessió per a l'alumnat.
- Autoavaluació, coavaluació i heteroavaluació.
- Registre normalitzat de valoracions.
- Dashboard bàsic de sessió i de cicle.

## Arquitectura

- `*.gs`: backend d'Apps Script.
- `Index.html`, `Styles.html`, `Scripts.html`: frontend integrat.
- Google Sheets: base de dades principal.
- `docs/`: desplegament, seguretat, model de dades, guia del professorat i pla de proves.

## Estat de Supabase

Supabase queda descartat de moment perquè el compte gratuït no permet crear un tercer projecte actiu. La carpeta `supabase/` es conserva només com a material de treball no actiu.
