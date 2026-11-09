# La vostra opinió

Qüestionari web (pàgina estàtica) per conèixer la valoració de les famílies de l'Escola Ramon Pont. L'han pensat per a famílies amb pocs coneixements de català i poca experiència digital, i es fa servir sobretot amb el mòbil. Està en **castellà**, **darija** (de dreta a esquerra) i **català**. Les respostes es desen en un full de càlcul de Google amb un resum visual per curs escolar.

**Enllaç per a les famílies:** [ja.cat/valorans](https://ja.cat/valorans)

| Tria d'idioma (mòbil) | Pregunta 1 (mòbil) | Pregunta 4 en darija (ordinador) |
|---|---|---|
| ![Tria d'idioma](captures/mobil-idioma.png) | ![Pregunta 1](captures/mobil-pregunta1.png) | ![Pregunta 4](captures/ordinador-pregunta4-darija.png) |

## Què demana

1. Per quins motius van triar l'escola (fins a 3 respostes, «Una altra raó» inclosa).
2. Què és el que més valoren després dels primers mesos (diverses respostes).
3. Com recomanarien l'escola en una sola frase (opcional i en qualsevol llengua).
4. De l'1 al 10, amb quina probabilitat recomanarien l'escola.

Característiques:

- Una pregunta per pantalla, amb icones grans i botons fàcils de tocar.
- Botó 🔊 per escoltar la pregunta. En darija hi ha àudios gravats (`audio/ar-*.mp3`, veu generada amb ElevenLabs), que sonen a tots els dispositius; en castellà i català s'usa la veu del dispositiu si en té.
- És anònim. El mòbil recorda que ja s'ha respost, però permet tornar a respondre.
- La interfície s'adapta al mòbil, al portàtil (1366×740) i a les pantalles grans.

## Full de càlcul

El full és a la unitat de Drive del compte de l'escola: *Valoració de les famílies · Escola Ramon Pont*.

| Pestanya | Contingut |
|---|---|
| 📊 Resum | Desplegable del curs escolar, xifres clau (respostes, nota mitjana, % que recomanen molt i idiomes), barres per a cada opció i distribució de les notes amb colors de semàfor |
| 💬 Frases | Frases del curs triat, amb traducció automàtica al català |
| 🗂️ Respostes | Una fila per resposta (no cal tocar-la) |

El curs escolar es calcula automàticament: de setembre a juny és un mateix curs (per exemple, 2026-2027).

## Cartell per imprimir

La carpeta `cartell/` conté el cartell A4 amb el codi QR i l'enllaç en els tres idiomes:

- `Cartell QR valoració famílies.pdf`: per imprimir.
- `cartell.html`: font editable. Es converteix a PDF amb Chrome.

## Estadístiques per a l'equip directiu

A la pantalla d'inici hi ha un botó discret **📊 Estadístiques**. En clicar-hi, es demana entrar amb un compte de Google:

- Si el compte té accés al full de càlcul (propietari, editor o lector), es mostra un tauler amb les xifres clau, els motius de tria, el que més valoren, la distribució de notes, les frases (amb traducció), les altres respostes escrites i l'evolució per cursos.
- Si no hi té accés, es torna a l'app amb un avís breu i no es mostra res.

Per donar accés a algú, només cal compartir-li el full de càlcul. Els accessos per grup de Google o per domini sencer no es detecten: cal compartir-lo amb cada persona.

## Arquitectura

| Part | On és | Funció |
|---|---|---|
| App de les famílies | GitHub Pages: `util-apps/ValoracioEscola/` | Web estàtica: s'obre sempre, sense iniciar sessió |
| Servidor | Apps Script (`Codi.gs`), compte de l'escola | Rep les respostes (`doPost`), les desa al full i serveix les estadístiques als comptes autoritzats |
| Dades i resum | Full de càlcul de l'escola | Respostes, resum visual i frases, només per a qui hi tingui accés |

| Fitxer | Funció |
|---|---|
| `index.html`, `estils.css`, `app.js` | Qüestionari en tres idiomes |
| `estadistiques.js` | Inici de sessió amb Google i tauler d'estadístiques |
| `config.js` | URL del servidor i identificador de client OAuth (públic) |
| `Codi.gs`, `appsscript.json` | Servidor d'Apps Script |
| `logo.png`, `llicencia.png`, `favicon.svg` | Imatges |

L'URL antic de l'script redirigeix a l'app nova.

## Instal·lació i manteniment

Projecte d'Apps Script gestionat amb `clasp` amb el compte de l'escola (`clasp --user ramonpont`). Només es pugen `Codi.gs` i `appsscript.json` (vegeu `.claspignore`).

1. `clasp --user ramonpont push --force`
2. Primera vegada: a l'editor d'Apps Script, executeu **`configura`** (crea el full) i **`autoritza`** (accepta el permís per comprovar l'inici de sessió).
3. Per publicar canvis sense canviar l'URL: `clasp --user ramonpont update-deployment AKfycbzERbkL1jKSQA3ub5PvpKTkCC0Kmbe2wHWCOV-1XyQ5as3n-oBDnsMO0ARd49kX-kwqgw`
4. L'app web es publica en fer push a `main` del repositori `util-apps`.

### Client OAuth per a les estadístiques

Es crea una sola vegada a [Google Cloud Console](https://console.cloud.google.com/) amb el compte de l'escola: pantalla de consentiment de tipus **Intern** i client de tipus **Aplicació web** amb l'origen `https://felipsarroca.github.io`. L'identificador es posa a `config.js` (`clientId`) i a `Codi.gs` (`CLIENT_ID`). Si és buit, el botó d'estadístiques no apareix.

Seguretat: el servidor valida les opcions amb una llista tancada, limita la llargada dels textos, neutralitza els textos que comencen amb `=`, `+`, `-` o `@` i no permet executar `configura` des de la web. Les estadístiques només es retornen si Google confirma la identitat (credencial verificada, adreçada a aquest client i no caducada) i el compte té el full compartit.

---

Aplicació creada per [Felip Sarroca](https://ja.cat/felipsarroca) amb assistència de la IA · Obra sota llicència [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ca)
