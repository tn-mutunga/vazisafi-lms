// Safi LMS — Electron main process (desktop POS shell)
const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const updater = require('./updater');
let updateCtl = { check: () => {}, available: false };
let updateStatus = { state: 'idle' };

const APP_ROOT = path.join(__dirname, '..');
const ENTRY = path.join(APP_ROOT, 'Safi Laundry Management.html');

process.on('uncaughtException', (err) => {
  console.error('[safi] uncaught:', err);
  try { dialog.showErrorBox('VaziSafi LMS failed to start', String(err && err.stack || err)); } catch {}
});
const KIOSK = process.argv.includes('--kiosk');

// Force the product name in dev too, so the macOS menu bar reads VaziSafi LMS
// instead of "Electron". Must run before app is ready.
app.setName('VaziSafi LMS');
if (process.platform === 'darwin') app.setAboutPanelOptions({ applicationName: 'VaziSafi LMS', applicationVersion: app.getVersion() });
const CONFIG_PATH = () => path.join(app.getPath('userData'), 'device.json');

let win = null;

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH(), 'utf8')); } catch { return {}; }
}
function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  fs.mkdirSync(path.dirname(CONFIG_PATH()), { recursive: true });
  fs.writeFileSync(CONFIG_PATH(), JSON.stringify(next, null, 2));
  return next;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#f4f5f7',
    title: 'VaziSafi LMS',
    kiosk: KIOSK,
    autoHideMenuBar: KIOSK,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  console.log('[safi] loading', ENTRY, 'exists:', fs.existsSync(ENTRY));
  win.loadFile(ENTRY).catch(err => {
    console.error('[safi] loadFile failed:', err);
    dialog.showErrorBox('Could not load the app', `${ENTRY}\n\n${err}`);
  });

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[safi] did-fail-load', code, desc, url);
  });

  // Safety net: if ready-to-show never fires, show anyway rather than sit invisible.
  setTimeout(() => { if (win && !win.isVisible()) { console.warn('[safi] forcing show'); win.show(); } }, 4000);

  win.once('ready-to-show', () => {
    win.show();
    if (KIOSK) win.setFullScreen(true);
  });

  // Inject the desktop-mode badge without touching the web app's own files.
  win.webContents.on('did-finish-load', () => {
    const badge = fs.readFileSync(path.join(__dirname, 'renderer-badge.js'), 'utf8');
    win.webContents.executeJavaScript(badge).catch(() => {});
  });

  // External links open in the real browser, never inside the POS shell.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => { win = null; });
}

function aboutDialog() {
  dialog.showMessageBox(win, {
    type: 'info',
    title: 'VaziSafi LMS',
    message: `VaziSafi Laundry Management System\nDesktop shell v${app.getVersion()}\nElectron ${process.versions.electron}`,
    detail: `Device: ${readConfig().deviceName || 'unnamed'}\nReceipt printer: ${readConfig().receiptPrinter || 'not set'}\nData folder: ${app.getPath('userData')}`
  });
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  const template = [
    // On macOS the first menu IS the app menu: it must carry About/Services/Hide/Quit
    // or the system inserts its own and Cmd+H / Cmd+Q go missing.
    ...(mac ? [{
      label: 'VaziSafi LMS',
      submenu: [
        { label: 'About VaziSafi LMS', click: aboutDialog },
        { type: 'separator' },
        { label: 'Check for updates…', click: () => updateCtl.check(true) },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: 'Hide VaziSafi LMS' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: 'Quit VaziSafi LMS' }
      ]
    }] : []),
    {
      label: mac ? 'App' : 'VaziSafi LMS',
      submenu: [
        { label: 'Check for updates…', click: () => updateCtl.check(true) },
        { type: 'separator' },
        { label: 'Reload app', accelerator: 'CmdOrCtrl+R', click: () => win && win.reload() },
        {
          label: 'Toggle kiosk mode',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
          click: () => { if (win) win.setFullScreen(!win.isFullScreen()); }
        },
        { type: 'separator' },
        { label: 'Developer tools', accelerator: 'CmdOrCtrl+Shift+I', click: () => win && win.webContents.toggleDevTools() },
        ...(mac ? [] : [{ type: 'separator' }, { role: 'quit', label: 'Quit VaziSafi LMS' }])
      ]
    },
    {
      label: 'Hardware',
      submenu: [
        { label: 'Choose receipt printer…', click: chooseReceiptPrinter },
        { label: 'Print test receipt', click: () => printTestReceipt() },
        { label: 'Open cash drawer', click: () => kickCashDrawer() }
      ]
    },
    { role: 'editMenu' },
    ...(mac ? [{ role: 'windowMenu' }] : []),
    {
      label: 'Help',
      submenu: [{ label: 'About', click: aboutDialog }]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function listPrinters() {
  if (!win) return [];
  try { return await win.webContents.getPrintersAsync(); } catch { return []; }
}

async function chooseReceiptPrinter() {
  const printers = await listPrinters();
  if (!printers.length) {
    dialog.showMessageBox(win, { type: 'warning', message: 'No printers found', detail: 'Install the thermal printer driver, then try again.' });
    return;
  }
  const names = printers.map(p => p.displayName || p.name);
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    title: 'Receipt printer',
    message: 'Which printer prints receipts?',
    buttons: [...names, 'Cancel'],
    cancelId: names.length
  });
  if (response < names.length) {
    writeConfig({ receiptPrinter: printers[response].name });
    dialog.showMessageBox(win, { type: 'info', message: `Receipt printer set to ${names[response]}` });
  }
}

// Silent print: render receipt HTML in a hidden window, print straight to the
// configured printer with no OS dialog. 80mm thermal roll.
function printReceipt(html) {
  return new Promise((resolve) => {
    const deviceName = readConfig().receiptPrinter || '';
    const sheet = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
    const doc = `<!doctype html><meta charset="utf-8"><style>
@page{size:80mm auto;margin:0}
body{margin:0;padding:4mm 3mm;width:74mm;font:12px/1.45 "Courier New",monospace;color:#000}
h1{font-size:15px;margin:0 0 2mm;text-align:center;letter-spacing:.06em}
table{width:100%;border-collapse:collapse}td{padding:.6mm 0;vertical-align:top}
.r{text-align:right}.c{text-align:center}
hr{border:0;border-top:1px dashed #000;margin:2mm 0}
.tot{font-weight:700;font-size:13px}
footer{margin-top:3mm;text-align:center;font-size:10px}
</style>${html}`;
    sheet.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(doc));
    sheet.webContents.once('did-finish-load', () => {
      sheet.webContents.print(
        { silent: true, printBackground: false, deviceName, margins: { marginType: 'none' } },
        (ok, reason) => { sheet.destroy(); resolve({ ok, reason }); }
      );
    });
  });
}

function printTestReceipt() {
  const now = new Date();
  return printReceipt(`
    <h1>SAFI LAUNDRY</h1>
    <div class="c">Test receipt</div><hr>
    <table>
      <tr><td>Shirts x3</td><td class="r">450.00</td></tr>
      <tr><td>Duvet x1</td><td class="r">800.00</td></tr>
    </table><hr>
    <table><tr class="tot"><td>TOTAL</td><td class="r">KSh 1,250.00</td></tr></table>
    <footer>${now.toLocaleString()}<br>Hardware check &mdash; not a real sale</footer>`);
}

// Cash drawer: ESC/POS kick pulse (ESC p 0 25 250) written to the printer.
// Electron cannot write raw bytes to a printer port on its own — wire ONE of:
//   a) npm i @thiagoelg/node-printer  -> printer.printDirect({ data: buf, type:'RAW' })
//   b) npm i serialport              -> port.write(buf) for a serial/USB drawer
// The pulse below is the correct payload for both.
function kickCashDrawer() {
  const pulse = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
  try {
    // eslint-disable-next-line global-require
    const printer = require('@thiagoelg/node-printer');
    printer.printDirect({
      data: pulse,
      printer: readConfig().receiptPrinter || undefined,
      type: 'RAW',
      success: () => {},
      error: () => {}
    });
    return { ok: true };
  } catch {
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Cash drawer',
      message: 'Drawer pulse ready, raw printing not installed',
      detail: 'Run:  npm i @thiagoelg/node-printer\nThen this menu item opens the drawer for real. The ESC/POS pulse is already built.'
    });
    return { ok: false, reason: 'no-raw-printer-module' };
  }
}

ipcMain.handle('lms:printers', () => listPrinters());
ipcMain.handle('lms:printReceipt', (_e, html) => printReceipt(String(html || '')));
ipcMain.handle('lms:printTest', () => printTestReceipt());
ipcMain.handle('lms:openDrawer', () => kickCashDrawer());
ipcMain.handle('lms:config', (_e, patch) => (patch ? writeConfig(patch) : readConfig()));
ipcMain.handle('lms:updateStatus', () => updateStatus);
ipcMain.handle('lms:checkUpdate', () => { updateCtl.check(true); return updateStatus; });
ipcMain.handle('lms:installUpdate', () => { updateCtl.install(); return true; });
ipcMain.handle('lms:info', () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  platform: process.platform,
  kiosk: KIOSK,
  update: updateStatus,
  dataDir: app.getPath('userData')
}));

// Single instance — a POS terminal must never run two copies.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(() => {
    console.log('[safi] ready, electron', process.versions.electron);
    buildMenu();
    createWindow();
    updateCtl = updater.init({
      app, dialog,
      getWindow: () => win,
      onStatus: (s) => {
        updateStatus = s;
        if (win && !win.isDestroyed()) win.webContents.send('lms:update', s);
      }
    });
  });
  app.on('activate', () => { if (!win) createWindow(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
