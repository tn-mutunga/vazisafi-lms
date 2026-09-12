# Publishing VaziSafi LMS to GitHub

One-time setup, then a three-command routine every time you want to push an update.

---

## 1. Create the repo

Go to https://github.com/new

- **Repository name:** `vazisafi-lms`
- **Public** (simplest — the tills can then fetch updates with no token)
- Do **not** tick "Add a README"

Click **Create repository**.

---

## 2. Make an access token

https://github.com/settings/tokens → **Generate new token (classic)**

- Note: `vazisafi-releases`
- Expiration: **No expiration**
- Scope: tick **`repo`** (the whole box)

Generate, then **copy the token** — GitHub shows it once. Paste it somewhere safe.

---

## 3. Push the code

Open a terminal in this project folder.

**Windows (PowerShell):**

    git init
    git add .
    git commit -m "VaziSafi LMS desktop app"
    git branch -M main
    git remote add origin https://github.com/tn-mutunga/vazisafi-lms.git
    git push -u origin main

**Mac (Terminal):** identical commands.

Git will ask you to sign in — use the token as the password, not your GitHub password.

---

## 4. Install dependencies

    npm install

Needs Node.js 18+ from https://nodejs.org — install it first if `npm` is not recognised.

---

## Releasing an update

Every time you want the tills to get a new version:

**Step 1 — bump the version.** Open `package.json`, change `"version"`:

    "version": "0.1.0",   ->   "version": "0.1.1",

Nothing updates if the number does not go up.

**Step 2 — set the token** (once per terminal session).

PowerShell:

    $env:GH_TOKEN = "ghp_yourtokenhere"

Mac / Git Bash:

    export GH_TOKEN=ghp_yourtokenhere

**Step 3 — build and publish.**

On Windows:

    npm run release:win

On a Mac:

    npm run release:mac

Each command builds the installer and uploads it to a GitHub release named after the
version. Run both if you want both platforms updated — they publish into the *same*
release.

**Step 4 — publish the release.** electron-builder uploads it as a *draft*. Go to
https://github.com/tn-mutunga/vazisafi-lms/releases, open the draft, click **Publish
release**. Nothing reaches the tills until you do this — which is your safety net.

That's it. Within 6 hours (or on next launch) every Windows till downloads the update
and asks the user to restart.

---

## Also commit your day-to-day changes

Any time you edit the app:

    git add .
    git commit -m "what changed"
    git push

---

## Notes

- `node_modules/` and `dist/` are excluded by `.gitignore` — don't commit them.
- The Mac build auto-downloads updates but **cannot self-install** without an Apple
  Developer ID ($99/yr). Until then, update the Mac by downloading the new `.dmg` from
  the releases page and dragging it over. Windows is fully automatic.
- If you later want to keep the source private: make the repo private, but create a
  second **public** repo (e.g. `vazisafi-releases`) and point `build.publish.repo` at
  it. Then the tills need no token.
