(function () {
  function initHome() {
    const featured = document.getElementById("featured-books");
    const statBooks = document.getElementById("stat-books");
    if (!featured || !statBooks) return;

    const books = window.BibliotecaSol.getBooks();
    const stats = window.BibliotecaSol.getBookStats(books);
    document.getElementById("stat-books").textContent = stats.books;
    document.getElementById("stat-copies").textContent = stats.copies;
    document.getElementById("stat-available").textContent = stats.available;

    featured.innerHTML = "";
    books.slice(0, 3).forEach((book) => featured.appendChild(window.BibliotecaSol.createBookCard(book)));
  }

  function initCatalog() {
    const list = document.getElementById("catalog-list");
    const search = document.getElementById("catalog-search");
    const count = document.getElementById("catalog-count");
    const clearButton = document.getElementById("clear-filters");
    const pdfButton = document.getElementById("download-pdf");
    const sortField = document.getElementById("sort-field");
    const sortDirection = document.getElementById("sort-direction");
    const ageFilters = document.getElementById("age-filters");
    const topicFilters = document.getElementById("topic-filters");
    const genreFilters = document.getElementById("genre-filters");
    const availabilityFilters = document.getElementById("availability-filters");
    if (!list || !search || !count || !clearButton || !pdfButton || !sortField || !sortDirection || !ageFilters || !topicFilters || !genreFilters || !availabilityFilters) return;

    const params = new URLSearchParams(window.location.search);
    search.value = params.get("q") || "";
    let currentResults = [];

    populateFilterGroup(ageFilters, valuesFor("nivell_recomanat"), render);
    populateFilterGroup(topicFilters, valuesFor("tematica"), render);
    populateFilterGroup(genreFilters, valuesFor("genere"), render);
    availabilityFilters.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        toggleChip(button);
        render();
      });
    });
    clearButton.addEventListener("click", () => {
      search.value = "";
      document.querySelectorAll(".filter-chip[aria-pressed='true']").forEach((button) => button.setAttribute("aria-pressed", "false"));
      render();
    });
    pdfButton.addEventListener("click", () => {
      openPdfView(currentResults, buildFilterSummary(search, ageFilters, topicFilters, genreFilters, availabilityFilters));
    });
    sortField.addEventListener("change", render);
    sortDirection.addEventListener("click", () => {
      const nextDirection = sortDirection.dataset.direction === "asc" ? "desc" : "asc";
      sortDirection.dataset.direction = nextDirection;
      sortDirection.textContent = nextDirection === "asc" ? "Ascendent" : "Descendent";
      sortDirection.classList.toggle("icon-sort-asc", nextDirection === "asc");
      sortDirection.classList.toggle("icon-sort-desc", nextDirection === "desc");
      render();
    });

    function render() {
      const query = window.BibliotecaSol.normalize(search.value);
      const selectedAges = selectedValues(ageFilters);
      const selectedTopics = selectedValues(topicFilters);
      const selectedGenres = selectedValues(genreFilters);
      const selectedAvailability = selectedValues(availabilityFilters);

      const books = window.BibliotecaSol.getBooks().filter((book) => {
        const searchable = window.BibliotecaSol.normalize([
          book.titol,
          book.autor,
          book.editorial,
          book.isbn,
          book.nivell_recomanat,
          book.tematica,
          book.genere,
          book.resum,
          book.ubicacio
        ].join(" "));
        const available = Number(book.disponibles || 0) > 0;
        const availabilityValue = available ? "available" : "unavailable";

        return (
          (!query || searchable.includes(query)) &&
          matchesAny(selectedAges, book.nivell_recomanat) &&
          matchesAny(selectedTopics, book.tematica) &&
          matchesAny(selectedGenres, book.genere) &&
          (!selectedAvailability.length || selectedAvailability.includes(availabilityValue))
        );
      });
      sortBooks(books, sortField.value, sortDirection.dataset.direction || "asc");

      currentResults = books;
      count.textContent = `${books.length} ${books.length === 1 ? "llibre" : "llibres"}`;
      list.innerHTML = "";
      if (!books.length) {
        list.innerHTML = '<p class="empty-state">No hi ha cap llibre que coincideixi amb aquests filtres.</p>';
        return;
      }
      books.forEach((book) => list.appendChild(window.BibliotecaSol.createBookCard(book)));
    }

    search.addEventListener("input", render);
    render();
  }

  function valuesFor(field) {
    const fromBooks = window.BibliotecaSol.getBooks().map((book) => book[field]).filter(Boolean);
    const fromOptions = window.BibliotecaSol.getOptions(field);
    return uniqueSorted([...fromBooks, ...fromOptions]);
  }

  function populateFilterGroup(container, values, onChange) {
    container.innerHTML = "";
    values.forEach((value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip icon-filter";
      button.dataset.value = value;
      button.setAttribute("aria-pressed", "false");
      button.textContent = value;
      button.addEventListener("click", () => {
        toggleChip(button);
        onChange();
      });
      container.appendChild(button);
    });
  }

  function toggleChip(button) {
    button.setAttribute("aria-pressed", button.getAttribute("aria-pressed") === "true" ? "false" : "true");
  }

  function selectedValues(container) {
    return Array.from(container.querySelectorAll(".filter-chip[aria-pressed='true']")).map((button) => button.dataset.value);
  }

  function matchesAny(selected, value) {
    if (!selected.length) return true;
    const normalizedValue = window.BibliotecaSol.normalize(value);
    return selected.some((item) => window.BibliotecaSol.normalize(item) === normalizedValue);
  }

  function uniqueSorted(values) {
    const map = new Map();
    values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .forEach((value) => map.set(window.BibliotecaSol.normalize(value), value));
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "ca"));
  }

  function sortBooks(books, field, direction) {
    const multiplier = direction === "desc" ? -1 : 1;
    books.sort((a, b) => {
      const valueA = sortValue(a, field);
      const valueB = sortValue(b, field);

      if (typeof valueA === "number" && typeof valueB === "number") {
        return (valueA - valueB) * multiplier;
      }
      return String(valueA).localeCompare(String(valueB), "ca", { numeric: true, sensitivity: "base" }) * multiplier;
    });
  }

  function sortValue(book, field) {
    if (field === "disponibles") return Number(book.disponibles || 0);
    if (field === "any_publicacio") return Number(book.any_publicacio || 0);
    return book[field] || "";
  }

  function buildFilterSummary(search, ageFilters, topicFilters, genreFilters, availabilityFilters) {
    const parts = [];
    if (search.value.trim()) parts.push(`Cerca: ${search.value.trim()}`);
    addSelectedSummary(parts, "Edat", ageFilters);
    addSelectedSummary(parts, "Temàtica", topicFilters);
    addSelectedSummary(parts, "Gènere", genreFilters);
    addSelectedSummary(parts, "Disponibilitat", availabilityFilters);
    return parts.length ? parts.join(" · ") : "Sense filtres aplicats";
  }

  function addSelectedSummary(parts, label, container) {
    const values = selectedValues(container);
    if (values.length) parts.push(`${label}: ${values.join(", ")}`);
  }

  function openPdfView(books, filterSummary) {
    const popup = window.open("", "_blank");
    if (!popup) {
      alert("El navegador ha bloquejat la finestra del PDF. Permet finestres emergents per descarregar-lo.");
      return;
    }

    const rows = books.map((book) => {
      const available = Number(book.disponibles || 0);
      const total = Number(book.exemplars || 0);
      return `
        <tr>
          <td>
            <strong>${escapeHtml(book.titol)}</strong><br>
            <span>${escapeHtml(book.autor || "")}</span>
          </td>
          <td>${escapeHtml(book.nivell_recomanat || "")}</td>
          <td>${escapeHtml(book.tematica || "")}</td>
          <td>${escapeHtml(book.genere || "")}</td>
          <td>${escapeHtml(available > 0 ? `${available}/${total}` : "No disponible")}</td>
          <td>${escapeHtml(book.ubicacio || "")}</td>
        </tr>
      `;
    }).join("");

    popup.document.write(`
      <!doctype html>
      <html lang="ca">
        <head>
          <meta charset="utf-8">
          <title>Resultats del catàleg - Biblioteca de la Sol</title>
          <style>
            @page { margin: 14mm; }
            body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; font-size: 11pt; }
            header { margin-bottom: 16px; border-bottom: 2px solid #ffd166; padding-bottom: 10px; }
            h1 { margin: 0 0 4px; font-size: 20pt; }
            p { margin: 0; color: #667085; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; }
            th { text-align: left; font-size: 9pt; text-transform: uppercase; color: #475569; background: #f8fafc; }
            th, td { border: 1px solid #e5e7eb; padding: 7px 8px; vertical-align: top; }
            td strong { font-size: 11pt; }
            td span { color: #667085; }
            .empty { margin-top: 18px; padding: 12px; border: 1px dashed #d0d5dd; border-radius: 8px; }
          </style>
        </head>
        <body>
          <header>
            <h1>Biblioteca de la Sol</h1>
            <p>Resultats del catàleg · Escola Ramon Pont</p>
            <p>${escapeHtml(filterSummary)}</p>
          </header>
          ${books.length ? `
            <table>
              <thead>
                <tr>
                  <th>Llibre</th>
                  <th>Edat</th>
                  <th>Temàtica</th>
                  <th>Gènere</th>
                  <th>Disp.</th>
                  <th>Ubicació</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          ` : '<p class="empty">No hi ha cap llibre que coincideixi amb aquests filtres.</p>'}
          <script>
            window.addEventListener("load", () => {
              window.print();
            });
          <\/script>
        </body>
      </html>
    `);
    popup.document.close();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  document.addEventListener("DOMContentLoaded", () => {
    initHome();
    initCatalog();
  });
})();
