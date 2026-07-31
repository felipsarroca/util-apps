const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const http = require("http");

const root = path.resolve(__dirname, "..");
const host = "127.0.0.1";
const port = Number(process.env.PILATES_TEST_PORT || 4173);
const baseUrl = `http://${host}:${port}`;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  let target = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
  if (!target.startsWith(root) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) target = path.join(root, "index.html");
  response.writeHead(200, { "Content-Type": types[path.extname(target)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(target).pipe(response);
});

(async () => {
  await new Promise(resolve => server.listen(port, host, resolve));
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
  const results = { consoleErrors: [], pageErrors: [], checks: [] };
  const check = (condition, label) => {
    if (!condition) throw new Error(`FALLA: ${label}`);
    results.checks.push(label);
  };

  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ca-ES" });
    const page = await context.newPage();
    page.on("console", message => { if (message.type() === "error") results.consoleErrors.push(message.text()); });
    page.on("pageerror", error => results.pageErrors.push(error.message));
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });

    check(await page.title() === "Pilates a mà", "títol correcte");
    check((await page.locator("#settings-button").textContent()).trim() === "", "capçalera sense el cercle FS");
    check(await page.locator(".brand strong").evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 24 && getComputedStyle(el).fontFamily.includes("Fraunces")), "marca més gran i amb tipografia destacada");
    check(await page.locator(".hero-card").count() === 1, "recomanació principal visible");
    check(await page.locator(".hero-card").evaluate(el => el.getBoundingClientRect().height <= 320), "vídeo recomanat més compacte en mòbil");
    check(await page.evaluate(() => window.PILATES_CATALOG.videos.length === 92), "noranta-dues classes al catàleg");
    check(await page.locator(".quick-card").count() === 5, "cinc filtres ràpids sense duplicar el repte");
    check(await page.locator("#quick-grid .beginner-challenge-card").count() === 1, "repte de principiants representat per una única targeta");
    check(await page.locator("#quick-grid .challenge-collage img").count() === 3, "imatge composta representativa del repte");
    check(await page.locator(".quick-card .quick-icon").first().evaluate(el => parseFloat(getComputedStyle(el).width) <= 40), "contenidor compacte de les icones mòbils");
    check(await page.locator(".quick-card .quick-icon svg").first().evaluate(el => parseFloat(getComputedStyle(el).width) >= 30), "dibuix de les icones gran i visible");
    check(await page.locator(".quick-card svg[data-quick-icon]").evaluateAll(icons => new Set(icons.map(icon => icon.dataset.quickIcon)).size === 5), "cinc icones diferents i representatives");
    check(await page.locator("#quick-grid .quick-card").evaluateAll(cards => new Set(cards.map(card => getComputedStyle(card).backgroundColor)).size === 5), "cinc quadres ràpids amb colors diferents");
    check(await page.locator(".quick-card small").first().evaluate(el => getComputedStyle(el).display === "none"), "subtítols ocults per aprofitar l'espai mòbil");
    check(await page.locator(".quick-card strong").first().evaluate(el => parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize) <= 1.1), "interlineat compacte als accessos ràpids");
    check(await page.locator(".app-footer > div > p").count() === 2, "peu de pàgina en dues línies");
    check(await page.locator(".app-footer").evaluate(el => getComputedStyle(el).flexDirection === "row"), "icona a l'esquerra del text al peu mòbil");
    check(await page.locator(".app-footer").evaluate(el => getComputedStyle(el).justifyContent === "flex-start"), "peu de llicència alineat a l'esquerra");
    check(await page.locator("body").evaluate(el => el.scrollWidth <= el.clientWidth), "sense desbordament horitzontal en mòbil");
    fs.mkdirSync(path.join(__dirname, "artifacts"), { recursive: true });
    await page.screenshot({ path: path.join(__dirname, "artifacts", "mobile-home.png"), fullPage: true });

    await page.locator("#quick-grid .beginner-challenge-card").click();
    check(await page.locator("#session-dialog").evaluate(el => el.open), "el repte obre directament la sessió que toca");
    check((await page.locator("#session-title").textContent()).includes("Dia 1"), "el repte comença pel primer dia");
    await page.locator("#close-session").click();

    await page.locator("#quick-grid [data-collection='full-body']").click();
    check(await page.locator("#view-explora:not([hidden])").count() === 1, "Cos complet obre els resultats directament");
    check(await page.locator("#filters").evaluate(el => el.scrollWidth <= el.clientWidth), "cercador i filtres complets sense desplaçament lateral");
    check(await page.locator("#type-filter").evaluate(el => getComputedStyle(el).backgroundImage !== "none"), "fletxes dels desplegables visibles");
    await page.screenshot({ path: path.join(__dirname, "artifacts", "mobile-explore.png"), fullPage: true });
    check(await page.locator("#explore-program-spotlight:empty").count() === 1, "Cos complet no barreja el repte de principiants");
    check(await page.locator("#video-grid [data-play='tzK-MaaXWPY']").count() === 0, "els vídeos del repte no apareixen individualment a Cos complet");

    await page.getByRole("button", { name: "Programes" }).click();
    check(await page.locator(".program-card").count() === 3, "tres programes visibles");
    check(await page.locator(".program-card").first().evaluate(el => el.getBoundingClientRect().height <= 230), "targetes de programa compactes");
    check(await page.locator(".program-card .progress-track").first().evaluate(el => parseFloat(getComputedStyle(el).height) >= 14), "progrés dels programes més gruixut");
    await page.screenshot({ path: path.join(__dirname, "artifacts", "mobile-programs.png"), fullPage: true });
    await page.locator("#view-programes [data-open-program='beginner-15']").click();
    check(await page.locator("#program-dialog .program-item").count() === 15, "repte amb quinze sessions ordenades");
    await page.locator("#program-dialog .program-item").first().getByRole("button").click();
    check(await page.locator("#session-dialog").evaluate(el => el.open), "mode de sessió obert");
    check((await page.locator("#session-title").textContent()).includes("Dia 1"), "sessió correcta");
    await page.screenshot({ path: path.join(__dirname, "artifacts", "mobile-session.png"), fullPage: false });
    await page.locator("#load-player").click();
    await page.locator("iframe#youtube-player").waitFor({ state: "attached", timeout: 20000 });
    check(await page.locator("iframe#youtube-player").count() === 1, "reproductor de YouTube integrat");

    await page.locator("#mark-complete").click();
    await page.locator("#confirm-dialog").getByRole("button", { name: "Marca-la" }).click();
    check(await page.locator("#session-complete").isVisible(), "finalització manual confirmada");
    await page.locator("#close-session").click();

    await page.getByRole("button", { name: "Avui" }).click();
    check(await page.locator(".recent-item").first().evaluate(el => el.getBoundingClientRect().height <= 72), "activitat recent compacta a Avui");
    await page.getByRole("button", { name: "Historial", exact: true }).click();
    check(await page.locator("#view-historial > .page-heading > p").count() === 1, "historial sense subtítol explicatiu redundant");
    check(await page.locator("#history-filters").evaluate(el => el.scrollWidth <= el.clientWidth), "selectors de Dia a dia visibles sense desplaçament lateral");
    await page.screenshot({ path: path.join(__dirname, "artifacts", "mobile-history.png"), fullPage: true });
    check(await page.locator(".history-item").count() === 1, "historial actualitzat");
    check((await page.locator(".summary-card").first().textContent()).includes("1"), "resum de sessions actualitzat");
    check(await page.locator(".week-day").count() === 7, "calendari setmanal de set dies");
    check(await page.locator("#history-insights-title").isVisible(), "indicadors de progrés visibles");
    check(await page.locator(".history-program-card").count() === 3, "progrés dels tres programes visible");
    check(Boolean((await page.locator("#history-trend").textContent()).trim()), "comparació setmanal visible");
    await page.reload({ waitUntil: "networkidle" });
    check(await page.locator(".history-item").count() === 1, "historial persistent després de recarregar");
    await page.locator("[data-undo-session]").click();
    check((await page.locator(".history-item").first().textContent()).includes("En curs"), "finalització reversible");
    check(await page.locator("#history-continue").isVisible(), "sessió en curs destacada per continuar");
    await page.locator("#history-status-filter").selectOption("completed");
    check(await page.locator(".history-item").count() === 0, "filtre de sessions completades aplicat");
    await page.locator("#clear-history-filters").click();
    check(await page.locator(".history-item").count() === 1, "filtres d'historial reiniciats");

    await page.getByRole("button", { name: "Explora" }).click();
    await page.locator("#search-input").fill("Pilates");
    const favoriteTitle = await page.locator(".video-card h3").nth(3).textContent();
    await page.locator(".video-card").nth(3).locator("[data-favorite]").click();
    check((await page.locator(".video-card h3").first().textContent()) === favoriteTitle, "favorits sempre al primer lloc dels resultats");
    await page.locator("#clear-filters").click();
    await page.locator("#search-input").fill("Pilates para principiantes");
    check(await page.locator("#explore-program-spotlight .beginner-challenge-card").count() === 1, "la cerca de principiants mostra una sola entrada del repte");
    check(await page.locator("#video-grid [data-play='tzK-MaaXWPY']").count() === 0, "la cerca no duplica les quinze sessions");
    await page.locator("#clear-filters").click();

    await page.getByLabel("Obre la configuració").click();
    await page.locator("#custom-url").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await page.locator("#custom-title").fill("Classe personal de prova");
    await page.locator("#custom-video-form").getByRole("button", { name: "Afegeix-la" }).click();
    check(await page.locator(".custom-item").count() === 1, "classe personal afegida");
    await page.locator("#settings-dialog .close-dialog").click();
    await page.getByRole("button", { name: "Explora" }).click();
    await page.locator("#search-input").fill("Classe personal de prova");
    check(await page.locator(".video-card").count() === 1, "cerca de classe personal");

    await page.getByLabel("Obre la configuració").click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#export-data").click()]);
    check(download.suggestedFilename().endsWith(".json"), "exportació de còpia JSON");
    const importPath = path.join(__dirname, "artifacts", "import-test.json");
    fs.writeFileSync(importPath, JSON.stringify({ app: "Pilates a mà", data: { schemaVersion: 1, preferences: { level: "beginner", duration: 30, prioritizeKnee: true }, favorites: [], sessions: [{ id: "import-session", videoId: "29w3IUe3mQg", startedAt: "2026-07-01T10:00:00.000Z", completedAt: null, completionMethod: null, lastPositionSeconds: 120, maxPositionSeconds: 120, cycleRefs: [] }], programCycles: {}, activeProgramId: "beginner-15", customVideos: [], installDismissedAt: null } }));
    await page.locator("#import-data").setInputFiles(importPath);
    await page.locator("#import-choice-dialog").getByRole("button", { name: "Combina" }).click();
    check(await page.evaluate(() => JSON.parse(localStorage.getItem("pilates-a-ma-state")).sessions.length === 2), "importació combinada sense perdre l'historial");
    await page.locator("#settings-dialog .close-dialog").click();

    const unnamedButtons = await page.locator("button:not([hidden])").evaluateAll(buttons => buttons.filter(button => !String(button.innerText || button.getAttribute("aria-label") || button.getAttribute("title") || "").trim()).map(button => button.outerHTML));
    check(unnamedButtons.length === 0, `cap botó sense nom accessible: ${unnamedButtons.join(" | ")}`);
    const missingAlt = await page.locator("img:not([alt])").count();
    check(missingAlt === 0, "totes les imatges tenen atribut alt");

    await page.screenshot({ path: path.join(__dirname, "artifacts", "mobile.png"), fullPage: true });

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    desktop.on("pageerror", error => results.pageErrors.push(error.message));
    await desktop.goto(`${baseUrl}/#avui`, { waitUntil: "networkidle" });
    check(await desktop.locator("body").evaluate(el => el.scrollWidth <= el.clientWidth), "sense desbordament horitzontal en escriptori");
    await desktop.screenshot({ path: path.join(__dirname, "artifacts", "desktop.png"), fullPage: true });

    const iosContext = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1" });
    const iosPage = await iosContext.newPage();
    await iosPage.goto(`${baseUrl}/#avui`, { waitUntil: "networkidle" });
    check(await iosPage.locator(".install-card").evaluate(el => el.getBoundingClientRect().height <= 64), "targeta d'instal·lació compacta");
    check(await iosPage.locator(".install-card p").count() === 0, "targeta d'instal·lació sense subtítol");
    check(await iosPage.locator(".install-card .button.primary").isVisible(), "botó d'instal·lació destacat");
    await iosContext.close();

    const manifest = await page.request.get(`${baseUrl}/manifest.webmanifest`);
    check(manifest.ok(), "manifest accessible");
    const sw = await page.request.get(`${baseUrl}/sw.js`);
    check(sw.ok(), "service worker accessible");

    const offlineContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const offlinePage = await offlineContext.newPage();
    await offlinePage.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await offlinePage.evaluate(() => navigator.serviceWorker.ready);
    await offlinePage.reload({ waitUntil: "networkidle" });
    await offlineContext.setOffline(true);
    check(await offlinePage.locator("#connection-banner").isVisible(), "avís de connexió visible");
    await offlinePage.reload({ waitUntil: "domcontentloaded" });
    check(await offlinePage.locator(".hero-card").count() === 1, "catàleg disponible sense connexió");
    await offlineContext.close();

    const narrowContext = await browser.newContext({ viewport: { width: 320, height: 720 } });
    const narrowPage = await narrowContext.newPage();
    await narrowPage.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await narrowPage.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const reflow = await narrowPage.evaluate(() => ({ ok: document.body.scrollWidth <= document.body.clientWidth, body: [document.body.scrollWidth, document.body.clientWidth], offenders: [...document.querySelectorAll("body *")].filter(el => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }).slice(0, 8).map(el => `${el.tagName}.${el.className}`) }));
    check(reflow.ok, `reflow sense desbordament a 320 px amb text ampliat: ${JSON.stringify(reflow)}`);
    await narrowContext.close();

    results.consoleErrors = results.consoleErrors.filter(message => !message.includes("Failed to load resource") && !message.includes("ERR_BLOCKED_BY_CLIENT"));
    check(results.pageErrors.length === 0, `sense errors JavaScript: ${results.pageErrors.join(" | ")}`);
    check(results.consoleErrors.length === 0, `sense errors de consola: ${results.consoleErrors.join(" | ")}`);
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.stack || error); process.exit(1); });
