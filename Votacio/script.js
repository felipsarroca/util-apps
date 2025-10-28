document.addEventListener('DOMContentLoaded', () => {
    // --- Elements del DOM ---
    const screens = { home: document.getElementById('home-screen'), teacher: document.getElementById('teacher-screen'), student: document.getElementById('student-screen') };
    const teacherViews = { choice: document.getElementById('activity-choice'), config: document.getElementById('config-forms'), live: document.getElementById('live-activity-screen') };
    const studentViews = { brainstorm: document.getElementById('student-brainstorm-view'), poll: document.getElementById('student-poll-view'), waiting: document.getElementById('student-waiting-view') };

    const homeScreenActivityCards = document.querySelectorAll('.activity-card');
    const studentJoinForm = document.getElementById('student-join-form');
    const backToHomeFromConfig = document.getElementById('back-to-choice'); // Reutilitzat per tornar a home
    const teacherBackToHomeBtn = document.getElementById('teacher-back-to-home');
    const configForm = document.getElementById('config-form');
    const ideaForm = document.getElementById('idea-form');
    const startVotingBtn = document.getElementById('start-voting-btn');
    const closeActivityBtn = document.getElementById('close-activity-btn');

    // --- Estat de l'aplicació ---
    const initialState = () => ({ peer: null, hostConnection: null, guestConnections: [], activityConfig: {}, sessionData: {}, studentState: { submittedIdeas: 0, castVotes: 0 } });
    let { peer, hostConnection, guestConnections, activityConfig, sessionData, studentState } = initialState();

    // --- Navegació ---
    const showScreen = name => {
        Object.values(screens).forEach(s => s.classList.add('hidden'));
        screens[name]?.classList.remove('hidden');
    };
    const showTeacherView = name => {
        Object.values(teacherViews).forEach(v => v.classList.add('hidden'));
        teacherViews[name]?.classList.remove('hidden');
    };
    const showStudentView = name => {
        Object.values(studentViews).forEach(v => v.classList.add('hidden'));
        studentViews[name]?.classList.remove('hidden');
    };

    // --- FLUX PRINCIPAL ---
    homeScreenActivityCards.forEach(card => {
        card.addEventListener('click', () => {
            const activityType = card.dataset.activity;
            setupConfigForm(activityType);
            showScreen('teacher');
            showTeacherView('config');
        });
    });

    teacherBackToHomeBtn.addEventListener('click', () => showScreen('home'));
    backToHomeFromConfig.addEventListener('click', () => showScreen('home')); // El botó de tornar del config ara va a home
    startVotingBtn.addEventListener('click', () => startVotingPhase());
    closeActivityBtn.addEventListener('click', () => closeActivity());

    // --- FLUX DEL PROFESSOR ---
    function setupConfigForm(type) {
        activityConfig.type = type;
        teacherViews.choice.classList.add('hidden'); // Amaga la vista de selecció antiga
        const fieldsContainer = document.getElementById('config-fields');
        document.getElementById('config-title').textContent = `Configuració: ${type.replace('-', ' + ')}`;
        let html = '<label for="question">Tema o pregunta:</label><input type="text" id="question" name="question" required>';
        if (type.includes('brainstorm')) html += '<label for="ideas-per-student">Aportacions per alumne:</label><input type="number" id="ideas-per-student" name="ideasPerStudent" value="1" min="1">';
        if (type.includes('poll')) {
            if (type === 'poll') html += '<label for="poll-options">Opcions (una per línia):</label><textarea id="poll-options" name="pollOptions" rows="5" required></textarea>';
            html += '<label for="votes-per-student">Vots per alumne:</label><input type="number" id="votes-per-student" name="votesPerStudent" value="1" min="1">';
        }
        fieldsContainer.innerHTML = html;
    }

    configForm.addEventListener('submit', e => {
        e.preventDefault();
        const formData = new FormData(configForm);
        activityConfig = { type: activityConfig.type, ...Object.fromEntries(formData.entries()) };
        activityConfig.pollOptions = activityConfig.pollOptions?.split('\n').filter(opt => opt.trim() !== '') || [];
        hostSession();
    });

    function hostSession() {
        peer = new Peer(Math.random().toString(36).substring(2, 8).toUpperCase());
        peer.on('open', id => {
            sessionData = { phase: activityConfig.type.includes('brainstorm') ? 'brainstorm' : 'voting', ideas: [], votes: activityConfig.type === 'poll' ? activityConfig.pollOptions.reduce((acc, opt) => ({...acc, [opt]: 0}), {}) : {} };
            document.getElementById('live-activity-title').textContent = activityConfig.question;
            document.getElementById('session-code-display').textContent = id;
            if (activityConfig.type === 'brainstorm-poll') startVotingBtn.classList.remove('hidden');
            showTeacherView('live');
            renderTeacherResults();
        });
        peer.on('connection', handleNewConnection);
    }

    function handleNewConnection(conn) {
        guestConnections.push(conn);
        updateParticipantCount();
        conn.on('open', () => conn.send({ type: 'session-data', payload: { config: activityConfig, data: sessionData } }));
        conn.on('data', data => handleStudentData(conn, data));
        conn.on('close', () => { guestConnections = guestConnections.filter(c => c.peer !== conn.peer); updateParticipantCount(); });
    }

    function handleStudentData(conn, data) {
        if (data.type === 'new-idea') sessionData.ideas.push({ id: `idea-${Date.now()}`.slice(-6), text: data.payload, author: conn.peer });
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

    function closeActivity() {
        guestConnections.forEach(conn => conn.send({ type: 'session-closed' }));
        setTimeout(() => {
            guestConnections.forEach(conn => conn.close());
            if (peer) peer.destroy();
            Object.assign(this, initialState()); // Reinicia l'estat
            showScreen('home');
        }, 100);
    }

    function broadcastUpdate() {
        guestConnections.forEach(conn => conn.send({ type: 'data-update', payload: sessionData }));
    }

    function renderTeacherResults() {
        const container = document.getElementById('live-results');
        const { type } = activityConfig;
        const { phase, ideas, votes } = sessionData;
        container.innerHTML = '';

        if (phase === 'brainstorm' && ideas.length === 0) container.innerHTML = '<p class="placeholder-text">Esperant idees dels alumnes...</p>';
        else if (phase === 'brainstorm') ideas.forEach(idea => container.innerHTML += `<div class="idea-card">${idea.text}</div>`);
        else if (phase === 'voting') {
            const items = type === 'poll' ? activityConfig.pollOptions : ideas;
            if (items.length === 0) { container.innerHTML = '<p class="placeholder-text">No hi ha opcions per votar.</p>'; return; }
            const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
            items.sort((a, b) => (votes[b.id] || 0) - (votes[a.id] || 0)).forEach(item => {
                const id = typeof item === 'object' ? item.id : item;
                const text = typeof item === 'object' ? item.text : item;
                const currentVotes = votes[id] || 0;
                const percentage = totalVotes > 0 ? (currentVotes / totalVotes) * 100 : 0;
                container.innerHTML += `<div class="poll-result-bar"><div class="poll-option-label">${text} (${currentVotes})</div><div class="poll-bar" style="width: ${percentage}%"></div></div>`;
            });
        }
    }

    const updateParticipantCount = () => document.getElementById('participant-count').textContent = guestConnections.length;

    // --- FLUX DE L'ALUMNE ---
    studentJoinForm.addEventListener('submit', e => {
        e.preventDefault();
        const code = document.getElementById('session-code-input').value.trim().toUpperCase();
        if (code) joinSession(code);
    });

    function joinSession(sessionId) {
        peer = new Peer();
        peer.on('open', () => {
            hostConnection = peer.connect(sessionId, { reliable: true });
            hostConnection.on('open', () => { showScreen('student'); document.getElementById('student-message').textContent = 'Connectat! Esperant dades...'; });
            hostConnection.on('data', handleTeacherData);
            hostConnection.on('close', () => leaveSession('La connexió s\'ha perdut.'));
            hostConnection.on('error', () => leaveSession('No s\'ha pogut connectar a la sessió.'));
        });
    }

    function handleTeacherData(data) {
        if (data.type === 'session-data' || data.type === 'data-update') {
            if (data.payload.config) activityConfig = data.payload.config;
            sessionData = data.payload.data || data.payload;
            document.getElementById('student-activity-title').textContent = activityConfig.question;
            renderStudentActivity();
        } else if (data.type === 'session-closed') {
            leaveSession('La sessió ha estat tancada pel professor.');
        }
    }

    function leaveSession(message) {
        document.getElementById('student-message').textContent = message;
        showStudentView('waiting');
        if (hostConnection) hostConnection.close();
        if (peer) peer.destroy();
        Object.assign(this, initialState());
        setTimeout(() => { showScreen('home'); document.getElementById('student-join-form').reset(); }, 2000);
    }

    function renderStudentActivity() {
        const { type, ideasPerStudent, votesPerStudent } = activityConfig;
        const { phase, ideas } = sessionData;

        if (phase === 'brainstorm' && studentState.submittedIdeas < ideasPerStudent) {
            const ideasLeft = ideasPerStudent - studentState.submittedIdeas;
            document.getElementById('ideas-left-info').textContent = `Pots enviar ${ideasLeft} idea${ideasLeft !== 1 ? 's' : ''}.`;
            showStudentView('brainstorm');
        } else if (phase === 'voting' && studentState.castVotes < votesPerStudent) {
            const votesLeft = votesPerStudent - studentState.castVotes;
            document.getElementById('votes-left-info').textContent = `Pots emetre ${votesLeft} vot${votesLeft !== 1 ? 's' : ''}.`;
            const container = document.getElementById('poll-options-container');
            container.innerHTML = '';
            const options = type === 'poll' ? activityConfig.pollOptions : ideas;
            options.forEach(option => {
                const id = typeof option === 'object' ? option.id : option;
                const text = typeof option === 'object' ? option.text : option;
                const btn = document.createElement('button');
                btn.textContent = text; btn.dataset.id = id;
                btn.onclick = () => castVote(id, btn);
                container.appendChild(btn);
            });
            showStudentView('poll');
        } else {
            document.getElementById('student-message').textContent = 'Gràcies per participar! Espera instruccions del professor.';
            showStudentView('waiting');
        }
    }

    ideaForm.addEventListener('submit', e => {
        e.preventDefault();
        const ideaInput = document.getElementById('idea-input');
        if (ideaInput.value.trim()) {
            hostConnection.send({ type: 'new-idea', payload: ideaInput.value.trim() });
            studentState.submittedIdeas++;
            ideaInput.value = '';
            renderStudentActivity();
        }
    });

    function castVote(id, button) {
        hostConnection.send({ type: 'vote', payload: { id } });
        studentState.castVotes++;
        button.classList.add('voted');
        button.disabled = true;
        if (studentState.castVotes >= activityConfig.votesPerStudent) {
            document.querySelectorAll('#poll-options-container button').forEach(btn => btn.disabled = true);
            renderStudentActivity();
        }
    }
});
