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

## Una recollida en cinc passos (tutor o tutora)

1. **Prepara.** «Nova recollida»: curs, nom (p. ex. «1a avaluació») i formulari de partida. Per defecte es copia el de la recollida anterior del mateix curs. Modifica la còpia si cal i previsualitza l’informe amb respostes d’exemple.
2. **Recull.** «Obre el formulari a l’alumnat» i comparteix l’enllaç. La pantalla mostra qui ha respost. Quan acabeu, «Tanca el formulari».
3. **Revisa.** Només apareixen les excepcions: correus fora del cens, respostes antigues sense correu i alumnes que no han respost.
4. **Genera.** Previsualitza l’informe d’un alumne i prem «Genera els PDF». Es desen en una carpeta privada de la recollida.
5. **Envia.** «Envia’m una prova a mi», «Prepara els destinataris» i «Aprova i envia a totes les famílies». Els lots es fan sols. Cada adreça familiar rep un missatge propi amb el PDF adjunt.

Cada recollida té el seu propi formulari, configurat perquè reculli el correu escolar i admeti una sola resposta per alumne. Qualsevol tutor o tutora pot fer els cinc passos del seu curs; la cap d’estudis, els de tots els cursos.

## Lliurament en paper

Al pas 5, «PDF de tots els informes» o «PDF només dels alumnes sense correu familiar» crea un sol fitxer preparat per imprimir a doble cara: cada informe comença en una cara nova. Tots els informes acaben amb un acusament de lectura retallable (nom i DNI/NIE del pare, mare o tutor/a legal, data i signatura) que l’alumne retorna al tutor o tutora.

Els colors de l’informe estan pensats perquè es llegeixi igual de bé imprès en blanc i negre.

## Inici de cada curs (cap d’estudis o coordinació)

A «Preparació del centre», en aquest ordre:

1. **Cens.** Enganxa l’enllaç del cens nou. Ha de tenir una pestanya per curs («1r.ESO», «1r ESO», «Primer d’ESO»…) amb el nom, l’ID i el correu escolar de cada alumne.
2. **Famílies.** Carrega el CSV de responsables exportat aquest curs. Només cal que tingui, en qualsevol ordre, les columnes de curs, nom de l’alumne, nom del responsable i correu. Si un nom no coincideix amb el cens, tria l’alumne correcte o exclou-lo; la llista es refà sola. Acaba amb «Valida el directori».
3. **Persones amb accés.** Treu els tutors de l’any anterior i afegeix els nous: «Tutor/a d’un curs» o «Cap d’estudis o coordinació».
4. **Enviament.** Activa l’enviament quan el directori estigui validat.

Les preguntes poden canviar d’un any a l’altre: la primera recollida de cada curs copia la de l’any anterior, i n’hi ha prou d’editar el formulari copiat.

## Desenvolupament

- Codi a `apps-script/`, sincronitzat amb `clasp` (el `.clasp.json` és local i no es publica).
- Proves locals: `node tests/local.test.mjs`.
