(function () {
  function initAuth() {
    const readerForm = document.getElementById("reader-login-form");
    const editorForm = document.getElementById("editor-login-form");
    const logoutButton = document.getElementById("logout-button");
    if (!readerForm || !editorForm || !logoutButton) return;

    readerForm.addEventListener("submit", handleReaderLogin);
    editorForm.addEventListener("submit", handleEditorLogin);
    logoutButton.addEventListener("click", () => {
      window.BibliotecaSol.clearSession();
      showMessage("reader-login-message", "Sessió tancada.", "success");
      renderSession();
    });
    window.addEventListener("bibliotecaSol:sessionchange", renderSession);

    renderSession();
  }

  async function handleReaderLogin(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = await window.BibliotecaSol.loginWithCredentials(data.email, "");
    showMessage("reader-login-message", result.message, result.ok ? "success" : "error");
    if (result.ok) {
      window.BibliotecaSol.goToPostLoginPage();
    }
  }

  async function handleEditorLogin(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!window.BibliotecaSol.isManagerEmail(data.email)) {
      showMessage("editor-login-message", "Aquest accés és només per al compte biblioteca@ramonpont.cat.", "error");
      return;
    }

    const result = await window.BibliotecaSol.loginWithCredentials(data.email, data.password);
    showMessage("editor-login-message", result.message, result.ok ? "success" : "error");
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
      summary.textContent = `${session.email} · ${session.rol === "editor" ? "gestor" : "lector"}`;
    }
  }

  function showMessage(id, text, type) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = text;
    element.className = `form-message ${type || ""}`.trim();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await window.BibliotecaSol.ready;
    initAuth();
  });
})();
