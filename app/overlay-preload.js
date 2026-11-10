// Bridge for the pause menu window (overlay.html): it only receives menu events and asks for menu actions.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('menu', {
  onOpen: (fn) => ipcRenderer.on('menu:open', (_e, v) => fn(v)),
  onNav: (fn) => ipcRenderer.on('menu:nav', (_e, v) => fn(v)),
  onClose: (fn) => ipcRenderer.on('menu:close', () => fn()),
  act: (id) => ipcRenderer.invoke('menu:act', id)
});
