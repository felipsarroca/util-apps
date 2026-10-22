// Run with: electron scripts/test-window-layout.js
const { app, BrowserWindow, ipcMain, screen } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { attachAdaptiveLayout } = require("../src/window-layout");

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
const output = path.join(__dirname, "../out/layout-check");
app.setPath("userData", path.join(app.getPath("temp"), "descarregapp-layout-profile"));

app.whenReady().then(async () => {
  fs.mkdirSync(output, { recursive: true });
  ipcMain.handle("app:info", () => ({ version: require("../package.json").version }));
  ipcMain.handle("preferences:get", () => ({ destinationFolder: "C:\\Downloads" }));
  ipcMain.handle("preferences:save", () => ({}));
  ipcMain.handle("tools:status", () => ({ ok: true }));
  const win = new BrowserWindow({ show: false, webPreferences: {
    preload: path.join(__dirname, "../src/preload.js"), sandbox: false,
    backgroundThrottling: false
  } });
  win.setMenu(null);
  const listeners = screen.listenerCount("display-metrics-changed");
  const layout = attachAdaptiveLayout(win, screen);
  try {
    await win.loadFile(path.join(__dirname, "../src/renderer/index.html"));
    // Content sizes exclude taskbar, title bar and application menu.
    for (const [name, width, height] of [
      ["desktop", 1920, 980],
      ["laptop-1366", 1366, 660],
      ["laptop-125-percent", 1093, 530],
      ["portrait", 1090, 1180],
      ["small-window", 800, 440],
      ["desktop-restored", 1920, 980]
    ]) {
      win.setContentSize(width, height);
      // A native resize and Chromium layout/paint run asynchronously.
      await new Promise(resolve => setTimeout(resolve, 250));
      const metrics = await win.webContents.executeJavaScript(`(() => {
        const root = document.documentElement;
        const panel = document.querySelector('.main-panel').getBoundingClientRect();
        const results = document.querySelector('.results-panel').getBoundingClientRect();
        const footer = document.querySelector('.license-footer').getBoundingClientRect();
        return { width: innerWidth, height: innerHeight,
          scrollWidth: root.scrollWidth, scrollHeight: root.scrollHeight,
          columns: results.left > panel.right, footerBottom: footer.bottom };
      })()`);
      console.log(name, JSON.stringify({ zoom: win.webContents.getZoomFactor(), ...metrics }));
      fs.writeFileSync(path.join(output, `${name}.png`), (await win.webContents.capturePage()).toPNG());
      assert.ok(metrics.scrollWidth <= metrics.width + 1, `${name}: horizontal overflow`);
      if (name !== "small-window") {
        assert.ok(metrics.columns, `${name}: two columns must remain visible`);
        assert.ok(metrics.footerBottom <= metrics.height + 1, `${name}: footer outside viewport`);
        assert.ok(metrics.scrollHeight <= metrics.height + 1, `${name}: unexpected vertical overflow`);
      }
      if (name.startsWith("desktop")) assert.equal(win.webContents.getZoomFactor(), 1);
    }
    win.webContents.setZoomFactor(1.2);
    win.setContentSize(1366, 660);
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal(win.webContents.getZoomFactor(), 1.2, "preserve manual accessibility zoom");
    layout.reset();
    assert.ok(win.webContents.getZoomFactor() < 1, "restore automatic fitting");
    win.destroy();
    assert.equal(screen.listenerCount("display-metrics-changed"), listeners);
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
}).catch(error => { console.error(error); app.exit(1); });
