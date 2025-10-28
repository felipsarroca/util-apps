let activityType = 'voting'; // Default to voting

// --- Variables Globales ---
let peer = null;
let hostConnection = null;
let guestConnections = [];
let sessionData = {};
let myPeerId = null;
let voteTimeout = null;
let countdownInterval = null;

// --- LÓGICA DE INICIO ---
window.onload = function() {
    checkURLParameters();
    document.getElementById('participate-btn').addEventListener('click', joinSession);
};

function checkURLParameters() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session');
    if (sessionId) {
        document.getElementById('activity-code').value = sessionId;
        joinSession();
    }
}

function showProfessorActivity(type) {
    activityType = type;
    document.getElementById('professor-initial-view').classList.add('hidden');
    const presenterView = document.getElementById('presenter-view');
    presenterView.classList.remove('hidden');

    let formHTML = `
        <h2>Configuració: ${type}</h2>
    `;

    if (type === 'brainstorm' || type === 'brainstorm-voting') {
        formHTML += `
            <div class="form-group">
                <label for="question">Tema o pregunta:</label>
                <input type="text" id="question" placeholder="Ex: Què podem fer per millorar el pati?">
            </div>
        `;
    }

    if (type === 'voting') {
         formHTML += `
            <div class="form-group">
                <label for="question">Tema de la votació:</label>
                <input type="text" id="question" placeholder="Ex: Quin és el vostre color preferit?">
            </div>
            <div class="form-group">
                <label for="options-container">Opcions (una per línia):</label>
                <div id="options-container">
                    <input type="text" name="option" placeholder="Opció 1">
                    <input type="text" name="option" placeholder="Opció 2">
                </div>
                <button onclick="addOption()" class="add-option-btn">+ Afegeix una opció</button>
            </div>
        `;
    }

    formHTML += `
        <div class="button-group">
            <button onclick="hostSession()" id="host-button" class="button">
                <span id="host-button-text">Generar Codi</span>
                <div id="host-loader" class="loader hidden"></div>
            </button>
        </div>
    `;

    document.getElementById('create-session-form').innerHTML = formHTML;
}


        // --- LÓGICA GENERAL DE LA UI ---

        function addOption() {
            const container = document.getElementById('options-container');
            const optionCount = container.children.length + 1;
            const newOptionInput = document.createElement('input');
            newOptionInput.type = 'text';
            newOptionInput.name = 'option';
            newOptionInput.placeholder = `Opció ${optionCount}`;
            container.appendChild(newOptionInput);
        };
        
        function copyCode() {
            const code = document.getElementById('session-code').innerText;
            navigator.clipboard.writeText(code).then(() => {
                const toast = document.getElementById('toast');
                toast.innerText = 'Codi copiat al porta-retalls';
                toast.style.opacity = 1;
                setTimeout(() => { toast.style.opacity = 0; }, 2000);
            });
        }

        function copyUrl(event) {
            event.preventDefault();
            const url = event.target.href;
            navigator.clipboard.writeText(url).then(() => {
                const toast = document.getElementById('toast');
                toast.innerText = 'URL copiada al porta-retalls';
                toast.style.opacity = 1;
                setTimeout(() => { toast.style.opacity = 0; }, 2000);
            });
        }

        function generateQRCode(url) {
            const container = document.getElementById('qrcode-container');
            container.innerHTML = '';
            new QRCode(container, {
                text: url,
                width: 200,
                height: 200,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        }


        // --- LÓGICA DEL PRESENTADOR (ANFITRIÓN) ---
        
        function hostSession() {
            const question = document.getElementById('question').value.trim();
            const optionInputs = document.querySelectorAll('#options-container input[name="option"]');
            const options = Array.from(optionInputs)
                .map(input => input.value.trim())
                .filter(text => text !== '')
                .map(text => ({ text: text, votes: 0 }));

            if (!question || (activityType !== 'brainstorm' && options.length < 2)) {
                alert('Si us plau, introdueix una pregunta i almenys dues opcions.');
                return;
            }
            
            document.getElementById('create-session-form').classList.add('hidden');
            document.getElementById('results-view').classList.remove('hidden');

            sessionData = { question, options, activityType };
            
            const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
            peer = new Peer(sessionId); 

            peer.on('open', (id) => {
                myPeerId = id;
                const baseUrl = window.location.href.split('?')[0];
                const sessionUrl = baseUrl + '?session=' + id;
                
                generateQRCode(sessionUrl);

                document.getElementById('session-code').innerText = id;
                document.getElementById('results-question').innerText = question;
                document.getElementById('direct-session-link').href = sessionUrl;
                document.getElementById('direct-session-link').innerText = sessionUrl;

                updateResultsView(sessionData);
            });

            peer.on('connection', (conn) => {
                guestConnections.push(conn);
                conn.on('open', () => {
                    conn.send({ type: 'session-data', payload: sessionData });
                });
                conn.on('data', (data) => {
                    if (data.type === 'vote') {
                        handleVote(data.payload.optionIndex);
                        conn.send({ type: 'vote-confirmed' });
                    }
                });
                conn.on('close', () => {
                    guestConnections = guestConnections.filter(c => c.peer !== conn.peer);
                });
            });

             peer.on('error', (err) => {
                alert('Hi ha hagut un error amb la connexió. Si us plau, recarrega la pàgina.');
                console.error(err);
                document.getElementById('host-button-text').classList.remove('hidden');
                document.getElementById('host-loader').classList.add('hidden');
            });
        }

        function handleVote(optionIndex) {
            sessionData.options[optionIndex].votes++;
            updateResultsView(sessionData);
        }

        function updateResultsView(data) {
            const resultsContainerEl = document.getElementById('results-container');
            if(!resultsContainerEl) return;
            resultsContainerEl.innerHTML = '';

            const totalVotes = data.options.reduce((sum, option) => sum + option.votes, 0);
            
            document.getElementById('total-votes').innerText = totalVotes;

            const sortedOptions = [...data.options].sort((a,b) => b.votes - a.votes);

            sortedOptions.forEach((option, index) => {
                const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                const resultElement = document.createElement('div');
                resultElement.className = 'vote-result';
                resultElement.style.order = index;

                resultElement.innerHTML = `
                    <p class="option-text">${option.text}</p>
                    <div class="progress-bar">
                         <div class="progress" style="width: ${percentage}%;"></div>
                    </div>
                    <p class="vote-count">${option.votes}</p>
                `;
                resultsContainerEl.appendChild(resultElement);
            });
        }

        // --- LÓGICA DEL PARTICIPANTE (INVITADO) ---

        function joinSession() {
            const hostId = document.getElementById('activity-code').value.trim().toUpperCase();
            if (!hostId) return;
            
            const joinButton = document.getElementById('participate-btn');
            joinButton.setAttribute('disabled', true);
            // Assuming there is a loader element, if not, it should be added to the HTML
            // const joinLoader = document.getElementById('join-loader');
            // if(joinLoader) joinLoader.classList.remove('hidden');

            peer = new Peer();

            peer.on('open', () => {
                hostConnection = peer.connect(hostId, { reliable: true });
                
                hostConnection.on('open', () => {});

                hostConnection.on('data', (data) => {
                    if (data.type === 'session-data') {
                        const hasVoted = localStorage.getItem('voted_in_' + hostConnection.peer);
                        if (hasVoted) {
                            showVotedView();
                        } else {
                            showVotingView(data.payload);
                        }
                    } else if (data.type === 'vote-confirmed') {
                        clearTimeout(voteTimeout);
                        clearInterval(countdownInterval);
                        localStorage.setItem('voted_in_' + hostConnection.peer, 'true');
                        showVotedView();
                        setTimeout(() => {
                            if (hostConnection) hostConnection.close();
                        }, 500);
                    }
                });
                 hostConnection.on('error', (err) => {
                    console.error('Error en la conexión:', err);
                    showJoinError();
                });
                 hostConnection.on('close', () => {
                    if (!localStorage.getItem('voted_in_' + hostConnection.peer)) {
                       showJoinError();
                    }
                 });
            });
            
            peer.on('error', (err) => {
                console.error('Error de PeerJS:', err);
                showJoinError();
            });
        }
        
        function showJoinError() {
            const errorP = document.getElementById('join-error');
            if(errorP) {
                errorP.innerText = 'Error de connexió. Verifica el codi o que la persona amfitriona estigui connectada.';
                errorP.classList.remove('hidden');
            }
            const joinButton = document.getElementById('participate-btn');
            if(joinButton) joinButton.removeAttribute('disabled');
        }

        function showVotingView(data) {
            document.getElementById('join-session-form').classList.add('hidden');
            const votingView = document.getElementById('voting-view');
            votingView.classList.remove('hidden');
            
            document.getElementById('vote-question').innerText = data.question;
            const optionsContainer = document.getElementById('vote-options-container');
            optionsContainer.innerHTML = '';

            if (data.activityType === 'brainstorm') {
                // Show a simple input for ideas
                optionsContainer.innerHTML = `
                    <div class="form-group">
                        <label for="idea-input">La teva idea:</label>
                        <input type="text" id="idea-input" class="w-full">
                        <button onclick="castVote(document.getElementById('idea-input').value)" class="button">Enviar</button>
                    </div>
                `;
            } else {
                // Show voting buttons
                data.options.forEach((option, index) => {
                    const button = document.createElement('button');
                    button.className = "button option-button";
                    button.innerText = option.text;
                    button.onclick = () => castVote(index);
                    optionsContainer.appendChild(button);
                });
            }
        }

        function showVotedView() {
            clearTimeout(voteTimeout);
            clearInterval(countdownInterval);
            document.getElementById('join-session-form').classList.add('hidden');
            document.getElementById('voting-view').classList.add('hidden');
            document.getElementById('voted-view').classList.remove('hidden');
        }

        function castVote(optionIndex) {
            if (hostConnection) {
                // Disable buttons to prevent multiple votes
                const optionsContainer = document.getElementById('vote-options-container');
                optionsContainer.querySelectorAll('button').forEach(btn => btn.disabled = true);
                
                hostConnection.send({ type: 'vote', payload: { optionIndex } });

                // Set a timeout for vote confirmation
                voteTimeout = setTimeout(() => {
                    showJoinError(); // Or a more specific error
                }, 10000); 
            }
        }
