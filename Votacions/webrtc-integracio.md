# 🧭 Guia d’integració de WebRTC i P2P a l’aplicació existent

## 🎯 Objectiu

Afegir **comunicació en temps real** entre múltiples navegadors (professor i alumnes) a través de **WebRTC amb canals P2P**, utilitzant un **servidor de senyalització WebSocket** lleuger.

⚠️ **Important:**  
- No s’ha de modificar l’estructura HTML ni l’estil CSS actual.  
- Només s’ha d’afegir la lògica de comunicació i integració amb la interfície ja existent.

---

## 🧩 Arquitectura general

```
Professor (navegador)
   │
   │ WebRTC DataChannel
   ▼
Alumnes (1..n navegadors)
   │
   │ WebSocket (senyalització)
   ▼
Servidor de senyalització (Node.js)
```

- **WebRTC:** canal de dades directe (P2P) per missatges d’activitat (idees, vots, resultats…).
- **WebSocket:** canal inicial de negociació (offer, answer, ICE).
- **UI existent:** mostra i recull informació, sense canvis visuals.

---

## ⚙️ Components a afegir

| Component                         | Rol principal                                                                                   | Fitxer suggerit          |
|------------------------------------|--------------------------------------------------------------------------------------------------|---------------------------|
| `server.js`                        | Servidor de senyalització (WebSocket)                                                            | Backend (Node.js)         |
| `webrtc.js` (o `script.js`)        | Lògica de connexió WebRTC i integració amb UI                                                    | Frontend                  |
| Estructura de missatges JSON       | Definir tipologia comuna per intercanviar dades entre participants                               | Frontend                  |

---

## 📡 Flux de connexió

1. El **professor** inicia la connexió i crea una `offer`.
2. El **servidor WS** envia aquesta oferta als alumnes.
3. Els **alumnes** responen amb una `answer`.
4. Es comparteixen ICE candidates automàticament via WS.
5. Un cop establerta la connexió, totes les dades circulen per **DataChannel P2P**.

---

## 🧠 Requisits tècnics per al programador

### 1. Servidor de senyalització WebSocket

- Implementar amb [`ws`](https://github.com/websockets/ws) (Node.js).
- Funcions mínimes:
  - Acceptar connexions.
  - Difondre missatges d’`offer`, `answer` i `candidate` als altres clients.
  - No cal persistència ni base de dades.

Estructura mínima (`server.js`):

```js
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 3000 });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('message', (message) => {
    for (const client of clients) {
      if (client !== ws && client.readyState === 1) {
        client.send(message);
      }
    }
  });
  ws.on('close', () => clients.delete(ws));
});

console.log('Servidor WS actiu al port 3000');
```

---

### 2. Configuració WebRTC al client

- Crear un `RTCPeerConnection` amb STUN server:
```js
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});
```

- Professor:
  - Crear `RTCDataChannel`.
  - Generar `offer` i enviar per WS.

- Alumne:
  - Rebre `offer`.
  - Fer `setRemoteDescription`, `createAnswer` i enviar `answer`.

- Tots:
  - Gestionar `icecandidate` i enviar via WS.
  - Afegir rebuts amb `addIceCandidate`.

---

### 3. DataChannel

- Ús d’un únic canal de dades (ex. `main-channel`).
- Missatges estructurats en JSON:

```json
{
  "type": "idea" | "vote" | "result" | "system",
  "payload": { },
  "senderId": "professor" | "alumne"
}
```

- Gestionar `onmessage` per actualitzar la UI quan arribin dades.

---

### 4. Integració amb la UI existent

- No modificar elements visuals.
- Capturar esdeveniments dels botons i inputs existents.
- Enviar missatges WebRTC des d’aquests esdeveniments.

Exemples:

| Acció UI                          | Missatge enviat per WebRTC                     | Destí        |
|------------------------------------|-----------------------------------------------|--------------|
| Professor inicia votació           | `{ type: 'start-vote', payload: {...} }`      | Alumnes      |
| Alumne vota                        | `{ type: 'vote', payload: {...} }`            | Professor    |
| Professor mostra resultats         | `{ type: 'result', payload: {...} }`          | Tots         |

---

### 5. Proves i desplegament

1. **Local:**  
   - Correr `server.js` localment (`node server.js`).
   - Obrir dues pestanyes de navegador per provar connexions.

2. **Xarxa local:**  
   - Accedir via IP local des d’altres dispositius.

3. **Producció:**  
   - Desplegar servidor WS (Railway, Render, VPS).
   - Canviar la URL WS al client (`wss://domini.exemple`).

4. **Opcional:**  
   - Afegir TURN server per connexions en xarxes restrictives.

---

## 🧱 Tasques resumides

| Tasca                                      | Descripció                                                                | Fitxers                    |
|--------------------------------------------|---------------------------------------------------------------------------|----------------------------|
| Crear servidor WS                          | Senyalització bàsica per ofertes/respostes                                | `server.js`                |
| Afegir RTCPeerConnection                   | Crear connexions segons rol                                               | `webrtc.js`                |
| Crear i gestionar DataChannel              | Enviar i rebre missatges JSON                                            | `webrtc.js`                |
| Vincular UI existent a missatges WebRTC    | Listeners i dispatchers sense modificar HTML/CSS                          | `script.js` o `webrtc.js`  |
| Configurar STUN/TURN i desplegar servidor  | Per a connexions externes                                                 | `server.js` i client       |

---

## 🧰 Recursos útils

- [MDN WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)  
- [WebSocket API MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)  
- [STUN/TURN servers info](https://www.twilio.com/docs/stun-turn)

---

## ✅ Consideracions finals

- El **professor** actua com a *initiator* (origen de la connexió).  
- La UI no s’ha de tocar, només vincular amb esdeveniments.  
- Els missatges s’han d’estructurar bé per mantenir lògica clara i escalable.  
- Afegir gestió d’errors (`try/catch`) en connexions i enviaments.  
- La mateixa estructura pot escalar fàcilment a més funcionalitats interactives.
