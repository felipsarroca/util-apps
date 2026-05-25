# Instruccions per al desenvolupament de l'aplicació "Biblioteca de prompts"

## Objectiu general

Desenvolupar una aplicació web responsive destinada a emmagatzemar, organitzar, cercar, editar, copiar i reutilitzar prompts utilitzats en eines d'intel·ligència artificial.

L'aplicació està pensada per a un ús personal intensiu i ha de prioritzar:

- Rapidesa d'ús.
- Simplicitat.
- Fiabilitat.
- Bona organització.
- Cerca potent.
- Disseny atractiu i visual.

L'usuari principal genera habitualment prompts per a Notebook LM, Gemini, ChatGPT, Canva i altres eines similars.

---

# Filosofia de disseny

## Principis generals

L'aplicació ha de ser:

- Elegant.
- Moderna.
- Colorida.
- Molt visual.
- Professional.
- Extremadament intuïtiva.

Cal aprofitar bé tot l'espai disponible de la pantalla.

S'han d'evitar:

- Grans marges inútils.
- Espais desaprofitats.
- Interfícies excessivament minimalistes que obliguin a fer massa clics.

L'aplicació ha de funcionar correctament en:

- Ordinadors.
- Tauletes.
- Telèfons mòbils.

---

# Aspecte visual

## Elements visuals

Tots els elements importants han d'incloure una representació gràfica.

Exemples:

- Cercar → lupa.
- Copiar → portapapers.
- Editar → llapis.
- Eliminar → paperera.
- Duplicar → còpia.
- Exportar → fletxa de sortida.
- Categories → carpeta.
- Etiquetes → etiqueta.
- Programa → icona específica.

Els icones han de formar part del disseny i no limitar-se a ser simples decoracions.

---

# Tecnologia

## Emmagatzematge inicial

L'aplicació utilitzarà Google Sheets com a base de dades permanent.

Motivacions:

- Facilitat de manteniment.
- Simplicitat.
- Possibilitat d'edició manual.
- Còpies de seguretat senzilles.

No es preveu migrar l'aplicació a Supabase.

## Tecnologia de l'aplicació

L'aplicació es desenvoluparà amb:

- HTML.
- CSS.
- JavaScript.

Ha de ser una aplicació estàtica compatible amb GitHub Pages, sense necessitat de processos de compilació ni de serveis d'allotjament addicionals.

L'usuari publicarà personalment el projecte a GitHub Pages quan estigui acabat.

## Connexió amb Google Sheets

La comunicació entre l'aplicació estàtica i Google Sheets es realitzarà mitjançant un petit Google Apps Script vinculat al full de càlcul.

Decisions acordades:

- No s'implementarà autenticació en la primera versió.
- No es consideren sensibles els continguts emmagatzemats.
- S'accepta que l'enllaç públic de l'aplicació i del connector puguin permetre accedir a les dades si es comparteixen.
- L'exportació servirà també per generar còpies de seguretat.

El projecte haurà d'incloure el codi de Google Apps Script necessari i instruccions clares per configurar-lo.

---

# Estructura de dades

## Prompt

Cada prompt ha de contenir com a mínim:

- ID únic.
- Títol.
- Prompt.
- Programa.
- Categoria.
- Etiquetes.
- Notes.
- Favorit.
- Data de creació.
- Data de modificació.
- Número de versió.

## Historial de versions

Cada modificació d'un prompt ha de generar una còpia de la versió anterior en un historial.

L'historial contindrà com a mínim:

- ID del registre d'historial.
- ID del prompt original.
- Número de versió.
- Títol i contingut del prompt.
- Programa, categories i etiquetes.
- Notes i estat de favorit.
- Data en què es va substituir la versió.

En una primera fase, l'aplicació desarà aquest historial. La consulta detallada i restauració de versions es podrà incorporar en una fase posterior.

---

# Programa

Els programes són editables.

Exemples inicials:

- Notebook LM
- Gemini
- ChatGPT
- Canva

Cada programa disposarà de:

- Nom.
- Color.
- Icona.

L'usuari podrà:

- Crear programes.
- Editar programes.
- Eliminar programes.

---

# Categories

Les categories són editables.

Exemples inicials:

- Presentació
- Infografia
- Mapa mental
- Rúbrica
- Còmic

Característiques:

- Un prompt pot pertànyer a múltiples categories.
- Cada categoria té color propi.
- Cada categoria té icona pròpia.

Operacions:

- Crear.
- Editar.
- Eliminar.

La fusió de categories es reserva per a una fase posterior.

---

# Etiquetes

Les etiquetes són completament lliures.

Exemples:

- Socials
- Religió
- Matemàtiques
- ESO
- Visual thinking
- A4
- Famílies
- Avaluació

Característiques:

- Un prompt pot tenir múltiples etiquetes.
- Cada etiqueta té color propi.
- Cada etiqueta pot tenir icona opcional.

Operacions:

- Crear.
- Editar.
- Eliminar.

La fusió d'etiquetes es reserva per a una fase posterior.

---

# Pantalla principal

La pantalla principal ha de mostrar:

- Cercador principal.
- Filtres.
- Llista de prompts.

La distribució ha d'aprofitar al màxim l'espai disponible.

---

# Cercador

El cercador és una funcionalitat crítica.

Ha de permetre buscar simultàniament per:

- Títol.
- Text del prompt.
- Programa.
- Categoria.
- Etiquetes.

Ha de ser possible combinar filtres.

La cerca ha de:

- Actualitzar els resultats immediatament.
- Ignorar diferències entre majúscules i minúscules.
- Ignorar accents per facilitar les cerques.
- Permetre filtrar també per favorits.

---

# Visualització dels prompts

Cada prompt s'ha de mostrar com una targeta visual.

Cada targeta mostrarà:

- Títol.
- Programa.
- Categories i etiquetes.
- Fragment del prompt.
- Estrella per marcar o desmarcar com a favorit.
- Botó principal per copiar.
- Accions per editar, duplicar i eliminar.

---

# Còpia ràpida

Ha d'existir un botó gran i visible:

"Copiar prompt"

Només s'ha de copiar el contingut del prompt, sense format afegit.

---

# Exportació

Formats obligatoris:

- CSV
- JSON

L'exportació JSON inclourà totes les dades necessàries per conservar una còpia de seguretat completa: prompts, programes, categories, etiquetes i historial.

---

# Abast de la primera versió

La primera versió funcional inclourà:

- Visualització de prompts en targetes.
- Creació, edició, duplicació i eliminació de prompts.
- Còpia ràpida del text del prompt.
- Cerca global i filtres combinables.
- Favorits.
- Historial automàtic de modificacions.
- Exportació CSV i JSON.
- Gestió bàsica de programes, categories i etiquetes.
- Disseny adaptable a ordinadors, tauletes i telèfons.

Es deixa per a fases posteriors:

- Restauració visual de versions antigues.
- Fusió de categories i etiquetes.
- Importació de dades.
- Plantilles amb variables.
- Estadístiques d'ús.

---

# Peu de pàgina obligatori

Aplicació creada per Felip Sarroca amb assistència de la IA

https://ja.cat/FelipSarroca

Obra sota llicència CC BY-NC-SA 4.0

https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ca
