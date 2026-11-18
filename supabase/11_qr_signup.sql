-- 11_qr_signup.sql — run once in Supabase → SQL Editor. Safe to re-run.
--
-- QR sign-up (e.g. the USIU pageant table). A customer scans the QR code, fills in name and
-- phone on the sign-up page, and the page calls public_signup(). That function:
--   · checks the campaign is switched on (Management → Settings → QR sign-up, synced as the
--     'campaigns' setting), so the % and days come from YOUR settings, never from the page;
--   · if the phone already belongs to a customer: records the scan, no discount;
--   · otherwise adds the customer (tagged with the campaign) with a one-time welcome %,
--     valid for the campaign's number of days. Laptops pull the new customer on their next sync.
-- The public (anon) role still cannot read any table: it can only call this one function.

alter table customers add column if not exists source      text;
alter table customers add column if not exists offer_pct   int;
alter table customers add column if not exists offer_until date;

-- Every scan that was submitted, including people who were already customers.
create table if not exists signup_scans (
  id          bigserial primary key,
  branch_id   text references branches(id),
  campaign    text not null,
  name        text,
  phone       text,
  result      text not null,          -- new | existing | again
  customer_id text,
  at          timestamptz not null default now()
);
create index if not exists signup_scans_campaign_idx on signup_scans (campaign, at);
alter table signup_scans enable row level security;
drop policy if exists sel on signup_scans;
create policy sel on signup_scans for select to authenticated
  using (is_owner() or branch_id is not distinct from my_branch());

create or replace function public.public_signup(
  p_branch text, p_campaign text, p_name text, p_prefix text, p_phone text,
  p_area text default '', p_segment text default 'normal'
) returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  camp     jsonb;
  pd       text := regexp_replace(coalesce(p_prefix, '+254'), '\D', '', 'g');
  d        text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  nm       text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 60);
  pretty   text;
  existing text;
  cid      text;
  pct      int;
  days     int;
  until    date;
  today    date := (now() at time zone 'Africa/Nairobi')::date;
  shop     text;
  sphone   text;
begin
  if pd = '' then pd := '254'; end if;
  select s.value #>> '{}' into shop   from settings s where s.branch_id = p_branch and s.key = 'shopName';
  select s.value #>> '{}' into sphone from settings s where s.branch_id = p_branch and s.key = 'ownerPhone';

  select x into camp
  from settings s, jsonb_array_elements(case when jsonb_typeof(s.value) = 'array' then s.value else '[]'::jsonb end) x
  where s.branch_id = p_branch and s.key = 'campaigns' and x->>'code' = p_campaign
  limit 1;
  if camp is null or coalesce((camp->>'on')::boolean, false) = false then
    return json_build_object('ok', false, 'error', 'This offer has ended.', 'shop', shop, 'phone', sphone);
  end if;
  if length(nm) < 2 then return json_build_object('ok', false, 'error', 'Please enter your name.'); end if;

  -- Same phone shape as the app: no country code, no leading 0, groups of 3.
  if d like pd || '%' and length(d) > 9 then d := substr(d, length(pd) + 1); end if;
  d := regexp_replace(d, '^0+', '');
  if pd = '254' then d := right(d, 9); end if;
  if length(d) < 7 or length(d) > 12 then return json_build_object('ok', false, 'error', 'Please check the phone number.'); end if;
  pretty := btrim(regexp_replace(d, '(\d{3})(?=\d)', '\1 ', 'g'));

  pct   := greatest(0, least(100, coalesce((camp->>'pct')::int, 15)));
  days  := greatest(1, coalesce((camp->>'days')::int, 14));

  -- Already one of ours? (same number, any spacing)
  select c.id into existing from customers c
  where c.branch_id is not distinct from p_branch
    and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 9) = right(d, 9)
  order by (c.source = p_campaign) desc nulls last
  limit 1;

  if existing is not null then
    select c.offer_until into until from customers c where c.id = existing and c.source = p_campaign;
    insert into signup_scans (branch_id, campaign, name, phone, result, customer_id)
      values (p_branch, p_campaign, nm, pretty, case when until is not null then 'again' else 'existing' end, existing);
    return json_build_object('ok', true, 'result', case when until is not null then 'again' else 'existing' end,
      'name', split_part(nm, ' ', 1), 'pct', pct, 'until', until, 'shop', shop, 'phone', sphone);
  end if;

  -- Light flood guard: at most 300 sign-ups per campaign per hour.
  if (select count(*) from signup_scans where campaign = p_campaign and at > now() - interval '1 hour') > 300 then
    return json_build_object('ok', false, 'error', 'Too many sign-ups right now. Please try again in a few minutes.');
  end if;

  until := today + days;
  cid   := 'w-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  insert into customers (id, branch_id, name, prefix, phone, segment, location, joined, source, offer_pct, offer_until)
    values (cid, p_branch, nm, '+' || pd, pretty,
            case when p_segment in ('student', 'normal') then p_segment else 'normal' end,
            left(btrim(coalesce(p_area, '')), 60), today, p_campaign, pct, until);
  insert into signup_scans (branch_id, campaign, name, phone, result, customer_id)
    values (p_branch, p_campaign, nm, pretty, 'new', cid);
  return json_build_object('ok', true, 'result', 'new', 'name', split_part(nm, ' ', 1),
    'pct', pct, 'until', until, 'shop', shop, 'phone', sphone);
end $$;

revoke all on function public.public_signup(text, text, text, text, text, text, text) from public;
grant usage on schema public to anon;
grant execute on function public.public_signup(text, text, text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- What the sign-up page shows before the customer types anything: the offer and the shop name.
create or replace function public.public_campaign(p_branch text, p_campaign text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'on',   coalesce((x->>'on')::boolean, false),
    'pct',  coalesce((x->>'pct')::int, 15),
    'days', coalesce((x->>'days')::int, 14),
    'name', x->>'name',
    'shop', (select s2.value #>> '{}' from settings s2 where s2.branch_id = p_branch and s2.key = 'shopName'))
  from settings s, jsonb_array_elements(case when jsonb_typeof(s.value) = 'array' then s.value else '[]'::jsonb end) x
  where s.branch_id = p_branch and s.key = 'campaigns' and x->>'code' = p_campaign
  limit 1
$$;
revoke all on function public.public_campaign(text, text) from public;
grant execute on function public.public_campaign(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
