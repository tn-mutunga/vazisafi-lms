-- STEP 1 · CHECK ONLY (changes nothing). Collected orders that show money still owing,
-- with what the cloud knows about their payments.
with led as (
  select order_id, sum(amount) as ledger, count(*) as n, string_agg(method || ' ' || amount || coalesce(' ' || nullif(txn, ''), ''), ', ' order by paid_at) as lines
  from payments group by order_id
), aud as (
  select target as order_id, string_agg(detail, ', ' order by at) as logged
  from audit_log where action = 'payment.record' group by target
), rel as (
  select order_id, min(balance_at_release) as bal_at_release from releases group by order_id
)
select regexp_replace(o.id, '-[A-Z]{2}$', '') as "order", c.name as customer, o.total, o.paid,
       coalesce(l.ledger, 0) as "payment lines total", l.lines as "payment lines",
       a.logged as "payments in audit log", r.bal_at_release as "balance when released",
       case
         when exists (select 1 from audit_log d where d.action = 'payment.delete' and d.target like '%' || o.id || '%') then 'D · payment deleted by Management: check by hand'
         when coalesce(l.ledger, 0) >= o.total then 'A · payment lines cover it: fix automatically'
         when a.logged is not null then 'B · only in audit log: rebuild payment line'
         else 'C · no trace of payment: check by hand'
       end as verdict
from orders o
left join customers c on c.id = o.customer_id
left join led l on l.order_id = o.id
left join aud a on a.order_id = o.id
left join rel r on r.order_id = o.id
where o.status = 'collected' and o.paid < o.total and o.rewash_of is null
order by verdict, o.received_at;
