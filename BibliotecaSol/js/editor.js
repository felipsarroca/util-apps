(function () {
  let currentQuery = "";
  let circulation = {
    reservations: [],
    loans: [],
    returns: []
  };

  function initEditor() {
    const gate = document.getElementById("editor-gate");
    const app = document.getElementById("editor-app");
    const form = document.getElementById("book-form");
    const resetButton = document.getElementById("reset-form");
    const search = document.getElementById("editor-search");
    if (!gate || !app || !form || !resetButton || !search) return;

    const session = window.BibliotecaSol.getSession();
    const canEdit = window.BibliotecaSol.canManageCatalog(session);
    gate.hidden = canEdit;
    app.hidden = !canEdit;
    if (!canEdit) {
      window.location.replace("login.html#gestor");
      return;
    }

    populateOptionLists();
    initManagerTabs();
    form.addEventListener("submit", handleSave);
    resetButton.addEventListener("click", resetForm);
    search.addEventListener("input", () => {
      currentQuery = window.BibliotecaSol.normalize(search.value);
      renderEditorList();
    });
    renderEditorList();
    loadCirculation();
  }

  function initManagerTabs() {
    document.querySelectorAll("[data-manager-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.managerTab;
        document.querySelectorAll("[data-manager-tab]").forEach((item) => {
          item.setAttribute("aria-selected", String(item === tab));
        });
        document.querySelectorAll("[data-manager-view]").forEach((view) => {
          view.hidden = view.dataset.managerView !== target;
        });
      });
    });

    document.querySelectorAll("[data-refresh-circulation]").forEach((button) => {
      button.addEventListener("click", loadCirculation);
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!requireManager()) return;

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const books = window.BibliotecaSol.getBooks();
    const exemplars = Math.max(1, Number(data.exemplars || 1));
    const disponibles = Math.min(exemplars, Math.max(0, Number(data.disponibles || 0)));
    const existingIndex = books.findIndex((book) => book.id === data.id);
    const existing = existingIndex >= 0 ? books[existingIndex] : null;
    const session = window.BibliotecaSol.getSession();

    const book = {
      id: data.id || `llibre-${Date.now()}`,
      titol: data.titol.trim(),
      autor: data.autor.trim(),
      editorial: data.editorial.trim(),
      isbn: data.isbn.trim(),
      any_publicacio: data.any_publicacio ? Number(data.any_publicacio) : "",
      llengua: data.llengua.trim(),
      nivell_recomanat: data.nivell_recomanat.trim(),
      tematica: data.tematica.trim(),
      genere: data.genere.trim(),
      ubicacio: data.ubicacio.trim(),
      exemplars,
      disponibles,
      resum: data.resum.trim(),
      actiu: true,
      created_by: existing ? existing.created_by : session.email,
      created_at: existing ? existing.created_at : new Date().toISOString(),
      updated_by: session.email,
      updated_at: new Date().toISOString()
    };

    saveFieldOptions(book);
    if (window.BibliotecaSolSupabase && window.BibliotecaSolSupabase.isConfigured()) {
      try {
        const savedBook = await window.BibliotecaSolSupabase.saveBook(book);
        if (existingIndex >= 0) {
          books[existingIndex] = savedBook;
        } else {
          books.unshift(savedBook);
        }
        window.BibliotecaSol.saveBooks(books);
        showMessage(existing ? "Llibre actualitzat a Supabase." : "Llibre afegit a Supabase.", "success");
        populateOptionLists();
        resetForm();
        renderEditorList();
        return;
      } catch (error) {
        showMessage(`${error.message}. Si Supabase esta configurat, cal entrar amb autenticacio real de gestor.`, "error");
        return;
      }
    }

    if (existingIndex >= 0) {
      books[existingIndex] = book;
    } else {
      books.unshift(book);
    }

    window.BibliotecaSol.saveBooks(books);
    showMessage(existing ? "Llibre actualitzat correctament." : "Llibre afegit correctament.", "success");
    populateOptionLists();
    resetForm();
    renderEditorList();
  }

  function saveFieldOptions(book) {
    window.BibliotecaSol.addOption("nivell_recomanat", book.nivell_recomanat);
    window.BibliotecaSol.addOption("tematica", book.tematica);
    window.BibliotecaSol.addOption("genere", book.genere);
    window.BibliotecaSol.addOption("ubicacio", book.ubicacio);
  }

  function populateOptionLists() {
    const mapping = {
      "edat-options": "nivell_recomanat",
      "tematica-options": "tematica",
      "genere-options": "genere",
      "ubicacio-options": "ubicacio"
    };

    Object.entries(mapping).forEach(([listId, field]) => {
      const list = document.getElementById(listId);
      if (!list) return;
      list.innerHTML = "";
      window.BibliotecaSol.getOptions(field).forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        list.appendChild(option);
      });
    });
  }

  function renderEditorList() {
    const list = document.getElementById("editor-list");
    const count = document.getElementById("editor-count");
    if (!list || !count) return;

    const books = window.BibliotecaSol.getBooks().filter(matchesSearch);
    count.textContent = `${books.length} ${books.length === 1 ? "llibre" : "llibres"}`;
    list.innerHTML = "";

    if (!books.length) {
      list.innerHTML = '<p class="empty-state">No hi ha cap llibre que coincideixi amb la cerca.</p>';
      return;
    }

    books.forEach((book) => {
      const disponibles = Number(book.disponibles || 0);
      const exemplars = Number(book.exemplars || 0);
      const item = document.createElement("article");
      item.className = "editor-item";
      item.innerHTML = `
        <button class="editor-item-main" type="button" data-action="edit" data-id="${book.id}">
          <span>
            <strong>${window.BibliotecaSol.escapeHtml(book.titol)}</strong>
            <small>${window.BibliotecaSol.escapeHtml(book.autor)} - ${window.BibliotecaSol.escapeHtml(book.ubicacio || "Ubicació pendent")}</small>
          </span>
          <span class="availability compact ${disponibles > 0 ? "available" : "unavailable"}">
            <span class="availability-dot"></span>
            <span>${disponibles}/${exemplars}</span>
          </span>
        </button>
        <div class="editor-item-actions">
          <button class="link-button icon-edit" type="button" data-action="edit" data-id="${book.id}">Editar</button>
          <button class="link-button link-danger icon-archive" type="button" data-action="archive" data-id="${book.id}">Descatalogar</button>
        </div>
      `;
      list.appendChild(item);
    });

    list.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        const id = button.dataset.id;
        if (action === "edit") fillForm(id);
        if (action === "archive") archiveBook(id);
      });
    });
  }

  async function loadCirculation() {
    renderCirculationLoading();
    if (!window.BibliotecaSolSupabase || !window.BibliotecaSolSupabase.isConfigured()) {
      renderCirculationUnavailable();
      updateManagerSummary();
      return;
    }

    try {
      const [reservations, loans, returnsList] = await Promise.all([
        window.BibliotecaSolSupabase.listReservations(),
        window.BibliotecaSolSupabase.listLoans("actiu"),
        window.BibliotecaSolSupabase.listReturns()
      ]);
      circulation = { reservations, loans, returns: returnsList };
      renderRequests();
      renderLoans();
      renderOverdue();
      renderHistory();
      updateManagerSummary();
    } catch (error) {
      renderCirculationError(error.message);
    }
  }

  function renderCirculationLoading() {
    ["requests-list", "loans-list", "overdue-list", "history-list"].forEach((id) => {
      const list = document.getElementById(id);
      if (list) list.innerHTML = '<p class="empty-state">Carregant dades...</p>';
    });
  }

  function renderCirculationUnavailable() {
    const message = '<p class="empty-state">Aquest apartat necessita Supabase configurat.</p>';
    ["requests-list", "loans-list", "overdue-list", "history-list"].forEach((id) => {
      const list = document.getElementById(id);
      if (list) list.innerHTML = message;
    });
  }

  function renderCirculationError(message) {
    const html = `<p class="empty-state">${window.BibliotecaSol.escapeHtml(message || "No s'han pogut carregar les dades.")}</p>`;
    ["requests-list", "loans-list", "overdue-list", "history-list"].forEach((id) => {
      const list = document.getElementById(id);
      if (list) list.innerHTML = html;
    });
  }

  function updateManagerSummary() {
    const stats = window.BibliotecaSol.getBookStats(window.BibliotecaSol.getBooks());
    const pending = circulation.reservations.filter((item) => item.status === "pendent").length;
    const overdue = circulation.loans.filter(isOverdue).length;
    setText("summary-pending", pending);
    setText("summary-active-loans", circulation.loans.length);
    setText("summary-overdue", overdue);
    setText("summary-available-books", stats.available);
  }

  function renderRequests() {
    const list = document.getElementById("requests-list");
    if (!list) return;
    const reservations = [...circulation.reservations].sort((a, b) => {
      const loc = String(a.book.ubicacio || "").localeCompare(String(b.book.ubicacio || ""), "ca");
      if (loc !== 0) return loc;
      return new Date(a.requestedAt) - new Date(b.requestedAt);
    });
    list.innerHTML = "";
    if (!reservations.length) {
      list.innerHTML = '<p class="empty-state">No hi ha sol·licituds pendents.</p>';
      return;
    }

    reservations.forEach((reservation) => {
      const canLoan = Number(reservation.book.disponibles || 0) > 0;
      const card = document.createElement("article");
      card.className = "circulation-card";
      card.innerHTML = `
        <div class="circulation-main">
          <strong>${window.BibliotecaSol.escapeHtml(reservation.book.titol)}</strong>
          <span>${window.BibliotecaSol.escapeHtml(reservation.book.autor)} · ${window.BibliotecaSol.escapeHtml(reservation.book.ubicacio || "Ubicació pendent")}</span>
          <span>${window.BibliotecaSol.escapeHtml(reservation.userEmail)}</span>
        </div>
        <div class="circulation-meta">
          <span class="status-pill ${reservation.status === "pendent" ? "warning" : ""}">${labelReservationStatus(reservation.status)}</span>
          <span>Demanat: ${formatDate(reservation.requestedAt)}</span>
          <span>Disponibles: ${Number(reservation.book.disponibles || 0)}/${Number(reservation.book.exemplars || 0)}</span>
        </div>
        <div class="circulation-actions">
          <button class="link-button icon-save" type="button" data-action="loan-request" data-id="${reservation.id}" ${canLoan ? "" : "disabled"}>Fer préstec</button>
          <button class="link-button icon-clear" type="button" data-action="reject-request" data-id="${reservation.id}">Rebutjar</button>
          <a class="link-button icon-login" href="mailto:${encodeURIComponent(reservation.userEmail)}?subject=${encodeURIComponent("Biblioteca de la Sol")}">Contactar</a>
        </div>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll("[data-action='loan-request']").forEach((button) => {
      button.addEventListener("click", () => convertReservationToLoan(button.dataset.id));
    });
    list.querySelectorAll("[data-action='reject-request']").forEach((button) => {
      button.addEventListener("click", () => updateReservation(button.dataset.id, "rebutjada"));
    });
  }

  function renderLoans() {
    const list = document.getElementById("loans-list");
    if (!list) return;
    const loans = [...circulation.loans].sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0));
    list.innerHTML = "";
    if (!loans.length) {
      list.innerHTML = '<p class="empty-state">No hi ha préstecs actius.</p>';
      return;
    }
    loans.forEach((loan) => list.appendChild(createLoanCard(loan, false)));
    wireLoanActions(list);
  }

  function renderOverdue() {
    const list = document.getElementById("overdue-list");
    if (!list) return;
    const overdue = circulation.loans.filter(isOverdue).sort((a, b) => daysOverdue(b) - daysOverdue(a));
    list.innerHTML = "";
    if (!overdue.length) {
      list.innerHTML = '<p class="empty-state">No hi ha préstecs amb retard.</p>';
      return;
    }
    overdue.forEach((loan) => list.appendChild(createLoanCard(loan, true)));
    wireLoanActions(list);
  }

  function createLoanCard(loan, forceOverdue) {
    const overdue = forceOverdue || isOverdue(loan);
    const dueText = loan.dueAt ? formatDate(loan.dueAt) : "Sense data";
    const card = document.createElement("article");
    card.className = "circulation-card";
    card.innerHTML = `
      <div class="circulation-main">
        <strong>${window.BibliotecaSol.escapeHtml(loan.book.titol)}</strong>
        <span>${window.BibliotecaSol.escapeHtml(loan.book.autor)} · ${window.BibliotecaSol.escapeHtml(loan.book.ubicacio || "Ubicació pendent")}</span>
        <span>${window.BibliotecaSol.escapeHtml(loan.userEmail)}</span>
      </div>
      <div class="circulation-meta">
        <span class="status-pill ${overdue ? "danger" : "warning"}">${overdue ? `${daysOverdue(loan)} dies de retard` : "En préstec"}</span>
        <span>Préstec: ${formatDate(loan.loanedAt)}</span>
        <span>Retorn previst: ${dueText}</span>
      </div>
      <div class="circulation-actions">
        <button class="link-button icon-save" type="button" data-action="return-loan" data-id="${loan.id}">Registrar devolució</button>
        <button class="link-button icon-sort-asc" type="button" data-action="renew-loan" data-id="${loan.id}">Renovar 15 dies</button>
        <a class="link-button icon-login" href="mailto:${encodeURIComponent(loan.userEmail)}?subject=${encodeURIComponent("Retorn pendent - Biblioteca de la Sol")}">Contactar</a>
      </div>
    `;
    return card;
  }

  function renderHistory() {
    const list = document.getElementById("history-list");
    if (!list) return;
    list.innerHTML = "";
    if (!circulation.returns.length) {
      list.innerHTML = '<p class="empty-state">Encara no hi ha devolucions registrades.</p>';
      return;
    }

    circulation.returns.forEach((item) => {
      const card = document.createElement("article");
      card.className = "circulation-card";
      card.innerHTML = `
        <div class="circulation-main">
          <strong>${window.BibliotecaSol.escapeHtml(item.book.titol)}</strong>
          <span>${window.BibliotecaSol.escapeHtml(item.book.autor)} · ${window.BibliotecaSol.escapeHtml(item.book.ubicacio || "Ubicació pendent")}</span>
          <span>${window.BibliotecaSol.escapeHtml(item.userEmail)}</span>
        </div>
        <div class="circulation-meta">
          <span class="status-pill">Retornat</span>
          <span>Data: ${formatDate(item.returnedAt)}</span>
          <span>${window.BibliotecaSol.escapeHtml(item.conditionNotes || "")}</span>
        </div>
        <div class="circulation-actions"></div>
      `;
      list.appendChild(card);
    });
  }

  function wireLoanActions(container) {
    container.querySelectorAll("[data-action='return-loan']").forEach((button) => {
      button.addEventListener("click", () => registerReturn(button.dataset.id));
    });
    container.querySelectorAll("[data-action='renew-loan']").forEach((button) => {
      button.addEventListener("click", () => renewLoan(button.dataset.id));
    });
  }

  async function convertReservationToLoan(reservationId) {
    if (!requireManager()) return;
    const reservation = circulation.reservations.find((item) => item.id === reservationId);
    if (!reservation) return;
    try {
      await window.BibliotecaSolSupabase.registerLoan(
        reservation.bookId,
        reservation.userEmail,
        window.BibliotecaSol.getSession().email,
        reservation.id,
        addDays(new Date(), 15)
      );
      showMessage("Préstec registrat. Retorn previst en 15 dies.", "success");
      await refreshBooks();
      await loadCirculation();
    } catch (error) {
      showMessage(error.message || "No s'ha pogut registrar el préstec.", "error");
    }
  }

  async function updateReservation(reservationId, status) {
    if (!requireManager()) return;
    try {
      await window.BibliotecaSolSupabase.updateReservationStatus(reservationId, status);
      showMessage("Sol·licitud actualitzada.", "success");
      await loadCirculation();
    } catch (error) {
      showMessage(error.message || "No s'ha pogut actualitzar la sol·licitud.", "error");
    }
  }

  async function registerReturn(loanId) {
    if (!requireManager()) return;
    try {
      await window.BibliotecaSolSupabase.registerReturn(loanId, window.BibliotecaSol.getSession().email);
      showMessage("Devolució registrada.", "success");
      await refreshBooks();
      await loadCirculation();
    } catch (error) {
      showMessage(error.message || "No s'ha pogut registrar la devolució.", "error");
    }
  }

  async function renewLoan(loanId) {
    if (!requireManager()) return;
    const loan = circulation.loans.find((item) => item.id === loanId);
    if (!loan) return;
    const baseDate = loan.dueAt && new Date(loan.dueAt) > new Date() ? new Date(loan.dueAt) : new Date();
    try {
      await window.BibliotecaSolSupabase.renewLoan(loanId, addDays(baseDate, 15), "Renovat 15 dies");
      showMessage("Préstec renovat 15 dies.", "success");
      await loadCirculation();
    } catch (error) {
      showMessage(error.message || "No s'ha pogut renovar el préstec.", "error");
    }
  }

  async function refreshBooks() {
    if (!window.BibliotecaSolSupabase || !window.BibliotecaSolSupabase.isConfigured()) return;
    const books = await window.BibliotecaSolSupabase.listBooks();
    window.BibliotecaSol.saveBooks(books);
    renderEditorList();
  }

  function matchesSearch(book) {
    if (!currentQuery) return true;
    const searchable = [
      book.titol,
      book.autor,
      book.editorial,
      book.isbn,
      book.nivell_recomanat,
      book.tematica,
      book.genere,
      book.ubicacio
    ].join(" ");
    return window.BibliotecaSol.normalize(searchable).includes(currentQuery);
  }

  function fillForm(id) {
    const book = window.BibliotecaSol.getBooks().find((item) => item.id === id);
    const form = document.getElementById("book-form");
    if (!book || !form) return;

    Object.keys(book).forEach((key) => {
      if (form.elements[key]) {
        form.elements[key].value = book[key];
      }
    });
    document.getElementById("form-title").textContent = "Editar llibre";
    document.getElementById("form-mode").textContent = "Modificació del registre seleccionat.";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function archiveBook(id) {
    if (!requireManager()) return;
    const books = window.BibliotecaSol.getBooks().map((book) => {
      if (book.id === id) {
        return { ...book, actiu: false };
      }
      return book;
    });
    window.BibliotecaSol.saveBooks(books);
    showMessage("Llibre descatalogat.", "success");
    renderEditorList();
  }

  function resetForm() {
    const form = document.getElementById("book-form");
    if (!form) return;
    form.reset();
    form.elements.id.value = "";
    form.elements.llengua.value = "Català";
    form.elements.exemplars.value = 1;
    form.elements.disponibles.value = 1;
    document.getElementById("form-title").textContent = "Introduir nous llibres";
    document.getElementById("form-mode").textContent = "Alta de llibres al catàleg.";
  }

  function showMessage(text, type) {
    const element = document.getElementById("editor-message");
    if (!element) return;
    element.textContent = text;
    element.className = `form-message ${type || ""}`.trim();
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function formatDate(value) {
    if (!value) return "Sense data";
    return new Intl.DateTimeFormat("ca-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(value));
  }

  function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy.toISOString().slice(0, 10);
  }

  function isOverdue(loan) {
    if (!loan.dueAt) return false;
    const due = new Date(`${loan.dueAt}T23:59:59`);
    return due < new Date();
  }

  function daysOverdue(loan) {
    if (!loan.dueAt) return 0;
    const today = new Date();
    const due = new Date(`${loan.dueAt}T00:00:00`);
    const diff = today.setHours(0, 0, 0, 0) - due.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor(diff / 86400000));
  }

  function labelReservationStatus(status) {
    const labels = {
      pendent: "Pendent",
      acceptada: "Acceptada",
      rebutjada: "Rebutjada",
      convertida: "Convertida"
    };
    return labels[status] || status || "Pendent";
  }

  function requireManager() {
    if (window.BibliotecaSol.canManageCatalog(window.BibliotecaSol.getSession())) return true;
    window.location.replace("login.html#gestor");
    return false;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await window.BibliotecaSol.ready;
    initEditor();
  });
})();
