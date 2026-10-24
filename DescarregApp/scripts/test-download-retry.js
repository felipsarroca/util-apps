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
    const stderr = typeof outcome === "object" ? outcome.stderr || "" : outcome || "";
    const stdout = typeof outcome === "object" ? outcome.stdout || "" : "";
    process.nextTick(() => {
      child.stdout.end(titleOnly ? "Video de prova\n" : stdout);
      child.stderr.end(stderr);
      if (cancel && !titleOnly) vm.runInContext("cancelRequested = true", context);
      child.emit("close", stderr ? 1 : 0);
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

test("progress never goes backwards or reaches 100 before conversion finishes", async () => {
  const result = await scenario([{
    stdout: [
      'DOWNLOADS:[{"filesize":100},{"filesize":100}]',
      'PROGRESS:40.0%', 'PROGRESS:39.0%', 'PROGRESS:100.0%',
      'PROGRESS:1.0%', 'PROGRESS:0.5%', 'PROGRESS:100.0%',
      '[VideoConvertor] Converting video'
    ].join('\n') + '\n'
  }]);
  const progress = result.events.filter(event => event.progress !== undefined && event.status === "downloading")
    .map(event => event.progress);
  assert.deepEqual(progress, [...progress].sort((a, b) => a - b));
  assert.ok(progress.every(value => value < 100));
  assert.equal(result.events.at(-2).message, "Convertint el vídeo. Pot trigar uns minuts.");
  assert.equal(result.events.at(-1).status, "completed");
  assert.equal(result.events.at(-1).progress, 100);
});

test("100 percent transfer followed by a processing error is not completed", async () => {
  const result = await scenario([{
    stdout: 'PROGRESS:100.0%\n[VideoConvertor] Converting video\n',
    stderr: 'ERROR: Postprocessing: Conversion failed!'
  }]);
  assert.ok(result.events.filter(event => event.status === "downloading")
    .every(event => event.progress === undefined || event.progress < 100));
  assert.equal(result.events.at(-1).status, "error");
});
