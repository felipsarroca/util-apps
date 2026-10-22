// Dimensions in device-independent pixels: Electron already accounts for OS scaling.
const BASE_WIDTH = 1440;
const BASE_HEIGHT = 960;
const MIN_ZOOM = 0.55;

function getZoomFactor(width, height) {
  return Math.max(MIN_ZOOM, Math.min(1, width / BASE_WIDTH, height / BASE_HEIGHT));
}

function attachAdaptiveLayout(window, screen) {
  let lastAutomaticZoom = null;
  let manualZoom = false;
  const fit = () => {
    if (window.isDestroyed() || window.isMinimized()) return;
    const currentZoom = window.webContents.getZoomFactor();
    if (lastAutomaticZoom !== null && Math.abs(currentZoom - lastAutomaticZoom) > 0.001) {
      manualZoom = true;
    }
    if (manualZoom) return;
    const [width, height] = window.getContentSize();
    const zoom = getZoomFactor(width, height);
    if (Math.abs(currentZoom - zoom) > 0.001) {
      window.webContents.setZoomFactor(zoom);
    }
    lastAutomaticZoom = zoom;
  };
  const reset = () => {
    lastAutomaticZoom = null;
    manualZoom = false;
    fit();
  };

  // Native content dimensions do not change when the page zoom changes.
  // This avoids feedback loops and lets CSS breakpoints use the scaled viewport.
  window.on("resize", fit);
  window.on("move", fit);
  window.on("restore", fit);
  window.webContents.on("did-finish-load", reset);
  screen.on("display-metrics-changed", fit);
  window.once("closed", () => screen.removeListener("display-metrics-changed", fit));
  fit();
  return { reset };
}

module.exports = { getZoomFactor, attachAdaptiveLayout };
