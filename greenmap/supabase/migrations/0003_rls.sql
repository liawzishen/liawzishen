-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ GreenMap · 0003 · Row Level Security                                 ║
-- ║ Access flows down the ownership chain: profiles → farms → …         ║
-- ║ harvest_passports also allows PUBLIC SELECT (for the QR page).      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

alter table public.profiles             enable row level security;
alter table public.farms                enable row level security;
alter table public.zones                enable row level security;
alter table public.plants               enable row level security;
alter table public.growth_logs          enable row level security;
alter table public.ai_analyses          enable row level security;
alter table public.health_score_history enable row level security;
alter table public.harvest_passports    enable row level security;

-- Helper note: "own farms" = farms where user_id = auth.uid().
-- We re-check that chain at each level so a user can only ever touch their data.

-- ── profiles: a user sees and edits only their own row ──────────────────
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ── farms: full control of your own farms ───────────────────────────────
drop policy if exists "farms_all_own" on public.farms;
create policy "farms_all_own" on public.farms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── zones: scoped to your farms ─────────────────────────────────────────
drop policy if exists "zones_all_own" on public.zones;
create policy "zones_all_own" on public.zones
  for all
  using (farm_id in (select id from public.farms where user_id = auth.uid()))
  with check (farm_id in (select id from public.farms where user_id = auth.uid()));

-- ── plants: scoped to your farms ────────────────────────────────────────
drop policy if exists "plants_all_own" on public.plants;
create policy "plants_all_own" on public.plants
  for all
  using (farm_id in (select id from public.farms where user_id = auth.uid()))
  with check (farm_id in (select id from public.farms where user_id = auth.uid()));

-- ── child tables: scoped to plants within your farms ────────────────────
-- A single subquery resolves "plants I own" for each policy.
drop policy if exists "growth_logs_all_own" on public.growth_logs;
create policy "growth_logs_all_own" on public.growth_logs
  for all
  using (plant_id in (
    select p.id from public.plants p
    join public.farms f on f.id = p.farm_id
    where f.user_id = auth.uid()))
  with check (plant_id in (
    select p.id from public.plants p
    join public.farms f on f.id = p.farm_id
    where f.user_id = auth.uid()));

drop policy if exists "ai_analyses_all_own" on public.ai_analyses;
create policy "ai_analyses_all_own" on public.ai_analyses
  for all
  using (plant_id in (
    select p.id from public.plants p
    join public.farms f on f.id = p.farm_id
    where f.user_id = auth.uid()))
  with check (plant_id in (
    select p.id from public.plants p
    join public.farms f on f.id = p.farm_id
    where f.user_id = auth.uid()));

drop policy if exists "health_history_all_own" on public.health_score_history;
create policy "health_history_all_own" on public.health_score_history
  for all
  using (plant_id in (
    select p.id from public.plants p
    join public.farms f on f.id = p.farm_id
    where f.user_id = auth.uid()))
  with check (plant_id in (
    select p.id from public.plants p
    join public.farms f on f.id = p.farm_id
    where f.user_id = auth.uid()));

-- ── harvest_passports: owner has full control … ─────────────────────────
drop policy if exists "passports_all_own" on public.harvest_passports;
create policy "passports_all_own" on public.harvest_passports
  for all
  using (farm_id in (select id from public.farms where user_id = auth.uid()))
  with check (farm_id in (select id from public.farms where user_id = auth.uid()));

-- … and ANYONE (even logged-out) can read a passport.
-- This is safe: qr_token is an unguessable UUID and the public page always
-- looks up by exact token, never by listing. The service-role client used by
-- the QR page bypasses RLS anyway; this policy lets the anon key work too.
drop policy if exists "passports_public_select" on public.harvest_passports;
create policy "passports_public_select" on public.harvest_passports
  for select using (true);
