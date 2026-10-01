-- 05_two_way_sync.sql — run once in Supabase → SQL Editor. Safe to re-run.
-- Gives every synced table an updated_at stamp set by the database, so each
-- laptop can ask "what changed since I last looked?" and download only that.

do $$
declare t text;
begin
  foreach t in array array['services','expense_categories','staff','customers','orders','payments',
    'expenses','shifts','dispatch','delivery_cards','releases','messages','inventory','issues',
    'approvals','audit_log','settings','sms_templates','void_tags']
  loop
    execute format('alter table %I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('create index if not exists %I on %I (updated_at)', t || '_updated_idx', t);
    if t <> 'audit_log' then
      execute format('drop trigger if exists %I on %I', t || '_touch', t);
      execute format('create trigger %I before update on %I for each row execute function touch_updated_at()', t || '_touch', t);
    end if;
  end loop;
end $$;

-- ── Deletions ──────────────────────────────────────────────────────────
-- A deleted row leaves a note here, so other laptops can remove it too.
create table if not exists deleted_rows (
  id          bigserial primary key,
  table_name  text not null,
  row_id      text not null,
  branch_id   text,
  updated_at  timestamptz not null default now()
);
create index if not exists deleted_rows_updated_idx on deleted_rows (updated_at);
alter table deleted_rows enable row level security;
drop policy if exists deleted_rows_read on deleted_rows;
create policy deleted_rows_read on deleted_rows for select to authenticated
  using (my_role() in ('owner','shop'));

create or replace function note_deleted() returns trigger
language plpgsql security definer set search_path = public as $
declare j jsonb := to_jsonb(old);
begin
  insert into deleted_rows (table_name, row_id, branch_id)
  values (tg_table_name, coalesce(j->>'id', j->>'key', j->>'tag'), j->>'branch_id');
  return old;
end $;

do $
declare t text;
begin
  foreach t in array array['services','expense_categories','staff','customers','orders','payments',
    'expenses','shifts','dispatch','delivery_cards','releases','messages','inventory','issues',
    'approvals','settings','sms_templates','void_tags']
  loop
    execute format('drop trigger if exists %I on %I', t || '_deleted', t);
    execute format('create trigger %I after delete on %I for each row execute function note_deleted()', t || '_deleted', t);
  end loop;
end $;

-- Deleting a customer, staff member or service must not be blocked by old orders
-- that point at it. Those links become empty; the order keeps its own copy of the name.
do $
declare r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confdeltype = 'a' and c.connamespace = 'public'::regnamespace
      and c.confrelid::regclass::text in ('customers','staff','services','expense_categories','orders','dispatch')
      and not a.attnotnull and array_length(c.conkey, 1) = 1
  loop
    execute format('alter table %s drop constraint %I, add constraint %I %s on delete set null',
      r.tbl, r.conname, r.conname, r.def);
  end loop;
end $;

notify pgrst, 'reload schema';
