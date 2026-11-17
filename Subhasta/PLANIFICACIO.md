# Subhasta: document de disseny

Revisió: 17 de novembre de 2026 (codi de sala de 4 caràcters, a petició de Felip). Estat: planificació aprovada per Felip i aplicació implementada, verificada i publicada a `ja.cat/subhasta`. Aquest és l'únic document de disseny del projecte: substitueix la planificació anterior i l'antic `ESPECIFICACIO.md`.

## 1. La idea que ho guia tot

**Una sala de subhastes que es comprèn en tres segons, una cartera personal que ajuda a decidir i un repte que dona sentit a cada oferta.**

La projecció crea el moment compartit: què se subhasta, a quin preu i qui va al davant. El terminal dona autonomia: què tinc, què puc pagar i què em quedarà si guanyo. L'organitzador dirigeix el ritme amb una sola acció principal a cada moment.

Cinc preguntes que sempre han de tenir resposta a la pantalla:

1. Què està passant ara?
2. Qui lidera i per quant?
3. Quina oferta puc fer exactament?
4. Quants diners em quedaran si guanyo?
5. Què he aconseguit i què queda?

## 2. Decisions

### Preses el 16 de novembre de 2026

Felip va aprovar aplicar totes les propostes de l'auditoria. Queden així:

| Tema | Decisió |
|---|---|
| Arquitectura | App estàtica a GitHub Pages; Firestore des del navegador amb autenticació anònima, regles de seguretat estrictes i transaccions. Sense funcions de servidor, Storage ni feines programades |
| Cost | Pla gratuït de Firebase, en un projecte propi separat de `flota-naval-cat` |
| Aparell de l'alumnat | El disseny principal és el portàtil o Chromebook a 1366 × 768; el mòbil és una disposició responsiva secundària |
| Motor didàctic | Camp «Repte», puntuació opcional i gràfic final de preus a la primera versió |
| Qui pot crear subhastes | Només els comptes de Google d'una llista de correus autoritzats |
| Imatges | Biblioteca d'icones de línia integrada i pujada opcional reduïda al mateix navegador |
| Imports | Enters i sempre múltiples de l'increment a partir del preu de sortida |
| Licitar | Tres botons amb l'import total i un selector − / +; sense teclat numèric |
| Estats | Una licitació és «oberta» o «aturada»; no hi ha «pausada» i «tancada» per separat |
| Configuració | Editable a la sala d'espera fins a «Començar» |
| Projecció | Vista pública de només lectura que s'obre amb el codi de sala |
| Control | Sense concessió ni batec: qui ha entrat amb el compte organitzador dirigeix |
| Correccions | Desfer només l'última adjudicació, abans d'obrir la unitat següent |
| Líder | No es pot superar a si mateix; una oferta no es pot retirar |
| Inscripcions | Interruptor «Inscripcions obertes/tancades»; es tanquen soles en començar |
| Noms | Àlies triat per cada participant, sense correu; líder sempre visible |
| Historial | Tres darreres ofertes en directe |
| Capacitat | 40 participants, 12 objectes i 60 unitats per sessió |
| Conservació | 30 dies després de finalitzar o de l'última activitat de l'organitzador |
| Finalització | Pas separat i definitiu: després només consulta, exportació i eliminació |

### Confirmades per Felip el mateix dia

Condicions d'ús:

1. **Aparells**: l'alumnat fa servir portàtils o Chromebooks de l'escola.
2. **Freqüència**: no es faran més de dues sessions el mateix dia. Si mai en calen més, s'activa el pla Blaze amb una alerta de pressupost, sense tocar el codi (vegeu §10).
3. **Compte organitzador**: el compte de Google de l'escola permet iniciar sessió en una app externa. Es verifica igualment a la prova tècnica, perquè depèn de la configuració del domini.

Simplificacions del model:

1. **Les unitats són un comptador, no fitxes amb identitat pròpia.** «Carbó · unitat 2 de 4» vol dir «la segona que es ven». Una unitat que no es ven no canvia cap comptador, de manera que les existències no es poden duplicar. No hi ha cua editable ni estats per unitat.
2. **«Retirar» una licitació**, tingui ofertes o no: cap càrrec i la unitat continua disponible. Substitueix «declarar deserta» i «cancel·lar l'intent».
3. **No es desa el registre complet d'ofertes**, només les tres darreres i el nombre d'ofertes de cada unitat venuda. El registre complet queda per a més endavant.
4. **Puntuació amb dos camps opcionals**: valor per objecte i bonificació per conjunt complet (§4).

### L'única decisió oberta

La direcció visual, que es tria amb les tres maquetes de la fase 1 (§9).

## 3. Abast de la primera versió

| Hi entra | No hi entra | Més endavant, si aporta valor |
|---|---|---|
| Preparar, entrar, licitar, aturar, adjudicar, retirar, desfer, resultats i CSV | Funcions de servidor i Storage | Rols amb valors privats |
| Repte, puntuació opcional i gràfic de preus | Concessió de control | Esdeveniments entre unitats |
| «Les meves subhastes», «Duplicar» i «Tornar a començar» | Aparellament del projector | Registre complet d'ofertes |
| Projecció pública i mode de presentació | Invitacions d'un sol ús | Comparació gràfica entre rondes |
| Canvi d'aparell d'un participant | Xat, pujades automàtiques, diners reals | Altres idiomes |
| Icones integrades i imatge opcional | Cercador o editor d'imatges | Protecció App Check |

No es mostren botons desactivats de funcions futures.

## 4. El motor didàctic

Sense una raó per licitar, els preus són arbitraris i tothom ho gasta tot en les últimes unitats. La primera versió ho resol sense mecàniques noves:

- **Repte** (text de fins a 280 caràcters): es veu a la sala d'espera, al terminal i a la projecció. Exemple: «Sou una fàbrica. Necessiteu carbó, ferro, cotó i fusta per produir. Cada moneda que us sobri també compta.»
- **Puntuació opcional**. Si l'organitzador l'omple, el balanç final de cadascú és: valor dels objectes + bonificació per cada conjunt complet (una unitat de cada objecte) + saldo. Si no l'omple, no apareix enlloc.
- **Exemple carregable** «Mercat industrial»: carbó, ferro, cotó i fusta; 1.000 monedes; increment 10; repte i puntuació ja escrits i editables.
- **Sense classificació pública per defecte.** L'organitzador pot projectar els resultats de tothom amb una acció conscient.
- **Tancament**: gràfic amb el preu de cada unitat successiva de cada objecte i tres preguntes: quin objecte s'ha encarit més i per què, a què has renunciat per fer una compra, què canviaries si ho repetíssim.

**Guia docent** (una pàgina, es redacta amb l'app): abans, durant i després; recomanació de 12–20 unitats i equips de dues o tres persones; uns 5 minuts d'entrada, 15–25 de licitació i 10 de balanç. Ha de citar les competències específiques del Decret 175/2022 de les matèries d'economia i emprenedoria de 4t i de Ciències Socials, copiades dels annexos oficials en redactar-la.

## 5. Regles de la subhasta

### Estats

Sessió: preparació → sala d'espera → en curs → finalitzada. La sessió no es pausa: entre unitats es mostra «Esperant la unitat següent».

| Situació | Acció de l'organitzador | Resultat |
|---|---|---|
| Cap licitació en curs | Obrir un objecte amb unitats disponibles | Licitació oberta, sense ofertes |
| Oberta | Aturar ofertes | Aturada: import i líder congelats |
| Aturada | Reprendre | Oberta; es conserva la millor oferta |
| Aturada amb líder | Adjudicar | Venuda: es carrega el preu, la compra passa a la cartera i l'objecte suma una venuda |
| Aturada | Retirar | Sense vendre: cap càrrec; si hi havia oferta, demana confirmació |
| Última adjudicació, abans d'obrir-ne una altra | Desfer | Es retorna l'import, es treu la compra i l'objecte resta una venuda |

No hi ha cap altra transició. «Adjudicar» mostra abans «Adjudicar 1 carbó a Anna per 190 monedes» i comprova que l'import i el líder són els revisats.

### Imports

- Primera oferta: com a mínim el preu de sortida. Següents: com a mínim l'oferta actual més l'increment.
- Tota oferta és el preu de sortida més un nombre enter d'increments, i no supera el saldo.
- L'import enviat no es modifica mai: si ja no és vàlid quan arriba, es rebutja i la persona decideix.
- Saldo = pressupost − gastat en compres vigents. No baixa mentre només es licita.
- Dues ofertes iguals alhora: entra la primera que es confirma; l'altra no queda registrada.

### Finalitzar i repetir

- «Finalitzar» només està disponible sense cap licitació oberta o aturada. Demana confirmació i és definitiu.
- «Tornar a començar» posa a zero despeses, compres i vendes, conserva els participants i torna a la sala d'espera amb una ronda nova, on es pot retocar la configuració abans de començar. Serveix per a la ronda de prova i per a una segona ronda; les adjudicacions de cada ronda queden al CSV.

### Límits

1–40 participants; 1–12 objectes; 1–60 unitats; pressupost d'1 a 100.000; increment i preu de sortida d'1 al pressupost. Títol 60 caràcters, objecte 40, descripció 200, àlies 24, moneda 16, repte 280. Àlies únics sense distingir majúscules, sense caràcters invisibles ni salts de línia.

### Regles que mai no poden fallar

1. Com a màxim una licitació en curs per sessió.
2. Cap saldo negatiu.
3. Pressupost = saldo + despesa en compres vigents.
4. Compres de la cartera = adjudicacions vigents d'aquella persona.
5. Unitats disponibles = inicials − venudes; retirar o desfer no en crea ni en destrueix.
6. Una acció repetida produeix un sol efecte.
7. Import, líder i darreres ofertes es llegeixen d'un mateix document.
8. Una licitació aturada no accepta ofertes.

## 6. Els tres espais

| Espai | Qui | Què hi fa |
|---|---|---|
| Projecció | Tothom | Veure objecte, preu, líder, catàleg i repte; cap acció |
| Comandament | Organitzador | Obrir, aturar, adjudicar, retirar, desfer i finalitzar |
| Terminal | Participant o equip | Oferir i controlar el seu pressupost |

Disposicions d'aula, de la més recomanable a la més limitada:

1. **L'ordinador de l'aula projecta i l'organitzador dirigeix des d'un altre aparell.** A l'ordinador de l'aula s'obre l'app, s'escriu el codi i es tria «Projectar».
2. **Un ordinador amb escriptori ampliat**: comandament a la pantalla pròpia i projecció en una altra finestra.
3. **Un sol ordinador duplicat**: «Mode de presentació», amb el tauler públic i una barra compacta de controls. No mostra saldos; obrir participants avisa que es veurà a la projecció.

## 7. Pantalles

### Organitzador

- **Les meves subhastes**: llista amb títol, data i estat. Accions: crear, obrir, duplicar, exportar i eliminar. En entrar-hi s'eliminen les sessions caducades.
- **Preparació** en una sola pantalla: títol i repte; taula d'objectes (nom, icona o imatge, quantitat, preu de sortida, valor opcional); pressupost, moneda i increment; resum de capacitat; exemple carregable. Validació al costat de cada camp i desament automàtic amb indicador.
- **Sala d'espera**: codi de sala de 4 caràcters alfanumèrics (sense 0, O, 1, I ni L; les sales antigues de 6 xifres continuen valent), enllaç curt, QR i botó «Copia l'enllaç» per al Classroom. Els àlies apareixen a mesura que entren; l'organitzador pot canviar-ne o treure'n un amb un toc, ara i entre unitats.
- **Comandament**: una acció principal segons el moment («Obrir carbó · unitat 2», «Aturar ofertes», «Adjudicar»). El catàleg permet obrir qualsevol objecte amb unitats; per defecte es proposa continuar amb el mateix objecte i després el següent. «Desfer» i «Finalitzar» van separats. Un panell lateral mostra participants amb saldo i compres, inscripcions i canvi d'aparell.

### Projecció

Esquema de contingut i jerarquia, no de maquetació:

```text
 SUBHASTA · Mercat industrial              ja.cat/subhasta · K7QM

 CARBÓ · unitat 2 de 4 · OBERTA       Objecte   Queden   Darrer preu
                                      Carbó ●   3 de 4   150
 [icona]     180 monedes              Ferro     3 de 3   —
             Lidera: Anna             Cotó      1 de 2   240
                                      Fusta     3 de 3   —
 Oferta mínima següent: 190
 Últimes ofertes: Anna 180 · Marc 170 · Júlia 160     Després: Ferro
```

Jerarquia: import → objecte → líder → estat → context. Sense ofertes es mostra «Sortida: 10 monedes», mai un zero. El catàleg no canvia d'ordre. «Queden» inclou la unitat en curs; «Darrer preu» és sempre l'última adjudicació. El codi es manté visible per a qui es reconnecta.

| Moment | Projecció | Terminal |
|---|---|---|
| Obertura | Objecte, unitat i preu de sortida | S'activen els botons |
| Oferta nova | Canvien import i líder amb un ressalt breu | S'actualitzen estat i botons |
| Aturada | «Ofertes aturades», amb el preu conservat | Botons inactius i motiu |
| Adjudicació | «Venut a Anna per 180» | Rebut i saldo nou per a qui compra |
| Retirada | «Sense vendre» | Cap canvi |

L'adjudicació es queda visible fins que s'obre la unitat següent. So de martell opcional, només a la projecció i desactivat per defecte.

### Terminal a l'ordinador

```text
 Anna · Saldo: 620 monedes            Repte: Sou una fàbrica…

 CARBÓ · unitat 2 de 4 · OBERTA       LES MEVES COMPRES
 Millor oferta: 180 · Lidera: Marc    Carbó × 1 · 150
                                      Cotó × 1 · 230
 [    Oferir 190 monedes    ]         Gastat: 380 de 1.000
 Si guanyes, et quedaran 430
                                      CATÀLEG
 [Oferir 200]  [Oferir 230]           Carbó · queden 3 · darrer 150
 Un altre import:  [−] 190 [+]        Ferro · queden 3
```

- Botó principal: el mínim vigent. Dos més: un i quatre increments per sobre. El selector puja i baixa d'increment en increment fins al saldo.
- Cada botó mostra l'import total, que és el compromís: no hi ha confirmació a cada oferta ni botó «Tot el saldo».
- L'import es fixa en començar la pulsació; si la licitació canvia abans d'enviar-lo, es cancel·la amb una explicació.
- Tot funciona amb el teclat, sense dreceres globals que puguin oferir per accident.
- Al mòbil: una sola columna amb el mateix ordre, compres i catàleg sota demanda, i àrees tàctils de 44 × 44 px com a mínim.

| Situació | Missatge |
|---|---|
| Enviant | «Enviant l'oferta de 190…»; evita un segon enviament |
| Lideres | «Vas primer amb 190. Si guanyes, et quedaran 430» |
| T'han superat | «T'han superat: Marc ofereix 200» |
| Algú s'ha avançat | «Algú ha ofert abans. Ara el mínim és 200» |
| Saldo insuficient | «El mínim és 630 i tens 620» |
| Aturada | «Ofertes aturades» |
| Sense connexió | «Sense connexió. Les dades poden ser antigues»; botons inactius |
| Compra | «Has comprat 1 carbó per 190. Et queden 430» |

Els estats es mantenen a la pantalla; no depenen d'avisos que desapareixen.

### Resultats

- **Projecció**: resum per objecte (venudes, preus successius), gràfic de preus amb taula equivalent i les tres preguntes.
- **Terminal**: balanç propi amb cada compra i, si n'hi ha, la puntuació desglossada.
- **Organitzador**: tots els participants i adjudicacions, i dos CSV: `participants` (àlies, pressupost, gastat, saldo, unitats, compres, punts) i `adjudicacions` (ronda, ordre, objecte, unitat, àlies, import, ofertes rebudes, hora, estat vigent o desfeta). UTF-8 amb BOM, punt i coma, i neutralització dels textos que comencin com una fórmula.

## 8. Llenguatge

- Textos del terminal a nivell A2–B1: «Oferir», «Vas primer», «T'han superat», «Venut», «Et queden».
- Els termes que es volen ensenyar (licitar, adjudicar, subhasta, increment) surten a la projecció amb un glossari breu a la sala d'espera.
- La interfície diu «oferta» i «oferir». «Puja» no s'usa fins que s'hagi comprovat al DIEC i al Termcat; el terme tradicional és «dita».
- Fórmules sense gènere ni article personal, perquè l'àlies és lliure: «Lidera: Anna», «Venut a Anna».
- Tots els textos en un sol fitxer, per poder revisar-ne la correcció i afegir idiomes.

## 9. Direcció visual, adaptació i accessibilitat

**Direcció visual.** Es tria amb maquetes, no amb una taula de colors. Preferències ja conegudes de Felip: aspecte càlid i net, sense color crema, sense marcs dins de marcs, icones de línia amb etiqueta, pantalles compactes. Es prepararan tres variants de la projecció i del terminal perquè en triï una:

1. **Llotja clara**: fons blanc, tinta blava i un sol color d'acció.
2. **Mercat**: tons vegetals i càlids, en la línia de Flota.
3. **Sala fosca**: fons fosc i xifres lluminoses, pensada per al projector.

Comú a totes: xifres d'amplada fixa, imports molt dominants, moviment de 150–250 ms només per confirmar canvis, sense confeti ni pampallugues.

**Adaptació.** Comandament i terminal segueixen el mecanisme d'`edu-apps/Equacions`: disseny base de 1440 × 800 que es redueix uniformement segons l'amplada i l'alçada útils, fins a un mínim del 75 %, i es recalcula en redimensionar o canviar de monitor. Per sota de 1.200 px d'amplada no s'escala: disposició responsiva amb desplaçament vertical. La projecció creix també cap amunt, perquè s'ha de llegir des del fons de l'aula. No es neutralitza mai el zoom de l'usuari. La pantalla de projecció i els terminals demanen al navegador que no s'apagui durant la sessió.

**Accessibilitat.** Tot el circuit amb teclat i focus visible; les actualitzacions no mouen el focus ni els botons. Estats amb text i símbol, no només color. Contrast mínim de 4,5:1 en text i 3:1 en xifres grans, mesurat. Els lectors de pantalla anuncien l'estat i els canvis personals, agrupant les ràfegues. Moviment reduït respectat.

## 10. Arquitectura

### Peces

- **Allotjament**: GitHub Pages, dins d'`util-apps`. Sense procés de compilació obligatori.
- **Firestore** des del navegador, com a Flota, en un projecte Firebase nou i a una regió de la UE.
- **Autenticació**: anònima per a l'alumnat i la projecció; Google per a l'organitzador, limitat a la llista de correus autoritzats.
- **Regles de seguretat**: tota la validació que abans s'atribuïa al servidor. Es desenvolupen i proven amb l'emulador local.

### Dades

| Document | Contingut | Qui el llegeix | Qui l'escriu |
|---|---|---|---|
| Llista d'organitzadors | Correus autoritzats | Ningú; només les regles | Felip, a la consola |
| Codi de sala | Sessió a què porta | Qualsevol identitat | Organitzador |
| Sessió | Propietari, títol, repte, pressupost, moneda, increment, puntuació, estat, ronda, caducitat | Qualsevol identitat | Organitzador |
| Objecte | Nom, descripció, icona o imatge, quantitat, preu de sortida, valor | Qualsevol identitat | Organitzador |
| Tauler | Licitació en curs (objecte, unitat, estat, import, líder, nombre d'ofertes, tres darreres), venudes i darrer preu de cada objecte, objecte següent, última adjudicació | Qualsevol identitat | Organitzador; el participant, només els camps d'oferta |
| Participant | Àlies | Qualsevol identitat | El titular en entrar; organitzador |
| Cartera | Àlies, habilitada, gastat, compres | Titular i organitzador | El titular només en crear-la, a zero; organitzador |
| Reserva d'àlies | Nom normalitzat | Ningú | El titular en entrar; organitzador |
| Adjudicació | Ronda, ordre, objecte, unitat, participant, preu, ofertes rebudes, hora, desfeta | Qualsevol identitat | Organitzador |

El tauler és l'únic document que canvia a cada oferta i no conté imatges: és el que reben totes les pantalles.

### Què garanteixen les regles

- Només un compte de la llista pot crear sessions, i només el propietari les dirigeix.
- Només s'entra amb les inscripcions obertes, amb un àlies lliure i mentre hi hagi places; cada identitat crea una sola cartera, a zero.
- Una oferta només modifica els camps d'oferta del tauler, amb la licitació oberta.
- El líder nou és qui envia l'oferta, té la cartera habilitada i no era ja el líder.
- L'import compleix el mínim vigent, és un múltiple vàlid i no supera pressupost − gastat de la seva cartera.
- Ningú llegeix una cartera aliena.
- Una sessió caducada deixa de ser llegible encara que no s'hagi eliminat.

L'adjudicació, la retirada i el desfer són transaccions fetes des del navegador de l'organitzador: comproven l'estat que s'ha revisat i escriuen tauler, cartera i adjudicació alhora. Un doble clic o una segona pestanya troben l'estat ja canviat i no fan res.

### Connexió i recuperació

- El que mostra cada pantalla surt del tauler i, al terminal, de la cartera pròpia. No es permet oferir fins que tots dos han arribat.
- Una oferta amb resposta dubtosa es resol mirant el tauler: si lidero amb aquell import, ha entrat. No es desen ofertes per enviar-les més tard.
- Recarregar o desbloquejar l'aparell recupera la mateixa identitat i cartera.
- Si l'organitzador perd la connexió, la subhasta es queda com estava: sense ell no s'adjudica res. Pot continuar des de qualsevol aparell amb el seu compte.
- **Canvi d'aparell d'un participant**: l'organitzador obre la fila de la persona i mostra un codi de quatre xifres vàlid cinc minuts; en escriure'l a l'aparell nou, la cartera hi passa sencera i l'antic perd l'accés.

### Quota i cost

- Pla gratuït: 50.000 lectures i 20.000 escriptures al dia; es reinicia cap a les 9 h.
- Estimació d'una sessió de 40 terminals, 20 unitats i unes 300 ofertes: entre 13.000 i 20.000 lectures. Dues sessions diàries amb marge. És un càlcul; es mesura a la prova de càrrega.
- Si no n'hi ha prou: activar el pla Blaze amb una alerta de pressupost d'1 €. El codi no canvia i l'excés costa cèntims, però cal targeta.
- L'autenticació admet 100 comptes nous per hora des d'una mateixa IP: suficient per a dues classes seguides. Es pot ampliar temporalment a la consola.

### Conservació i privadesa

- No es demana cap dada personal a l'alumnat: àlies i identificador anònim. De l'organitzador, el compte de Google.
- La sessió caduca 30 dies després de finalitzar o de l'última acció de l'organitzador. Les regles en bloquegen l'accés a partir d'aquella data; l'eliminació efectiva es fa quan l'organitzador entra a «Les meves subhastes» o amb el botó «Eliminar».
- L'app inclou un text breu de privadesa: què es desa, on i fins quan.
- No es pot limitar la freqüència de peticions sense servidor. Es considera acceptable a l'aula, amb l'organitzador present i la creació de sessions restringida.

## 11. Casos de referència

Configuració: Anna i Marc amb 1.000 monedes; carbó, 2 unitats; sortida 10; increment 10.

1. S'obre carbó · unitat 1 de 2. Anna ofereix 10: acceptada; saldo 1.000; «et quedaran 990».
2. Marc ofereix 30: acceptada (pot saltar més d'un increment). Una oferta de 25 no és possible: no és un múltiple vàlid.
3. Anna ofereix 30: rebutjada; el mínim és 40. No canvia res.
4. Anna ofereix 40, s'atura i s'adjudica: Anna té gastat 40, saldo 960 i 1 carbó; carbó «queden 1 de 2», darrer preu 40.
5. Doble clic a «Adjudicar»: un sol càrrec.
6. «Desfer»: Anna torna a 1.000 i 0 carbons; «queden 2 de 2»; l'adjudicació consta com a desfeta.
7. Es torna a obrir carbó: és de nou la unitat 1 de 2, sense ofertes.

- **Simultaneïtat**: amb 100 al tauler, Anna i Marc premen «Oferir 110» alhora. N'entra una; l'altre veu «Algú ha ofert abans. Ara el mínim és 120». Amb 110 i 130: si entra primer 110, 130 també entra; si entra primer 130, 110 es rebutja.
- **Aturar mentre arriba una oferta**: val l'ordre de confirmació. Si l'oferta entra abans, l'organitzador veu l'import nou abans d'adjudicar.
- **Retirar sense ofertes**: cap saldo canvia i l'objecte conserva la unitat.
- **Saldo just**: amb saldo 620 i mínim 630, botons inactius i motiu visible; amb saldo 630, l'oferta és vàlida i quedaria a zero.
- **Puntuació**: carbó val 150. Anna acaba amb 2 carbons i saldo 870: 300 + 870 = 1.170 punts.

## 12. Proves

| Grup | Què s'ha de demostrar |
|---|---|
| Regles de seguretat | Cada garantia del §10, en positiu i en negatiu: oferta en nom d'un altre, import massa baix o no múltiple, per sobre del saldo, amb la licitació aturada, lectura d'una cartera aliena, participant intentant adjudicar, sessió caducada |
| Domini | Totes les transicions del §5, vàlides i invàlides; les vuit regles després de cada operació; els casos del §11 |
| Simultaneïtat | 40 ofertes alhora, oferta contra aturada, adjudicar dues vegades, desfer contra obrir, entrar amb la sala plena |
| Connexió | Recarregar liderant, aparell bloquejat, organitzador desconnectat, canvi d'aparell, dues pestanyes |
| Interfície | Tots els missatges del §7, teclat, lector de pantalla, moviment reduït, zoom al 200 % |
| Resultats | CSV quadrat amb les carteres, adjudicacions desfetes, dues rondes, àlies com `=1+1`, accents i punt i coma, oberts a Excel i a Fulls de càlcul |
| Cicle de vida | Duplicar, tornar a començar, caducitat i eliminació completa |
| Càrrega | 40 participants simulats durant 10 minuts i 20 unitats: lectures consumides i temps fins a veure l'oferta a totes les pantalles (objectiu: menys d'un segon en el 95 % dels casos) |
| Aula | Xarxa i aparells reals de l'escola; pilot amb un grup |

Revisió visual obligatòria: 1920 × 1080; 1366 × 768 al 100 %, 125 % i 150 %; projector real; mòbil de 390 × 844; noms de 24 caràcters, imports de 100.000 i 12 objectes.

Criteris d'èxit: algú que no ha vist l'app entra en menys d'un minut i identifica objecte, preu i líder en tres segons; zero dobles càrrecs, saldos negatius o compres duplicades.

## 13. Pla de treball

| Fase | Lliurable | Condició per continuar |
|---|---|---|
| 0. Decisions | Aquest document | Feta: decisions confirmades el 16 de novembre de 2026 |
| 1. Prova tècnica i maquetes | Prova llençable amb deu aparells a l'escola; tres variants visuals | Xarxa i compte comprovats; direcció visual triada |
| 2. Base | Projecte Firebase, regles i proves de regles, lògica de domini | Proves de regles i de domini superades |
| 3. Circuit | Preparar, entrar, licitar, adjudicar i veure resultats entre dos navegadors | Casos del §11 reproduïts |
| 4. Completar | Desfer, retirar, repetir, duplicar, canvi d'aparell, CSV i gràfic | Cap regla del §5 trencada |
| 5. Acabat | Adaptació, accessibilitat, llenguatge i icones | Revisió visual obligatòria feta |
| 6. Càrrega i pilot | Simulador de 40 participants i sessió amb un grup | Objectius mesurats; incidències resoltes |
| 7. Publicació | Vegeu el §14 | Versió publicada igual que la local |

El simulador de participants de la fase 6 es conserva perquè l'organitzador pugui assajar sol.

## 14. Publicació

- Commit i push a `util-apps`; comprovar que la versió publicada és la nova.
- Enllaç curt `ja.cat/subhasta`, que és l'adreça que escriurà l'alumnat.
- Targeta al menú d'`util-apps` apuntant a l'enllaç ja.cat.
- README amb captures a 1366 × 768, projecció i mòbil, i la guia docent.
- Llicència doble: capçaleres SPDX, fitxer `LICENSE` i peu «Codi: AGPLv3 · Continguts: CC BY-NC-SA 4.0».
- Formulari d'errors `.github/ISSUE_TEMPLATE/subhasta.yml` amb etiqueta pròpia.
- Dominis autoritzats i llista d'organitzadors configurats a Firebase.

## 15. Fonts

- [Plans de preus de Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Quotes i límits de Firestore](https://firebase.google.com/docs/firestore/quotas)
- [Límits de Firebase Authentication](https://firebase.google.com/docs/auth/limits)
- [Transaccions de Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Condicions de les regles de seguretat](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Limitació de temporitzadors a Chrome](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)
- Codi de referència: `jocs/Flota` (Firestore des del navegador) i `edu-apps/Equacions` (escala de la interfície).
