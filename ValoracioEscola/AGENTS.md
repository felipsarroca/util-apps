# Normes per als agents · La vostra opinió

L'ús de l'app és al `README.md`. Aquí hi ha les decisions que no s'han de desfer.

- **Configuració regional del full: `en_US`.** `configura()` la fixa (`setSpreadsheetLocale`). En `ca_ES`, les fórmules amb comes donen `#ERROR!`. La nota mitjana es mostra amb coma per format, no canviant la configuració regional.
- **Manteniment del full.** `configura()` refà Resum, Frases i la llista de cursos sense tocar les respostes. `diagnostica()` llista les cel·les amb error i, si tot va bé, ha de dir «Cap error trobat». Executa-la després de qualsevol canvi de fórmules.
- **Qui veu les estadístiques.** Només qui té el full compartit persona a persona (propietari, editors o lectors). Compartir amb un grup o amb «qualsevol persona amb l'enllaç» no hi dona accés. El client OAuth és de tipus Intern. No escriguis l'ID del client ni adreces de correu en cap fitxer del repositori.
- **Àudios en darija** (`audio/ar-*.mp3`). Fets amb ElevenLabs i la veu àrab predeterminada, perquè la marroquina no és al pla gratuït. Cap parlant n'ha validat l'accent encara.
- **Mòbil.** En pantalles estretes (390 i 360 px) tot és un 10 % més petit. Conserva aquestes escales.
- **Ordre dels idiomes a la portada:** català, castellà i darija, de dalt a baix.
- **Peu.** «Aplicació creada per Felip Sarroca amb IA» i «Obra sota llicència CC BY-NC-SA 4.0». El cartell PDF encara diu «amb assistència de la IA»: no el regeneris sense preguntar, perquè pot estar imprès.
- **Enllaç públic.** ja.cat/valorans apunta a GitHub Pages, no a l'script. L'URL antic de l'script mostra un botó «Començar» que porta a l'app.
