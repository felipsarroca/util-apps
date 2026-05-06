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
      showMessage("reader-login-message", "Sessio tancada.", "success");
      renderSession();
    });
    window.addEventListener("bibliotecaSol:sessionchange", renderSession);

    renderSession();
  }

  function handleReaderLogin(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = window.BibliotecaSol.loginWithCredentials(data.email, "");
    showMessage("reader-login-message", result.message, result.ok ? "success" : "error");
    if (result.ok) {
      window.BibliotecaSol.goToPostLoginPage();
    }
  }

  function handleEditorLogin(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!window.BibliotecaSol.isManagerEmail(data.email)) {
      showMessage("editor-login-message", "Aquest acces es nomes per al compte biblioteca@ramonpont.cat.", "error");
      return;
    }

    const result = window.BibliotecaSol.loginWithCredentials(data.email, data.password);
    showMessage("editor-login-message", result.message, result.ok ? "success" : "error");
    if (result.ok) {
      window.BibliotecaSol.goToPostLoginPage();
    }
  }

  function loginDemo(email) {
    if (email === "biblioteca@ramonpont.cat") {
      const editorEmail = document.querySelector('#editor-login-form input[name="email"]');
      const editorPassword = document.querySelector('#editor-login-form input[name="password"]');
      if (editorEmail) editorEmail.value = "biblioteca@ramonpont.cat";
      if (editorPassword) editorPassword.value = "bibliotecasol";
      showMessage("editor-login-message", "Contrasenya de prova preparada.", "success");
      return;
    }

    const result = window.BibliotecaSol.loginWithCredentials(email, "");
    showMessage("reader-login-message", result.message, result.ok ? "success" : "error");
    if (result.ok) {
      window.BibliotecaSol.goToPostLoginPage();
    }
  }

  function renderSession() {
    const panel = document.getElementById("session-panel");
    const summary = document.getElementById("session-summary");
    const session = window.BibliotecaSol.getSession();
    if (!panel || !summary) return;

    panel.hidden = !session;
    if (session) {
      summary.textContent = `${session.nom} ${session.cognoms || ""} - ${session.email} - ${session.rol}`;
    }
  }

  function showMessage(id, text, type) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = text;
    element.className = `form-message ${type || ""}`.trim();
  }

  document.addEventListener("DOMContentLoaded", initAuth);
})();
