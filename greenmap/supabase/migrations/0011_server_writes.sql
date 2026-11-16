-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ GreenMap · 0011 · Farm data is written by the server                 ║
-- ║ Builds on 0010. Safe to re-run.                                      ║
-- ║ Tested by supabase/tests/security.test.ts (npm test).                ║
-- ║                                                                      ║
-- ║ ORDER: deploy the app code that ships with this file FIRST, then     ║
-- ║ run it. The new code works before and after. Old code can no longer  ║
-- ║ create a farm, add a plant or log care once this is in place.        ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Until now the browser wrote farms, zones, plants and care logs straight
-- into the database. Row Level Security kept each grower inside their own
-- farm, but nothing limited HOW MUCH or WHAT they wrote: no rate limit, no
-- upper bound on rows, and only the checks a database constraint can express.
--
-- The app now sends those four writes to its own server (/api/farms,
-- /api/plants, /api/plants/log, /api/plants/status), which checks the
-- input, the limits and the owner, then writes. This file closes the old
-- door, so that going around the app is no longer possible:
--
--   1. farms, zones, plants, growth_logs — the browser can READ its own
--      rows and nothing else.
--   2. The tables the browser still writes (360° photos and tags, refund
--      requests, feedback, chat messages) get a per-person limit on new
--      rows, enforced here because here is where those writes land.

-- ═════════════════════════════════════════════════════════════════════════
-- 1. FARM DATA — read-only for the browser
-- ═════════════════════════════════════════════════════════════════════════
-- "FOR ALL" policies are replaced by SELECT-only ones, and the write
-- permissions are taken away as well (two locks: either one is enough).
-- The guard triggers from 0010 stay in place as a third.

drop policy if exists "farms_all_own"    on public.farms;
drop policy if exists "farms_select_own" on public.farms;
create policy "farms_select_own" on public.farms
  for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.farms from anon, authenticated;

drop policy if exists "zones_all_own"    on public.zones;
drop policy if exists "zones_select_own" on public.zones;
create policy "zones_select_own" on public.zones
  for select to authenticated
  using (farm_id in (
    select id from public.farms where user_id = (select auth.uid())));
revoke insert, update, delete on public.zones from anon, authenticated;

drop policy if exists "plants_all_own"    on public.plants;
drop policy if exists "plants_select_own" on public.plants;
create policy "plants_select_own" on public.plants
  for select to authenticated
  using (farm_id in (
    select id from public.farms where user_id = (select auth.uid())));
revoke insert, update, delete on public.plants from anon, authenticated;

-- growth_logs: 0010 already left the browser with INSERT only.
drop policy if exists "growth_logs_insert_own" on public.growth_logs;
revoke insert, update, delete on public.growth_logs from anon, authenticated;

-- Billing tables and profiles: the browser never had a policy that lets it
-- insert or delete here (so Row Level Security already refused it). The
-- unused permissions are removed too, so that the list of tables the
-- browser may insert into is exactly the list in section 2.
revoke insert, update, delete on public.ai_scan_usage  from anon, authenticated;
revoke insert, update, delete on public.payments       from anon, authenticated;
revoke insert, update, delete on public.listing_boosts from anon, authenticated;
revoke insert, delete         on public.profiles       from anon, authenticated;

-- ═════════════════════════════════════════════════════════════════════════
-- 2. ROW LIMITS for the tables the browser still writes
-- ═════════════════════════════════════════════════════════════════════════
-- A signed-in person could insert rows in a loop until the database is
-- full. Each of these tables now allows a fixed number of NEW rows per
-- person in 10 minutes — far more than anyone taps, far less than a script
-- wants. The count uses the same counter table as the API routes (0010).

-- The limits live inside the function on purpose. It can be called
-- directly by a signed-in person, and arguments such as "max" or "window"
-- would let them reset their own counter.
create or replace function public.take_client_write_limit(p_table text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_max  integer;
  v_wait integer;
begin
  if v_user is null then
    return;
  end if;

  v_max := case p_table
    when 'panorama_plant_tags' then 600   -- tagging every plant in a tour
    when 'support_messages'    then 120
    when 'farm_panoramas'      then 60
    when 'refund_requests'     then 30
    when 'order_feedback'      then 30
    else 120
  end;

  v_wait := public.take_rate_limit('db:' || p_table || ':' || v_user::text, v_max, 600);
  if v_wait > 0 then
    -- SQLSTATE PT429: the API answers with HTTP 429 (Too Many Requests).
    raise exception 'Too many changes in a short time. Please wait % seconds and try again.', v_wait
      using errcode = 'PT429';
  end if;
end;
$$;
revoke all on function public.take_client_write_limit(text) from public, anon;
grant execute on function public.take_client_write_limit(text) to authenticated, service_role;

-- Counts only rows written by a browser session. The server (service role)
-- and the SQL editor are not limited.
create or replace function public.limit_client_writes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    perform public.take_client_write_limit(tg_table_name);
  end if;
  return new;
end;
$$;

drop trigger if exists limit_client_writes on public.farm_panoramas;
create trigger limit_client_writes
  before insert on public.farm_panoramas
  for each row execute function public.limit_client_writes();

drop trigger if exists limit_client_writes on public.panorama_plant_tags;
create trigger limit_client_writes
  before insert on public.panorama_plant_tags
  for each row execute function public.limit_client_writes();

drop trigger if exists limit_client_writes on public.refund_requests;
create trigger limit_client_writes
  before insert on public.refund_requests
  for each row execute function public.limit_client_writes();

drop trigger if exists limit_client_writes on public.order_feedback;
create trigger limit_client_writes
  before insert on public.order_feedback
  for each row execute function public.limit_client_writes();

drop trigger if exists limit_client_writes on public.support_messages;
create trigger limit_client_writes
  before insert on public.support_messages
  for each row execute function public.limit_client_writes();
