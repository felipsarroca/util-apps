document.addEventListener('DOMContentLoaded', () => {
    const apps = [
        {
            name: 'Dashboard d'incidències',
            path: 'DashboardIncidencies/',
            description: 'Visualitzador de dades d'incidències del centre educatiu.',
            category: 'Eines de gestió'
        },
        {
            name: 'Rentabilitat Híbrid',
            path: 'RentabilitatHibrid/',
            description: 'Calculadora per comparar el cost entre combustible i electricitat.',
            category: 'Finances i càlculs'
        },
        {
            name: 'Tiquets Bon Preu',
            path: 'TicketsBonPreu/',
            description: 'Analitzador de tiquets de compra per OCR per gestionar despeses.',
            category: 'Finances i càlculs'
        }
    ];

    const appContainer = document.getElementById('apps-container');

    if (appContainer) {
        const categories = [...new Set(apps.map(app => app.category))];

        categories.forEach(category => {
            const categorySection = document.createElement('section');
            categorySection.className = 'mb-5';

            const categoryTitle = document.createElement('h2');
            categoryTitle.className = 'category-title';
            categoryTitle.textContent = category;
            categorySection.appendChild(categoryTitle);

            const grid = document.createElement('div');
            grid.className = 'row row-cols-1 row-cols-sm-2 row-cols-md-3 g-4';

            const appsInCategory = apps.filter(app => app.category === category);

            appsInCategory.forEach(app => {
                const col = document.createElement('div');
                col.className = 'col';
                const cardHTML = `
                    <a href="${app.path}" class="card-link">
                        <div class="card h-100">
                            <img src="${app.path}favicon.svg" class="card-img-top" alt="Icona de ${app.name}">
                            <div class="card-body">
                                <h5 class="card-title">${app.name}</h5>
                                <p class="card-text">${app.description}</p>
                            </div>
                        </div>
                    </a>
                `;
                col.innerHTML = cardHTML;
                grid.appendChild(col);
            });

            categorySection.appendChild(grid);
            appContainer.appendChild(categorySection);
        });
    }
});
