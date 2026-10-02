// macOS self-updater for an UNSIGNED build.
//
// electron-updater on macOS hands the install to Squirrel.Mac, which refuses any
// app without an Apple Developer ID signature. This does the same job by hand:
//
//   1. ask GitHub for the latest release
//   2. download the .zip for this Mac's chip (Apple silicon or Intel)
//   3. unpack it with `ditto` (keeps the app bundle's symlinks intact)
//   4. on install: a small shell script waits for this app to quit, swaps the new
//      bundle into place, strips the quarantine flag (what `fixvazi` did) and
//      relaunches
//
// It reports through the same status states as the Windows updater, so the
// front-desk update bar and the Cloud & Updates screen need no changes.

const { spawn, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const OWNER = 'tn-mutunga';
const REPO = 'vazisafi-lms';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const newer = (a, b) => {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
};

function pickAsset(assets) {
  const zips = assets.filter(a => /-mac\.zip$/i.test(a.name));
  const arm = zips.find(a => /arm64/i.test(a.name));
  const intel = zips.find(a => !/arm64/i.test(a.name));
  return process.arch === 'arm64' ? (arm || intel) : (intel || null);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, _out, stderr) => err ? reject(new Error(stderr || err.message)) : resolve());
  });
}

function init({ app, dialog, getWindow, onStatus }) {
  const say = (s) => { try { onStatus && onStatus(s); } catch {} };

  if (!app.isPackaged) {
    say({ state: 'dev' });
    return { check: () => say({ state: 'dev' }), install: () => {}, available: false };
  }

  // /Applications/VaziSafi LMS.app/Contents/MacOS/VaziSafi LMS → the .app folder
  const bundle = path.resolve(app.getPath('exe'), '..', '..', '..');
  const work = path.join(app.getPath('userData'), 'pending-update');
  const LOG = path.join(os.homedir(), 'Library', 'Logs', 'VaziSafi-update.log');
  let staged = null;       // { version, appPath }
  let busy = false;
  let notified = false;

  async function check(interactive) {
    if (busy) {
      if (interactive) dialog.showMessageBox(getWindow(), { type: 'info', message: 'Already checking or downloading', detail: 'You will be asked to install when it is ready.' });
      return;
    }
    if (interactive && staged) { install(); return; }
    busy = true;
    say({ state: 'checking' });
    try {
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'VaziSafi-LMS' }
      });
      if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
      const rel = await res.json();
      const version = String(rel.tag_name || '').replace(/^v/, '');

      if (!newer(version, app.getVersion())) {
        say({ state: 'current', version: app.getVersion() });
        if (interactive) dialog.showMessageBox(getWindow(), { type: 'info', message: 'You are up to date', detail: `Running v${app.getVersion()}.` });
        return;
      }
      if (staged && staged.version === version) { say({ state: 'ready', version }); return; }

      const asset = pickAsset(rel.assets || []);
      if (!asset) throw new Error(`Release ${version} has no Mac zip for ${process.arch}`);
      say({ state: 'available', version });

      // Download, streaming so progress can be shown.
      fs.rmSync(work, { recursive: true, force: true });
      fs.mkdirSync(work, { recursive: true });
      const zipPath = path.join(work, 'update.zip');
      const dl = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'VaziSafi-LMS' } });
      if (!dl.ok || !dl.body) throw new Error(`Download failed (${dl.status})`);
      const total = Number(dl.headers.get('content-length')) || asset.size || 0;
      const out = fs.createWriteStream(zipPath);
      let got = 0, lastPct = -1;
      const reader = dl.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        got += value.length;
        if (!out.write(Buffer.from(value))) await new Promise(r => out.once('drain', r));
        const pct = total ? Math.round((got / total) * 100) : 0;
        if (pct !== lastPct) { lastPct = pct; say({ state: 'downloading', percent: pct }); }
      }
      await new Promise((r, j) => out.end(err => err ? j(err) : r()));

      const unpack = path.join(work, 'app');
      fs.mkdirSync(unpack, { recursive: true });
      await run('/usr/bin/ditto', ['-x', '-k', zipPath, unpack]);
      const appName = fs.readdirSync(unpack).find(n => n.endsWith('.app'));
      if (!appName) throw new Error('Downloaded zip did not contain an app');
      fs.rmSync(zipPath, { force: true });

      staged = { version, appPath: path.join(unpack, appName) };
      say({ state: 'ready', version });

      if (!notified) {
        notified = true;
        const { response } = await dialog.showMessageBox(getWindow(), {
          type: 'info',
          title: 'Update ready',
          message: `VaziSafi LMS ${version} is ready to install`,
          detail: 'Installing restarts the app. Nothing is lost — but finish the order on screen first.',
          buttons: ['Install and restart', 'Later'],
          defaultId: 1,
          cancelId: 1
        });
        if (response === 0) install();
      }
    } catch (err) {
      say({ state: 'error', message: String(err && err.message || err) });
      if (interactive) dialog.showMessageBox(getWindow(), { type: 'warning', message: 'Could not update', detail: String(err && err.message || err) });
    } finally {
      busy = false;
    }
  }

  function install() {
    if (!staged) { check(true); return; }
    const script = path.join(os.tmpdir(), `vazisafi-update-${Date.now()}.sh`);
    const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
    fs.writeFileSync(script, [
      '#!/bin/bash',
      // wait for this copy of the app to exit, up to 30 s
      `for i in $(seq 1 60); do kill -0 ${process.pid} 2>/dev/null || break; sleep 0.5; done`,
      `LOG=${q(LOG)}`,
      'exec >>"$LOG" 2>&1; echo "=== $(date) update to ' + staged.version + '"',
      // 1. Prepare the NEW copy fully before touching the installed app:
      //    strip quarantine, ad-hoc sign, verify. If any step fails, keep the old app.
      `NEW=${q(staged.appPath)}`,
      '/usr/bin/xattr -cr "$NEW"',
      '/usr/bin/codesign --force --deep --sign - --timestamp=none "$NEW" || { echo "sign failed"; open ' + q(bundle) + '; exit 1; }',
      '/usr/bin/codesign --verify --deep --strict "$NEW" || { echo "verify failed"; open ' + q(bundle) + '; exit 1; }',
      // 2. Swap.
      `rm -rf ${q(bundle + '.old')}`,
      `mv ${q(bundle)} ${q(bundle + '.old')} || exit 1`,
      `if ! /usr/bin/ditto --norsrc --noextattr --noqtn "$NEW" ${q(bundle)}; then rm -rf ${q(bundle)}; mv ${q(bundle + '.old')} ${q(bundle)}; open ${q(bundle)}; exit 1; fi`,
      // 3. Clean up anything the copy picked up, re-sign in place, verify again.
      `/usr/bin/xattr -cr ${q(bundle)}`,
      `/usr/bin/codesign --force --deep --sign - --timestamp=none ${q(bundle)}`,
      `if ! /usr/bin/codesign --verify --deep --strict ${q(bundle)}; then echo "final verify failed, rolling back"; rm -rf ${q(bundle)}; mv ${q(bundle + '.old')} ${q(bundle)}; open ${q(bundle)}; exit 1; fi`,
      'echo "ok"',
      `rm -rf ${q(bundle + '.old')} ${q(work)}`,
      `open ${q(bundle)}`,
      `rm -f ${q(script)}`
    ].join('\n'), { mode: 0o755 });

    // Check the Applications folder is writable before quitting on the user.
    try { fs.accessSync(path.dirname(bundle), fs.constants.W_OK); }
    catch {
      dialog.showMessageBox(getWindow(), {
        type: 'warning', message: 'Cannot install the update',
        detail: `This Mac user cannot write to ${path.dirname(bundle)}. Sign in as an administrator, or move the app into Applications.`
      });
      return;
    }
    spawn('/bin/bash', [script], { detached: true, stdio: 'ignore' }).unref();
    setImmediate(() => app.quit());
  }

  setTimeout(() => check(false), 10_000);
  setInterval(() => check(false), CHECK_INTERVAL_MS);

  return { check, install, available: true };
}

module.exports = { init };
