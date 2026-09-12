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

## PENDING / REMEMBER
- **TODO: Write the Supabase SQL schema** (all tables, relationships, branch_id dimension, order
  status pipeline for pickup points) tailored to the prototype's data model. User will return to this.
- Current focus before that: optimizing/improving the LMS prototype itself.
