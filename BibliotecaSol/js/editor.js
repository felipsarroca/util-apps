(function () {
  function initEditor() {
    const gate = document.getElementById("editor-gate");
    const app = document.getElementById("editor-app");
    const form = document.getElementById("book-form");
    const resetButton = document.getElementById("reset-form");
    if (!gate || !app || !form || !resetButton) return;

    const session = window.BibliotecaSol.getSession();
    const canEdit = session && (session.rol === "editor" || session.rol === "administrador");
    gate.hidden = canEdit;
    app.hidden = !canEdit;
    if (!canEdit) return;

    populateOptionLists();
    form.addEventListener("submit", handleSave);
    resetButton.addEventListener("click", resetForm);
    renderEditorList();
  }

  function handleSave(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const books = window.BibliotecaSol.getBooks();
    const exemplars = Math.max(1, Number(data.exemplars || 1));
    const disponibles = Math.min(exemplars, Math.max(0, Number(data.disponibles || 0)));
    const existingIndex = books.findIndex((book) => book.id === data.id);
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
      created_by: session ? session.email : "",
      created_at: existingIndex >= 0 ? books[existingIndex].created_at : new Date().toISOString()
    };

    saveFieldOptions(book);
    if (existingIndex >= 0) {
      books[existingIndex] = book;
    } else {
      books.unshift(book);
    }
    window.BibliotecaSol.saveBooks(books);
    showMessage("Llibre desat correctament.", "success");
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

    const books = window.BibliotecaSol.getBooks();
    count.textContent = `${books.length} ${books.length === 1 ? "llibre" : "llibres"}`;
    list.innerHTML = "";

    if (!books.length) {
      list.innerHTML = '<p class="empty-state">Encara no hi ha llibres al catàleg.</p>';
      return;
    }

    books.forEach((book) => {
      const item = document.createElement("article");
      item.className = "editor-item";
      item.innerHTML = `
        <div>
          <h3>${window.BibliotecaSol.escapeHtml(book.titol)}</h3>
          <p>${window.BibliotecaSol.escapeHtml(book.autor)} · ${Number(book.disponibles || 0)}/${Number(book.exemplars || 0)} disponibles</p>
        </div>
        <div class="editor-item-actions">
          <button class="link-button icon-edit" type="button" data-action="edit" data-id="${book.id}">Editar</button>
          <button class="link-button link-danger icon-archive" type="button" data-action="archive" data-id="${book.id}">Descatalogar</button>
        </div>
      `;
      list.appendChild(item);
    });

    list.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        const id = button.dataset.id;
        if (action === "edit") fillForm(id);
        if (action === "archive") archiveBook(id);
      });
    });
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
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function archiveBook(id) {
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
    document.getElementById("form-title").textContent = "Afegir llibre";
  }

  function showMessage(text, type) {
    const element = document.getElementById("editor-message");
    if (!element) return;
    element.textContent = text;
    element.className = `form-message ${type || ""}`.trim();
  }

  document.addEventListener("DOMContentLoaded", initEditor);
})();
