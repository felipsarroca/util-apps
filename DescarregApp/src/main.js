const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const APP_NAME = "DescarregApp";

let mainWindow;
let queueRunning = false;
let cancelRequested = false;
let activeDownload = null;
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
    ffmpeg,
    ffmpegLocation: path.basename(ffmpeg) === ffmpeg ? ffmpeg : path.dirname(ffmpeg)
  };
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
    "--newline",
    "--no-playlist",
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
    "--merge-output-format",
    videoFormat,
    "-o",
    outputTemplate,
    url
  ];
}

function parseProgress(line) {
  const percentMatch = line.match(/\[download\]\s+([0-9]+(?:\.[0-9]+)?)%/);
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

function fetchTitle(url, tools) {
  return new Promise((resolve) => {
    const child = spawn(tools.ytDlp, [
      "--no-playlist",
      "--skip-download",
      "--print",
      "%(title)s",
      url
    ], {
      windowsHide: true
    });

    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
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

    sendDownloadEvent({
      id: item.id,
      status: "downloading",
      progress: 0,
      message: "Iniciant descàrrega"
    });

    child.stdout.on("data", (chunk) => {
      const lines = chunk.toString().split(/\r?\n/).filter(Boolean);

      for (const line of lines) {
        const parsedTitle = parseTitle(line);
        const progress = parseProgress(line);

        if (parsedTitle) {
          sendDownloadEvent({
            id: item.id,
            title: parsedTitle,
            status: "downloading"
          });
        }

        if (progress !== null) {
          sendDownloadEvent({
            id: item.id,
            progress,
            status: "downloading",
            message: "Descarregant"
          });
        }

        if (line.includes("[ExtractAudio]") || line.includes("[Merger]")) {
          sendDownloadEvent({
            id: item.id,
            status: "downloading",
            message: "Processant el fitxer"
          });
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      lastError += chunk.toString();
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
          message: "Completat"
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
  const [hasYtDlp, hasFfmpeg] = await Promise.all([
    commandExists(tools.ytDlp, ["--version"]),
    commandExists(tools.ffmpeg, ["-version"])
  ]);

  const missing = [];
  if (!hasYtDlp) {
    missing.push("yt-dlp");
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
      ffmpeg: toolsCheck.tools.ffmpeg
    }
  };
});

ipcMain.handle("external:open", (_event, url) => {
  return shell.openExternal(url);
});
