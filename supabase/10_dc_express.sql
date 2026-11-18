-- 10_dc_express.sql — run once in Supabase → SQL Editor. Safe to re-run.
-- Adds the "Dry Cleaning Express" service, so orders that use it are accepted by the cloud.
-- Its price is worked out in the app (Settings → Dry Cleaning Express, default 75% of the
-- order's dry cleaning items), so the tier prices here stay 0.
insert into services (id, name, category, unit, icon, tiers, subtypes, active)
values ('dc-express', 'Dry Cleaning Express', 'drycleaning', 'order', 'clock',
        '{"student":0,"normal":0,"corporate":0}'::jsonb, '[]'::jsonb, true)
on conflict (id) do update
  set name = excluded.name, category = excluded.category, unit = excluded.unit, icon = excluded.icon;

notify pgrst, 'reload schema';
