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

    const mainContainer = document.getElementById('apps-container');
    if (!mainContainer) return;

    // Agrupa les aplicacions per categoria
    const appsByCategory = apps.reduce((acc, app) => {
        if (!acc[app.category]) {
            acc[app.category] = [];
        }
        acc[app.category].push(app);
        return acc;
    }, {});

    // Ordena les categories alfabèticament
    const sortedCategories = Object.keys(appsByCategory).sort((a, b) => a.localeCompare(b));

    // Genera l'HTML per a cada categoria
    sortedCategories.forEach(category => {
        const section = document.createElement('section');
        section.className = 'category-section mb-5';

        const categoryTitle = document.createElement('h2');
        categoryTitle.className = 'category-title';
        categoryTitle.textContent = category;
        section.appendChild(categoryTitle);

        const grid = document.createElement('div');
        grid.className = 'row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4';

        appsByCategory[category].forEach(app => {
            const col = document.createElement('div');
            col.className = 'col d-flex';
            
            const faviconSrc = `${app.path}favicon.svg`;
            const fallbackIcon = `https://via.placeholder.com/64/005a9c/ffffff?text=${app.name.charAt(0)}`;

            col.innerHTML = `
                <a href="${app.path}" class="card-link" target="_blank" rel="noopener noreferrer">
                    <div class="card h-100">
                        <img src="${faviconSrc}" class="card-img-top" alt="Icona de ${app.name}" onerror="this.onerror=null;this.src='${fallbackIcon}';">
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title">${app.name}</h5>
                            <p class="card-text flex-grow-1">${app.description}</p>
                        </div>
                    </div>
                </a>
            `;
            grid.appendChild(col);
        });

        section.appendChild(grid);
        mainContainer.appendChild(section);
    });
});
