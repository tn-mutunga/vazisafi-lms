-- 09_finalhold.sql — run once in Supabase → SQL Editor. Safe to re-run.
-- The app's "Final Hold" stage was never added to the cloud's list of stages, so any
-- order moved to Final Hold was refused, and because orders upload together, the other
-- orders sent with it were held back too.
insert into order_statuses (code,label,sort,phase,pickup_only,terminal) values
  ('finalhold', 'Final Hold', 42, 'production', false, false)
on conflict (code) do update
  set label = excluded.label, sort = excluded.sort, phase = excluded.phase,
      pickup_only = excluded.pickup_only, terminal = excluded.terminal;

notify pgrst, 'reload schema';
