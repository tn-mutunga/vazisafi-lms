-- 06_sms.sql — run once in Supabase → SQL Editor. Safe to re-run.
-- Real SMS through Africa's Talking. The send-sms edge function claims each
-- message here before sending, so a message can never go out twice, even if
-- two laptops both hold it in their queue.

alter table messages add column if not exists error       text default '';
alter table messages add column if not exists campaign_id text default '';

create table if not exists sms_claims (
  id          text primary key,
  to_phone    text,
  status      text not null default 'sending',
  gateway_id  text default '',
  cost        numeric(10,4),
  error       text default '',
  created_at  timestamptz not null default now()
);
create index if not exists sms_claims_gateway_idx on sms_claims (gateway_id);
-- No policies: only the edge functions (service role) can read or write it.
alter table sms_claims enable row level security;

notify pgrst, 'reload schema';
