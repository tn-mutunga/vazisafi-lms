-- STEP 2 · REPAIR. Safe to re-run. Touches only orders whose "paid" is below the money recorded for them.
begin;

-- B · Payments that were recorded at the till (audit log says "mpesa 1134 (QK12A)") but whose
--     payment line never reached the cloud: rebuild the line. Skips orders where Management
--     deleted payments on purpose, and codes that already have a line on that order.
insert into payments (id, branch_id, order_id, customer, method, amount, txn, verified, paid_at)
select 'p-rebuilt-' || a.id, o.branch_id, o.id, coalesce(c.name, ''),
       m[1], m[2]::bigint, coalesce(m[3], ''), false, a.at
from audit_log a
join orders o on o.id = a.target
left join customers c on c.id = o.customer_id
cross join lateral regexp_match(a.detail, '^(\w+) (\d+)(?: \(([^)]*)\))?$') as m
where a.action = 'payment.record'
  and m is not null
  and not exists (select 1 from payments p where p.id = 'p-rebuilt-' || a.id)
  and not exists (select 1 from payments p where p.order_id = o.id and p.amount = m[2]::bigint
                    and coalesce(p.txn, '') = coalesce(m[3], ''))
  and not exists (select 1 from audit_log d where d.action = 'payment.delete' and d.target like '%' || o.id || '%')
  and (select coalesce(sum(p.amount), 0) from payments p where p.order_id = o.id) < o.total;

-- A · Lift each order's "paid" back up to its payment lines (never above the total).
update orders o
set paid = least(o.total, l.ledger)
from (select order_id, sum(amount) as ledger from payments group by order_id) l
where l.order_id = o.id and l.ledger > o.paid and o.rewash_of is null;

commit;

-- What is left: collected orders still showing a balance, with no trace of payment.
select regexp_replace(o.id, '-[A-Z]{2}$', '') as "order", c.name as customer, o.total, o.paid,
       o.total - o.paid as "still showing due"
from orders o left join customers c on c.id = o.customer_id
where o.status = 'collected' and o.paid < o.total and o.rewash_of is null
order by o.received_at;
