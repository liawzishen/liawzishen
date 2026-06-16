-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ GreenMap · 0004 · Storage buckets (3, public-read)                   ║
-- ║ Public so images render on the public Harvest Passport page.        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Create buckets (id = name). public = true → files are readable by URL.
insert into storage.buckets (id, name, public)
values
  ('farm-backgrounds', 'farm-backgrounds', true),
  ('plant-scans',      'plant-scans',      true),
  ('growth-photos',    'growth-photos',    true)
on conflict (id) do nothing;

-- Public read for all three buckets.
drop policy if exists "greenmap_public_read" on storage.objects;
create policy "greenmap_public_read" on storage.objects
  for select
  using (bucket_id in ('farm-backgrounds', 'plant-scans', 'growth-photos'));

-- Authenticated users may upload to the three buckets.
drop policy if exists "greenmap_auth_insert" on storage.objects;
create policy "greenmap_auth_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('farm-backgrounds', 'plant-scans', 'growth-photos'));

-- Authenticated users may update/replace their uploads.
drop policy if exists "greenmap_auth_update" on storage.objects;
create policy "greenmap_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('farm-backgrounds', 'plant-scans', 'growth-photos'));

-- Authenticated users may delete from the three buckets.
drop policy if exists "greenmap_auth_delete" on storage.objects;
create policy "greenmap_auth_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('farm-backgrounds', 'plant-scans', 'growth-photos'));
