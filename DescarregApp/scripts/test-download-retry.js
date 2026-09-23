const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const { test } = require("node:test");

async function scenario(outcomes, cancel = false) {
  const events = [];
  let downloads = 0;
  let extracts = 0;
  let context;
  const electron = {
    app: { disableHardwareAcceleration() {}, commandLine: { appendSwitch() {} },
      whenReady: () => ({ then() {} }), on() {} },
    ipcMain: { handle() {} }
  };
  const spawn = (_file, args) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    const titleOnly = args.includes("--skip-download");
    if (titleOnly) extracts++;
    const outcome = titleOnly ? "" : outcomes[downloads++];
    process.nextTick(() => {
      child.stdout.end(titleOnly ? "Video de prova\n" : "");
      child.stderr.end(outcome || "");
      if (cancel && !titleOnly) vm.runInContext("cancelRequested = true", context);
      child.emit("close", outcome ? 1 : 0);
    });
    return child;
  };
  context = vm.createContext({
    require: name => name === "electron" ? electron : name === "child_process" ? { spawn } : require(name),
    process, __dirname: path.join(__dirname, "../src"),
    record: payload => events.push(payload)
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/main.js"), "utf8"), context);
  vm.runInContext("mainWindow = { isDestroyed: () => false, webContents: { send: (_channel, payload) => record(payload) } }", context);
  await vm.runInContext(`runDownload({item:{id:'test',url:'https://example.com/video'},options:{outputFormat:'video',destinationFolder:'.',audioBitrate:'320',videoFormat:'mp4'}},{ytDlp:'yt-dlp',deno:'deno',ffmpegLocation:'.'})`, context);
  return { downloads, extracts, events };
}

test("403 renews extraction once and can complete", async () => {
  const result = await scenario(["ERROR: HTTP Error 403: Forbidden", ""]);
  assert.equal(result.downloads, 2);
  assert.equal(result.extracts, 2);
  assert.equal(result.events.at(-1).status, "completed");
  assert.equal(result.events.filter(event => event.status === "error").length, 0);
});

test("persistent 403 stops after two attempts", async () => {
  const result = await scenario(["ERROR: HTTP Error 403", "ERROR: HTTP Error 403"]);
  assert.equal(result.downloads, 2);
  assert.equal(result.events.at(-1).status, "error");
  assert.match(result.events.at(-1).details, /403/);
});

test("other failures are not retried", async () => {
  const result = await scenario(["ERROR: Video unavailable"]);
  assert.equal(result.downloads, 1);
  assert.equal(result.events.at(-1).status, "error");
});

test("cancellation takes priority over retry", async () => {
  const result = await scenario(["ERROR: HTTP Error 403"], true);
  assert.equal(result.downloads, 1);
  assert.equal(result.events.at(-1).status, "canceled");
});
