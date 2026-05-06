(function () {
  function initHome() {
    const statBooks = document.getElementById("stat-books");
    if (!statBooks) return;

    const books = window.BibliotecaSol.getBooks();
    const stats = window.BibliotecaSol.getBookStats(books);
    document.getElementById("stat-books").textContent = stats.books;
    document.getElementById("stat-copies").textContent = stats.copies;
    document.getElementById("stat-available").textContent = stats.available;
  }

  function initCatalog() {
    const list = document.getElementById("catalog-list");
    const search = document.getElementById("catalog-search");
    const count = document.getElementById("catalog-count");
    const clearButton = document.getElementById("clear-filters");
    const pdfButton = document.getElementById("download-pdf");
    const toggleFilters = document.getElementById("toggle-filters");
    const advancedFilters = document.getElementById("advanced-filters");
    const sortField = document.getElementById("sort-field");
    const sortDirection = document.getElementById("sort-direction");
    const ageFilter = document.getElementById("age-filter");
    const topicFilter = document.getElementById("topic-filter");
    const genreFilter = document.getElementById("genre-filter");
    const availabilityFilter = document.getElementById("availability-filter");
    const requestPanel = document.getElementById("request-panel");
    const requestSummary = document.getElementById("request-summary");
    const clearSelection = document.getElementById("clear-selection");
    const sendRequest = document.getElementById("send-request");
    if (!list || !search || !count || !clearButton || !pdfButton || !toggleFilters || !advancedFilters || !sortField || !sortDirection || !ageFilter || !topicFilter || !genreFilter || !availabilityFilter) return;

    const params = new URLSearchParams(window.location.search);
    const session = window.BibliotecaSol.getSession();
    const publicMode = params.get("mode") === "public" && !session;
    search.value = params.get("q") || "";
    let currentResults = [];
    const selectedBooks = new Set();
    const canRequestBooks = Boolean(session && !window.BibliotecaSol.canManageCatalog(session));

    if (publicMode) {
      document.body.classList.add("catalog-public-mode");
      document.querySelectorAll(".main-nav a[href='login.html'], [data-editor-only]").forEach((element) => {
        element.hidden = true;
      });
    }

    populateSelect(ageFilter, valuesFor("nivell_recomanat"));
    populateSelect(topicFilter, valuesFor("tematica"));
    populateSelect(genreFilter, valuesFor("genere"));

    clearButton.addEventListener("click", () => {
      search.value = "";
      ageFilter.value = "";
      topicFilter.value = "";
      genreFilter.value = "";
      availabilityFilter.value = "";
      render();
    });
    toggleFilters.addEventListener("click", () => {
      const expanded = toggleFilters.getAttribute("aria-expanded") === "true";
      toggleFilters.setAttribute("aria-expanded", String(!expanded));
      advancedFilters.hidden = expanded;
    });
    pdfButton.addEventListener("click", () => {
      openPdfView(currentResults, buildFilterSummary(search, ageFilter, topicFilter, genreFilter, availabilityFilter));
    });
    if (requestPanel) requestPanel.hidden = !canRequestBooks;
    if (clearSelection) {
      clearSelection.addEventListener("click", () => {
        selectedBooks.clear();
        render();
      });
    }
    if (sendRequest) {
      sendRequest.addEventListener("click", async (event) => {
        if (!selectedBooks.size) return;
        const session = window.BibliotecaSol.getSession();
        if (!session) {
          event.preventDefault();
          window.BibliotecaSol.openAccessDialog();
          return;
        }

        event.preventDefault();
        const result = await window.BibliotecaSol.reserveBooks(Array.from(selectedBooks), session.email);
        if (result.type === "local") {
          window.location.href = sendRequest.href;
          return;
        }
        if (requestSummary) requestSummary.textContent = result.message;
        if (result.ok) {
          selectedBooks.clear();
          render();
        }
      });
    }
    search.addEventListener("input", render);
    ageFilter.addEventListener("change", render);
    topicFilter.addEventListener("change", render);
    genreFilter.addEventListener("change", render);
    availabilityFilter.addEventListener("change", render);
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
      const selectedAge = ageFilter.value;
      const selectedTopic = topicFilter.value;
      const selectedGenre = genreFilter.value;
      const selectedAvailability = availabilityFilter.value;

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
          matchesValue(selectedAge, book.nivell_recomanat) &&
          matchesValue(selectedTopic, book.tematica) &&
          matchesValue(selectedGenre, book.genere) &&
          (!selectedAvailability || selectedAvailability === availabilityValue)
        );
      });
      sortBooks(books, sortField.value, sortDirection.dataset.direction || "asc");

      currentResults = books;
      count.textContent = `${books.length} ${books.length === 1 ? "llibre" : "llibres"}`;
      list.innerHTML = "";
      if (!books.length) {
        list.innerHTML = '<p class="empty-state">No hi ha cap llibre que coincideixi amb aquests filtres.</p>';
        updateRequestPanel();
        return;
      }
      books.forEach((book) => list.appendChild(createCatalogCard(book, canRequestBooks, selectedBooks.has(book.id))));
      updateRequestPanel();
    }

    function createCatalogCard(book, canRequest, selected) {
      const card = window.BibliotecaSol.createBookCard(book);
      if (!canRequest) return card;

      const action = document.createElement("div");
      action.className = "book-select-action";
      action.innerHTML = `
        <button class="link-button compact-select ${selected ? "button-selected icon-save" : "icon-add"}" type="button" aria-pressed="${selected ? "true" : "false"}">
          ${selected ? "Triat" : "Triar"}
        </button>
      `;
      action.querySelector("button").addEventListener("click", () => {
        if (selectedBooks.has(book.id)) {
          selectedBooks.delete(book.id);
        } else {
          selectedBooks.add(book.id);
        }
        render();
      });
      card.appendChild(action);
      return card;
    }

    function updateRequestPanel() {
      if (!requestPanel || !requestSummary || !sendRequest) return;
      if (!canRequestBooks) {
        requestPanel.hidden = true;
        return;
      }

      const selected = window.BibliotecaSol.getBooks().filter((book) => selectedBooks.has(book.id));
      requestSummary.textContent = selected.length
        ? `${selected.length} ${selected.length === 1 ? "llibre seleccionat" : "llibres seleccionats"}`
        : "No has seleccionat cap llibre.";
      const lines = selected.map((book) => `- ${book.titol} (${book.autor || "autor pendent"})`);
      const body = [
        "Hola,",
        "",
        "Voldria sol·licitar aquests llibres:",
        "",
        ...lines,
        "",
        "Gràcies."
      ].join("\n");
      sendRequest.href = selected.length
        ? `mailto:biblioteca@ramonpont.cat?subject=Reserva%20de%20llibres&body=${encodeURIComponent(body)}`
        : "mailto:biblioteca@ramonpont.cat?subject=Reserva%20de%20llibres";
      sendRequest.toggleAttribute("aria-disabled", !selected.length);
      sendRequest.classList.toggle("button-disabled", !selected.length);
    }

    render();
  }

  function valuesFor(field) {
    const fromBooks = window.BibliotecaSol.getBooks().map((book) => book[field]).filter(Boolean);
    const fromOptions = window.BibliotecaSol.getOptions(field);
    return uniqueSorted([...fromBooks, ...fromOptions]);
  }

  function populateSelect(select, values) {
    const firstOption = select.querySelector("option");
    select.innerHTML = "";
    if (firstOption) select.appendChild(firstOption);
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function matchesValue(selected, value) {
    if (!selected) return true;
    return window.BibliotecaSol.normalize(selected) === window.BibliotecaSol.normalize(value);
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

  function buildFilterSummary(search, ageFilter, topicFilter, genreFilter, availabilityFilter) {
    const parts = [];
    if (search.value.trim()) parts.push(`Cerca: ${search.value.trim()}`);
    addSelectSummary(parts, "Edat", ageFilter);
    addSelectSummary(parts, "Temàtica", topicFilter);
    addSelectSummary(parts, "Gènere", genreFilter);
    addSelectSummary(parts, "Disponibilitat", availabilityFilter);
    return parts.length ? parts.join(" · ") : "Sense filtres aplicats";
  }

  function addSelectSummary(parts, label, select) {
    if (select.value) parts.push(`${label}: ${select.options[select.selectedIndex].textContent}`);
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

  document.addEventListener("DOMContentLoaded", async () => {
    await window.BibliotecaSol.ready;
    initHome();
    initCatalog();
  });
})();
