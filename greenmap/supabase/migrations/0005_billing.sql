-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ GreenMap · 0005 · Billing: plan tiers, scan usage, payments, boosts   ║
-- ║ Spec: docs/superpowers/specs/2026-07-03-payments-and-boosts-design.md║
-- ║ Safe to re-run: IF NOT EXISTS + guarded constraints + drop-policy.   ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── profiles: plan + top-up credits (server-managed) ─────────────────────
alter table public.profiles
  add column if not exists plan text not null default 'percuma';
alter table public.profiles
  add column if not exists bonus_scans integer not null default 0;
alter table public.profiles
  add column if not exists plan_renews_at timestamptz;

do $$ begin
  alter table public.profiles
    add constraint profiles_plan_check
    check (plan in ('percuma', 'asas', 'pro', 'unlimited'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_bonus_scans_check check (bonus_scans >= 0);
exception when duplicate_object then null; end $$;

-- Billing columns must not be self-servable through PostgREST: the only
-- client-side profiles write in the app is ProfileClient updating `name`.
revoke update on public.profiles from authenticated, anon;
grant update (name) on public.profiles to authenticated;

-- ── ai_scan_usage: one row per consumed AI scan ──────────────────────────
-- Usage this month = count of rows since the 1st (no counters, no cron).
create table if not exists public.ai_scan_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ai_scan_usage_user_created_idx
  on public.ai_scan_usage (user_id, created_at desc);

-- ── payments: every simulated transaction ────────────────────────────────
create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('plan', 'topup', 'boost')),
  amount_rm  numeric(8,2) not null check (amount_rm >= 0),
  method     text not null check (method in ('fpx', 'tng')),
  status     text not null default 'simulated',
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payments_user_created_idx
  on public.payments (user_id, created_at desc);

-- ── listing_boosts: promoted marketplace listings (ads) ──────────────────
-- listing_id is the mock marketplace id (components/sales/demo-listings.ts)
-- until the real marketplace tables land in Phase 3.
create table if not exists public.listing_boosts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  listing_id text not null,
  package    text not null check (package in ('3d', '7d', '14d')),
  price_rm   numeric(8,2) not null,
  starts_at  timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists listing_boosts_listing_expires_idx
  on public.listing_boosts (listing_id, expires_at desc);

-- ── RLS: clients read; only the server (service role) writes ─────────────
alter table public.ai_scan_usage  enable row level security;
alter table public.payments       enable row level security;
alter table public.listing_boosts enable row level security;

drop policy if exists "scan_usage_select_own" on public.ai_scan_usage;
create policy "scan_usage_select_own" on public.ai_scan_usage
  for select using (auth.uid() = user_id);

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id);

-- Every signed-in shopper sees which listings are Promoted.
drop policy if exists "boosts_select_authenticated" on public.listing_boosts;
create policy "boosts_select_authenticated" on public.listing_boosts
  for select to authenticated using (true);

-- No insert/update/delete policies on any billing table: RLS denies by
-- default, so browsers cannot buy plans or boosts for free. All writes go
-- through /api/payments and /api/ai/scan using the service-role client.
