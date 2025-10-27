const left = document.querySelector('.left');
const right = document.querySelector('.right');
const container = document.querySelector('.container');

if (left && right && container) {
    left.addEventListener('mouseenter', () => {
        container.classList.add('hover-left');
    });

    left.addEventListener('mouseleave', () => {
        container.classList.remove('hover-left');
    });

    right.addEventListener('mouseenter', () => {
        container.classList.add('hover-right');
    });

    right.addEventListener('mouseleave', () => {
        container.classList.remove('hover-right');
    });
}

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
    const brainstormBtn = document.getElementById('brainstorm-btn');
    const votingBtn = document.getElementById('voting-btn');
    const brainstormVotingBtn = document.getElementById('brainstorm-voting-btn');

    const brainstormForm = document.getElementById('brainstorm-form');
    const votingForm = document.getElementById('voting-form');
    const brainstormVotingForm = document.getElementById('brainstorm-voting-form');

    if (brainstormBtn && votingBtn && brainstormVotingBtn) {
        brainstormBtn.addEventListener('click', () => {
            brainstormForm.style.display = 'block';
            votingForm.style.display = 'none';
            brainstormVotingForm.style.display = 'none';
        });

        votingBtn.addEventListener('click', () => {
            brainstormForm.style.display = 'none';
            votingForm.style.display = 'block';
            brainstormVotingForm.style.display = 'none';
        });

        brainstormVotingBtn.addEventListener('click', () => {
            brainstormForm.style.display = 'none';
            votingForm.style.display = 'none';
            brainstormVotingForm.style.display = 'block';
        });
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
                activity.options = document.getElementById('voting-options').value.split('\n');
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
        const activityTitle = document.getElementById('activity-title');

        if (activity) {
            activityTitle.textContent = activity.topic;
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
                results.ideas.push(ideaText);
                document.getElementById('idea-text').value = '';
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
    if (document.querySelector('.dashboard')) {
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
    configContainer.innerHTML = dashboardHTML;
}

function updateDashboard(activityCode) {
    const activity = JSON.parse(localStorage.getItem(activityCode));
    const results = JSON.parse(localStorage.getItem(activityCode + '_results'));
    const resultsContainer = document.getElementById('results');

    if (activity && resultsContainer) {
        resultsContainer.innerHTML = '';
        if (activity.type === 'brainstorm' || (activity.type === 'brainstorm-voting' && activity.status === 'brainstorming')) {
            resultsContainer.innerHTML += '<h3>Idees rebudes:</h3>';
            if(results && results.ideas){
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
            resultsContainer.innerHTML += '<h3>Resultats de la votació:</h3>';
            if(results && results.votes){
                const votesContainer = document.createElement('div');
                let options = activity.type === 'voting' ? activity.options : results.ideas;
                let voteCounts = results.votes;

                // Initialize votes for all options to 0 if they don't exist
                options.forEach(option => {
                    if(!voteCounts[option]){
                        voteCounts[option] = 0;
                    }
                });

                const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);

                for (const option of options) {
                    const count = voteCounts[option] || 0;
                    const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                    votesContainer.innerHTML += 
                        "<div class=\"vote-result\">";
                    votesContainer.innerHTML += `<p>${option}: ${count} vots</p>`;
                    votesContainer.innerHTML += 
                        "<div class=\"progress-bar\">";
                    votesContainer.innerHTML += `<div class="progress" style="width: ${percentage}%;"></div>`;
                    votesContainer.innerHTML += `</div>`;
                    votesContainer.innerHTML += `</div>`;
                }
                resultsContainer.appendChild(votesContainer);
            }
        }
    }
}

function updateStudentView(activity, container) {
    container.innerHTML = ''; // Clear previous content
    const activityTitle = document.createElement('h1');
    activityTitle.id = 'activity-title';
    activityTitle.textContent = activity.topic;
    container.appendChild(activityTitle);

    if (activity.type === 'brainstorm' || (activity.type === 'brainstorm-voting' && activity.status === 'brainstorming')) {
        container.innerHTML += 
            "<form id=\"idea-form\">";
        container.innerHTML += `<label for=\"idea-text\">La teva idea:</label>`;
        container.innerHTML += `<input type="text" id="idea-text" required>`;
        container.innerHTML += `<button type="submit" class="button">Enviar</button>`;
        container.innerHTML += `</form>`;
    } else if (activity.type === 'voting' || (activity.type === 'brainstorm-voting' && activity.status === 'voting')) {
        let options = activity.type === 'voting' ? activity.options : (JSON.parse(localStorage.getItem(sessionStorage.getItem('activityCode')+'_results')) || {}).ideas || [];
        let optionsHTML = '';
        options.forEach((option, index) => {
            optionsHTML += 
                "<div>";
            optionsHTML += `<input type="checkbox" id="option-${index}" name="voting-option" value="${option}">`;
            optionsHTML += `<label for="option-${index}">${option}</label>`;
            optionsHTML += `</div>`;
        });
        container.innerHTML += 
            "<form id=\"voting-form-alumne\">";
        container.innerHTML += optionsHTML;
        container.innerHTML += `<button type="submit" class="button">Votar</button>`;
        container.innerHTML += `</form>`;
    }
}