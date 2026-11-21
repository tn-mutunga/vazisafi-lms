-- 13_usiu_dec10.sql — USIU Pageant offer: 21 days, valid until 10 Dec 2026. Safe to re-run.
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

  -- USIU pageant: everyone's offer runs to 10 Dec 2026, whatever day they signed up.
  until := case when p_campaign = 'usiu-pageant' then date '2026-12-10' else today + days end;
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

update customers set offer_until = date '2026-12-10' where source = 'usiu-pageant';

notify pgrst, 'reload schema';
