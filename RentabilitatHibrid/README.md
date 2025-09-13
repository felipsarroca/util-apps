# Rentabilitat híbrid endollable

Calculadora senzilla per estimar si surt a compte carregar un híbrid endollable (p. ex. Volvo XC90 T8) segons el preu del combustible i de l’electricitat. L’eina compara el cost aproximat de fer 30 km en mode combustió i en mode elèctric, i ho visualitza en un gràfic interactiu.

Nota: a la interfície s’etiqueta el combustible com “dièsel”, però pots introduir el preu que correspongui al teu vehicle (dièsel o benzina). Els càlculs són genèrics i depenen dels paràmetres de consum descrits a sota.

## Què fa l’aplicació

- Entrada de preus: preu del combustible (€/L) i preu de l’electricitat (€/kWh) amb validació i lliscadors.
- Resultat per a 30 km: mostra el cost estimat en combustible i el cost en electricitat, l’estalvi o la pèrdua i un indicador visual (verd/vermell i polze amunt/avall).
- Gràfic d’equilibri: traça la recta on els dos costos s’igualen i dibuixa les línies vertical/horizontal segons els valors introduïts, amb el punt d’intersecció.
- Preu d’equilibri: si només introdueixes un dels dos preus, calcula l’altre preu amb el qual el cost seria igual.
- Accessibilitat bàsica: pots prémer “Enter” per calcular; validació d’intervals per evitar errors d’entrada.

## Model i supòsits de càlcul

- Distància de referència: 30 km.
- Consum de combustible (mode híbrid/ICE): 0,085 L/km (equivalent a 8,5 L/100 km).
- Consum elèctric per a 30 km: 7 kWh.

Amb aquests valors, el cost s’estima així per al tram de 30 km:

- Cost en combustible: `cost_combustible = 0,085 × 30 × preu_combustible` (€)
- Cost en electricitat: `cost_elèctric = 7 × preu_electricitat` (€)

La recta d’equilibri del gràfic i el criteri de decisió deriven del factor:

`FACTOR = (0,085 × 30) / 7 = 0,364`

- Preu elèctric d’equilibri per a un combustible donat: `preu_electricitat_eq = preu_combustible × 0,364`
- És més barat carregar si: `preu_electricitat_actual ≤ preu_electricitat_eq`

## Intervals recomanats d’entrada

- Combustible: de 1,00 a 2,00 €/L
- Electricitat: de 0,10 a 1,00 €/kWh

## Exemple ràpid

Suposa `preu_combustible = 1,50 €/L` i `preu_electricitat = 0,20 €/kWh`:

- `cost_combustible = 0,085 × 30 × 1,50 = 3,83 €`
- `cost_elèctric = 7 × 0,20 = 1,40 €`
- Estalvi per 30 km: `3,83 − 1,40 = 2,43 €` → convé carregar (verd)
- Preu elèctric d’equilibri: `1,50 × 0,364 = 0,546 €/kWh`

## Com fer-la servir en local

1. Descarrega o clona el repositori.
2. Obre el fitxer `index.html` amb el navegador.
3. Introdueix un o dos preus i clica “Calcula” (o prem Enter).

Opcional: amb l’extensió “Live Server” (VS Code) pots obrir `index.html` i veure canvis al moment.

## Publicació a GitHub Pages (opcional)

1. A GitHub, ves a `Settings` → `Pages`.
2. A “Build and deployment”, escull `Deploy from a branch`.
3. Branca `main`, carpeta `/root` i desa. L’app quedarà disponible com a pàgina estàtica.

## Personalització

Els paràmetres principals són a `index.html` (mateixa lògica a `rentabilitat.html`):

- `DIESEL_CONS = 0.085`  → consum de combustible en L/km.
- `ELEC_CONS = 7`        → kWh per a 30 km.
- Distància de càlcul: constant `30` dins del càlcul del cost de combustible (`0,085 × 30 × preu`) i del factor.
- `FACTOR = 0.364`       → derivat de `(0,085 × 30) / 7`.

Pots ajustar aquests valors per adaptar-los al teu vehicle i recorregut de referència. Si canvies la distància o els consums, recalcula el `FACTOR` en conseqüència.

## Eines i dependències

- HTML, CSS i JavaScript pur (frontend estàtic).
- Chart.js i `chartjs-plugin-annotation` per al gràfic (via CDN).
- Google Fonts (Montserrat).

## Limitacions i advertiments

- Són càlculs aproximats pensats per comparar ordres de magnitud, no per comptabilitat fina.
- No es tenen en compte variacions de conducció, temperatura, orografia, degradació de la bateria, pèrdues de càrrega o altres costos (p. ex. peatges, aparcament).
- La UI utilitza l’etiqueta “dièsel”; si el teu vehicle és de benzina, introdueix-hi el preu de la benzina i ajusta els consums si cal.

## Autor

Felip Sarroca — projecte educatiu/didàctic per avaluar la conveniència de la càrrega en PHEV.

Si detectes un error o tens millores, obre un Issue o un Pull Request.

