# La veu de l’alumnat · Guia per al professorat

Aplicació d’Apps Script que converteix l’autoavaluació de l’alumnat d’ESO, feta amb Google Forms, en un informe PDF individual i l’envia a les famílies. Les dades personals són al Google Workspace del centre; aquest repositori només conté el codi.

## Com es construeix l’informe

L’informe calca l’estructura del formulari. No cal configurar res: si canvieu el formulari, canvia l’informe.

| Al formulari | A l’informe |
| --- | --- |
| Títol d’una secció (p. ex. «Matemàtiques», «Com em sento a l’escola») | Apartat amb aquest títol |
| Pregunta d’escala o de valoració | Obre un bloc. Si va de l’1 al 4, es mostra amb l’escala oficial (1 NA, 2 AS, 3 AN, 4 AE); si no, com «4 de 5» |
| Pregunta oberta després d’una valoració | S’afegeix al bloc, amb el títol de la pregunta com a etiqueta |
| Caselles de selecció / graella | Llista / taula |
| «[tutor]» al títol d’una pregunta o secció | No surt a l’informe |
| Resposta buida | No surt; una matèria sense cap resposta (optativa no cursada) desapareix |
| Pregunta del nom | No surt; l’alumne s’identifica pel correu escolar |

Si una pregunta oberta té el mateix títol que la valoració anterior (p. ex. «Català» i «Català»), l’etiqueta serà el text d’ajuda de la pregunta o, si no en té, «Compromís de millora».

## Una recollida en cinc passos

1. **Prepara.** «Nova recollida»: curs, nom (p. ex. «1a avaluació») i formulari de partida. Per defecte es copia el de la recollida anterior del mateix curs. Modifica la còpia si cal i previsualitza l’informe amb respostes d’exemple.
2. **Recull.** «Obre el formulari a l’alumnat» i comparteix l’enllaç. La pantalla mostra qui ha respost. Quan acabeu, «Tanca el formulari».
3. **Revisa.** Només apareixen les excepcions: correus fora del cens, respostes antigues sense correu i alumnes que no han respost.
4. **Genera.** Previsualitza l’informe d’un alumne i prem «Genera els PDF». Es desen en una carpeta privada de la recollida.
5. **Envia.** «Envia’m una prova a mi», prepara els destinataris, aprova la recollida i envia per lots. Cada adreça familiar rep un missatge propi amb el PDF adjunt.

Cada recollida té el seu propi formulari, configurat perquè reculli el correu escolar i admeti una sola resposta per alumne.

## Desenvolupament

- Codi a `apps-script/`, sincronitzat amb `clasp` (el `.clasp.json` és local i no es publica).
- Proves locals: `node tests/local.test.mjs`.
