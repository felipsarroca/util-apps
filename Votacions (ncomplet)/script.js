document.addEventListener('DOMContentLoaded', () => {
    // Home page
    const participateBtn = document.getElementById('participate-btn');
    if (participateBtn) {
        participateBtn.addEventListener('click', () => {
            const code = document.getElementById('activity-code').value.toUpperCase();
            const activity = localStorage.getItem(code);

            if (activity) {
                sessionStorage.setItem('activityCode', code);
                window.location.href = 'alumne.html';
            } else {
                alert('Codi d\'activitat invàlid');
            }
        });
    }

    // Professor page
    const urlParams = new URLSearchParams(window.location.search);
    const activityTypeFromUrl = urlParams.get('activity');

    const brainstormForm = document.getElementById('brainstorm-form');
    const votingForm = document.getElementById('voting-form');
    const brainstormVotingForm = document.getElementById('brainstorm-voting-form');
    const optionsDiv = document.querySelector('.options');

    if (activityTypeFromUrl && brainstormForm) {
        optionsDiv.style.display = 'none';
        if (activityTypeFromUrl === 'brainstorm') {
            brainstormForm.style.display = 'block';
        } else if (activityTypeFromUrl === 'voting') {
            votingForm.style.display = 'block';
        } else if (activityTypeFromUrl === 'brainstorm-voting') {
            brainstormVotingForm.style.display = 'block';
        }
    }

    document.querySelectorAll('.config-form form').forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const code = generateCode();
            const activityType = form.parentElement.id.replace('-form', '');
            let activity = { type: activityType, status: 'pending' };

            if (activityType === 'brainstorm') {
                activity.topic = document.getElementById('brainstorm-topic').value;
                activity.maxIdeas = document.getElementById('brainstorm-max-ideas').value;
            } else if (activityType === 'voting') {
                activity.topic = document.getElementById('voting-topic').value;
                activity.options = document.getElementById('voting-options').value.split('\n').filter(o => o.trim() !== '');
                activity.maxVotes = document.getElementById('voting-max-votes').value;
            } else if (activityType === 'brainstorm-voting') {
                activity.topic = document.getElementById('bv-topic').value;
                activity.maxIdeas = document.getElementById('bv-max-ideas').value;
                activity.maxVotes = document.getElementById('bv-max-votes').value;
                activity.status = 'brainstorming'; // Initial status
            }

            localStorage.setItem(code, JSON.stringify(activity));
            showDashboard(code, activity);
        });
    });

    // Student page
    const activityCode = sessionStorage.getItem('activityCode');
    if (activityCode && window.location.pathname.includes('alumne.html')) {
        const activity = JSON.parse(localStorage.getItem(activityCode));
        const participationContainer = document.querySelector('.participation-container');

        if (activity) {
            updateStudentView(activity, participationContainer);

            window.addEventListener('storage', (e) => {
                if (e.key === activityCode) {
                    const updatedActivity = JSON.parse(e.newValue);
                    updateStudentView(updatedActivity, participationContainer);
                }
            });
        }
    }

    // Student idea/vote submission
    const participationContainer = document.querySelector('.participation-container');
    if (participationContainer) {
        participationContainer.addEventListener('submit', (e) => {
            e.preventDefault();
            const activityCode = sessionStorage.getItem('activityCode');
            let results = localStorage.getItem(activityCode + '_results');
            results = results ? JSON.parse(results) : { ideas: [], votes: {} };

            if (e.target.id === 'idea-form') {
                const ideaText = document.getElementById('idea-text').value;
                if(ideaText.trim() !== ''){
                    results.ideas.push(ideaText);
                    document.getElementById('idea-text').value = '';
                }
            } else if (e.target.id === 'voting-form-alumne') {
                const selectedOptions = document.querySelectorAll('input[name="voting-option"]:checked');
                selectedOptions.forEach(option => {
                    const value = option.value;
                    results.votes[value] = (results.votes[value] || 0) + 1;
                });
                e.target.innerHTML = '<p>Gràcies per votar!</p>';
            }

            localStorage.setItem(activityCode + '_results', JSON.stringify(results));
        });
    }

    // Professor dashboard
    const dashboard = document.querySelector('.dashboard');
    if (dashboard) {
        const activityCode = document.querySelector('.activity-code').textContent;
        updateDashboard(activityCode);

        window.addEventListener('storage', (e) => {
            if (e.key === activityCode + '_results') {
                updateDashboard(activityCode);
            }
        });

        const startVotingBtn = document.getElementById('start-voting-btn');
        if(startVotingBtn){
            startVotingBtn.addEventListener('click', () => {
                const activityCode = document.querySelector('.activity-code').textContent;
                let activity = JSON.parse(localStorage.getItem(activityCode));
                activity.status = 'voting';
                localStorage.setItem(activityCode, JSON.stringify(activity));
                updateDashboard(activityCode);
            });
        }
    }
});

function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function showDashboard(code, activity) {
    const configContainer = document.querySelector('.config-container');
    let dashboardHTML = `
        <div class="dashboard">
            <h1>Codi de l'activitat: <span class="activity-code">${code}</span></h1>
            <h2>${activity.topic}</h2>
            <div id="results"></div>
    `;

    if (activity.type === 'brainstorm-voting') {
        dashboardHTML += `<button id="start-voting-btn" class="button">Inicia la votació</button>`;
    }

    dashboardHTML += `</div>`;
    if(configContainer) {
        configContainer.innerHTML = dashboardHTML;
    }
}

function updateDashboard(activityCode) {
    const activity = JSON.parse(localStorage.getItem(activityCode));
    const resultsJSON = localStorage.getItem(activityCode + '_results');
    const results = resultsJSON ? JSON.parse(resultsJSON) : { ideas: [], votes: {} };
    const resultsContainer = document.getElementById('results');

    if (activity && resultsContainer) {
        resultsContainer.innerHTML = '';
        const startVotingBtn = document.getElementById('start-voting-btn');

        if (activity.type === 'brainstorm' || (activity.type === 'brainstorm-voting' && activity.status === 'brainstorming')) {
            resultsContainer.innerHTML += '<h3>Idees rebudes:</h3>';
            if(results.ideas && results.ideas.length > 0){
                const ideasList = document.createElement('ul');
                results.ideas.forEach(idea => {
                    const li = document.createElement('li');
                    li.textContent = idea;
                    ideasList.appendChild(li);
                });
                resultsContainer.appendChild(ideasList);
            }
        }

        if (activity.type === 'voting' || (activity.type === 'brainstorm-voting' && activity.status === 'voting')) {
            if(startVotingBtn) startVotingBtn.style.display = 'none';
            resultsContainer.innerHTML = '<h3>Resultats de la votació:</h3>';
            const votesContainer = document.createElement('div');
            let options = activity.type === 'voting' ? activity.options : results.ideas;
            let voteCounts = results.votes || {};

            options.forEach(option => {
                if(!voteCounts[option]){
                    voteCounts[option] = 0;
                }
            });

            const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);

            for (const option of options) {
                const count = voteCounts[option] || 0;
                const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                votesContainer.innerHTML += `
                    <div class="vote-result">
                        <p><strong>${option}:</strong> ${count} vots</p>
                        <div class="progress-bar">
                            <div class="progress" style="width: ${percentage}%;"></div>
                        </div>
                    </div>
                `;
            }
            resultsContainer.appendChild(votesContainer);
        }
    }
}

function updateStudentView(activity, container) {
    const activityCode = sessionStorage.getItem('activityCode');
    const resultsJSON = localStorage.getItem(activityCode + '_results');
    const results = resultsJSON ? JSON.parse(resultsJSON) : { ideas: [], votes: {} };

    let currentContent = container.querySelector('form') || container.querySelector('p');

    if (activity.type === 'brainstorm' || (activity.type === 'brainstorm-voting' && activity.status === 'brainstorming')) {
        if(!currentContent || currentContent.id !== 'idea-form'){
            container.innerHTML = '';
            const activityTitle = document.createElement('h1');
            activityTitle.id = 'activity-title';
            activityTitle.textContent = activity.topic;
            container.appendChild(activityTitle);
            container.innerHTML += `
                <form id="idea-form">
                    <label for="idea-text">La teva idea:</label>
                    <input type="text" id="idea-text" required>
                    <button type="submit" class="button">Enviar</button>
                </form>
            `;
        }
    } else if (activity.type === 'voting' || (activity.type === 'brainstorm-voting' && activity.status === 'voting')) {
        if(!currentContent || currentContent.id !== 'voting-form-alumne'){
            container.innerHTML = '';
            const activityTitle = document.createElement('h1');
            activityTitle.id = 'activity-title';
            activityTitle.textContent = activity.topic;
            container.appendChild(activityTitle);
            let options = activity.type === 'voting' ? activity.options : results.ideas || [];
            let optionsHTML = '';
            options.forEach((option, index) => {
                optionsHTML += `
                    <div class="option">
                        <input type="checkbox" id="option-${index}" name="voting-option" value="${option}">
                        <label for="option-${index}">${option}</label>
                    </div>
                `;
            });
            container.innerHTML += `
                <form id="voting-form-alumne">
                    ${optionsHTML}
                    <button type="submit" class="button">Votar</button>
                </form>
            `;
        }
    }
}
