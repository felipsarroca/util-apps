# Checklist de publicació

## Abans de Play Console

- [ ] Identitat del compte verificada.
- [ ] Correu de contacte confirmat.
- [ ] Política de privacitat revisada i publicada amb URL HTTPS.
- [ ] Captures de pantalla de l’app i dels widgets preparades.
- [ ] Clau d’upload creada i guardada en dues còpies xifrades.
- [ ] `keystore.properties` creat només localment.
- [ ] Cap clau o contrasenya dins Git.

## Fitxa de l’app

- [ ] Nom: Aniversaris.
- [ ] Descripció breu i completa copiades de `fitxa.md`.
- [ ] Categoria: Eines / Productivitat.
- [ ] Icona 512×512 o la mida que demani Play Console.
- [ ] Política de privacitat introduïda.
- [ ] Formulari de seguretat de dades revisat.
- [ ] Classificació de contingut completada.
- [ ] Públic objectiu completat.
- [ ] Declaració d’anuncis: no conté anuncis.
- [ ] Instruccions d’accés a l’app completades si Play les demana.

## Build i proves

- [ ] `versionCode` superior a l’últim publicat.
- [ ] `bundlePlayRelease` completat sense errors.
- [ ] AAB signat amb la clau d’upload.
- [ ] Proves unitàries i lint superats.
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
- [ ] Notes de versió escrites.
- [ ] Publicació inicial gradual revisada.
- [ ] URL de Google Play comprovada.
- [ ] Actualitzacions futures amb `versionCode` creixent.
