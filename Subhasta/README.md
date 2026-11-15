# Subhasta

## Estat del projecte

Document de concepció funcional per a una futura aplicació educativa de subhastes en temps real. Encara no s'ha iniciat el disseny visual ni la implementació.

## Finalitat

Crear una activitat d'aula que reprodueixi una subhasta oberta de manera clara i realista. Ha de permetre observar com es formen els preus i treballar conceptes com l'escassetat, l'oferta i la demanda, el pressupost limitat, el cost d'oportunitat, la competència i la presa de decisions.

No és una votació ni un repartiment simultani de punts entre opcions. Cada unitat d'un objecte se subhasta en directe, una després de l'altra, i s'adjudica a la persona que ofereix més quan l'organitzador tanca la licitació.

## Mecànica acordada

1. L'organitzador prepara els objectes, la quantitat disponible de cadascun, el pressupost inicial i l'increment mínim de les ofertes.
2. Els participants entren a la sessió amb un codi o un QR i indiquen el seu nom o àlies.
3. La pantalla mostra el catàleg complet, les quantitats inicials i les unitats restants.
4. L'organitzador obre la subhasta d'una unitat concreta, per exemple «Carbó · unitat 2 de 4».
5. Tots els dispositius mostren amb molta claredat l'objecte actiu, la millor oferta i la persona que l'ha feta.
6. Els participants augmenten l'oferta. Cada nova oferta vàlida es mostra immediatament a tothom.
7. L'organitzador decideix quan tanca la subhasta de la unitat; no depèn d'un temporitzador obligatori.
8. En tancar-la, la millor oferta queda adjudicada, se'n descompta l'import al guanyador, la unitat s'afegeix al seu inventari i s'actualitzen totes les pantalles.
9. Si hi ha diverses unitats del mateix objecte, cadascuna se subhasta separadament i pot assolir un preu diferent.
10. L'organitzador obre la unitat següent fins que acaba l'activitat.

Aquest format correspon a una subhasta anglesa oberta dirigida per una persona organitzadora.

## Informació visible durant una licitació

La informació principal ha de poder entendre's d'un cop d'ull en una pantalla projectada:

- nom i imatge o icona de l'objecte;
- unitat actual i quantitat total, per exemple «2 de 4»;
- quantitat que queda per subhastar;
- oferta més alta;
- nom del millor postor;
- increment mínim;
- estat: pendent, oberta, pausada o adjudicada;
- historial breu de les darreres ofertes.

Exemple:

> **Carbó · unitat 2 de 4**  
> Millor oferta: **180 monedes**  
> Millor postora: **Anna**

La resta del catàleg pot continuar visible en un panell secundari:

| Objecte | Unitats inicials | Restants | Darrer preu |
|---|---:|---:|---:|
| Carbó | 4 | 2 | 180 |
| Ferro | 3 | 3 | — |
| Cotó | 2 | 1 | 240 |

## Dispositiu dels participants

Cada participant ha de veure:

- l'objecte que s'està subhastant;
- l'oferta actual i qui la lidera;
- el seu saldo disponible;
- els objectes i les quantitats que ja ha adquirit;
- la seva oferta màxima possible;
- botons accessibles per licitar, com `+10`, `+25` i `+50`, i un camp opcional per introduir una quantitat;
- un missatge inequívoc: «Ara ets el millor postor», «T'han superat» o «Oferta no vàlida».

## Controls de l'organitzador

- Obrir la subhasta d'una unitat.
- Pausar i reprendre les ofertes.
- Adjudicar la unitat al millor postor.
- Declarar una unitat deserta.
- Passar a la unitat següent.
- Desfer l'última adjudicació, amb confirmació, per corregir una errada.
- Finalitzar anticipadament l'activitat.
- Veure els saldos, els inventaris i l'estat de connexió dels participants.
- Exportar els resultats en CSV.

## Regles de negoci

- Una oferta nova ha de superar l'actual almenys en l'increment mínim establert.
- Ningú no pot oferir més que el seu saldo disponible.
- El servidor decideix l'ordre de dues ofertes gairebé simultànies; la primera transacció vàlida és la que preval.
- Quan l'organitzador tanca una unitat, qualsevol oferta posterior s'ha de rebutjar.
- L'adjudicació, el descompte del saldo, l'augment de l'inventari i la reducció de les existències han de formar una única operació indivisible.
- Només l'organitzador pot obrir, pausar, adjudicar, desfer o acabar una subhasta.
- Una unitat sense cap oferta es pot declarar deserta i, si es vol, tornar a subhastar més tard.
- Desfer una adjudicació ha de retornar els diners, retirar la unitat de l'inventari i restaurar les existències en una única operació.

## Resultats finals

En acabar s'ha de mostrar i poder exportar:

| Participant | Saldo final | Objectes adquirits | Total gastat |
|---|---:|---|---:|
| Anna | 220 | 2 carbons, 1 cotó | 780 |
| Marc | 350 | 1 carbó, 2 ferros | 650 |

També convé conservar el preu d'adjudicació de cada unitat per poder analitzar després com ha evolucionat el mercat.

## Arquitectura recomanada

Utilitzar Firebase Firestore, seguint l'experiència d'`Enfonsar la flota`, en comptes de fer que el dispositiu de l'organitzador actuï com a servidor amb PeerJS/WebRTC.

Motius:

- millor reconnexió si un mòbil es bloqueja o es recarrega;
- estat de la sessió conservat fora del dispositiu de l'organitzador;
- més robustesa per a una classe sencera;
- operacions atòmiques per validar ofertes i adjudicacions;
- no depèn de PeerJS ni dels servidors TURN de Metered;
- Felip ja disposa d'una implementació funcional amb Firebase a Flota.

La subhasta de frases de referència (`https://jjdeharo.github.io/subasta_frases/`) utilitza PeerJS/WebRTC: el navegador de l'organitzador manté l'estat oficial, el codi de sis caràcters és el seu identificador de connexió i STUN/TURN facilita o retransmet la comunicació. És una solució adequada per a sessions efímeres, però aquesta app necessita conservar amb robustesa saldos, inventaris i adjudicacions.

## Model de dades orientatiu

```text
sessions/{sessionId}
  status: lobby | running | paused | finished
  hostId
  currencyName
  startingBalance
  minimumIncrement
  activeAuctionId
  revision

sessions/{sessionId}/participants/{participantId}
  name
  balance
  inventory
  online

sessions/{sessionId}/items/{itemId}
  name
  description
  image
  initialQuantity
  remainingQuantity

sessions/{sessionId}/auctions/{auctionId}
  itemId
  unitNumber
  status: pending | open | paused | awarded | unsold
  currentBid
  leaderId
  openedAt
  closedAt
  winnerId
  awardedPrice

sessions/{sessionId}/auctions/{auctionId}/bids/{bidId}
  participantId
  amount
  createdAt
```

Les ofertes i les adjudicacions s'han de validar mitjançant transaccions de Firestore o una funció de servidor. No s'ha de confiar en les comprovacions del navegador del participant.

## Pantalles previstes

1. **Inici:** crear activitat o entrar amb un codi.
2. **Editor:** objectes, quantitats, pressupost, moneda i increment mínim.
3. **Sala d'espera:** codi, QR i participants connectats.
4. **Tauler de l'organitzador:** catàleg, unitat activa, millor oferta i controls.
5. **Pantalla del participant:** saldo, inventari i controls de licitació.
6. **Resultats:** adjudicacions, saldos, inventaris i exportació.

## Criteris de disseny

- Interfície senzilla, atractiva i comprensible sense instruccions llargues.
- L'objecte actiu, l'oferta i el millor postor són sempre els elements visuals principals.
- Cap desplaçament horitzontal ni controls ocults en ordinadors de 1366 × 768.
- Adaptació a projector, ordinador, tauleta i mòbil; recalcular en redimensionar.
- Historial d'ofertes llegible però visualment secundari.
- Colors i icones coherents; no basar la informació només en el color.
- Confirmació en accions delicades, especialment adjudicar, desfer i finalitzar.
- Respectar moviment reduït, navegació amb teclat i lectors de pantalla.
- Textos en català i possibilitat futura d'incorporar altres idiomes.

## Decisions pendents abans de dissenyar

- Context narratiu inicial: matèries primeres industrials, mercat general o paquets temàtics configurables.
- Si els participants poden introduir qualsevol import o només usar increments predefinits.
- Si es mostra tot l'historial d'ofertes o només les darreres.
- Si el nom del millor postor és públic o es pot activar un mode amb àlies.
- Durada i política de conservació de les sessions a Firestore.
- Nombre màxim orientatiu de participants i objectes.
- Si hi haurà esdeveniments que alterin existències o pressupostos entre adjudicacions.
- Si es vol una fase final d'anàlisi didàctica amb gràfics de l'evolució dels preus.

## Possibles ampliacions

- Cartes d'esdeveniment: vagues, descobriments, canvis de demanda o encariment del transport.
- Objectius o rols secrets que facin variar el valor dels objectes per a cada participant.
- Paquets d'activitat reutilitzables i compartibles mitjançant un fitxer o un enllaç.
- Gràfics dels preus successius de cada producte.
- Mode de demostració per explicar la mecànica abans de començar.

Aquestes ampliacions no han de complicar la primera versió. La versió inicial ha de resoldre impecablement el circuit: crear sessió, entrar, licitar, adjudicar, actualitzar saldos i inventaris, i mostrar resultats.
