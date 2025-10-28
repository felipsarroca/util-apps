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
        leftColumn = `<div class="form-column">${leftContent}</div>`;

        // Columna Dreta (només per a votació)
        if (type.includes('poll')) {
            rightColumn = '<div class="form-column"><div class="form-group"><label for="poll-options">Opcions (una per línia)</label><textarea id="poll-options" name="pollOptions" rows="10" required></textarea></div></div>';
        }
        
        configFields.innerHTML = leftColumn + rightColumn;
        // Si no hi ha columna dreta, la columna esquerra hauria d'ocupar tot l'espai
        if (!rightColumn) {
            document.querySelector('.form-column').style.flexBasis = '100%';
        }
        
        // Crear un botó "Generar codi" i col·locar-lo després del camp "Vots per participant" per a votacions
        if (type.includes('poll')) {
            setTimeout(() => {
                // Trobar el form-row que conté el camp "Vots per participant"
                const votesInput = document.getElementById('votes-per-student');
                if (votesInput) {
                    // Crear el botó
                    const launchButton = document.createElement('button');
                    launchButton.type = 'submit';
                    launchButton.className = 'launch-button';
                    launchButton.innerHTML = '<i class="fa-solid fa-rocket"></i> Generar codi';
                    
                    // Crear un contenidor per al botó
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'button-container';
                    buttonContainer.appendChild(launchButton);
                    
                    // Afegir el botó després del form-row que conté els camps
                    const formRow = votesInput.closest('.form-row');
                    if (formRow) {
                        formRow.parentNode.insertBefore(buttonContainer, formRow.nextSibling);
                    } else {
                        // Si no troba el form-row, afegir al final de la columna esquerra
                        const leftCol = document.querySelector('.form-column');
                        if (leftCol) {
                            leftCol.appendChild(buttonContainer);
                        }
                    }
                }
            }, 0);
        } else {
            // Per altres tipus, afegir el botó al final del formulari
            const launchButton = document.createElement('button');
            launchButton.type = 'submit';
            launchButton.className = 'launch-button';
            launchButton.innerHTML = '<i class="fa-solid fa-rocket"></i> Generar codi';
            
            configForm.appendChild(launchButton);
        }
    }

    configForm.addEventListener('submit', e => {
        e.preventDefault();
        // Comprovar que el submit no vingui d'un botó creat anteriorment per evitar duplicats
        if (e.submitter && e.submitter.classList.contains('launch-button')) {
            const formData = new FormData(configForm);
            let activityConfig = { type: currentActivityType, ...Object.fromEntries(formData.entries()) };
            activityConfig.pollOptions = activityConfig.pollOptions?.split('\n').filter(opt => opt.trim() !== '') || [];
            launchActivity('host', activityConfig);
        }
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
