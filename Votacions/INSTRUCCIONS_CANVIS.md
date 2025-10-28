# Instruccions sobre els canvis realitzats

## Problema identificat

L'aplicació no permetia la participació de l'alumnat des d'un altre dispositiu. El problema era que el codi d'activitat només es desava a `sessionStorage`, el qual només està disponible en la sessió actual del navegador i no es comparteix entre dispositius.

## Solució implementada

S'han realitzat canvis en els fitxers `script.js` i `webrtc.js` per canviar l'emmagatzematge del codi d'activitat de `sessionStorage` a `localStorage` mitjançant les funcions de fallback `getStoredItem` i `setStoredItem`. Això permet que el codi d'activitat estigui disponible en qualsevol dispositiu o pestanya on l'alumne obri l'aplicació.

### Canvis principals

1. A `script.js`:
   - A la funció `initHomePage()`: s'ha canviat `sessionStorage.setItem('activityCode', code)` per `setStoredItem('activityCode', code)`
   - A la funció `initAlumnePage()`: s'ha canviat `sessionStorage.getItem('activityCode')` per `getStoredItem('activityCode')`
   - A la funció `handleStudentSubmission()`: s'ha canviat `sessionStorage.getItem('activityCode')` per `getStoredItem('activityCode')`
   - A la funció `updateStudentView()`: s'ha canviat `sessionStorage.getItem('activityCode')` per `getStoredItem('activityCode')`

2. A `webrtc.js`:
   - S'han canviat totes les referències a `sessionStorage.getItem('activityCode')` per `getStoredItem('activityCode')` en les funcions `handleStartVoteMessage`, `handleIdeaMessage`, `handleVoteMessage`, i `handleResultMessage`
   - S'han canviat totes les referències a `localStorage` directe per les funcions de fallback `getStoredItem` i `setStoredItem` en les funcions `sendIdeaViaWebRTC`, `sendVoteViaWebRTC`, `sendStartVoteMessage`, `fallbackSendMessage`, i `processQueuedMessages`
   - S'ha eliminat la funció prototype de WebRTCManager ja que ja no es fa servir

## Resultat

Ara l'alumne pot introduir el codi d'activitat en un dispositiu i continuar la participació en un altre dispositiu, ja que el codi es manté a l'emmagatzematge local del navegador.