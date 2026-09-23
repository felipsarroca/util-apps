const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

async function check(releases, silent, networkError = false) {
  const dialogs = [];
  const statuses = [];
  const electron = {
    app: {
      disableHardwareAcceleration() {}, commandLine: { appendSwitch() {} },
      whenReady: () => ({ then() {} }), on() {}, getVersion: () => "1.4.0",
      isPackaged: true
    },
    net: { fetch: async () => {
      if (networkError) throw new Error("Sense connexió");
      return { ok: true, json: async () => releases };
    } },
    dialog: { showMessageBox: async (_window, options) => {
      dialogs.push(options);
      return { response: 1 };
    } },
    ipcMain: { handle() {} }
  };
  const context = vm.createContext({
    require: name => name === "electron" ? electron : require(name),
    process, __dirname: path.join(__dirname, "../src"), console: { warn() {} }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/main.js"), "utf8"), context);
  vm.runInContext("mainWindow = { isDestroyed: () => false, webContents: { send: (_channel, value) => record(value) } }", Object.assign(context, { record: value => statuses.push(value) }));
  await vm.runInContext(`checkForAppUpdate({ silent: ${silent} })`, context);
  return { dialogs, statuses };
}

const release = (version) => ({
  tag_name: `descarregapp-v${version}`, draft: false, prerelease: false,
  assets: [{ name: "DescarregApp-Setup.exe", size: 10 }]
});

test("l'inici no interromp si ja és l'última versió", async () => {
  const result = await check([release("1.4.0")], true);
  assert.equal(result.dialogs.length, 0);
  assert.equal(result.statuses.length, 0);
});

test("l'inici avisa si hi ha una versió superior", async () => {
  const result = await check([release("1.5.0")], true);
  assert.equal(result.dialogs.length, 1);
  assert.match(result.dialogs[0].message, /1\.5\.0/);
});

test("l'error de xarxa en iniciar no obre cap avís", async () => {
  const result = await check([], true, true);
  assert.equal(result.dialogs.length, 0);
  assert.equal(result.statuses.length, 0);
});

test("la comprovació manual informa que l'app està actualitzada", async () => {
  const result = await check([release("1.4.0")], false);
  assert.equal(result.dialogs.length, 1);
  assert.match(result.dialogs[0].message, /última versió/);
});
