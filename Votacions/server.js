const { WebSocketServer } = require('ws');

// Object to store activity data
const activities = {};

const wss = new WebSocketServer({ 
  port: 3000,
  // Add origin check for security (CORS)
  verifyClient: (info) => {
    // Allow connections from any origin for testing purposes
    // In production, you should specify your allowed origins
    return true;
  }
});
const clients = new Set();

// Store client connections to identify users
const clientConnections = new Map();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('New client connected');
  
  ws.on('message', (message) => {
    try {
      const parsedMessage = JSON.parse(message.toString());
      console.log('Received message:', parsedMessage);
      
      // Handle different message types
      switch(parsedMessage.type) {
        case 'register-activity':
          // When a professor creates an activity
          const activityCode = parsedMessage.activityCode;
          if (activityCode) {
            activities[activityCode] = {
              ...parsedMessage.activityData,
              results: parsedMessage.results || { ideas: [], votes: {} },
              participants: []
            };
            console.log(`Activity ${activityCode} registered`);
          }
          break;
          
        case 'join-activity':
          // When a student joins an activity
          const joinCode = parsedMessage.activityCode;
          if (joinCode && activities[joinCode]) {
            // Send the current activity state to the student
            ws.send(JSON.stringify({
              type: 'activity-state',
              activityCode: joinCode,
              activity: activities[joinCode]
            }));
          } else {
            // Send error if activity doesn't exist
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Activity not found'
            }));
          }
          break;
          
        case 'student-idea':
          // When a student submits an idea
          const ideaCode = parsedMessage.activityCode;
          if (ideaCode && activities[ideaCode]) {
            activities[ideaCode].results.ideas.push(parsedMessage.idea);
            // Broadcast to all clients
            for (const client of clients) {
              if (client.readyState === 1) {
                client.send(JSON.stringify({
                  type: 'new-idea',
                  activityCode: ideaCode,
                  idea: parsedMessage.idea
                }));
              }
            }
          }
          break;
          
        case 'student-vote':
          // When a student submits a vote
          const voteCode = parsedMessage.activityCode;
          if (voteCode && activities[voteCode]) {
            const option = parsedMessage.option;
            activities[voteCode].results.votes[option] = (activities[voteCode].results.votes[option] || 0) + 1;
            // Broadcast to all clients
            for (const client of clients) {
              if (client.readyState === 1) {
                client.send(JSON.stringify({
                  type: 'new-vote',
                  activityCode: voteCode,
                  option: option,
                  voteCount: activities[voteCode].results.votes[option]
                }));
              }
            }
          }
          break;
          
        case 'start-voting':
          // When professor starts voting phase
          const startVoteCode = parsedMessage.activityCode;
          if (startVoteCode && activities[startVoteCode]) {
            activities[startVoteCode].status = 'voting';
            // Broadcast to all clients
            for (const client of clients) {
              if (client.readyState === 1) {
                client.send(JSON.stringify({
                  type: 'voting-started',
                  activityCode: startVoteCode
                }));
              }
            }
          }
          break;
          
        default:
          // For signaling messages, broadcast to all other clients
          for (const client of clients) {
            if (client !== ws && client.readyState === 1) {
              client.send(JSON.stringify(parsedMessage));
            }
          }
          break;
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