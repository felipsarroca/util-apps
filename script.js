document.addEventListener('DOMContentLoaded', () => {
    const apps = [
        {
            name: "Dashboard d'incidències",
            path: 'DashboardIncidencies/',
            description: "Visualitzador de dades d'incidències del centre educatiu.",
            category: 'Eines de gestió'
        },
        {
            name: 'Participem',
            path: 'Participem/',
            description: "Eina per gestionar la participació de l'alumnat a classe.",
            category: 'Eines de gestió'
        },
        {
            name: 'Polo App',
            path: 'acces-polo.html',
            icon: 'Polo-App/assets/favicon.svg',
            description: "Registre ràpid del polo de l'alumnat i consulta de resums bàsics.",
            category: 'Eines de gestió'
        },
        {
            name: "Gestió d'equips informàtics",
            path: 'https://ja.cat/gestioequips',
            icon: 'Gestio-Equips/favicon.svg',
            description: "Gestió i consulta d'equips informàtics del centre.",
            category: 'Eines de gestió'
        },
        {
            name: 'DescarregApp',
            path: 'https://ja.cat/descarregapp',
            icon: 'DescarregApp/assets/favicon.svg',
            description: "Aplicació d'escriptori per descarregar vídeo o àudio en local.",
            category: "Eines d'escriptori"
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

    const appsByCategory = apps.reduce((acc, app) => {
        if (!acc[app.category]) {
            acc[app.category] = [];
        }
        acc[app.category].push(app);
        return acc;
    }, {});

    const sortedCategories = Object.keys(appsByCategory).sort((a, b) => a.localeCompare(b));

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

            const faviconSrc = app.icon || `${app.path}favicon.svg`;
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
