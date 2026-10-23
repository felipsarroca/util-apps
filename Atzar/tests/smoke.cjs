/* Prova de fum de totes les apps d'Atzar a l'aula.
   Ús: node tests/smoke.cjs [app ...]   (SHOTS=carpeta per desar captures) */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const root = path.resolve(__dirname, "..");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
};
// Cada app: acció principal i comprovació posterior.
const APPS = {
  "": { action: null },
  Moneda: { action: "#tossButton", wait: 2600, check: "#resultLine .big" },
  Daus: { action: "#rollButton", wait: 2600, check: "#resultLine .big" },
  Cartes: { action: "#drawButton", wait: 1800, check: "#table .card" },
  Nombres: { action: "#drawButton", wait: 2200, check: "#resultLine .big" },
  Sorteig: { action: "#drawButton", wait: 3600, check: "#winners li" },
  Equips: { action: "#makeButton", wait: 3000, check: ".team" },
  Temps: { action: "#startButton", wait: 1200, check: "#display" },
  Ruleta: { action: null },
};
const only = process.argv.slice(2);
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });

const server = http.createServer((req, res) => {
  let name = decodeURIComponent(req.url.split("?")[0]);
  if (name.endsWith("/")) name += "index.html";
  const file = path.join(root, path.normalize(name));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome", headless: true });
  let failures = 0;
  for (const [app, spec] of Object.entries(APPS)) {
    if (only.length && !only.includes(app || "menu")) continue;
    for (const viewport of [
      { width: 1366, height: 768, tag: "desktop" },
      { width: 390, height: 844, tag: "mobile" },
      { width: 320, height: 640, tag: "small" },
    ]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
      const label = `${app || "menu"} · ${viewport.tag}`;
      try {
        await page.goto(base + (app ? `${app}/` : ""), { waitUntil: "load" });
        await page.waitForTimeout(300);
        if (spec.action) {
          await page.click(spec.action);
          await page.waitForTimeout(spec.wait);
          await page.waitForSelector(spec.check, { timeout: 4000 });
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 1, `desbordament horitzontal de ${overflow}px`);
        if (shots) await page.screenshot({ path: path.join(shots, `${app || "menu"}-${viewport.tag}.png`) });
        // Tema fosc
        if (viewport.tag === "desktop" && (await page.$("#themeButton"))) {
          await page.click("#themeButton");
          await page.waitForTimeout(150);
          if (shots) await page.screenshot({ path: path.join(shots, `${app || "menu"}-dark.png`) });
          await page.click("#themeButton");
        }
        assert.deepEqual(errors, []);
        console.log(`✓ ${label}`);
      } catch (e) {
        failures++;
        console.log(`✗ ${label}: ${e.message.split("\n")[0]}`);
        if (errors.length) console.log("   " + errors.join("\n   "));
      }
      await page.close();
    }
  }
  await browser.close();
  server.close();
  process.exitCode = failures ? 1 : 0;
})();
