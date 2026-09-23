const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const versionsPath = path.join(__dirname, "tool-versions.json");
const versions = JSON.parse(fs.readFileSync(versionsPath, "utf8"));
const currentYtDlpVersion = versions.ytDlp?.version;

async function checkLatestYtDlpRelease() {
  const url = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "DescarregApp-HealthCheck"
    }
  });

  if (!res.ok) {
    throw new Error(`GitHub API ha retornat el codi ${res.status}`);
  }

  const data = await res.json();
  const latestVersion = (data.tag_name || "").trim().replace(/^v/, "");
  return {
    latestVersion,
    releaseUrl: data.html_url,
    publishedAt: data.published_at,
    hasNewRelease: latestVersion && latestVersion !== currentYtDlpVersion
  };
}

function resolveYtDlpBin() {
  // 1. Argument explícit --bin <path>
  const binArgIndex = process.argv.indexOf("--bin");
  if (binArgIndex !== -1 && process.argv[binArgIndex + 1]) {
    return process.argv[binArgIndex + 1];
  }

  // 2. Recursos locals Windows
  if (process.platform === "win32") {
    const localWin = path.join(__dirname, "../resources/bin/win/yt-dlp.exe");
    if (fs.existsSync(localWin)) {
      return localWin;
    }
  }

  // 3. Ruta al PATH
  return "yt-dlp";
}

function testYoutubeDownload(ytDlpBin) {
  const probeFile = path.join(__dirname, `probe_${Date.now()}`);
  const testUrl = "https://www.youtube.com/watch?v=SSqgaFE9igo";

  try {
    const args = [
      "--ignore-config",
      "--no-playlist",
      "-f",
      "bv*+ba/b",
      "--download-sections",
      "*0-2",
      "-o",
      `${probeFile}.%(ext)s`,
      testUrl
    ];

    execFileSync(ytDlpBin, args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 45000,
      stdio: "pipe"
    });

    return { ok: true, error: null };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    return { ok: false, error: stderr };
  } finally {
    // Netejar qualsevol fitxer que s'hagi generat
    try {
      const dir = path.dirname(probeFile);
      const prefix = path.basename(probeFile);
      for (const file of fs.readdirSync(dir)) {
        if (file.startsWith(prefix)) {
          fs.rmSync(path.join(dir, file), { force: true });
        }
      }
    } catch (_) {}
  }
}

async function main() {
  console.log(`[HealthCheck] Versió actual a DescarregApp: ${currentYtDlpVersion}`);
  console.log("[HealthCheck] Consultant última versió a GitHub de yt-dlp...");

  let releaseInfo = null;
  try {
    releaseInfo = await checkLatestYtDlpRelease();
    console.log(`[HealthCheck] Última versió oficial de yt-dlp: ${releaseInfo.latestVersion}`);
    if (releaseInfo.hasNewRelease) {
      console.log(`[HealthCheck] ATENCIÓ: Hi ha una nova versió disponible (${releaseInfo.latestVersion})!`);
    } else {
      console.log("[HealthCheck] El motor està al dia amb l'última versió de yt-dlp.");
    }
  } catch (e) {
    console.warn(`[HealthCheck] Avís: No s'ha pogut consultar la versió de yt-dlp: ${e.message}`);
  }

  const ytDlpBin = resolveYtDlpBin();
  console.log(`[HealthCheck] Provant descàrrega de prova amb: ${ytDlpBin}...`);
  const downloadResult = testYoutubeDownload(ytDlpBin);

  if (downloadResult.ok) {
    console.log("[HealthCheck] Prova de descàrrega de YouTube: CORRECTA (sense error 403).");
  } else {
    console.error("[HealthCheck] ERROR: La descàrrega de prova de YouTube ha fallat!");
    console.error(downloadResult.error);
  }

  const result = {
    currentVersion: currentYtDlpVersion,
    latestVersion: releaseInfo?.latestVersion || null,
    hasNewRelease: Boolean(releaseInfo?.hasNewRelease),
    releaseUrl: releaseInfo?.releaseUrl || null,
    downloadOk: downloadResult.ok,
    downloadError: downloadResult.error
  };

  // Escriu a GitHub Output si s'executa a GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `current_version=${result.currentVersion}\n` +
      `latest_version=${result.latestVersion || ""}\n` +
      `has_new_release=${result.hasNewRelease}\n` +
      `release_url=${result.releaseUrl || ""}\n` +
      `download_ok=${result.downloadOk}\n`
    );
  }

  // Genera Step Summary per a GitHub Actions
  if (process.env.GITHUB_STEP_SUMMARY) {
    const statusIcon = result.downloadOk ? "✅ Correcte" : "❌ Error en descàrrega";
    const updateIcon = result.hasNewRelease ? `⚠️ Nova versió disponible (${result.latestVersion})` : "✅ Al dia";
    const summary = `
## Resum de salut de DescarregApp & yt-dlp

| Paràmetre | Estat | Detalls |
| --- | --- | --- |
| **Versió actual DescarregApp** | \`${result.currentVersion}\` | [tool-versions.json](DescarregApp/scripts/tool-versions.json) |
| **Última versió oficial yt-dlp** | \`${result.latestVersion || "Desconeguda"}\` | ${updateIcon} ${result.releaseUrl ? `([Releases](${result.releaseUrl}))` : ""} |
| **Prova descàrrega YouTube** | ${statusIcon} | ${result.downloadOk ? "Descàrrega validada sense bloqueig 403" : `Error: \`\`\`${result.downloadError}\`\`\``} |
`;
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }

  // Si la descàrrega falla, sortim amb codi d'error
  if (!downloadResult.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[HealthCheck] Error inesperat:", err);
  process.exit(1);
});
