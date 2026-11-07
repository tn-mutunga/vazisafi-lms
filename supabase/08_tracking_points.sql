-- 08_tracking_points.sql — run once in Supabase → SQL Editor. Safe to re-run.
--
-- 1. Order tracking link. Every new order gets a secret 10-character code. The public
--    tracking page sends that code to track_order() and gets back ONE order's progress:
--    first name, stage, times, due, balance and how to pay. Nothing else is reachable:
--    the unsigned-in (anon) role still has no access to any table, only to this function.
-- 2. Loyalty points. The points a customer used on an order are saved on that order, so
--    every laptop works out the same balance.
--
-- The app keeps both on the laptop until this has been run, then sends them by itself.

alter table orders add column if not exists track_code      text;
alter table orders add column if not exists points_redeemed int not null default 0;
create unique index if not exists orders_track_code_idx on orders (track_code) where track_code is not null;

create or replace function public.track_order(code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'order',    regexp_replace(regexp_replace(o.id, '-[A-Z]{2}(-RW[0-9]*)$', '\1'), '-[A-Z]{2}$', ''),
    'name',     split_part(coalesce(c.name, ''), ' ', 1),
    'status',   o.status,
    'received', o.received_at,
    'due',      o.due_at,
    'items',    (select coalesce(sum(i.qty), 0) from order_items i where i.order_id = o.id and not i.free),
    'total',    o.total,
    'paid',     o.paid,
    'balance',  greatest(o.total - o.paid, 0),
    'updated',  o.updated_at,
    'stages',   (select json_object_agg(x.stage, x.at) from (
                   select a.meta->>'stage' as stage, min(a.at) as at from audit_log a
                   where a.target = o.id and a.action = 'order.stage' and a.meta ? 'stage'
                   group by 1) x),
    'shop',     (select s.value #>> '{}' from settings s where s.branch_id = o.branch_id and s.key = 'shopName'),
    'payTo',    (select s.value #>> '{}' from settings s where s.branch_id = o.branch_id and s.key = 'payTo'),
    'payName',  (select s.value #>> '{}' from settings s where s.branch_id = o.branch_id and s.key = 'payToName'),
    'phone',    (select s.value #>> '{}' from settings s where s.branch_id = o.branch_id and s.key = 'ownerPhone')
  )
  from orders o
  left join customers c on c.id = o.customer_id
  where length(coalesce(code, '')) >= 10 and o.track_code = code
  limit 1
$$;

revoke all on function public.track_order(text) from public;
grant usage on schema public to anon;
grant execute on function public.track_order(text) to anon, authenticated;

notify pgrst, 'reload schema';
