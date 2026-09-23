const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const { ytDlp } = require("./tool-versions.json");
const samples = [
  { key: "youtube", name: "YouTube", url: "https://www.youtube.com/watch?v=SSqgaFE9igo" },
  { key: "cat3", name: "3Cat", url: "https://www.3cat.cat/3cat/apren-a-fer-el-video-de-lestiu/video/3593411/" }
];

function argumentValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function bundledTool(name) {
  const local = path.join(__dirname, "..", "resources", "bin", "win", `${name}.exe`);
  return process.platform === "win32" && fs.existsSync(local) ? local : name;
}

function classifyFailure(message) {
  if (/Sign in to confirm you.re not a bot|confirm.*not a bot|This content isn.t available.*account/i.test(message)) return "inconclusive";
  if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|Temporary failure in name resolution|Network is unreachable|timed out|CERTIFICATE_VERIFY_FAILED|not available in your country|geo.?restricted/i.test(message)) return "inconclusive";
  return "failed";
}

function probe(sample, format, tools) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "descarregapp-health-"));
  const runtime = path.basename(tools.deno) === tools.deno ? "deno" : `deno:${tools.deno}`;
  const ffmpegArgs = tools.ffmpeg === "ffmpeg" ? [] : ["--ffmpeg-location", tools.ffmpeg];
  const args = [
    "--ignore-config", "--quiet", "--no-warnings", "--js-runtimes", runtime, "--no-playlist",
    "--no-part", "--no-overwrites", ...ffmpegArgs,
    "--download-sections", "*0-2",
    "-o", path.join(directory, "probe.%(ext)s")
  ];
  if (format === "audio") args.push("-x", "--audio-format", "mp3", "--audio-quality", "320K");
  else args.push("-f", "bv*+ba/b", "-S", "res,fps,br", "--format-sort-force",
    "--merge-output-format", "mp4", "--remux-video", "mp4");
  args.push(sample.url);

  try {
    execFileSync(tools.ytDlp, args, { encoding: "utf8", windowsHide: true, timeout: 90000, maxBuffer: 4 * 1024 * 1024 });
    const extension = format === "audio" ? ".mp3" : ".mp4";
    const output = fs.readdirSync(directory).filter((name) => name.endsWith(extension));
    if (!output.some((name) => fs.statSync(path.join(directory, name)).size > 0)) {
      throw new Error("La descàrrega no ha generat cap fitxer.");
    }
    return { status: "ok", detail: "" };
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message).trim().slice(-1600);
    return { status: classifyFailure(detail), detail };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

async function latestEngine() {
  const response = await fetch("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest", {
    headers: { "User-Agent": "DescarregApp-HealthCheck" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`GitHub API: ${response.status}`);
  const release = await response.json();
  return { version: String(release.tag_name || "").replace(/^v/, ""), url: release.html_url };
}

function writeOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function main() {
  const tools = {
    ytDlp: argumentValue("--bin", bundledTool("yt-dlp")),
    deno: argumentValue("--deno", bundledTool("deno")),
    ffmpeg: argumentValue("--ffmpeg", bundledTool("ffmpeg"))
  };
  let release = null;
  try {
    release = await latestEngine();
    console.log(`yt-dlp inclòs: ${ytDlp.version}; últim oficial: ${release.version}`);
  } catch (error) {
    console.warn(`No s'ha pogut consultar l'última versió de yt-dlp: ${error.message}`);
  }
  writeOutput("current_version", ytDlp.version);
  writeOutput("latest_version", release?.version || "");
  writeOutput("release_url", release?.url || "");
  writeOutput("has_new_release", Boolean(release?.version && release.version !== ytDlp.version));

  const statuses = {};
  for (const sample of samples) {
    const results = ["video", "audio"].map((format) => {
      const result = probe(sample, format, tools);
      console.log(`${sample.name} ${format}: ${result.status}`);
      if (result.detail) console.error(result.detail);
      return result;
    });
    statuses[sample.key] = results.some((result) => result.status === "failed")
      ? "failed" : results.some((result) => result.status === "inconclusive") ? "inconclusive" : "ok";
    writeOutput(`${sample.key}_status`, statuses[sample.key]);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## DescarregApp: comprovació de descàrregues\n\n` +
      `Motor inclòs: ${ytDlp.version}. Últim oficial: ${release?.version || "desconegut"}.\n\n` +
      samples.map((sample) => `- ${sample.name}: **${statuses[sample.key]}** (vídeo i MP3).`).join("\n") + "\n"
    );
  }
  if (Object.values(statuses).includes("failed")) process.exitCode = 1;
  else if (Object.values(statuses).includes("inconclusive")) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
