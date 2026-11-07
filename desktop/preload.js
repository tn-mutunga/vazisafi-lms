// Bridges native POS capabilities to the web app under contextIsolation.
// The web app can feature-detect with:  if (window.lms?.isDesktop) { ... }
const { contextBridge, ipcRenderer, webFrame } = require('electron');

// Printing the page always happens at 100%, whatever zoom the screen is set to, so the
// 80 mm roll is sized the same as before.
async function at100(job) {
  const z = webFrame.getZoomFactor();
  if (z !== 1) webFrame.setZoomFactor(1);
  try { return await job(); } finally { if (z !== 1) webFrame.setZoomFactor(z); }
}

contextBridge.exposeInMainWorld('lms', {
  isDesktop: true,
  info: () => ipcRenderer.invoke('lms:info'),
  printers: () => ipcRenderer.invoke('lms:printers'),
  printReceipt: (html) => ipcRenderer.invoke('lms:printReceipt', html),
  printPage: (opts) => at100(() => ipcRenderer.invoke('lms:printPage', opts)),
  // Whole-app zoom (sidebar − / + buttons, Ctrl/Cmd + − 0).
  getZoom: () => webFrame.getZoomFactor(),
  setZoom: (f) => webFrame.setZoomFactor(Math.max(0.5, Math.min(2, Number(f) || 1))),
  // VaziSafi LMS menu → Zoom in / Zoom out / Actual size.
  onZoom: (fn) => { ipcRenderer.on('lms:zoom', (_e, dir) => fn(dir)); },
  printHtml: (html) => ipcRenderer.invoke('lms:printHtml', html),
  printTest: () => ipcRenderer.invoke('lms:printTest'),
  openDrawer: () => ipcRenderer.invoke('lms:openDrawer'),
  sendMail: (msg) => ipcRenderer.invoke('lms:sendMail', msg),
  getConfig: () => ipcRenderer.invoke('lms:config'),
  setConfig: (patch) => ipcRenderer.invoke('lms:config', patch),
  updateStatus: () => ipcRenderer.invoke('lms:updateStatus'),
  checkUpdate: () => ipcRenderer.invoke('lms:checkUpdate'),
  installUpdate: () => ipcRenderer.invoke('lms:installUpdate'),
  onUpdate: (fn) => { ipcRenderer.on('lms:update', (_e, s) => fn(s)); }
});
