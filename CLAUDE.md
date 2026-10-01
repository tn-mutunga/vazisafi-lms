# Laundry Management System (LMS) — Project Notes

## Product
A role-based laundry management prototype (front desk + owner). Built as an HTML/React-Babel
prototype. Main file: `Safi Laundry Management.html`. Data currently in `store.js` (localStorage).

## Decided architecture direction (for the real build)
- **Database platform: Supabase (Postgres).** Chosen over Firebase / MongoDB Atlas for clean
  relational structure and easy cross-branch reporting.
- Region: `eu-central` (Frankfurt) — closest low-latency option to Nairobi (no Africa region yet).
- Free tier for build/pilot; upgrade to Pro (~$25/mo) at go-live for no auto-pause + daily backups.

## Multi-location plan
- Owner plans to open pick-up points (petrol stations / malls) across Nairobi, ~2–3 per year.
- Model a `branches` table and put `branch_id` on every operational table NOW (orders, payments,
  expenses, inventory, staff, etc.) even with one branch.
- Pickup points are intake-only: model an order status pipeline for location handoffs
  (Received at pickup → In transit → At plant → Washing → Ready → Returned to pickup → Collected).
- Per-branch cash reconciliation; inter-branch dispatch.

## Data lifecycle decision
- Do NOT periodically wipe the database. Keep data continuous (customer history, packages, trends).
- Instead: automated bi-monthly export → email backup, and archive CLOSED orders (status flag /
  archive table) rather than deleting. Optionally a one-time clean wipe at go-live only.

## Database layer (DONE — 2026-09-19)
- Schema lives in `supabase/`: 01_schema.sql (tables), 02_security.sql (RLS), 03_seed.sql
  (branches, categories, templates, reporting views, owner/till member rows), SETUP.md (walkthrough).
- Text primary keys hold the app's own ids, so sync is a plain upsert.
- Six branches seeded: `main` active, `br1`–`br5` inactive placeholders.
- Two logins: `owner` (all branches, can delete) and `shop` (own branch, cannot delete anything).
- audit_log is append-only at the database level (no update/delete policy exists).
- `sync.js` maps every local collection to a table; Live sync toggle on Cloud & Updates.

## Status (2026-09-28)
- Supabase project LIVE (Frankfurt, Pro). 01–04 SQL run. Owner tnmutunga@gmail.com, shop vazisafi.thikard@gmail.com.
- Released through v0.1.6 via tag push; workflow = prepare → build(win,mac) → publish (no manual publish).
- Mac self-updater (desktop/updater-mac.js) downloads zip, swaps bundle, xattr -cr + ad-hoc codesign, relaunch.
  v2.0.1 will be the first real test of it. Fallback: xattr -cr + codesign --force --deep --sign - + open.
- User copies files via: rsync -av ~/Downloads/<folder>/ ./  (never Finder-replace folders; .git lives there).

## NEXT: Incoming payments (agreed design, not built)
- Shop Android phone 0704178004 (owner's wife holds it) receives Family Bank alerts (Paybill 222111 acc 161678)
  and M-Pesa "You have received" SMS. Forward via Android "SMS to URL" app → Supabase edge function (secret key,
  sender filter MPESA/Family Bank) → payments_inbox table.
- Payer often ≠ customer (parents/boyfriend pay for students): match on amount+time, remember "known payers" per customer.
- Front Desk "Incoming payments" window (no PIN): unmatched payments left, open orders right, tap-tap-confirm;
  split/combined payments; "Not for an order" with reason; badge count; all in audit log.
- Month-end reconciliation: matched / money with no order / order marked paid with no money.
- WAITING ON USER: two sample alerts pasted verbatim (Family Bank + M-Pesa received).
- Then Africa's Talking SMS sending via the same edge-function setup (sender ID application pending).

## v2.0.1 (built, not yet released)
- Price models (pricing.js, screens-pricing.jsx): Current, M7, M2, M6 for Wash & Fold only (svc id wash-fold).
- Two-way sync: supabase/05_two_way_sync.sql adds updated_at to all synced tables. sync.js pushes only rows
  changed since last match (fingerprints in localStorage safi_sync_base_v1_<branch>), pulls rows newer than cursor
  every 2 min. First run per laptop: "This laptop is correct" / "The cloud is correct". Deletes sync via deleted_rows table (trigger). Shop login deletes are refused by RLS → row restored locally, hint shown.

## Ops features (v2.0.1, screens-ops.jsx)
- Student Thursday: settings.studentDay {on, rate 110, day 4} overrides student Wash & Fold rate on Thursdays (pricing.js ruleFor).
- Clients-by-service-today card on both dashboards. Dispatch customer = CustomerTypeahead. Front desk packages read-only.
- Dispatch: month calendar (DispatchCalendar), old jobs backfilled slotDate (slotDateGuessed flag), chime (WebAudio) + flash; overdue re-chimes every 15 min; chime toggle settings.dispatchChime.
- Cloud sign-in: refresh only signs out when server says token not found/revoked; recovers if another window rotated it; renews every 30 min, on open and on wake; auto-sync after sign-in; email remembered.
- Dispatch reminder bar (all screens) + toast 30 min before slot; dispatch now has slotDate.
- Collected / delivery-completed blocked while balance > 0.
- Win-back SMS card on Messages (N days, auto once/day, deduped by phone). Logged only until SMS gateway exists.
- Orders & printing counts (today/month) on owner dashboard; prints logged as audit 'print.receipt' / 'print.jobcard'.

## PENDING / REMEMBER
- Africa's Talking SMS gateway still not wired (messages.gateway_id/cost columns are waiting for it).
- Rebuild the offline bundle + desktop installers after any change (sync.js must be included).
- Business M-Pesa till in the company name still outstanding.
