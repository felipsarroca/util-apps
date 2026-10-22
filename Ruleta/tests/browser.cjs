const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const output = fs.mkdtempSync(
  path.join(require("node:os").tmpdir(), "ruleta-test-"),
);
const root = path.resolve(__dirname, "..");
(async () => {
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || "chrome",
    headless: true,
  });
  const server = require("node:http").createServer((req, res) => {
    const name = decodeURIComponent(req.url.split("?")[0]);
    const allowed = {
      "/": "index.html",
      "/index.html": "index.html",
      "/style.css": "style.css",
      "/script.js": "script.js",
      "/data/library.js": "data/library.js",
      "/favicon.svg": "favicon.svg",
      "/assets/CC_BY-NC-SA.png": "assets/CC_BY-NC-SA.png",
    };
    if (!allowed[name]) {
      res.writeHead(404);
      res.end();
      return;
    }
    const ext = path.extname(allowed[name]);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css",
        ".js": "text/javascript",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      }[ext],
    );
    res.end(fs.readFileSync(path.join(root, allowed[name])));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseURL = `http://127.0.0.1:${server.address().port}`;
  const errors = [];
  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(baseURL);
  async function setEntries(value) {
    if (!(await page.locator("#entriesInput").isVisible())) await page.locator("#editListButton").click();
    await page.locator("#entriesInput").fill(value);
  }

  for (const [w, h, dpr] of [
    [1920, 1080, 1],
    [1080, 1240, 1],
    [1366, 740, 1],
    [1366, 768, 1],
    [1093, 614, 1.25],
    [911, 512, 1.5],
    [390, 844, 3],
    [320, 568, 2],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.screenshot({
      path: output + `/layout-${w}.png`,
      fullPage: true,
    });
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      panelBottom: document.querySelector(".panel").getBoundingClientRect()
        .bottom,
      footerTop: document.querySelector("footer").getBoundingClientRect().top,
      spinBottom: document.querySelector("#spinButton").getBoundingClientRect()
        .bottom,
    }));
    assert.equal(layout.overflow, false, `overflow ${w}`);
    console.log("LAYOUT", w, h, layout);
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await setEntries("A\nB\nC");
  await page.locator("#tab-settings").click();
  await page.locator("#durationInput").selectOption("3");
  await page.locator("#tab-entries").click();
  await page.locator("#spinButton").click();
  assert.equal(await page.locator("#entriesInput").isDisabled(), true);
  await page.waitForSelector("#winnerDialog[open]");
  const result = await page.locator("#winnerName").textContent();
  const sector = await page.evaluate(() => {
    const m = new DOMMatrix(
      getComputedStyle(document.querySelector("canvas")).transform,
    );
    const rotation = Math.atan2(m.b, m.a);
    const tau = 2 * Math.PI;
    return Math.floor(
      ((((-Math.PI / 2 - rotation) % tau) + tau) % tau) / (tau / 3),
    );
  });
  assert.equal(result, ["A", "B", "C"][sector]);
  await page.screenshot({ path: output + "/winner.png" });
  await page.locator("#removeButton").click();
  assert.equal(
    (await page.locator("#entriesInput").inputValue()).split("\n").length,
    2,
  );
  await page.locator("#undoButton").click();
  assert.equal(await page.locator("#entriesInput").inputValue(), "A\nB\nC");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#noRepeatToggle").check();
  const winners = [];
  for (let i = 0; i < 3; i++) {
    await page.locator("#spinButton").click();
    await page.waitForSelector("#winnerDialog[open]");
    winners.push(await page.locator("#winnerName").textContent());
    await page.locator("#closeWinner").click();
  }
  assert.equal(new Set(winners).size, 3);
  assert.equal(await page.locator("#spinButton").isDisabled(), true);
  await page.reload();
  assert.equal(await page.locator("#entriesInput").inputValue(), "");
  await page.locator("#restoreButton").click();
  assert.equal(await page.locator("#entriesInput").inputValue(), "A\nB\nC");
  await setEntries("Anna\nAnna\nBiel");
  await page.locator("#dedupeButton").click();
  assert.equal(await page.locator("#entriesInput").inputValue(), "Anna\nBiel");
  await setEntries(Array.from({ length: 201 }, (_, i) => String(i)).join("\n"));
  assert.equal(await page.locator("#spinButton").isDisabled(), true);
  await setEntries("x".repeat(81));
  assert.equal(await page.locator("#spinButton").isDisabled(), true);
  await setEntries("<img src=x onerror=alert(1)>");
  await page.locator("#spinButton").click();
  await page.waitForSelector("#winnerDialog[open]");
  assert.equal(await page.locator("#winnerName img").count(), 0);
  await page.locator("#closeWinner").click();
  await page.locator("#fileInput").setInputFiles({
    name: "test.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Una\nDues\nTres"),
  });
  await page.waitForFunction(
    () => document.querySelector("#entriesInput").value === "Una\nDues\nTres",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportButton").click();
  const download = await downloadPromise;
  await download.saveAs(output + "/export.json");
  const data = require(output + "/export.json");
  assert.deepEqual(data.entries, ["Una", "Dues", "Tres"]);
  await page.locator("#fileInput").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"entries":[3]}'),
  });
  await page.waitForTimeout(200);
  assert.equal(
    await page.locator("#entriesInput").inputValue(),
    "Una\nDues\nTres",
  );
  await page.locator("#themeButton").click();
  await page.screenshot({ path: output + "/dark.png", fullPage: true });
  await page.locator("#presentButton").click();
  assert.equal(await page.locator(".panel").isVisible(), false);
  await page.screenshot({ path: output + "/classroom.png" });
  await page.locator("#presentButton").click();
  await setEntries(
      Array.from({ length: 200 }, (_, i) => "Participant " + (i + 1)).join(
        "\n",
      ),
    );
  await page.screenshot({ path: output + "/200.png", fullPage: true });
  await page.locator("#spinButton").click();
  await page.waitForSelector("#winnerDialog[open]");
  await page.locator("#closeWinner").click();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: pointer, locks, removal, undo, no-repeat, exhaustion, reload, restore, duplicates, limits, XSS, import/export, dark, classroom, 200 entries; no JS errors.",
  );
  await browser.close();
  server.close();
  console.log("Captures i còpia exportada:", output);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
