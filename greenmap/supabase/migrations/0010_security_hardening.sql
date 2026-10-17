-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ GreenMap · 0010 · Security hardening                                  ║
-- ║ Trust data is server-written, passports can't be listed, storage      ║
-- ║ writes are owner-scoped, and sellers can't be impersonated.          ║
-- ║ Safe to re-run: drop-policy/create, idempotent grants, guarded DDL.  ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Before this file, 0003 gave growers FOR ALL on every trust table, so a
-- grower's own session plus the public anon key could write health scores,
-- AI analyses, score history and passport badges straight over PostgREST,
-- skipping the server routes that calculate them. Every legitimate write of
-- calculated data already goes through the service role (it bypasses RLS and
-- these grants), so clients only lose the ability to forge.

-- Owner chains used below (same as 0003):
--   own farm  = farm_id in (select id from public.farms where user_id = auth.uid())
--   own plant = plant_id in (plants of own farms)

-- ── farms: only growers create farms; names can't be cloned ─────────────
-- Seller access in 0008 is keyed on the farm NAME, so a cloned name used to
-- give a stranger that seller's refunds, chats and stock. profiles.role is
-- safe to trust here: 0005 stops clients from updating it.
drop policy if exists "farms_all_own" on public.farms;
drop policy if exists "farms_select_own" on public.farms;
create policy "farms_select_own" on public.farms
  for select using (auth.uid() = user_id);
drop policy if exists "farms_insert_grower" on public.farms;
create policy "farms_insert_grower" on public.farms
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'grower'));
drop policy if exists "farms_update_own" on public.farms;
create policy "farms_update_own" on public.farms
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "farms_delete_own" on public.farms;
create policy "farms_delete_own" on public.farms
  for delete using (auth.uid() = user_id);

-- One farm name per owner (case and spaces ignored). Existing duplicates are
-- left alone; new farms and renames can't take another owner's name. Runs as
-- definer because RLS hides other owners' farms from the caller.
create or replace function public.farms_name_not_taken()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.name is not distinct from old.name then
    return new;
  end if;
  if exists (
    select 1 from public.farms f
    where lower(btrim(f.name)) = lower(btrim(new.name))
      and f.user_id <> new.user_id
  ) then
    raise exception 'A farm called "%" already exists. Please choose another name.', btrim(new.name)
      using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke all on function public.farms_name_not_taken() from public, anon, authenticated;

drop trigger if exists farms_name_not_taken on public.farms;
create trigger farms_name_not_taken
  before insert or update of name on public.farms
  for each row execute function public.farms_name_not_taken();

-- ── plants: growers place plants and set manual status; the rest is ─────
--    calculated (health_score) or server-controlled (lifecycle_status,
--    plant_date → passport grow_days).
revoke insert, update on public.plants from anon, authenticated;
revoke delete on public.plants from anon;
grant insert (farm_id, zone_id, name, type, expected_harvest_date,
              position_x, position_y, manual_status)
  on public.plants to authenticated;
grant update (name, type, zone_id, expected_harvest_date,
              position_x, position_y, manual_status)
  on public.plants to authenticated;

drop policy if exists "plants_all_own" on public.plants;
drop policy if exists "plants_select_own" on public.plants;
create policy "plants_select_own" on public.plants
  for select using (
    farm_id in (select id from public.farms where user_id = auth.uid()));
drop policy if exists "plants_insert_own" on public.plants;
create policy "plants_insert_own" on public.plants
  for insert with check (
    farm_id in (select id from public.farms where user_id = auth.uid())
    and (zone_id is null or zone_id in (
      select z.id from public.zones z where z.farm_id = plants.farm_id)));
-- A harvested plant is part of a published passport: frozen.
drop policy if exists "plants_update_own" on public.plants;
create policy "plants_update_own" on public.plants
  for update
  using (
    farm_id in (select id from public.farms where user_id = auth.uid())
    and lifecycle_status = 'active')
  with check (
    farm_id in (select id from public.farms where user_id = auth.uid())
    and (zone_id is null or zone_id in (
      select z.id from public.zones z where z.farm_id = plants.farm_id)));
drop policy if exists "plants_delete_own" on public.plants;
create policy "plants_delete_own" on public.plants
  for delete using (
    farm_id in (select id from public.farms where user_id = auth.uid()));

-- ── growth_logs: growers add care logs; history can't be rewritten ──────
-- created_at is always now() (no back/forward-dating), ai_scan and harvested
-- rows come only from the server, and a harvested plant's story is frozen.
revoke insert, update, delete on public.growth_logs from anon, authenticated;
grant insert (plant_id, event_type, note, photo_url, metadata)
  on public.growth_logs to authenticated;

drop policy if exists "growth_logs_all_own" on public.growth_logs;
drop policy if exists "growth_logs_select_own" on public.growth_logs;
create policy "growth_logs_select_own" on public.growth_logs
  for select using (plant_id in (
    select p.id from public.plants p
    join public.farms f on f.id = p.farm_id
    where f.user_id = auth.uid()));
drop policy if exists "growth_logs_insert_own" on public.growth_logs;
create policy "growth_logs_insert_own" on public.growth_logs
  for insert with check (
    event_type in ('planted', 'water', 'fertilize', 'note')
    and plant_id in (
      select p.id from public.plants p
      join public.farms f on f.id = p.farm_id
      where f.user_id = auth.uid() and p.lifecycle_status = 'active'));

-- ── ai_analyses, health_score_history, harvest_passports: read-only ─────
-- Written only by /api/ai/save-scan, lib/health/recalculate.ts and
-- /api/passports/generate (service role).
revoke insert, update, delete on public.ai_analyses from anon, authenticated;
revoke insert, update, delete on public.health_score_history from anon, authenticated;
revoke insert, update, delete on public.harvest_passports from anon, authenticated;

drop policy if exists "ai_analyses_all_own" on public.ai_analyses;
drop policy if exists "ai_analyses_select_own" on public.ai_analyses;
create policy "ai_analyses_select_own" on public.ai_analyses
  for select using (plant_id in (
    select p.id from public.plants p
    join public.farms f on f.id = p.farm_id
    where f.user_id = auth.uid()));

drop policy if exists "health_history_all_own" on public.health_score_history;
drop policy if exists "health_history_select_own" on public.health_score_history;
create policy "health_history_select_own" on public.health_score_history
  for select using (plant_id in (
    select p.id from public.plants p
    join public.farms f on f.id = p.farm_id
    where f.user_id = auth.uid()));

drop policy if exists "passports_all_own" on public.harvest_passports;
drop policy if exists "passports_select_own" on public.harvest_passports;
create policy "passports_select_own" on public.harvest_passports
  for select using (
    farm_id in (select id from public.farms where user_id = auth.uid()));
-- No public SELECT: `using (true)` let anyone with the anon key list every
-- passport. The public QR page reads one exact qr_token with the service
-- role, so it never needed this policy.
drop policy if exists "passports_public_select" on public.harvest_passports;

-- ── panorama tags: the tagged plant must be on the panorama's farm ──────
drop policy if exists "pano_tags_all_own" on public.panorama_plant_tags;
create policy "pano_tags_all_own" on public.panorama_plant_tags
  for all
  using (panorama_id in (
    select pa.id from public.farm_panoramas pa
    join public.farms f on f.id = pa.farm_id
    where f.user_id = auth.uid()))
  with check (
    panorama_id in (
      select pa.id from public.farm_panoramas pa
      join public.farms f on f.id = pa.farm_id
      where f.user_id = auth.uid())
    and plant_id in (
      select p.id from public.plants p
      join public.farm_panoramas pa on pa.farm_id = p.farm_id
      where pa.id = panorama_plant_tags.panorama_id));

-- ── billing: defence in depth (0005 relies on "no write policy" alone) ──
revoke insert, update, delete on public.ai_scan_usage from anon, authenticated;
revoke insert, update, delete on public.payments from anon, authenticated;
revoke insert, update, delete on public.listing_boosts from anon, authenticated;

-- ── refunds: a decision belongs to a different user, once ──────────────
-- Before: the seller policy only matched a farm name and allowed any column,
-- so a buyer who owned a farm with that name could approve their own refund,
-- and a decided refund could be flipped or rewritten forever.
revoke update on public.refund_requests from anon, authenticated;
grant update (status) on public.refund_requests to authenticated;

drop policy if exists "refunds_update_seller" on public.refund_requests;
create policy "refunds_update_seller" on public.refund_requests
  for update
  using (
    status = 'pending'
    and user_id <> auth.uid()
    and exists (
      select 1 from public.farms f
      where f.user_id = auth.uid() and f.name = refund_requests.farm))
  with check (
    status in ('approved', 'rejected')
    and user_id <> auth.uid()
    and exists (
      select 1 from public.farms f
      where f.user_id = auth.uid() and f.name = refund_requests.farm));

-- A buyer may withdraw a request, but not erase a decided one.
drop policy if exists "refunds_delete_own" on public.refund_requests;
create policy "refunds_delete_own" on public.refund_requests
  for delete using (auth.uid() = user_id and status = 'pending');

-- ── support chat: everyone speaks only as themselves ─────────────────────
-- Customers write customer rows; the seller auto-reply and the AI answer are
-- written by /api/support/chat with the service role.
drop policy if exists "support_msg_insert_own" on public.support_messages;
create policy "support_msg_insert_own" on public.support_messages
  for insert with check (auth.uid() = user_id and sender = 'customer');

-- A seller replies only in a seller thread the customer opened with them.
-- A policy on support_messages can't query support_messages itself
-- (Postgres reports infinite recursion), so the thread check runs as definer.
-- It lives in a schema PostgREST doesn't expose (no /rpc) and only answers
-- for a farm name the caller owns.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.customer_opened_seller_thread(
  customer uuid, seller text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.farms f
           where f.user_id = auth.uid() and f.name = seller)
     and exists (
           select 1 from public.support_messages m
           where m.user_id = customer
             and m.thread = 'seller'
             and m.sender = 'customer'
             and m.seller_name = seller);
$$;
revoke all on function private.customer_opened_seller_thread(uuid, text) from public, anon;
grant execute on function private.customer_opened_seller_thread(uuid, text) to authenticated;

drop policy if exists "support_msg_insert_seller" on public.support_messages;
create policy "support_msg_insert_seller" on public.support_messages
  for insert with check (
    sender = 'seller'
    and thread = 'seller'
    and user_id <> auth.uid()
    and exists (
      select 1 from public.farms f
      where f.user_id = auth.uid() and f.name = support_messages.seller_name)
    and private.customer_opened_seller_thread(user_id, seller_name));

revoke update, delete on public.support_messages from anon, authenticated;
revoke update, delete on public.order_feedback from anon, authenticated;

-- ── storage: owner-scoped writes, no public listing, images only ─────────
-- Public buckets serve /object/public/ URLs without any SELECT policy, so
-- photos keep rendering everywhere. SELECT is granted to the owner only,
-- because Storage needs it for remove() and upsert.
-- Path conventions (see the upload call sites):
--   farm-backgrounds  <user_id>/<file>     (setup wizard, satellite, avatars)
--   plant-scans       <plant_id>/<file>    (ScanUploader)
--   farm-panoramas    <farm_id>/<file>     (usePanoramas; write policies in 0009)
--   growth-photos     no writer yet → no client writes
drop policy if exists "greenmap_public_read" on storage.objects;
drop policy if exists "greenmap_auth_insert" on storage.objects;
drop policy if exists "greenmap_auth_update" on storage.objects;
drop policy if exists "greenmap_auth_delete" on storage.objects;

drop policy if exists "backgrounds_select_own" on storage.objects;
create policy "backgrounds_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'farm-backgrounds'
         and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "backgrounds_insert_own" on storage.objects;
create policy "backgrounds_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'farm-backgrounds'
              and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "backgrounds_update_own" on storage.objects;
create policy "backgrounds_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'farm-backgrounds'
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'farm-backgrounds'
              and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "backgrounds_delete_own" on storage.objects;
create policy "backgrounds_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'farm-backgrounds'
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "scans_select_own" on storage.objects;
create policy "scans_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'plant-scans'
         and (storage.foldername(name))[1] in (
           select p.id::text from public.plants p
           join public.farms f on f.id = p.farm_id
           where f.user_id = auth.uid()));
drop policy if exists "scans_insert_own" on storage.objects;
create policy "scans_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'plant-scans'
              and (storage.foldername(name))[1] in (
                select p.id::text from public.plants p
                join public.farms f on f.id = p.farm_id
                where f.user_id = auth.uid()));
drop policy if exists "scans_update_own" on storage.objects;
create policy "scans_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'plant-scans'
         and (storage.foldername(name))[1] in (
           select p.id::text from public.plants p
           join public.farms f on f.id = p.farm_id
           where f.user_id = auth.uid()))
  with check (bucket_id = 'plant-scans'
              and (storage.foldername(name))[1] in (
                select p.id::text from public.plants p
                join public.farms f on f.id = p.farm_id
                where f.user_id = auth.uid()));
drop policy if exists "scans_delete_own" on storage.objects;
create policy "scans_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'plant-scans'
         and (storage.foldername(name))[1] in (
           select p.id::text from public.plants p
           join public.farms f on f.id = p.farm_id
           where f.user_id = auth.uid()));

-- farm-panoramas keeps 0009's owner-scoped insert/update/delete; it only
-- needs the owner SELECT that remove() relies on.
drop policy if exists "panoramas_storage_select_own" on storage.objects;
create policy "panoramas_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'farm-panoramas'
         and (storage.foldername(name))[1] in (
           select id::text from public.farms where user_id = auth.uid()));

-- Images only, with the same size caps the app already enforces client-side
-- (no HTML/SVG or huge files on public URLs).
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'],
       file_size_limit = 10485760          -- 10 MB
 where id in ('farm-backgrounds', 'plant-scans', 'growth-photos');
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'],
       file_size_limit = 12582912          -- 12 MB (AddPanoramaSheet MAX_BYTES)
 where id = 'farm-panoramas';
