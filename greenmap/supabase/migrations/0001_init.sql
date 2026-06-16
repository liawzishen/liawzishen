-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ GreenMap · 0001 · Core schema (8 tables)                              ║
-- ║ Source of truth: docs/03_BACKEND_TRUTH.md                            ║
-- ║ Safe to re-run: uses IF NOT EXISTS / idempotent guards.             ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- gen_random_uuid() lives in pgcrypto (preinstalled on Supabase, guard anyway)
create extension if not exists pgcrypto;

-- ── profiles ────────────────────────────────────────────────────────────
-- One row per auth user. Auto-created by the trigger in 0002.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  email       text not null default '',
  role        text not null default 'grower'
                check (role in ('grower', 'consumer')),
  is_verified boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── farms ───────────────────────────────────────────────────────────────
create table if not exists public.farms (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  name            text not null,
  location        text not null,                 -- Malaysian state
  size            text not null default 'small'
                    check (size in ('small', 'medium', 'large')),
  crop_type       text not null,
  background_type text not null default 'smart'
                    check (background_type in ('smart', 'upload', 'satellite')),
  background_url  text,                           -- null for 'smart'
  canvas_width    integer not null default 1200,
  canvas_height   integer not null default 800,
  created_at      timestamptz not null default now()
);
create index if not exists farms_user_id_idx on public.farms (user_id);

-- ── zones ─────────────────────────────────────────────────────────────────
-- Label + colour only. No coordinates, no polygons (rendered as chips).
create table if not exists public.zones (
  id         uuid primary key default gen_random_uuid(),
  farm_id    uuid not null references public.farms (id) on delete cascade,
  name       text not null,
  color      text not null default '#34C759',
  created_at timestamptz not null default now()
);
create index if not exists zones_farm_id_idx on public.zones (farm_id);

-- ── plants ──────────────────────────────────────────────────────────────
create table if not exists public.plants (
  id                    uuid primary key default gen_random_uuid(),
  farm_id               uuid not null references public.farms (id) on delete cascade,
  zone_id               uuid references public.zones (id) on delete set null,
  name                  text not null,
  type                  text not null,
  plant_date            date not null default current_date,
  expected_harvest_date date,                     -- optional; drives "Harvest Ready"
  position_x            double precision not null default 0.5,  -- 0.0–1.0 of canvas
  position_y            double precision not null default 0.5,  -- 0.0–1.0 of canvas
  -- [D4] nullable: NULL = grey "New" marker until first scoring event.
  health_score          integer
                          check (health_score is null
                                 or (health_score between 0 and 100)),
  -- [D5] status split into two independent concerns:
  manual_status         text not null default 'attention'
                          check (manual_status in ('healthy', 'attention', 'critical')),
  lifecycle_status      text not null default 'active'
                          check (lifecycle_status in ('active', 'harvested')),
  created_at            timestamptz not null default now()
);
create index if not exists plants_farm_id_idx on public.plants (farm_id);
create index if not exists plants_zone_id_idx on public.plants (zone_id);

-- ── growth_logs ───────────────────────────────────────────────────────────
-- The activity timeline. event_type is locked to exactly six values.
create table if not exists public.growth_logs (
  id         uuid primary key default gen_random_uuid(),
  plant_id   uuid not null references public.plants (id) on delete cascade,
  event_type text not null
               check (event_type in
                 ('planted', 'water', 'fertilize', 'ai_scan', 'note', 'harvested')),
  note       text,
  photo_url  text,
  metadata   jsonb not null default '{}'::jsonb,  -- badge data lives here
  created_at timestamptz not null default now()
);
create index if not exists growth_logs_plant_id_created_idx
  on public.growth_logs (plant_id, created_at desc);

-- ── ai_analyses ───────────────────────────────────────────────────────────
create table if not exists public.ai_analyses (
  id              uuid primary key default gen_random_uuid(),
  plant_id        uuid not null references public.plants (id) on delete cascade,
  image_url       text not null,
  diagnosis       text not null,
  confidence      integer not null default 0
                    check (confidence between 0 and 100),
  severity        text not null default 'none'
                    check (severity in ('none', 'mild', 'moderate', 'severe')),
  ai_sub_score    integer not null default 50
                    check (ai_sub_score between 0 and 100),
  recommendations jsonb not null default '[]'::jsonb,  -- 2–4 strings
  created_at      timestamptz not null default now()
);
create index if not exists ai_analyses_plant_id_created_idx
  on public.ai_analyses (plant_id, created_at desc);

-- ── health_score_history ────────────────────────────────────────────────
-- One row per health_score update; powers the 7-day trend chart.
create table if not exists public.health_score_history (
  id         uuid primary key default gen_random_uuid(),
  plant_id   uuid not null references public.plants (id) on delete cascade,
  score      integer not null check (score between 0 and 100),
  created_at timestamptz not null default now()
);
create index if not exists health_history_plant_id_created_idx
  on public.health_score_history (plant_id, created_at);

-- ── harvest_passports ───────────────────────────────────────────────────
-- Frozen snapshot at harvest. qr_token is the public lookup key.
create table if not exists public.harvest_passports (
  id                 uuid primary key default gen_random_uuid(),
  plant_id           uuid not null references public.plants (id) on delete cascade,
  farm_id            uuid not null references public.farms (id) on delete cascade,
  harvest_date       date not null default current_date,
  grow_days          integer not null default 0,
  avg_health         integer not null default 0,
  fertilizer_summary jsonb not null default '{"types":[],"count":0}'::jsonb,
  pesticide_free     boolean not null default false,
  organic            boolean not null default false,
  ai_verified        boolean not null default false,
  ai_scan_count      integer not null default 0,
  qr_token           uuid not null default gen_random_uuid(),
  created_at         timestamptz not null default now()
);
-- one passport per plant + unguessable public token
create unique index if not exists harvest_passports_plant_id_key
  on public.harvest_passports (plant_id);
create unique index if not exists harvest_passports_qr_token_key
  on public.harvest_passports (qr_token);
