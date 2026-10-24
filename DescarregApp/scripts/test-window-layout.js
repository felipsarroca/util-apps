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
  const submissions = [];
  let rejectSubmission = false;
  ipcMain.handle("downloads:start", (_event, payload) => {
    submissions.push(payload);
    if (rejectSubmission) throw new Error("Network unavailable");
    return { ok: true };
  });
  const win = new BrowserWindow({ show: false, webPreferences: {
    preload: path.join(__dirname, "../src/preload.js"), sandbox: false,
    backgroundThrottling: false
  } });
  win.setMenu(null);
  const listeners = screen.listenerCount("display-metrics-changed");
  const layout = attachAdaptiveLayout(win, screen);
  try {
    await win.loadFile(path.join(__dirname, "../src/renderer/index.html"));
    await win.webContents.executeJavaScript(`(async () => {
      state.destinationFolder = 'C:/Downloads';
      state.videoFormat = 'avi';
      linksInput.value = 'https://example.com/video';
      await startDownloads();
      const item = [...state.items.values()][0];
      applyDownloadUpdate({id: item.id, status: 'downloading', progress: 55, message: 'Descarregant'});
      const bar = document.querySelector('.progress-bar');
      applyDownloadUpdate({id: item.id, status: 'downloading', progress: 50, message: 'Descarregant'});
      if (document.querySelector('.progress-bar') !== bar) throw new Error('Progress bar replaced');
      if (state.items.get(item.id).progress !== 55) throw new Error('Progress went backwards');
      applyDownloadUpdate({id: item.id, status: 'completed', progress: 100, message: 'Completat'});
      if (!document.querySelector('.status-completed')) throw new Error('Completed status missing');
      applyDownloadUpdate({id: item.id, status: 'error', progress: 100,
        message: 'Ha fallat el processament final del fitxer.', details: 'Conversion failed'});
      applyDownloadUpdate({status: 'queue-completed', message: ''});
      state.videoFormat = 'mkv';
    })()`);
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
    await win.webContents.executeJavaScript(`(async () => {
      const id = [...state.items.keys()][0];
      await Promise.all([retryDownload(id), retryDownload(id)]);
    })()`);
    assert.equal(submissions.length, 2, "double click must enqueue once");
    assert.deepEqual(submissions[1], submissions[0], "retry keeps URL, ID, format and destination");
    rejectSubmission = true;
    await win.webContents.executeJavaScript(`(async () => {
      const id = [...state.items.keys()][0];
      applyDownloadUpdate({ id, status: 'error', details: 'Failure' });
      await retryDownload(id);
      if (state.items.get(id).status !== 'error') throw new Error('IPC failure must remain retryable');
      if (state.isRunning) throw new Error('Failed submission must release queue state');
      if (!document.querySelector('.result-status button')) throw new Error('Missing retry button');
    })()`);
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
