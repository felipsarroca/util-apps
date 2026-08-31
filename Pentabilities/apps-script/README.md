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

## Estat dins l'arquitectura actual

L'aplicació canònica publicada a GitHub Pages utilitza Supabase com a backend i Supabase Auth per a l'accés amb Google. Aquesta carpeta conserva la integració amb Google Sheets i una implementació anterior de la interfície. El seu sistema de contrasenya no s'ha d'utilitzar com a autenticació de la versió canònica.
