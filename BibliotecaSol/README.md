# Biblioteca de la Sol

Aplicació web inicial per gestionar i consultar el catàleg de la biblioteca escolar de l'Escola Ramon Pont.

## Estat actual

- HTML, CSS i JavaScript pur.
- Catàleg consultable sense fotografies, amb cerca i filtres múltiples combinables.
- Inici de sessió local amb correu `@ramonpont.cat` per a consulta.
- Accés d’editor amb contrasenya per modificar el catàleg.
- Editor local per afegir, modificar i descatalogar llibres.
- Dades guardades al navegador amb `localStorage`.
- Estructura preparada per connectar Supabase en una fase posterior.

## Com provar-la

Obre `index.html` al navegador.

Perfils de prova:

- Usuari de consulta: `alumnat@ramonpont.cat`
- Usuari editor: `biblioteca@ramonpont.cat`
- Contrasenya de l’editor local: `bibliotecasol`

## Proper pas tecnic

Configurar Supabase a `js/config.js` i substituir la persistència local per crides a les taules `profiles`, `llibres` i `exemplars`, mantenint les polítiques RLS activades.
