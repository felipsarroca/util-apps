document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname;

    if (page.includes('index.html') || page === '/') {
        initHomePage();
    } else if (page.includes('professor.html')) {
        initProfessorPage();
    } else if (page.includes('alumne.html')) {
        initAlumnePage();
    }
});

// ====================================================================
// HOME PAGE
// ====================================================================
function initHomePage() {
    const participateBtn = document.getElementById('participate-btn');
    const activityCodeInput = document.getElementById('activity-code');

    participateBtn.addEventListener('click', () => {
        const code = activityCodeInput.value.toUpperCase().trim();
        if (localStorage.getItem(code)) {
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

    // Show the correct form based on URL
    const formToShow = document.getElementById(`${activityType}-form`);
    if (formToShow) {
        formToShow.style.display = 'block';
        document.querySelector('.options').style.display = 'none';
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
        // Create an empty results object
        localStorage.setItem(`${code}_results`, JSON.stringify({ ideas: [], votes: {} }));

        showDashboard(code, activity, configContainer);
    });
}

function createActivityObject(type, form) {
    const activity = { type, status: 'pending' };
    if (type === 'brainstorm') {
        activity.topic = form.querySelector('#brainstorm-topic').value;
        activity.maxIdeas = form.querySelector('#brainstorm-max-ideas').value;
    } else if (type === 'voting') {
        activity.topic = form.querySelector('#voting-topic').value;
        activity.options = form.querySelector('#voting-options').value.split('\n').filter(o => o.trim() !== '');
        activity.maxVotes = form.querySelector('#voting-max-votes').value;
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
            <h2>Activitat en curs</h2>
            <h1>Codi: <span class="activity-code">${code}</span></h1>
            <h3>Tema: ${activity.topic}</h3>
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
            activity.status = 'voting';
            localStorage.setItem(code, JSON.stringify(activity));
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

    resultsContainer.innerHTML = '';

    if (activity.status === 'brainstorming') {
        resultsContainer.innerHTML = '<h4>Idees rebudes:</h4>';
        const ideasList = document.createElement('ul');
        results.ideas.forEach(idea => {
            const li = document.createElement('li');
            li.textContent = idea;
            ideasList.appendChild(li);
        });
        resultsContainer.appendChild(ideasList);
    } else if (activity.status === 'voting' || activity.type === 'voting') {
        resultsContainer.innerHTML = '<h4>Resultats de la Votació:</h4>';
        const votesContainer = document.createElement('div');
        const options = activity.type === 'voting' ? activity.options : results.ideas;
        const voteCounts = results.votes || {};
        const totalVotes = Object.values(voteCounts).reduce((sum, count) => sum + count, 0);

        options.forEach(option => {
            const count = voteCounts[option] || 0;
            const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0;
            const voteResultHTML = `
                <div class="vote-result">
                    <p>${option}</p>
                    <div class="progress-bar">
                        <div class="progress" style="width: ${percentage}%;">${count} vot${count !== 1 ? 's' : ''} (${percentage}%)</div>
                    </div>
                </div>`;
            votesContainer.innerHTML += voteResultHTML;
        });
        resultsContainer.appendChild(votesContainer);
    }
}

// ====================================================================
// ALUMNE PAGE
// ====================================================================
function initAlumnePage() {
    const activityCode = sessionStorage.getItem('activityCode');
    const container = document.querySelector('.participation-container');

    if (!activityCode) {
        container.innerHTML = '<h1>Error: No s\'ha trobat cap codi d\'activitat.</h1><a href="index.html">Torna a l\'inici</a>';
        return;
    }

    let activity = JSON.parse(localStorage.getItem(activityCode));
    document.getElementById('activity-title').textContent = activity.topic;

    updateStudentView(activity, container);

    window.addEventListener('storage', (e) => {
        if (e.key === activityCode) {
            const updatedActivity = JSON.parse(e.newValue);
            updateStudentView(updatedActivity, container);
        }
    });
}

function updateStudentView(activity, container) {
    const activityCode = sessionStorage.getItem('activityCode');
    const results = JSON.parse(localStorage.getItem(`${activityCode}_results`));

    // Evita redibuixar si no cal
    const currentForm = container.querySelector('form');
    const newStatus = activity.status;
    const currentStatus = currentForm ? currentForm.dataset.status : null;
    if(newStatus === currentStatus) return;

    if (newStatus === 'brainstorming') {
        container.innerHTML += `
            <form id="idea-form" data-status="brainstorming">
                <label for="idea-text">Escriu la teva idea:</label>
                <input type="text" id="idea-text" required autofocus>
                <button type="submit" class="button">Enviar Idea</button>
            </form>`;
    } else if (newStatus === 'voting' || activity.type === 'voting') {
        const options = activity.type === 'voting' ? activity.options : results.ideas;
        let optionsHTML = '';
        options.forEach((option, index) => {
            optionsHTML += `
                <div class="option">
                    <input type="checkbox" id="option-${index}" name="voting-option" value="${option}">
                    <label for="option-${index}">${option}</label>
                </div>`;
        });
        container.innerHTML = `<h1 id="activity-title">${activity.topic}</h1>
            <form id="voting-form-alumne" data-status="voting">
                <h3>Escull les teves opcions preferides:</h3>
                ${optionsHTML}
                <button type="submit" class="button">Emet el teu vot</button>
            </form>`;
    }

    // Add event listeners to the new form
    const newForm = container.querySelector('form');
    if (newForm) {
        newForm.addEventListener('submit', handleStudentSubmission);
    }
}

function handleStudentSubmission(e) {
    e.preventDefault();
    const activityCode = sessionStorage.getItem('activityCode');
    const results = JSON.parse(localStorage.getItem(`${activityCode}_results`));

    if (e.target.id === 'idea-form') {
        const ideaText = document.getElementById('idea-text').value.trim();
        if (ideaText) {
            results.ideas.push(ideaText);
            document.getElementById('idea-text').value = '';
        }
    } else if (e.target.id === 'voting-form-alumne') {
        const selectedOptions = e.target.querySelectorAll('input[name="voting-option"]:checked');
        selectedOptions.forEach(checkbox => {
            const value = checkbox.value;
            results.votes[value] = (results.votes[value] || 0) + 1;
        });
        e.target.innerHTML = '<h2>Gràcies per la teva participació!</h2>';
    }

    localStorage.setItem(`${activityCode}_results`, JSON.stringify(results));
}

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================
function generateCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}