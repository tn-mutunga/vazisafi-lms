-- ════════════════════════════════════════════════════════════════════════
-- Vazi Safi LMS — seed
-- Run this THIRD. Creates the branch list, the expense categories, the SMS
-- templates and the reporting views, then makes you the owner.
--
-- The five extra branches are placeholders, inactive. They do not show in the
-- app until you set active = true, but every order, payment and expense from
-- day one already carries a branch_id — so the day a pickup point opens, the
-- history splits cleanly instead of being one undifferentiated pile.
-- ════════════════════════════════════════════════════════════════════════

insert into branches (id, code, name, kind, active, town, opened_on) values
  ('main', 'VS',  'Vazi Safi Main', 'plant',  true,  'Nairobi', current_date),
  ('br1',  'VS1', 'Branch 1',       'pickup', false, 'Nairobi', null),
  ('br2',  'VS2', 'Branch 2',       'pickup', false, 'Nairobi', null),
  ('br3',  'VS3', 'Branch 3',       'pickup', false, 'Nairobi', null),
  ('br4',  'VS4', 'Branch 4',       'pickup', false, 'Nairobi', null),
  ('br5',  'VS5', 'Branch 5',       'pickup', false, 'Nairobi', null)
on conflict (id) do nothing;

-- Pickup points are served by the main plant until another plant exists.
update branches set plant_id = 'main' where kind = 'pickup' and plant_id is null;

insert into expense_categories (id, name, icon, color) values
  ('ec-detergent', 'Detergent & chemicals', 'droplet',  'blue'),
  ('ec-utilities', 'Water & electricity',   'zap',      'amber'),
  ('ec-rent',      'Rent',                  'home',     'gray'),
  ('ec-wages',     'Wages',                 'users',    'green'),
  ('ec-transport', 'Transport & delivery',  'truck',    'purple'),
  ('ec-repairs',   'Repairs & maintenance', 'wrench',   'red'),
  ('ec-packaging', 'Packaging & bags',      'package',  'teal'),
  ('ec-other',     'Other',                 'package',  'gray')
on conflict (id) do nothing;

insert into sms_templates (branch_id, key, body) values
  ('main','intake',   'Vazi Safi: order {id} received, {items} item(s), total {total}. Tag {tag}. Pay ONLY to {payto}. Queries {owner}.'),
  ('main','washing',  'Hi {name}, your order {id} is being washed. We will text you when ready.'),
  ('main','ironing',  'Hi {name}, your order {id} is being ironed and will be ready soon.'),
  ('main','ready',    'Hi {name}, your order {id} is READY for collection at Vazi Safi. Balance: {balance}. Asante!'),
  ('main','delivery', 'Hi {name}, our rider {rider} is on the way with your order {id}. Please be available.'),
  ('main','collected','Hi {name}, your order {id} has been collected. Asante, karibu tena!')
on conflict (branch_id, key) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- Reporting views — the questions you ask the books, answered per branch so
-- they keep working when there are six of them.
-- ════════════════════════════════════════════════════════════════════════

create or replace view v_daily_takings as
select p.branch_id, b.name as branch, p.paid_at::date as day, p.method,
       count(*) as payments, sum(p.amount) as amount
from payments p join branches b on b.id = p.branch_id
group by 1,2,3,4;

create or replace view v_daily_pnl as
select d.branch_id, d.day,
       coalesce(i.amount,0) as takings,
       coalesce(e.amount,0) as expenses,
       coalesce(i.amount,0) - coalesce(e.amount,0) as net
from (
  select branch_id, paid_at::date as day from payments
  union
  select branch_id, spent_at::date as day from expenses
) d
left join (select branch_id, paid_at::date as day, sum(amount) as amount
             from payments group by 1,2) i
  on i.branch_id = d.branch_id and i.day = d.day
left join (select branch_id, spent_at::date as day, sum(amount) as amount
             from expenses group by 1,2) e
  on e.branch_id = d.branch_id and e.day = d.day;

-- Work in progress: what is physically in the building, by stage.
create or replace view v_work_in_progress as
select o.branch_id, s.phase, s.label as status, count(*) as orders,
       sum(o.total - o.paid) as unpaid_value
from orders o join order_statuses s on s.code = o.status
where not s.terminal and not o.archived
group by 1,2,3, s.sort order by s.sort;

-- Orders released with money still owed — the leak this system exists to close.
create or replace view v_released_unpaid as
select r.branch_id, r.order_id, r.at, r.released_to, r.staff_id, r.balance_at_release
from releases r where r.balance_at_release > 0 order by r.at desc;

-- Delivery notes that went out and never came back.
create or replace view v_open_delivery_cards as
select branch_id, serial, order_id, rider, amount_due, issued_at, issued_by,
       (now() - issued_at) as outstanding_for
from delivery_cards where returned_at is null order by issued_at;

-- Cash counts that did not match.
create or replace view v_shift_variances as
select s.branch_id, s.id, s.staff_id, s.opened_at, s.closed_at,
       s.expected_cash, s.declared_cash, s.variance
from shifts s where s.closed_at is not null and s.variance <> 0
order by s.closed_at desc;

-- Tag numbers issued with no order and no void against them.
-- The range is bounded: one mistyped tag (a stray 999999) would otherwise make this
-- view generate a million rows. A tag book is a few hundred numbers, so 5,000 is a
-- generous ceiling and anything past it is a typo, not a gap.
create or replace view v_tag_gaps as
with used as (
  select branch_id, tag from orders where tag <> ''
  union select branch_id, tag from void_tags
), nums as (
  select branch_id, nullif(regexp_replace(tag,'\D','','g'),'')::bigint as n
  from used where tag ~ '\d'
), bounds as (
  select branch_id, min(n) as lo, max(n) as hi from nums group by branch_id
)
select b.branch_id, g.n::text as missing_tag
from bounds b, lateral generate_series(b.lo, least(b.hi, b.lo + 5000)) g(n)
where not exists (
  select 1 from nums u where u.branch_id = b.branch_id and u.n = g.n
);

-- Orders taken in with no intake SMS on record.
create or replace view v_orders_without_sms as
select o.branch_id, o.id, o.received_at, o.total, o.cashier_id, o.tag
from orders o
where not exists (
  select 1 from messages m where m.order_id = o.id and m.stage = 'intake'
) order by o.received_at desc;

-- How long work sits at each stage — useful once pickup points exist.
create or replace view v_stage_durations as
select e.order_id, e.branch_id, e.to_status as status, e.at as entered,
       lead(e.at) over (partition by e.order_id order by e.at) - e.at as spent
from order_events e;

-- ════════════════════════════════════════════════════════════════════════
-- FINALLY: make yourself the owner.
-- Create the two accounts first in Authentication → Users → Add user:
--   your own email        → owner
--   till@vazisafi.co.ke   → shop  (the counter account)
-- Then run this. It reads the ids back from auth.users by email.
-- Replace the addresses with the real ones.
-- ════════════════════════════════════════════════════════════════════════

insert into members (user_id, role, branch_id, name)
select id, 'owner', 'main', 'Owner'
from auth.users where email = 'OWNER-EMAIL-HERE'
on conflict (user_id) do update set role = 'owner', branch_id = 'main';

insert into members (user_id, role, branch_id, name)
select id, 'shop', 'main', 'Front desk — Main'
from auth.users where email = 'TILL-EMAIL-HERE'
on conflict (user_id) do update set role = 'shop', branch_id = 'main';

-- Check it took:
--   select m.role, m.branch_id, u.email from members m join auth.users u on u.id = m.user_id;

-- ── View privileges and security ────────────────────────────────────────
-- A view normally runs with its creator's rights, which would let the till
-- account read every branch's takings through v_daily_takings regardless of
-- the policies underneath. security_invoker makes each view obey the row
-- level security of whoever is querying it.
do $$
declare v text;
begin
  foreach v in array array[
    'v_daily_takings','v_daily_pnl','v_work_in_progress','v_released_unpaid',
    'v_open_delivery_cards','v_shift_variances','v_tag_gaps',
    'v_orders_without_sms','v_stage_durations'
  ] loop
    execute format('alter view %I set (security_invoker = on)', v);
    execute format('grant select on %I to authenticated', v);
  end loop;
end $$;
