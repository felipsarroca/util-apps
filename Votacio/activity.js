document.addEventListener('DOMContentLoaded', () => {
    // --- Elements del DOM ---
    const activityTitle = document.getElementById('activity-title');
    const statusIndicator = document.getElementById('status-indicator');
    const sessionCodeDisplay = document.getElementById('session-code');
    const participantCount = document.getElementById('participant-count');
    const resultsContainer = document.getElementById('live-results-container');
    const activityControls = document.getElementById('activity-controls');
    const startVotingBtn = document.getElementById('start-voting-btn');
    const closeActivityBtn = document.getElementById('close-activity-btn');
    const studentInteractionZone = document.getElementById('student-interaction-zone');
    const ideaForm = document.getElementById('idea-form');
    const ideaInput = document.getElementById('idea-input');
    const ideasLeftInfo = document.getElementById('ideas-left-info');
    const pollOptionsContainer = document.getElementById('poll-options-container');
    const votesLeftInfo = document.getElementById('votes-left-info');

    // --- Estat de l'aplicació ---
    let peer = null;
    let hostConnection = null;
    let guestConnections = [];
    let activityConfig = {};
    let sessionData = {};
    let studentState = { submittedIdeas: 0, castVotes: 0 };
    let myRole = 'guest';
    let sessionId = null;

    // --- INICIALITZACIÓ ---
    function init() {
        const params = new URLSearchParams(window.location.search);
        sessionId = params.get('session');
        myRole = params.get('mode');
        
        sessionCodeDisplay.textContent = sessionId;
        closeActivityBtn.addEventListener('click', closeActivity);
        startVotingBtn.addEventListener('click', startVotingPhase);

        if (myRole === 'host') {
            activityConfig = JSON.parse(decodeURIComponent(params.get('config')));
            activityTitle.textContent = activityConfig.question;
            activityControls.classList.remove('hidden');
            hostSession(sessionId);
        } else {
            studentInteractionZone.classList.remove('hidden');
            ideaForm.addEventListener('submit', handleIdeaSubmit);
            joinSession(sessionId);
        }
    }

    // --- LÒGICA DE PEERJS (PROFESSOR) ---
    function hostSession(sessionId) {
        peer = new Peer(sessionId);
        peer.on('open', id => {
            statusIndicator.textContent = 'Sessió activa';
            sessionData = { phase: activityConfig.type.includes('brainstorm') ? 'brainstorm' : 'voting', ideas: [], votes: activityConfig.type === 'poll' ? activityConfig.pollOptions.reduce((acc, opt) => ({...acc, [opt]: 0}), {}) : {} };
            if (activityConfig.type === 'brainstorm-poll') startVotingBtn.classList.remove('hidden');
            renderTeacherResults();
        });
        peer.on('connection', handleNewConnection);
        peer.on('error', (err) => console.error('Error de PeerJS:', err));
    }

    function handleNewConnection(conn) {
        guestConnections.push(conn);
        updateParticipantCount();
        conn.on('open', () => conn.send({ type: 'session-data', payload: { config: activityConfig, data: sessionData } }));
        conn.on('data', data => handleStudentData(conn, data));
        conn.on('close', () => { guestConnections = guestConnections.filter(c => c.peer !== conn.peer); updateParticipantCount(); });
    }

    function handleStudentData(conn, data) {
        if (data.type === 'new-idea') sessionData.ideas.push({ id: `idea-${Date.now()}`.slice(-6), text: data.payload });
        else if (data.type === 'vote') sessionData.votes[data.payload.id] = (sessionData.votes[data.payload.id] || 0) + 1;
        broadcastUpdate();
        renderTeacherResults();
    }

    function startVotingPhase() {
        sessionData.phase = 'voting';
        sessionData.votes = sessionData.ideas.reduce((acc, idea) => ({...acc, [idea.id]: 0}), {});
        startVotingBtn.classList.add('hidden');
        broadcastUpdate();
        renderTeacherResults();
    }

    function broadcastUpdate() {
        guestConnections.forEach(conn => conn.send({ type: 'data-update', payload: sessionData }));
    }

    // --- LÒGICA DE PEERJS (ALUMNE) ---
    function joinSession(sessionId) {
        peer = new Peer();
        peer.on('open', () => {
            hostConnection = peer.connect(sessionId, { reliable: true });
            hostConnection.on('open', () => statusIndicator.textContent = 'Connectat!');
            hostConnection.on('data', handleTeacherData);
            hostConnection.on('close', () => { alert('Connexió perduda amb el professor.'); window.close(); });
            hostConnection.on('error', () => { alert('No s\'ha pogut connectar a la sessió.'); window.close(); });
        });
    }

    function handleTeacherData(data) {
        if (data.type === 'session-data' || data.type === 'data-update') {
            if (data.payload.config) activityConfig = data.payload.config;
            sessionData = data.payload.data || data.payload;
            activityTitle.textContent = activityConfig.question;
            renderStudentView();
        } else if (data.type === 'session-closed') {
            alert('La sessió ha estat tancada pel professor.');
            window.close();
        }
    }

    // --- RENDERITZAT (VISTES) ---
    function renderTeacherResults() {
        resultsContainer.innerHTML = '';
        const { type } = activityConfig;
        const { phase, ideas, votes } = sessionData;

        if (phase === 'brainstorm') {
            statusIndicator.textContent = 'Pluja d\'idees activa';
            resultsContainer.className = 'idea-grid';
            if (ideas.length === 0) { resultsContainer.innerHTML = '<p class="placeholder">Esperant idees...</p>'; return; }
            ideas.forEach(idea => resultsContainer.innerHTML += `<div class="idea-post-it">${idea.text}</div>`);
        } else if (phase === 'voting') {
            statusIndicator.textContent = 'Votació en directe';
            resultsContainer.className = 'poll-grid';
            const items = type === 'poll' ? activityConfig.pollOptions : ideas;
            if (items.length === 0) { resultsContainer.innerHTML = '<p class="placeholder">No hi ha res a votar.</p>'; return; }
            
            const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
            const sortedItems = [...items].sort((a, b) => {
                const votesA = votes[typeof a === 'object' ? a.id : a] || 0;
                const votesB = votes[typeof b === 'object' ? b.id : b] || 0;
                return votesB - votesA;
            });

            sortedItems.forEach(item => {
                const id = typeof item === 'object' ? item.id : item;
                const text = typeof item === 'object' ? item.text : item;
                const currentVotes = votes[id] || 0;
                const percentage = totalVotes > 0 ? (currentVotes / totalVotes) * 100 : 0;
                resultsContainer.innerHTML += `
                    <div class="poll-result-bar-live">
                        <div class="poll-live-label">${text}</div>
                        <div class="poll-live-votes">${currentVotes}</div>
                        <div class="poll-live-bar" style="width: ${percentage}%"></div>
                    </div>`;
            });
        }
    }

    function renderStudentView() {
        ideaForm.classList.add('hidden');
        pollOptionsContainer.classList.add('hidden');
        const { type, ideasPerStudent, votesPerStudent } = activityConfig;
        const { phase, ideas } = sessionData;

        if (phase === 'brainstorm' && studentState.submittedIdeas < ideasPerStudent) {
            ideasLeftInfo.textContent = `Pots enviar ${ideasPerStudent - studentState.submittedIdeas} idea(es).`;
            ideaForm.classList.remove('hidden');
        } else if (phase === 'voting' && studentState.castVotes < votesPerStudent) {
            votesLeftInfo.textContent = `Pots emetre ${votesPerStudent - studentState.castVotes} vot(s).`;
            pollOptionsContainer.innerHTML = '';
            const options = type === 'poll' ? activityConfig.pollOptions : ideas;
            options.forEach(option => {
                const id = typeof option === 'object' ? option.id : option;
                const text = typeof option === 'object' ? option.text : option;
                pollOptionsContainer.innerHTML += `<button data-id="${id}">${text}</button>`;
            });
            pollOptionsContainer.querySelectorAll('button').forEach(btn => btn.addEventListener('click', handleVoteClick));
            pollOptionsContainer.classList.remove('hidden');
        } else {
            studentInteractionZone.innerHTML = '<p>Gràcies per participar! Espera instruccions.</p>';
        }
    }

    // --- GESTIÓ D'EVENTS ---
    function handleIdeaSubmit(e) {
        e.preventDefault();
        if (ideaInput.value.trim()) {
            hostConnection.send({ type: 'new-idea', payload: ideaInput.value.trim() });
            studentState.submittedIdeas++;
            ideaInput.value = '';
            renderStudentView();
        }
    }

    function handleVoteClick(e) {
        const btn = e.target;
        hostConnection.send({ type: 'vote', payload: { id: btn.dataset.id } });
        studentState.castVotes++;
        btn.classList.add('voted');
        if (studentState.castVotes >= activityConfig.votesPerStudent) {
            document.querySelectorAll('#poll-options-container button').forEach(b => b.disabled = true);
        }
    }

    function closeActivity() {
        if (confirm('Vols tancar l\'activitat per a tothom?')) {
            guestConnections.forEach(conn => conn.send({ type: 'session-closed' }));
            if (peer) peer.destroy();
            window.close();
        }
    }

    const updateParticipantCount = () => participantCount.textContent = guestConnections.length;

    // --- INICI DE L'APLICACIÓ ---
    init();
});