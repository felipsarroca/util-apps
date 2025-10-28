const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 3000 });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('New client connected');
  
  ws.on('message', (message) => {
    try {
      const parsedMessage = JSON.parse(message.toString());
      console.log('Received message:', parsedMessage);
      
      // Broadcast messages to all other clients
      for (const client of clients) {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(parsedMessage));
        }
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
  
  // Send a welcome message to the new client
  ws.send(JSON.stringify({ 
    type: 'connected', 
    message: 'Connected to signaling server' 
  }));
});

console.log('Servidor WS actiu al port 3000');