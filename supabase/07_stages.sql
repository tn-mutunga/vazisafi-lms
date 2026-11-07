-- v2.3.5: add the stages the app uses that the cloud did not know about.
-- Without these, an order moved to Holding or Dry cleaning is refused by the cloud
-- and the next sync puts it back to the previous stage.
insert into order_statuses (code,label,sort,phase,pickup_only,terminal) values
  ('holding',     'Holding (waiting for dryer)', 35, 'production', false, false),
  ('drycleaning', 'Dry cleaning',                45, 'production', false, false)
on conflict (code) do update
  set label = excluded.label, sort = excluded.sort, phase = excluded.phase,
      pickup_only = excluded.pickup_only, terminal = excluded.terminal;
