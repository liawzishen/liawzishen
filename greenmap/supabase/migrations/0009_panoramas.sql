-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ GreenMap · 0009 · 360° farm panoramas (photo-sphere tour)            ║
-- ║ Safe to re-run: IF NOT EXISTS + drop-policy/create.                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

create table if not exists public.farm_panoramas (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references public.farms(id) on delete cascade,
  image_url   text not null,
  position_x  double precision not null,  -- 0–1 fraction of farms.canvas_width (where you stood)
  position_y  double precision not null,  -- 0–1 fraction of farms.canvas_height
  heading_deg double precision not null default 0,  -- compass direction the photo centre faces
  label       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.panorama_plant_tags (
  id           uuid primary key default gen_random_uuid(),
  panorama_id  uuid not null references public.farm_panoramas(id) on delete cascade,
  plant_id     uuid not null references public.plants(id) on delete cascade,
  yaw          double precision not null,  -- radians, photo-space (see tour/geometry.ts)
  pitch        double precision not null,  -- radians
  created_at   timestamptz not null default now(),
  unique (panorama_id, plant_id)
);

alter table public.farm_panoramas enable row level security;
alter table public.panorama_plant_tags enable row level security;

-- ── farm_panoramas: scoped to your farms (same pattern as plants) ────────
drop policy if exists "panoramas_all_own" on public.farm_panoramas;
create policy "panoramas_all_own" on public.farm_panoramas
  for all
  using (farm_id in (select id from public.farms where user_id = auth.uid()))
  with check (farm_id in (select id from public.farms where user_id = auth.uid()));

-- ── tags: scoped through the panorama's farm ─────────────────────────────
drop policy if exists "pano_tags_all_own" on public.panorama_plant_tags;
create policy "pano_tags_all_own" on public.panorama_plant_tags
  for all
  using (panorama_id in (
    select pa.id from public.farm_panoramas pa
    join public.farms f on f.id = pa.farm_id
    where f.user_id = auth.uid()))
  with check (panorama_id in (
    select pa.id from public.farm_panoramas pa
    join public.farms f on f.id = pa.farm_id
    where f.user_id = auth.uid()));

-- ── storage: add the farm-panoramas bucket ───────────────────────────────
insert into storage.buckets (id, name, public)
values ('farm-panoramas', 'farm-panoramas', true)
on conflict (id) do nothing;

-- Recreate the shared storage policies with the new bucket included
-- (0004 created them with a 3-bucket list; the lists below are the full set).
drop policy if exists "greenmap_public_read" on storage.objects;
create policy "greenmap_public_read" on storage.objects
  for select
  using (bucket_id in ('farm-backgrounds', 'plant-scans', 'growth-photos', 'farm-panoramas'));

drop policy if exists "greenmap_auth_insert" on storage.objects;
create policy "greenmap_auth_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('farm-backgrounds', 'plant-scans', 'growth-photos', 'farm-panoramas'));

drop policy if exists "greenmap_auth_update" on storage.objects;
create policy "greenmap_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('farm-backgrounds', 'plant-scans', 'growth-photos', 'farm-panoramas'));

drop policy if exists "greenmap_auth_delete" on storage.objects;
create policy "greenmap_auth_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('farm-backgrounds', 'plant-scans', 'growth-photos', 'farm-panoramas'));
