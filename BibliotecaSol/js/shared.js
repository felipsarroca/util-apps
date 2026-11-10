(function () {
  const BOOKS_KEY = "bibliotecaSol.books";
  const USERS_KEY = "bibliotecaSol.users";
  const SESSION_KEY = "bibliotecaSol.session";
  const OPTIONS_KEY = "bibliotecaSol.options";
  let booksCache = null;
  let optionsCache = null;
  let dataSource = "local";

  const seedUsers = [
    {
      id: "usuari-alumnat",
      nom: "Alumnat",
      cognoms: "Biblioteca",
      email: "alumnat@ramonpont.cat",
      rol: "lector",
      created_at: "2026-05-06"
    },
    {
      id: "usuari-biblioteca",
      nom: "Biblioteca",
      cognoms: "Escola Ramon Pont",
      email: "biblioteca@ramonpont.cat",
      password: "bibliotecasol",
      rol: "editor",
      created_at: "2026-05-06"
    }
  ];

  const seedOptions = {
    nivell_recomanat: ["3-5 anys", "6-8 anys", "9-11 anys", "12-14 anys", "14-16 anys", "Mestres"],
    tematica: ["Aventura", "Ciència", "Coneixements", "Convivència", "Emocions", "Fantasia", "Història", "Misteri", "Natura"],
    genere: ["Àlbum il·lustrat", "Còmic", "Conte", "Divulgació", "Narrativa", "Novel·la curta", "Poesia", "Teatre"],
    ubicacio: ["Biblioteca central", "Prestatgeria A1", "Prestatgeria A2", "Prestatgeria B1", "Prestatgeria B2", "Prestatgeria C1", "Prestatgeria C2", "Racó infantil", "Zona ESO"]
  };

  const seedBooks = [];

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function ensureBooks() {
    const existing = readJson(BOOKS_KEY, null);
    if (!Array.isArray(existing)) {
      writeJson(BOOKS_KEY, seedBooks);
      return seedBooks;
    }
    return existing.filter((book) => !/^97884000/.test(String(book.isbn || "").replace(/\D/g, "")));
  }

  function ensureUsers() {
    const existing = readJson(USERS_KEY, []);
    const users = Array.isArray(existing) ? existing : [];
    let changed = false;

    seedUsers.forEach((seedUser) => {
      const index = users.findIndex((user) => normalize(user.email) === normalize(seedUser.email));
      if (index === -1) {
        users.push(seedUser);
        changed = true;
      } else {
        users[index] = { ...users[index], ...seedUser };
        changed = true;
      }
    });

    if (changed) writeJson(USERS_KEY, users);
    return users;
  }

  function ensureOptions() {
    const existing = readJson(OPTIONS_KEY, {});
    const options = { ...seedOptions, ...(existing && typeof existing === "object" ? existing : {}) };

    Object.keys(seedOptions).forEach((key) => {
      const combined = [...seedOptions[key], ...(Array.isArray(options[key]) ? options[key] : [])];
      options[key] = uniqueSorted(combined);
    });

    writeJson(OPTIONS_KEY, options);
    return options;
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function getBooks() {
    const books = booksCache || ensureBooks();
    return books.filter((book) => book.actiu !== false);
  }

  function saveBooks(books) {
    booksCache = books;
    writeJson(BOOKS_KEY, books);
  }

  function getUsers() {
    return ensureUsers();
  }

  function saveUsers(users) {
    writeJson(USERS_KEY, users);
  }

  function getOptions(field) {
    const options = optionsCache || ensureOptions();
    return sortOptions(field, options[field] || []);
  }

  function ageRank(value) {
    if (!String(value || "").trim()) return 2000;
    const match = String(value || "").match(/\d+/);
    return match ? Number(match[0]) : 1000;
  }

  function sortOptions(field, values) {
    const list = uniqueSorted(values);
    if (field === "nivell_recomanat") {
      list.sort((a, b) => ageRank(a) - ageRank(b) || a.localeCompare(b, "ca", { numeric: true }));
    }
    return list;
  }

  function addOption(field, value) {
    const cleanValue = String(value || "").trim();
    if (!cleanValue) return;

    const options = optionsCache || ensureOptions();
    options[field] = uniqueSorted([...(options[field] || []), cleanValue]);
    optionsCache = options;
    writeJson(OPTIONS_KEY, options);
  }

  function uniqueSorted(values) {
    const map = new Map();
    values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .forEach((value) => map.set(normalize(value), value));
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "ca"));
  }

  function getSession() {
    try {
      const value = sessionStorage.getItem(SESSION_KEY);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  function setSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    updateAccessState();
    window.dispatchEvent(new CustomEvent("bibliotecaSol:sessionchange"));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (window.BibliotecaSolSupabase) window.BibliotecaSolSupabase.signOut();
    updateAccessState();
    window.dispatchEvent(new CustomEvent("bibliotecaSol:sessionchange"));
  }

  function isAllowedEmail(email) {
    const domain = (window.BIBLIOTECA_SOL_CONFIG || {}).allowedEmailDomain || "@ramonpont.cat";
    return normalize(email).endsWith(normalize(domain));
  }

  function isManagerEmail(email) {
    return normalize(email) === normalize("biblioteca@ramonpont.cat");
  }

  function findUser(email) {
    return getUsers().find((item) => normalize(item.email) === normalize(email));
  }

  function createReader(email) {
    const users = getUsers();
    const cleanEmail = String(email || "").trim();
    const name = cleanEmail.split("@")[0] || "Usuari";
    const user = {
      id: `usuari-${Date.now()}`,
      nom: titleCase(name.replace(/[._-]+/g, " ")),
      cognoms: "",
      email: cleanEmail,
      rol: "lector",
      created_at: new Date().toISOString()
    };
    users.push(user);
    saveUsers(users);
    return user;
  }

  function titleCase(value) {
    return String(value)
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  function setSessionFromUser(user) {
    setSession({
      id: user.id,
      nom: user.nom,
      cognoms: user.cognoms || "",
      email: user.email,
      rol: user.rol
    });
  }

  async function initData() {
    booksCache = ensureBooks();
    optionsCache = ensureOptions();

    if (!window.BibliotecaSolSupabase || !window.BibliotecaSolSupabase.isConfigured()) {
      dataSource = "local";
      return;
    }

    try {
      const [remoteBooks, remoteOptions] = await Promise.all([
        window.BibliotecaSolSupabase.listBooks(),
        window.BibliotecaSolSupabase.listOptions()
      ]);
      booksCache = remoteBooks;
      writeJson(BOOKS_KEY, remoteBooks);
      optionsCache = { ...optionsCache, ...remoteOptions };
      dataSource = "supabase";
      window.dispatchEvent(new CustomEvent("bibliotecaSol:dataready"));
    } catch (error) {
      dataSource = "local";
      console.warn("No s'han pogut carregar les dades de Supabase. Es fa servir localStorage.", error);
    }
  }

  async function loginWithCredentials(email, password) {
    const cleanEmail = String(email || "").trim();
    if (!isAllowedEmail(cleanEmail)) {
      return { ok: false, type: "error", message: "Només es poden utilitzar correus acabats en @ramonpont.cat." };
    }

    if (isManagerEmail(cleanEmail)) {
      const user = findUser(cleanEmail);
      if (!password) {
        return { ok: false, type: "password", message: "Introdueix la contrasenya de gestor." };
      }
      if (!user || user.rol !== "editor" || user.password !== password) {
        return { ok: false, type: "error", message: "Correu de gestor o contrasenya incorrectes." };
      }
      if (dataSource === "supabase" && window.BibliotecaSolSupabase) {
        try {
          await window.BibliotecaSolSupabase.signInWithPassword(cleanEmail, password);
        } catch (error) {
          return { ok: false, type: "error", message: "No s'ha pogut autenticar el gestor a Supabase." };
        }
      }
      await registerRemoteAccess(cleanEmail);
      setSessionFromUser(user);
      return { ok: true, role: "editor", message: "Has iniciat sessió com a gestor." };
    }

    const existingUser = findUser(cleanEmail);
    if (existingUser && (existingUser.rol === "editor" || existingUser.rol === "administrador")) {
      return { ok: false, type: "error", message: "Aquest usuari té permisos de gestor. Cal entrar amb contrasenya." };
    }

    const remoteUser = await registerRemoteAccess(cleanEmail);
    setSessionFromUser(remoteUser || existingUser || createReader(cleanEmail));
    return { ok: true, role: "lector", message: "Has iniciat sessió com a usuari." };
  }

  async function registerRemoteAccess(email) {
    if (dataSource !== "supabase" || !window.BibliotecaSolSupabase) return null;
    try {
      return await window.BibliotecaSolSupabase.registerAccess(email);
    } catch (error) {
      console.warn("No s'ha pogut registrar l'acces a Supabase.", error);
      return null;
    }
  }

  async function reserveBooks(bookIds, email) {
    if (!Array.isArray(bookIds) || !bookIds.length) {
      return { ok: false, message: "No has seleccionat cap llibre." };
    }
    if (!isAllowedEmail(email)) {
      return { ok: false, message: "Cal entrar amb un correu @ramonpont.cat per fer reserves." };
    }
    if (dataSource !== "supabase" || !window.BibliotecaSolSupabase) {
      return { ok: false, type: "local", message: "Supabase encara no esta configurat. De moment envia la sol·licitud per correu." };
    }

    try {
      await Promise.all(bookIds.map((bookId) => window.BibliotecaSolSupabase.reserveBook(bookId, email)));
      return { ok: true, message: "Reserva registrada correctament." };
    } catch (error) {
      return { ok: false, message: error.message || "No s'ha pogut registrar la reserva." };
    }
  }

  function getPostLoginUrl(session) {
    return canManageCatalog(session) ? "editor.html" : "cataleg.html";
  }

  function goToPostLoginPage() {
    const session = getSession();
    if (!session) return;
    window.location.href = getPostLoginUrl(session);
  }

  function getBookStats(books) {
    return books.reduce(
      (stats, book) => {
        stats.books += 1;
        stats.copies += Number(book.exemplars || 0);
        stats.available += Number(book.disponibles || 0);
        return stats;
      },
      { books: 0, copies: 0, available: 0 }
    );
  }

  function createBookCard(book) {
    const available = Number(book.disponibles || 0);
    const total = Number(book.exemplars || 0);
    const statusClass = available > 0 ? "available" : "unavailable";
    const statusText = available > 0 ? `${available} disponibles` : "No disponible";
    const article = document.createElement("article");
    article.className = "book-row";
    article.innerHTML = `
      <div class="book-main">
        <h3>${escapeHtml(book.titol)}</h3>
        <span class="book-kicker">${escapeHtml(book.editorial || "Editorial pendent")}${book.isbn ? ` · ISBN ${escapeHtml(book.isbn)}` : ""}</span>
        ${formatCollection(book) ? `<span class="book-kicker">${escapeHtml(formatCollection(book))}</span>` : ""}
      </div>
      <p class="book-author">${escapeHtml(book.autor)}</p>
      <span class="compact-cell">${escapeHtml(book.nivell_recomanat || "Pendent")}</span>
      <span class="compact-cell">${escapeHtml(book.tematica || "Pendent")}</span>
      <span class="compact-cell">${escapeHtml(book.genere || "Pendent")}</span>
      <div class="availability compact ${statusClass}">
        <span class="availability-dot"></span>
        <span>${escapeHtml(available > 0 ? `${available}/${total}` : "No")}</span>
      </div>
      <div class="location-stack">
        <span class="book-location">${escapeHtml(book.ubicacio || "Ubicació pendent")}</span>
        <span class="book-year">${escapeHtml(book.any_publicacio || "")}</span>
      </div>
    `;
    return article;
  }

  function formatCollection(book) {
    const parts = [];
    const collection = String(book.coleccio || "").trim();
    const number = String(book.numero_coleccio || "").trim();
    if (collection) parts.push(`Col·lecció ${collection}${number ? `, núm. ${number}` : ""}`);
    else if (number) parts.push(`Núm. ${number}`);
    if (Number(book.pagines) > 0) parts.push(`${Number(book.pagines)} pàg.`);
    return parts.join(" · ");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function canManageCatalog(session) {
    return Boolean(session && isManagerEmail(session.email) && (session.rol === "editor" || session.rol === "administrador"));
  }

  function updateAccessLink() {
    const session = getSession();
    document.querySelectorAll('.main-nav a[href="login.html"]').forEach((link) => {
      if (!session) {
        link.textContent = "Accés";
        link.title = "Accés";
        link.className = "button button-small icon-login";
        delete link.dataset.logout;
        return;
      }

      const isEditor = canManageCatalog(session);
      link.textContent = `${session.nom || "Sessió"} · Sortir`;
      link.title = `${session.email} (${session.rol}). Clica per tancar la sessió i tornar a l'inici.`;
      link.setAttribute("aria-label", `Tancar la sessió de ${session.email} i tornar a l'inici`);
      link.className = `button button-small session-pill icon-logout ${isEditor ? "session-editor" : "session-reader"}`;
      link.dataset.logout = "true";
    });
  }

  function updateRoleVisibility() {
    const canEdit = canManageCatalog(getSession());
    document.querySelectorAll("[data-editor-only]").forEach((element) => {
      element.hidden = !canEdit;
    });
    document.querySelectorAll("[data-reader-only]").forEach((element) => {
      element.hidden = canEdit;
    });
  }

  function redirectIfManagerRequired() {
    if (!document.body.dataset.requiresManager) return;
    if (canManageCatalog(getSession())) return;
    window.location.replace("login.html#gestor");
  }

  function updateAccessState() {
    updateAccessLink();
    updateRoleVisibility();
  }

  function initAccessForms() {
    createAccessDialog();
    document.querySelectorAll(".main-nav a[href='login.html']").forEach((link) => {
      link.addEventListener("click", (event) => {
        if (link.dataset.logout === "true") return;
        event.preventDefault();
        openAccessDialog();
      });
    });

    const homeForm = document.getElementById("home-login-form");
    if (homeForm) {
      homeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(homeForm));
        const result = await loginWithCredentials(data.email, "");
        if (result.type === "password") {
          openAccessDialog(data.email);
          return;
        }
        showInlineMessage("home-login-message", result.message, result.ok ? "success" : "error");
        if (result.ok) {
          goToPostLoginPage();
        }
      });
    }
  }

  function createAccessDialog() {
    if (document.getElementById("access-dialog")) return;

    const dialog = document.createElement("dialog");
    dialog.id = "access-dialog";
    dialog.className = "access-dialog";
    dialog.innerHTML = `
      <form id="access-dialog-form" class="access-dialog-card" method="dialog">
        <button class="dialog-close icon-clear" type="button" aria-label="Tancar"></button>
        <img src="assets/logo-sol.svg" alt="" width="56" height="56">
        <div>
          <h2>Accés a la biblioteca</h2>
          <p>Escriu el correu del centre. Si és el compte de biblioteca, et demanarà la contrasenya de gestor.</p>
        </div>
        <label>
          Correu electrònic
          <input name="email" type="email" autocomplete="email" required placeholder="nom@ramonpont.cat">
        </label>
        <label id="access-password-field" hidden>
          Contrasenya de gestor
          <input name="password" type="password" autocomplete="current-password">
        </label>
        <button class="button icon-login" type="submit">Entrar</button>
        <p id="access-dialog-message" class="form-message" role="status"></p>
      </form>
    `;
    document.body.appendChild(dialog);

    const form = dialog.querySelector("#access-dialog-form");
    const emailInput = form.elements.email;
    const passwordField = dialog.querySelector("#access-password-field");
    const passwordInput = form.elements.password;

    dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    emailInput.addEventListener("input", () => {
      const manager = isManagerEmail(emailInput.value);
      passwordField.hidden = !manager;
      passwordInput.required = manager;
      if (!manager) passwordInput.value = "";
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const result = await loginWithCredentials(emailInput.value, passwordInput.value);
      if (result.type === "password") {
        passwordField.hidden = false;
        passwordInput.required = true;
        passwordInput.focus();
        showInlineMessage("access-dialog-message", result.message, "error");
        return;
      }
      showInlineMessage("access-dialog-message", result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setTimeout(goToPostLoginPage, 150);
      }
    });
  }

  function openAccessDialog(email) {
    const dialog = document.getElementById("access-dialog");
    if (!dialog) return;
    const form = dialog.querySelector("#access-dialog-form");
    const emailInput = form.elements.email;
    const passwordField = dialog.querySelector("#access-password-field");
    const passwordInput = form.elements.password;
    showInlineMessage("access-dialog-message", "", "");
    if (email) emailInput.value = email;
    const manager = isManagerEmail(emailInput.value);
    passwordField.hidden = !manager;
    passwordInput.required = manager;
    if (!manager) passwordInput.value = "";
    dialog.showModal();
    (manager ? passwordInput : emailInput).focus();
  }

  function showInlineMessage(id, text, type) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = text || "";
    element.className = `form-message ${type || ""}`.trim();
  }

  const ready = new Promise((resolve) => {
    document.addEventListener("DOMContentLoaded", async () => {
    localStorage.removeItem(SESSION_KEY);
    await initData();
    ensureUsers();
    updateAccessState();
    redirectIfManagerRequired();
    initAccessForms();
    document.addEventListener("click", (event) => {
      const logoutLink = event.target.closest("[data-logout='true']");
      if (!logoutLink) return;
      event.preventDefault();
      clearSession();
      window.location.href = "index.html";
    });
    resolve();
  });
  });

  window.BibliotecaSol = {
    normalize,
    getBooks,
    saveBooks,
    getUsers,
    saveUsers,
    getOptions,
    sortOptions,
    ageRank,
    addOption,
    getSession,
    setSession,
    clearSession,
    ready,
    canManageCatalog,
    isManagerEmail,
    loginWithCredentials,
    reserveBooks,
    goToPostLoginPage,
    openAccessDialog,
    isAllowedEmail,
    getBookStats,
    createBookCard,
    escapeHtml
  };
})();
