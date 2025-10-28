document.addEventListener('DOMContentLoaded', () => {
    const configTitle = document.getElementById('config-title');
    const configIcon = document.getElementById('config-icon');
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
        const icons = {
            'poll': 'fa-check-to-slot',
            'brainstorm': 'fa-lightbulb',
            'brainstorm-poll': 'fa-bolt'
        };
        configTitle.textContent = titles[type] || 'Configurar activitat';
        configIcon.className = `fa-solid ${icons[type] || 'fa-question-circle'}`;

        let leftColumn = '';
        let rightColumn = '';

        // Columna Esquerra
        let leftContent = '<div class="form-group"><label for="question">Tema o pregunta</label><input type="text" id="question" name="question" required></div>';
        let rowFields = '';

        if (type.includes('brainstorm')) {
            rowFields += '<div class="form-group"><label for="ideas-per-student">Aportacions / participant</label><input type="number" id="ideas-per-student" name="ideasPerStudent" value="1" min="1"></div>';
        }
        if (type.includes('poll')) {
            rowFields += '<div class="form-group"><label for="votes-per-student">Vots / participant</label><input type="number" id="votes-per-student" name="votesPerStudent" value="1" min="1"></div>';
        }
        if (rowFields) {
            leftContent += `<div class="form-row">${rowFields}</div>`;
        }

        // Afegeix el botó al final de la columna esquerra
        leftContent += '<button type="submit" class="launch-button"><i class="fa-solid fa-rocket"></i> Generar codi</button>';
        leftColumn = `<div class="form-column">${leftContent}</div>`;

        // Columna Dreta (només per a votació)
        if (type.includes('poll')) {
            rightColumn = '<div class="form-column"><div class="form-group"><label for="poll-options">Opcions (una per línia)</label><textarea id="poll-options" name="pollOptions" rows="10" required></textarea></div></div>';
        }
        
        configFields.innerHTML = leftColumn + rightColumn;
        if (!rightColumn) {
            document.querySelector('.form-column').style.flexBasis = '100%';
        }
    }

    configForm.addEventListener('submit', e => {
        e.preventDefault();
        const formData = new FormData(configForm);
        let activityConfig = { type: currentActivityType, ...Object.fromEntries(formData.entries()) };
        activityConfig.pollOptions = activityConfig.pollOptions?.split('\n').filter(opt => opt.trim() !== '') || [];
        launchActivity('host', activityConfig);
    });

    function launchActivity(mode, config) {
        const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
        let url = `activity.html?session=${sessionId}&mode=${mode}`;
        const encodedConfig = encodeURIComponent(JSON.stringify(config));
        url += `&config=${encodedConfig}`;
        window.location.href = url;
    }

    if (activityType) {
        setupConfigForm(activityType);
    } else {
        configFields.innerHTML = '<p>Error: No s\'ha especificat cap tipus d\'activitat.</p>';
    }
});