const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || "chrome",
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const proto = CanvasRenderingContext2D.prototype;
    const clear = proto.clearRect,
      fill = proto.fillText;
    proto.clearRect = function (...args) {
      if (this.canvas.id === "wheelCanvas") window.labels = [];
      return clear.apply(this, args);
    };
    proto.fillText = function (text, x, y, ...args) {
      if (this.canvas.id === "wheelCanvas") {
        const m = this.measureText(text);
        window.labels.push({
          text,
          x,
          y,
          left: x - m.actualBoundingBoxLeft,
          right: x + m.actualBoundingBoxRight,
          top: y - m.actualBoundingBoxAscent,
          bottom: y + m.actualBoundingBoxDescent,
          font: parseFloat(this.font.match(/[\d.]+px/)[0]),
          radius: this.canvas.width / 2,
        });
      }
      return fill.call(this, text, x, y, ...args);
    };
  });
  await page.goto(pathToFileURL(path.resolve(__dirname, "../index.html")).href);
  const output = fs.mkdtempSync(
    path.join(require("node:os").tmpdir(), "ruleta-labels-"),
  );
  const examples = [
    "Una aventura al bosc",
    "Què faries per millorar el pati de la teva escola?",
    "Explica una descoberta sorprenent",
    "Anna",
    "Una ciutat sense cotxes",
    "Inventa un final diferent per a aquesta història",
    "Àngels i Núria",
    "Un invent per cuidar el planeta",
  ];
  let wrapped = false,
    shortened = false;
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [1093, 592],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const count of [1, 2, 3, 6, 8, 12, 20, 48, 60, 200]) {
      const entries = Array.from(
        { length: count },
        (_, i) => examples[i % examples.length],
      );
      await page.locator("#entriesInput").fill(entries.join("\n"));
      await page.waitForTimeout(120);
      const labels = await page.evaluate(() => window.labels);
      assert(
        labels.length >=
          (count > 48 ? Math.floor(count / Math.ceil(count / 40)) : count),
      );
      if (count <= 48)
        for (const l of labels) {
          assert(l.text, "No empty labels");
          wrapped ||= l.y !== 0;
          shortened ||= l.text.includes("…");
          for (const x of [l.left, l.right])
            for (const y of [l.top, l.bottom]) {
              assert(
                Math.hypot(x, y) < l.radius,
                `Outside circle ${count}: ${l.text}`,
              );
              if (count > 2)
                assert(
                  Math.abs(Math.atan2(y, x)) < Math.PI / count,
                  `Outside wedge ${count}: ${l.text}`,
                );
            }
          assert(l.left > l.radius * 0.19, `Under hub: ${l.text}`);
        }
      if (count === 8)
        await page.screenshot({ path: path.join(output, `${width}.png`) });
    }
  }
  assert(wrapped, "Some labels should wrap");
  assert(shortened, "Long labels should shorten");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: complete, wrapped and shortened labels stay inside sectors; dense wheels retain numeric references.",
  );
  console.log(output);
  await browser.close();
})();
