repo: tn-mutunga/vazisafi-lms
branch: main
visibility: public

## Last sync
date: 2026-09-19
note: database layer added (Supabase schema, RLS, seed, per-table sync)

### Updated in this project
- Full Postgres schema in supabase/ — 01_schema, 02_security, 03_seed, SETUP.md
- branch_id on every operational table; 6 branches seeded (Main live, 5 placeholders)
- Order status pipeline as a lookup table, incl. pickup-point handoff steps
- sync.js: per-table push/pull behind a Live sync toggle; snapshot backup unchanged

## Sync history
- 2026-09-12 — initial push from the Mac (local folder ~/Documents/Vazi Safi/Laundry Management System); Electron mac+win builds, auto-update via GitHub Releases, real customer list gitignored

## Screen map
| Area | Built from |
| --- | --- |
| App shell / routing | app.jsx, components.jsx, styles.css |
| Front desk (POS, intake, stages) | screens-frontdesk.jsx |
| Owner dashboard / reports | screens-owner.jsx |
| Expenses | screens-expenses.jsx |
| Settings, SMS templates, misc | screens-extra.jsx |
| Data + persistence | store.js, data.js |
| Cloud connection, backup, live sync | cloud.js, sync.js, screens-cloud.jsx |
| Database schema + setup | supabase/01_schema.sql, 02_security.sql, 03_seed.sql, SETUP.md |
| Desktop shell (Win + Mac) | desktop/main.js, desktop/preload.js, desktop/updater.js |
| Release + build config | package.json, desktop/entitlements.mac.plist |
