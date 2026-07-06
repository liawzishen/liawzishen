-- ── 0006: precise farm coordinates ──────────────────────────────────────────
-- Location-accurate weather (2026-07-06 map-page spec): the setup wizard can
-- pin the farm's GPS position so Open-Meteo forecasts use the exact spot
-- instead of geocoding the state name. Nullable on purpose — existing farms
-- keep working (weather falls back to geocoding `location`).
-- Run in Supabase → SQL Editor, like the previous migrations.

alter table public.farms
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;

comment on column public.farms.latitude  is 'Optional GPS pin from farm setup — used for exact weather forecasts.';
comment on column public.farms.longitude is 'Optional GPS pin from farm setup — used for exact weather forecasts.';
