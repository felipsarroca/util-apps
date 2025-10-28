document.addEventListener('DOMContentLoaded', () => {
    const configTitle = document.getElementById('config-title');
    const configFields = document.getElementById('config-fields');
    const configForm = document.getElementById('config-form');

    const params = new URLSearchParams(window.location.search);
    const activityType = params.get('type');

    let currentActivityType = activityType;

    function setupConfigForm(type) {
        const titles = {
            'poll': 'Configurar la votació',
            'brainstorm': 'Configurar pluja d\'idees',
            'brainstorm-poll': 'Configurar activitat combinada'
        };
        configTitle.textContent = titles[type] || 'Configurar activitat';

        let html = '';
        let rowFields = '';

        // Camp de Tema (sempre present)
        html += '<div class="form-group"><label for="question">Tema o pregunta</label><input type="text" id="question" name="question" required></div>';

        // Camp d\'Opcions (només per a votació simple)
        if (type === 'poll') {
            html += '<div class="form-group"><label for="poll-options">Opcions (una per línia)</label><textarea id="poll-options" name="pollOptions" rows="6" required></textarea></div>';
        }

        // Camps petits que aniran en una fila
        if (type.includes('brainstorm')) {
            rowFields += '<div class="form-group"><label for="ideas-per-student">Aportacions / participant</label><input type="number" id="ideas-per-student" name="ideasPerStudent" value="1" min="1"></div>';
        }
        if (type.includes('poll')) {
            rowFields += '<div class="form-group"><label for="votes-per-student">Vots / participant</label><input type="number" id="votes-per-student" name="votesPerStudent" value="1" min="1"></div>';
        }

        // Afegeix la fila si conté camps
        if (rowFields) {
            html += `<div class="form-row">${rowFields}</div>`;
        }

        configFields.innerHTML = html;
    }

    configForm.addEventListener('submit', e => {
        e.preventDefault();
        const formData = new FormData(configForm);
        let activityConfig = { type: currentActivityType, ...Object.fromEntries(formData.entries()) };
        activityConfig.pollOptions = activityConfig.pollOptions?.split('\n').filter(opt => opt.trim() !== '') || [];
        launchActivity('host', activityConfig);
        setTimeout(() => window.close(), 500);
    });

    function launchActivity(mode, config) {
        const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
        let url = `activity.html?session=${sessionId}&mode=${mode}`;
        const encodedConfig = encodeURIComponent(JSON.stringify(config));
        url += `&config=${encodedConfig}`;
        window.open(url, '_blank');
    }

    if (activityType) {
        setupConfigForm(activityType);
    } else {
        configFields.innerHTML = '<p>Error: No s\'ha especificat cap tipus d\'activitat.</p>';
    }
});