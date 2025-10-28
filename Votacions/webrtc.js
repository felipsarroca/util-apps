// Sistema de connexió PeerJS per a l'aplicació de votació
let peer = null;
let conn = null;
let currentRole = null; // 'professor' o 'alumne'

// Inicialitzar PeerJS segons el rol
function initPeerJS(role) {
    currentRole = role;
    
    // Generar un ID únic per aquest client
    const clientId = 'client_' + Math.random().toString(36).substring(2, 15);
    
    // Crear connexió Peer amb un ID de client únic
    peer = new Peer(clientId, {
        // Configuració opcional per millorar la connexió
        config: {
            'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', function(id) {
        console.log('Connexió PeerJS oberta amb ID:', id);
    });

    peer.on('connection', function(connection) {
        // El professor rep connexions de part dels alumnes
        if (role === 'professor') {
            setupConnection(connection);
        }
    });

    peer.on('error', function(err) {
        console.error('Error de PeerJS:', err);
    });
}

// Establir connexió
function setupConnection(connection) {
    conn = connection;
    
    conn.on('open', function() {
        console.log('Connexió oberta amb:', connection.peer);
        
        // Enviar dades inicials si som el professor
        if (currentRole === 'professor') {
            const activityCode = getStoredItem('activityCode');
            if (activityCode) {
                const activityData = JSON.parse(getStoredItem(activityCode));
                const results = JSON.parse(getStoredItem(`${activityCode}_results`));
                
                conn.send({
                    type: 'initial-data',
                    activity: activityData,
                    results: results
                });
            }
        }
    });

    conn.on('data', function(data) {
        console.log('Dades rebudes:', data);
        
        if (currentRole === 'professor') {
            // Processar dades rebudes dels alumnes
            if (data.type === 'student-idea') {
                handleStudentIdea(data.idea, connection.peer);
            } else if (data.type === 'student-vote') {
                handleStudentVote(data.option, connection.peer);
            }
        } else if (currentRole === 'alumne') {
            // Processar dades rebudes del professor
            if (data.type === 'initial-data') {
                // Guardar dades rebudes
                const activityCode = getStoredItem('activityCode');
                if (activityCode) {
                    setStoredItem(activityCode, JSON.stringify(data.activity));
                    setStoredItem(`${activityCode}_results`, JSON.stringify(data.results));
                    
                    // Actualitzar la vista de l'alumne si cal
                    const container = document.querySelector('.participation-container');
                    if (container) {
                        const activity = data.activity;
                        updateStudentView(activity, container);
                    }
                }
            } else if (data.type === 'activity-update') {
                // Actualitzar vista quan hi hagi canvis
                const container = document.querySelector('.participation-container');
                if (container) {
                    const activity = JSON.parse(getStoredItem(getStoredItem('activityCode')));
                    updateStudentView(activity, container);
                }
            }
        }
    });

    conn.on('close', function() {
        console.log('Connexió tancada amb:', connection.peer);
        conn = null;
    });
}

// Enviar idea des de l'alumne
function sendIdeaViaPeerJS(ideaText) {
    if (conn && conn.open) {
        conn.send({
            type: 'student-idea',
            idea: ideaText
        });
    } else {
        console.warn('Connexió no disponible per enviar idea');
        // Opcional: emmagatzemar localment i enviar quan es restableixi la connexió
    }
}

// Enviar vot des de l'alumne
function sendVoteViaPeerJS(voteData) {
    if (conn && conn.open) {
        conn.send({
            type: 'student-vote',
            option: voteData.option
        });
    } else {
        console.warn('Connexió no disponible per enviar vot');
    }
}

// Iniciar connexió com a alumne
function joinAsStudent(professorId) {
    if (peer && peer.id) {
        conn = peer.connect(professorId, { reliable: true });
        setupConnection(conn);
    } else {
        // Esperar que el peer estigui obert
        peer.on('open', function() {
            conn = peer.connect(professorId, { reliable: true });
            setupConnection(conn);
        });
    }
}

// Enviar actualització d'activitat
function sendActivityUpdate(activityCode, updateData) {
    if (conn && conn.open) {
        conn.send({
            type: 'activity-update',
            activityCode: activityCode,
            update: updateData
        });
    }
}

// Processar idea de l'alumne (només pel professor)
function handleStudentIdea(idea, studentId) {
    const activityCode = getStoredItem('activityCode');
    if (activityCode) {
        const results = JSON.parse(getStoredItem(`${activityCode}_results`));
        results.ideas.push(idea);
        setStoredItem(`${activityCode}_results`, JSON.stringify(results));
        
        // Actualitzar la vista del professor
        updateDashboard(activityCode);
        
        // Enviar confirmació a l'estudiant si cal
        if (conn && conn.open) {
            conn.send({
                type: 'idea-confirmed',
                idea: idea,
                studentId: studentId
            });
        }
    }
}

// Processar vot de l'alumne (només pel professor)
function handleStudentVote(option, studentId) {
    const activityCode = getStoredItem('activityCode');
    if (activityCode) {
        const results = JSON.parse(getStoredItem(`${activityCode}_results`));
        results.votes[option] = (results.votes[option] || 0) + 1;
        setStoredItem(`${activityCode}_results`, JSON.stringify(results));
        
        // Actualitzar la vista del professor
        updateDashboard(activityCode);
        
        // Enviar confirmació a l'estudiant si cal
        if (conn && conn.open) {
            conn.send({
                type: 'vote-confirmed',
                option: option,
                studentId: studentId
            });
        }
    }
}

// Funció d'inicialització per al DOM
document.addEventListener('DOMContentLoaded', function() {
    const page = window.location.pathname;
    
    if (page.includes('professor.html')) {
        initPeerJS('professor');
    }
});