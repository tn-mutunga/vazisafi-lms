-- ════════════════════════════════════════════════════════════════════════
-- Vazi Safi LMS — row level security
-- Run this SECOND, after 01_schema.sql.
--
-- Two logins, matching how the shop actually works:
--
--   owner  — you. Sees every branch, can change and delete anything.
--   shop   — the till account the counter uses. Sees and writes only its own
--            branch, and cannot delete a single row anywhere. Deletions go
--            through the approvals queue, so a bad day leaves a trail instead
--            of a hole.
--
-- Neither role can touch audit_log once a line is written.
-- ════════════════════════════════════════════════════════════════════════

-- ── Table privileges ────────────────────────────────────────────────────
-- Row level security decides WHICH rows a caller sees. Grants decide whether
-- the caller may ask at all. Supabase normally grants these automatically, but
-- the project setting that does it can be turned off — so we state them, and
-- the schema then works whichever way that switch is set.
--
-- Note what is NOT granted: `anon`, the unsigned-in role, gets nothing. Every
-- request has to be a signed-in member before RLS is even consulted.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

-- ── Who am I ────────────────────────────────────────────────────────────
create or replace function my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from members where user_id = auth.uid()), 'none')
$$;

create or replace function my_branch() returns text
language sql stable security definer set search_path = public as $$
  select (select branch_id from members where user_id = auth.uid())
$$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select my_role() = 'owner'
$$;

-- A branch the caller is allowed to write to.
create or replace function may_write(b text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_owner() or (my_role() = 'shop' and b is not distinct from my_branch())
$$;

-- ── Turn RLS on everywhere ──────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'branches','members','staff','services','customers','order_statuses','orders',
    'order_items','order_events','transfers','transfer_orders','payments',
    'expense_categories','expenses','shifts','void_tags','releases','dispatch',
    'delivery_cards','inventory','packages','discounts','issues','messages',
    'approvals','audit_log','settings','sms_templates','backups'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ── Helper: standard branch-scoped policy set ───────────────────────────
-- select: owner sees all, shop sees its branch
-- insert/update: only into a branch you may write to
-- delete: owner only
do $$
declare t text;
begin
  foreach t in array array[
    'staff','customers','orders','payments','expenses','shifts','releases',
    'dispatch','delivery_cards','inventory','issues','messages','approvals',
    'settings','sms_templates','void_tags','backups','packages'
  ] loop
    execute format('drop policy if exists sel on %I', t);
    execute format('drop policy if exists ins on %I', t);
    execute format('drop policy if exists upd on %I', t);
    execute format('drop policy if exists del on %I', t);

    execute format($f$create policy sel on %I for select to authenticated
      using (is_owner() or branch_id is not distinct from my_branch())$f$, t);
    execute format($f$create policy ins on %I for insert to authenticated
      with check (may_write(branch_id))$f$, t);
    execute format($f$create policy upd on %I for update to authenticated
      using (may_write(branch_id)) with check (may_write(branch_id))$f$, t);
    execute format($f$create policy del on %I for delete to authenticated
      using (is_owner())$f$, t);
  end loop;
end $$;

-- ── Reference data: everyone reads, owner writes ────────────────────────
do $$
declare t text;
begin
  foreach t in array array['branches','services','order_statuses','expense_categories','discounts'] loop
    execute format('drop policy if exists sel on %I', t);
    execute format('drop policy if exists wr on %I', t);
    execute format('create policy sel on %I for select to authenticated using (true)', t);
    execute format($f$create policy wr on %I for all to authenticated
      using (is_owner()) with check (is_owner())$f$, t);
  end loop;
end $$;

-- ── Children of orders: inherit the parent's branch ─────────────────────
drop policy if exists sel on order_items;
drop policy if exists wr  on order_items;
create policy sel on order_items for select to authenticated
  using (exists (select 1 from orders o where o.id = order_id
                 and (is_owner() or o.branch_id is not distinct from my_branch())));
create policy wr on order_items for all to authenticated
  using (exists (select 1 from orders o where o.id = order_id and may_write(o.branch_id)))
  with check (exists (select 1 from orders o where o.id = order_id and may_write(o.branch_id)));

drop policy if exists sel on order_events;
drop policy if exists ins on order_events;
create policy sel on order_events for select to authenticated
  using (is_owner() or branch_id is not distinct from my_branch());
create policy ins on order_events for insert to authenticated
  with check (may_write(branch_id));
-- deliberately no update/delete: the handoff history is evidence

-- ── Transfers: visible to both ends ─────────────────────────────────────
drop policy if exists sel on transfers;
drop policy if exists ins on transfers;
drop policy if exists upd on transfers;
create policy sel on transfers for select to authenticated
  using (is_owner() or from_branch = my_branch() or to_branch = my_branch());
create policy ins on transfers for insert to authenticated
  with check (may_write(from_branch));
create policy upd on transfers for update to authenticated
  using (is_owner() or from_branch = my_branch() or to_branch = my_branch())
  with check (is_owner() or from_branch = my_branch() or to_branch = my_branch());

drop policy if exists wr on transfer_orders;
create policy wr on transfer_orders for all to authenticated
  using (exists (select 1 from transfers t where t.id = transfer_id
                 and (is_owner() or t.from_branch = my_branch() or t.to_branch = my_branch())))
  with check (exists (select 1 from transfers t where t.id = transfer_id
                 and (is_owner() or t.from_branch = my_branch() or t.to_branch = my_branch())));

-- ── Audit log: write once, read, never change ───────────────────────────
drop policy if exists sel on audit_log;
drop policy if exists ins on audit_log;
create policy sel on audit_log for select to authenticated
  using (is_owner() or branch_id is not distinct from my_branch());
create policy ins on audit_log for insert to authenticated
  with check (may_write(branch_id));
-- no update policy, no delete policy — RLS denies both by default

-- ── Members: you see yourself, the owner sees everyone ──────────────────
drop policy if exists sel on members;
drop policy if exists wr  on members;
create policy sel on members for select to authenticated
  using (user_id = auth.uid() or is_owner());
create policy wr on members for all to authenticated
  using (is_owner()) with check (is_owner());
