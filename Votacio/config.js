document.addEventListener('DOMContentLoaded', () => {
    const configTitle = document.getElementById('config-title');
    const configFields = document.getElementById('config-fields');
    const configForm = document.getElementById('config-form');

    const params = new URLSearchParams(window.location.search);
    const activityType = params.get('type');

    let currentActivityType = activityType;

    function setupConfigForm(type) {
        const titles = {
            'poll': 'Configurar la Votació',
            'brainstorm': 'Configurar Pluja d\'Idees',
            'brainstorm-poll': 'Configurar Activitat Combinada'
        };
        configTitle.textContent = titles[type] || 'Configurar Activitat';

        let html = '<div class="form-group full-width"><label for="question">Tema o pregunta:</label><input type="text" id="question" name="question" required></div>';
        
        let bottomFields = '';

        if (type.includes('brainstorm')) {
            bottomFields += '<div class="form-group"><label for="ideas-per-student">Aportacions per alumne:</label><input type="number" id="ideas-per-student" name="ideasPerStudent" value="1" min="1"></div>';
        }
        if (type.includes('poll')) {
            if (type === 'poll') {
                html += '<div class="form-group full-width"><label for="poll-options">Opcions (una per línia):</label><textarea id="poll-options" name="pollOptions" rows="4" required></textarea></div>';
            }
            bottomFields += '<div class="form-group"><label for="votes-per-student">Vots per participant:</label><input type="number" id="votes-per-student" name="votesPerStudent" value="1" min="1"></div>';
        }

        if (bottomFields) {
            html += `<div class="form-row">${bottomFields}</div>`;
        }

        configFields.innerHTML = html;
    }

    configForm.addEventListener('submit', e => {
        e.preventDefault();
        const formData = new FormData(configForm);
        let activityConfig = { type: currentActivityType, ...Object.fromEntries(formData.entries()) };
        activityConfig.pollOptions = activityConfig.pollOptions?.split('\n').filter(opt => opt.trim() !== '') || [];
        launchActivity('host', activityConfig);
        // Opcional: tancar la pestanya de configuració un cop llançada l'activitat
        setTimeout(() => window.close(), 500);
    });

    function launchActivity(mode, config) {
        const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
        let url = `activity.html?session=${sessionId}&mode=${mode}`;
        const encodedConfig = encodeURIComponent(JSON.stringify(config));
        url += `&config=${encodedConfig}`;
        window.open(url, '_blank');
    }

    // Inicialitza el formulari en carregar la pàgina
    if (activityType) {
        setupConfigForm(activityType);
    } else {
        configFields.innerHTML = '<p>Error: No s\'ha especificat cap tipus d\'activitat.</p>';
    }
});
