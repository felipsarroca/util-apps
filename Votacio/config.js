document.addEventListener('DOMContentLoaded', () => {
    const configTitle = document.getElementById('config-title');
    const configForm = document.getElementById('config-form');
    const primaryStack = document.getElementById('primary-stack');
    const secondaryStack = document.getElementById('secondary-stack');
    const summaryCard = document.getElementById('config-summary');
    const footerActions = document.getElementById('footer-actions');

    const params = new URLSearchParams(window.location.search);
    const activityType = params.get('type') || 'brainstorm';

    let currentActivityType = activityType;

    const titles = {
        poll: 'Configurar la votació',
        brainstorm: 'Configurar pluja d\'idees',
        'brainstorm-poll': 'Configurar activitat combinada'
    };

    const badges = {
        poll: 'Votació',
        brainstorm: 'Pluja d\'idees',
        'brainstorm-poll': 'Combinada'
    };

    function buildPrimaryPanel(type) {
        const participationFields = [];

        if (type.includes('brainstorm')) {
            participationFields.push(`
                <div class="form-group">
                    <label for="ideas-per-student">Aportacions / participant</label>
                    <input type="number" id="ideas-per-student" name="ideasPerStudent" value="1" min="1">
                </div>
            `);
        }

        if (type.includes('poll')) {
            participationFields.push(`
                <div class="form-group">
                    <label for="votes-per-student">Vots màxims / participant</label>
                    <input type="number" id="votes-per-student" name="votesPerStudent" value="1" min="1">
                </div>
            `);
        }

        return `
            <article class="card card-primary question-card">
                <div class="card-header">
                    <h2>Tema o pregunta</h2>
                    <p class="card-subtitle">Aquest enunciat guiarà el treball dels participants.</p>
                </div>
                <div class="card-content">
                    <div class="form-group">
                        <label for="question">Tema o pregunta</label>
                        <input type="text" id="question" name="question" required>
                    </div>
                </div>
            </article>
            ${participationFields.length ? `
                <article class="card card-primary participation-card">
                    <div class="card-header">
                        <h2>Participació</h2>
                        <p class="card-subtitle">Defineix els límits per cada alumne.</p>
                    </div>
                    <div class="card-content">
                        <div class="field-grid">
                            ${participationFields.join('')}
                        </div>
                        <p class="info-callout">
                            Ajusta aquests valors segons el temps disponible i el nombre de participants.
                        </p>
                    </div>
                </article>
            ` : ''}
        `;
    }

    function buildSecondaryPanel(type) {
        const blocks = [];

        if (type.includes('poll')) {
            blocks.push(`
                <article class="card card-secondary options-card">
                    <div class="card-header">
                        <h2>Opcions de vot</h2>
                        <p class="card-subtitle">Escriu una opció per línia. Les mostrarem en el mateix ordre.</p>
                    </div>
                    <div class="card-content">
                        <div class="form-group">
                            <label for="poll-options">Opcions (una per línia)</label>
                            <textarea id="poll-options" name="pollOptions" rows="10" required></textarea>
                        </div>
                        <div class="options-preview">
                            <h3>Previsualització</h3>
                            <ul class="options-list" id="options-preview">
                                <li class="empty">Encara no hi ha opcions afegides.</li>
                            </ul>
                        </div>
                    </div>
                    <div class="card-footer stack-actions" data-slot="options-actions"></div>
                </article>
            `);
        } else {
            blocks.push(`
                <article class="card card-secondary info-card">
                    <div class="card-header">
                        <h2>Preparació d'idees</h2>
                        <p class="card-subtitle">La pluja d'idees s'obrirà sense opcions prèvies.</p>
                    </div>
                    <div class="card-content">
                        <p class="info-callout">
                            Comparteix exemples o criteris abans de començar perquè els alumnes entenguin què vols que aportin.
                        </p>
                    </div>
                </article>
            `);
        }

        if (type.includes('brainstorm')) {
            blocks.push(`
                <article class="card card-secondary info-card">
                    <div class="card-header">
                        <h2>Consells per dinamitzar</h2>
                    </div>
                    <div class="card-content">
                        <ul class="options-list">
                            <li class="empty">Planteja rondes curtes, promou idees diverses i acorda criteris abans de votar.</li>
                        </ul>
                    </div>
                </article>
            `);
        }

        return blocks.join('');
    }

    function buildSummary(type) {
        const isBrainstorm = type.includes('brainstorm');
        const isPoll = type.includes('poll');

        return `
            <div class="summary-header">
                <h3>Resum ràpid</h3>
                <span class="summary-badge">${badges[type] || 'Activitat'}</span>
            </div>
            <div class="summary-list">
                <div class="summary-item">
                    <span class="label">Tema</span>
                    <span class="value" data-summary="question">—</span>
                </div>
                <div class="summary-item${isBrainstorm ? '' : ' muted'}">
                    <span class="label">Aportacions / participant</span>
                    <span class="value" data-summary="ideas">${isBrainstorm ? '1' : '—'}</span>
                </div>
                <div class="summary-item${isPoll ? '' : ' muted'}">
                    <span class="label">Vots / participant</span>
                    <span class="value" data-summary="votes">${isPoll ? '1' : '—'}</span>
                </div>
                <div class="summary-item${isPoll ? '' : ' muted'}">
                    <span class="label">Opcions actives</span>
                    <span class="value" data-summary="options">${isPoll ? '0' : '—'}</span>
                </div>
            </div>
        `;
    }

    function createLaunchButton() {
        const container = document.createElement('div');
        container.className = 'button-container';

        const button = document.createElement('button');
        button.type = 'submit';
        button.className = 'launch-button';
        button.innerHTML = '<i class="fa-solid fa-rocket"></i> Generar codi';

        container.appendChild(button);
        return container;
    }

    function renderOptionsPreview(listElement, options) {
        if (!listElement) {
            return;
        }

        listElement.innerHTML = '';

        if (!options.length) {
            const emptyItem = document.createElement('li');
            emptyItem.className = 'empty';
            emptyItem.textContent = 'Encara no hi ha opcions afegides.';
            listElement.appendChild(emptyItem);
            return;
        }

        options.forEach((option, index) => {
            const item = document.createElement('li');

            const position = document.createElement('span');
            position.textContent = index + 1;

            const text = document.createElement('span');
            text.textContent = option;

            item.appendChild(position);
            item.appendChild(text);
            listElement.appendChild(item);
        });
    }

    function setupConfigForm(type) {
        currentActivityType = type;
        configTitle.textContent = titles[type] || 'Configurar activitat';

        document.body.classList.remove('type-poll', 'type-brainstorm', 'type-brainstorm-poll');
        document.body.classList.add(`type-${type}`);

        primaryStack.innerHTML = buildPrimaryPanel(type);
        secondaryStack.innerHTML = buildSecondaryPanel(type);
        summaryCard.innerHTML = buildSummary(type);
        footerActions.innerHTML = '';

        const launchButtonContainer = createLaunchButton();
        if (type.includes('poll')) {
            launchButtonContainer.classList.add('align-start');
            const actionsSlot = secondaryStack.querySelector('[data-slot="options-actions"]');
            if (actionsSlot) {
                actionsSlot.appendChild(launchButtonContainer);
            } else {
                secondaryStack.appendChild(launchButtonContainer);
            }
        } else {
            footerActions.appendChild(launchButtonContainer);
        }

        const questionInput = configForm.querySelector('#question');
        const ideasInput = configForm.querySelector('#ideas-per-student');
        const votesInput = configForm.querySelector('#votes-per-student');
        const optionsTextarea = configForm.querySelector('#poll-options');
        const optionsPreview = document.getElementById('options-preview');

        const summaryRefs = {
            question: summaryCard.querySelector('[data-summary="question"]'),
            ideas: summaryCard.querySelector('[data-summary="ideas"]'),
            votes: summaryCard.querySelector('[data-summary="votes"]'),
            options: summaryCard.querySelector('[data-summary="options"]')
        };

        function gatherOptions() {
            if (!optionsTextarea) return [];
            return optionsTextarea.value
                .split('\n')
                .map(option => option.trim())
                .filter(option => option.length > 0);
        }

        function updateSummary() {
            if (summaryRefs.question) {
                const value = questionInput?.value.trim();
                summaryRefs.question.textContent = value ? value : '—';
            }

            if (summaryRefs.ideas) {
                if (ideasInput) {
                    summaryRefs.ideas.textContent = ideasInput.value || '1';
                } else {
                    summaryRefs.ideas.textContent = '—';
                }
            }

            if (summaryRefs.votes) {
                if (votesInput) {
                    summaryRefs.votes.textContent = votesInput.value || '1';
                } else {
                    summaryRefs.votes.textContent = '—';
                }
            }

            if (summaryRefs.options) {
                if (optionsTextarea) {
                    const options = gatherOptions();
                    summaryRefs.options.textContent = String(options.length);
                    renderOptionsPreview(optionsPreview, options);
                } else {
                    summaryRefs.options.textContent = '—';
                    renderOptionsPreview(optionsPreview, []);
                }
            }
        }

        configForm.oninput = updateSummary;
        updateSummary();
    }

    configForm.addEventListener('submit', event => {
        event.preventDefault();
        const formData = new FormData(configForm);
        const rawConfig = { type: currentActivityType, ...Object.fromEntries(formData.entries()) };
        rawConfig.pollOptions = rawConfig.pollOptions
            ? rawConfig.pollOptions.split('\n').map(opt => opt.trim()).filter(Boolean)
            : [];

        launchActivity('host', rawConfig);
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
        summaryCard.innerHTML = '<p class="info-callout">Error: no s\'ha especificat cap tipus d\'activitat.</p>';
    }
});
