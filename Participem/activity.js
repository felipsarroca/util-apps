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
    const starsScoreContainer = document.getElementById('stars-score-container');
    const starsCategoryWrapper = document.getElementById('stars-category-wrapper');
    const submitStarsBtn = document.getElementById('submit-stars-btn');
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
    let studentState = { submittedIdeas: 0, castVotes: 0, pendingVotes: [], starScores: {}, starsSubmitted: false };
    let myRole = 'guest';
    let sessionId = null;
    let submitShortcutTarget = null;
    let submitShortcutActive = false;
    let starStateRestored = false;
    let starsEventBound = false;

    const starResponseTracker = new Map();

    const HOME_URL = 'https://felipsarroca.github.io/util-apps/Participem/index.html';

    const peerServerConfig = {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        path: '/',
        debug: 2,
        config: {
            iceTransportPolicy: 'all',
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                {
                    urls: [
                        'turn:global.relay.metered.ca:80',
                        'turn:global.relay.metered.ca:80?transport=tcp',
                        'turn:global.relay.metered.ca:443',
                        'turns:global.relay.metered.ca:443?transport=tcp'
                    ],
                    username: 'f716e7c11a7d132cdda3bc34',
                    credential: 'V7BV5QvEY7s718zv'
                }
            ]
        }
    };

    const createHostPeer = (id) => new Peer(String(id), peerServerConfig);
    const createGuestPeer = () => new Peer(peerServerConfig);

    const BASE_STARS_PANEL_WIDTH = 1260;
    const EXTRA_WIDTH_PER_CATEGORY = 195;
    const MAX_STARS_PANEL_WIDTH = 1840;

    const computeStarsPanelWidth = (categoryCount = 1) => {
        const extraCategories = Math.max(0, categoryCount - 3);
        const extraWidth = extraCategories * EXTRA_WIDTH_PER_CATEGORY;
        return Math.min(MAX_STARS_PANEL_WIDTH, BASE_STARS_PANEL_WIDTH + extraWidth);
    };

    const computeStarGap = (count) => {
        if (count >= 11) return '0.1rem';
        if (count === 10) return '0.15rem';
        if (count === 9) return '0.2rem';
        if (count >= 7) return '0.25rem';
        if (count >= 5) return '0.38rem';
        return '0.55rem';
    };

    const computeStarSize = (count) => {
        if (count >= 11) return '1.4rem';
        if (count === 10) return '1.5rem';
        if (count === 9) return '1.6rem';
        if (count >= 7) return '1.8rem';
        if (count >= 5) return '2.0rem';
        return '2.25rem';
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
        },
        remove(key) {
            try {
                window.localStorage?.removeItem(key);
            } catch (error) {
                console.warn('No es pot eliminar de localStorage:', error);
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
        if (normalized.type === 'stars') {
            const parsedMin = parseInt(normalized.minScore, 10);
            const parsedMax = parseInt(normalized.maxScore, 10);
            const minScore = Number.isFinite(parsedMin) ? Math.max(0, parsedMin) : 1;
            let maxScore = Number.isFinite(parsedMax) ? parsedMax : Math.max(minScore + 1, 5);
            if (maxScore <= minScore) {
                maxScore = minScore + 1;
            }
            normalized.minScore = minScore;
            normalized.maxScore = maxScore;
            const categories = Array.isArray(normalized.categories) ? normalized.categories : [];
            normalized.categories = categories
                .map((category = {}, index) => {
                    const name = typeof category.name === 'string' ? category.name.trim() : '';
                    const itemsSource = Array.isArray(category.items) ? category.items : [];
                    const items = itemsSource
                        .map(item => (typeof item === 'string' ? item.trim() : ''))
                        .filter(Boolean);
                    if (!items.length) return null;
                    return {
                        name: name || `Categoria ${index + 1}`,
                        items
                    };
                })
                .filter(Boolean);
        }
        return normalized;
    };

    const getVotesPerStudent = () => {
        const votes = parseInt(activityConfig?.votesPerStudent, 10);
        return Number.isFinite(votes) && votes > 0 ? votes : 1;
    };

    const voteStorageKey = () => (sessionId ? `votacio-${sessionId}-vot` : null);
    const ideaStorageKey = () => (sessionId ? `votacio-${sessionId}-idees` : null);
    const starsStorageKey = () => (sessionId ? `stars-${sessionId}-punts` : null);

    const persistStarState = () => {
        if (myRole === 'host') return;
        const key = starsStorageKey();
        if (!key) return;
        try {
            const payload = JSON.stringify({
                scores: studentState.starScores,
                submitted: studentState.starsSubmitted
            });
            safeStorage.set(key, payload);
        } catch (error) {
            console.warn('No s\'han pogut guardar les puntuacions locals:', error);
        }
    };

    const restoreStoredStarState = () => {
        if (myRole === 'host' || starStateRestored) return;
        const key = starsStorageKey();
        if (!key) {
            starStateRestored = true;
            return;
        }
        const raw = safeStorage.get(key);
        if (!raw) {
            starStateRestored = true;
            return;
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                const { scores = {}, submitted = false } = parsed;
                studentState.starScores = typeof scores === 'object' && scores ? { ...scores } : {};
                studentState.starsSubmitted = Boolean(submitted);
            }
        } catch (error) {
            console.warn('No s\'han pogut restaurar les puntuacions locals:', error);
            studentState.starScores = {};
            studentState.starsSubmitted = false;
        }
        starStateRestored = true;
    };

    const clearStoredStarState = () => {
        if (myRole === 'host') return;
        const key = starsStorageKey();
        if (!key) return;
        safeStorage.remove(key);
    };

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

    const getStudentThanksElement = () => {
        if (!studentInteractionZone) return null;
        let element = studentInteractionZone.querySelector('.student-thanks');
        if (!element) {
            element = document.createElement('p');
            element.className = 'student-thanks hidden';
            studentInteractionZone.appendChild(element);
        }
        return element;
    };

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
        const base = { phase: 'voting', ideas: [], votes: {}, stars: null };
        const type = activityConfig.type;
        if (type === 'brainstorm') {
            base.phase = 'brainstorm';
        } else if (type === 'brainstorm-poll') {
            base.phase = 'brainstorm';
        } else if (type === 'poll') {
            const options = Array.isArray(activityConfig.pollOptions) ? activityConfig.pollOptions : [];
            base.votes = options.reduce((acc, opt) => {
                const id = typeof opt === 'object' ? opt.id : opt;
                return { ...acc, [id]: 0 };
            }, {});
        } else if (type === 'stars') {
            const minScore = Number.isFinite(activityConfig.minScore) ? activityConfig.minScore : 1;
            const fallbackMax = Number.isFinite(activityConfig.maxScore) ? activityConfig.maxScore : Math.max(minScore + 1, 5);
            const maxScore = fallbackMax <= minScore ? minScore + 1 : fallbackMax;
            const categories = Array.isArray(activityConfig.categories) ? activityConfig.categories : [];
            base.phase = 'stars';
            base.votes = {};
            base.stars = {
                minScore,
                maxScore,
                categories: categories.map(category => {
                    const items = Array.isArray(category.items) ? category.items : [];
                    return {
                        name: category.name,
                        items: items.map(itemText => ({
                            text: itemText,
                            total: 0,
                            count: 0,
                            average: 0
                        }))
                    };
                })
            };
            if (myRole === 'host') {
                starResponseTracker.clear();
            }
        }
        return base;
    };

    const updateStudentQuestion = () => {
        if (!studentQuestion) return;
        if (activityConfig.type === 'stars' || sessionData?.phase === 'stars' || activityConfig.type === 'brainstorm' || activityConfig.type === 'poll' || activityConfig.type === 'brainstorm-poll') {
            studentQuestion.classList.add('hidden');
            return;
        }
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
        if (submitStarsBtn && !starsEventBound) {
            addPressListener(submitStarsBtn, submitStarRatings);
            starsEventBound = true;
        }
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
        let dataChanged = false;
        if (data.type === 'new-idea') {
            const idea = { id: createIdeaId(), text: data.payload };
            sessionData.ideas.push(idea);
            if (sessionData.phase !== 'brainstorm') {
                sessionData.votes[idea.id] = 0;
            }
            dataChanged = true;
        } else if (data.type === 'vote-batch') {
            data.payload.ids.forEach(id => {
                sessionData.votes[id] = (sessionData.votes[id] || 0) + 1;
            });
            dataChanged = true;
        } else if (data.type === 'score') {
            dataChanged = applyStarScore(conn, data.payload) || dataChanged;
        }
        if (dataChanged) {
            broadcastUpdate();
            renderTeacherResults();
        }
    }

    function startVotingPhase() {
        if (activityConfig.type !== 'brainstorm-poll') return;
        sessionData.phase = 'voting';
        sessionData.votes = sessionData.ideas.reduce((acc, idea) => ({ ...acc, [idea.id]: 0 }), {});
        startVotingBtn.classList.add('hidden');
        broadcastUpdate();
        renderTeacherResults();
    }

    function applyStarScore(conn, payload = {}) {
        if (!sessionData.stars) return false;
        const { categoryIndex, itemIndex, value } = payload;
        const categoryIdx = parseInt(categoryIndex, 10);
        const itemIdx = parseInt(itemIndex, 10);
        const rawScore = parseInt(value, 10);
        if (!Number.isFinite(categoryIdx) || !Number.isFinite(itemIdx) || !Number.isFinite(rawScore)) {
            return false;
        }

        const starsState = sessionData.stars;
        const categories = Array.isArray(starsState.categories) ? starsState.categories : [];
        const category = categories[categoryIdx];
        if (!category) return false;
        const items = Array.isArray(category.items) ? category.items : [];
        const item = items[itemIdx];
        if (!item) return false;

        const minScore = Number.isFinite(starsState.minScore) ? starsState.minScore : 1;
        const fallbackMax = Number.isFinite(starsState.maxScore) ? starsState.maxScore : Math.max(minScore + 1, 5);
        const maxScore = fallbackMax <= minScore ? minScore + 1 : fallbackMax;
        const clampedScore = Math.max(minScore, Math.min(maxScore, rawScore));

        if (!starResponseTracker.has(conn.peer)) {
            starResponseTracker.set(conn.peer, {});
        }
        const peerScores = starResponseTracker.get(conn.peer);
        const key = `${categoryIdx}:${itemIdx}`;
        const previousScore = peerScores[key];

        const safeTotal = Number.isFinite(item.total) ? item.total : 0;
        const safeCount = Number.isFinite(item.count) ? item.count : 0;
        item.total = safeTotal;
        item.count = safeCount;

        if (previousScore !== undefined) {
            item.total -= previousScore;
        } else {
            item.count += 1;
        }

        item.total += clampedScore;
        item.average = item.count > 0 ? item.total / item.count : 0;
        peerScores[key] = clampedScore;

        return true;
    }

    function broadcastUpdate() {
        const payload = { config: activityConfig, data: sessionData };
        guestConnections.forEach(conn => conn.send({ type: 'data-update', payload }));
    }

    // --- LÒGICA DE PEERJS (ALUMNE) ---
    function joinSession(sessionId) {
        peer = createGuestPeer();
        peer.on('open', () => {
            const tryConnect = (attempt = 1) => {
                statusIndicator.textContent = attempt === 1 ? 'Connectant...' : `Reconnectant (int ${attempt})...`;

                hostConnection = peer.connect(sessionId, { reliable: true });
                let opened = false;
                const timeout = setTimeout(() => {
                    if (!opened) {
                        try {
                            hostConnection.close();
                        } catch (error) {
                            // Ignora errors en tancar intents fallits
                        }
                        if (attempt < 3) {
                            tryConnect(attempt + 1);
                        } else {
                            showFatalState('No s\'ha pogut establir la connexió P2P. Revisa la xarxa o torna-ho a provar.');
                        }
                    }
                }, 10000);

                hostConnection.on('open', () => {
                    opened = true;
                    clearTimeout(timeout);
                    statusIndicator.textContent = 'Connectat';
                });

                hostConnection.on('data', handleTeacherData);
                hostConnection.on('error', () => {
                    if (!opened) return;
                    alert('S\'ha perdut la connexió amb l\'organitzador.');
                    window.location.href = HOME_URL;
                });
                hostConnection.on('close', () => {
                    if (!opened) return;
                    alert('Connexió tancada per l\'organitzador.');
                    window.location.href = HOME_URL;
                });
            };

            tryConnect();
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
                studentState = { submittedIdeas: 0, castVotes: votesAlreadyCast, pendingVotes: [], starScores: {}, starsSubmitted: false };
                starStateRestored = false;
                if (incomingConfig.type !== 'stars') {
                    clearStoredStarState();
                }
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
                } else if (sessionData.phase === 'stars') {
                    studentState.starScores = {};
                    studentState.starsSubmitted = false;
                    starStateRestored = false;
                    clearStoredStarState();
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

    const getStarBounds = () => {
        const sessionMin = parseInt(sessionData?.stars?.minScore, 10);
        const sessionMax = parseInt(sessionData?.stars?.maxScore, 10);
        const configMin = parseInt(activityConfig?.minScore, 10);
        const configMax = parseInt(activityConfig?.maxScore, 10);

        let min = Number.isFinite(sessionMin) ? sessionMin : Number.isFinite(configMin) ? configMin : 1;
        if (!Number.isFinite(min)) min = 1;
        min = Math.max(0, min);

        let max = Number.isFinite(sessionMax) ? sessionMax : Number.isFinite(configMax) ? configMax : Math.max(min + 1, 5);
        if (!Number.isFinite(max)) max = Math.max(min + 1, 5);
        if (max <= min) max = min + 1;

        return { min, max };
    };

    const enumerateStarItems = () => {
        const categories = sessionData?.stars?.categories;
        if (!Array.isArray(categories)) return [];
        const records = [];
        categories.forEach((category, categoryIndex) => {
            const items = Array.isArray(category?.items) ? category.items : [];
            items.forEach((item, itemIndex) => {
                records.push({
                    key: `${categoryIndex}:${itemIndex}`,
                    categoryIndex,
                    itemIndex,
                    category,
                    item
                });
            });
        });
        return records;
    };

    function renderStarsTeacherResults() {
        const starsState = sessionData?.stars;
        const categories = Array.isArray(starsState?.categories) ? starsState.categories : [];
        const { min, max } = getStarBounds();

        updatePhaseDescription('stars');
        updateStudentQuestion();
        togglePhaseCard(false);

        if (!categories.length) {
            statusIndicator.textContent = 'Preparant puntuacions';
            setResultsContainerMode('placeholder-state');
            resultsContainer.style.removeProperty('--stars-results-columns');
            resultsContainer.innerHTML = '<p class="placeholder">Esperant criteris de puntuació...</p>';
            return;
        }

        statusIndicator.textContent = 'Puntuació amb estrelles';
        setResultsContainerMode('stars-results');
        const resultsColumnCount = Math.max(categories.length, 1);
        resultsContainer.style.setProperty('--stars-results-columns', resultsColumnCount);
        resultsContainer.innerHTML = '';

        const fragment = document.createDocumentFragment();

        categories.forEach((category, categoryIndex) => {
            const categorySection = document.createElement('section');
            categorySection.className = 'stars-results-category';

            const heading = document.createElement('h3');
            heading.textContent = category?.name || `Categoria ${categoryIndex + 1}`;
            categorySection.appendChild(heading);

            const list = document.createElement('div');
            list.className = 'stars-results-list';

            const items = Array.isArray(category?.items) ? category.items : [];

            items.forEach(item => {
                const itemContainer = document.createElement('div');
                itemContainer.className = 'stars-results-item';

                const metrics = document.createElement('div');
                metrics.className = 'stars-results-metrics';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'stars-results-name';
                nameSpan.textContent = item?.text || 'Element';

                const statsSpan = document.createElement('span');
                statsSpan.className = 'stars-results-stats';
                const count = Number.isFinite(item?.count) ? item.count : 0;
                const average = Number.isFinite(item?.average) ? item.average : 0;
                const averageText = (count > 0 ? average : 0).toFixed(1).replace('.', ',');
                const votesLabel = count === 1 ? '1 vot' : `${count} vots`;
                statsSpan.textContent = `${averageText} (${votesLabel})`;

                metrics.appendChild(nameSpan);
                metrics.appendChild(statsSpan);
                itemContainer.appendChild(metrics);

                const bar = document.createElement('div');
                bar.className = 'stars-results-bar';

                const fill = document.createElement('div');
                fill.className = 'stars-results-bar-fill';
                const denominator = max > 0 ? max : 1;
                const percentage = count > 0
                    ? Math.min(100, Math.max(0, (average / denominator) * 100))
                    : 0;
                fill.style.width = `${percentage}%`;
                fill.setAttribute('aria-valuenow', average.toFixed(2));
                fill.setAttribute('aria-valuemin', String(min));
                fill.setAttribute('aria-valuemax', String(max));

                bar.appendChild(fill);
                itemContainer.appendChild(bar);

                list.appendChild(itemContainer);
            });

            categorySection.appendChild(list);
            fragment.appendChild(categorySection);
        });

        resultsContainer.appendChild(fragment);
    }

    function updateStarsSubmitButton() {
        if (!submitStarsBtn || !starsScoreContainer) return;
        const submitted = studentState.starsSubmitted;
        submitStarsBtn.classList.toggle('hidden', submitted);
        starsScoreContainer.classList.toggle('ratings-submitted', submitted);
    }

    function updateStarsThanksMessage() {
        const message = getStudentThanksElement();
        if (!message) return;
        if (studentState.starsSubmitted) {
            message.textContent = 'Puntuacions enviades! Gràcies per participar.';
            message.classList.remove('hidden');
        } else {
            message.classList.add('hidden');
        }
    }

    function applyStarSelection(categoryIndex, itemIndex, value) {
        if (!starsScoreContainer) return;
        const selector = `.star-button[data-category-index="${categoryIndex}"][data-item-index="${itemIndex}"]`;
        const buttons = starsScoreContainer.querySelectorAll(selector);
        buttons.forEach(button => {
            const buttonValue = parseInt(button.dataset.value, 10);
            const isActive = Number.isFinite(buttonValue) && buttonValue <= value;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    function handleStarSelection(categoryIndex, itemIndex, value) {
        if (studentState.starsSubmitted) return;
        const key = `${categoryIndex}:${itemIndex}`;
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return;
        studentState.starScores[key] = numericValue;
        applyStarSelection(categoryIndex, itemIndex, numericValue);
        persistStarState();
        updateStarsSubmitButton();
    }

    function renderStarsStudentView() {
        if (!starsScoreContainer || !starsCategoryWrapper) return;
        const starsState = sessionData?.stars;
        const categories = Array.isArray(starsState?.categories) ? starsState.categories : [];
        const { min, max } = getStarBounds();

        updatePhaseDescription('stars');
        updateStudentQuestion();

        ideaForm.classList.add('hidden');
        pollOptionsContainer.classList.add('hidden');

        if (!categories.length) {
            starsCategoryWrapper.style.removeProperty('grid-template-columns');
            starsCategoryWrapper.innerHTML = '<p class="placeholder">Encara no hi ha elements per puntuar.</p>';
            starsScoreContainer.classList.remove('ratings-submitted');
            starsScoreContainer.classList.remove('hidden');
            submitStarsBtn?.classList.add('hidden');
            updateStarsThanksMessage();
            starsScoreContainer.style.removeProperty('--stars-panel-max-width');
            studentInteractionZone?.style.removeProperty('--student-panel-max-width');
            return;
        }

        if (!starStateRestored) {
            restoreStoredStarState();
        }

        if (statusIndicator) {
            statusIndicator.textContent = studentState.starsSubmitted ? 'Puntuacions enviades' : 'Puntua amb estrelles';
        }

        const starCount = Math.max(1, max - min + 1);
        const starGap = computeStarGap(starCount);
        const starSize = computeStarSize(starCount);
        const panelWidth = computeStarsPanelWidth(categories.length);
        starsScoreContainer.style.setProperty('--stars-panel-max-width', `${panelWidth}px`);
        studentInteractionZone?.style.setProperty('--student-panel-max-width', `${panelWidth}px`);

        const categoryCount = categories.length;
        if (categoryCount > 0) {
            starsCategoryWrapper.style.gridTemplateColumns = `repeat(${categoryCount}, 1fr)`;
        } else {
            starsCategoryWrapper.style.removeProperty('grid-template-columns');
        }

        const validKeys = new Set();
        categories.forEach((category, categoryIndex) => {
            const items = Array.isArray(category?.items) ? category.items : [];
            items.forEach((_, itemIndex) => validKeys.add(`${categoryIndex}:${itemIndex}`));
        });
        Object.keys(studentState.starScores).forEach(key => {
            if (!validKeys.has(key)) {
                delete studentState.starScores[key];
            }
        });

        starsCategoryWrapper.innerHTML = '';

        categories.forEach((category, categoryIndex) => {
            const block = document.createElement('section');
            block.className = 'star-category-block';
            const categoryLabel = typeof category?.name === 'string' ? category.name.trim() : '';
            if (categoryLabel) {
                block.setAttribute('aria-label', categoryLabel);
                block.dataset.categoryName = categoryLabel;
            } else {
                block.removeAttribute('aria-label');
                block.removeAttribute('data-category-name');
            }

            // --- ADD CATEGORY TITLE HERE ---
            if (categoryLabel) {
                const categoryTitle = document.createElement('h4'); // Using h4 for semantic hierarchy
                categoryTitle.className = 'star-category-title-student'; // New class for styling
                categoryTitle.textContent = categoryLabel;
                block.prepend(categoryTitle); // Add at the beginning of the block
            }
            // --- END ADDITION ---

            const items = Array.isArray(category?.items) ? category.items : [];
            items.forEach((item, itemIndex) => {
                const itemWrapper = document.createElement('div');
                itemWrapper.className = 'star-rating-item';

                const topline = document.createElement('div');
                topline.className = 'star-rating-topline';

                const label = document.createElement('span');
                label.className = 'star-rating-label';
                label.textContent = item?.text || `Ítem ${itemIndex + 1}`;

                const hint = document.createElement('span');
                hint.className = 'star-rating-hint';
                hint.textContent = `${min}-${max}`;

                topline.appendChild(label);
                topline.appendChild(hint);
                itemWrapper.appendChild(topline);

                const buttonsContainer = document.createElement('div');
                buttonsContainer.className = 'star-buttons';
                buttonsContainer.style.setProperty('--star-gap', starGap);
                buttonsContainer.style.setProperty('--star-size', starSize);

                const key = `${categoryIndex}:${itemIndex}`;
                const currentValue = studentState.starScores[key];

                for (let score = min; score <= max; score++) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'star-button';
                    button.dataset.categoryIndex = String(categoryIndex);
                    button.dataset.itemIndex = String(itemIndex);
                    button.dataset.value = String(score);
                    const labelText = `${score} estrella${score !== 1 ? 's' : ''}`;
                    button.setAttribute('aria-label', labelText);
                    button.setAttribute('aria-pressed', currentValue >= score ? 'true' : 'false');
                    if (Number.isFinite(currentValue) && currentValue >= score) {
                        button.classList.add('active');
                    }
                    addPressListener(button, () => handleStarSelection(categoryIndex, itemIndex, score));
                    buttonsContainer.appendChild(button);
                }

                itemWrapper.appendChild(buttonsContainer);
                block.appendChild(itemWrapper);
            });

            starsCategoryWrapper.appendChild(block);
        });

        starsScoreContainer.classList.toggle('ratings-submitted', studentState.starsSubmitted);
        starsScoreContainer.classList.remove('hidden');

        updateStarsSubmitButton();
        updateStarsThanksMessage();
        persistStarState();
    }

    function submitStarRatings() {
        if (studentState.starsSubmitted || !hostConnection) return;

        const items = enumerateStarItems();
        if (!items.length) return;

        items.forEach(({ categoryIndex, itemIndex, key }) => {
            const value = Number(studentState.starScores[key]);
            if (!Number.isFinite(value)) return;
            hostConnection.send({ type: 'score', payload: { categoryIndex, itemIndex, value } });
        });

        studentState.starsSubmitted = true;
        persistStarState();
        updateStarsSubmitButton();
        updateStarsThanksMessage();
    }

    // --- RENDERITZAT (VISTES) ---
    function renderTeacherResults() {
        const { type } = activityConfig;
        const { phase, ideas, votes } = sessionData;

        if (type !== 'stars') {
            resultsContainer?.style.removeProperty('--stars-results-columns');
        }

        if (type === 'stars') {
            renderStarsTeacherResults();
            return;
        }

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
        if (starsCategoryWrapper) {
            starsCategoryWrapper.style.gridTemplateColumns = '';
        }
        ideaForm.classList.add('hidden');
        pollOptionsContainer.classList.add('hidden');
        if (starsScoreContainer) {
            starsScoreContainer.classList.add('hidden');
        }
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

        if (type === 'stars') {
            renderStarsStudentView();
            return;
        }

        updatePhaseDescription(phase);
        updateStudentQuestion();

        const message = getStudentThanksElement();
        const showMessage = (text) => {
            if (!message) return;
            message.textContent = text;
            message.classList.remove('hidden');
        };
        if (message) message.classList.add('hidden');

        if (phase === 'brainstorm') {
            if (studentState.submittedIdeas < maxIdeasAllowed) {
                const remainingIdeas = maxIdeasAllowed - studentState.submittedIdeas;
                if (remainingIdeas === 1) {
                    ideasLeftInfo.textContent = `Pots enviar 1 idea.`;
                } else {
                    ideasLeftInfo.textContent = `Pots enviar ${remainingIdeas} idees.`;
                }
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
            stars: "L'alumnat està puntuant amb estrelles.",
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
















