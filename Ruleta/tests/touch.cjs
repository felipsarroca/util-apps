const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const output = require("node:fs").mkdtempSync(
  path.join(require("node:os").tmpdir(), "ruleta-touch-"),
);
const url = require("node:url").pathToFileURL(
  path.resolve(__dirname, "../index.html"),
).href;
(async () => {
  const b = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || "chrome",
  });
  const c = await b.newContext({ hasTouch: true, deviceScaleFactor: 1.25 });
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  for (const [w, h] of [
    [1920, 1080],
    [1080, 1240],
    [1366, 740],
    [1093, 592],
    [911, 493],
    [390, 844],
    [320, 568],
  ]) {
    await p.setViewportSize({ width: w, height: h });
    await p.waitForTimeout(150);
    const m = await p.evaluate(() => ({
      w: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      panel: document.querySelector(".panel").getBoundingClientRect().toJSON(),
      spin: document
        .querySelector("#spinButton")
        .getBoundingClientRect()
        .toJSON(),
      footer: document.querySelector("footer").getBoundingClientRect().top,
      wheel: document.querySelector(".wheel-wrap").clientWidth,
    }));
    assert.equal(m.overflow, false);
    if (w >= 900) {
      assert(m.panel.bottom <= m.footer);
      assert(m.spin.bottom <= m.footer);
    }
    console.log(JSON.stringify(m));
    await p.screenshot({ path: output + "/new-" + w + ".png" });
  }
  await p.setViewportSize({ width: 1366, height: 740 });
  await p.emulateMedia({ reducedMotion: "reduce" });
  await p.locator("#spinButton").tap();
  await p.waitForSelector("#winnerDialog[open]");
  await p.screenshot({ path: output + "/new-popup.png" });
  await p.locator("#closeWinner").tap();
  assert.equal(await p.locator("#winnerDialog").isVisible(), false);
  await p.locator("#hubButton").tap();
  await p.waitForSelector("#winnerDialog[open]");
  await p.locator("#againButton").tap();
  await p.waitForSelector("#winnerDialog[open]");
  await p.locator("#removeButton").tap();
  assert.equal(await p.locator("#entryCount").textContent(), "7");
  await p.locator("#undoButton").tap();
  assert.equal(await p.locator("#entryCount").textContent(), "8");
  await p.locator("#noRepeatToggle").tap();
  assert(await p.locator("#noRepeatToggle").isChecked());
  await p.locator("#tab-settings").tap();
  await p.locator("#durationInput").selectOption("3");
  await p.locator("#tab-entries").tap();
  await p.emulateMedia({ reducedMotion: "no-preference" });
  await p.locator("#spinButton").tap();
  await p.locator("#spinButton").tap({ force: true });
  await p.waitForSelector("#winnerDialog[open]");
  assert.equal(await p.locator("#entryCount").textContent(), "7");
  await p.locator("#closeWinner").tap();
  assert.deepEqual(errors, []);
  await b.close();
  console.log("PASS touch, layouts, double tap, no JS errors");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
