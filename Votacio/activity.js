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
    const sessionCodeLarge = document.getElementById('session-code-large');
    const sidebarParticipants = document.getElementById('sidebar-participants');
    const phaseDescription = document.getElementById('phase-description');
    const studentQuestion = document.getElementById('student-question');

    // --- Estat de l\'aplicaciÃ³ ---
    let peer = null;
    let hostConnection = null;
    let guestConnections = [];
    let activityConfig = {};
    let sessionData = {};
    let studentState = { submittedIdeas: 0, castVotes: 0, pendingVotes: [] };
    let myRole = 'guest';
    let sessionId = null;

    const createIdeaId = () => {
        if (window.crypto?.randomUUID) return `idea-${window.crypto.randomUUID().slice(-8)}`;
        return `idea-${Math.random().toString(36).slice(2, 10)}`;
    };

    const setResultsContainerMode = (modeClass = '') => {
        const classes = ['live-feed'];
        if (modeClass) classes.push(modeClass);
        resultsContainer.className = classes.join(' ');
    };

    const buildInitialSessionState = () => {
        const base = { phase: 'voting', ideas: [], votes: {} };
        if (activityConfig.type === 'brainstorm') {
            base.phase = 'brainstorm';
        } else if (activityConfig.type === 'brainstorm-poll') {
            base.phase = 'brainstorm';
        } else if (activityConfig.type === 'poll') {
            const options = Array.isArray(activityConfig.pollOptions) ? activityConfig.pollOptions : [];
            base.votes = options.reduce((acc, opt) => ({ ...acc, [opt]: 0 }), {});
        }
        return base;
    };

    const updateStudentQuestion = () => {
        if (!studentQuestion) return;
        const hasQuestion = Boolean(activityConfig.question);
        studentQuestion.textContent = hasQuestion ? activityConfig.question : '';
        studentQuestion.classList.toggle('hidden', !hasQuestion);
    };

    // --- INICIALITZACIÓ ---
    function init() {
        const params = new URLSearchParams(window.location.search);
        sessionId = params.get('session');
        myRole = params.get('mode');

        setResultsContainerMode('placeholder-state');
        resultsContainer.innerHTML = '<p class="placeholder">Preparant la sessió...</p>';
        updatePhaseDescription('waiting');

        sessionCodeDisplay.textContent = sessionId;
        if (sessionCodeLarge) sessionCodeLarge.textContent = sessionId;
        closeActivityBtn.addEventListener('click', closeActivity);
        startVotingBtn.addEventListener('click', startVotingPhase);

        if (myRole === 'host') {
            activityConfig = JSON.parse(decodeURIComponent(params.get('config')));
            activityTitle.textContent = activityConfig.question;
            activityControls.classList.remove('hidden');
            document.body.classList.remove('guest-mode');
            sessionData = buildInitialSessionState();
            if (activityConfig.type === 'brainstorm-poll') startVotingBtn.classList.remove('hidden');
            updateStudentQuestion();
            renderTeacherResults();
            hostSession(sessionId);
            updateParticipantCount();
        } else {
            document.body.classList.add('guest-mode');
            ideaForm.addEventListener('submit', handleIdeaSubmit);
            joinSession(sessionId);
        }
    }

    // --- LÃ’GICA DE PEERJS (PROFESSOR) ---
    function hostSession(sessionId) {
        peer = new Peer(sessionId);
        peer.on('open', id => {
            statusIndicator.textContent = 'Sessió activa';
            sessionData = buildInitialSessionState();
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
        if (data.type === 'new-idea') sessionData.ideas.push({ id: createIdeaId(), text: data.payload });
        else if (data.type === 'vote-batch') {
            data.payload.ids.forEach(id => {
                sessionData.votes[id] = (sessionData.votes[id] || 0) + 1;
            });
        }
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
        const payload = { config: activityConfig, data: sessionData };
        guestConnections.forEach(conn => conn.send({ type: 'data-update', payload }));
    }

    // --- LÃ’GICA DE PEERJS (ALUMNE) ---
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
            const payload = data.payload || {};
            const incomingConfig = payload.config;
            const previousType = activityConfig?.type;
            if (incomingConfig) activityConfig = incomingConfig;
            sessionData = payload.data ?? payload;

            if (incomingConfig && incomingConfig.type !== previousType) {
                studentState = { submittedIdeas: 0, castVotes: 0, pendingVotes: [] };
                const submitBtn = document.getElementById('submit-votes-btn');
                if (submitBtn) submitBtn.classList.add('hidden');
            }

            activityTitle.textContent = activityConfig.question || 'Activitat en directe';
            updateStudentQuestion();
            studentInteractionZone.classList.remove('hidden');
            renderStudentView();
        } else if (data.type === 'session-closed') {
            alert('La sessió ha estat tancada pel professor.');
            window.close();
        }
    }

    // --- RENDERITZAT (VISTES) ---
    function renderTeacherResults() {
        const { type } = activityConfig;
        const { phase, ideas, votes } = sessionData;

        updatePhaseDescription(phase);
        updateStudentQuestion();

        if (phase === 'brainstorm') {
            statusIndicator.textContent = 'Pluja d\'idees activa';
            setResultsContainerMode('idea-bubble-container');
            resultsContainer.innerHTML = '';
            if (ideas.length === 0) {
                resultsContainer.innerHTML = '<p class="placeholder">Esperant idees...</p>';
                return;
            }
            ideas.forEach(idea => {
                resultsContainer.innerHTML += `<div class="idea-bubble">${idea.text}</div>`;
            });
        } else if (phase === 'voting') {
            statusIndicator.textContent = 'VotaciÃ³ en directe';
            setResultsContainerMode('poll-grid');
            const items = type === 'poll' ? activityConfig.pollOptions : ideas;
            if (items.length === 0) {
                resultsContainer.innerHTML = '<p class="placeholder">No hi ha res a votar.</p>';
                return;
            }

            const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
            const sortedItems = [...items].sort((a, b) => {
                const votesA = votes[typeof a === 'object' ? a.id : a] || 0;
                const votesB = votes[typeof b === 'object' ? b.id : b] || 0;
                return votesB - votesA;
            });

            const previousElements = Array.from(resultsContainer.querySelectorAll('[data-item-id]'));
            const previousRanks = {};
            previousElements.forEach(el => {
                const id = el.dataset.itemId;
                const rank = parseInt(el.dataset.rank, 10);
                if (id) previousRanks[id] = rank;
            });

            resultsContainer.innerHTML = '';

            sortedItems.forEach((item, index) => {
                const id = typeof item === 'object' ? item.id : item;
                const text = typeof item === 'object' ? item.text : item;
                const currentVotes = votes[id] || 0;
                const percentage = totalVotes > 0 ? (currentVotes / totalVotes) * 100 : 0;

                const previousRank = previousRanks[id];
                const currentRank = index + 1;
                let animationClass = '';

                if (previousRank !== undefined) {
                    if (currentRank < previousRank) animationClass = 'rank-up-animation';
                    else if (currentRank > previousRank) animationClass = 'rank-down-animation';
                }

                resultsContainer.innerHTML += `
                    <div class="poll-result-bar-live ${animationClass}" data-item-id="${id}" data-rank="${currentRank}">
                        <div class="poll-live-label">${text}</div>
                        <div class="poll-live-votes">${currentVotes}</div>
                        <div class="poll-live-bar" style="width: ${percentage}%" data-percentage="${percentage.toFixed(1)}"></div>
                    </div>`;

                setTimeout(() => {
                    const element = document.querySelector('[data-item-id="' + id + '"]');
                    if (element) element.classList.remove(animationClass);
                }, 500);
            });
        } else {
            statusIndicator.textContent = 'Sessió en pausa';
            setResultsContainerMode('placeholder-state');
            resultsContainer.innerHTML = '<p class="placeholder">Esperant actualitzacions...</p>';
        }
    }

    function renderStudentView() {
        ideaForm.classList.add('hidden');
        pollOptionsContainer.classList.add('hidden');
        const { type, ideasPerStudent, votesPerStudent } = activityConfig;
        const { phase, ideas } = sessionData;

        updatePhaseDescription(phase);
        updateStudentQuestion();

        let message = studentInteractionZone.querySelector('.student-thanks');
        const showMessage = (text) => {
            if (!message) {
                message = document.createElement('p');
                message.className = 'student-thanks hidden';
                studentInteractionZone.appendChild(message);
            }
            message.textContent = text;
            message.classList.remove('hidden');
        };
        if (message) message.classList.add('hidden');

        if (phase === 'brainstorm' && studentState.submittedIdeas < ideasPerStudent) {
            ideasLeftInfo.textContent = `Pots enviar ${ideasPerStudent - studentState.submittedIdeas} idea(es).`;
            ideaForm.classList.remove('hidden');
            return;
        }

        if (phase === 'voting') {
            if (studentState.castVotes > 0) {
                if (message) {
                    message.classList.remove('hidden');
                } else {
                    showMessage('Vots enviats! Gràcies per participar.');
                }
                return;
            }
            votesLeftInfo.textContent = `Pots triar fins a ${votesPerStudent} opcions.`;
            const wrapper = document.getElementById('vote-cards-wrapper');
            wrapper.innerHTML = '';
            const options = type === 'poll' ? (activityConfig.pollOptions || []) : ideas;
            options.forEach(option => {
                const id = typeof option === 'object' ? option.id : option;
                const text = typeof option === 'object' ? option.text : option;
                wrapper.innerHTML += `<div class="vote-card" data-id="${id}">${text}</div>`;
            });
            wrapper.querySelectorAll('.vote-card').forEach(card => card.addEventListener('click', handleVoteCardClick));
            const submitButton = document.getElementById('submit-votes-btn');
            submitButton.classList.remove('hidden');
            const freshSubmitButton = submitButton.cloneNode(true);
            submitButton.replaceWith(freshSubmitButton);
            freshSubmitButton.addEventListener('click', submitVotes, { once: true });
            pollOptionsContainer.classList.remove('hidden');
            return;
        }

        showMessage('Gràcies per participar! Espera instruccions.');
    }
    // --- GESTIÃ“ D\'EVENTS ---
    function handleIdeaSubmit(e) {
        e.preventDefault();
        if (ideaInput.value.trim()) {
            hostConnection.send({ type: 'new-idea', payload: ideaInput.value.trim() });
            studentState.submittedIdeas++;
            ideaInput.value = '';
            renderStudentView();
        }
    }

    function handleVoteCardClick(e) {
        const card = e.currentTarget;
        const id = card.dataset.id;
        const maxVotes = parseInt(activityConfig.votesPerStudent, 10);

        // Comprova si la targeta ja estÃ  seleccionada
        const index = studentState.pendingVotes.indexOf(id);
        if (index > -1) {
            // Desselecciona
            studentState.pendingVotes.splice(index, 1);
        } else if (studentState.pendingVotes.length < maxVotes) {
            // Selecciona si encara no s'ha arribat al lÃ­mit
            studentState.pendingVotes.push(id);
        }
        updateVoteCardsUI();
    }

    function updateVoteCardsUI() {
        const maxVotes = parseInt(activityConfig.votesPerStudent, 10);
        const cards = document.querySelectorAll('.vote-card');
        const limitReached = studentState.pendingVotes.length >= maxVotes;

        cards.forEach(card => {
            const id = card.dataset.id;
            const isSelected = studentState.pendingVotes.includes(id);

            card.classList.toggle('selected', isSelected);
            card.classList.toggle('disabled', limitReached && !isSelected);
        });
        votesLeftInfo.textContent = `Has seleccionat ${studentState.pendingVotes.length} de ${maxVotes}.`;
    }

    function submitVotes() {
        if (studentState.pendingVotes.length > 0) {
            hostConnection.send({ type: 'vote-batch', payload: { ids: studentState.pendingVotes } });
        }
        studentState.castVotes = studentState.pendingVotes.length;
        studentState.pendingVotes = [];
        let message = studentInteractionZone.querySelector('.student-thanks');
        if (!message) {
            message = document.createElement('p');
            message.className = 'student-thanks hidden';
            studentInteractionZone.appendChild(message);
        }
        message.textContent = 'Vots enviats! Gràcies per participar.';
        message.classList.remove('hidden');
        ideaForm.classList.add('hidden');
        pollOptionsContainer.classList.add('hidden');
    }

    function closeActivity() {
        if (confirm('Vols tancar l\'activitat per a tothom?')) {
            guestConnections.forEach(conn => conn.send({ type: 'session-closed' }));
            if (peer) peer.destroy();
            window.close();
        }
    }

    const updatePhaseDescription = (phase) => {
        if (!phaseDescription) return;
        const messages = {
            brainstorm: 'Els alumnes estan aportant idees en directe.',
            voting: 'Ã‰s moment de votar les propostes pujades per la classe.',
            closed: 'La sessió ha finalitzat. Repassa els resultats.'
        };
        phaseDescription.textContent = messages[phase] || 'Preparant la sessió en directe.';
    };

    const updateParticipantCount = () => {
        const count = guestConnections.length;
        participantCount.textContent = count;
        if (sidebarParticipants) sidebarParticipants.textContent = count;
    };

    // --- INICI DE L\'APLICACIÃ“ ---
    init();
});















