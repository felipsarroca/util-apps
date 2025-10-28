let activityType = 'voting'; // Default to voting

// --- Variables Globales ---
let peer = null;
let hostConnection = null;
let guestConnections = [];
let sessionData = {
    question: '',
    ideasPerPerson: 1,
    votesPerPerson: 3,
    themeColor: '#4f46e5',
    ideas: [], // { id, text, votes }
    options: [], // { text, votes } - for voting only
    phase: 'submission', // 'submission' or 'voting' - for brainstorm-voting
    activityType: 'voting' // 'voting', 'brainstorm', 'brainstorm-voting'
};
let participantState = { submittedIdeas: 0, castVotes: 0, votes: {} }; // votes: { [ideaId]: count }
let pendingVotes = {};   // { [ideaId]: 1 | -1 }
let myPeerId = null;
let voteTimeout = null;
let countdownInterval = null;

// --- LÓGICA DE INICIO ---
window.onload = function() {
    checkURLParameters();
    document.getElementById('participate-btn').addEventListener('click', joinSession);
};

function checkURLParameters() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session');
    if (sessionId) {
        document.getElementById('activity-code').value = sessionId;
        joinSession();
    }
}

function showProfessorActivity(type) {
    activityType = type;
    document.getElementById('professor-initial-view').classList.add('hidden');
    const presenterView = document.getElementById('presenter-view');
    presenterView.classList.remove('hidden');

    let formHTML = `
        <h2>Configuracio: ${type}</h2>
    `;

    if (type === 'brainstorm' || type === 'brainstorm-voting') {
        formHTML += `
            <div class="form-group">
                <label for="question">Tema o pregunta:</label>
                <input type="text" id="question" placeholder="Ex: Que podem fer per millorar el pati?">
            </div>
            <div class="form-group">
                <label for="ideas-per-person">Nombre d'idees per persona:</label>
                <input type="number" id="ideas-per-person" value="1" min="1" max="10">
            </div>
        `;
        
        if (type === 'brainstorm-voting') {
            formHTML += `
                <div class="form-group">
                    <label for="votes-per-person">Nombre de vots per persona:</label>
                    <input type="number" id="votes-per-person" value="3" min="1" max="10">
                </div>
            `;
        }
    }

    if (type === 'voting') {
         formHTML += `
            <div class="form-group">
                <label for="question">Tema de la votacio:</label>
                <input type="text" id="question" placeholder="Ex: Quin es el vostre color preferit?">
            </div>
            <div class="form-group">
                <label for="options-container">Opcions (una per linia):</label>
                <div id="options-container">
                    <input type="text" name="option" placeholder="Opcio 1">
                    <input type="text" name="option" placeholder="Opcio 2">
                </div>
                <button onclick="addOption()" class="add-option-btn">+ Afegeix una opcio</button>
            </div>
        `;
    }

    formHTML += `
        <div class="button-group">
            <button onclick="hostSession()" id="host-button" class="button">
                <span id="host-button-text">Generar Codi</span>
                <div id="host-loader" class="loader hidden"></div>
            </button>
        </div>
    `;

    document.getElementById('create-session-form').innerHTML = formHTML;
}

// --- LÓGICA GENERAL DE LA UI ---

function addOption() {
    const container = document.getElementById('options-container');
    const optionCount = container.children.length + 1;
    const newOptionInput = document.createElement('input');
    newOptionInput.type = 'text';
    newOptionInput.name = 'option';
    newOptionInput.placeholder = `Opcio ${optionCount}`;
    container.appendChild(newOptionInput);
}

function copyCode() {
    const code = document.getElementById('session-code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        const toast = document.getElementById('toast');
        toast.innerText = 'Codi copiat al porta-retalls';
        toast.style.opacity = 1;
        setTimeout(() => { toast.style.opacity = 0; }, 2000);
    });
}

function copyUrl(event) {
    event.preventDefault();
    const url = event.target.href;
    navigator.clipboard.writeText(url).then(() => {
        const toast = document.getElementById('toast');
        toast.innerText = 'URL copiada al porta-retalls';
        toast.style.opacity = 1;
        setTimeout(() => { toast.style.opacity = 0; }, 2000);
    });
}

function generateQRCode(url) {
    const container = document.getElementById('qrcode-container');
    container.innerHTML = '';
    new QRCode(container, {
        text: url,
        width: 200,
        height: 200,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
}

// --- STORAGE FUNCTIONS & UTILS ---
function saveVotesToStorage() {
  const sessionId = hostConnection ? hostConnection.peer : null;
  if (!sessionId) return;
  localStorage.setItem(`votes_${sessionId}`, JSON.stringify(participantState));
}

function loadVotesFromStorage(sessionId) {
  if (!sessionId) return;
  const data = localStorage.getItem(`votes_${sessionId}`);
  if (data) {
    try {
      const loadedState = JSON.parse(data);
      if (loadedState && typeof loadedState.votes === 'object') {
          participantState = loadedState;
      }
    } catch (e) {
        console.error("Error loading votes from storage:", e);
        participantState = { submittedIdeas: 0, castVotes: 0, votes: {} };
    }
  }
}

function recomputeCastVotes() {
  participantState.castVotes = Object.values(participantState.votes)
    .reduce((a, v) => a + (v ? 1 : 0), 0);
}

function findIdeaButton(ideaId) {
  return document.querySelector(`#vote-options-container button[data-id="${ideaId}"]`);
}

function setButtonPending(btn, isPending) {
  if (!btn) return;
  if (isPending) {
    btn.classList.add('opacity-60', 'pointer-events-none');
    const badge = btn.querySelector('.voted-badge');
    if (badge) badge.style.display = 'none';
  } else {
    btn.classList.remove('opacity-60', 'pointer-events-none');
  }
}

function setButtonConfirmed(btn, voted) {
  if (!btn) return;
  if (voted) {
    btn.classList.add('voted-idea');
    const badge = btn.querySelector('.voted-badge');
    if (badge) {
      badge.textContent = 1;
      badge.style.display = 'inline-flex';
    }
  } else {
    btn.classList.remove('voted-idea');
    const badge = btn.querySelector('.voted-badge');
    if (badge) badge.style.display = 'none';
  }
}

// --- LÓGICA DEL PRESENTADOR (ANFITRIÓN) ---
function hostSession() {
    const question = document.getElementById('question').value.trim();
    
    // Prepare session data based on activity type
    if (activityType === 'voting') {
        const optionInputs = document.querySelectorAll('#options-container input[name="option"]');
        const options = Array.from(optionInputs)
            .map(input => input.value.trim())
            .filter(text => text !== '')
            .map(text => ({ text: text, votes: 0 }));

        if (!question || options.length < 2) {
            alert('Si us plau, introdueix una pregunta i almenys dues opcions.');
            return;
        }
        
        sessionData = { 
            question, 
            options, 
            activityType,
            ideas: [],
            phase: 'voting',
            ideasPerPerson: 1,
            votesPerPerson: 0
        };
    } else if (activityType === 'brainstorm') {
        const ideasPerPerson = parseInt(document.getElementById('ideas-per-person').value, 10) || 1;
        
        if (!question) {
            alert('Si us plau, introdueix una pregunta o tema.');
            return;
        }
        
        sessionData = { 
            question, 
            activityType,
            ideas: [], // will be populated as ideas are submitted
            phase: 'submission',
            ideasPerPerson,
            votesPerPerson: 0
        };
    } else if (activityType === 'brainstorm-voting') {
        const ideasPerPerson = parseInt(document.getElementById('ideas-per-person').value, 10) || 1;
        const votesPerPerson = parseInt(document.getElementById('votes-per-person').value, 10) || 3;
        
        if (!question) {
            alert('Si us plau, introdueix una pregunta o tema.');
            return;
        }
        
        sessionData = { 
            question, 
            activityType,
            ideas: [], // will be populated as ideas are submitted
            phase: 'submission', // start with submission phase
            ideasPerPerson,
            votesPerPerson
        };
    }
    
    document.getElementById('create-session-form').classList.add('hidden');
    document.getElementById('results-view').classList.remove('hidden');

    const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    peer = new Peer(sessionId); 

    peer.on('open', (id) => {
        myPeerId = id;
        const baseUrl = window.location.href.split('?')[0];
        const sessionUrl = baseUrl + '?session=' + id;
        
        generateQRCode(sessionUrl);

        document.getElementById('session-code').innerText = id;
        document.getElementById('results-question').innerText = question;
        document.getElementById('direct-session-link').href = sessionUrl;
        document.getElementById('direct-session-link').innerText = sessionUrl;

        updateResultsView(sessionData);
    });

    peer.on('connection', (conn) => {
        guestConnections.push(conn);
        conn.on('open', () => {
            conn.send({ type: 'session-data', payload: sessionData });
        });
        conn.on('data', (data) => {
            if (data.type === 'vote') {
                handleVote(data.payload.optionIndex);
                conn.send({ type: 'vote-confirmed' });
            } else if (data.type === 'new-idea') {
                handleNewIdea(data.payload, conn);
                conn.send({ type: 'idea-confirmed' });
            } else if (data.type === 'vote-idea') {
                handleIdeaVote(data.payload, conn);
            }
        });
        conn.on('close', () => {
            guestConnections = guestConnections.filter(c => c.peer !== conn.peer);
        });
    });

    peer.on('error', (err) => {
        alert('Hi ha hagut un error amb la connexio. Si us plau, recarrega la pagina.');
        console.error(err);
        document.getElementById('host-button-text').classList.remove('hidden');
        document.getElementById('host-loader').classList.add('hidden');
    });
}

function handleNewIdea(ideaText, connection) {
    const newIdea = { 
        id: 'idea-' + Date.now() + Math.random().toString(36).substring(2, 5), 
        text: ideaText, 
        votes: 0 
    };
    sessionData.ideas.push(newIdea);
    updateResultsView(sessionData);
    
    // Notify all other connections about the new idea
    guestConnections.forEach(conn => {
        if (conn !== connection) {
            conn.send({ type: 'session-data', payload: sessionData });
        }
    });
}

function handleIdeaVote(payload, connection) {
    const { ideaId, delta } = payload;
    const idea = sessionData.ideas.find(i => i.id === ideaId);
    if (idea) {
        idea.votes += delta;
        connection.send({ type: 'vote-idea-confirmed', payload: { ideaId, delta } });
        updateResultsView(sessionData);
    }
}

function handleVote(optionIndex) {
    sessionData.options[optionIndex].votes++;
    updateResultsView(sessionData);
}

function updateResultsView(data) {
    const resultsContainerEl = document.getElementById('results-container');
    if(!resultsContainerEl) return;
    resultsContainerEl.innerHTML = '';

    if (data.activityType === 'voting') {
        // For voting activities - show options with vote counts
        const totalVotes = data.options.reduce((sum, option) => sum + option.votes, 0);
        
        document.getElementById('total-votes').innerText = totalVotes;

        const sortedOptions = [...data.options].sort((a,b) => b.votes - a.votes);

        sortedOptions.forEach((option, index) => {
            const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
            const resultElement = document.createElement('div');
            resultElement.className = 'vote-result';
            resultElement.style.order = index;

            resultElement.innerHTML = `
                <p class="option-text">${option.text}</p>
                <div class="progress-bar">
                     <div class="progress" style="width: ${percentage}%;"></div>
                </div>
                <p class="vote-count">${option.votes}</p>
            `;
            resultsContainerEl.appendChild(resultElement);
        });
    } else {
        // For brainstorming activities - show ideas list
        const sortedIdeas = [...data.ideas].sort((a, b) => b.votes - a.votes);
        
        let totalVotes = 0;
        sortedIdeas.forEach(idea => totalVotes += idea.votes);
        
        document.getElementById('total-votes').innerText = totalVotes;

        // Show the start voting button only if needed
        const startVotingBtn = document.getElementById('start-voting-btn');
        if (data.activityType === 'brainstorm-voting' && data.phase === 'submission') {
            startVotingBtn.classList.remove('hidden');
        } else {
            startVotingBtn.classList.add('hidden');
        }

        sortedIdeas.forEach((idea, index) => {
            const ideaElement = document.createElement('div');
            ideaElement.className = 'vote-result';
            ideaElement.style.order = index;

            ideaElement.innerHTML = `
                <p class="option-text">${idea.text}</p>
                <div class="progress-bar">
                     <div class="progress" style="width: ${data.phase === 'voting' ? 100 : 0}%;"></div>
                </div>
                <p class="vote-count">${idea.votes}</p>
            `;
            resultsContainerEl.appendChild(ideaElement);
        });
    }
}

function startVotingPhase() {
    if (sessionData.activityType !== 'brainstorm-voting') return;
    
    sessionData.phase = 'voting';
    
    // Update the view to reflect the phase change
    updateResultsView(sessionData);
    
    // Broadcast the updated session data to all participants
    guestConnections.forEach(conn => {
        conn.send({ type: 'session-data', payload: sessionData });
    });
}

// --- LÓGICA DEL PARTICIPANTE (INVITADO) ---

function joinSession() {
    const hostId = document.getElementById('activity-code').value.trim().toUpperCase();
    if (!hostId) return;
    
    const joinButton = document.getElementById('participate-btn');
    joinButton.setAttribute('disabled', true);

    peer = new Peer();

    peer.on('open', () => {
        hostConnection = peer.connect(hostId, { reliable: true });
        
        hostConnection.on('open', () => {});

        hostConnection.on('data', (data) => {
            if (data.type === 'session-data') {
                sessionData = data.payload;
                
                // Load previous state if exists
                loadVotesFromStorage(hostConnection.peer);
                
                const hasVoted = localStorage.getItem('voted_in_' + hostConnection.peer);
                const hasSubmitted = localStorage.getItem('submitted_in_' + hostConnection.peer);
                
                if (sessionData.activityType === 'voting') {
                    if (hasVoted) {
                        showVotedView();
                    } else {
                        showVotingView(data.payload);
                    }
                } else {
                    // For brainstorming or brainstorm-voting
                    if (sessionData.phase === 'voting') {
                        if (participantState.castVotes >= sessionData.votesPerPerson && sessionData.ideas.some(idea => participantState.votes[idea.id])) {
                            showCompletedView();
                        } else {
                            showVotingView(data.payload);
                        }
                    } else {
                        // Phase is submission
                        if (participantState.submittedIdeas >= sessionData.ideasPerPerson) {
                            showWaitingView();
                        } else {
                            showIdeaSubmissionView(data.payload);
                        }
                    }
                }
            } else if (data.type === 'vote-confirmed') {
                clearTimeout(voteTimeout);
                clearInterval(countdownInterval);
                localStorage.setItem('voted_in_' + hostConnection.peer, 'true');
                showVotedView();
                setTimeout(() => {
                    if (hostConnection) hostConnection.close();
                }, 500);
            } else if (data.type === 'idea-confirmed') {
                participantState.submittedIdeas++;
                saveVotesToStorage();
                document.getElementById('participant-info').innerText = 'Idea enviada!';
                
                // Check if we can submit more ideas
                if (participantState.submittedIdeas >= sessionData.ideasPerPerson) {
                    showWaitingView();
                } else {
                    // Continue with idea submission
                    showIdeaSubmissionView(sessionData);
                }
            } else if (data.type === 'vote-idea-confirmed') {
                const { ideaId, delta } = data.payload;

                delete pendingVotes[ideaId];

                participantState.votes[ideaId] = delta === 1 ? 1 : 0;
                recomputeCastVotes();
                saveVotesToStorage();

                const btn = findIdeaButton(ideaId);
                setButtonPending(btn, false);
                setButtonConfirmed(btn, participantState.votes[ideaId] === 1);

                const votesLeft = sessionData.votesPerPerson - participantState.castVotes;
                const votesLeftEl = document.getElementById('votes-left');
                if (votesLeftEl) {
                  votesLeftEl.innerText = `Pots votar per ${votesLeft} idea(es).`;
                }

                if (participantState.castVotes >= sessionData.votesPerPerson &&
                    sessionData.ideas.some(idea => participantState.votes[idea.id])) {
                  showCompletedView();
                }
            }
        });
        
        hostConnection.on('error', (err) => {
            console.error('Error en la conexio:', err);
            showJoinError();
        });
        
        hostConnection.on('close', () => {
            if (!localStorage.getItem('voted_in_' + hostConnection.peer)) {
               showJoinError();
            }
        });
    });
    
    peer.on('error', (err) => {
        console.error('Error de PeerJS:', err);
        showJoinError();
    });
}

function showJoinError() {
    const errorP = document.getElementById('join-error');
    if(errorP) {
        errorP.innerText = 'Error de conexio. Verifica el codi o que la persona amfitriona estigui connectada.';
        errorP.classList.remove('hidden');
    }
    const joinButton = document.getElementById('participate-btn');
    if(joinButton) joinButton.removeAttribute('disabled');
}

function showIdeaSubmissionView(data) {
    document.getElementById('join-session-form').classList.add('hidden');
    document.getElementById('voting-form').classList.add('hidden');
    document.getElementById('completed-view').classList.add('hidden');
    const ideaForm = document.getElementById('idea-form');
    ideaForm.classList.remove('hidden');
    
    document.getElementById('idea-form-title').innerText = data.question;
    const ideasLeft = data.ideasPerPerson - participantState.submittedIdeas;
    document.getElementById('ideas-left').innerText = `Et queden ${ideasLeft} idea(es) per enviar.`;
    document.getElementById('participant-info').innerText = '';
    document.getElementById('idea-input').style.display = 'block';
    document.getElementById('send-idea-btn').style.display = 'block';
}

function showVotingView(data) {
    document.getElementById('join-session-form').classList.add('hidden');
    document.getElementById('idea-form').classList.add('hidden');
    document.getElementById('completed-view').classList.add('hidden');
    const votingView = document.getElementById('voting-form');
    votingView.classList.remove('hidden');
    
    document.getElementById('voting-form-title').innerText = data.question;
    const optionsContainer = document.getElementById('vote-options-container');
    optionsContainer.innerHTML = '';

    if (data.activityType === 'voting') {
        // Show voting buttons for regular voting
        data.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = "button option-button";
            button.innerText = option.text;
            button.onclick = () => castVote(index);
            optionsContainer.appendChild(button);
        });
    } else {
        // Show voting buttons for brainstorming ideas
        document.getElementById('voting-form-title').innerText = 'Vota per les teves idees preferides';
        const votesLeft = data.votesPerPerson - participantState.castVotes;
        document.getElementById('votes-left').innerText = `Pots votar per ${votesLeft} idea(es).`;
        
        data.ideas.forEach(idea => {
          const button = document.createElement('button');
          button.className = 'w-full p-3 border rounded-lg hover:bg-gray-100 flex items-center justify-between text-left';
          button.dataset.id = idea.id;
          button.innerHTML = `
            <span class="truncate mr-3">${idea.text}</span>
            <span class="voted-badge" style="display:none">1</span>
          `;
          
          const confirmedCount = participantState.votes[idea.id] || 0;
          if (confirmedCount > 0) {
            setButtonConfirmed(button, true);
          }
          if (pendingVotes[idea.id]) {
            setButtonPending(button, true);
          }

          button.onclick = () => castIdeaVote(idea.id, button);
          optionsContainer.appendChild(button);
        });
    }
}

function showWaitingView() {
    document.getElementById('join-session-form').classList.add('hidden');
    document.getElementById('voting-form').classList.add('hidden');
    document.getElementById('idea-form').classList.add('hidden');
    const ideaForm = document.getElementById('idea-form');
    ideaForm.classList.remove('hidden');
    
    document.getElementById('idea-form-title').innerText = sessionData.question;
    document.getElementById('ideas-left').innerText = '';
    document.getElementById('idea-input').style.display = 'none';
    document.getElementById('send-idea-btn').style.display = 'none';
    document.getElementById('participant-info').innerText = 'Has enviat totes les teves idees. Esperant que el presentador inicii la votacio...';
    
    // Listen for session data updates to detect when phase changes
    if (sessionData && sessionData.phase === 'voting') {
        // If phase is already voting, show voting view
        showVotingView(sessionData);
    }
}

function showCompletedView() {
    document.getElementById('join-session-form').classList.add('hidden');
    document.getElementById('voting-form').classList.add('hidden');
    document.getElementById('idea-form').classList.add('hidden');
    document.getElementById('completed-view').classList.remove('hidden');
}

function showVotedView() {
    clearTimeout(voteTimeout);
    clearInterval(countdownInterval);
    document.getElementById('join-session-form').classList.add('hidden');
    document.getElementById('voting-form').classList.add('hidden');
    document.getElementById('completed-view').classList.remove('hidden');
}

function castVote(optionIndex) {
    if (hostConnection) {
        // Disable buttons to prevent multiple votes
        const optionsContainer = document.getElementById('vote-options-container');
        optionsContainer.querySelectorAll('button').forEach(btn => btn.disabled = true);
        
        hostConnection.send({ type: 'vote', payload: { optionIndex } });

        // Set a timeout for vote confirmation
        voteTimeout = setTimeout(() => {
            showJoinError(); // Or a more specific error
        }, 10000); 
    }
}

function sendIdea() {
    const ideaText = document.getElementById('idea-input').value.trim();
    if (!ideaText) return;
    if (hostConnection) {
        hostConnection.send({ type: 'new-idea', payload: ideaText });
        document.getElementById('idea-input').value = ''; // Clear the input after sending
    }
}

function handleIdeaKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // Prevent new line
        sendIdea(); // Send the idea
    }
}

function castIdeaVote(ideaId, buttonEl) {
  const alreadyVoted = (participantState.votes[ideaId] || 0) === 1;
  const pending = pendingVotes[ideaId] || 0;

  if (pending !== 0) return;

  const delta = alreadyVoted ? -1 : 1;

  if (delta === 1 && participantState.castVotes >= sessionData.votesPerPerson) {
    return;
  }

  pendingVotes[ideaId] = delta;
  setButtonPending(buttonEl, true);

  hostConnection.send({ type: 'vote-idea', payload: { ideaId, delta } });
}