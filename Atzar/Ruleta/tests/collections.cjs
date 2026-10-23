const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const path = require("node:path"),
  fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || "chrome",
  });
  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    require("node:url").pathToFileURL(path.resolve(__dirname, "../index.html"))
      .href,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  const stored = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("felip.ruleta.v2")));
  await page.locator("#entriesInput").fill("Anna\nBiel\nClàudia");
  await page.locator("#savedClasses summary").click();
  await page.locator("#className").fill("2n A");
  await page.locator("#saveClassButton").click();
  assert.equal((await stored()).classes.length, 1);
  await page.locator("#noRepeatToggle").check();
  await page.locator("#spinButton").tap();
  await page.waitForSelector("#winnerDialog[open]");
  await page.locator("#closeWinner").click();
  assert.equal((await stored()).entries.length, 2);
  await page.locator("#saveClassButton").click();
  assert.equal((await stored()).classes[0].entries.length, 3);
  await page.getByRole("button", { name: "2n A", exact: true }).tap();
  assert.equal((await stored()).entries.length, 3);
  await page.locator("#undoButton").click();
  assert.equal((await stored()).entries.length, 2);
  await page.reload();
  assert((await page.locator("#savedClasses").getAttribute("open")) !== null);
  await page.getByRole("button", { name: "2n A", exact: true }).click();
  assert.equal((await stored()).entries.length, 3);
  await page.locator("#entriesInput").fill("Duna\nEmma");
  await page.locator("#className").fill("3r B");
  await page.locator("#saveClassButton").click();
  await page.getByRole("button", { name: "2n A", exact: true }).click();
  assert.deepEqual((await stored()).entries, ["Anna", "Biel", "Clàudia"]);
  await page.locator("#libraryButton").click();
  await page.locator("#themeCategory").selectOption("__favorites");
  assert.equal(await page.locator(".theme-card").count(), 0);
  assert(await page.locator("#loadThemeButton").isDisabled());
  await page.locator("#themeCategory").selectOption("");
  const ids = await page
    .locator(".theme-star")
    .evaluateAll((a) => a.slice(0, 2).map((x) => x.dataset.favorite));
  for (const id of ids) await page.locator(`[data-favorite="${id}"]`).tap();
  assert.equal((await stored()).favorites.length, 2);
  await page.locator("#themeCategory").selectOption("__favorites");
  assert.equal(await page.locator(".theme-card").count(), 2);
  await page.locator(`[data-favorite="${ids[0]}"]`).click();
  assert.equal(await page.locator(".theme-card").count(), 1);
  await page.reload();
  await page.locator("#libraryButton").click();
  await page.locator("#themeCategory").selectOption("__favorites");
  assert.equal(await page.locator(".theme-card").count(), 1);
  assert.equal(
    await page.locator(".theme-star").getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("#loadThemeButton").click();
  assert((await stored()).entries.length > 0);
  assert.equal((await stored()).classes.length, 2);
  await page.getByRole("button", { name: "3r B", exact: true }).click();
  assert.deepEqual((await stored()).entries, ["Duna", "Emma"]);
  await page
    .getByRole("button", { name: "Elimina la classe 2n A", exact: true })
    .click();
  assert.equal((await stored()).classes.length, 1);
  const output = fs.mkdtempSync(
    path.join(require("node:os").tmpdir(), "ruleta-collections-"),
  );
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [1093, 592],
    [911, 493],
    [390, 844],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    const icon = await page.locator(".brand-icon").boundingBox();
    assert.equal(icon.width, width <= 360 ? 30 : width <= 420 ? 38 : 60);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({ path: path.join(output, `main-${width}.png`) });
    await page.locator("#libraryButton").click();
    await page.locator("#themeCategory").selectOption("");
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    for (const selector of [
      ".theme-star",
      "#themeCategory",
      "#loadThemeButton",
    ]) {
      const r = await page.locator(selector).first().boundingBox();
      assert(r.height >= 44);
    }
    await page.screenshot({ path: path.join(output, `library-${width}.png`) });
    await page.locator("#closeLibrary").click();
  }
  await page.locator("#themeButton").click();
  await page.locator("#libraryButton").click();
  await page.screenshot({ path: path.join(output, "dark.png") });
  assert.deepEqual(errors, []);
  console.log(
    "PASS classes: save/update, full roster, load/undo, persistence, delete; favorites: toggle/filter/persistence/load; responsive and touch controls.",
  );
  console.log(output);
  await browser.close();
})();
