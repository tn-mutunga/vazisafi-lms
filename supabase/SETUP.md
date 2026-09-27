# Connecting Vazi Safi to Supabase

Everything below is done once. The shop keeps working the whole time — the app runs on
the laptop's own storage, and the cloud is a mirror it writes to, not something it
depends on.

Three SQL files, run in order:

| File | What it does |
| --- | --- |
| `01_schema.sql` | Every table, plus the order status pipeline and the archive function |
| `02_security.sql` | Row level security: what the owner login can do, what the till login can do |
| `03_seed.sql` | Branches, expense categories, SMS templates, reporting views, and your owner account |

---

## 1. Create the project

1. Go to supabase.com and sign up. GitHub login is fine.
2. New project.
   - **Name**: `vazisafi-lms`
   - **Region**: Central EU (Frankfurt). There is no African region yet; Frankfurt is the
     closest by latency to Nairobi.
   - **Database password**: generate one and save it in your password manager. You will
     rarely need it, but it cannot be recovered — only reset.
3. Free tier is right for the build and the pilot. Move to Pro (~$25/month) at go-live:
   it stops the project pausing after a week of inactivity and adds daily backups.

Wait for the project to finish provisioning, about two minutes.

## 2. Run the schema

Left sidebar → **SQL Editor** → **New query**.

Paste the whole of `01_schema.sql`, press **Run**. It should end with "Success. No rows
returned." Repeat for `02_security.sql`, then `03_seed.sql`.

Order matters. `02` creates policies on tables that `01` creates, and `03` inserts into
them.

## 3. Create the two logins

Left sidebar → **Authentication** → **Users** → **Add user** → *Create new user*.

| Email | Password | Who uses it |
| --- | --- | --- |
| your own address | strong, yours alone | You, from anywhere |
| `till@vazisafi.co.ke` (or any address you control) | kept on the shop laptop | The counter machine |

Tick *Auto Confirm User* for both, so neither needs an email link.

The till account is not a person. It is the machine. It can write today's work and read
its own branch, and it cannot delete anything — deletions go through the approvals queue
in the app, where you see them.

## 4. Make yourself the owner

Open `03_seed.sql`, scroll to the bottom, replace `OWNER-EMAIL-HERE` and
`TILL-EMAIL-HERE` with the two real addresses, and run just that block in the SQL editor.

Check it worked:

```sql
select m.role, m.branch_id, u.email from members m join auth.users u on u.id = m.user_id;
```

Two rows, one `owner`, one `shop`. If you see none, the emails did not match what is in
Authentication → Users.

## 5. Connect the app

In Vazi Safi: **Management → Cloud & Updates**.

1. Supabase → **Project Settings → API**. Copy *Project URL* and the *anon public* key.
   The anon key is designed to be public; row level security is what protects the data,
   not the key.
2. Paste both into the app, set **This branch** to *Vazi Safi Main*, press **Save**, then
   **Test connection**.
3. Sign in with your owner email and password.
4. Press **Check schema**. It should say all tables are present.
5. Press **Send everything now** once, to load what is already on the laptop.
6. Turn on **Keep the cloud up to date automatically**.

From then on, changes go up a few seconds after they are made, and again whenever the
internet comes back after a drop.

---

## What is in the database

**Branches.** Six rows: Main, and five inactive placeholders. Every order, payment,
expense, shift and tag carries a `branch_id` from the first day, so when a pick-up point
at a petrol station opens you switch its row to active and the history splits by itself.
Adding that column later would mean rewriting every report.

**Order status pipeline.** A table, not a fixed list, so the handoff steps a pick-up point
needs are already there:

```
Received at pickup → In transit to plant → At plant → Washing → Drying → Ironing
→ Folding → Ready → In transit to pickup → Back at pickup → Collected
```

The shop today uses the short version (Received → Washing → … → Collected). The extra
steps sit unused until there is a second location.

**Order events.** Every status change is written with the branch that made it and the time.
This is what makes a handoff auditable: who had the clothes, for how long, and where they
stalled.

**Audit log.** Append-only, enforced by the database, not by the app. There is no update
policy and no delete policy on that table, so nothing can quietly edit a line — not the
till account, not even the owner account through the app.

**Archive, not delete.** `archive_closed_orders(180)` marks collected orders older than
six months as archived. They drop out of the working lists and stay in the history.
Nothing is ever removed.

**Views.** Ready-made answers, all of them per-branch:

- `v_daily_takings`, `v_daily_pnl` — money in, money out, net, by day
- `v_work_in_progress` — what is physically in the building, by stage
- `v_released_unpaid` — clothes handed over with a balance still owed
- `v_open_delivery_cards` — delivery notes that went out and never came back
- `v_shift_variances` — cash counts that did not match
- `v_tag_gaps` — tag numbers with no order and no void against them
- `v_orders_without_sms` — intake with no customer text on record

Any of these can be read straight out of Supabase's table editor, or wired into a
management screen later.

## Things worth knowing

**Two project settings.** When you create the project, tick **Enable automatic RLS** — it
is a safety net, and `02_security.sql` turns row level security on explicitly anyway.
Leave **grant privileges to Data API roles by default** enabled. `02_security.sql` now
states the grants itself, so either setting works, but there is no reason to make it
harder.

**The anon key is safe to ship.** It only lets a caller reach the API. Row level security
decides what they see, and every policy requires a signed-in member row.

**The till login cannot delete.** Not orders, not payments, not audit lines. This is a
database rule, so it holds even if someone opens the API directly rather than the app.

**Offline is normal, not an error.** No internet means the sync is queued, not lost. The
counter never blocks on the cloud.

**Two machines writing at once.** Rows are matched on the id the app generates, so a push
is an upsert and the same order pushed twice is one row. Last write wins on a conflict,
which is correct for one shop with one counter. It is not correct for two tills editing
the same order at the same second — if the shop ever gets to that, the fix is per-row
timestamps, not a bigger sync.

The same caution applies harder to the customer totals. `customers.orders_count` and
`customers.spend` are running totals the app keeps on the laptop, and a push overwrites
the cloud with whatever that laptop believes. Two machines, or a restore followed by a
push, can leave those two figures disagreeing with the orders behind them. The orders
themselves are always right; recompute the totals from them when they look off:

```sql
update customers c set
  orders_count = t.n,
  spend        = t.total
from (select customer_id, count(*) n, sum(total) total
      from orders where not archived group by customer_id) t
where t.customer_id = c.id;
```

## When it goes wrong

| Message | Cause |
| --- | --- |
| *Could not find the table … in the schema cache* | The SQL has not been run, or was run on a different project |
| *new row violates row-level security policy* | No `members` row for the signed-in user — step 4 |
| *JWT expired* | Sign out and back in on the Cloud screen |
| *No internet connection* | Expected; the app carries on and syncs later |
| *duplicate key value violates unique constraint "payments_txn_idx"* | The same M-Pesa code was entered twice. That constraint is deliberate |
