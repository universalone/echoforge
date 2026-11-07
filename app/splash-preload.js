const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('splash', {
  onStatus: (fn) => ipcRenderer.on('splash:status', (_e, v) => fn(v)),
  onDone: (fn) => ipcRenderer.on('splash:done', () => fn())
});
