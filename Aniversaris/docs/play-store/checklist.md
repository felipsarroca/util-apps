# Checklist de publicació

## Abans de Play Console

- [x] Identitat del compte verificada.
- [x] Correu de contacte confirmat i publicat a la fitxa.
- [x] Política de privacitat revisada i publicada amb URL HTTPS.
- [x] Captures anonimitzades preparades en format 9:16 (1.080 × 1.920).
- [x] Gràfic promocional preparat (1.024 × 500).
- [ ] Clau d’upload creada i guardada en dues còpies xifrades.
- [x] `keystore.properties` creat només localment.
- [x] Cap clau o contrasenya dins Git.

## Fitxa de l’app

- [x] Nom: Aniversaris.
- [x] Descripció breu i completa desades com a esborrany a Google Play.
- [x] Categoria: Eines.
- [x] Icona 512×512 preparada.
- [x] Icona 512×512, imatge destacada 1.024×500 i cinc captures anonimitzades pujades a la fitxa catalana.
- [x] Recursos visuals revisats i etiquetats individualment com a creats o editats amb assistència d’IA.
- [x] Fitxa predeterminada completada i desada amb l’estat «A punt per enviar a revisió».
- [x] Política de privacitat introduïda.
- [x] Formulari de seguretat de dades completat i desat, pendent d’enviar a revisió amb la resta de canvis.
- [x] Classificació de contingut completada: PEGI 3 a Europa i ESRB per a tots els públics.
- [x] Públic objectiu definit per a 13 anys o més.
- [x] Declaració d’anuncis: no conté anuncis.
- [x] Instruccions d’accés completades: tota la funcionalitat està disponible sense cap accés especial.
- [x] Declaracions d’aplicació governamental, funcions financeres i salut completades.
- [x] Declaració d’identificador de publicitat: el codi i el manifest combinat confirmen que no s’utilitza `AD_ID`, i s’ha desat la resposta «No» a Play Console.

## Build i proves

- [x] `versionCode` 7, superior al 6 publicat al canal intern.
- [x] `bundlePlayRelease` completat sense errors.
- [x] AAB signat amb la clau d’upload.
- [x] Proves unitàries i lint de les variants GitHub i Play superats.
- [ ] Instal·lació des de prova interna.
- [ ] Permís `READ_CONTACTS` i selecció de compte verificats.
- [ ] Dates múltiples, anys, fotos i dates d’avui verificats.
- [ ] Widgets 3×1 i 4×1 verificats en clar i fosc.
- [ ] Actualització Play verificada.

## Prova tancada

- [ ] Canal de prova tancada creat.
- [ ] Com a mínim 12 testers inscrits, si el compte és personal nou.
- [ ] Els testers han estat inscrits contínuament durant 14 dies.
- [ ] Incidències recollides i resoltes.
- [ ] Sol·licitud d’accés a producció enviada.

## Producció

- [ ] Producció habilitada per Google.
- [x] Notes de versió 1.6.0 escrites.
- [ ] Publicació inicial gradual revisada.
- [ ] URL de Google Play comprovada.
- [ ] Actualitzacions futures amb `versionCode` creixent.
