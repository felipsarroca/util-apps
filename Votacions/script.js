document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname;
    ensureUserId(); // Create a unique user ID for the browser session

    if (page.endsWith('/') || page.endsWith('index.html')) {
        initHomePage();
    } else if (page.includes('professor.html')) {
        initProfessorPage();
    } else if (page.includes('alumne.html')) {
        initAlumnePage();
    }
    
    // Iniciar PeerJS si cal
    if (page.includes('professor.html')) {
        if (typeof initPeerJS === 'function') {
            initPeerJS('professor');
        }
    } else if (page.includes('alumne.html')) {
        if (typeof initPeerJS === 'function') {
            // No inicialitzem aquí, sinó quan entrem a la sessió
        }
    }
});

// ====================================================================
// USER ID MANAGEMENT
// ====================================================================
function ensureUserId() {
    if (!getStoredItem('userId')) {
        setStoredItem('userId', 'user_' + Math.random().toString(36).substring(2, 15));
    }
}

// ====================================================================
// ALUMNE PAGE
// ====================================================================
function initAlumnePage() {
    // Comprovar si hi ha un codi a la URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlCode = urlParams.get('code');
    
    // Si hi ha codi a la URL, intentar unir-nos a la sessió
    if (urlCode) {
        joinSession(urlCode.toUpperCase());
    } else {
        // Si no hi ha codi, mostrar missatge d'error
        const container = document.querySelector('.participation-container');
        if (container) {
            container.innerHTML = '<h1>Error: No s\'ha trobat cap codi d\'activitat vàlid.</h1><a href="index.html">Torna a l\'inici</a>';
        }
    }
}

function joinSession(professorId) {
    const container = document.querySelector('.participation-container');
    
    if (container) {
        container.innerHTML = '<h1>Connectant a la sessió...</h1><p>Codi: ' + professorId + '</p>';
    }

    // Iniciar PeerJS per a l'alumne
    initPeerJS('alumne');
    
    // Unir-se a la sessió
    if (typeof joinAsStudent === 'function') {
        joinAsStudent(professorId);
    }
}

function handleStudentSubmission(e) {
    e.preventDefault();
    const activityCode = getStoredItem('activityCode');
    const activity = JSON.parse(getStoredItem(activityCode));
    const results = JSON.parse(getStoredItem(`${activityCode}_results`));
    const userId = getStoredItem('userId');

    if (e.target.id === 'idea-form') {
        const ideaText = document.getElementById('idea-text').value.trim();
        if (ideaText) {
            // Enviar idea a través de PeerJS
            if (typeof sendIdeaViaPeerJS === 'function') {
                sendIdeaViaPeerJS(ideaText);
                // Mostrar missatge temporal
                document.getElementById('idea-text').value = '';
                document.getElementById('idea-form').innerHTML = '<h2>Idea enviada! Esperant confirmació...</h2>';
            }
        }
    } else if (e.target.id === 'voting-form-alumne') {
        const selectedOptions = e.target.querySelectorAll('input[name="voting-option"]:checked');
        const maxVotes = activity.maxVotes || 1;

        if (selectedOptions.length === 0) {
            alert('Has de seleccionar almenys una opció.');
            return;
        }

        if (selectedOptions.length > maxVotes) {
            alert(`Només pots seleccionar un màxim de ${maxVotes} opcions.`);
            return;
        }

        // Enviar vots a través de PeerJS
        if (typeof sendVoteViaPeerJS === 'function') {
            selectedOptions.forEach(checkbox => {
                const value = checkbox.value;
                sendVoteViaPeerJS({ option: value });
            });
            // Mostrar missatge temporal
            e.target.parentElement.innerHTML = '<h2>Gràcies per la teva participació! Esperant confirmació...</h2>';
        }
    }
}

// ====================================================================
// HOME PAGE
// ====================================================================
function initHomePage() {
    const participateBtn = document.getElementById('participate-btn');
    const activityCodeInput = document.getElementById('activity-code');

    if (!participateBtn || !activityCodeInput) return;

    participateBtn.addEventListener('click', () => {
        const code = activityCodeInput.value.toUpperCase().trim();
        if (code) {
            // Redirigir immediatament a alumne.html amb el codi
            window.location.href = `alumne.html?code=${code}`;
        } else {
            alert('El codi de l\'activitat no és vàlid. Si us plau, torna-ho a provar.');
            activityCodeInput.focus();
        }
    });

    activityCodeInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            participateBtn.click();
        }
    });
}

// ====================================================================
// PROFESSOR PAGE
// ====================================================================
function initProfessorPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const activityType = urlParams.get('activity');
    const configContainer = document.getElementById('config-container');

    if (!activityType) {
        configContainer.innerHTML = '<h1>Error: No s\'ha seleccionat cap tipus d\'activitat.</h1><a href="index.html">Torna a l\'inici</a>';
        return;
    }

    const formToShow = document.getElementById(`${activityType}-form`);
    if (formToShow) {
        formToShow.style.display = 'block';
        const optionsDiv = document.querySelector('.options');
        if(optionsDiv) optionsDiv.style.display = 'none';
    } else {
         configContainer.innerHTML = `<h1>Error: Tipus d\'activitat invàlid.</h1><a href="index.html">Torna a l\'inici</a>`;
         return;
    }

    const form = formToShow.querySelector('form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = generateCode();
        const activity = createActivityObject(activityType, form);
        
        // Guardar localment
        setStoredItem(code, JSON.stringify(activity));
        setStoredItem(`${code}_results`, JSON.stringify({ ideas: [], votes: {} }));
        setStoredItem('activityCode', code);

        showDashboard(code, activity, configContainer);
    });
}

function createActivityObject(type, form) {
    const activity = { type, status: 'pending' };
    if (type === 'brainstorm') {
        activity.topic = form.querySelector('#brainstorm-topic').value;
        activity.maxIdeas = form.querySelector('#brainstorm-max-ideas').value;
        activity.status = 'brainstorming';
    } else if (type === 'voting') {
        activity.topic = form.querySelector('#voting-topic').value;
        activity.options = form.querySelector('#voting-options').value.split('\n').filter(o => o.trim() !== '');
        activity.maxVotes = form.querySelector('#voting-max-votes').value;
        activity.status = 'voting';
    } else if (type === 'brainstorm-voting') {
        activity.topic = form.querySelector('#bv-topic').value;
        activity.maxIdeas = form.querySelector('#bv-max-ideas').value;
        activity.maxVotes = form.querySelector('#bv-max-votes').value;
        activity.status = 'brainstorming';
    }
    return activity;
}

function showDashboard(code, activity, container) {
    // Obtindre l'ID de PeerJS del professor
    const professorPeerId = peer ? peer.id : 'esperant connexió...';
    
    let dashboardHTML = `
        <div class="dashboard">
            <div class="dashboard-header">
                <div class="dashboard-code">
                    <span>Codi de l'activitat</span>
                    <p>${code}</p>
                </div>
                <div class="dashboard-topic">
                    <span>Tema</span>
                    <p>${activity.topic}</p>
                </div>
            </div>
            <div class="peer-info">
                <span>ID de connexió:</span>
                <p class="peer-id">${professorPeerId}</p>
            </div>
            ${activity.type === 'brainstorm-voting' ? '<button id="start-voting-btn" class="button">Activar Votació</button>' : ''}
            <div id="results"></div>
        </div>`;
    container.innerHTML = dashboardHTML;

    updateDashboard(code);
    
    // Actualitzar l'ID de PeerJS quan estigui disponible
    if (peer) {
        peer.on('open', function(id) {
            const peerIdElement = document.querySelector('.peer-id');
            if (peerIdElement) {
                peerIdElement.textContent = id;
            }
        });
    }
    
    window.addEventListener('storage', (e) => {
        if (e.key === `${code}_results`) {
            updateDashboard(code);
        }
    });

    if (activity.type === 'brainstorm-voting') {
        const startVotingBtn = document.getElementById('start-voting-btn');
        startVotingBtn.addEventListener('click', () => {
            let currentActivity = JSON.parse(getStoredItem(code));
            currentActivity.status = 'voting';
            
            // Actualitzar a localStorage
            setStoredItem(code, JSON.stringify(currentActivity));
            
            // Actualitzar la vista
            updateDashboard(code);
            startVotingBtn.style.display = 'none';
            
            // Enviar actualització a alumnes si cal
            if (typeof sendActivityUpdate === 'function') {
                sendActivityUpdate(code, { status: 'voting' });
            }
        });
    }
    
    // Add event listener for when the activity status changes in localStorage
    window.addEventListener('storage', (e) => {
        if (e.key === code) {
            const updatedActivity = JSON.parse(e.newValue);
            if (updatedActivity.status !== activity.status) {
                activity = updatedActivity;
                updateDashboard(code);
                
                // Enviar actualització a alumnes si cal
                if (typeof sendActivityUpdate === 'function') {
                    sendActivityUpdate(code, { status: updatedActivity.status });
                }
            }
        }
    });
}

function updateDashboard(code) {
    const activity = JSON.parse(getStoredItem(code));
    const results = JSON.parse(getStoredItem(`${code}_results`));
    const resultsContainer = document.getElementById('results');
    if (!activity || !results || !resultsContainer) return;

    if (activity.status === 'brainstorming') {
        if (!resultsContainer.querySelector('h4')) {
            resultsContainer.innerHTML = '<h4>Idees rebudes:</h4><ul class="ideas-list"></ul>';
        }
        const ideasList = resultsContainer.querySelector('.ideas-list');
        
        // Netejar i tornar a omplir per actualitzar
        ideasList.innerHTML = '';
        results.ideas.forEach(idea => {
            const li = document.createElement('li');
            li.textContent = idea;
            ideasList.appendChild(li);
        });
    } else if (activity.status === 'voting') {
        if (!resultsContainer.querySelector('.results-list')) {
            resultsContainer.innerHTML = '<h4>Resultats de la Votació:</h4><div class="results-list"></div>';
        }
        const votesContainer = resultsContainer.querySelector('.results-list');
        
        const options = activity.type === 'voting' ? activity.options : results.ideas;
        const voteCounts = results.votes || {};
        const totalVotes = Object.values(voteCounts).reduce((sum, count) => sum + count, 0);

        const sortedOptions = options.map(option => ({
            option,
            count: voteCounts[option] || 0
        })).sort((a, b) => b.count - a.count);

        // Netejar el contenidor abans d'actualitzar
        votesContainer.innerHTML = '';
        
        sortedOptions.forEach((item, index) => {
            const { option, count } = item;
            const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0;
            
            const resultElement = document.createElement('div');
            resultElement.className = 'vote-result';
            resultElement.innerHTML = `
                <p class="option-text">${option}</p>
                <div class="progress-bar">
                    <div class="progress" style="width: ${percentage}%"></div>
                </div>
                <p class="vote-count">${count} vot${count !== 1 ? 's' : ''} (${percentage}%)</p>`;
            
            resultElement.style.order = index;
            votesContainer.appendChild(resultElement);
        });
    }
}

function updateStudentView(activity, container) {
    const activityCode = getStoredItem('activityCode');
    const results = JSON.parse(getStoredItem(`${activityCode}_results`));
    const title = container.querySelector('h1');
    
    let formContainer = container.querySelector('.form-wrapper');
    if (!formContainer) {
        formContainer = document.createElement('div');
        formContainer.className = 'form-wrapper';
        container.appendChild(formContainer);
    }

    let viewToShow = activity.status;

    formContainer.innerHTML = '';

    if (viewToShow === 'brainstorming') {
        formContainer.innerHTML = `
            <form id="idea-form" data-status="brainstorming">
                <label for="idea-text">Escriu la teva idea:</label>
                <input type="text" id="idea-text" required autofocus>
                <button type="submit" class="button">Enviar Idea</button>
            </form>`;
    } else if (viewToShow === 'voting') {
        const options = activity.type === 'voting' ? activity.options : (results ? results.ideas : []);
        let optionsHTML = '';
        if(options.length > 0){
            const maxVotes = activity.maxVotes || 1;
            options.forEach((option, index) => {
                optionsHTML += `
                    <div class="option">
                        <input type="checkbox" id="option-${index}" name="voting-option" value="${option}">
                        <label for="option-${index}">${option}</label>
                    </div>`;
            });
            formContainer.innerHTML = `
                <form id="voting-form-alumne" data-status="voting">
                    <h3>Pots votar ${maxVotes} propost${maxVotes > 1 ? 'es' : 'a'}.</h3>
                    ${optionsHTML}
                    <button type="submit" class="button">Emet el teu vot</button>
                </form>`;
        } else {
            formContainer.innerHTML = '<p>Encara no hi ha idees per votar. Espera que el professor iniciï la votació.</p>';
        }
    } else {
        // Si es rep una actualització després de participar, mostrar agraïment
        formContainer.innerHTML = '<h2>Gràcies per la teva participació!</h2>';
    }

    const newForm = formContainer.querySelector('form');
    if (newForm) {
        newForm.addEventListener('submit', handleStudentSubmission);
    }

    // Add logic to limit checkbox selections
    const votingForm = document.getElementById('voting-form-alumne');
    if (votingForm) {
        const checkboxes = votingForm.querySelectorAll('input[type="checkbox"]');
        const maxVotes = activity.maxVotes || 1;

        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const checkedCount = votingForm.querySelectorAll('input[type="checkbox"]:checked').length;
                if (checkedCount >= maxVotes) {
                    checkboxes.forEach(cb => {
                        if (!cb.checked) {
                            cb.disabled = true;
                        }
                    });
                } else {
                    checkboxes.forEach(cb => {
                        cb.disabled = false;
                    });
                }
            });
        });
    }
}

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================
function generateCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Fallback functions for localStorage
function getStoredItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('localStorage not available, using memory storage');
    // Fallback to memory storage if localStorage is not available
    if (!window.memoryStorage) {
      window.memoryStorage = {};
    }
    return window.memoryStorage[key];
  }
}

function setStoredItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('localStorage not available, using memory storage');
    // Fallback to memory storage if localStorage is not available
    if (!window.memoryStorage) {
      window.memoryStorage = {};
    }
    window.memoryStorage[key] = value;
  }
}