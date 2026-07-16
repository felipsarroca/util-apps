const { app, BrowserWindow, dialog, ipcMain, Menu, net, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

const APP_NAME = "DescarregApp";
const RELEASES_API_URL = "https://api.github.com/repos/felipsarroca/util-apps/releases?per_page=100";
const RELEASE_TAG_PATTERN = /^descarregapp-v(\d+\.\d+\.\d+)$/i;
const INSTALLER_ASSET_NAME = "DescarregApp-Setup.exe";

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("disable-gpu-sandbox");

let mainWindow;
let queueRunning = false;
let cancelRequested = false;
let activeDownload = null;
let updateRunning = false;
const downloadQueue = [];

function getPlatformFolder() {
  if (process.platform === "win32") {
    return "win";
  }

  if (process.platform === "darwin") {
    return "mac";
  }

  return "linux";
}

function getToolFileName(toolName) {
  if (process.platform === "win32") {
    return `${toolName}.exe`;
  }

  return toolName;
}

function getBundledToolsDir() {
  const platformFolder = getPlatformFolder();

  if (app.isPackaged) {
    return path.join(process.resourcesPath, "bin", platformFolder);
  }

  return path.join(app.getAppPath(), "resources", "bin", platformFolder);
}

function getToolPath(toolName) {
  const bundledPath = path.join(getBundledToolsDir(), getToolFileName(toolName));

  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  return toolName;
}

function getToolPaths() {
  const ffmpeg = getToolPath("ffmpeg");

  return {
    ytDlp: getToolPath("yt-dlp"),
    deno: getToolPath("deno"),
    ffmpeg,
    ffmpegLocation: path.basename(ffmpeg) === ffmpeg ? ffmpeg : path.dirname(ffmpeg)
  };
}

function getYtDlpRuntimeArgs(tools) {
  const denoRuntime = path.basename(tools.deno) === tools.deno
    ? "deno"
    : `deno:${tools.deno}`;

  return [
    "--encoding",
    "utf-8",
    "--js-runtimes",
    denoRuntime
  ];
}

function getConfigPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function getDefaultPreferences() {
  return {
    outputFormat: "video",
    audioBitrate: "320",
    videoFormat: "mp4",
    destinationFolder: app.getPath("downloads")
  };
}

function loadPreferences() {
  const configPath = getConfigPath();

  try {
    if (!fs.existsSync(configPath)) {
      return getDefaultPreferences();
    }

    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return {
      ...getDefaultPreferences(),
      ...parsed
    };
  } catch (error) {
    return getDefaultPreferences();
  }
}

function savePreferences(preferences) {
  const current = loadPreferences();
  const next = {
    ...current,
    ...preferences
  };

  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

function sendAppStatus(message) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("app:status", message);
}

function parseVersion(version) {
  const parts = String(version).split(".").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    return null;
  }

  return parts;
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);

  if (!leftParts || !rightParts) {
    return 0;
  }

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }

  return 0;
}

async function getLatestAppRelease() {
  const response = await net.fetch(RELEASES_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `${APP_NAME}/${app.getVersion()}`
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub ha respost amb el codi ${response.status}.`);
  }

  const releases = await response.json();
  const candidates = releases
    .filter((release) => !release.draft && !release.prerelease)
    .map((release) => {
      const match = String(release.tag_name || "").match(RELEASE_TAG_PATTERN);
      if (!match) {
        return null;
      }

      const asset = release.assets?.find((item) => item.name === INSTALLER_ASSET_NAME);
      if (!asset) {
        return null;
      }

      return {
        version: match[1],
        pageUrl: release.html_url,
        asset
      };
    })
    .filter(Boolean)
    .sort((left, right) => compareVersions(right.version, left.version));

  return candidates[0] || null;
}

async function downloadInstaller(release) {
  const updateDir = path.join(app.getPath("temp"), `${APP_NAME}-update-${release.version}`);
  const installerPath = path.join(updateDir, INSTALLER_ASSET_NAME);
  await fs.promises.mkdir(updateDir, { recursive: true });

  const response = await net.fetch(release.asset.browser_download_url, {
    headers: {
      Accept: "application/octet-stream",
      "User-Agent": `${APP_NAME}/${app.getVersion()}`
    }
  });

  if (!response.ok || !response.body) {
    throw new Error(`No s'ha pogut descarregar l'instal·lador (codi ${response.status}).`);
  }

  const totalBytes = Number(response.headers.get("content-length")) || Number(release.asset.size) || 0;
  let downloadedBytes = 0;
  const source = Readable.fromWeb(response.body);

  source.on("data", (chunk) => {
    downloadedBytes += chunk.length;
    if (totalBytes > 0 && mainWindow && !mainWindow.isDestroyed()) {
      const progress = Math.min(1, downloadedBytes / totalBytes);
      mainWindow.setProgressBar(progress);
      sendAppStatus(`Descarregant l'actualització: ${Math.round(progress * 100)}%`);
    }
  });

  try {
    await pipeline(source, fs.createWriteStream(installerPath));
  } finally {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
    }
  }

  const stat = await fs.promises.stat(installerPath);
  if (release.asset.size && stat.size !== release.asset.size) {
    await fs.promises.rm(installerPath, { force: true });
    throw new Error("La mida de l'instal·lador descarregat no coincideix amb la publicada.");
  }

  return installerPath;
}

async function checkForAppUpdate() {
  if (updateRunning) {
    sendAppStatus("Ja s'està comprovant o descarregant una actualització.");
    return;
  }

  updateRunning = true;
  sendAppStatus("Comprovant si hi ha actualitzacions...");

  try {
    const release = await getLatestAppRelease();
    const currentVersion = app.getVersion();

    if (!release || compareVersions(release.version, currentVersion) <= 0) {
      sendAppStatus(`DescarregApp ${currentVersion} està actualitzada.`);
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Actualització",
        message: "Ja tens l'última versió de DescarregApp.",
        detail: `Versió instal·lada: ${currentVersion}`
      });
      return;
    }

    if (!app.isPackaged) {
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Actualització disponible",
        message: `Hi ha disponible la versió ${release.version}.`,
        detail: "L'app s'està executant en mode de desenvolupament i no instal·larà l'actualització."
      });
      return;
    }

    if (queueRunning) {
      await dialog.showMessageBox(mainWindow, {
        type: "warning",
        title: "Descàrregues en curs",
        message: "Espera que acabi la cua abans d'actualitzar DescarregApp."
      });
      return;
    }

    const confirmation = await dialog.showMessageBox(mainWindow, {
      type: "question",
      buttons: ["Descarregar i instal·lar", "Ara no"],
      defaultId: 0,
      cancelId: 1,
      title: "Actualització disponible",
      message: `Hi ha disponible DescarregApp ${release.version}.`,
      detail: `Versió instal·lada: ${currentVersion}. L'app descarregarà l'instal·lador oficial de GitHub.`
    });

    if (confirmation.response !== 0) {
      sendAppStatus("Actualització ajornada.");
      return;
    }

    const installerPath = await downloadInstaller(release);
    const installConfirmation = await dialog.showMessageBox(mainWindow, {
      type: "question",
      buttons: ["Instal·lar ara", "Cancel·lar"],
      defaultId: 0,
      cancelId: 1,
      title: "Actualització preparada",
      message: `DescarregApp ${release.version} ja s'ha descarregat.`,
      detail: "L'aplicació es tancarà i s'obrirà l'instal·lador."
    });

    if (installConfirmation.response !== 0) {
      sendAppStatus("Actualització descarregada però no instal·lada.");
      return;
    }

    const installer = spawn(installerPath, [], {
      detached: true,
      stdio: "ignore"
    });
    installer.unref();
    app.quit();
  } catch (error) {
    sendAppStatus("No s'ha pogut completar l'actualització.");
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Error d'actualització",
      message: "No s'ha pogut comprovar o descarregar l'actualització.",
      detail: error.message
    });
  } finally {
    updateRunning = false;
  }
}

function setupApplicationMenu() {
  const template = [
    {
      label: "Fitxer",
      submenu: [
        {
          label: "Surt",
          role: "quit"
        }
      ]
    },
    {
      label: "Edita",
      submenu: [
        {
          label: "Desfés",
          role: "undo"
        },
        {
          label: "Refés",
          role: "redo"
        },
        { type: "separator" },
        {
          label: "Retalla",
          role: "cut"
        },
        {
          label: "Copia",
          role: "copy"
        },
        {
          label: "Enganxa",
          role: "paste"
        },
        {
          label: "Selecciona-ho tot",
          role: "selectAll"
        }
      ]
    },
    {
      label: "Visualització",
      submenu: [
        {
          label: "Recarrega",
          role: "reload"
        },
        {
          label: "Força la recàrrega",
          role: "forceReload"
        },
        { type: "separator" },
        {
          label: "Mida real",
          role: "resetZoom"
        },
        {
          label: "Amplia",
          role: "zoomIn"
        },
        {
          label: "Redueix",
          role: "zoomOut"
        },
        { type: "separator" },
        {
          label: "Pantalla completa",
          role: "togglefullscreen"
        }
      ]
    },
    {
      label: "Finestra",
      submenu: [
        {
          label: "Minimitza",
          role: "minimize"
        },
        {
          label: "Tanca",
          role: "close"
        }
      ]
    },
    {
      label: "Actualitza",
      submenu: [
        {
          label: "Comprova si hi ha actualitzacions",
          click: () => checkForAppUpdate()
        },
        { type: "separator" },
        {
          label: `Versió ${app.getVersion()}`,
          enabled: false
        }
      ]
    },
    {
      label: "Ajuda",
      submenu: [
        {
          label: "Web de Felip Sarroca",
          click: () => shell.openExternal("https://ja.cat/felipsarroca")
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 800,
    minWidth: 1040,
    minHeight: 680,
    title: APP_NAME,
    icon: path.join(app.getAppPath(), "assets", "icon.ico"),
    backgroundColor: "#f7f9fb",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.once("did-finish-load", () => {
    if (!mainWindow.isVisible()) {
      mainWindow.maximize();
      mainWindow.show();
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function sendDownloadEvent(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("download:update", payload);
}

function buildYtDlpArgs(url, format, destinationFolder, tools, audioBitrate, videoFormat) {
  const outputTemplate = path.join(destinationFolder, "%(title)s.%(ext)s");
  const commonArgs = [
    ...getYtDlpRuntimeArgs(tools),
    "--newline",
    "--no-color",
    "--no-playlist",
    "--progress",
    "--progress-template",
    "download:PROGRESS:%(progress._percent_str)s",
    "--ffmpeg-location",
    tools.ffmpegLocation
  ];

  if (format === "audio") {
    return [
      ...commonArgs,
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      `${audioBitrate}K`,
      "-o",
      outputTemplate,
      url
    ];
  }

  return [
    ...commonArgs,
    "-f",
    "bv*+ba/b",
    "-S",
    "res,fps,br",
    "--format-sort-force",
    "--print",
    "before_dl:FORMAT:%(format)s",
    "--print",
    "before_dl:DOWNLOADS:%(requested_formats)j",
    "--merge-output-format",
    videoFormat,
    "--remux-video",
    videoFormat,
    "-o",
    outputTemplate,
    url
  ];
}

function parseProgress(line) {
  const percentMatch = line.match(/(?:^PROGRESS:|\[download\]\s+)(?:\s*)([0-9]+(?:\.[0-9]+)?)%/);
  if (!percentMatch) {
    return null;
  }

  const value = Number(percentMatch[1]);
  if (Number.isNaN(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
}

function parseTitle(line) {
  const destinationMatch = line.match(/\[download\]\s+Destination:\s+(.+)$/);
  if (destinationMatch) {
    return path.basename(destinationMatch[1]);
  }

  const mergingMatch = line.match(/\[Merger\]\s+Merging formats into\s+"(.+)"$/);
  if (mergingMatch) {
    return path.basename(mergingMatch[1]);
  }

  return null;
}

function parseSelectedFormat(line) {
  const prefix = "FORMAT:";
  if (!line.startsWith(prefix)) {
    return null;
  }

  return line.slice(prefix.length).trim();
}

function parseDownloadWeights(line) {
  const prefix = "DOWNLOADS:";
  if (!line.startsWith(prefix)) {
    return null;
  }

  try {
    const formats = JSON.parse(line.slice(prefix.length));
    if (!Array.isArray(formats) || formats.length === 0) {
      return null;
    }

    return formats.map((format) => {
      const size = Number(format.filesize || format.filesize_approx);
      return Number.isFinite(size) && size > 0 ? size : 1;
    });
  } catch (error) {
    return null;
  }
}

function fetchTitle(url, tools) {
  return new Promise((resolve) => {
    const child = spawn(tools.ytDlp, [
      ...getYtDlpRuntimeArgs(tools),
      "--no-playlist",
      "--skip-download",
      "--print",
      "%(title)s",
      url
    ], {
      windowsHide: true
    });

    let output = "";
    child.stdout.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      output += chunk;
    });

    child.on("error", () => resolve(""));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve("");
        return;
      }

      const title = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)[0];

      resolve(title || "");
    });
  });
}

async function runDownload(job, tools) {
  const { item, options } = job;

  if (cancelRequested) {
    sendDownloadEvent({
      id: item.id,
      status: "canceled",
      progress: 0,
      message: "Cancel·lat"
    });
    return;
  }

  sendDownloadEvent({
    id: item.id,
    status: "downloading",
    progress: 0,
    message: "Llegint el títol"
  });

  const title = await fetchTitle(item.url, tools);
  if (title) {
    sendDownloadEvent({
      id: item.id,
      title,
      status: "downloading"
    });
  }

  return new Promise((resolve) => {
    const args = buildYtDlpArgs(
      item.url,
      options.outputFormat,
      options.destinationFolder,
      tools,
      options.audioBitrate,
      options.videoFormat
    );
    const child = spawn(tools.ytDlp, args, {
      windowsHide: true
    });

    activeDownload = child;

    let lastError = "";
    let completed = false;
    let selectedFormat = "";
    let downloadWeights = [1];
    let downloadPartIndex = 0;
    let lastRawProgress = 0;

    sendDownloadEvent({
      id: item.id,
      status: "downloading",
      progress: 0,
      message: "Iniciant descàrrega"
    });

    let stdoutBuffer = "";

    const processOutputLine = (line) => {
      const parsedTitle = parseTitle(line);
      const parsedFormat = parseSelectedFormat(line);
      const parsedWeights = parseDownloadWeights(line);
      const rawProgress = parseProgress(line);

      if (parsedTitle) {
        sendDownloadEvent({
          id: item.id,
          title: parsedTitle,
          status: "downloading"
        });
      }

      if (parsedFormat) {
        selectedFormat = parsedFormat;
        sendDownloadEvent({
          id: item.id,
          status: "downloading",
          message: `Format triat: ${parsedFormat}`
        });
      }

      if (parsedWeights) {
        downloadWeights = parsedWeights;
      }

      if (rawProgress !== null) {
        if (
          rawProgress + 1 < lastRawProgress
          && lastRawProgress >= 90
          && downloadPartIndex < downloadWeights.length - 1
        ) {
          downloadPartIndex += 1;
        }

        lastRawProgress = rawProgress;
        const totalWeight = downloadWeights.reduce((sum, weight) => sum + weight, 0);
        const completedWeight = downloadWeights
          .slice(0, downloadPartIndex)
          .reduce((sum, weight) => sum + weight, 0);
        const currentWeight = downloadWeights[downloadPartIndex] || 1;
        const overallProgress = totalWeight > 0
          ? ((completedWeight + (currentWeight * rawProgress / 100)) / totalWeight) * 100
          : rawProgress;
        const partMessage = downloadWeights.length > 1
          ? `Descarregant (${downloadPartIndex + 1}/${downloadWeights.length})`
          : "Descarregant";

        sendDownloadEvent({
          id: item.id,
          progress: Math.max(0, Math.min(100, overallProgress)),
          status: "downloading",
          message: partMessage
        });
      }

      if (line.includes("[ExtractAudio]") || line.includes("[Merger]")) {
        sendDownloadEvent({
          id: item.id,
          status: "downloading",
          message: "Processant el fitxer"
        });
      }
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || "";

      for (const line of lines) {
        if (line) {
          processOutputLine(line);
        }
      }
    });

    child.stdout.on("end", () => {
      if (stdoutBuffer) {
        processOutputLine(stdoutBuffer);
      }
    });

    child.stderr.on("data", (chunk) => {
      lastError += chunk;
    });

    child.on("error", (error) => {
      completed = true;
      activeDownload = null;
      sendDownloadEvent({
        id: item.id,
        status: "error",
        progress: 0,
        message: error.code === "ENOENT"
          ? "No s'ha trobat yt-dlp dins l'app ni al PATH."
          : error.message,
        details: error.stack || error.message
      });
      resolve();
    });

    child.on("close", (code) => {
      if (completed) {
        return;
      }

      completed = true;
      activeDownload = null;

      if (cancelRequested) {
        sendDownloadEvent({
          id: item.id,
          status: "canceled",
          progress: 0,
          message: "Cancel·lat",
          details: lastError
        });
        resolve();
        return;
      }

      if (code === 0) {
        sendDownloadEvent({
          id: item.id,
          status: "completed",
          progress: 100,
          message: selectedFormat ? `Completat. Format: ${selectedFormat}` : "Completat"
        });
      } else {
        sendDownloadEvent({
          id: item.id,
          status: "error",
          message: cleanError(lastError) || `yt-dlp ha finalitzat amb codi ${code}.`,
          details: lastError
        });
      }

      resolve();
    });
  });
}

function cleanError(errorText) {
  const lines = errorText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const useful = lines.find((line) => line.toLowerCase().includes("error"));
  return useful || lines.at(-1) || "";
}

function commandExists(command, versionArgs = ["--version"]) {
  return new Promise((resolve) => {
    const child = spawn(command, versionArgs, {
      windowsHide: true
    });

    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

async function checkRequiredTools() {
  const tools = getToolPaths();
  const [hasYtDlp, hasDeno, hasFfmpeg] = await Promise.all([
    commandExists(tools.ytDlp, ["--version"]),
    commandExists(tools.deno, ["--version"]),
    commandExists(tools.ffmpeg, ["-version"])
  ]);

  const missing = [];
  if (!hasYtDlp) {
    missing.push("yt-dlp");
  }
  if (!hasDeno) {
    missing.push("Deno");
  }
  if (!hasFfmpeg) {
    missing.push("ffmpeg");
  }

  return {
    missing,
    tools
  };
}

async function enqueueDownloads(items, options) {
  const toolsCheck = await checkRequiredTools();
  if (toolsCheck.missing.length > 0) {
    return {
      ok: false,
      message: `Falten eines necessàries: ${toolsCheck.missing.join(", ")}. Executa npm run tools:download o revisa els binaris de l'app.`
    };
  }

  for (const item of items) {
    downloadQueue.push({ item, options });
  }

  if (!queueRunning) {
    processQueue(toolsCheck.tools);
  }

  return { ok: true, queued: items.length };
}

async function processQueue(tools) {
  queueRunning = true;
  cancelRequested = false;

  try {
    while (downloadQueue.length > 0) {
      const job = downloadQueue.shift();

      if (cancelRequested) {
        sendDownloadEvent({
          id: job.item.id,
          status: "canceled",
          progress: 0,
          message: "Cancel·lat"
        });
        continue;
      }

      await runDownload(job, tools);
    }

    sendDownloadEvent({
      status: cancelRequested ? "queue-canceled" : "queue-completed",
      message: cancelRequested
        ? "La cua s'ha cancel·lat."
        : "Totes les descàrregues han finalitzat."
    });
  } finally {
    queueRunning = false;
    cancelRequested = false;
    activeDownload = null;
  }
}

app.whenReady().then(() => {
  setupApplicationMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("preferences:get", () => loadPreferences());

ipcMain.handle("app:info", () => ({
  name: APP_NAME,
  version: app.getVersion()
}));

ipcMain.handle("preferences:save", (_event, preferences) => {
  return savePreferences(preferences);
});

ipcMain.handle("folder:select", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Selecciona la carpeta de destinació",
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const destinationFolder = result.filePaths[0];
  savePreferences({ destinationFolder });
  return destinationFolder;
});

ipcMain.handle("folder:open", async (_event, folder) => {
  if (!folder || !fs.existsSync(folder)) {
    return "La carpeta no existeix.";
  }

  return shell.openPath(folder);
});

ipcMain.handle("downloads:start", async (_event, payload) => {
  const preferences = savePreferences({
    outputFormat: payload.outputFormat,
    audioBitrate: payload.audioBitrate,
    videoFormat: payload.videoFormat,
    destinationFolder: payload.destinationFolder
  });

  return enqueueDownloads(payload.items, preferences);
});

ipcMain.handle("downloads:cancel", () => {
  if (!queueRunning) {
    return { ok: false, message: "No hi ha cap cua en marxa." };
  }

  cancelRequested = true;

  if (activeDownload) {
    activeDownload.kill();
  }

  while (downloadQueue.length > 0) {
    const job = downloadQueue.shift();
    sendDownloadEvent({
      id: job.item.id,
      status: "canceled",
      progress: 0,
      message: "Cancel·lat"
    });
  }

  return { ok: true };
});

ipcMain.handle("tools:status", async () => {
  const toolsCheck = await checkRequiredTools();

  return {
    ok: toolsCheck.missing.length === 0,
    missing: toolsCheck.missing,
    tools: {
      ytDlp: toolsCheck.tools.ytDlp,
      deno: toolsCheck.tools.deno,
      ffmpeg: toolsCheck.tools.ffmpeg
    }
  };
});

ipcMain.handle("external:open", (_event, url) => {
  return shell.openExternal(url);
});
