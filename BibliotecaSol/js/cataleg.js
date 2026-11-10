(function () {
  const VIEW_KEY = "bibliotecaSol.catalogView";
  const FACETS = [
    { field: "nivell_recomanat", label: "Edat" },
    { field: "genere", label: "Gènere" },
    { field: "llengua", label: "Llengua" },
    { field: "tematica", label: "Temàtica" }
  ];
  const FACET_LIMIT = 7;

  const app = () => window.BibliotecaSol;
  const esc = (value) => app().escapeHtml(value);

  /* ---------- Portada (index.html) ---------- */

  function initHome() {
    const statBooks = document.getElementById("stat-books");
    if (!statBooks) return;

    const books = app().getBooks();
    const stats = app().getBookStats(books);
    statBooks.textContent = stats.books;
    document.getElementById("stat-copies").textContent = stats.copies;
    document.getElementById("stat-available").textContent = stats.available;

    const searchForm = document.getElementById("home-search");
    if (searchForm) {
      searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const query = searchForm.elements.q.value.trim();
        window.location.href = `cataleg.html?mode=public${query ? `&q=${encodeURIComponent(query)}` : ""}`;
      });
    }

    const strip = document.getElementById("home-new");
    if (strip) {
      const latest = [...books]
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
        .slice(0, 10);
      strip.innerHTML = "";
      latest.forEach((book) => {
        const link = document.createElement("a");
        link.className = "new-book";
        link.href = `cataleg.html?mode=public&llibre=${encodeURIComponent(book.id)}`;
        link.title = `${book.titol} · ${book.autor}`;
        link.appendChild(app().createCover(book, "md"));
        const caption = document.createElement("span");
        caption.className = "new-book-title";
        caption.textContent = book.titol;
        link.appendChild(caption);
        strip.appendChild(link);
      });
      const section = strip.closest("[data-home-new]");
      if (section) section.hidden = !latest.length;
    }
  }

  /* ---------- Catàleg ---------- */

  function initCatalog() {
    const list = document.getElementById("catalog-list");
    const search = document.getElementById("catalog-search");
    // Si el navegador encara té una pàgina antiga desada, no s'intenta muntar el catàleg nou.
    if (!list || !search || !document.getElementById("facet-groups")) return;

    const params = new URLSearchParams(window.location.search);
    const session = app().getSession();
    const publicMode = params.get("mode") === "public" && !session;
    const canRequest = Boolean(session && !app().canManageCatalog(session));
    const isManager = app().canManageCatalog(session);

    const state = {
      query: params.get("q") || "",
      availableOnly: false,
      facets: Object.fromEntries(FACETS.map((facet) => [facet.field, new Set()])),
      expanded: new Set(),
      sort: "titol",
      view: readView(),
      results: [],
      selected: new Set()
    };

    const elements = {
      count: document.getElementById("catalog-count"),
      active: document.getElementById("active-filters"),
      facetGroups: document.getElementById("facet-groups"),
      availableOnly: document.getElementById("available-only"),
      clearFilters: document.getElementById("clear-filters"),
      sort: document.getElementById("sort-field"),
      filtersPanel: document.getElementById("catalog-filters"),
      openFilters: document.getElementById("open-filters"),
      closeFilters: document.getElementById("close-filters"),
      applyFilters: document.getElementById("apply-filters"),
      pdf: document.getElementById("download-pdf"),
      requestPanel: document.getElementById("request-panel"),
      requestSummary: document.getElementById("request-summary"),
      requestDetail: document.getElementById("request-detail"),
      clearSelection: document.getElementById("clear-selection"),
      sendRequest: document.getElementById("send-request")
    };

    if (publicMode) {
      document.body.classList.add("catalog-public-mode");
      document.querySelectorAll("[data-editor-only]").forEach((element) => {
        element.hidden = true;
      });
    }

    const intro = document.getElementById("catalog-intro");
    if (intro && canRequest) intro.textContent = "Tria els llibres que vols llegir i envia la sol·licitud a la biblioteca.";

    search.value = state.query;
    search.addEventListener("input", () => {
      state.query = search.value;
      render();
    });
    elements.availableOnly.addEventListener("change", () => {
      state.availableOnly = elements.availableOnly.checked;
      render();
    });
    elements.clearFilters.addEventListener("click", clearFilters);
    elements.sort.addEventListener("change", () => {
      state.sort = elements.sort.value;
      render();
    });
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = button.dataset.view;
        try {
          localStorage.setItem(VIEW_KEY, state.view);
        } catch (error) {
          /* sense memòria del navegador */
        }
        render();
      });
    });
    elements.openFilters.addEventListener("click", () => toggleFiltersPanel(true));
    elements.closeFilters.addEventListener("click", () => toggleFiltersPanel(false));
    elements.applyFilters.addEventListener("click", () => toggleFiltersPanel(false));
    elements.pdf.addEventListener("click", () => openPdfView(state.results, describeFilters()));

    if (canRequest) {
      elements.clearSelection.addEventListener("click", () => {
        state.selected.clear();
        render();
      });
      elements.sendRequest.addEventListener("click", sendRequest);
    }

    const detail = createDetailDialog();

    render();

    const requested = params.get("llibre");
    if (requested) {
      const book = app().getBooks().find((item) => item.id === requested);
      if (book) detail.open(book);
    }

    /* ----- Filtratge ----- */

    function matchesQuery(book) {
      const query = app().normalize(state.query);
      if (!query) return true;
      const searchable = app().normalize([
        book.titol, book.autor, book.editorial, book.isbn, book.coleccio,
        book.nivell_recomanat, book.tematica, book.genere, book.llengua, book.resum, book.ubicacio
      ].join(" "));
      return query.split(/\s+/).every((word) => searchable.includes(word));
    }

    function matchesFacets(book, skipField) {
      return FACETS.every(({ field }) => {
        if (field === skipField) return true;
        const selected = state.facets[field];
        return !selected.size || selected.has(String(book[field] || "").trim());
      });
    }

    function matchesAvailability(book) {
      return !state.availableOnly || Number(book.disponibles || 0) > 0;
    }

    function filteredBooks() {
      return app().getBooks().filter((book) => matchesQuery(book) && matchesAvailability(book) && matchesFacets(book));
    }

    function render() {
      const books = filteredBooks();
      sortBooks(books, state.sort);
      state.results = books;

      const status = app().getDataStatus();
      const total = app().getBooks().length;
      list.setAttribute("aria-busy", "false");

      if (!total) {
        elements.count.textContent = status.error ? "No s'ha pogut carregar el catàleg" : "Encara no hi ha llibres";
        list.className = "catalog-grid";
        list.innerHTML = status.error
          ? `<div class="empty-state"><p>No s'ha pogut connectar amb la base de dades de la biblioteca.</p><button class="button button-secondary" type="button" onclick="location.reload()">Tornar-ho a provar</button></div>`
          : '<p class="empty-state">Encara no hi ha cap llibre al catàleg.</p>';
        renderFacets();
        updateRequestPanel();
        return;
      }

      elements.count.textContent = books.length === total
        ? `${total} llibres`
        : `${books.length} de ${total} ${total === 1 ? "llibre" : "llibres"}`;
      renderFacets();
      renderActiveFilters();
      renderViewButtons();

      list.className = state.view === "list" ? `catalog-lines${canRequest ? " can-request" : ""}` : "catalog-grid";
      list.innerHTML = "";
      if (!books.length) {
        list.innerHTML = '<p class="empty-state">Cap llibre no coincideix amb aquesta cerca. Prova d\'esborrar algun filtre.</p>';
        updateRequestPanel();
        return;
      }

      if (state.view === "list") {
        const head = document.createElement("div");
        head.className = "book-line book-line-head";
        head.setAttribute("aria-hidden", "true");
        head.innerHTML = `<span></span><span>Llibre</span><span>Edat</span><span>Gènere</span><span>Llengua</span><span>Estat</span><span>Ubicació</span>${canRequest ? "<span></span>" : ""}`;
        list.appendChild(head);
      }

      const fragment = document.createDocumentFragment();
      books.forEach((book) => fragment.appendChild(state.view === "list" ? createLine(book) : createCard(book)));
      list.appendChild(fragment);
      updateRequestPanel();
    }

    /* ----- Facetes ----- */

    function renderFacets() {
      const base = app().getBooks().filter((book) => matchesQuery(book) && matchesAvailability(book));
      elements.facetGroups.innerHTML = "";

      FACETS.forEach(({ field, label }) => {
        const counts = new Map();
        base.filter((book) => matchesFacets(book, field)).forEach((book) => {
          const value = String(book[field] || "").trim();
          if (value) counts.set(value, (counts.get(value) || 0) + 1);
        });
        state.facets[field].forEach((value) => {
          if (!counts.has(value)) counts.set(value, 0);
        });

        let values = Array.from(counts.keys());
        values = field === "nivell_recomanat"
          ? app().sortOptions(field, values)
          : values.sort((a, b) => (counts.get(b) - counts.get(a)) || a.localeCompare(b, "ca"));
        if (!values.length) return;

        const group = document.createElement("fieldset");
        group.className = "facet";
        group.innerHTML = `<legend>${esc(label)}</legend>`;
        const options = document.createElement("div");
        options.className = "facet-options";
        const expanded = state.expanded.has(field);
        values.forEach((value, index) => {
          const selected = state.facets[field].has(value);
          const button = document.createElement("button");
          button.type = "button";
          button.className = "facet-chip";
          button.setAttribute("aria-pressed", String(selected));
          button.hidden = !expanded && index >= FACET_LIMIT && !selected;
          button.innerHTML = `<span>${esc(value)}</span><small>${counts.get(value)}</small>`;
          button.addEventListener("click", () => {
            if (selected) state.facets[field].delete(value);
            else state.facets[field].add(value);
            render();
          });
          options.appendChild(button);
        });
        group.appendChild(options);
        if (values.length > FACET_LIMIT) {
          const more = document.createElement("button");
          more.type = "button";
          more.className = "text-button";
          more.textContent = expanded ? "Mostra'n menys" : `Mostra'n ${values.length - FACET_LIMIT} més`;
          more.addEventListener("click", () => {
            if (expanded) state.expanded.delete(field);
            else state.expanded.add(field);
            renderFacets();
          });
          group.appendChild(more);
        }
        elements.facetGroups.appendChild(group);
      });

      const active = activeFilterCount();
      elements.clearFilters.hidden = !active;
      elements.openFilters.textContent = active ? `Filtres (${active})` : "Filtres";
      const shown = state.results.length;
      elements.applyFilters.textContent = shown === 1 ? "Veure 1 llibre" : `Veure ${shown} llibres`;
    }

    function activeFilterCount() {
      return FACETS.reduce((total, { field }) => total + state.facets[field].size, 0) + (state.availableOnly ? 1 : 0);
    }

    function renderActiveFilters() {
      elements.active.innerHTML = "";
      const pills = [];
      if (state.query.trim()) pills.push({ label: `«${state.query.trim()}»`, remove: () => { state.query = ""; search.value = ""; } });
      if (state.availableOnly) pills.push({ label: "Només disponibles", remove: () => { state.availableOnly = false; elements.availableOnly.checked = false; } });
      FACETS.forEach(({ field }) => {
        state.facets[field].forEach((value) => pills.push({ label: value, remove: () => state.facets[field].delete(value) }));
      });
      pills.forEach((pill) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "active-pill";
        button.innerHTML = `${esc(pill.label)}<span aria-hidden="true">×</span>`;
        button.setAttribute("aria-label", `Treure el filtre ${pill.label}`);
        button.addEventListener("click", () => {
          pill.remove();
          render();
        });
        elements.active.appendChild(button);
      });
    }

    function clearFilters() {
      FACETS.forEach(({ field }) => state.facets[field].clear());
      state.availableOnly = false;
      elements.availableOnly.checked = false;
      render();
    }

    function toggleFiltersPanel(open) {
      elements.filtersPanel.classList.toggle("open", open);
      document.body.classList.toggle("filters-open", open);
      elements.openFilters.setAttribute("aria-expanded", String(open));
      if (open) elements.closeFilters.focus();
    }

    function describeFilters() {
      const parts = [];
      if (state.query.trim()) parts.push(`Cerca: ${state.query.trim()}`);
      if (state.availableOnly) parts.push("Només disponibles");
      FACETS.forEach(({ field, label }) => {
        if (state.facets[field].size) parts.push(`${label}: ${Array.from(state.facets[field]).join(", ")}`);
      });
      return parts.length ? parts.join(" · ") : "Tot el catàleg";
    }

    function renderViewButtons() {
      document.querySelectorAll("[data-view]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
      });
    }

    /* ----- Targetes ----- */

    function availabilityInfo(book) {
      const available = Number(book.disponibles || 0);
      const total = Number(book.exemplars || 0);
      if (available > 0) {
        return { className: "is-available", short: total > 1 ? `${available}/${total}` : "Disponible", long: total > 1 ? `${available} de ${total} exemplars disponibles` : "Disponible" };
      }
      return { className: "is-out", short: "En préstec", long: total > 1 ? `Tots els exemplars (${total}) són en préstec` : "En préstec" };
    }

    function createCard(book) {
      const info = availabilityInfo(book);
      const card = document.createElement("article");
      card.className = "book-card";
      if (state.selected.has(book.id)) card.classList.add("is-selected");

      const open = document.createElement("button");
      open.type = "button";
      open.className = "book-open";
      open.setAttribute("aria-label", `${book.titol}, de ${book.autor}. ${info.long}. Obre la fitxa.`);
      const cover = app().createCover(book, "md");
      if (info.className === "is-out") {
        const badge = document.createElement("span");
        badge.className = "cover-badge is-out";
        badge.textContent = "En préstec";
        cover.appendChild(badge);
      }
      open.appendChild(cover);

      const meta = [book.nivell_recomanat, book.genere].filter(Boolean).join(" · ");
      const body = document.createElement("span");
      body.className = "book-card-body";
      body.innerHTML = `
        <strong class="book-card-title">${esc(book.titol)}</strong>
        <span class="book-card-author">${esc(book.autor)}</span>
        ${meta ? `<span class="book-card-meta">${esc(meta)}</span>` : ""}
      `;
      open.appendChild(body);
      open.addEventListener("click", () => detail.open(book));
      card.appendChild(open);

      if (canRequest) card.appendChild(createSelectButton(book));
      return card;
    }

    function createLine(book) {
      const info = availabilityInfo(book);
      const line = document.createElement("article");
      line.className = "book-line";
      if (state.selected.has(book.id)) line.classList.add("is-selected");
      const open = document.createElement("button");
      open.type = "button";
      open.className = "book-open";
      open.setAttribute("aria-label", `${book.titol}, de ${book.autor}. ${info.long}. Obre la fitxa.`);
      open.appendChild(app().createCover(book, "xs"));
      open.insertAdjacentHTML("beforeend", `
        <span class="line-title"><strong>${esc(book.titol)}</strong><small>${esc(book.autor)}</small></span>
        <span class="line-cell" data-label="Edat">${esc(book.nivell_recomanat || "—")}</span>
        <span class="line-cell" data-label="Gènere">${esc(book.genere || "—")}</span>
        <span class="line-cell" data-label="Llengua">${esc(book.llengua || "—")}</span>
        <span class="line-cell"><span class="status-badge ${info.className}">${esc(info.short)}</span></span>
        <span class="line-cell line-location">${esc(book.ubicacio || "—")}</span>
      `);
      open.addEventListener("click", () => detail.open(book));
      line.appendChild(open);
      if (canRequest) line.appendChild(createSelectButton(book));
      return line;
    }

    function createSelectButton(book) {
      const selected = state.selected.has(book.id);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `select-toggle ${selected ? "is-on" : ""}`;
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-label", `${selected ? "Treure" : "Triar"} «${book.titol}»`);
      button.textContent = selected ? "Triat" : "Triar";
      button.addEventListener("click", () => toggleSelected(book.id));
      return button;
    }

    function toggleSelected(bookId) {
      if (state.selected.has(bookId)) state.selected.delete(bookId);
      else state.selected.add(bookId);
      render();
    }

    /* ----- Sol·licitud ----- */

    function updateRequestPanel() {
      if (!elements.requestPanel) return;
      const count = state.selected.size;
      elements.requestPanel.hidden = !canRequest || !count;
      document.body.classList.toggle("has-request-bar", canRequest && count > 0);
      if (!canRequest) return;
      elements.requestSummary.textContent = count === 1 ? "1 llibre triat" : `${count} llibres triats`;
      const titles = app().getBooks().filter((book) => state.selected.has(book.id)).map((book) => book.titol);
      elements.requestDetail.textContent = titles.join(" · ");
    }

    async function sendRequest() {
      if (!state.selected.size) return;
      const current = app().getSession();
      if (!current) {
        app().openAccessDialog();
        return;
      }
      elements.sendRequest.disabled = true;
      const result = await app().reserveBooks(Array.from(state.selected), current.email);
      elements.sendRequest.disabled = false;
      if (result.type === "local") {
        window.location.href = mailtoForSelection();
        return;
      }
      (result.done || []).forEach((id) => state.selected.delete(id));
      app().showToast(result.message, result.ok && !(result.failed || []).length ? "success" : "error");
      render();
    }

    function mailtoForSelection() {
      const lines = app().getBooks().filter((book) => state.selected.has(book.id)).map((book) => `- ${book.titol} (${book.autor || "autor desconegut"})`);
      const body = ["Hola,", "", "Voldria sol·licitar aquests llibres:", "", ...lines, "", "Gràcies."].join("\n");
      return `mailto:biblioteca@ramonpont.cat?subject=${encodeURIComponent("Sol·licitud de llibres")}&body=${encodeURIComponent(body)}`;
    }

    /* ----- Fitxa de detall ----- */

    function createDetailDialog() {
      const dialog = document.createElement("dialog");
      dialog.className = "book-dialog";
      dialog.setAttribute("aria-labelledby", "book-dialog-title");
      document.body.appendChild(dialog);
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
      let current = null;

      function open(book) {
        current = book;
        const info = availabilityInfo(book);
        const facts = [
          ["Editorial", book.editorial],
          ["Col·lecció", [book.coleccio, book.numero_coleccio ? `núm. ${book.numero_coleccio}` : ""].filter(Boolean).join(", ")],
          ["Any", book.any_publicacio],
          ["Pàgines", Number(book.pagines) > 0 ? book.pagines : ""],
          ["Llengua", book.llengua],
          ["ISBN", book.isbn]
        ].filter(([, value]) => String(value || "").trim());
        const tags = [book.nivell_recomanat, book.genere, book.tematica].filter(Boolean);

        dialog.innerHTML = `
          <article class="book-detail">
            <button class="dialog-close icon-clear" type="button" aria-label="Tancar la fitxa"></button>
            <div class="book-detail-cover"></div>
            <div class="book-detail-body">
              <p class="book-detail-author">${esc(book.autor)}</p>
              <h2 id="book-dialog-title">${esc(book.titol)}</h2>
              ${tags.length ? `<div class="tag-row">${tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div>` : ""}
              <div class="detail-status ${info.className}">
                <span class="status-dot" aria-hidden="true"></span>
                <span><strong>${esc(info.long)}</strong>${book.ubicacio ? ` · ${esc(book.ubicacio)}` : ""}</span>
              </div>
              ${book.resum
                ? `<p class="book-detail-summary">${esc(book.resum)}</p>`
                : '<p class="book-detail-summary muted">Aquest llibre encara no té resum.</p>'}
              ${facts.length ? `<dl class="fact-list">${facts.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>` : ""}
              <div class="book-detail-actions"></div>
            </div>
          </article>
        `;
        dialog.querySelector(".book-detail-cover").appendChild(app().createCover(book, "lg"));
        dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
        renderActions(book, info);
        if (!dialog.open) dialog.showModal();
        dialog.querySelector(".dialog-close").focus();
      }

      function renderActions(book, info) {
        const actions = dialog.querySelector(".book-detail-actions");
        actions.innerHTML = "";
        if (canRequest) {
          const selected = state.selected.has(book.id);
          const button = document.createElement("button");
          button.type = "button";
          button.className = `button ${selected ? "button-secondary icon-clear" : "icon-add"}`;
          button.textContent = selected ? "Treure de la sol·licitud" : "Afegir a la sol·licitud";
          button.addEventListener("click", () => {
            toggleSelected(book.id);
            renderActions(book, info);
          });
          actions.appendChild(button);
          if (info.className === "is-out") {
            actions.insertAdjacentHTML("beforeend", '<p class="detail-note">Ara és en préstec. Si el demanes, la biblioteca te\'l guardarà quan torni.</p>');
          }
        } else if (isManager) {
          actions.innerHTML = `<a class="button button-secondary icon-edit" href="editor.html?editar=${encodeURIComponent(book.id)}">Editar la fitxa</a>`;
        } else if (publicMode) {
          actions.innerHTML = '<a class="button icon-login" href="index.html">Entra amb el correu del centre per demanar-lo</a>';
        } else {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "button icon-login";
          button.textContent = "Entra per demanar-lo";
          button.addEventListener("click", () => {
            dialog.close();
            app().openAccessDialog();
          });
          actions.appendChild(button);
        }
      }

      return { open, get current() { return current; } };
    }
  }

  function readView() {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "grid" || saved === "list") return saved;
    } catch (error) {
      /* sense memòria del navegador */
    }
    return "grid";
  }

  function sortBooks(books, field) {
    const text = (value) => String(value || "");
    const compare = (a, b) => text(a).localeCompare(text(b), "ca", { numeric: true, sensitivity: "base" });
    books.sort((a, b) => {
      switch (field) {
        case "autor":
          return compare(a.autor, b.autor) || compare(a.titol, b.titol);
        case "nivell_recomanat":
          return (app().ageRank(a.nivell_recomanat) - app().ageRank(b.nivell_recomanat)) || compare(a.titol, b.titol);
        case "recents":
          return compare(b.created_at, a.created_at) || compare(a.titol, b.titol);
        case "any_publicacio":
          return (Number(b.any_publicacio || 0) - Number(a.any_publicacio || 0)) || compare(a.titol, b.titol);
        case "disponibles":
          return (Number(b.disponibles > 0) - Number(a.disponibles > 0)) || compare(a.titol, b.titol);
        default:
          return compare(a.titol, b.titol);
      }
    });
  }

  function escapeHtml(value) {
    return window.BibliotecaSol.escapeHtml(value);
  }

  function openPdfView(books, filterSummary) {
    const popup = window.open("", "_blank");
    if (!popup) {
      window.BibliotecaSol.showToast("El navegador ha bloquejat la finestra del PDF. Permet les finestres emergents d'aquesta pàgina.", "error");
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
          <td>${escapeHtml(book.genere || "")}</td>
          <td>${escapeHtml(book.llengua || "")}</td>
          <td>${escapeHtml(available > 0 ? `${available}/${total}` : "En préstec")}</td>
          <td>${escapeHtml(book.ubicacio || "")}</td>
        </tr>
      `;
    }).join("");

    popup.document.write(`
      <!doctype html>
      <html lang="ca">
        <head>
          <meta charset="utf-8">
          <title>Catàleg - Biblioteca de la Sol</title>
          <style>
            @page { margin: 14mm; }
            body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; color: #1f2937; font-size: 10.5pt; }
            header { margin-bottom: 14px; border-bottom: 2px solid #ffd166; padding-bottom: 10px; }
            h1 { margin: 0 0 4px; font-size: 18pt; }
            p { margin: 0; color: #667085; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .04em; color: #475569; background: #f8fafc; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 6px 8px; vertical-align: top; }
            tr { break-inside: avoid; }
            td span { color: #667085; }
            .empty { margin-top: 18px; padding: 12px; border: 1px dashed #d0d5dd; border-radius: 8px; }
          </style>
        </head>
        <body>
          <header>
            <h1>Biblioteca de la Sol</h1>
            <p>Escola Ramon Pont · ${escapeHtml(new Intl.DateTimeFormat("ca-ES", { dateStyle: "long" }).format(new Date()))}</p>
            <p>${escapeHtml(filterSummary)} · ${books.length} llibres</p>
          </header>
          ${books.length ? `
            <table>
              <thead>
                <tr><th>Llibre</th><th>Edat</th><th>Gènere</th><th>Llengua</th><th>Disp.</th><th>Ubicació</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          ` : '<p class="empty">Cap llibre no coincideix amb aquests filtres.</p>'}
          <script>
            window.addEventListener("load", () => window.print());
          <\/script>
        </body>
      </html>
    `);
    popup.document.close();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await window.BibliotecaSol.ready;
    initHome();
    initCatalog();
  });
})();
