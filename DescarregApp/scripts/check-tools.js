const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const versions = require("./tool-versions.json");

const toolsDir = path.join(__dirname, "../resources/bin/win");
for (const [name, args] of [["yt-dlp", ["--version"]], ["deno", ["--version"]], ["ffmpeg", ["-version"]]]) {
  const file = path.join(toolsDir, `${name}.exe`);
  if (name === "yt-dlp") {
    const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    if (hash !== versions.ytDlp.sha256) {
      throw new Error("El motor yt-dlp no coincideix amb la versió validada. Executa npm run tools:download.");
    }
  }
  const output = execFileSync(file, args, { encoding: "utf8", windowsHide: true, timeout: 30000 });
  console.log(`${name}: ${output.split(/\r?\n/)[0]}`);
}
