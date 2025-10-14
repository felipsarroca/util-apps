document.addEventListener('DOMContentLoaded', () => {
    const apps = [
        {
            name: "Dashboard d'incidències",
            path: 'DashboardIncidencies/',
            description: "Visualitzador de dades d'incidències del centre educatiu.",
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

    const appsGrid = document.getElementById('apps-grid');

    if (appsGrid) {
        const categories = [...new Set(apps.map(app => app.category))];

        categories.forEach(category => {
            // Afegeix el títol de la categoria
            const categoryTitle = document.createElement('div');
            categoryTitle.className = 'col-12';
            categoryTitle.innerHTML = `<h2 class="category-title">${category}</h2>`;
            appsGrid.appendChild(categoryTitle);

            // Filtra i afegeix les apps de la categoria
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
                appsGrid.appendChild(col);
            });
        });
    }
});
