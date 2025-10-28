// --- LÓGICA DE INTERNACIONALIZACIÓN (i18n) ---
        const translations = {
            'es': {
                'page_title': 'Votación en Tiempo Real',
                'create_title': 'Crear una nueva votación',
                'question_label': 'Tu pregunta:',
                'question_placeholder': 'Ej: ¿Cuál es tu color favorito?',
                'options_label': 'Opciones de respuesta:',
                'option_1_placeholder': 'Opción 1',
                'option_2_placeholder': 'Opción 2',
                'add_option_btn': '+ Añadir opción',
                'prepare_session_btn': 'Preparar sesión',
                'start_session_btn': 'Iniciar Sesión',
                'live_session_title': '¡Sesión en vivo! Comparte:',
                'scan_qr_label': '1. Escanea el QR',
                'direct_link_label': '2. O comparte este enlace directo:',
                'or_enter_code_label_1': '3. O ve a',
                'or_enter_code_label_2': 'e introduce el código:',
                'projection_btn_text': 'Proyectar',
                'projection_btn_exit_text': 'Salir del modo proyector',
                'total_votes_label': 'Votos totales',
                'join_title': 'Unirse a una votación',
                'session_code_label': 'Código de la sesión:',
                'code_input_placeholder': 'Introduce el código',
                'join_btn': 'Unirse',
                'voted_title': '¡Gracias por tu voto!',
                'voted_subtitle': 'Puedes ver los resultados en la pantalla principal.',
                'vote_sending': 'Enviando voto...', 
                'vote_timeout_error': 'No se recibió respuesta. Por favor, inténtalo de nuevo.',
                'copied_toast': 'Código copiado al portapapeles',
                'url_copied_toast': 'URL copiada al portapapeles',
                'alert_no_question': 'Por favor, introduce una pregunta y al menos dos opciones.',
                'alert_connection_error': 'Ha ocurrido un error con la conexión. Por favor, recarga la página.',
                'join_error_text': 'Error de conexión. Verifica el código o que la persona anfitriona esté conectada.',
                'shareable_link_title': 'Enlace de preparación listo. Cópialo y guárdalo para usarlo más tarde:',
                'switch_to_presenter': '¿Eres el presentador? Inicia sesión aquí.',
                'switch_to_student': '¿Buscas unirte a una sesión? Haz clic aquí.',
                'footer_created_by': 'Aplicación creada por',
                'footer_license': 'Creative Commons Reconocimiento-CompartirIgual 4.0 Internacional',
            },
            'ca': {
                'page_title': 'Votació en Temps Real',
                'create_title': 'Crear una nova votació',
                'question_label': 'La teva pregunta:',
                'question_placeholder': 'Ex: Quin és el teu color preferit?',
                'options_label': 'Opcions de resposta:',
                'option_1_placeholder': 'Opció 1',
                'option_2_placeholder': 'Opció 2',
                'add_option_btn': '+ Afegir opció',
                'prepare_session_btn': 'Preparar sessió',
                'start_session_btn': 'Iniciar Sessió',
                'live_session_title': 'Sessió en viu! Comparteix:',
                'scan_qr_label': '1. Escaneja el QR',
                'direct_link_label': '2. O comparteix aquest enllaç directe:',
                'or_enter_code_label_1': '3. O ves a',
                'or_enter_code_label_2': 'i introdueix el codi:',
                'projection_btn_text': 'Projectar',
                'projection_btn_exit_text': 'Sortir del mode projector',
                'total_votes_label': 'Vots totals',
                'join_title': 'Unir-se a una votació',
                'session_code_label': 'Codi de la sessió:',
                'code_input_placeholder': 'Introdueix el codi',
                'join_btn': 'Unir-se',
                'voted_title': 'Gràcies pel teu vot!',
                'voted_subtitle': 'Pots veure els resultats a la pantalla principal.',
                'vote_sending': 'Enviant vot...', 
                'vote_timeout_error': 'No s\u0027ha rebut resposta. Si us plau, torna-ho a provar.',
                'copied_toast': 'Codi copiat al porta-retalls',
                'url_copied_toast': 'URL copiada al porta-retalls',
                'alert_no_question': 'Si us plau, introdueix una pregunta i almenys dues opcions.',
                'alert_connection_error': 'Hi ha hagut un error amb la connexió. Si us plau, recarrega la pàgina.',
                'join_error_text': 'Error de connexió. Verifica el codi o que la persona amfitriona estigui connectada.',
                'shareable_link_title': 'Enllaç de preparació a punt. Copia\u0027l i desa\u0027l per a més tard:',
                'switch_to_presenter': 'Ets el presentador? Inicia sessió aquí.',
                'switch_to_student': 'Busques unir-te a una sessió? Fes clic aquí.',
                'footer_created_by': 'Aplicació creada per',
                'footer_license': 'Creative Commons Reconeixement-CompartirIgual 4.0 Internacional',
            },
            'gl': {
                'page_title': 'Votación en Tempo Real',
                'create_title': 'Crear unha nova votación',
                'question_label': 'A túa pregunta:',
                'question_placeholder': 'Ex: Cal é a túa cor favorita?',
                'options_label': 'Opcións de resposta:',
                'option_1_placeholder': 'Opción 1',
                'option_2_placeholder': 'Opción 2',
                'add_option_btn': '+ Engadir opción',
                'prepare_session_btn': 'Preparar sesión',
                'start_session_btn': 'Iniciar Sesión',
                'live_session_title': 'Sesión en vivo! Comparte:',
                'scan_qr_label': '1. Escanea o QR',
                'direct_link_label': '2. Ou comparte esta ligazón directa:',
                'or_enter_code_label_1': '3. Ou vai a',
                'or_enter_code_label_2': 'e introduce o código:',
                'projection_btn_text': 'Proxectar',
                'projection_btn_exit_text': 'Saír do modo proxector',
                'total_votes_label': 'Votos totais',
                'join_title': 'Unirse a unha votación',
                'session_code_label': 'Código da sesión:',
                'code_input_placeholder': 'Introduce o código',
                'join_btn': 'Unirse',
                'voted_title': 'Grazas polo teu voto!',
                'voted_subtitle': 'Podes ver os resultados na pantalla principal.',
                'vote_sending': 'Enviando voto...', 
                'vote_timeout_error': 'No se recibiu resposta. Por favor, téntao de novo.',
                'copied_toast': 'Código copiado ao portapapeis',
                'url_copied_toast': 'URL copiada ao portapapeis',
                'alert_no_question': 'Por favor, introduce unha pregunta e polo menos dúas opcións.',
                'alert_connection_error': 'Houbo un erro coa conexión. Por favor, recarga a páxina.',
                'join_error_text': 'Erro de conexión. Verifica o código ou que a persoa anfitrioa estea conectada.',
                'shareable_link_title': 'Ligazón de preparación lista. Cópiaa e gárdaa para usala máis tarde:',
                'switch_to_presenter': 'Es o presentador? Inicia sesión aquí.',
                'switch_to_student': 'Buscas unirte a unha sesión? Fai clic aquí.',
                'footer_created_by': 'Aplicación creada por',
                'footer_license': 'Creative Commons Recoñecemento-CompartirIgual 4.0 Internacional',
            },
            'eu': {
                'page_title': 'Bozketa Denbora Errealean',
                'create_title': 'Bozketa berria sortu',
                'question_label': 'Zure galdera:',
                'question_placeholder': 'Adib: Zein da zure kolorerik gogokoena?',
                'options_label': 'Erantzun-aukerak:',
                'option_1_placeholder': '1. aukera',
                'option_2_placeholder': '2. aukera',
                'add_option_btn': '+ Gehitu aukera',
                'prepare_session_btn': 'Saioa prestatu',
                'start_session_btn': 'Saioa Hasi',
                'live_session_title': 'Saioa zuzenean! Partekatu:',
                'scan_qr_label': '1. Eskaneatu QR-a',
                'direct_link_label': '2. Edo partekatu esteka zuzen hau:',
                'or_enter_code_label_1': '3. Edo joan hona:',
                'or_enter_code_label_2': 'eta sartu kodea:',
                'projection_btn_text': 'Proiektatu',
                'projection_btn_exit_text': 'Proiektagailu modutik irten',
                'total_votes_label': 'Botoak guztira',
                'join_title': 'Bozketa batean sartu',
                'session_code_label': 'Saioaren kodea:',
                'code_input_placeholder': 'Sartu kodea',
                'join_btn': 'Sartu',
                'voted_title': 'Eskerrik asko zure botoagatik!',
                'voted_subtitle': 'Emaitzak pantaila nagusian ikus ditzakezu.',
                'vote_sending': 'Botoa bidaltzen...', 
                'vote_timeout_error': 'Ez da erantzunik jaso. Mesedez, saiatu berriro.',
                'copied_toast': 'Kodea arbelean kopiatu da',
                'url_copied_toast': 'URLa arbelean kopiatu da',
                'alert_no_question': 'Mesedez, sartu galdera bat eta gutxienez bi aukera.',
                'alert_connection_error': 'Konexioarekin errore bat gertatu da. Mesedez, birkargatu orria.',
                'join_error_text': 'Konexio-errorea. Egiaztatu kodea edo antolatzailea konektatuta dagoela.',
                'shareable_link_title': 'Prestatzeko esteka prest. Kopiatu eta gorde geroago erabiltzeko:',
                'switch_to_presenter': 'Aurkezlea zara? Hasi saioa hemen.',
                'switch_to_student': 'Saio batean sartu nahi duzu? Egin klik hemen.',
                'footer_created_by': 'Aplikazioa, egilea:',
                'footer_license': 'Creative Commons Aitortu-PartekatuBerdin 4.0 Nazioartekoa',
            },
            'en': {
                'page_title': 'Real-time Voting',
                'create_title': 'Create a new poll',
                'question_label': 'Your question:',
                'question_placeholder': 'E.g., What is your favorite color?',
                'options_label': 'Answer options:',
                'option_1_placeholder': 'Option 1',
                'option_2_placeholder': 'Option 2',
                'add_option_btn': '+ Add option',
                'prepare_session_btn': 'Prepare session',
                'start_session_btn': 'Start Session',
                'live_session_title': 'Live session! Share:',
                'scan_qr_label': '1. Scan the QR code',
                'direct_link_label': '2. Or share this direct link:',
                'or_enter_code_label_1': '3. Or go to',
                'or_enter_code_label_2': 'and enter the code:',
                'projection_btn_text': 'Project',
                'projection_btn_exit_text': 'Exit projection mode',
                'total_votes_label': 'Total votes',
                'join_title': 'Join a poll',
                'session_code_label': 'Session code:',
                'code_input_placeholder': 'Enter code',
                'join_btn': 'Join',
                'voted_title': 'Thank you for your vote!',
                'voted_subtitle': 'You can see the results on the main screen.',
                'vote_sending': 'Submitting vote...', 
                'vote_timeout_error': 'No response received. Please try again.',
                'copied_toast': 'Code copied to clipboard',
                'url_copied_toast': 'URL copied to clipboard',
                'alert_no_question': 'Please enter a question and at least two options.',
                'alert_connection_error': 'A connection error has occurred. Please reload the page.',
                'join_error_text': 'Connection error. Check the code or that the host is connected.',
                'shareable_link_title': 'Preparation link ready. Copy and save it for later use:',
                'switch_to_presenter': 'Are you the presenter? Log in here.',
                'switch_to_student': 'Looking to join a session? Click here.',
                'footer_created_by': 'Application created by',
                'footer_license': 'Creative Commons Attribution-ShareAlike 4.0 International',
            }
        };

        let currentLang = 'es';

        function setLanguage(lang) {
            if (!translations[lang]) return;
            currentLang = lang;
            localStorage.setItem('preferred_language', lang);
            document.documentElement.lang = lang;
            document.getElementById('lang-selector').value = lang;

            document.querySelectorAll('[data-translate-key]').forEach(el => {
                const key = el.getAttribute('data-translate-key');
                if (translations[lang][key]) {
                    el.innerText = translations[lang][key];
                }
            });
             document.querySelectorAll('[data-translate-key-placeholder]').forEach(el => {
                const key = el.getAttribute('data-translate-key-placeholder');
                if (translations[lang][key]) {
                    el.placeholder = translations[lang][key];
                }
            });
            document.title = translations[lang]['page_title'] || 'Votación en Tiempo Real';
        }

        // --- LÓGICA DE INICIO ---
        window.onload = function() {
            const savedLang = localStorage.getItem('preferred_language');
            const browserLang = (navigator.language || navigator.userLanguage).split('-')[0];
            
            if (savedLang && translations[savedLang]) {
                setLanguage(savedLang);
            } else if (translations[browserLang]) {
                setLanguage(browserLang);
            } else {
                setLanguage('es');
            }

            checkURLParameters();
        };

        function checkURLParameters() {
            const params = new URLSearchParams(window.location.search);
            const sessionId = params.get('session');
            const data = params.get('data');

            if (sessionId) { // Si hay un ID de sesión, el usuario es un participante.
                switchView('student');
                document.getElementById('code-input').value = sessionId;
                joinSession();
            } else if (data) { // Si hay datos, es una sesión preparada para un presentador.
                switchView('presenter');
                try {
                    const decodedData = JSON.parse(atob(data));
                    const questionInput = document.getElementById('question');
                    const optionsContainer = document.getElementById('options-container');
                    
                    questionInput.value = decodedData.question;
                    
                    optionsContainer.innerHTML = '';
                    decodedData.options.forEach(optionText => {
                        const newOptionInput = document.createElement('input');
                        newOptionInput.type = 'text';
                        newOptionInput.name = 'option';
                        newOptionInput.className = 'w-full p-2 border border-gray-300 rounded-md shadow-sm';
                        newOptionInput.value = optionText;
                        optionsContainer.appendChild(newOptionInput);
                    });
                } catch (e) {
                    console.error("Error al decodificar los datos de la sesión preparada:", e);
                    switchView('student'); // Si falla, volver a la vista de estudiante.
                }
            } else {
                // Por defecto, mostrar siempre la vista de estudiante.
                switchView('student');
            }
        }

        // --- Variables Globales ---
        let peer = null;
        let hostConnection = null;
        let guestConnections = [];
        let sessionData = {};
        let myPeerId = null;
        let voteTimeout = null;
        let countdownInterval = null;


        // --- LÓGICA GENERAL DE LA UI ---

        function switchView(view) {
            const presenterView = document.getElementById('presenter-view');
            const studentView = document.getElementById('student-view');

            if (view === 'presenter') {
                presenterView.classList.remove('hidden');
                studentView.classList.add('hidden');
            } else { // 'student'
                presenterView.classList.add('hidden');
                studentView.classList.remove('hidden');
            }
        };

        function addOption() {
            const container = document.getElementById('options-container');
            const optionCount = container.children.length + 1;
            const newOptionInput = document.createElement('input');
            newOptionInput.type = 'text';
            newOptionInput.name = 'option';
            newOptionInput.placeholder = `${translations[currentLang]['option_1_placeholder'].replace('1', optionCount)}`;
            container.appendChild(newOptionInput);
        };
        
        function copyCode() {
            const code = document.getElementById('session-code').innerText;
            navigator.clipboard.writeText(code).then(() => {
                const toast = document.getElementById('toast');
                toast.innerText = translations[currentLang]['copied_toast'];
                toast.style.opacity = 1;
                setTimeout(() => { toast.style.opacity = 0; }, 2000);
            });
        }

        function copyUrl(event) {
            event.preventDefault();
            const url = event.target.href;
            navigator.clipboard.writeText(url).then(() => {
                const toast = document.getElementById('toast');
                toast.innerText = translations[currentLang]['url_copied_toast'];
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

        function toggleProjectionMode() {
            const isEntering = !document.body.classList.contains('projection-mode');
            document.body.classList.toggle('projection-mode');
            
            const btn = document.getElementById('projection-btn');
            const btnText = btn.querySelector('span');
            
            document.getElementById('projection-icon-enter').classList.toggle('hidden');
            document.getElementById('projection-icon-exit').classList.toggle('hidden');

            if (isEntering) {
                btnText.innerText = translations[currentLang]['projection_btn_exit_text'];
                window.addEventListener('keydown', handleExitProjection);
                document.getElementById('app').addEventListener('click', handleExitProjection);
            } else {
                btnText.innerText = translations[currentLang]['projection_btn_text'];
                window.removeEventListener('keydown', handleExitProjection);
                document.getElementById('app').removeEventListener('click', handleExitProjection);
            }
        }

        function handleExitProjection(event) {
            if (event.type === 'click' && event.target.closest('#projection-btn')) {
                return;
            }
            if (event.type === 'keydown' && event.key !== 'Escape') {
                return;
            }
            if (document.body.classList.contains('projection-mode')) {
                toggleProjectionMode();
            }
        }

        // --- LÓGICA DEL PRESENTADOR (ANFITRIÓN) ---
        
        function generateShareableLink() {
            const question = document.getElementById('question').value.trim();
            const optionInputs = document.querySelectorAll('#options-container input[name="option"]');
            const options = Array.from(optionInputs)
                .map(input => input.value.trim())
                .filter(text => text !== '');

            if (!question || options.length < 2) {
                alert(translations[currentLang]['alert_no_question']);
                return;
            }

            const pollData = { question, options };
            const encodedData = btoa(JSON.stringify(pollData));
            const shareUrl = window.location.href.split('?')[0] + '?data=' + encodedData;
            
            const linkContainer = document.getElementById('shareable-link-container');
            const linkInput = document.getElementById('shareable-link-input');
            linkInput.value = shareUrl;
            linkContainer.classList.remove('hidden');
            linkInput.select();
            document.execCommand('copy');
            
            const toast = document.getElementById('toast');
            toast.innerText = translations[currentLang]['copied_toast'].replace('Código', 'Enlace');
            toast.style.opacity = 1;
            setTimeout(() => { toast.style.opacity = 0; }, 2000);
        }

        function hostSession() {
            const question = document.getElementById('question').value.trim();
            const optionInputs = document.querySelectorAll('#options-container input[name="option"]');
            const options = Array.from(optionInputs)
                .map(input => input.value.trim())
                .filter(text => text !== '')
                .map(text => ({ text: text, votes: 0 }));

            if (!question || options.length < 2) {
                alert(translations[currentLang]['alert_no_question']);
                return;
            }
            
            document.getElementById('host-button-text').classList.add('hidden');
            document.getElementById('host-loader').classList.remove('hidden');
            document.getElementById('prepare-button').setAttribute('disabled', true);

            sessionData = { question, options };
            
            const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
            peer = new Peer(sessionId); 

            peer.on('open', (id) => {
                myPeerId = id;
                const baseUrl = window.location.href.split('?')[0];
                const sessionUrl = baseUrl + '?session=' + id;
                
                generateQRCode(sessionUrl);

                const sessionCodeEl = document.getElementById('session-code');
                if (sessionCodeEl) sessionCodeEl.innerText = id;

                const appUrlEl = document.getElementById('app-url');
                if (appUrlEl) {
                    appUrlEl.href = baseUrl;
                    appUrlEl.innerText = baseUrl.replace(/^https?:\/\//, '');
                }

                const directLinkEl = document.getElementById('direct-session-link');
                if (directLinkEl) {
                    directLinkEl.href = sessionUrl;
                    directLinkEl.innerText = sessionUrl;
                }

                document.getElementById('lang-selector-container').classList.add('hidden');
                document.getElementById('create-session-form').classList.add('hidden');
                document.getElementById('results-view').classList.remove('hidden');

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
                alert(translations[currentLang]['alert_connection_error']);
                console.error(err);
                document.getElementById('host-button-text').classList.remove('hidden');
                document.getElementById('host-loader').classList.add('hidden');
                document.getElementById('prepare-button').removeAttribute('disabled');
            });
        }

        function handleVote(optionIndex) {
            sessionData.options[optionIndex].votes++;
            updateResultsView(sessionData);
        }

        function updateResultsView(data) {
            const resultsQuestionEl = document.getElementById('results-question');
            if(resultsQuestionEl) resultsQuestionEl.innerText = data.question;
            
            const resultsContainerEl = document.getElementById('results-container');
            if(!resultsContainerEl) return;
            resultsContainerEl.innerHTML = '';

            const totalVotes = data.options.reduce((sum, option) => sum + option.votes, 0);
            
            const totalVotesEl = document.getElementById('total-votes');
            if(totalVotesEl) totalVotesEl.innerText = totalVotes;

            data.options.forEach(option => {
                const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                const resultElement = document.createElement('div');
                resultElement.innerHTML = `
                    <div class="flex justify-between items-baseline mb-2">
                        <span class="text-xl md:text-2xl text-gray-800 font-medium">${option.text}</span>
                        <span class="text-xl md:text-2xl font-bold text-gray-900">${option.votes} <span class="text-lg md:text-xl text-gray-600 font-medium">(${percentage.toFixed(0)}%)</span></span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-8 md:h-10">
                        <div class="bg-green-500 h-8 md:h-10 rounded-full bar-transition" style="width: ${percentage}%"></div>
                    </div>
                `;
                resultsContainerEl.appendChild(resultElement);
            });
        }

        // --- LÓGICA DEL PARTICIPANTE (INVITADO) ---

        function joinSession() {
            const hostId = document.getElementById('code-input').value.trim().toUpperCase();
            if (!hostId) return;
            document.getElementById('code-input').value = hostId;

            document.getElementById('join-button').setAttribute('disabled', true);
            document.getElementById('join-button-text').classList.add('hidden');
            document.getElementById('join-loader').classList.remove('hidden');
            document.getElementById('join-error').classList.add('hidden');

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
                errorP.innerText = translations[currentLang]['join_error_text'];
                errorP.classList.remove('hidden');
            }
            const joinButtonText = document.getElementById('join-button-text');
            if(joinButtonText) joinButtonText.classList.remove('hidden');

            const joinLoader = document.getElementById('join-loader');
            if(joinLoader) joinLoader.classList.add('hidden');

            const joinButton = document.getElementById('join-button');
            if(joinButton) joinButton.removeAttribute('disabled');
        }

        function showVotingView(data) {
            document.getElementById('join-session-form').classList.add('hidden');
            document.getElementById('voted-view').classList.add('hidden');
            const votingView = document.getElementById('voting-view');
            votingView.classList.remove('hidden');
            document.getElementById('vote-error').classList.add('hidden');

            document.getElementById('vote-question').innerText = data.question;
            const optionsContainer = document.getElementById('vote-options-container');
            optionsContainer.innerHTML = '';

            data.options.forEach((option, index) => {
                const button = document.createElement('button');
                button.className = "w-full text-left p-4 border border-gray-300 rounded-lg hover:bg-green-50 hover:border-green-400 transition duration-200";
                button.innerText = option.text;
                button.onclick = () => castVote(index);
                optionsContainer.appendChild(button);
            });
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
                const optionsContainer = document.getElementById('vote-options-container');
                const voteSending = document.getElementById('vote-sending');
                const voteError = document.getElementById('vote-error');
                const countdownSpan = document.getElementById('vote-countdown');

                voteError.classList.add('hidden');
                optionsContainer.querySelectorAll('button').forEach(btn => btn.disabled = true);
                voteSending.classList.remove('hidden');
                
                let secondsLeft = 10;
                countdownSpan.textContent = `(${secondsLeft}s)`;
                countdownInterval = setInterval(() => {
                    secondsLeft--;
                    countdownSpan.textContent = `(${secondsLeft}s)`;
                    if (secondsLeft <= 0) {
                        clearInterval(countdownInterval);
                    }
                }, 1000);

                voteTimeout = setTimeout(() => {
                    clearInterval(countdownInterval);
                    optionsContainer.querySelectorAll('button').forEach(btn => btn.disabled = false);
                    voteSending.classList.add('hidden');
                    voteError.innerText = translations[currentLang]['vote_timeout_error'];
                    voteError.classList.remove('hidden');
                }, 10000);

                hostConnection.send({ type: 'vote', payload: { optionIndex } });
            }
        }
    </script>
</body>
</html>