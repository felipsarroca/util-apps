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

function resolveDenoBin() {
  const denoArgIndex = process.argv.indexOf("--deno");
  if (denoArgIndex !== -1 && process.argv[denoArgIndex + 1]) {
    return process.argv[denoArgIndex + 1];
  }

  if (process.platform === "win32") {
    const localWin = path.join(__dirname, "../resources/bin/win/deno.exe");
    if (fs.existsSync(localWin)) {
      return localWin;
    }
  }

  return "deno";
}

function testYoutubeDownload(ytDlpBin) {
  const probeFile = path.join(__dirname, `probe_${Date.now()}`);
  const testUrl = "https://www.youtube.com/watch?v=SSqgaFE9igo";
  const denoBin = resolveDenoBin();

  try {
    const args = [
      "--ignore-config",
      "--js-runtimes",
      denoBin,
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

  let is403Forbidden = false;
  let isDatacenterBotCheck = false;

  if (downloadResult.ok) {
    console.log("[HealthCheck] Prova de descàrrega de YouTube: CORRECTA (sense error 403).");
  } else {
    const errText = downloadResult.error || "";
    is403Forbidden = /HTTP Error 403/i.test(errText);
    isDatacenterBotCheck = /Sign in to confirm you['’]re not a bot/i.test(errText);

    if (is403Forbidden) {
      console.error("[HealthCheck] ERROR CRÍTIC: S'ha detectat HTTP Error 403: Forbidden (incompatibilitat de YouTube/client)!");
    } else if (isDatacenterBotCheck) {
      console.warn("[HealthCheck] AVÍS: YouTube ha demanat confirmació anti-bot per IP de datacenter (GitHub Actions). No és un error 403.");
    } else {
      console.error("[HealthCheck] ERROR: La descàrrega ha fallat amb un error no previst.");
    }
    console.error(downloadResult.error);
  }

  const result = {
    currentVersion: currentYtDlpVersion,
    latestVersion: releaseInfo?.latestVersion || null,
    hasNewRelease: Boolean(releaseInfo?.hasNewRelease),
    releaseUrl: releaseInfo?.releaseUrl || null,
    downloadOk: downloadResult.ok,
    is403Forbidden,
    isDatacenterBotCheck,
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
      `download_ok=${result.downloadOk}\n` +
      `is_403_forbidden=${result.is403Forbidden}\n` +
      `is_datacenter_bot=${result.isDatacenterBotCheck}\n`
    );
  }

  // Genera Step Summary per a GitHub Actions
  if (process.env.GITHUB_STEP_SUMMARY) {
    let statusText = "✅ Correcte (sense error 403)";
    if (result.is403Forbidden) {
      statusText = "❌ ERROR CRÍTIC: HTTP 403 Forbidden detectat";
    } else if (result.isDatacenterBotCheck) {
      statusText = "ℹ️ Limitació de xarxa: Bot check per IP de datacenter de GitHub Actions (ignorat com a fals positiu)";
    } else if (!result.downloadOk) {
      statusText = "⚠️ Error durant la descàrrega";
    }

    const updateIcon = result.hasNewRelease ? `⚠️ Nova versió disponible (${result.latestVersion})` : "✅ Al dia";
    const summary = `
## Resum de salut de DescarregApp & yt-dlp

| Paràmetre | Estat | Detalls |
| --- | --- | --- |
| **Versió actual DescarregApp** | \`${result.currentVersion}\` | [tool-versions.json](DescarregApp/scripts/tool-versions.json) |
| **Última versió oficial yt-dlp** | \`${result.latestVersion || "Desconeguda"}\` | ${updateIcon} ${result.releaseUrl ? `([Releases](${result.releaseUrl}))` : ""} |
| **Prova descàrrega YouTube** | ${statusText} | ${result.downloadOk ? "Descàrrega validada" : (result.is403Forbidden ? "Cal actualitzar el motor!" : "Sense bloqueig 403")} |
`;
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }

  // Només fem fallar el procés si hi ha un error 403 real
  if (is403Forbidden) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[HealthCheck] Error inesperat:", err);
  process.exit(1);
});
