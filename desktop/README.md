# Safi LMS — Electron desktop shell

Wraps the existing prototype as a Windows and macOS POS application. The web app's own
files are unmodified; the shell adds the native pieces a browser cannot do.

## Run it

Needs Node.js 18+ (nodejs.org).

    npm install
    npm start

Kiosk mode (fullscreen, no menu bar — how a terminal should boot):

    npm run start:kiosk

Same command on Windows and on a Mac.

A dark pill appears bottom-right when the shell is live: app version, a network dot
(green online / red offline), and a **Hardware** tray for printer and drawer tests.

## Build an installer

Windows:

    npm run dist            # VaziSafi LMS Setup.exe (NSIS installer)
    npm run dist:portable   # single portable .exe, no install

macOS:

    npm run dist:mac        # VaziSafi LMS.dmg + .zip, Apple Silicon and Intel

Output lands in `dist/`. **Each installer must be built on its own OS** — the `.exe` on
Windows, the `.dmg` on a Mac. There is no cross-building here.

## Opening the Mac build

The app is unsigned, so macOS blocks it — on Sequoia the message even says "Malware

Blocked" and it may move the app to the Bin. It is not malware; macOS says that about any
app with no Apple signature.

Three ways round it, cheapest first:

**Build it on the Mac that will run it.** A locally built app is never quarantined:

    npm run dist:mac && open dist

**Strip the quarantine flag** from a downloaded copy — do it to the `.dmg` *before*
opening it:

    xattr -cr ~/Downloads/VaziSafi-LMS-*.dmg

or, if the app is already in Applications:

    sudo xattr -cr "/Applications/VaziSafi LMS.app"
    sudo codesign --force --deep --sign - "/Applications/VaziSafi LMS.app"

**Sign and notarise it properly** — the only fix that scales past one machine, and the
thing that also turns on auto-update for macOS. Needs an Apple Developer account
($99/yr): set `CSC_LINK` / `CSC_KEY_PASSWORD` (Developer ID certificate) plus `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`, then add `"notarize": true` under
`build.mac` in `package.json`. Hardened runtime and entitlements are already configured
(`desktop/entitlements.mac.plist`).

Windows has no equivalent obstacle — the `.exe` installs and auto-updates as-is.

## What the shell adds

| Capability | Status |
| --- | --- |
| Own window, desktop icon, no browser chrome | working, Windows + macOS |
| Native macOS menu bar (About / Hide / Window / Cmd+Q) | working |
| Kiosk / fullscreen (F11, or Ctrl+Cmd+F on Mac, or `--kiosk`) | working |
| Single instance — never two copies on one till | working |
| Silent receipt printing, 80mm thermal, no print dialog | working, pick printer first |
| Printer picker, remembered per device | working (Hardware menu) |
| Cash drawer ESC/POS pulse | payload ready, needs a raw-print module |
| Offline indicator | working |
| External links open in the real browser | working |
| Auto-update | working, one shared feed (see below) |

Device settings (chosen printer, device name) live in a `device.json` under the OS
user-data folder — Help → About shows the path. On Windows that is
`%APPDATA%\VaziSafi LMS`, on macOS `~/Library/Application Support/VaziSafi LMS`.

That folder is per-machine: a Mac and a Windows till each hold their own data until the
Supabase step puts them on one database.

## Releasing without a Windows machine

You work on a Mac; the tills run Windows. A Windows `.exe` cannot be built on a Mac — so
GitHub builds it for you, on its own Windows machine, free.

`.github/workflows/release.yml` is already set up. To ship an update from the Mac:

1. Bump `"version"` in `package.json`.
2. Commit and tag it:

       git add .
       git commit -m "what changed"
       git push
       git tag v0.1.1
       git push origin v0.1.1

   (The tag must match the version, with a `v` in front.)

3. Watch it build at https://github.com/tn-mutunga/vazisafi-lms/actions — takes a few
   minutes. It produces the Windows `.exe` and the Mac `.dmg` and attaches both to a
   **draft** release.

4. Go to the Releases page and click **Publish release**.

Every Windows till then picks it up within 6 hours, wherever you happen to be. No token
setup needed for this route — GitHub Actions supplies its own.

## Updating both apps from one place

Both builds check the **same GitHub release** for new versions. You publish once; the
Windows till and the Mac each pick up their own installer from it.

Setup, once:

1. Create a repo called `vazisafi-lms` under **github.com/tn-mutunga** (private is fine —
   see the note below). `build.publish` in `package.json` already points at it.
2. Make a GitHub personal access token with `repo` scope
   (Settings → Developer settings → Personal access tokens) and export it as `GH_TOKEN`
   in the terminal you release from.
3. `npm i` (pulls in `electron-updater`, already listed as a dependency).

> A **private** repo works, but every till needs the token baked in to read it. Simpler:
> keep the repo private and the *releases* public, or just use a public repo — the
> installers are what's public, and the source can live elsewhere.

Every release after that:

1. Bump `version` in `package.json` (e.g. `0.1.0` → `0.1.1`). Updates only fire when the
   number goes up.
2. On a Mac:      `npm run release:mac`
3. On Windows:    `npm run release:win`

Both commands publish into the same GitHub release for that version — the `.exe`, the
`.dmg`, and the `latest.yml` / `latest-mac.yml` manifests each app reads.

What the tills then do, with no one touching them: check 10 seconds after launch and
every 6 hours, download in the background, and ask once — "Install and restart" or
"Install when I close the app". Choosing the second installs silently on next quit, so a
sale is never interrupted. There is also **Check for updates…** in the app menu.

The web app can read the same state: `window.lms.updateStatus()`, `window.lms.onUpdate(fn)`,
`window.lms.checkUpdate()`.

### The one catch: macOS needs signing

Windows auto-update works with an unsigned build. macOS auto-update **does not** — an
unsigned Mac app can download an update but macOS refuses to install it. Until you have
an Apple Developer ID ($99/yr), the Mac copy has to be updated by hand: download the new
`.dmg` and drag it over. Everything else is already wired, so adding the certificate is
the only step that turns it on.

If you would rather not use GitHub, swap `build.publish` for `{"provider":"s3"}` or
`{"provider":"generic","url":"https://updates.vazisafi.co.ke"}` — any static file host
works, the client code is unchanged.

## Finishing the hardware bits

**Cash drawer / raw ESC/POS**

    npm i @thiagoelg/node-printer

The kick pulse (`1B 70 00 19 FA`) is already built in `main.js`; installing the module
makes Hardware → Open cash drawer fire for real. A serial drawer works the same way
via `npm i serialport`. Both modules are native — rebuild them per platform, so the Mac
build and the Windows build each need their own `npm install`.

**Barcode scanner** — most scanners are keyboard-emulating and already work; they type
the code into the focused field. Only a serial scanner needs `serialport`.

**Weighing scale** — serial. Use `serialport`, read the stream, add an IPC channel next
to `lms:openDrawer`.

**Auto-update** — done, see "Updating both apps from one place" above.

## Supabase notes

Nothing changes — the app is still a client. Two desktop-only wins worth taking:

1. Keep the Supabase keys in the main process, not the renderer.
2. Queue writes locally when the network dot is red and flush on reconnect. This is the
   petrol-station kiosk case, and it is the main reason to be on Electron rather than a PWA.
