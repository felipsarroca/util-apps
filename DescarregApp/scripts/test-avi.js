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
  const fixtureDir = path.join(dir, "fixtures");
  const outputDir = path.join(dir, "output");
  fs.mkdirSync(fixtureDir);
  fs.mkdirSync(outputDir);
  const bin = path.resolve(__dirname, "../resources/bin/win");
  const ffmpeg = path.join(bin, "ffmpeg.exe");
  const source = path.join(fixtureDir, "source.webm");
  const mp4Source = path.join(fixtureDir, "source.mp4");
  const electron = {
    app: { disableHardwareAcceleration() {}, commandLine: { appendSwitch() {} },
      whenReady: () => ({ then() {} }), on() {} },
    ipcMain: { handle() {} }
  };
  const events = [];
  const context = vm.createContext({ require: name => name === "electron" ? electron : require(name), process,
    record: event => events.push(event) });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/main.js"), "utf8"), context);
  vm.runInContext("mainWindow = { isDestroyed: () => false, webContents: { send: (_channel, event) => record(event) } }", context);
  await execFile(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25",
    "-f", "lavfi", "-i", "sine=frequency=440", "-t", "1", "-c:v", "libvpx-vp9", "-c:a", "libopus", source]);
  await assert.rejects(execFile(ffmpeg, ["-v", "error", "-i", source, "-c", "copy", path.join(dir, "old.avi")]),
    "The old copy-only conversion fails with this modern codec combination");
  await execFile(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25",
    "-f", "lavfi", "-i", "sine=frequency=440", "-t", "1", "-c:v", "libx264",
    "-c:a", "aac", mp4Source]);
  const server = http.createServer((req, res) => {
    const file = req.url === "/source.mp4" ? mp4Source : source;
    res.writeHead(200, { "Content-Type": file === mp4Source ? "video/mp4" : "video/webm",
      "Content-Length": fs.statSync(file).size });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    context.outputDir = outputDir;
    context.toolPaths = { ytDlp: path.join(bin, "yt-dlp.exe"), deno: path.join(bin, "deno.exe"),
      ffmpeg, ffmpegLocation: bin };
    for (const [format, videoFormat, sourceName, extension] of [
      ["video", "avi", "source.webm", "avi"],
      ["video", "mkv", "source.webm", "mkv"],
      ["video", "mp4", "source.mp4", "mp4"],
      ["audio", "mp4", "source.webm", "mp3"]
    ]) {
      events.length = 0;
      context.downloadUrl = `${baseUrl}/${sourceName}`;
      context.format = format;
      context.videoFormat = videoFormat;
      await vm.runInContext(`runDownload({ item: { id: "integration", url: downloadUrl },
        options: { outputFormat: format, destinationFolder: outputDir,
          audioBitrate: "320", videoFormat } }, toolPaths)`, context);
      const output = path.join(outputDir, `source.${extension}`);
      assert.equal(events.at(-1).status, "completed", `${extension} did not finish: ${events.at(-1).details || events.at(-1).message}`);
      assert.ok(fs.statSync(output).size > 0, `${extension} output is empty`);
      assert.equal(events.at(-1).progress, 100);
      assert.ok(events.filter(event => event.status === "downloading")
        .every(event => event.progress === undefined || event.progress < 100));
      const conversion = events.filter(event => event.message === "Convertint el vídeo");
      if (extension === "avi") {
        assert.ok(conversion.some(event => event.progress > 60 && event.progress < 100),
          "Conversion must emit measured intermediate progress");
      }
      const { stderr } = await execFile(ffmpeg, ["-i", output, "-f", "null", "-"]);
      if (extension === "avi") {
        assert.match(stderr, /Video: mpeg4/);
        assert.match(stderr, /Audio: mp3/);
      }
      console.log(`${extension.toUpperCase()} generated and fully decoded.`);
    }
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
