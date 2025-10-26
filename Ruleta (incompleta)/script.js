const TAU = Math.PI * 2;
const DEFAULT_ENTRIES = ["Projecte Agora", "Projecte Bit", "Projecte Cosmos", "Projecte Delta", "Projecte El.lipse", "Projecte Fenix"];

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("wheelCanvas"));
const ctx = canvas.getContext("2d");
const spinButton = document.getElementById("spinButton");
const updateButton = document.getElementById("updateButton");
const removeButton = document.getElementById("removeButton");
const resetButton = document.getElementById("resetButton");
const restoreButton = document.getElementById("restoreButton");
const entriesInput = /** @type {HTMLTextAreaElement} */ (document.getElementById("entriesInput"));
const resultText = document.getElementById("resultText");
const statusChip = document.getElementById("statusChip");
const audio = /** @type {HTMLAudioElement} */ (document.getElementById("rouletteAudio"));
const noRepeatToggle = /** @type {HTMLInputElement} */ (document.getElementById("noRepeatToggle"));
const winnerPopup = document.getElementById("winnerPopup");
const winnerName = document.getElementById("winnerName");

let entries = [];
let initialEntries = [];
let lastResult = null;
let rotation = 0;
let animationFrameId = null;
let spinning = false;
let audioFadeRequested = false;
let popupTimeoutId = null;

function init() {
  initialEntries = [...DEFAULT_ENTRIES];
  entries = [...initialEntries];
  entriesInput.value = entries.join("\n");
  drawWheel();
  refreshControls();
  window.addEventListener("resize", handleResize);
  registerSpinTarget(spinButton);
  registerSpinTarget(canvas);
  canvas.setAttribute("role", "button");
  canvas.setAttribute("tabindex", "0");
  canvas.setAttribute("aria-label", "Gira la ruleta");
  updateButton.addEventListener("click", handleUpdate);
  removeButton.addEventListener("click", handleRemoveResult);
  resetButton.addEventListener("click", handleResetCurrent);
  restoreButton.addEventListener("click", handleRestoreBase);
  entriesInput.addEventListener("input", () => {
    // Enable quick update feedback
    statusChip.textContent = "Canvis pendents";
  });
  noRepeatToggle.addEventListener("change", () => {
    statusChip.textContent = noRepeatToggle.checked ? "Sense repeticions activat" : "Sense repeticions desactivat";
    refreshControls();
  });
  if (winnerPopup) {
    winnerPopup.addEventListener("click", hideWinnerPopup);
  }
  document.addEventListener("pointerdown", handleGlobalPointerDismiss, { capture: true });
  audio.loop = true;
}

function registerSpinTarget(element) {
  element.style.touchAction = "manipulation";
  element.addEventListener(
    "pointerup",
    (event) => {
      event.preventDefault();
      handleSpin();
    },
    { passive: false }
  );
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSpin();
    }
  });
}

function handleResize() {
  drawWheel();
}

function handleUpdate() {
  const parsed = parseEntries(entriesInput.value);
  if (!parsed.length) {
    statusChip.textContent = "Cal afegir elements";
    resultText.textContent = "Afegeix com a m\u00ednim un element per generar la ruleta.";
    entries = [];
    drawWheel();
    refreshControls();
    hideWinnerPopup();
    return;
  }
  entries = [...parsed];
  initialEntries = [...parsed];
  lastResult = null;
  rotation = 0;
  entriesInput.value = entries.join("\n");
  drawWheel();
  refreshControls();
  statusChip.textContent = "Ruleta actualitzada";
  resultText.textContent = "Prem el bot\u00F3 per fer el primer gir.";
  hideWinnerPopup();
}

function handleSpin() {
  if (spinning || entries.length === 0) return;

  hideWinnerPopup();
  spinning = true;
  statusChip.textContent = "Girant...";
  spinButton.disabled = true;
  updateButton.disabled = true;
  removeButton.disabled = true;
  resetButton.disabled = true;
  restoreButton.disabled = true;

  const startRotation = rotation;
  const extraTurns = 7 + Math.random() * 3.5;
  const randomOffset = Math.random() * TAU;
  const targetRotation = startRotation + extraTurns * TAU + randomOffset;
  const duration = 6500 + Math.random() * 2000;
  const startTime = performance.now();
  audioFadeRequested = false;

  playAudio();

  let prevRotation = startRotation;
  let prevTimestamp = startTime;

  const animate = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutQuint(progress);
    rotation = startRotation + (targetRotation - startRotation) * eased;
    drawWheel();

    const frameDelta = Math.max(now - prevTimestamp, 16);
    const angularVelocity = Math.abs(rotation - prevRotation) / frameDelta;
    updateAudioRate(angularVelocity);
    prevRotation = rotation;
    prevTimestamp = now;

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      updateAudioRate(0);
      rotation = normalizeAngle(rotation);
      stopAudioSmooth(true);
      finishSpin();
    }
  };

  animationFrameId = requestAnimationFrame(animate);
}

function playAudio() {
  try {
    audio.currentTime = 0;
    audio.volume = 1;
    audioFadeRequested = false;
    audio.playbackRate = 1.2;
    audio.play().catch(() => {
      // Silently ignore autoplay restrictions until user interacts.
    });
  } catch (error) {
    console.warn("No s'ha pogut reproduir l'àudio de la ruleta:", error);
  }
}

function finishSpin() {
  cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  spinning = false;

  const winnerIndex = getWinnerIndex();
  lastResult = entries[winnerIndex] ?? null;

  statusChip.textContent = lastResult ? "Resultat disponible" : "Sense resultat";
  if (lastResult) {
    showWinnerPopup(lastResult);
    resultText.textContent = "Pots girar de nou o eliminar l'element seleccionat.";
  } else {
    resultText.textContent = "No hi ha cap element per seleccionar.";
  }

  if (noRepeatToggle.checked && typeof winnerIndex === "number") {
    entries.splice(winnerIndex, 1);
    entriesInput.value = entries.join("\n");
    statusChip.textContent = entries.length ? "Mode sense repeticions" : "Sense elements";
    rotation = 0;
    drawWheel();
  }

  refreshControls();
  stopAudioSmooth();
}

function stopAudioSmooth(immediate = false) {
  if (audio.paused) return;
  if (immediate) {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
    audio.playbackRate = 1;
    audioFadeRequested = false;
    return;
  }
  if (audioFadeRequested) return;
  audioFadeRequested = true;
  const fadeDuration = 350;
  const startVolume = audio.volume;
  const startTime = performance.now();

  const fade = (now) => {
    const progress = Math.min((now - startTime) / fadeDuration, 1);
    audio.volume = startVolume * (1 - progress);
    if (progress < 1) {
      requestAnimationFrame(fade);
    } else {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
      audio.playbackRate = 1;
      audioFadeRequested = false;
    }
  };

  requestAnimationFrame(fade);
}

function handleRemoveResult() {
  if (!lastResult) return;
  const index = entries.indexOf(lastResult);
  if (index !== -1) {
    entries.splice(index, 1);
    entriesInput.value = entries.join("\n");
    resultText.textContent = `S'ha eliminat "${lastResult}" de la ruleta.`;
    statusChip.textContent = "Element eliminat";
  } else {
    resultText.textContent = "L'element ja no és present a la ruleta.";
    statusChip.textContent = "Sense canvis";
  }
  lastResult = null;
  rotation = 0;
  drawWheel();
  hideWinnerPopup();
  refreshControls();
}

function handleResetCurrent() {
  entries = [...initialEntries];
  entriesInput.value = entries.join("\n");
  if (!entries.length) {
    statusChip.textContent = "Llista buida";
  } else {
    statusChip.textContent = "Ruleta reiniciada";
  }
  lastResult = null;
  rotation = 0;
  drawWheel();
  hideWinnerPopup();
  resultText.textContent = "Prem el bot\u00F3 per fer un nou gir amb la llista actual.";
  refreshControls();
}

function handleRestoreBase() {
  entries = [...DEFAULT_ENTRIES];
  initialEntries = [...DEFAULT_ENTRIES];
  entriesInput.value = entries.join("\n");
  lastResult = null;
  rotation = 0;
  drawWheel();
  refreshControls();
  hideWinnerPopup();
  resultText.textContent = "Llista base restaurada. Prem el bot\u00F3 per comen\u00E7ar.";
  statusChip.textContent = "Llista base restaurada";
}

function parseEntries(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function refreshControls() {
  const hasEntries = entries.length > 0;
  spinButton.disabled = !hasEntries || spinning;
  updateButton.disabled = spinning;
  removeButton.disabled = !lastResult || spinning;
  resetButton.disabled = !hasEntries || spinning;
  restoreButton.disabled = spinning;
}

function drawWheel() {
  resizeCanvasForDisplay();
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;
  const dpr = window.devicePixelRatio || 1;
  const baseRadius = Math.min(centerX, centerY) - 12 * dpr;
  const maxRadius = Math.min(centerX, centerY) - 8 * dpr;
  const radius = Math.max(Math.min(baseRadius * 1.15, maxRadius), baseRadius * 0.9);

  ctx.save();
  ctx.translate(centerX, centerY);

  if (!entries.length) {
    drawEmptyState(ctx, radius);
    ctx.restore();
    return;
  }

  const segmentAngle = TAU / entries.length;
  ctx.rotate(rotation);

  entries.forEach((entry, index) => {
    const startAngle = index * segmentAngle;
    const endAngle = startAngle + segmentAngle;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = segmentColor(index, entries.length);
    ctx.fill();

    ctx.save();
    ctx.rotate(startAngle + segmentAngle / 2);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(11, 19, 43, 0.3)";
    ctx.shadowBlur = 12;
    const { fontSize, lines } = computeSegmentLabel(ctx, entry, radius);
    ctx.font = `${fontSize}px Montserrat, sans-serif`;
    const lineHeight = fontSize * 1.1;
    const textX = radius - Math.max(radius * 0.12, 26);
    const totalHeight = lineHeight * (lines.length - 1);
    lines.forEach((line, lineIndex) => {
      ctx.fillText(line, textX, -totalHeight / 2 + lineIndex * lineHeight);
    });
    ctx.restore();
  });

  if (lastResult) {
    const highlightIndex = entries.indexOf(lastResult);
    if (highlightIndex !== -1) {
      ctx.save();
      ctx.rotate(highlightIndex * segmentAngle + segmentAngle / 2);
      const highlightGradient = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
      highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.6)");
      highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, -segmentAngle / 2, segmentAngle / 2);
      ctx.closePath();
      ctx.fillStyle = highlightGradient;
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
  drawCenterBadge(centerX, centerY, radius);
}

function drawEmptyState(context, radius) {
  const gradient = context.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0.55)");
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
  context.fillStyle = gradient;
  context.fill();

  context.fillStyle = "rgba(11, 19, 43, 0.5)";
  context.font = `${Math.max(18, radius * 0.16)}px Montserrat, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  wrapText(context, 'Afegeix elements i prem "Actualitza la ruleta"', 0, 0, radius * 1.3, 36);
}

function drawCenterBadge(cx, cy, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.08, 0, TAU);
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.shadowColor = "rgba(11, 19, 43, 0.25)";
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.restore();
}

function resizeCanvasForDisplay() {
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = Math.round(width * dpr);
  const displayHeight = Math.round(height * dpr);

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  const lines = [];

  words.forEach((word) => {
    const testLine = `${line}${word} `;
    const metrics = context.measureText(testLine);
    if (metrics.width > maxWidth && line !== "") {
      lines.push(line.trim());
      line = `${word} `;
    } else {
      line = testLine;
    }
  });

  lines.push(line.trim());

  const totalHeight = lines.length * lineHeight;
  let offsetY = y - totalHeight / 2 + lineHeight / 2;

  lines.forEach((lineText) => {
    context.fillText(lineText, x, offsetY);
    offsetY += lineHeight;
  });
}

function normalizeAngle(value) {
  return ((value % TAU) + TAU) % TAU;
}

function getWinnerIndex() {
  if (!entries.length) return null;
  const pointerAngle = (3 * Math.PI) / 2; // 270 graus cap avall
  const segmentAngle = TAU / entries.length;
  const normalized = normalizeAngle(pointerAngle - rotation);
  return Math.floor(normalized / segmentAngle) % entries.length;
}

function segmentColor(index, total) {
  const hue = Math.round((360 / total) * index);
  const saturation = total > 6 ? 82 : 78;
  const lightness = total > 10 ? 55 : 60;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
}

function updateAudioRate(angularVelocity) {
  if (!audio || audio.paused) return;
  const minRate = 0.6;
  const maxRate = 1.8;
  const normalized = Math.max(0, Math.min(angularVelocity / 0.0009, 1));
  const targetRate = minRate + (maxRate - minRate) * normalized;
  audio.playbackRate = targetRate;
}

function computeSegmentLabel(context, text, radius) {
  const clean = text.trim();
  const maxLines = 3;
  const maxWidth = radius * 0.65;
  let fontSize = Math.min(30, radius * 0.11);
  const minFontSize = Math.max(10, radius * 0.07);

  for (let size = fontSize; size >= minFontSize; size -= 1) {
    context.font = `${size}px Montserrat, sans-serif`;
    const lines = wrapLabelLines(context, clean, maxWidth, maxLines);
    if (lines) {
      return { fontSize: size, lines };
    }
    const forced = splitByWidth(context, clean, maxWidth, maxLines);
    if (forced) {
      return { fontSize: size, lines: forced };
    }
  }

  context.font = `${minFontSize}px Montserrat, sans-serif`;
  return { fontSize: minFontSize, lines: splitByWidth(context, clean, maxWidth, maxLines) || [""] };
}

function wrapLabelLines(context, text, maxWidth, maxLines) {
  if (!text) return [""];
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  for (const word of words) {
    if (context.measureText(word).width > maxWidth) {
      return null;
    }
  }

  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const testLine = `${currentLine} ${words[i]}`;
    if (context.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
      if (lines.length === maxLines) {
        return null;
      }
    }
  }

  lines.push(currentLine);
  if (lines.length > maxLines) {
    return null;
  }

  return lines;
}

function splitByWidth(context, text, maxWidth, maxLines) {
  if (!text) return [""];
  const lines = [];
  let current = "";

  for (const char of text) {
    const candidate = current + char;
    if (context.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (!current) {
        current = char;
        continue;
      }
      lines.push(current);
      current = char;
      if (lines.length === maxLines) {
        return null;
      }
    }
  }

  if (current) {
    lines.push(current);
  }

  if (!lines.length) {
    lines.push(text);
  }

  return lines.length <= maxLines ? lines : lines.slice(0, maxLines).map((line, idx) => (idx === maxLines - 1 ? `${line}…` : line));
}

function showWinnerPopup(name) {
  if (!winnerPopup || !winnerName) return;
  winnerName.textContent = name;
  winnerPopup.classList.add("visible");
  clearTimeout(popupTimeoutId);
  popupTimeoutId = setTimeout(() => {
    hideWinnerPopup();
  }, 5000);
}

function hideWinnerPopup() {
  if (!winnerPopup) return;
  if (!winnerPopup.classList.contains("visible")) {
    clearTimeout(popupTimeoutId);
    popupTimeoutId = null;
    return;
  }
  winnerPopup.classList.remove("visible");
  clearTimeout(popupTimeoutId);
  popupTimeoutId = null;
}

function handleGlobalPointerDismiss() {
  if (!winnerPopup || !winnerPopup.classList.contains("visible")) return;
  hideWinnerPopup();
}

document.addEventListener("DOMContentLoaded", init);
