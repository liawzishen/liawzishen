-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ GreenMap · 0010 · Security hardening                                 ║
-- ║ Closes the gaps found in the security review. Safe to re-run.        ║
-- ║ Tested by supabase/tests/security.test.ts (npm test).                ║
-- ║                                                                      ║
-- ║ ORDER: deploy the app code that ships with this file FIRST, then     ║
-- ║ run it. The new code works before and after. Old code can no longer  ║
-- ║ save the stock switch or the assistant's chat replies afterwards.    ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- The idea behind every section: the browser talks to the database
-- directly, so a rule that only lives in the app's code is not a rule.
-- Anything a signed-in person must not do has to be refused HERE.
--
--   1. Storage      — you can only replace or delete files you uploaded.
--   2. Trust data   — health scores, AI scans and passports are written by
--                     the server only. A grower cannot write their own.
--   3. Seller name  — a seller is known by farm name. A second account can
--                     no longer take over a name that is already in use.
--   4. Support      — a shopper cannot write messages "as the seller", and
--                     a seller can only decide a refund once.
--   5. Size limits  — text columns have a maximum length.
--   6. Scan credits — "check, then use" is one atomic step (no free scans
--                     from sending many requests at the same time).
--   7. Rate limits  — a counter table the API routes use.

-- ═════════════════════════════════════════════════════════════════════════
-- 1. STORAGE
-- ═════════════════════════════════════════════════════════════════════════
-- Before: any signed-in account could overwrite or delete ANY file in the
-- three shared buckets — another grower's scan photos, farm backgrounds and
-- profile photos included. Now only the uploader can (Supabase records the
-- uploader in `owner_id`). Files uploaded by the seed scripts have no owner,
-- so only the server can change those.

drop policy if exists "greenmap_auth_update" on storage.objects;
create policy "greenmap_auth_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('farm-backgrounds', 'plant-scans', 'growth-photos')
    and owner_id = (select auth.uid()::text))
  with check (
    bucket_id in ('farm-backgrounds', 'plant-scans', 'growth-photos')
    and owner_id = (select auth.uid()::text));

drop policy if exists "greenmap_auth_delete" on storage.objects;
create policy "greenmap_auth_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('farm-backgrounds', 'plant-scans', 'growth-photos')
    and owner_id = (select auth.uid()::text));

-- Images only, with a size limit — enforced by Storage itself, so it holds
-- even for someone who skips the app and calls the API by hand. Without it
-- the public buckets would host any file of any size for anyone signed in.
update storage.buckets
   set file_size_limit = 10485760,                                  -- 10 MB
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id in ('farm-backgrounds', 'plant-scans', 'growth-photos');

update storage.buckets
   set file_size_limit = 15728640,                                  -- 15 MB
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'farm-panoramas';

-- ═════════════════════════════════════════════════════════════════════════
-- 2. TRUST DATA — written by the server only
-- ═════════════════════════════════════════════════════════════════════════
-- A Harvest Passport tells a shopper "this was grown the way it says". That
-- is only true if the grower cannot write the numbers. Before, the owner had
-- full write access: a passport, an AI scan or a health score of 100 could be
-- inserted straight from the browser console.
--
-- Browser requests run as the database role `authenticated` (or `anon`).
-- The server's service-role key is not affected by any of this.

-- ── harvest_passports: owner reads; nobody lists; server writes ──────────
-- The old public policy let ANYONE with the public key list every passport
-- of every farm. The public QR page reads through the server by exact token
-- (lib/passport/queries.ts), so it does not need that policy.
drop policy if exists "passports_all_own"       on public.harvest_passports;
drop policy if exists "passports_public_select" on public.harvest_passports;
drop policy if exists "passports_select_own"    on public.harvest_passports;
create policy "passports_select_own" on public.harvest_passports
  for select to authenticated
  using (farm_id in (
    select id from public.farms where user_id = (select auth.uid())));
revoke insert, update, delete on public.harvest_passports from anon, authenticated;

-- ── ai_analyses + health_score_history: owner reads; server writes ───────
drop policy if exists "ai_analyses_all_own"    on public.ai_analyses;
drop policy if exists "ai_analyses_select_own" on public.ai_analyses;
create policy "ai_analyses_select_own" on public.ai_analyses
  for select to authenticated
  using (plant_id in (
    select p.id from public.plants p
    join public.farms f on f.id = p.farm_id
    where f.user_id = (select auth.uid())));
revoke insert, update, delete on public.ai_analyses from anon, authenticated;

drop policy if exists "health_history_all_own"    on public.health_score_history;
drop policy if exists "health_history_select_own" on public.health_score_history;
create policy "health_history_select_own" on public.health_score_history
  for select to authenticated
  using (plant_id in (
    select p.id from public.plants p
    join public.farms f on f.id = p.farm_id
    where f.user_id = (select auth.uid())));
revoke insert, update, delete on public.health_score_history from anon, authenticated;

-- One saved analysis per scanned photo. Makes a double tap on "Save" (or a
-- replayed request) harmless instead of counting the same scan twice.
-- Skipped with a notice if old duplicates exist — the API also checks.
do $$ begin
  create unique index if not exists ai_analyses_plant_image_key
    on public.ai_analyses (plant_id, image_url);
exception when unique_violation then
  raise notice 'ai_analyses has duplicate scans; unique index skipped (the API still checks).';
end $$;

-- ── plants: the browser cannot set the score or the harvested flag ───────
-- A trigger (not column permissions) so that old and new app code both keep
-- working: whatever the browser sends for these two columns is ignored.
create or replace function public.plants_guard_client_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.health_score     := null;      -- "New" until the server scores it
      new.lifecycle_status := 'active';
      new.created_at       := now();
    else
      new.health_score     := old.health_score;
      new.lifecycle_status := old.lifecycle_status;
      new.created_at       := old.created_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists plants_guard_client_write on public.plants;
create trigger plants_guard_client_write
  before insert or update on public.plants
  for each row execute function public.plants_guard_client_write();

-- ── growth_logs: the record can be added to, not rewritten ───────────────
-- The browser may add the four care events. 'ai_scan' and 'harvested' rows
-- are written by the server (they carry the AI result and the harvest).
-- Rows cannot be edited, deleted or back-dated from the browser: the Growing
-- Story on a passport is the record as it happened. ("Undo" of a watering
-- goes through /api/tasks/uncomplete.)
drop policy if exists "growth_logs_all_own"    on public.growth_logs;
drop policy if exists "growth_logs_select_own" on public.growth_logs;
create policy "growth_logs_select_own" on public.growth_logs
  for select to authenticated
  using (plant_id in (
    select p.id from public.plants p
    join public.farms f on f.id = p.farm_id
    where f.user_id = (select auth.uid())));

drop policy if exists "growth_logs_insert_own" on public.growth_logs;
create policy "growth_logs_insert_own" on public.growth_logs
  for insert to authenticated
  with check (
    event_type in ('planted', 'water', 'fertilize', 'note')
    and plant_id in (
      select p.id from public.plants p
      join public.farms f on f.id = p.farm_id
      where f.user_id = (select auth.uid())));
revoke update, delete on public.growth_logs from anon, authenticated;

create or replace function public.growth_logs_guard_client_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.created_at := now();             -- no back-dated history
  end if;
  return new;
end;
$$;

drop trigger if exists growth_logs_guard_client_write on public.growth_logs;
create trigger growth_logs_guard_client_write
  before insert on public.growth_logs
  for each row execute function public.growth_logs_guard_client_write();

-- ═════════════════════════════════════════════════════════════════════════
-- 3. SELLER NAME — who may act as the seller of a farm name
-- ═════════════════════════════════════════════════════════════════════════
-- Marketplace listings are still demo data, so a support row knows its
-- seller only by FARM NAME (0008). Farm names are free text and not unique.
-- Before: anyone who created a farm with the same name as a seller could
-- read that seller's customer messages, answer as the seller, and approve
-- refunds — including their own.
--
-- Now a name belongs to the farm that has held it the LONGEST. A later farm
-- with the same name gets nothing. `name_claimed_at` records when a farm
-- took its current name; the browser cannot set it or back-date it.
--
-- Limit that stays until listings are real database rows: a name nobody
-- uses yet can still be taken by the first account that asks for it.

alter table public.farms
  add column if not exists name_claimed_at timestamptz;
update public.farms set name_claimed_at = created_at where name_claimed_at is null;
alter table public.farms alter column name_claimed_at set default now();
alter table public.farms alter column name_claimed_at set not null;
comment on column public.farms.name_claimed_at is
  'When this farm took its current name. The oldest claim owns the seller name (see owns_seller_name).';

create index if not exists farms_name_idx on public.farms (name);

create or replace function public.farms_guard_client_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('authenticated', 'anon') then
      new.created_at      := now();
      new.name_claimed_at := now();
    end if;
  else
    if current_user in ('authenticated', 'anon') then
      new.created_at := old.created_at;
    end if;
    -- Renaming a farm starts a new claim, whoever does it.
    if new.name is distinct from old.name then
      new.name_claimed_at := now();
    elsif current_user in ('authenticated', 'anon') then
      new.name_claimed_at := old.name_claimed_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists farms_guard_client_write on public.farms;
create trigger farms_guard_client_write
  before insert or update on public.farms
  for each row execute function public.farms_guard_client_write();

-- True when the signed-in user owns the farm with the oldest claim on this
-- name. SECURITY DEFINER because it must see other people's farms to know
-- who was first; it only ever answers yes or no.
create or replace function public.owns_seller_name(seller text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.farms mine
    where mine.user_id = auth.uid()
      and mine.name = seller
      and not exists (
        select 1
        from public.farms other
        where other.name = seller
          and other.user_id <> mine.user_id
          and (other.name_claimed_at, other.id) < (mine.name_claimed_at, mine.id)
      )
  );
$$;
revoke all on function public.owns_seller_name(text) from public, anon;
grant execute on function public.owns_seller_name(text) to authenticated, service_role;

-- ═════════════════════════════════════════════════════════════════════════
-- 4. SUPPORT — refunds, messages, feedback, stock
-- ═════════════════════════════════════════════════════════════════════════

-- ── refund_requests ──────────────────────────────────────────────────────
drop policy if exists "refunds_select_seller" on public.refund_requests;
create policy "refunds_select_seller" on public.refund_requests
  for select to authenticated
  using (public.owns_seller_name(farm));

-- A seller decides a request ONCE (only while it is pending), never their
-- own request, and can change nothing but the status.
drop policy if exists "refunds_update_seller" on public.refund_requests;
create policy "refunds_update_seller" on public.refund_requests
  for update to authenticated
  using (
    status = 'pending'
    and user_id <> (select auth.uid())
    and public.owns_seller_name(farm))
  with check (
    status in ('approved', 'rejected')
    and user_id <> (select auth.uid())
    and public.owns_seller_name(farm));
revoke update on public.refund_requests from anon, authenticated;
grant update (status) on public.refund_requests to authenticated;

-- ── support_messages ─────────────────────────────────────────────────────
-- A shopper writes only as 'customer'. Before, they could insert rows with
-- sender 'seller' or 'ai' into their own thread — a made-up "the seller
-- agreed to refund me". The AI and auto replies are now written by the
-- server (/api/support/chat).
drop policy if exists "support_msg_insert_own" on public.support_messages;
create policy "support_msg_insert_own" on public.support_messages
  for insert to authenticated
  with check ((select auth.uid()) = user_id and sender = 'customer');

drop policy if exists "support_msg_select_seller" on public.support_messages;
create policy "support_msg_select_seller" on public.support_messages
  for select to authenticated
  using (thread = 'seller' and public.owns_seller_name(seller_name));

drop policy if exists "support_msg_insert_seller" on public.support_messages;
create policy "support_msg_insert_seller" on public.support_messages
  for insert to authenticated
  with check (
    thread = 'seller'
    and sender = 'seller'
    and public.owns_seller_name(seller_name));

-- ── order_feedback ───────────────────────────────────────────────────────
drop policy if exists "feedback_select_seller" on public.order_feedback;
create policy "feedback_select_seller" on public.order_feedback
  for select to authenticated
  using (public.owns_seller_name(farm));

-- ── listing_stock: everyone reads, the server writes ─────────────────────
-- Before: the first account to write a row for a listing owned that row, so
-- any grower could switch a competitor's listing to "out of stock". Which
-- farm a listing belongs to is only known to the app (demo listings), so
-- the check and the write now happen in /api/listings/stock.
drop policy if exists "stock_write_seller" on public.listing_stock;
revoke insert, update, delete on public.listing_stock from anon, authenticated;

-- ═════════════════════════════════════════════════════════════════════════
-- 5. SIZE LIMITS on text the browser can write
-- ═════════════════════════════════════════════════════════════════════════
-- Without a limit, one request could store megabytes in a "name". The limits
-- are far above anything the app's forms produce. NOT VALID = old rows are
-- left alone; every new or changed row is checked.

do $$ begin
  alter table public.profiles add constraint profiles_text_limits
    check (char_length(name) <= 120) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.farms add constraint farms_text_limits
    check (
      char_length(name) between 1 and 120
      and char_length(location) <= 120
      and char_length(crop_type) <= 120
      and (background_url is null or char_length(background_url) <= 1000)
      and (latitude  is null or latitude  between -90  and 90)
      and (longitude is null or longitude between -180 and 180)
    ) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.zones add constraint zones_text_limits
    check (char_length(name) <= 120 and char_length(color) <= 32) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.plants add constraint plants_text_limits
    check (char_length(name) <= 120 and char_length(type) <= 120) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.growth_logs add constraint growth_logs_text_limits
    check (
      (note is null or char_length(note) <= 4000)
      and (photo_url is null or char_length(photo_url) <= 1000)
      and octet_length(metadata::text) <= 8000
    ) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.farm_panoramas add constraint farm_panoramas_text_limits
    check (
      char_length(image_url) <= 1000
      and (label is null or char_length(label) <= 120)
    ) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.refund_requests add constraint refund_requests_text_limits
    check (
      char_length(order_ref) <= 64
      and char_length(item) <= 200
      and char_length(farm) <= 200
      and char_length(reason) <= 2000
    ) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.order_feedback add constraint order_feedback_text_limits
    check (
      char_length(order_ref) <= 64
      and (listing_id is null or char_length(listing_id) <= 64)
      and char_length(farm) <= 200
      and char_length(comment) <= 2000
    ) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.support_messages add constraint support_messages_text_limits
    check (
      (order_ref is null or char_length(order_ref) <= 64)
      and (seller_name is null or char_length(seller_name) <= 200)
      and char_length(body) between 1 and 4000
      and (intent is null or char_length(intent) <= 40)
    ) not valid;
exception when duplicate_object then null; end $$;

-- ═════════════════════════════════════════════════════════════════════════
-- 6. SCAN CREDITS — one atomic step
-- ═════════════════════════════════════════════════════════════════════════
-- Before, the API read the balance, ran the scan, then wrote the usage. Ten
-- requests sent at the same moment all saw "1 credit left" and all ran.
-- Now a credit is RESERVED first (the row lock makes it one at a time) and
-- given back if the scan fails. Server only: the browser cannot call these.

create or replace function public.consume_scan_credit(
  p_user uuid,
  p_monthly_limit integer          -- null = unlimited plan
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_bonus      integer;
  v_used       integer;
  v_usage_id   uuid;
  v_from_bonus boolean := false;
begin
  select bonus_scans into v_bonus
    from public.profiles where id = p_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  -- Same month window as lib/billing/usage.ts (UTC calendar month).
  select count(*) into v_used
    from public.ai_scan_usage
   where user_id = p_user
     and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';

  if p_monthly_limit is not null and v_used >= p_monthly_limit then
    if v_bonus <= 0 then
      return jsonb_build_object('ok', false, 'reason', 'out_of_credits');
    end if;
    update public.profiles set bonus_scans = bonus_scans - 1 where id = p_user;
    v_bonus := v_bonus - 1;
    v_from_bonus := true;
  end if;

  insert into public.ai_scan_usage (user_id) values (p_user)
    returning id into v_usage_id;

  return jsonb_build_object(
    'ok', true,
    'usage_id', v_usage_id,
    'from_bonus', v_from_bonus,
    'remaining', case
      when p_monthly_limit is null then null
      else greatest(0, p_monthly_limit - (v_used + 1)) + v_bonus
    end
  );
end;
$$;

-- Give a reserved credit back (the scan failed, so it costs nothing).
create or replace function public.release_scan_credit(
  p_user uuid,
  p_usage_id uuid,
  p_from_bonus boolean
)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.ai_scan_usage where id = p_usage_id and user_id = p_user;
  if found and p_from_bonus then
    update public.profiles set bonus_scans = bonus_scans + 1 where id = p_user;
  end if;
end;
$$;

-- Add purchased scans in one statement. Before, "read, add, write" could
-- lose a top-up when two payments finished at the same time.
create or replace function public.add_bonus_scans(p_user uuid, p_qty integer)
returns integer
language sql
set search_path = public
as $$
  update public.profiles
     set bonus_scans = bonus_scans + p_qty
   where id = p_user
  returning bonus_scans;
$$;

revoke all on function public.consume_scan_credit(uuid, integer)       from public, anon, authenticated;
revoke all on function public.release_scan_credit(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.add_bonus_scans(uuid, integer)           from public, anon, authenticated;
grant execute on function public.consume_scan_credit(uuid, integer)       to service_role;
grant execute on function public.release_scan_credit(uuid, uuid, boolean) to service_role;
grant execute on function public.add_bonus_scans(uuid, integer)           to service_role;

-- ═════════════════════════════════════════════════════════════════════════
-- 7. RATE LIMITS — a shared counter for the API routes
-- ═════════════════════════════════════════════════════════════════════════
-- The AI, map and payment routes cost money per call. A counter in the app's
-- memory resets on every new server instance, so the count lives here.
-- One row per (person, kind of request); rows are reused, never pile up.

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);
alter table public.rate_limits enable row level security;   -- no policies:
revoke all on public.rate_limits from anon, authenticated;   -- server only

-- Count one request. Returns 0 when it is allowed, otherwise the number of
-- seconds to wait until the window ends.
create or replace function public.take_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns integer
language sql
set search_path = public
as $$
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case
      when r.window_start <= now() - make_interval(secs => p_window_seconds)
        then now() else r.window_start end,
    count = case
      when r.window_start <= now() - make_interval(secs => p_window_seconds)
        then 1 else r.count + 1 end
  returning case
    when r.count <= p_max then 0
    else greatest(1, ceil(extract(epoch from
      r.window_start + make_interval(secs => p_window_seconds) - now()))::integer)
  end;
$$;

revoke all on function public.take_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.take_rate_limit(text, integer, integer) to service_role;
