(function () {
  let currentQuery = "";

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
    form.addEventListener("submit", handleSave);
    resetButton.addEventListener("click", resetForm);
    search.addEventListener("input", () => {
      currentQuery = window.BibliotecaSol.normalize(search.value);
      renderEditorList();
    });
    renderEditorList();
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
          <button class="link-button icon-archive" type="button" data-action="loan" data-id="${book.id}" ${disponibles <= 0 ? "disabled" : ""}>Marcar préstec</button>
          <button class="link-button icon-save" type="button" data-action="return" data-id="${book.id}" ${disponibles >= exemplars ? "disabled" : ""}>Marcar retorn</button>
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
        if (action === "loan") changeAvailability(id, -1);
        if (action === "return") changeAvailability(id, 1);
        if (action === "archive") archiveBook(id);
      });
    });
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

  function changeAvailability(id, delta) {
    if (!requireManager()) return;
    const books = window.BibliotecaSol.getBooks();
    const index = books.findIndex((book) => book.id === id);
    if (index === -1) return;

    const book = books[index];
    const exemplars = Math.max(1, Number(book.exemplars || 1));
    const current = Number(book.disponibles || 0);
    const next = Math.min(exemplars, Math.max(0, current + delta));
    if (next === current) return;

    books[index] = {
      ...book,
      disponibles: next,
      updated_at: new Date().toISOString(),
      updated_by: window.BibliotecaSol.getSession().email
    };
    window.BibliotecaSol.saveBooks(books);
    showMessage(delta < 0 ? "Préstec registrat." : "Retorn registrat.", "success");
    renderEditorList();
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
