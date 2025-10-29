document.addEventListener('DOMContentLoaded', () => {
    const configTitle = document.getElementById('config-title');
    const configForm = document.getElementById('config-form');
    const primaryColumn = document.getElementById('primary-column');
    const secondaryColumn = document.getElementById('secondary-column');
    const configActions = document.getElementById('config-actions');

    const params = new URLSearchParams(window.location.search);
    const activityType = params.get('type') || 'brainstorm';

    const titles = {
        poll: 'Configura la votació',
        brainstorm: 'Configura la pluja d\'idees',
        'brainstorm-poll': 'Configura la pluja d\'idees i la votació'
    };

    function buildPrimaryColumn(type) {
        const blocks = [];

        blocks.push(`
            <div class="config-card">
                <div class="field-group">
                    <label for="question">Tema o pregunta</label>
                    <input type="text" id="question" name="question" required>
                </div>
            </div>
        `);

        const extras = [];
        if (type.includes('brainstorm')) {
            extras.push(`
                <div class="field-group">
                    <label for="ideas-per-student">Aportacions per participant</label>
                    <input type="number" id="ideas-per-student" name="ideasPerStudent" value="1" min="1">
                </div>
            `);
        }
        if (type.includes('poll')) {
            extras.push(`
                <div class="field-group">
                    <label for="votes-per-student">Vots per participant</label>
                    <input type="number" id="votes-per-student" name="votesPerStudent" value="1" min="1">
                </div>
            `);
        }

        if (extras.length) {
            blocks.push(`
                <div class="config-card compact-card">
                    <div class="field-row">
                        ${extras.join('')}
                    </div>
                </div>
            `);
        }

        primaryColumn.innerHTML = blocks.join('');
    }

    function buildSecondaryColumn(type) {
        if (type !== 'poll') {
            secondaryColumn.innerHTML = '';
            secondaryColumn.classList.add('hidden-column');
            primaryColumn.classList.add('full-width');
            return;
        }

        secondaryColumn.classList.remove('hidden-column');
        primaryColumn.classList.remove('full-width');
        secondaryColumn.innerHTML = `
            <div class="config-card">
                <div class="field-group">
                    <label for="poll-options">Opcions (una per línia)</label>
                    <textarea id="poll-options" name="pollOptions" rows="10" required></textarea>
                </div>
            </div>
        `;
    }

    function buildActions() {
        const button = document.createElement('button');
        button.type = 'submit';
        button.className = 'launch-button';
        button.innerHTML = '<i class="fa-solid fa-rocket"></i> Generar codi';

        const container = document.createElement('div');
        container.className = 'button-container';
        container.appendChild(button);

        return container;
    }

    function setupLayout(type) {
        configTitle.textContent = titles[type] || 'Configurar activitat';

        document.body.classList.remove('type-poll', 'type-brainstorm', 'type-brainstorm-poll');
        document.body.classList.add(`type-${type}`);

        buildPrimaryColumn(type);
        buildSecondaryColumn(type);

        const actionContainer = buildActions();
        const compactCard = primaryColumn.querySelector('.compact-card');

        configActions.innerHTML = '';

        if (compactCard) {
            const row = document.createElement('div');
            row.className = 'card-action-row';
            row.appendChild(compactCard);
            row.appendChild(actionContainer);
            primaryColumn.appendChild(row);
            configActions.classList.remove('align-start');
        } else {
            configActions.appendChild(actionContainer);
            configActions.classList.toggle('align-start', type === 'poll' || type === 'brainstorm-poll');
        }
    }

    configForm.addEventListener('submit', event => {
        event.preventDefault();
        const formData = new FormData(configForm);
        const config = Object.fromEntries(formData.entries());
        config.type = activityType;
        config.pollOptions = config.pollOptions
            ? config.pollOptions.split('\n').map(opt => opt.trim()).filter(Boolean)
            : [];

        launchActivity('host', config);
    });

    function launchActivity(mode, config) {
        const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
        let url = `activity.html?session=${sessionId}&mode=${mode}`;
        const encodedConfig = encodeURIComponent(JSON.stringify(config));
        url += `&config=${encodedConfig}`;
        window.location.href = url;
    }

    setupLayout(activityType);
});
