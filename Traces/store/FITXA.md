# Textos per a la fitxa de Chrome Web Store

Copieu cada bloc al camp corresponent de la consola de desenvolupador.

## Pestanya «Fitxa de la botiga» (Store listing)

**Idioma:** Català

**Descripció** (camp *Description*):

```text
Traces mostra al professorat, d'un cop d'ull, com s'ha elaborat un treball de Google Docs, Presentacions o Fulls de càlcul. Funciona dins del mateix fitxer i des de Google Classroom.

QUÈ MOSTRA
• Temps de treball real i dies en què s'ha treballat.
• Quina part del text s'ha escrit pas a pas i quina s'ha enganxat d'un sol cop.
• Fragments enganxats: conservats, reelaborats o eliminats, i on són al text final.
• Evolució del treball sobre el temps real de treball i reproducció pas a pas.
• Senyals breus: poques correccions, tot fet l'últim dia, ritme d'escriptura molt alt, més d'un autor.
• Presentacions: diapositives, imatges i participació de cada membre del grup.
• Fulls de càlcul: cel·les escrites a mà, enganxades i fórmules.

A CLASSROOM
• Botó «Analitza la classe» a la pàgina de la tasca i taula comparativa de tot el grup.
• Comparació amb la data de lliurament.
• Botó per escriure el resum al comentari privat (sense enviar-lo).

INFORME
• Informe d'una pàgina per imprimir o desar en PDF.

PRIVADESA
• Tot es calcula al navegador del docent. No s'envia cap text ni cap dada a cap servidor.
• Només s'analitza quan el docent ho demana i només fitxers que pot editar.

CRITERI PEDAGÒGIC
Traces no és un detector d'IA ni prova res per si sol. «Enganxat» vol dir que un fragment va entrar d'un sol cop: pot ser copiat, però també un esborrany propi, un dictat o una traducció. És un punt de partida per parlar amb l'alumne.

Programari lliure (AGPLv3). Errors i suggeriments: https://github.com/felipsarroca/util-apps/issues/new?template=traces.yml
```

**Categoria:** Educació

**Icona de la botiga (128 × 128):** `extension/icons/icon128.png`

**Captures (1280 × 800):** `store/captura-1.png`, `store/captura-2.png`, `store/captura-3.png`

**Mosaic promocional petit (440 × 280):** `store/mosaic-440x280.png`

**Vídeo promocional** (camp *Promo video*, enllaç de YouTube): `store/traces-promocional.mp4`, penjat a YouTube com a **ocult** (no llistat). Surt el primer del carrusel, abans de les captures.

- Títol: `Traces: com s'ha fet un treball de Google Docs, d'un cop d'ull`
- Descripció: `Extensió de Chrome per al professorat. Mostra com s'ha elaborat un treball de Google Docs, Presentacions o Fulls de càlcul: temps de treball, què s'ha escrit pas a pas i què s'ha enganxat d'un sol cop. Tot es calcula al navegador. No és un detector d'IA: és un punt de partida per parlar amb l'alumne. https://ja.cat/app-traces — Música i so originals.`
- Públic: «No, no és contingut creat per a nens».

**Lloc web oficial:** `https://ja.cat/app-traces`

**URL d'assistència:** `https://github.com/felipsarroca/util-apps/issues/new?template=traces.yml`

## Pestanya «Pràctiques de privadesa» (Privacy practices)

**Finalitat única** (*Single purpose*):

```text
Analitzar l'historial de versions d'un fitxer de Google (Docs, Presentacions o Fulls de càlcul) per mostrar al docent com s'ha elaborat un treball.
```

**Justificació dels permisos:**

| Permís | Text |
|---|---|
| `sidePanel` | `Mostra l'anàlisi en el panell lateral de Chrome.` |
| `activeTab` | `Identifica el fitxer de Google obert quan el docent prem el botó de Traces.` |
| `scripting` | `Llegeix l'historial de versions del fitxer obert, amb la sessió del docent, només quan ho demana.` |
| `storage` | `Desa les preferències i els resums numèrics de la taula de la classe en aquest navegador.` |
| Permisos d'amfitrió | `docs.google.com: botó dins dels fitxers i lectura de l'historial de versions. classroom.google.com: botó «Analitza la classe», data de lliurament i comentari privat. felipsarroca.github.io: lectura d'un fitxer públic per saber si hi ha una versió nova.` |

**Codi remot:** No, no faig servir codi remot.

**Dades que es recullen:** marqueu només

- Informació d'identificació personal (noms dels autors que mostra l'historial del fitxer).
- Contingut del lloc web (text i historial del fitxer analitzat).

**Certificacions:** marqueu les tres caselles (no es venen dades a tercers; no s'utilitzen per a finalitats alienes a la funció principal; no s'utilitzen per determinar la solvència creditícia).

**URL de la política de privadesa:**

```text
https://felipsarroca.github.io/util-apps/Traces/privadesa.html
```

## Pestanya «Distribució» (Distribution)

- **Pagament:** gratuït.
- **Visibilitat:** No llistat (*Unlisted*).
- **Regions:** totes.
