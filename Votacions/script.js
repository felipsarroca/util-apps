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
});

// ====================================================================
// USER ID MANAGEMENT
// ====================================================================
function ensureUserId() {
    if (!localStorage.getItem('userId')) {
        localStorage.setItem('userId', 'user_' + Math.random().toString(36).substring(2, 15));
    }
}

// ====================================================================
// ALUMNE PAGE
// ====================================================================
function initAlumnePage() {
    const activityCode = sessionStorage.getItem('activityCode');
    const container = document.querySelector('.participation-container');
    const userId = localStorage.getItem('userId');

    if (!activityCode || !localStorage.getItem(activityCode)) {
        container.innerHTML = '<h1>Error: No s\'ha trobat cap codi d\'activitat vàlid.</h1><a href="index.html">Torna a l\'inici</a>';
        return;
    }

    const activity = JSON.parse(localStorage.getItem(activityCode));
    const results = JSON.parse(localStorage.getItem(`${activityCode}_results`));

    // Check if user has already voted for this activity
    if (results && results.votedUsers && results.votedUsers.includes(userId)) {
        container.innerHTML = `<h1>${activity.topic}</h1><h2>Gràcies per la teva participació! Ja has votat en aquesta activitat.</h2>`;
        return; // Stop execution if already voted
    }

    container.querySelector('#activity-title').textContent = activity.topic;

    updateStudentView(activity, container);

    window.addEventListener('storage', (e) => {
        if (e.key === activityCode) {
            const updatedActivity = JSON.parse(e.newValue);
            if(updatedActivity.status !== activity.status){
                activity = updatedActivity;
                updateStudentView(updatedActivity, container);
            }
        }
    });
}

function handleStudentSubmission(e) {
    e.preventDefault();
    const activityCode = sessionStorage.getItem('activityCode');
    const activity = JSON.parse(localStorage.getItem(activityCode));
    const results = JSON.parse(localStorage.getItem(`${activityCode}_results`));
    const userId = localStorage.getItem('userId');

    if (e.target.id === 'idea-form') {
        const ideaText = document.getElementById('idea-text').value.trim();
        if (ideaText) {
            results.ideas.push(ideaText);
            document.getElementById('idea-text').value = '';
            // Optionally, you could track users who submitted ideas too
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

        selectedOptions.forEach(checkbox => {
            const value = checkbox.value;
            results.votes[value] = (results.votes[value] || 0) + 1;
        });
        
        // Mark user as voted
        if (!results.votedUsers) {
            results.votedUsers = [];
        }
        results.votedUsers.push(userId);

        e.target.parentElement.innerHTML = '<h2>Gràcies per la teva participació!</h2>';
    }

    localStorage.setItem(`${activityCode}_results`, JSON.stringify(results));
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
        if (code && localStorage.getItem(code)) {
            sessionStorage.setItem('activityCode', code);
            window.location.href = 'alumne.html';
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
        
        localStorage.setItem(code, JSON.stringify(activity));
        localStorage.setItem(`${code}_results`, JSON.stringify({ ideas: [], votes: {} }));

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
            ${activity.type === 'brainstorm-voting' ? '<button id="start-voting-btn" class="button">Activar Votació</button>' : ''}
            <div id="results"></div>
        </div>`;
    container.innerHTML = dashboardHTML;

    updateDashboard(code);
    
    window.addEventListener('storage', (e) => {
        if (e.key === `${code}_results`) {
            updateDashboard(code);
        }
    });

    if (activity.type === 'brainstorm-voting') {
        const startVotingBtn = document.getElementById('start-voting-btn');
        startVotingBtn.addEventListener('click', () => {
            let currentActivity = JSON.parse(localStorage.getItem(code));
            currentActivity.status = 'voting';
            localStorage.setItem(code, JSON.stringify(currentActivity));
            updateDashboard(code);
            startVotingBtn.style.display = 'none';
        });
    }
}

function updateDashboard(code) {
    const activity = JSON.parse(localStorage.getItem(code));
    const results = JSON.parse(localStorage.getItem(`${code}_results`));
    const resultsContainer = document.getElementById('results');
    if (!activity || !results || !resultsContainer) return;

    if (activity.status === 'brainstorming') {
        if (!resultsContainer.querySelector('h4')) {
            resultsContainer.innerHTML = '<h4>Idees rebudes:</h4><ul class="ideas-list"></ul>';
        }
        const ideasList = resultsContainer.querySelector('.ideas-list');
        // Simple update to avoid re-rendering all ideas every time
        const existingIdeas = [...ideasList.children].map(li => li.textContent);
        results.ideas.forEach(idea => {
            if (!existingIdeas.includes(idea)) {
                const li = document.createElement('li');
                li.textContent = idea;
                ideasList.appendChild(li);
            }
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

        sortedOptions.forEach((item, index) => {
            const { option, count } = item;
            const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0;
            
            let resultElement = votesContainer.querySelector(`.vote-result[data-option="${option}"]`);

            if (!resultElement) {
                resultElement = document.createElement('div');
                resultElement.className = 'vote-result';
                resultElement.setAttribute('data-option', option);
                resultElement.innerHTML = `
                    <p class="option-text">${option}</p>
                    <div class="progress-bar">
                        <div class="progress"></div>
                    </div>
                    <p class="vote-count"></p>`;
                votesContainer.appendChild(resultElement);
            }

            resultElement.style.order = index;
            resultElement.querySelector('.progress').style.width = `${percentage}%`;
            resultElement.querySelector('.vote-count').textContent = `${count} vot${count !== 1 ? 's' : ''}`;
        });
    }
}

// ====================================================================
// ALUMNE PAGE
// ====================================================================
function initAlumnePage() {
    const activityCode = sessionStorage.getItem('activityCode');
    const container = document.querySelector('.participation-container');

    if (!activityCode || !localStorage.getItem(activityCode)) {
        container.innerHTML = '<h1>Error: No s\'ha trobat cap codi d\'activitat vàlid.</h1><a href="index.html">Torna a l\'inici</a>';
        return;
    }

    let activity = JSON.parse(localStorage.getItem(activityCode));
    container.querySelector('#activity-title').textContent = activity.topic;

    updateStudentView(activity, container);

    window.addEventListener('storage', (e) => {
        if (e.key === activityCode) {
            const updatedActivity = JSON.parse(e.newValue);
            if(updatedActivity.status !== activity.status){
                activity = updatedActivity;
                updateStudentView(updatedActivity, container);
            }
        }
    });
}

function updateStudentView(activity, container) {
    const activityCode = sessionStorage.getItem('activityCode');
    const results = JSON.parse(localStorage.getItem(`${activityCode}_results`));
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
    }

    const newForm = formContainer.querySelector('form');
    if (newForm) {
        newForm.addEventListener('submit', handleStudentSubmission);
    }
}

function handleStudentSubmission(e) {
    e.preventDefault();
    const activityCode = sessionStorage.getItem('activityCode');
    const activity = JSON.parse(localStorage.getItem(activityCode));
    const results = JSON.parse(localStorage.getItem(`${activityCode}_results`));

    if (e.target.id === 'idea-form') {
        const ideaText = document.getElementById('idea-text').value.trim();
        if (ideaText) {
            results.ideas.push(ideaText);
            document.getElementById('idea-text').value = '';
        }
    } else if (e.target.id === 'voting-form-alumne') {
        const selectedOptions = e.target.querySelectorAll('input[name="voting-option"]:checked');
        const maxVotes = activity.maxVotes || 1;

        if (selectedOptions.length > maxVotes) {
            alert(`Només pots seleccionar un màxim de ${maxVotes} opcions.`);
            return;
        }

        selectedOptions.forEach(checkbox => {
            const value = checkbox.value;
            results.votes[value] = (results.votes[value] || 0) + 1;
        });
        e.target.parentElement.innerHTML = '<h2>Gràcies per la teva participació!</h2>';
    }

    localStorage.setItem(`${activityCode}_results`, JSON.stringify(results));
}

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================
function generateCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}
