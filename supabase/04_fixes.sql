-- ════════════════════════════════════════════════════════════════════════
-- Vazi Safi LMS — 04 fixes. Run once, after 01–03. Safe to re-run.
--
-- Three uniqueness rules were stricter than the shop's real behaviour, and a
-- single clash would stop the whole sync. They become ordinary indexes: the
-- lookups stay fast, and duplicates become something the Integrity screen
-- reports instead of something that blocks the till.
--
--   payments_txn_idx          one M-Pesa code can legitimately pay two orders
--   orders_queue_idx          a renumbered or restored day can repeat a client no.
--   delivery_cards_serial_idx a reprinted note keeps its order's serial
-- ════════════════════════════════════════════════════════════════════════

drop index if exists payments_txn_idx;
create index if not exists payments_txn_idx on payments (txn) where txn <> '';

drop index if exists orders_queue_idx;
create index if not exists orders_queue_idx on orders (branch_id, received_day, queue_no)
  where queue_no is not null;

drop index if exists delivery_cards_serial_idx;
create index if not exists delivery_cards_serial_idx on delivery_cards (branch_id, serial);

-- The finding the unique rule used to enforce, now as a report.
create or replace view v_duplicate_mpesa as
select branch_id, txn, count(*) as uses, sum(amount) as total,
       string_agg(coalesce(order_id,'—'), ', ' order by paid_at) as orders
from payments where txn <> ''
group by branch_id, txn having count(*) > 1;
alter view v_duplicate_mpesa set (security_invoker = on);
grant select on v_duplicate_mpesa to authenticated;
