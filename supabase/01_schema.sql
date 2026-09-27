-- ════════════════════════════════════════════════════════════════════════
-- Vazi Safi LMS — Supabase (Postgres) schema
-- Run this FIRST, in Supabase → SQL Editor → New query → Run.
-- Safe to re-run: every object is created with "if not exists".
--
-- Design notes
--   · Primary keys are TEXT and hold the id the app already generates
--     (SF-2431, c-l2k9x41, sh-…). That makes syncing a plain upsert — no id
--     translation, no duplicate rows if a till pushes twice.
--   · Every operational table carries branch_id, even though only one branch
--     exists today. Adding it later means rewriting every query.
--   · Money is integer KES. No cents in this business, and integers never
--     drift the way floats do.
-- ════════════════════════════════════════════════════════════════════════

-- ── Branches ────────────────────────────────────────────────────────────
-- 'plant' does the washing. 'pickup' only takes garments in and hands them
-- back; the work happens at a plant.
create table if not exists branches (
  id          text primary key,
  code        text not null,
  name        text not null,
  kind        text not null default 'plant' check (kind in ('plant','pickup')),
  active      boolean not null default true,
  town        text default 'Nairobi',
  address     text default '',
  phone       text default '',
  till        text default '',            -- M-Pesa till / paybill for this branch
  plant_id    text references branches(id), -- pickup points: which plant serves them
  opened_on   date,
  created_at  timestamptz not null default now()
);

-- ── People who sign in to the cloud (distinct from the counter PIN) ─────
create table if not exists members (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'shop' check (role in ('owner','shop')),
  branch_id   text references branches(id),
  name        text default '',
  created_at  timestamptz not null default now()
);

-- ── Staff (counter identities; no login of their own) ───────────────────
create table if not exists staff (
  id          text primary key,
  branch_id   text not null references branches(id),
  name        text not null,
  role        text default '',
  phone       text default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Services & pricing ──────────────────────────────────────────────────
create table if not exists services (
  id          text primary key,
  name        text not null,
  category    text default 'other',
  unit        text default 'item',
  icon        text default 'shirt',
  tiers       jsonb not null default '{}'::jsonb,   -- {student,normal,corporate}
  subtypes    jsonb not null default '[]'::jsonb,   -- [{name, price?}]
  active      boolean not null default true,
  sort        int default 0
);

-- ── Customers ───────────────────────────────────────────────────────────
create table if not exists customers (
  id            text primary key,
  branch_id     text references branches(id),   -- branch that registered them
  name          text not null,
  prefix        text default '+254',
  phone         text default '',
  segment       text default 'normal',          -- student | normal | corporate
  location      text default '',
  joined        date default current_date,
  orders_count  int not null default 0,
  spend         bigint not null default 0,
  loyalty       int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists customers_phone_idx  on customers (phone);
create index if not exists customers_branch_idx on customers (branch_id);

-- ── Order status pipeline ───────────────────────────────────────────────
-- A lookup table rather than an enum: a new pickup point can add a step
-- without a migration, and reports can group by pipeline stage.
create table if not exists order_statuses (
  code        text primary key,
  label       text not null,
  sort        int not null,
  phase       text not null,          -- intake | transit | production | handback | closed
  pickup_only boolean not null default false,
  terminal    boolean not null default false
);

insert into order_statuses (code,label,sort,phase,pickup_only,terminal) values
  ('intake',           'Received',            10, 'intake',     false, false),
  ('received_pickup',  'Received at pickup',  15, 'intake',     true,  false),
  ('in_transit_plant', 'In transit to plant', 20, 'transit',    true,  false),
  ('at_plant',         'At plant',            25, 'transit',    true,  false),
  ('washing',          'Washing',             30, 'production', false, false),
  ('drying',           'Drying',              40, 'production', false, false),
  ('ironing',          'Ironing',             50, 'production', false, false),
  ('folding',          'Folding',             60, 'production', false, false),
  ('ready',            'Ready',               70, 'handback',   false, false),
  ('in_transit_back',  'In transit to pickup',75, 'handback',   true,  false),
  ('at_pickup',        'Back at pickup',      80, 'handback',   true,  false),
  ('out_delivery',     'Out for delivery',    85, 'handback',   false, false),
  ('collected',        'Collected',           90, 'closed',     false, true),
  ('cancelled',        'Cancelled',           99, 'closed',     false, true)
on conflict (code) do update
  set label = excluded.label, sort = excluded.sort, phase = excluded.phase,
      pickup_only = excluded.pickup_only, terminal = excluded.terminal;

-- ── Orders ──────────────────────────────────────────────────────────────
create table if not exists orders (
  id            text primary key,                       -- SF-2431
  branch_id     text not null references branches(id),  -- where the work sits now
  origin_id     text references branches(id),           -- where it was taken in
  customer_id   text references customers(id),
  status        text not null default 'intake' references order_statuses(code),
  queue_no      int,                                    -- client number for the day
  tag           text default '',                        -- physical tag book number
  total         bigint not null default 0,
  discount      bigint not null default 0,
  discount_pct  numeric(5,2) not null default 0,
  paid          bigint not null default 0,
  method        text default '',
  txn           text default '',
  notes         text default '',
  rewash_of     text,
  rewashed_by   text,
  cashier_id    text references staff(id),
  shift_id      text,
  archived      boolean not null default false,         -- closed & filed, never deleted
  received_at   timestamptz not null default now(),
  due_at        timestamptz,
  collected_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists orders_branch_idx   on orders (branch_id, received_at desc);
create index if not exists orders_customer_idx on orders (customer_id);
create index if not exists orders_status_idx   on orders (status) where archived = false;
create index if not exists orders_tag_idx      on orders (branch_id, tag);

-- The client number resets each morning, so "branch + day + queue no" must be unique.
-- Indexing received_at::date directly will not do: casting a timestamptz to a date
-- depends on the session time zone, so Postgres refuses to index it. A stored column
-- pinned to Nairobi time is both immutable and the rule the shop actually follows.
alter table orders add column if not exists received_day date
  generated always as (((received_at at time zone 'Africa/Nairobi'))::date) stored;
create unique index if not exists orders_queue_idx
  on orders (branch_id, received_day, queue_no) where queue_no is not null;

create table if not exists order_items (
  order_id    text not null references orders(id) on delete cascade,
  line_no     int  not null,
  service_id  text references services(id),
  subtype     text default '',
  qty         numeric(10,2) not null default 1,
  price       bigint not null default 0,
  free        boolean not null default false,
  note        text default '',
  primary key (order_id, line_no)
);

-- Every status change, with the branch that made it. This is what turns a
-- pickup-point handoff into something you can audit: who had the clothes,
-- when, and how long they sat there.
create table if not exists order_events (
  id          text primary key,
  order_id    text not null references orders(id) on delete cascade,
  branch_id   text references branches(id),
  from_status text,
  to_status   text references order_statuses(code),
  staff_id    text,
  note        text default '',
  at          timestamptz not null default now()
);
create index if not exists order_events_order_idx on order_events (order_id, at);

-- ── Inter-branch dispatch (pickup point ⇄ plant) ────────────────────────
create table if not exists transfers (
  id           text primary key,
  from_branch  text not null references branches(id),
  to_branch    text not null references branches(id),
  status       text not null default 'sent' check (status in ('sent','received','disputed')),
  bags         int default 0,
  rider        text default '',
  sent_at      timestamptz not null default now(),
  sent_by      text default '',
  received_at  timestamptz,
  received_by  text default '',
  note         text default ''
);
create table if not exists transfer_orders (
  transfer_id text not null references transfers(id) on delete cascade,
  order_id    text not null references orders(id) on delete cascade,
  primary key (transfer_id, order_id)
);

-- ── Money in ────────────────────────────────────────────────────────────
create table if not exists payments (
  id          text primary key,
  branch_id   text not null references branches(id),
  order_id    text references orders(id),
  customer    text default '',
  method      text not null,            -- cash | mpesa | bank | …
  amount      bigint not null,
  txn         text default '',          -- M-Pesa code
  verified    boolean not null default false,
  shift_id    text,
  paid_at     timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists payments_branch_idx on payments (branch_id, paid_at desc);
create index if not exists payments_order_idx  on payments (order_id);
create unique index if not exists payments_txn_idx on payments (txn) where txn <> '';

-- ── Money out ───────────────────────────────────────────────────────────
create table if not exists expense_categories (
  id    text primary key,
  name  text not null,
  icon  text default 'package',
  color text default 'gray'
);

create table if not exists expenses (
  id              text primary key,
  branch_id       text not null references branches(id),
  category_id     text references expense_categories(id),
  label           text not null,
  amount          bigint not null,
  method          text default 'cash',
  txn             text default '',
  paid_by         text default '',
  notes           text default '',
  linked_order    text,
  linked_customer text,
  shift_id        text,
  spent_at        timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists expenses_branch_idx on expenses (branch_id, spent_at desc);

-- ── Cash control ────────────────────────────────────────────────────────
create table if not exists shifts (
  id            text primary key,
  branch_id     text not null references branches(id),
  staff_id      text,
  opened_at     timestamptz not null default now(),
  opening_float bigint not null default 0,
  closed_at     timestamptz,
  declared_cash bigint not null default 0,
  expected_cash bigint not null default 0,
  variance      bigint not null default 0,
  note          text default ''
);
create index if not exists shifts_open_idx on shifts (branch_id) where closed_at is null;

-- Numbers from the physical tag book that were spoiled. A number that is
-- neither on an order nor voided is the finding.
create table if not exists void_tags (
  branch_id text not null references branches(id),
  tag       text not null,
  reason    text default '',
  staff_id  text default '',
  at        timestamptz not null default now(),
  primary key (branch_id, tag)
);

-- ── Handback & rider settlement ─────────────────────────────────────────
create table if not exists releases (
  id                 text primary key,
  branch_id          text not null references branches(id),
  order_id           text references orders(id),
  tag                text default '',
  released_to        text default '',
  staff_id           text default '',
  balance_at_release bigint not null default 0,
  at                 timestamptz not null default now()
);

create table if not exists dispatch (
  id          text primary key,
  branch_id   text not null references branches(id),
  order_id    text references orders(id),
  customer_id text references customers(id),
  kind        text not null default 'delivery' check (kind in ('pickup','delivery')),
  address     text default '',
  area        text default '',
  rider       text default '',
  slot_start  text default '',
  slot_end    text default '',
  notes       text default '',
  status      text not null default 'scheduled',
  created_at  timestamptz not null default now()
);

-- The controlled document the rider signs for and must bring back.
create table if not exists delivery_cards (
  id              text primary key,
  branch_id       text not null references branches(id),
  serial          text not null,              -- SF-2431-07
  order_id        text references orders(id),
  dispatch_id     text references dispatch(id),
  customer_id     text,
  rider           text default '',
  tag             text default '',
  queue_no        int,
  amount_due      bigint not null default 0,
  issued_at       timestamptz not null default now(),
  issued_by       text default '',
  returned_at     timestamptz,
  returned_by     text default '',
  received_amount bigint not null default 0,
  received_method text default '',
  received_txn    text default '',
  note            text default ''
);
create unique index if not exists delivery_cards_serial_idx on delivery_cards (branch_id, serial);
create index if not exists delivery_cards_open_idx on delivery_cards (branch_id) where returned_at is null;

-- ── Stock ───────────────────────────────────────────────────────────────
create table if not exists inventory (
  id          text primary key,
  branch_id   text not null references branches(id),
  name        text not null,
  unit        text default 'unit',
  qty         numeric(12,2) not null default 0,
  reorder_at  numeric(12,2) not null default 0,
  cost        bigint not null default 0,
  supplier    text default '',
  updated_at  timestamptz not null default now()
);

-- ── Customer-facing extras ──────────────────────────────────────────────
create table if not exists packages (
  id          text primary key,
  branch_id   text references branches(id),
  name        text not null,
  price       bigint not null default 0,
  period      text default 'month',
  includes    jsonb not null default '[]'::jsonb,
  subscribers int not null default 0,
  active      boolean not null default true
);

create table if not exists discounts (
  id      text primary key,
  code    text,
  label   text default '',
  kind    text default 'percent',
  value   numeric(10,2) not null default 0,
  uses    int not null default 0,
  active  boolean not null default true,
  expires date
);

create table if not exists issues (
  id         text primary key,
  branch_id  text not null references branches(id),
  order_id   text,
  subject    text not null,
  priority   text default 'medium',
  status     text default 'open',
  raised_by  text default '',
  details    text default '',
  raised_at  timestamptz not null default now()
);

create table if not exists messages (
  id         text primary key,
  branch_id  text not null references branches(id),
  order_id   text,
  to_phone   text default '',
  name       text default '',
  body       text not null,
  stage      text default '',
  method     text default 'sms',
  status     text default 'sent',
  gateway_id text default '',           -- Africa's Talking message id, once wired
  cost       numeric(10,4),
  sent_at    timestamptz not null default now()
);
create index if not exists messages_order_idx on messages (order_id);

-- ── Governance ──────────────────────────────────────────────────────────
create table if not exists approvals (
  id            text primary key,
  branch_id     text not null references branches(id),
  action        text not null,          -- delete_order | rewash_order | edit_order | refund_order
  target        text not null,
  reason        text default '',
  payload       jsonb,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by  text default '',
  requested_at  timestamptz not null default now(),
  decided_by    text default '',
  decided_at    timestamptz,
  decision_note text default ''
);

-- Append-only. No update or delete policy is ever granted on this table.
create table if not exists audit_log (
  id        text primary key,
  branch_id text references branches(id),
  at        timestamptz not null default now(),
  staff_id  text default '',
  action    text not null,
  target    text default '',
  detail    text default '',
  meta      jsonb
);
create index if not exists audit_log_at_idx on audit_log (branch_id, at desc);

-- ── Configuration ───────────────────────────────────────────────────────
create table if not exists settings (
  branch_id  text not null references branches(id),
  key        text not null,
  value      jsonb,
  updated_at timestamptz not null default now(),
  primary key (branch_id, key)
);

create table if not exists sms_templates (
  branch_id text not null references branches(id),
  key       text not null,              -- intake | ready | washing | …
  body      text not null,
  primary key (branch_id, key)
);

-- ── Snapshot backups (what the app pushes today) ────────────────────────
create table if not exists backups (
  id         bigserial primary key,
  branch_id  text references branches(id),
  device     text,
  app_version text,
  created_at timestamptz not null default now(),
  payload    jsonb not null
);
create index if not exists backups_recent_idx on backups (created_at desc);

-- ── Housekeeping ────────────────────────────────────────────────────────
-- Archive closed orders instead of deleting them. Run it whenever, or from a
-- scheduled job later: select archive_closed_orders(180);
create or replace function archive_closed_orders(older_than_days int default 180)
returns int language plpgsql as $$
declare n int;
begin
  update orders set archived = true
   where archived = false
     and status in (select code from order_statuses where terminal)
     and received_at < now() - (older_than_days || ' days')::interval;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists orders_touch on orders;
create trigger orders_touch before update on orders
  for each row execute function touch_updated_at();

drop trigger if exists customers_touch on customers;
create trigger customers_touch before update on customers
  for each row execute function touch_updated_at();
