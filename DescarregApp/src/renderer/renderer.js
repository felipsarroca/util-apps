const linksInput = document.querySelector("#linksInput");
const folderPath = document.querySelector("#folderPath");
const selectFolderButton = document.querySelector("#selectFolderButton");
const openFolderButton = document.querySelector("#openFolderButton");
const downloadButton = document.querySelector("#downloadButton");
const cancelButton = document.querySelector("#cancelButton");
const clearResultsButton = document.querySelector("#clearResultsButton");
const globalStatus = document.querySelector("#globalStatus");
const validationMessage = document.querySelector("#validationMessage");
const resultsList = document.querySelector("#resultsList");
const resultsSummary = document.querySelector("#resultsSummary");
const videoFormatPanel = document.querySelector("#videoFormatPanel");
const videoFormat = document.querySelector("#videoFormat");
const audioQualityPanel = document.querySelector("#audioQualityPanel");
const audioBitrate = document.querySelector("#audioBitrate");
const formatButtons = [...document.querySelectorAll(".format-option")];

const state = {
  outputFormat: "video",
  audioBitrate: "320",
  videoFormat: "mp4",
  destinationFolder: "",
  items: new Map(),
  isRunning: false,
  toolsOk: false
};

const statusLabels = {
  pending: "Pendent",
  downloading: "Descarregant",
  completed: "Completat",
  error: "Error",
  canceled: "Cancel·lat"
};

function getRawLinks() {
  return linksInput.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function looksLikeUrl(value) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch (error) {
    return false;
  }
}

function analyzeLinks() {
  const rawLinks = getRawLinks();
  const seen = new Set();
  const uniqueLinks = [];
  let duplicates = 0;
  let suspicious = 0;

  for (const link of rawLinks) {
    if (seen.has(link)) {
      duplicates += 1;
      continue;
    }

    seen.add(link);
    uniqueLinks.push(link);

    if (!looksLikeUrl(link)) {
      suspicious += 1;
    }
  }

  return {
    rawLinks,
    uniqueLinks,
    duplicates,
    suspicious
  };
}

function updateValidationMessage() {
  const analysis = analyzeLinks();
  const messages = [];

  if (analysis.duplicates > 0) {
    messages.push(`${analysis.duplicates} enllaç duplicat s'ometrà.`);
  }

  if (analysis.suspicious > 0) {
    messages.push(`${analysis.suspicious} línia no sembla un URL http o https.`);
  }

  validationMessage.textContent = messages.join(" ");
}

function setOutputFormat(format) {
  state.outputFormat = format;

  for (const button of formatButtons) {
    const active = button.dataset.format === format;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  videoFormatPanel.hidden = format !== "video";
  audioQualityPanel.hidden = format !== "audio";
  window.descarregApp.savePreferences({
    outputFormat: format,
    audioBitrate: state.audioBitrate,
    videoFormat: state.videoFormat
  });
}

function updateButtons() {
  const analysis = analyzeLinks();
  const canDownload = analysis.uniqueLinks.length > 0 && state.destinationFolder && state.toolsOk;

  downloadButton.disabled = !canDownload;
  cancelButton.disabled = !state.isRunning;
  clearResultsButton.disabled = state.isRunning || state.items.size === 0;
  openFolderButton.disabled = !state.destinationFolder;
}

function createItem(url, index) {
  return {
    id: `${Date.now()}-${index}`,
    url,
    title: url,
    status: "pending",
    progress: 0,
    message: "Esperant torn",
    details: ""
  };
}

function getSummaryText(items) {
  if (items.length === 0) {
    return "Encara no hi ha cap descàrrega a la cua.";
  }

  const completed = items.filter((item) => item.status === "completed").length;
  const errors = items.filter((item) => item.status === "error").length;
  const canceled = items.filter((item) => item.status === "canceled").length;
  const downloading = items.filter((item) => item.status === "downloading").length;
  const pending = items.filter((item) => item.status === "pending").length;

  return `${items.length} element(s): ${completed} completat(s), ${errors} error(s), ${canceled} cancel·lat(s), ${downloading} en curs, ${pending} pendent(s).`;
}

function renderResults() {
  const items = [...state.items.values()];
  resultsList.innerHTML = "";
  resultsSummary.textContent = getSummaryText(items);

  for (const item of items) {
    const element = document.createElement("article");
    element.className = "result-item";
    element.id = `download-${item.id}`;

    const details = document.createElement("div");
    details.className = "result-details";

    const title = document.createElement("p");
    title.className = "result-title";
    title.textContent = item.title || item.url;

    const url = document.createElement("p");
    url.className = "result-url";
    url.textContent = item.url;

    const message = document.createElement("p");
    message.className = "result-message";
    message.textContent = item.message || "";

    details.append(title, url, message);

    if (item.details && item.status === "error") {
      const errorDetails = document.createElement("details");
      errorDetails.className = "error-details";

      const summary = document.createElement("summary");
      summary.textContent = "Veure detall";

      const pre = document.createElement("pre");
      pre.textContent = item.details;

      errorDetails.append(summary, pre);
      details.append(errorDetails);
    }

    const statusArea = document.createElement("div");
    statusArea.className = "result-status";

    const status = document.createElement("div");
    status.className = `status-pill status-${item.status}`;
    status.textContent = statusLabels[item.status] || item.status;

    const percent = document.createElement("span");
    percent.className = "progress-percent";
    percent.textContent = `${Math.round(item.progress || 0)}%`;

    statusArea.append(status, percent);

    const progressTrack = document.createElement("div");
    progressTrack.className = "progress-track";

    const progressBar = document.createElement("div");
    progressBar.className = "progress-bar";
    progressBar.style.width = `${item.progress || 0}%`;

    progressTrack.append(progressBar);
    element.append(details, statusArea, progressTrack);
    resultsList.append(element);
  }

  updateButtons();
}

function applyDownloadUpdate(payload) {
  if (payload.status === "queue-completed" || payload.status === "queue-canceled") {
    state.isRunning = false;
    globalStatus.textContent = payload.message;
    renderResults();
    updateButtons();
    return;
  }

  const item = state.items.get(payload.id);
  if (!item) {
    return;
  }

  state.items.set(payload.id, {
    ...item,
    ...payload
  });

  renderResults();

  const row = document.querySelector(`#download-${CSS.escape(payload.id)}`);
  if (row) {
    row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

async function selectFolder() {
  const selected = await window.descarregApp.selectFolder();
  if (!selected) {
    return;
  }

  state.destinationFolder = selected;
  folderPath.value = selected;
  updateButtons();
}

async function openDestinationFolder() {
  if (!state.destinationFolder) {
    return;
  }

  const result = await window.descarregApp.openFolder(state.destinationFolder);
  if (result) {
    globalStatus.textContent = result;
  }
}

async function startDownloads() {
  const analysis = analyzeLinks();
  if (analysis.uniqueLinks.length === 0 || !state.destinationFolder) {
    return;
  }

  const newItems = analysis.uniqueLinks.map(createItem);
  newItems.forEach((item) => state.items.set(item.id, item));
  state.isRunning = true;
  linksInput.value = "";
  validationMessage.textContent = "";
  globalStatus.textContent = state.items.size === newItems.length
    ? "Cua en marxa"
    : "Afegit a la cua";
  renderResults();
  updateButtons();

  const response = await window.descarregApp.startDownloads({
    items: newItems.map(({ id, url }) => ({ id, url })),
    outputFormat: state.outputFormat,
    audioBitrate: state.audioBitrate,
    videoFormat: state.videoFormat,
    destinationFolder: state.destinationFolder
  });

  if (!response.ok) {
    for (const item of newItems) {
      state.items.set(item.id, {
        ...item,
        status: "error",
        message: response.message || "No s'ha pogut afegir a la cua."
      });
    }
    state.isRunning = [...state.items.values()].some((item) => {
      return item.status === "pending" || item.status === "downloading";
    });
    globalStatus.textContent = response.message || "No s'ha pogut iniciar la cua.";
    renderResults();
    updateButtons();
  }
}

async function cancelDownloads() {
  if (!state.isRunning) {
    return;
  }

  globalStatus.textContent = "Cancel·lant la cua";
  await window.descarregApp.cancelDownloads();
}

function clearResults() {
  if (state.isRunning) {
    return;
  }

  state.items.clear();
  globalStatus.textContent = "";
  renderResults();
}

async function refreshToolsStatus() {
  const status = await window.descarregApp.getToolsStatus();

  state.toolsOk = status.ok;
  if (!status.ok) {
    globalStatus.textContent = `Falten eines: ${status.missing.join(", ")}.`;
  }

  updateButtons();
}

async function boot() {
  const preferences = await window.descarregApp.getPreferences();
  state.outputFormat = preferences.outputFormat || "video";
  state.audioBitrate = preferences.audioBitrate || "320";
  state.videoFormat = preferences.videoFormat || "mp4";
  state.destinationFolder = preferences.destinationFolder || "";

  audioBitrate.value = state.audioBitrate;
  videoFormat.value = state.videoFormat;
  setOutputFormat(state.outputFormat);
  folderPath.value = state.destinationFolder;
  renderResults();
  updateValidationMessage();
  updateButtons();
  refreshToolsStatus();

  window.descarregApp.onDownloadUpdate(applyDownloadUpdate);
}

linksInput.addEventListener("input", () => {
  updateValidationMessage();
  updateButtons();
});

selectFolderButton.addEventListener("click", selectFolder);
openFolderButton.addEventListener("click", openDestinationFolder);
downloadButton.addEventListener("click", startDownloads);
cancelButton.addEventListener("click", cancelDownloads);
clearResultsButton.addEventListener("click", clearResults);

audioBitrate.addEventListener("change", () => {
  state.audioBitrate = audioBitrate.value;
  window.descarregApp.savePreferences({ audioBitrate: state.audioBitrate });
});

videoFormat.addEventListener("change", () => {
  state.videoFormat = videoFormat.value;
  window.descarregApp.savePreferences({ videoFormat: state.videoFormat });
});

for (const button of formatButtons) {
  button.addEventListener("click", () => setOutputFormat(button.dataset.format));
}

for (const link of document.querySelectorAll("[data-external-link]")) {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    window.descarregApp.openExternal(link.href);
  });
}

boot();
