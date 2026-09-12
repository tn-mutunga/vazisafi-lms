// Bridges native POS capabilities to the web app under contextIsolation.
// The web app can feature-detect with:  if (window.lms?.isDesktop) { ... }
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lms', {
  isDesktop: true,
  info: () => ipcRenderer.invoke('lms:info'),
  printers: () => ipcRenderer.invoke('lms:printers'),
  printReceipt: (html) => ipcRenderer.invoke('lms:printReceipt', html),
  printTest: () => ipcRenderer.invoke('lms:printTest'),
  openDrawer: () => ipcRenderer.invoke('lms:openDrawer'),
  getConfig: () => ipcRenderer.invoke('lms:config'),
  setConfig: (patch) => ipcRenderer.invoke('lms:config', patch),
  updateStatus: () => ipcRenderer.invoke('lms:updateStatus'),
  checkUpdate: () => ipcRenderer.invoke('lms:checkUpdate'),
  onUpdate: (fn) => { ipcRenderer.on('lms:update', (_e, s) => fn(s)); }
});
