const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("descarregApp", {
  getPreferences: () => ipcRenderer.invoke("preferences:get"),
  savePreferences: (preferences) => ipcRenderer.invoke("preferences:save", preferences),
  selectFolder: () => ipcRenderer.invoke("folder:select"),
  openFolder: (folder) => ipcRenderer.invoke("folder:open", folder),
  startDownloads: (payload) => ipcRenderer.invoke("downloads:start", payload),
  cancelDownloads: () => ipcRenderer.invoke("downloads:cancel"),
  getToolsStatus: () => ipcRenderer.invoke("tools:status"),
  openExternal: (url) => ipcRenderer.invoke("external:open", url),
  onDownloadUpdate: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("download:update", listener);
    return () => ipcRenderer.removeListener("download:update", listener);
  }
});
