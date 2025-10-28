document.addEventListener('DOMContentLoaded', () => {
    // Aquest script gestiona la pàgina d'inici i el llançament de l'activitat

    // --- Elements del DOM ---
    const screens = { home: document.getElementById('home-screen'), teacher: document.getElementById('teacher-screen') };
    const homeScreenActivityCards = document.querySelectorAll('.activity-card');
    const studentJoinForm = document.getElementById('student-join-form');
    const configForm = document.getElementById('config-form');
    const backToHomeBtn = document.getElementById('back-to-choice'); // Reutilitzat
    const teacherBackToHomeBtn = document.getElementById('teacher-back-to-home');

    let currentActivityType = null;

    // --- Navegació ---
    const showScreen = name => {
        Object.values(screens).forEach(s => s.classList.add('hidden'));
        screens[name]?.classList.remove('hidden');
    };

    // --- FLUX DEL PROFESSOR ---
    const configFormsContainer = document.getElementById('config-forms');
    const activityChoiceContainer = document.getElementById('activity-choice');

    homeScreenActivityCards.forEach(card => {
        card.addEventListener('click', () => {
            currentActivityType = card.dataset.activity;
            setupConfigForm(currentActivityType);
            showScreen('teacher'); // Mostra la secció <section id="teacher-screen">
            
            // Mostra el contenidor del formulari i amaga el de la tria antiga
            configFormsContainer.classList.remove('hidden');
            activityChoiceContainer.classList.add('hidden');
        });
    });

    // Botons per tornar a l'inici
    backToHomeBtn.addEventListener('click', () => showScreen('home'));
    teacherBackToHomeBtn.addEventListener('click', () => showScreen('home'));

    function setupConfigForm(type) {
        const fieldsContainer = document.getElementById('config-fields');
        document.getElementById('config-title').textContent = `Configuració: ${type.replace('-', ' + ')}`;
        let html = '<label for="question">Tema o pregunta:</label><input type="text" id="question" name="question" required>';
        if (type.includes('brainstorm')) html += '<label for="ideas-per-student">Aportacions per alumne:</label><input type="number" id="ideas-per-student" name="ideasPerStudent" value="1" min="1">';
        if (type.includes('poll')) {
            if (type === 'poll') html += '<label for="poll-options">Opcions (una per línia):</label><textarea id="poll-options" name="pollOptions" rows="5" required></textarea>';
            html += '<label for="votes-per-student">Vots per alumne:</label><input type="number" id="votes-per-student" name="votesPerStudent" value="1" min="1">';
        }
        fieldsContainer.innerHTML = html;
    }

    configForm.addEventListener('submit', e => {
        e.preventDefault();
        const formData = new FormData(configForm);
        let activityConfig = { type: currentActivityType, ...Object.fromEntries(formData.entries()) };
        activityConfig.pollOptions = activityConfig.pollOptions?.split('\n').filter(opt => opt.trim() !== '') || [];
        launchActivity('host', activityConfig);
        showScreen('home');
    });

    // --- FLUX DE L'ALUMNE ---
    studentJoinForm.addEventListener('submit', e => {
        e.preventDefault();
        const code = document.getElementById('session-code-input').value.trim().toUpperCase();
        if (code) {
            launchActivity('guest', { sessionCode: code });
            studentJoinForm.reset();
        }
    });

    // --- LLANÇAMENT DE L'ACTIVITAT ---
    function launchActivity(mode, config) {
        const sessionId = (mode === 'host') ? Math.random().toString(36).substring(2, 8).toUpperCase() : config.sessionCode;
        let url = `activity.html?session=${sessionId}&mode=${mode}`;
        if (mode === 'host') {
            const encodedConfig = encodeURIComponent(JSON.stringify(config));
            url += `&config=${encodedConfig}`;
        }
        window.open(url, '_blank');
    }
});
