// Local integration test: real yt-dlp and FFmpeg, no external media required.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const vm = require("node:vm");
const { promisify } = require("node:util");
const execFile = promisify(require("node:child_process").execFile);

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "descarregapp-avi-"));
  const bin = path.resolve(__dirname, "../resources/bin/win");
  const ffmpeg = path.join(bin, "ffmpeg.exe");
  const source = path.join(dir, "source.webm");
  const electron = {
    app: { disableHardwareAcceleration() {}, commandLine: { appendSwitch() {} },
      whenReady: () => ({ then() {} }), on() {} },
    ipcMain: { handle() {} }
  };
  const context = vm.createContext({ require: name => name === "electron" ? electron : require(name), process });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/main.js"), "utf8"), context);
  await execFile(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25",
    "-f", "lavfi", "-i", "sine=frequency=440", "-t", "1", "-c:v", "libvpx-vp9", "-c:a", "libopus", source]);
  await assert.rejects(execFile(ffmpeg, ["-v", "error", "-i", source, "-c", "copy", path.join(dir, "old.avi")]),
    "The old copy-only conversion fails with this modern codec combination");
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "video/webm", "Content-Length": fs.statSync(source).size });
    fs.createReadStream(source).pipe(res);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/source.webm`;
    const tools = { deno: path.join(bin, "deno.exe"), ffmpegLocation: bin };
    const args = context.buildYtDlpArgs(url, "video", dir, tools, "320", "avi");
    await execFile(path.join(bin, "yt-dlp.exe"), args, { maxBuffer: 1024 * 1024 });
    const avi = path.join(dir, "source.avi");
    assert.ok(fs.statSync(avi).size > 0);
    const { stderr } = await execFile(ffmpeg, ["-i", avi, "-f", "null", "-"]);
    assert.match(stderr, /Video: mpeg4/);
    assert.match(stderr, /Audio: mp3/);
    console.log("AVI generated and fully decoded: MPEG-4 video + MP3 audio.");
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
