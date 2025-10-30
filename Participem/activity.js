document.addEventListener('DOMContentLoaded', () => {
    const addPressListener = (element, handler, options = {}) => {
        if (!element) return;

        if (window.PointerEvent) {
            const pointerHandler = (event) => {
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                if (event.isPrimary === false) return;
                handler.call(element, event);
            };
            element.addEventListener('pointerup', pointerHandler, options);
            return;
        }

        let touchTriggered = false;
        const clickHandler = (event) => {
            if (touchTriggered) {
                touchTriggered = false;
                return;
            }
            handler.call(element, event);
        };
        const touchHandler = (event) => {
            touchTriggered = true;
            event.preventDefault();
            handler.call(element, event);
        };

        element.addEventListener('click', clickHandler, options);
        const touchOptions = { passive: false };
        if (options.capture) touchOptions.capture = true;
        if (options.once) touchOptions.once = true;
        element.addEventListener('touchend', touchHandler, touchOptions);
    };

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
    const phaseCard = document.getElementById('phase-card');
    const phaseDescription = document.getElementById('phase-description');
    const studentQuestion = document.getElementById('student-question');

    // --- Estat de l\'aplicació ---
    let peer = null;
    let hostConnection = null;
    let guestConnections = [];
    let activityConfig = {};
    let sessionData = {};
    let studentState = { submittedIdeas: 0, castVotes: 0, pendingVotes: [] };
    let myRole = 'guest';
    let sessionId = null;
    let submitShortcutTarget = null;
    let submitShortcutActive = false;

    const getGlobalPeerOptions = () => {
        const base = window.peerCommonOptions || window.peerBaseOptions;
        if (!base || typeof base !== 'object') return null;
        const cloned = { ...base };
        if (base.config) cloned.config = { ...base.config };
        return Object.keys(cloned).length ? cloned : null;
    };

    const createHostPeer = (id) => {
        const options = getGlobalPeerOptions();
        return options ? new Peer(String(id), options) : new Peer(String(id));
    };

    const createGuestPeer = () => {
        const options = getGlobalPeerOptions();
        return options ? new Peer(options) : new Peer();
    };

    const removeIdea = (ideaId) => {
        if (myRole !== 'host') return;
        const index = sessionData?.ideas?.findIndex(idea => idea.id === ideaId);
        if (index === undefined || index === -1) return;
        sessionData.ideas.splice(index, 1);
        if (sessionData.votes) {
            delete sessionData.votes[ideaId];
        }
        broadcastUpdate();
        renderTeacherResults();
    };

    const safeStorage = {
        get(key) {
            try {
                return window.localStorage?.getItem(key) ?? null;
            } catch (error) {
                console.warn('No es pot accedir a localStorage:', error);
                return null;
            }
        },
        set(key, value) {
            try {
                window.localStorage?.setItem(key, value);
            } catch (error) {
                console.warn('No es pot escriure a localStorage:', error);
            }
        }
    };

    const normalizeActivityConfig = (config = {}) => {
        const normalized = { ...config };
        if (normalized.ideasPerStudent !== undefined) {
            const parsedIdeas = parseInt(normalized.ideasPerStudent, 10);
            normalized.ideasPerStudent = Number.isFinite(parsedIdeas) && parsedIdeas > 0 ? parsedIdeas : 1;
        }
        const votesValue = normalized.votesPerStudent ?? normalized.votesPerPerson;
        if (votesValue !== undefined) {
            const parsedVotes = parseInt(votesValue, 10);
            normalized.votesPerStudent = Number.isFinite(parsedVotes) && parsedVotes > 0 ? parsedVotes : 1;
        } else {
            normalized.votesPerStudent = 1;
        }
        return normalized;
    };

    const getVotesPerStudent = () => {
        const votes = parseInt(activityConfig?.votesPerStudent, 10);
        return Number.isFinite(votes) && votes > 0 ? votes : 1;
    };

    const voteStorageKey = () => (sessionId ? `votacio-${sessionId}-vot` : null);
    const ideaStorageKey = () => (sessionId ? `votacio-${sessionId}-idees` : null);

    const setSubmitShortcutTarget = (target) => {
        submitShortcutTarget = target;
    };

    const refreshSubmitShortcutState = () => {
        submitShortcutActive = Boolean(
            sessionData?.phase === 'voting' &&
            submitShortcutTarget &&
            studentState.pendingVotes.length > 0 &&
            studentState.castVotes === 0
        );
    };

    const handleSubmitShortcut = (event) => {
        if (event.key === 'Enter' && !event.repeat && submitShortcutActive && submitShortcutTarget && !submitShortcutTarget.classList.contains('hidden')) {
            event.preventDefault();
            submitShortcutTarget.click();
        }
    };
    document.addEventListener('keydown', handleSubmitShortcut);

    const createIdeaId = () => {
        if (window.crypto?.randomUUID) return `idea-${window.crypto.randomUUID().slice(-8)}`;
        return `idea-${Math.random().toString(36).slice(2, 10)}`;
    };

    const setResultsContainerMode = (modeClass = '') => {
        const classes = ['live-feed'];
        if (modeClass) classes.push(modeClass);
        resultsContainer.className = classes.join(' ');
        resultsContainer.classList.remove('poll-grid-double');
        resultsContainer.classList.remove('idea-bubble-double', 'idea-bubble-compact', 'idea-bubble-compact-tight');
    };

    const togglePhaseCard = (visible = true) => {
        if (!phaseCard) return;
        phaseCard.classList.toggle('hidden', !visible);
    };

    const restoreStoredVoteState = () => {
        if (myRole === 'host') return;
        const key = voteStorageKey();
        if (!key) return;
        const stored = parseInt(safeStorage.get(key) || '0', 10);
        if (!Number.isNaN(stored) && stored > 0) {
            studentState.castVotes = stored;
        }
        refreshSubmitShortcutState();
    };

    const persistVoteState = () => {
        if (myRole === 'host') return;
        const key = voteStorageKey();
        if (!key) return;
        safeStorage.set(key, String(studentState.castVotes));
    };

    const restoreStoredIdeaCount = () => {
        if (myRole === 'host') return;
        const key = ideaStorageKey();
        if (!key) return;
        const stored = parseInt(safeStorage.get(key) || '0', 10);
        if (Number.isNaN(stored) || stored <= 0) return;
        const rawLimit = parseInt(activityConfig?.ideasPerStudent, 10);
        if (!Number.isNaN(rawLimit) && rawLimit > 0) {
            const limit = rawLimit;
            studentState.submittedIdeas = Math.min(stored, limit);
            if (studentState.submittedIdeas !== stored) persistIdeaCount();
        } else {
            studentState.submittedIdeas = stored;
        }
    };

    const persistIdeaCount = () => {
        if (myRole === 'host') return;
        const key = ideaStorageKey();
        if (!key) return;
        safeStorage.set(key, String(studentState.submittedIdeas));
    };

    const buildInitialSessionState = () => {
        const base = { phase: 'voting', ideas: [], votes: {} };
        if (activityConfig.type === 'brainstorm') {
            base.phase = 'brainstorm';
        } else if (activityConfig.type === 'brainstorm-poll') {
            base.phase = 'brainstorm';
        } else if (activityConfig.type === 'poll') {
            const options = Array.isArray(activityConfig.pollOptions) ? activityConfig.pollOptions : [];
            base.votes = options.reduce((acc, opt) => {
                const id = typeof opt === 'object' ? opt.id : opt;
                return { ...acc, [id]: 0 };
            }, {});
        }
        return base;
    };

    const updateStudentQuestion = () => {
        if (!studentQuestion) return;
        const hasQuestion = Boolean(activityConfig.question);
        studentQuestion.textContent = hasQuestion ? activityConfig.question : '';
        studentQuestion.classList.toggle('hidden', !hasQuestion);
    };

    const showFatalState = (message) => {
        activityTitle.textContent = 'Sessió no disponible';
        if (statusIndicator) statusIndicator.textContent = 'Error';
        setResultsContainerMode('placeholder-state');
        if (resultsContainer) {
            resultsContainer.innerHTML = `<p class="placeholder">${message}</p>`;
        }
        activityControls?.classList.add('hidden');
        studentInteractionZone?.classList.add('hidden');
    };

    // --- INICIALITZACIÓ ---
    function init() {
        const params = new URLSearchParams(window.location.search);
        sessionId = params.get('session');
        myRole = params.get('mode');

        setResultsContainerMode('placeholder-state');
        resultsContainer.innerHTML = '<p class="placeholder">Preparant la sessió...</p>';
        updatePhaseDescription('waiting');

        if (!sessionId) {
            showFatalState('No s\'ha indicat cap codi de sessió. Torna a generar l\'activitat.');
            return;
        }

        restoreStoredVoteState();
        restoreStoredIdeaCount();
        if (sessionCodeDisplay) sessionCodeDisplay.textContent = sessionId;
        if (sessionCodeLarge) sessionCodeLarge.textContent = sessionId;
        if (closeActivityBtn) addPressListener(closeActivityBtn, closeActivity);
        addPressListener(startVotingBtn, startVotingPhase);
        togglePhaseCard(false);

        if (myRole === 'host') {
            const rawConfig = params.get('config');
            if (!rawConfig) {
                showFatalState('No s\'ha trobat la configuració de l\'activitat. Torna a generar-la.');
                return;
            }
            try {
                activityConfig = JSON.parse(decodeURIComponent(rawConfig));
            } catch (error) {
                console.error('Error analitzant la configuració:', error);
                showFatalState('Error carregant la configuració. Torna a iniciar l\'activitat.');
                return;
            }
            if (!activityConfig || typeof activityConfig !== 'object') {
                showFatalState('La configuració rebuda és buida.');
                return;
            }
            activityConfig = normalizeActivityConfig(activityConfig);
            activityTitle.textContent = activityConfig.question || 'Activitat en directe';
            activityControls.classList.remove('hidden');
            if (closeActivityBtn) closeActivityBtn.classList.remove('hidden');
            document.body.classList.remove('guest-mode');
            sessionData = buildInitialSessionState();
            if (activityConfig.type === 'brainstorm-poll') startVotingBtn.classList.remove('hidden');
            updateStudentQuestion();
            renderTeacherResults();
            hostSession(sessionId);
            updateParticipantCount();
        } else {
            document.body.classList.add('guest-mode');
            if (closeActivityBtn) closeActivityBtn.classList.add('hidden');
            ideaForm.addEventListener('submit', handleIdeaSubmit);
            joinSession(sessionId);
        }
    }

    // --- LÒGICA DE PEERJS (PROFESSOR) ---
    function hostSession(sessionId) {
        peer = createHostPeer(sessionId);
        peer.on('open', id => {
            statusIndicator.textContent = 'Connectat';
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
        if (data.type === 'new-idea') {
            const idea = { id: createIdeaId(), text: data.payload };
            sessionData.ideas.push(idea);
            if (sessionData.phase !== 'brainstorm') {
                sessionData.votes[idea.id] = 0;
            }
        } else if (data.type === 'vote-batch') {
            data.payload.ids.forEach(id => {
                sessionData.votes[id] = (sessionData.votes[id] || 0) + 1;
            });
        }
        broadcastUpdate();
        renderTeacherResults();
    }

    function startVotingPhase() {
        sessionData.phase = 'voting';
        sessionData.votes = sessionData.ideas.reduce((acc, idea) => ({ ...acc, [idea.id]: 0 }), {});
        startVotingBtn.classList.add('hidden');
        broadcastUpdate();
        renderTeacherResults();
    }

    function broadcastUpdate() {
        const payload = { config: activityConfig, data: sessionData };
        guestConnections.forEach(conn => conn.send({ type: 'data-update', payload }));
    }

    // --- LÒGICA DE PEERJS (ALUMNE) ---
    function joinSession(sessionId) {
        peer = createGuestPeer();
        peer.on('open', () => {
            hostConnection = peer.connect(sessionId, { reliable: true });
            hostConnection.on('open', () => statusIndicator.textContent = 'Connectat');
            hostConnection.on('data', handleTeacherData);
            hostConnection.on('close', () => { alert('Connexió perduda amb el professor.'); window.close(); });
            hostConnection.on('error', () => { alert('No s\'ha pogut connectar a la sessió.'); window.close(); });
        });
        peer.on('error', (err) => {
            console.error('Error de PeerJS:', err);
            showFatalState('No s\'ha pogut connectar amb la sessió. Comprova el codi o torna-ho a provar.');
        });
    }

    function handleTeacherData(data) {
        if (data.type === 'session-data' || data.type === 'data-update') {
            const payload = data.payload || {};
            const incomingConfig = payload.config;
            const previousType = activityConfig?.type;
            const previousPhase = sessionData?.phase;
            if (incomingConfig) activityConfig = normalizeActivityConfig(incomingConfig);
            sessionData = payload.data ?? payload;

            if (incomingConfig && incomingConfig.type !== previousType) {
                const votesAlreadyCast = studentState.castVotes;
                studentState = { submittedIdeas: 0, castVotes: votesAlreadyCast, pendingVotes: [] };
                restoreStoredVoteState();
                restoreStoredIdeaCount();
                const submitBtn = document.getElementById('submit-votes-btn');
                if (submitBtn) submitBtn.classList.add('hidden');
            }

            if (previousPhase && previousPhase !== sessionData.phase) {
                if (sessionData.phase === 'brainstorm') {
                    studentState.submittedIdeas = 0;
                    studentState.pendingVotes = [];
                    persistIdeaCount();
                } else if (sessionData.phase === 'voting') {
                    studentState.pendingVotes = [];
                    restoreStoredVoteState();
                }
                refreshSubmitShortcutState();
            }

            restoreStoredIdeaCount();

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

        togglePhaseCard(false);

        if (phase === 'brainstorm') {
            statusIndicator.textContent = 'Connectat';
            setResultsContainerMode('idea-bubble-container');
            resultsContainer.classList.remove('poll-grid-double');
            resultsContainer.innerHTML = '';
            const ideaCount = ideas.length;
            if (ideaCount === 0) {
                resultsContainer.innerHTML = '<p class="placeholder">Esperant idees...</p>';
                return;
            }
            const densityClass = ideaCount >= 20
                ? 'idea-bubble-compact-tight'
                : ideaCount >= 10
                    ? 'idea-bubble-compact'
                    : '';
            if (densityClass) resultsContainer.classList.add(densityClass);
            const useDoubleColumn = ideaCount >= 14 && window.innerWidth >= 1200;
            resultsContainer.classList.toggle('idea-bubble-double', useDoubleColumn);
            const fragment = document.createDocumentFragment();
            ideas.forEach(idea => {
                const bubble = document.createElement('div');
                bubble.className = 'idea-bubble';
                bubble.dataset.id = idea.id;

                const textSpan = document.createElement('span');
                textSpan.className = 'idea-bubble-text';
                textSpan.textContent = idea.text;
                bubble.appendChild(textSpan);

                if (myRole === 'host') {
                    bubble.classList.add('idea-bubble--host');
                    const deleteBtn = document.createElement('button');
                    deleteBtn.type = 'button';
                    deleteBtn.className = 'idea-delete-btn';
                    deleteBtn.setAttribute('aria-label', 'Esborra la idea');
                    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                    addPressListener(deleteBtn, (event) => {
                        event.stopPropagation();
                        removeIdea(idea.id);
                    });
                    bubble.appendChild(deleteBtn);
                }

                fragment.appendChild(bubble);
            });
            resultsContainer.appendChild(fragment);
        } else if (phase === 'voting') {
            statusIndicator.textContent = 'Votació en directe';
            setResultsContainerMode('poll-grid compact-poll');
            const items = type === 'poll' ? activityConfig.pollOptions : ideas;
            if (items.length === 0) {
                resultsContainer.classList.remove('poll-grid-double');
                resultsContainer.innerHTML = '<p class="placeholder">No hi ha res a votar.</p>';
                return;
            }

            const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
            const sortedItems = [...items].sort((a, b) => {
                const votesA = votes[typeof a === 'object' ? a.id : a] || 0;
                const votesB = votes[typeof b === 'object' ? b.id : b] || 0;
                return votesB - votesA;
            });
            const useDoubleColumn = sortedItems.length >= 8 && window.innerWidth >= 1200;
            resultsContainer.classList.toggle('poll-grid-double', useDoubleColumn);

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
                const percentageText = percentage.toFixed(1);
                const percentageDisplay = percentageText.replace('.', ',');

                const previousRank = previousRanks[id];
                const currentRank = index + 1;
                let animationClass = '';

                if (previousRank !== undefined) {
                    if (currentRank < previousRank) animationClass = 'rank-up-animation';
                    else if (currentRank > previousRank) animationClass = 'rank-down-animation';
                }

                resultsContainer.innerHTML += `
                    <article class="poll-result-card ${animationClass}" data-item-id="${id}" data-rank="${currentRank}">
                        <div class="poll-card-top">
                            <span class="poll-card-rank">${currentRank}.</span>
                            <span class="poll-card-title">${text}</span>
                            <span class="poll-card-metrics">
                                <span class="poll-card-count" aria-label="Vots">${currentVotes}</span>
                                <span class="poll-card-percent">${percentageDisplay}%</span>
                            </span>
                        </div>
                        <div class="poll-card-progress" role="progressbar" aria-valuenow="${percentageText}" aria-valuemin="0" aria-valuemax="100">
                            <div class="poll-card-progress-bar" style="width: ${percentage}%" data-percentage="${percentageText}"></div>
                        </div>
                    </article>`;

                setTimeout(() => {
                    const element = document.querySelector('[data-item-id="' + id + '"]');
                    if (!element) return;
                    const tokens = (animationClass || '').split(/\s+/).filter(Boolean);
                    if (tokens.length) element.classList.remove(...tokens);
                }, 500);
            });
        } else {
            statusIndicator.textContent = 'Connectat';
            setResultsContainerMode('placeholder-state');
            resultsContainer.classList.remove('poll-grid-double');
            resultsContainer.innerHTML = '<p class="placeholder">Esperant actualitzacions...</p>';
        }
    }

    function renderStudentView() {
        ideaForm.classList.add('hidden');
        pollOptionsContainer.classList.add('hidden');
        setSubmitShortcutTarget(null);
        refreshSubmitShortcutState();

        const { type, ideasPerStudent } = activityConfig;
        const { phase, ideas } = sessionData;
        const voteCardsWrapper = document.getElementById('vote-cards-wrapper');
        if (voteCardsWrapper) voteCardsWrapper.classList.remove('multi-column');
        const maxIdeasAllowed = Math.max(1, parseInt(ideasPerStudent, 10) || 1);
        if (studentState.submittedIdeas > maxIdeasAllowed) {
            studentState.submittedIdeas = maxIdeasAllowed;
            persistIdeaCount();
        }

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

        if (phase === 'brainstorm') {
            if (studentState.submittedIdeas < maxIdeasAllowed) {
                ideasLeftInfo.textContent = `Pots enviar ${maxIdeasAllowed - studentState.submittedIdeas} idea(es).`;
                ideaForm.classList.remove('hidden');
                return;
            }
            ideasLeftInfo.textContent = 'Has enviat totes les idees disponibles.';
            showMessage('Ja has compartit totes les idees. Espera instruccions.');
            return;
        }

        if (phase === 'voting') {
            if (studentState.castVotes > 0) {
                showMessage('Vots enviats! Gràcies per participar.');
                return;
            }

            const wrapper = voteCardsWrapper || document.getElementById('vote-cards-wrapper');
            wrapper.innerHTML = '';
            const options = type === 'poll' ? (activityConfig.pollOptions || []) : ideas;
            if (options.length === 0) {
                wrapper.classList.remove('multi-column');
                showMessage('Encara no hi ha opcions disponibles.');
                return;
            }
            const useMultiColumn = options.length >= 6 && window.innerWidth >= 1200;
            wrapper.classList.toggle('multi-column', useMultiColumn);

            options.forEach(option => {
                const id = typeof option === 'object' ? option.id : option;
                const textValue = typeof option === 'object' ? option.text : option;
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'vote-card';
                card.dataset.id = id;
                card.textContent = textValue;
                card.setAttribute('aria-pressed', 'false');
                addPressListener(card, handleVoteCardClick);
                wrapper.appendChild(card);
            });

            updateVoteCardsUI();

            const submitButton = document.getElementById('submit-votes-btn');
            submitButton.classList.remove('hidden');
            const freshSubmitButton = submitButton.cloneNode(true);
            submitButton.replaceWith(freshSubmitButton);
            addPressListener(freshSubmitButton, submitVotes, { once: true });
            setSubmitShortcutTarget(freshSubmitButton);
            pollOptionsContainer.classList.remove('hidden');
            refreshSubmitShortcutState();
            return;
        }

        showMessage('Gràcies per participar! Espera instruccions.');
    }

    // --- GESTIÓ D\'EVENTS ---
    function handleIdeaSubmit(e) {
        e.preventDefault();
        if (ideaInput.value.trim()) {
            hostConnection.send({ type: 'new-idea', payload: ideaInput.value.trim() });
            studentState.submittedIdeas++;
            persistIdeaCount();
            ideaInput.value = '';
            renderStudentView();
        }
    }

    function handleVoteCardClick(event) {
        if (studentState.castVotes > 0) return;

        const card = event.currentTarget;
        const id = card.dataset.id;
        const votesPerStudent = getVotesPerStudent();

        const index = studentState.pendingVotes.indexOf(id);
        if (index > -1) {
            studentState.pendingVotes.splice(index, 1);
            updateVoteCardsUI();
            return;
        }

        if (studentState.pendingVotes.length >= votesPerStudent) {
            updateVoteCardsUI();
            return;
        }

        studentState.pendingVotes.push(id);
        updateVoteCardsUI();
    }


    function updateVoteCardsUI() {
        const cards = document.querySelectorAll('.vote-card');
        const votesPerStudent = getVotesPerStudent();
        const selectedCount = studentState.pendingVotes.length;

        cards.forEach(card => {
            const isSelected = studentState.pendingVotes.includes(card.dataset.id);
            card.classList.toggle('selected', isSelected);
            card.setAttribute('aria-pressed', String(isSelected));
        });

        if (votesLeftInfo) {
            let message = '';
            if (selectedCount === 0) {
                message = votesPerStudent === 1
                    ? 'Selecciona una opció per continuar.'
                    : `Pots seleccionar fins a ${votesPerStudent} opcions.`;
            } else if (selectedCount < votesPerStudent) {
                if (votesPerStudent === 1) {
                    message = 'Has seleccionat la teva opció.';
                } else {
                    const remaining = votesPerStudent - selectedCount;
                    message = remaining === 1
                        ? 'Pots seleccionar una opció més.'
                        : `Pots seleccionar ${remaining} opcions més.`;
                }
            } else {
                message = votesPerStudent === 1
                    ? 'Has seleccionat la teva opció.'
                    : 'Ja has seleccionat el màxim d\'opcions.';
            }
            votesLeftInfo.textContent = message;
        }

        refreshSubmitShortcutState();
    }


    function submitVotes() {
        if (studentState.castVotes > 0 || studentState.pendingVotes.length === 0) {
            refreshSubmitShortcutState();
            return;
        }

        if (hostConnection) {
            hostConnection.send({ type: 'vote-batch', payload: { ids: [...studentState.pendingVotes] } });
        }
        studentState.castVotes = studentState.pendingVotes.length;
        persistVoteState();
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
        const submitBtn = document.getElementById('submit-votes-btn');
        if (submitBtn) submitBtn.classList.add('hidden');
        setSubmitShortcutTarget(null);
        refreshSubmitShortcutState();
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
            voting: 'És moment de votar les propostes pujades per la classe.',
            closed: 'La sessió ha finalitzat. Repassa els resultats.'
        };
        phaseDescription.textContent = messages[phase] || 'Preparant la sessió en directe.';
    };

    const updateParticipantCount = () => {
        const count = guestConnections.length;
        if (participantCount) participantCount.textContent = count;
        if (sidebarParticipants) sidebarParticipants.textContent = count;
    };

    // --- INICI DE L\'APLICACIÓ ---
    init();
});















