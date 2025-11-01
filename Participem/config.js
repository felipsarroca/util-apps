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
        'brainstorm-poll': 'Configura la pluja d\'idees i la votació',
        stars: 'Configura la puntuació amb estrelles'
    };

    const generateSessionId = (length = 4) => {
        let id = '';
        while (id.length < length) {
            id += Math.random().toString(36).slice(2).toUpperCase();
        }
        return id.slice(0, length);
    };

    const buildActions = () => {
        const button = document.createElement('button');
        button.type = 'submit';
        button.className = 'launch-button';
        button.innerHTML = '<i class="fa-solid fa-rocket"></i> Crear activitat';

        const container = document.createElement('div');
        container.className = 'button-container';
        container.appendChild(button);

        return container;
    };

    const buildStandardLayout = (type) => {
        const cards = [];

        cards.push(`
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
            const hasDouble = extras.length > 1;
            const cardClasses = ['config-card', 'compact-card'];
            if (hasDouble) cardClasses.push('compact-card-double');

            cards.push(`
                <div class="${cardClasses.join(' ')}">
                    <div class="field-row">
                        ${extras.join('')}
                    </div>
                </div>
            `);
        }

        primaryColumn.innerHTML = cards.join('');

        if (type === 'poll') {
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
        } else {
            secondaryColumn.innerHTML = '';
            secondaryColumn.classList.add('hidden-column');
            primaryColumn.classList.add('full-width');
        }

        configActions.innerHTML = '';
        const actionContainer = buildActions();
        const compactCard = primaryColumn.querySelector('.compact-card');

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
    };

    const initializeStarsCategoryEditor = () => {
        const categoryList = document.getElementById('stars-category-list');
        const addCategoryBtn = document.getElementById('add-category-btn');
        if (!categoryList || !addCategoryBtn) return;
        let counter = 0;

        const ordinalLabel = (index) => {
            const ordinals = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª'];
            return ordinals[index] || `${index + 1}ª`;
        };

        const refreshHeaders = () => {
            const categories = categoryList.querySelectorAll('.stars-category');
            categories.forEach((category, index) => {
                const title = category.querySelector('.stars-category-title');
                if (title) title.textContent = `Nom de la ${ordinalLabel(index)} categoria`;

                const removeBtn = category.querySelector('.remove-category-btn');
                if (removeBtn) removeBtn.disabled = categories.length <= 3 || index < 3;
            });
        };

        const createCategory = (prefill = {}) => {
            const wrapper = document.createElement('section');
            wrapper.className = 'stars-category';
            wrapper.dataset.index = String(counter++);

            const header = document.createElement('div');
            header.className = 'stars-category-header';

            const title = document.createElement('span');
            title.className = 'stars-category-title';
            header.appendChild(title);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-category-btn';
            removeBtn.setAttribute('aria-label', 'Elimina la categoria');
            removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            header.appendChild(removeBtn);

            const nameGroup = document.createElement('div');
            nameGroup.className = 'field-group stars-name-group';
            const nameLabel = document.createElement('label');
            nameLabel.className = 'sr-only';
            nameLabel.textContent = 'Nom de la categoria';
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'category-name';
            nameInput.placeholder = 'Escriu el nom aquí';
            if (prefill.name) nameInput.value = prefill.name;
            nameGroup.appendChild(nameLabel);
            nameGroup.appendChild(nameInput);

            const itemsGroup = document.createElement('div');
            itemsGroup.className = 'field-group stars-items-group';
            const itemsLabel = document.createElement('label');
            itemsLabel.textContent = 'Ítems (un per línia)';
            const itemsTextarea = document.createElement('textarea');
            itemsTextarea.className = 'category-items';
            itemsTextarea.rows = 5;
            const defaultItems = ['Claredat de la veu', 'Contacte visual', 'Fluïdesa'];
            itemsTextarea.placeholder = defaultItems.join('\n');
            if (Array.isArray(prefill.items)) {
                itemsTextarea.value = prefill.items.join('\n');
            } else if (typeof prefill.items === 'string') {
                itemsTextarea.value = prefill.items;
            }
            if (itemsTextarea.value) {
                const lineCount = itemsTextarea.value.split('\n').length;
                itemsTextarea.rows = Math.max(5, lineCount);
            }
            itemsGroup.appendChild(itemsLabel);
            itemsGroup.appendChild(itemsTextarea);

            wrapper.appendChild(header);
            wrapper.appendChild(nameGroup);
            wrapper.appendChild(itemsGroup);

            categoryList.appendChild(wrapper);
            refreshHeaders();
        };

        addCategoryBtn.addEventListener('click', () => createCategory());

        categoryList.addEventListener('click', event => {
            const button = event.target.closest('.remove-category-btn');
            if (!button) return;
            const category = button.closest('.stars-category');
            if (!category) return;
            const index = parseInt(category.dataset.index, 10);
            if (!Number.isFinite(index)) return;
            if ((categoryList.children.length <= 3) || index < 3) return;
            category.remove();
            refreshHeaders();
        });

        for (let i = 0; i < 3; i += 1) {
            createCategory();
        }
    };


    const buildStarsLayout = () => {
        primaryColumn.innerHTML = '';
        primaryColumn.classList.add('full-width');
        secondaryColumn.innerHTML = '';
        secondaryColumn.classList.add('hidden-column');

        const layoutGrid = document.createElement('div');
        layoutGrid.className = 'stars-layout-grid';

        const mainColumn = document.createElement('div');
        mainColumn.className = 'stars-layout-main';

        const summaryGrid = document.createElement('div');
        summaryGrid.className = 'stars-summary-grid';
        summaryGrid.innerHTML = [
            '<div class="config-card compact-card stars-primary-card">',
            '    <div class="field-group">',
            '        <label for="question">Nom de l\'activitat</label>',
            '        <input type="text" id="question" name="question" placeholder="Valoració amb estrelles" required>',
            '    </div>',
            '</div>',
            '<div class="config-card compact-card stars-range-card">',
            '    <div class="stars-range-heading">',
            '        <h3>Puntuacions</h3>',
            '    </div>',
            '    <div class="field-row stars-range-row">',
            '        <div class="field-group">',
            '            <label for="min-score">Mínima</label>',
            '            <input type="number" id="min-score" name="minScore" value="1" min="0" step="1" required>',
            '        </div>',
            '        <div class="field-group">',
            '            <label for="max-score">Màxima</label>',
            '            <input type="number" id="max-score" name="maxScore" value="5" min="1" step="1" required>',
            '        </div>',
            '    </div>',
            '</div>'
        ].join('');
        mainColumn.appendChild(summaryGrid);

        const actionsWrapper = document.createElement('div');
        actionsWrapper.className = 'stars-actions';
        actionsWrapper.appendChild(buildActions());
        mainColumn.appendChild(actionsWrapper);

        const categoriesWrapper = document.createElement('div');
        categoriesWrapper.className = 'stars-categories-wrapper';
        categoriesWrapper.innerHTML = [
            '<div id="stars-category-list" class="stars-category-list"></div>',
            '<button type="button" id="add-category-btn" class="add-category-btn">',
            '    <i class="fa-solid fa-plus"></i> Afegir categoria',
            '</button>'
        ].join('');

        layoutGrid.appendChild(mainColumn);
        layoutGrid.appendChild(categoriesWrapper);
        primaryColumn.appendChild(layoutGrid);

        configActions.innerHTML = '';
        configActions.classList.remove('align-start');

        initializeStarsCategoryEditor();
    };

    const collectStarsConfig = () => {
        const questionInput = document.getElementById('question');
        const minScoreInput = document.getElementById('min-score');
        const maxScoreInput = document.getElementById('max-score');
        const categoryList = document.getElementById('stars-category-list');

        const minScore = parseInt(minScoreInput.value, 10);
        const maxScore = parseInt(maxScoreInput.value, 10);

        if (!Number.isFinite(minScore) || !Number.isFinite(maxScore) || minScore < 0 || maxScore <= minScore) {
            alert('Revisa els valors de la puntuació mínima i màxima.');
            minScoreInput.focus();
            return null;
        }

        const rawCategories = Array.from(categoryList.querySelectorAll('.stars-category')).map(category => {
            const nameInput = category.querySelector('.category-name');
            const itemsInput = category.querySelector('.category-items');
            const name = nameInput.value.trim();
            const rawItems = itemsInput.value.split('\n').map(line => line.trim());
            const items = rawItems.filter(Boolean);
            return { name, items, nameInput, itemsInput, rawItems };
        });

        const filledCategories = rawCategories.filter(({ name, rawItems }) => name || rawItems.some(Boolean));

        if (!filledCategories.length) {
            alert('Omple com a mínim una categoria amb nom i ítems.');
            return null;
        }

        for (const { name, items, nameInput, itemsInput } of filledCategories) {
            if (!name) {
                alert('Introdueix un nom per a cada categoria amb contingut.');
                nameInput.focus();
                return null;
            }
            if (!items.length) {
                alert(`La categoria "${name}" necessita com a mínim un ítem.`);
                itemsInput.focus();
                return null;
            }
        }

        return {
            type: 'stars',
            question: questionInput.value.trim(),
            minScore,
            maxScore,
            categories: filledCategories.map(({ name, items }) => ({ name, items }))
        };
    };

    const setupLayout = (type) => {
        configTitle.textContent = titles[type] || 'Configurar activitat';
        document.body.classList.remove('type-poll', 'type-brainstorm', 'type-brainstorm-poll', 'type-stars');
        document.body.classList.add(`type-${type}`);
        configActions.classList.remove('align-start');
        if (type === 'stars') {
            buildStarsLayout();
        } else {
            buildStandardLayout(type);
        }
    };

    configForm.addEventListener('submit', event => {
        event.preventDefault();

        let config;
        if (activityType === 'stars') {
            config = collectStarsConfig();
            if (!config) return;
        } else {
            const formData = new FormData(configForm);
            config = Object.fromEntries(formData.entries());
            config.type = activityType;
            config.pollOptions = config.pollOptions
                ? config.pollOptions.split('\n').map(opt => opt.trim()).filter(Boolean)
                : [];
        }

        launchActivity('host', config);
    });

    const launchActivity = (mode, config) => {
        const sessionId = generateSessionId();
        let url = `activity.html?session=${sessionId}&mode=${mode}`;
        const encodedConfig = encodeURIComponent(JSON.stringify(config));
        url += `&config=${encodedConfig}`;
        window.location.href = url;
    };

    setupLayout(activityType);
});
