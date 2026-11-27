# Traces — Com s'ha elaborat un treball de Google

- **Pàgina web, descàrrega (.zip) i demostració:** <https://ja.cat/app-traces>
- **Vídeo de presentació (36 s):** <https://youtu.be/ScLl4G9Zstg>
- **Privadesa i full per a famílies:** <https://felipsarroca.github.io/util-apps/Traces/privadesa.html>
- **Errors i suggeriments:** [formulari](https://github.com/felipsarroca/util-apps/issues/new?template=traces.yml)

**Traces** és una extensió de Google Chrome en català, gratuïta i de codi obert, per al professorat. Mostra d'un cop d'ull com s'ha elaborat un treball de **Google Docs**, **Presentacions** o **Fulls de càlcul**, dins del mateix fitxer o des de **Google Classroom**. Tot es calcula al navegador: no s'envia res a cap servidor.

[![Vídeo de presentació de Traces (36 s): dos treballs, un escrit pas a pas i un d'enganxat](./captures/video.jpg)](https://youtu.be/ScLl4G9Zstg)

---

## Què mostra

- **Fitxa de l'alumne:** temps de treball, percentatge escrit pas a pas i percentatge enganxat, amb una franja dels dies treballats.
- **Senyals breus:** poques correccions, tot fet l'últim dia, ritme d'escriptura molt alt, fragments moguts (text propi retallat i enganxat, que no compta com a enganxat) i nombre d'autors.
- **Data de lliurament:** la llegeix de Classroom (o l'escriviu vosaltres) i indica quan es va començar, quina part es va fer les últimes 24 h i si hi ha feina fora de termini.
- **Evolució sobre el temps real de treball:** les pauses no ocupen espai, de manera que un salt vertical vol dir molt text en poc temps.
- **Pestanya Text:** fragments enganxats (conservats, reelaborats o eliminats), mapa acolorit del text final i reproducció pas a pas amb el botó «Següent enganxat».
- **Presentacions:** diapositives amb paraules, imatges, enganxats i qui hi ha participat.
- **Fulls de càlcul:** cel·les escrites a mà, enganxades i fórmules, per autor, i llista de dades enganxades.
- **Documents amb pestanyes:** analitza totes les pestanyes.
- **Classroom:** botó **Analitza la classe** a la pàgina de la tasca, etiquetes al costat de cada treball i taula comparativa ordenable (exportable en CSV). Al qualificador, botó **Al comentari privat**, que escriu el resum sense enviar-lo.
- **Informe d'una pàgina** per imprimir o desar en PDF.
- **Segell de fiabilitat** sempre visible i avís clar si Google canvia el format intern.

| Resum | Text | Sessions |
|---|---|---|
| ![Resum](./captures/resum.png) | ![Text](./captures/text.png) | ![Sessions i autors](./captures/sessions-autors.png) |

---

## Com instal·lar-la (pas a pas)

1. Descarregueu `Traces-Chrome.zip` des de <https://ja.cat/app-traces> i descomprimiu-lo.
2. Obriu Chrome i escriviu a la barra d'adreces `chrome://extensions`.
3. Activeu **Mode de desenvolupador** (a dalt a la dreta).
4. Premeu **Carrega descomprimida** i trieu la carpeta descomprimida (en aquest repositori, `Traces/extension`).
5. A la icona de la peça de trencaclosques, fixeu la icona de Traces.

Per evitar el mode de desenvolupador o instal·lar-la a tot el claustre, vegeu [PUBLICACIO.md](./PUBLICACIO.md) (Chrome Web Store no llistada i consola d'administració de Google Workspace).

## Com fer-la servir

- **Un treball:** obriu el fitxer (cal permís d'edició) i premeu el botó **Traces** de dalt a la dreta. Si la finestra és prou ampla, el fitxer s'estreny per fer lloc al panell.
- **Al qualificador de Classroom:** el botó apareix a baix a la dreta del treball. En passar a l'alumne següent, Traces l'analitza sol.
- **Tota la classe:** obriu la tasca a Classroom (pestanya *Treball de l'alumnat*) i premeu **Analitza la classe**. La taula es consulta amb la icona de taula del panell.

## Com actualitzar-la

Quan hi ha una versió nova, Traces ho avisa amb una fletxa taronja a la icona. Descarregueu de nou el `.zip`, substituïu el contingut de la mateixa carpeta i premeu **↻** a `chrome://extensions`.

> **Criteri pedagògic:** Traces no és un detector d'IA ni prova res per si sol. «Enganxat» vol dir que un fragment va entrar d'un sol cop: pot ser copiat, però també un esborrany propi, un dictat o una traducció. És un punt de partida per parlar amb l'alumne.

---

## Desenvolupament

```bash
npm install
npm test          # proves amb Vitest
npm run build     # compila l'extensió a extension/
```

Estructura:

- `src/extractor/` lectura de l'historial (Docs, Presentacions i Sheets).
- `src/core/` intèrprets dels formats interns, reconstrucció del text i mètriques.
- `src/content/` botó dins dels fitxers (`docsToolbarButton.ts`) i integració amb Classroom (`classroom.ts`).
- `src/ui/` panell (React).
- `video/` vídeo de presentació: animació, renderitzador i banda sonora sintetitzada (vegeu `video/README.md`). El resultat és `store/traces-promocional.mp4`.

Si Google canvia el format intern, el segell de fiabilitat passa a vermell i les proves de `tests/` ajuden a localitzar el canvi.

---

## Autoria i llicència

Extensió de [Felip Sarroca](https://ja.cat/felipsarroca).

- **Codi font:** [GNU AGPLv3 o posterior](./LICENSE)
- **Continguts, textos i disseny gràfic:** [Creative Commons BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ca)
