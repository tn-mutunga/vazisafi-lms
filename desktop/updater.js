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
  const say = (s) => { try { onStatus && onStatus(s); } catch {} };

  if (!autoUpdater) {
    say({ state: 'unavailable', reason: 'electron-updater not installed' });
    return { check: () => say({ state: 'unavailable' }), available: false };
  }
  if (!app.isPackaged) {
    say({ state: 'dev' });
    return { check: () => say({ state: 'dev' }), available: false };
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  let notified = false;

  autoUpdater.on('checking-for-update', () => say({ state: 'checking' }));
  autoUpdater.on('update-not-available', () => say({ state: 'current', version: app.getVersion() }));
  autoUpdater.on('download-progress', (p) => say({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('error', (err) => say({ state: 'error', message: String(err && err.message || err) }));

  autoUpdater.on('update-available', (info) => say({ state: 'available', version: info.version }));

  autoUpdater.on('update-downloaded', async (info) => {
    say({ state: 'ready', version: info.version });
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

  const check = (interactive) => {
    autoUpdater.checkForUpdates().then((r) => {
      if (interactive && !r) {
        dialog.showMessageBox(getWindow(), { type: 'info', message: 'No update found', detail: `Running v${app.getVersion()}.` });
      }
    }).catch((err) => {
      if (interactive) {
        dialog.showMessageBox(getWindow(), { type: 'warning', message: 'Could not check for updates', detail: String(err && err.message || err) });
      }
    });
  };

  setTimeout(() => check(false), 10_000);        // shortly after boot
  setInterval(() => check(false), CHECK_INTERVAL_MS);

  return { check, available: true };
}

module.exports = { init };
