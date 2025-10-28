// WebRTC functionality for the voting application
class WebRTCManager {
  constructor() {
    this.pc = null;
    this.dataChannel = null;
    this.ws = null;
    this.isInitiator = false;
    this.userId = this.getStoredItem('userId');
    this.role = null; // 'professor' or 'alumne'
    this.onMessageReceived = null;
  }

  // Initialize the WebRTC connection
  init(role) {
    this.role = role;
    this.createPeerConnection();
    this.connectToSignalingServer();
  }

  // Create RTCPeerConnection
  createPeerConnection() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
          senderId: this.userId
        });
      }
    };

    // Handle data channel from remote peer
    this.pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };
  }

  // Create and setup data channel
  setupDataChannel(channel = null) {
    if (!channel) {
      // Professor creates the data channel
      this.dataChannel = this.pc.createDataChannel('main-channel', {
        reliable: true
      });
    } else {
      // Student receives the data channel
      this.dataChannel = channel;
    }

    this.dataChannel.onopen = () => {
      console.log('Data channel connected');
      // Send a ready message to let others know we're connected
      this.sendMessage({
        type: 'ready',
        senderId: this.userId,
        role: this.role
      });
      // Process any queued messages
      this.processQueuedMessages();
    };

    this.dataChannel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (this.onMessageReceived) {
        this.onMessageReceived(message);
      }
    };

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
  }

  // Connect to WebSocket signaling server
  connectToSignalingServer() {
    // Determine the WebSocket URL based on the environment
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:3000`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Connected to signaling server');
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleSignalMessage(message);
      } catch (error) {
        console.error('Error parsing signaling message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('Disconnected from signaling server');
    };
  }

  // Handle incoming signaling messages
  handleSignalMessage(message) {
    switch (message.type) {
      case 'offer':
        if (message.senderId !== this.userId) {
          this.handleOffer(message.offer, message.senderId);
        }
        break;
      case 'answer':
        if (message.senderId !== this.userId) {
          this.handleAnswer(message.answer);
        }
        break;
      case 'ice-candidate':
        if (message.senderId !== this.userId) {
          this.handleIceCandidate(message.candidate);
        }
        break;
      default:
        console.log('Unknown signaling message type:', message.type);
        break;
    }
  }

  // Handle offer from remote peer
  async handleOffer(offer, senderId) {
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      
      this.sendSignalMessage({
        type: 'answer',
        answer: answer,
        senderId: this.userId
      });
      
      this.setupDataChannel();
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  // Handle answer from remote peer
  async handleAnswer(answer) {
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  // Handle ICE candidate from remote peer
  async handleIceCandidate(candidate) {
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  // Create offer (for professor/initiator)
  async createOffer() {
    try {
      this.setupDataChannel();
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      
      this.sendSignalMessage({
        type: 'offer',
        offer: offer,
        senderId: this.userId
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  // Send signaling message via WebSocket
  sendSignalMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not ready, could not send signal message:', message);
    }
  }

  // Send message via WebRTC DataChannel
  sendMessage(message) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message));
    } else {
      console.warn('Data channel not ready, could not send message:', message);
      // Fallback to localStorage if WebRTC is not available
      this.fallbackSendMessage(message);
    }
  }
  
  // Fallback mechanism using localStorage for when WebRTC is not ready
  fallbackSendMessage(message) {
    // Save the message to a temporary queue in localStorage
    const queue = JSON.parse(localStorage.getItem('webrtc_message_queue') || '[]');
    queue.push(message);
    localStorage.setItem('webrtc_message_queue', JSON.stringify(queue));
  }
  
  // Process any queued messages once WebRTC is ready
  processQueuedMessages() {
    const queue = JSON.parse(localStorage.getItem('webrtc_message_queue') || '[]');
    queue.forEach(message => {
      this.sendMessage(message);
    });
    localStorage.removeItem('webrtc_message_queue');
  }
}

// Global WebRTC manager instance
let webRTCManager = null;

// Initialize WebRTC based on the page type
function initWebRTC() {
  const page = window.location.pathname;
  
  if (page.includes('professor.html')) {
    // Professor is the initiator
    webRTCManager = new WebRTCManager();
    webRTCManager.init('professor');
  } else if (page.includes('alumne.html')) {
    // Student waits for offers from professor
    webRTCManager = new WebRTCManager();
    webRTCManager.init('alumne');
  }
  
  // Set up message handling
  if (webRTCManager) {
    webRTCManager.onMessageReceived = handleWebRTCMessage;
  }
}

// Handle WebRTC messages
function handleWebRTCMessage(message) {
  switch (message.type) {
    case 'start-vote':
      handleStartVoteMessage(message.payload);
      break;
    case 'idea':
      handleIdeaMessage(message.payload);
      break;
    case 'vote':
      handleVoteMessage(message.payload);
      break;
    case 'result':
      handleResultMessage(message.payload);
      break;
    case 'system':
      handleSystemMessage(message.payload);
      break;
    case 'ready':
      console.log(`Peer ${message.senderId} (${message.role}) is ready`);
      break;
    default:
      console.log('Unknown message type received:', message.type);
      break;
  }
}

// Handle messages for different activities
function handleStartVoteMessage(payload) {
  // Update UI when professor starts a voting activity
  const activityCode = sessionStorage.getItem('activityCode');
  if (activityCode) {
    let currentActivity = JSON.parse(localStorage.getItem(activityCode));
    if (currentActivity) {
      currentActivity.status = payload.status || 'voting';
      localStorage.setItem(activityCode, JSON.stringify(currentActivity));
      
      // Update the student view if on the student page
      const container = document.querySelector('.participation-container');
      if (container) {
        updateStudentView(currentActivity, container);
      }
    }
  }
}

function handleIdeaMessage(payload) {
  const activityCode = payload.activityCode || sessionStorage.getItem('activityCode');
  if (activityCode) {
    // For students, update the local results with the received idea
    if (document.location.pathname.includes('alumne.html')) {
      let results = JSON.parse(localStorage.getItem(`${activityCode}_results`));
      if (!results) {
        results = { ideas: [], votes: {} };
      }
      if (!results.ideas) results.ideas = [];
      results.ideas.push(payload.idea);
      localStorage.setItem(`${activityCode}_results`, JSON.stringify(results));
      
      // Update local storage event to trigger UI updates on other tabs
      const event = new StorageEvent('storage', {
        key: `${activityCode}_results`,
        newValue: JSON.stringify(results)
      });
      window.dispatchEvent(event);
    }
    // For professors, the student already sent the idea directly to their local storage
  }
}

function handleVoteMessage(payload) {
  const activityCode = payload.activityCode || sessionStorage.getItem('activityCode');
  if (activityCode) {
    // For students, this would be result confirmation from professor
    if (document.location.pathname.includes('alumne.html')) {
      // Student receives confirmation that their vote was recorded
      // Update the student view to show thank you message
      const formContainer = document.querySelector('.form-wrapper');
      if (formContainer) {
        formContainer.innerHTML = '<h2>Gràcies per la teva participació!</h2>';
      }
    } 
    // For professors, update results with the received vote
    else if (document.location.pathname.includes('professor.html')) {
      const results = JSON.parse(localStorage.getItem(`${activityCode}_results`));
      if (results && results.votes) {
        results.votes[payload.option] = (results.votes[payload.option] || 0) + 1;
        localStorage.setItem(`${activityCode}_results`, JSON.stringify(results));
        
        // Update local storage event to trigger UI updates on other tabs
        const event = new StorageEvent('storage', {
          key: `${activityCode}_results`,
          newValue: JSON.stringify(results)
        });
        window.dispatchEvent(event);
      }
    }
  }
}

function handleResultMessage(payload) {
  const activityCode = sessionStorage.getItem('activityCode');
  if (activityCode) {
    localStorage.setItem(`${activityCode}_results`, JSON.stringify(payload.results));
    
    // Update local storage event to trigger UI updates on other tabs
    const event = new StorageEvent('storage', {
      key: `${activityCode}_results`,
      newValue: JSON.stringify(payload.results)
    });
    window.dispatchEvent(event);
  }
}

function handleSystemMessage(payload) {
  console.log('System message:', payload);
  // Handle system messages like connection status, etc.
}

// Integrate with existing UI: Send messages when user interacts
function sendIdeaViaWebRTC(ideaText) {
  if (webRTCManager) {
    const activityCode = sessionStorage.getItem('activityCode');
    webRTCManager.sendMessage({
      type: 'idea',
      payload: {
        idea: ideaText,
        activityCode: activityCode
      },
      senderId: localStorage.getItem('userId')
    });
  }
}

function sendVoteViaWebRTC(votes) {
  if (webRTCManager) {
    const activityCode = sessionStorage.getItem('activityCode');
    webRTCManager.sendMessage({
      type: 'vote',
      payload: {
        votes: votes,
        activityCode: activityCode
      },
      senderId: localStorage.getItem('userId')
    });
  }
}

function sendStartVoteMessage(status) {
  if (webRTCManager) {
    const activityCode = sessionStorage.getItem('activityCode');
    webRTCManager.sendMessage({
      type: 'start-vote',
      payload: {
        status: status,
        activityCode: activityCode
      },
      senderId: localStorage.getItem('userId')
    });
  }
}

// Check for WebRTC support
function checkWebRTCSupport() {
  return !!(window.RTCPeerConnection && window.RTCSessionDescription && window.RTCIceCandidate);
}

// Get stored item with fallback
WebRTCManager.prototype.getStoredItem = function(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('localStorage not available, using memory storage');
    // Fallback to memory storage if localStorage is not available
    if (!this.memoryStorage) {
      this.memoryStorage = {};
    }
    return this.memoryStorage[key];
  }
};

// Set stored item with fallback
WebRTCManager.prototype.setStoredItem = function(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('localStorage not available, using memory storage');
    // Fallback to memory storage if localStorage is not available
    if (!this.memoryStorage) {
      this.memoryStorage = {};
    }
    this.memoryStorage[key] = value;
  }
};

// Initialize WebRTC when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Ensure user ID exists before initializing WebRTC
  ensureUserId();
  
  // Check WebRTC support
  if (checkWebRTCSupport()) {
    initWebRTC();
  } else {
    console.warn('WebRTC not supported, using fallback mechanisms');
  }
});