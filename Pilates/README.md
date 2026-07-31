# Pilates a mà

Aplicació web instal·lable per trobar, seguir i reprendre una selecció de classes de Pilates del canal de María Plaza Carrasco.

## Funcions principals

- Recomanació de la sessió següent amb una explicació clara.
- Repte d'iniciació de 15 dies, progressió per als genolls i progressió intermèdia.
- Col·leccions de cos complet, nivell intermedi, principiants, sessions curtes i fonaments.
- Progrés independent per voltes, repeticions i historial reversible.
- Reproductor de YouTube en un mode de sessió sense distraccions.
- Preferits, cerca i filtres.
- Resultats de cerca amb les classes preferides sempre al davant.
- Historial amb resum setmanal, calendari, tendències, continuacions, progrés i filtres.
- Classes personals afegides des del mòbil.
- Exportació, combinació i restauració de còpies de seguretat.
- PWA instal·lable amb catàleg i historial disponibles sense connexió.

Les dades personals es desen exclusivament al navegador del dispositiu. Els vídeos no es descarreguen i necessiten connexió a Internet.

## Execució local

Cal servir la carpeta per HTTP; obrir `index.html` directament no permet provar el `service worker`.

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Després, obre `http://127.0.0.1:4173/`.

També es pot utilitzar el servidor de previsualització inclòs:

```powershell
node scripts\preview-server.cjs
```

## Actualitzar el catàleg

El catàleg canònic és a `data/catalog.js`:

- `videos`: cada vídeo existeix una sola vegada i utilitza l'identificador de YouTube.
- `programs`: contenen l'ordre dels identificadors dels vídeos.
- `collections`: defineixen agrupacions i filtres de classes independents, però no dupliquen vídeos. El repte d'iniciació de 15 dies es mostra com una única targeta visual que obre directament la sessió que toca.

Cada vídeo ha de tenir identificador, títol breu, títol original, durada en segons, nivell i etiquetes. La validació en iniciar l'aplicació detecta identificadors duplicats i referències de programes inexistents.

## Proves

La prova `tests/smoke.cjs` aixeca un servidor temporal i comprova, entre altres coses:

- Navegació i disseny responsive.
- Ordre de les quinze sessions.
- Reproductor integrat de YouTube.
- Finalització, historial, persistència i acció de desfer.
- Classes personals.
- Exportació i importació combinada.
- Manifest, `service worker` i obertura sense connexió.
- Noms accessibles, textos alternatius i reflow amb text al 200 %.

Requereix Node.js, Playwright i Google Chrome. Es pot executar amb:

```powershell
node tests\smoke.cjs
```

## Publicació

La configuració utilitza rutes relatives i està preparada per funcionar dins una subcarpeta de GitHub Pages. Abans de publicar cal confirmar la llicència de la icona original d’SVG Repo i incloure l'atribució que correspongui.
