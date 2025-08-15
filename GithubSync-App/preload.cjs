// Preload en CommonJS perquè carregui sempre, independentment d'ESM al main.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectBaseDir: () => ipcRenderer.invoke('dialog:selectBaseDir'),
  scan: (baseDir) => ipcRenderer.invoke('scan', baseDir),
  tree: (baseDir) => ipcRenderer.invoke('tree', baseDir),
  sync: (payload) => ipcRenderer.invoke('sync', payload)
});
