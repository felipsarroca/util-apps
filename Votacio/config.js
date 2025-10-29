document.addEventListener('DOMContentLoaded', () => {
    const configTitle = document.getElementById('config-title');
    const configFields = document.getElementById('config-fields');
    const configForm = document.getElementById('config-form');

    const params = new URLSearchParams(window.location.search);
    const activityType = params.get('type');

    let currentActivityType = activityType;

    function setupConfigForm(type) {
        // Marca el tipus a <body> per aplicar interliniats compactes de forma consistent
        document.body.classList.remove('type-brainstorm', 'type-poll', 'type-brainstorm-poll');
        document.body.classList.add(`type-${type}`);
                                const titles = {
            'poll': 'Configurar la votaci\u00F3',
            'brainstorm': 'Configurar pluja d\'idees',
            'brainstorm-poll': 'Configurar la pluja d\'idees i la votaci\u00F3 posterior'
        };
        configTitle.textContent = titles[type] || 'Configurar activitat';

        let leftColumn = '';
        let rightColumn = '';

        // Columna Esquerra
        let leftContent = '<div class="form-group compact-gap"><label for="question">Tema o pregunta</label><input type="text" id="question" name="question" required></div>';
        let rowFields = '';

        if (type.includes('brainstorm')) {
            rowFields += '<div class="form-group compact-gap"><label for="ideas-per-student">Aportacions / participant</label><input type="number" id="ideas-per-student" name="ideasPerStudent" value="1" min="1"></div>';
        }
        if (type.includes('poll')) {
            rowFields += '<div class="form-group compact-gap"><label for="votes-per-student">M\u00E0xim de vots per participant</label><input type="number" id="votes-per-student" name="votesPerStudent" value="1" min="1"></div>';
        }
        // Ajust de textos específics per a l'activitat combinada
        if (type === 'brainstorm-poll') {
            rowFields = rowFields
                .replace('Aportacions / participant', 'Aportacions per participant')
                .replace('M\u00E0xim de vots per participant', 'Vots per participant');
        }
        if (rowFields) {
            leftContent += `<div class="form-row">${rowFields}</div>`;
        }
        leftColumn = `<div class="form-column">${leftContent}</div>`;

        // Columna Dreta (nomÃ©s per a votaciÃ³)
        if (type.includes('poll')) {
            rightColumn = '<div class="form-column"><div class="form-group"><label for="poll-options">Opcions (una per l\u00EDnia)</label><textarea id="poll-options" name="pollOptions" rows="10" required></textarea></div></div>';
        }
        
        configFields.innerHTML = leftColumn + rightColumn;
        if (!rightColumn) {
            const singleColumn = configFields.querySelector('.form-column');
            if (singleColumn) singleColumn.classList.add('single-column');
        }

        configForm.querySelectorAll('.button-container').forEach(container => container.remove());

        const launchButton = document.createElement('button');
        launchButton.type = 'submit';
        launchButton.className = 'launch-button';
        launchButton.innerHTML = '<i class="fa-solid fa-rocket"></i> Generar codi';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';
        buttonContainer.appendChild(launchButton);

        if (type.includes('poll')) {
            buttonContainer.classList.add('align-start');
        }

        configForm.appendChild(buttonContainer);
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
        window.location.href = url; // Obre a la mateixa pestanya
    }

    if (activityType) {
        setupConfigForm(activityType);
    } else {
        configFields.innerHTML = '<p>Error: No s\'ha especificat cap tipus d\'activitat.</p>';
    }
});


