// Auto-update — one release feed for both the Windows and the macOS build.
//
// electron-builder publishes latest.yml (Windows) and latest-mac.yml (macOS) next to
// the installers on the SAME GitHub release. Each app reads only its own file, so one
// `npm run release` updates every till on both platforms.
//
// Silent-ish by design for a shop counter: download in the background, then ask once.
// Never interrupt a sale — the install happens on quit unless the user says "now".

let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch { /* not installed yet */ }

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 4x a day is plenty for a POS

function init({ app, dialog, getWindow, onStatus }) {
  // The Mac build is unsigned, which Squirrel.Mac (electron-updater's Mac backend)
  // refuses to install. Use the hand-rolled updater there instead.
  if (process.platform === 'darwin') return require('./updater-mac').init({ app, dialog, getWindow, onStatus });

  const say = (s) => { try { onStatus && onStatus(s); } catch {} };

  if (!autoUpdater) {
    say({ state: 'unavailable', reason: 'electron-updater not installed' });
    return { check: () => say({ state: 'unavailable' }), install: () => {}, available: false };
  }
  if (!app.isPackaged) {
    say({ state: 'dev' });
    return { check: () => say({ state: 'dev' }), install: () => {}, available: false };
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  let notified = false;
  let last = { state: 'idle' };
  const say0 = say;
  const sayT = (s) => { last = s; say0(s); };

  autoUpdater.on('checking-for-update', () => sayT({ state: 'checking' }));
  autoUpdater.on('update-not-available', () => sayT({ state: 'current', version: app.getVersion() }));
  autoUpdater.on('download-progress', (p) => sayT({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('error', (err) => sayT({ state: 'error', message: String(err && err.message || err) }));

  autoUpdater.on('update-available', (info) => sayT({ state: 'available', version: info.version }));

  autoUpdater.on('update-downloaded', async (info) => {
    sayT({ state: 'ready', version: info.version });
    if (notified) return;
    notified = true;
    const win = getWindow();
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update ready',
      message: `VaziSafi LMS ${info.version} is ready to install`,
      detail: 'Installing restarts the app. Nothing is lost — but finish the order on screen first.',
      buttons: ['Install and restart', 'Install when I close the app'],
      defaultId: 1,
      cancelId: 1
    });
    if (response === 0) { setImmediate(() => autoUpdater.quitAndInstall()); }
  });

  const askInstall = async (version) => {
    const { response } = await dialog.showMessageBox(getWindow(), {
      type: 'info', title: 'Update ready', message: `VaziSafi LMS ${version} is ready to install`,
      detail: 'Installing restarts the app. Finish the order on screen first.',
      buttons: ['Install and restart', 'Later'], defaultId: 0, cancelId: 1
    });
    if (response === 0) setImmediate(() => autoUpdater.quitAndInstall());
  };
  const check = (interactive) => {
    if (interactive && last.state === 'ready') { askInstall(last.version); return; }
    if (interactive && last.state === 'downloading') {
      dialog.showMessageBox(getWindow(), { type: 'info', message: 'Downloading update…', detail: `${last.percent || 0}% done. You will be asked to install when it finishes.` });
      return;
    }
    autoUpdater.checkForUpdates().then((r) => {
      if (!interactive) return;
      const v = r && r.updateInfo && r.updateInfo.version;
      const newer = r && (r.isUpdateAvailable === true || (r.isUpdateAvailable === undefined && v && v !== app.getVersion()));
      if (!newer) {
        dialog.showMessageBox(getWindow(), { type: 'info', message: 'You are up to date', detail: `Running v${app.getVersion()}.` });
      } else if (last.state === 'ready') {
        askInstall(last.version);
      } else {
        dialog.showMessageBox(getWindow(), { type: 'info', message: `Update ${v} found`, detail: 'Downloading in the background. You will be asked to install when it finishes.' });
      }
    }).catch((err) => {
      if (interactive) {
        dialog.showMessageBox(getWindow(), { type: 'warning', message: 'Could not check for updates', detail: String(err && err.message || err) });
      }
    });
  };

  setTimeout(() => check(false), 10_000);        // shortly after boot
  setInterval(() => check(false), CHECK_INTERVAL_MS);

  return { check, install: () => autoUpdater.quitAndInstall(), available: true };
}

module.exports = { init };
