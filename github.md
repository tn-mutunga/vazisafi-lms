repo: tn-mutunga/vazisafi-lms
branch: main
visibility: public

## Last sync
date: 2026-09-12
note: initial push from the Mac (local folder ~/Documents/Vazi Safi/Laundry Management System)

### Updated in this project
- Electron shell now builds for macOS as well as Windows (dmg + zip, arm64 + x64)
- Native macOS menu bar; Ctrl+Cmd+F toggles kiosk
- Auto-update wired via electron-updater against one shared GitHub Releases feed
- .gitignore excludes the real customer list; only the blank import template is committed

## Screen map
| Area | Built from |
| --- | --- |
| App shell / routing | app.jsx, components.jsx, styles.css |
| Front desk (POS, intake, stages) | screens-frontdesk.jsx |
| Owner dashboard / reports | screens-owner.jsx |
| Expenses | screens-expenses.jsx |
| Settings, SMS templates, misc | screens-extra.jsx |
| Data + persistence | store.js, data.js |
| Desktop shell (Win + Mac) | desktop/main.js, desktop/preload.js, desktop/updater.js |
| Release + build config | package.json, desktop/entitlements.mac.plist |
