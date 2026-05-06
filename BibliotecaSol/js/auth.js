(function () {
  function initAuth() {
    const readerForm = document.getElementById("reader-login-form");
    const editorForm = document.getElementById("editor-login-form");
    const logoutButton = document.getElementById("logout-button");
    if (!readerForm || !editorForm || !logoutButton) return;

    readerForm.addEventListener("submit", handleReaderLogin);
    editorForm.addEventListener("submit", handleEditorLogin);
    document.querySelectorAll("[data-demo-login]").forEach((button) => {
      button.addEventListener("click", () => loginDemo(button.dataset.demoLogin));
    });
    logoutButton.addEventListener("click", () => {
      window.BibliotecaSol.clearSession();
      showMessage("reader-login-message", "Sessió tancada.", "success");
      renderSession();
    });
    window.addEventListener("bibliotecaSol:sessionchange", renderSession);

    renderSession();
  }

  function handleReaderLogin(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    loginReader(data.email);
  }

  function handleEditorLogin(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!window.BibliotecaSol.isAllowedEmail(data.email)) {
      showMessage("editor-login-message", "Només es poden utilitzar correus acabats en @ramonpont.cat.", "error");
      return;
    }

    const user = findUser(data.email);
    if (!user || user.rol !== "editor" || user.password !== data.password) {
      showMessage("editor-login-message", "Correu de gestor o contrasenya incorrectes.", "error");
      return;
    }

    setSessionFromUser(user);
    showMessage("editor-login-message", "Has iniciat sessió com a gestor.", "success");
    renderSession();
  }

  function loginDemo(email) {
    if (email === "biblioteca@ramonpont.cat") {
      const editorEmail = document.querySelector('#editor-login-form input[name="email"]');
      const editorPassword = document.querySelector('#editor-login-form input[name="password"]');
      if (editorEmail) editorEmail.value = "biblioteca@ramonpont.cat";
      if (editorPassword) editorPassword.value = "biblioteca2026";
      showMessage("editor-login-message", "Contrasenya de prova preparada.", "success");
      return;
    }
    loginReader(email);
  }

  function loginReader(email) {
    if (!window.BibliotecaSol.isAllowedEmail(email)) {
      showMessage("reader-login-message", "Només es poden utilitzar correus acabats en @ramonpont.cat.", "error");
      return;
    }

    const user = findUser(email) || createReader(email);
    if (user.rol === "editor") {
      showMessage("reader-login-message", "Aquest usuari té permisos de gestor. Cal entrar amb contrasenya.", "error");
      return;
    }

    setSessionFromUser(user);
    showMessage("reader-login-message", "Has iniciat sessió com a usuari de consulta.", "success");
    renderSession();
  }

  function createReader(email) {
    const users = window.BibliotecaSol.getUsers();
    const name = email.split("@")[0] || "Usuari";
    const user = {
      id: `usuari-${Date.now()}`,
      nom: titleCase(name.replace(/[._-]+/g, " ")),
      cognoms: "",
      email: email.trim(),
      rol: "lector",
      created_at: new Date().toISOString()
    };
    users.push(user);
    window.BibliotecaSol.saveUsers(users);
    return user;
  }

  function findUser(email) {
    return window.BibliotecaSol.getUsers().find((item) => item.email.toLowerCase() === String(email).toLowerCase());
  }

  function setSessionFromUser(user) {
    window.BibliotecaSol.setSession({
      id: user.id,
      nom: user.nom,
      cognoms: user.cognoms || "",
      email: user.email,
      rol: user.rol
    });
  }

  function renderSession() {
    const panel = document.getElementById("session-panel");
    const summary = document.getElementById("session-summary");
    const session = window.BibliotecaSol.getSession();
    if (!panel || !summary) return;

    panel.hidden = !session;
    if (session) {
      summary.textContent = `${session.nom} ${session.cognoms || ""} · ${session.email} · ${session.rol}`;
    }
  }

  function titleCase(value) {
    return String(value)
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  function showMessage(id, text, type) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = text;
    element.className = `form-message ${type || ""}`.trim();
  }

  document.addEventListener("DOMContentLoaded", initAuth);
})();
