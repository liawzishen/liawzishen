-- ============================================================================
-- GreenMap — Test data for the Home "Today's Tasks" board
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe + re-runnable: wipes and recreates a single farm called "Test Plot".
-- It does NOT touch your other farms (Ladang Hijau, etc.).
--
-- Creates a rich task mix:
--   3  Ready to Harvest   (expected_harvest = today, cared-for -> healthy)
--   26 Needs Watering     (never watered, planted 6 days ago -> overdue)
--   8  Needs Fertilizing  (watered recently, never fertilized, planted 12d)
--   5  All good           (recently watered + fertilized -> no tasks)
-- ============================================================================

do $$
declare
  v_user uuid;
  v_farm uuid;
begin
  -- Pick the demo grower; fall back to the first profile if not present.
  select id into v_user from profiles where email = 'ahmad@greenmap.demo' limit 1;
  if v_user is null then
    select id into v_user from profiles order by created_at asc limit 1;
  end if;
  if v_user is null then
    raise exception 'No profile found - register/login once, then re-run.';
  end if;

  -- Clean any previous Test Plot for this user (children first).
  delete from growth_logs where plant_id in (
    select p.id from plants p join farms f on p.farm_id = f.id
    where f.user_id = v_user and f.name = 'Test Plot');
  delete from ai_analyses where plant_id in (
    select p.id from plants p join farms f on p.farm_id = f.id
    where f.user_id = v_user and f.name = 'Test Plot');
  delete from health_score_history where plant_id in (
    select p.id from plants p join farms f on p.farm_id = f.id
    where f.user_id = v_user and f.name = 'Test Plot');
  delete from plants where farm_id in (
    select id from farms where user_id = v_user and name = 'Test Plot');
  delete from farms where user_id = v_user and name = 'Test Plot';

  -- The test farm.
  insert into farms (user_id, name, location, size, crop_type,
                     background_type, canvas_width, canvas_height)
  values (v_user, 'Test Plot', 'Selangor', 'medium', 'Tomato',
          'smart', 1200, 800)
  returning id into v_farm;

  -- 3 READY TO HARVEST (expected harvest today; recently cared -> healthy)
  with hp as (
    insert into plants (farm_id, name, type, plant_date, expected_harvest_date,
                        position_x, position_y, health_score, manual_status, lifecycle_status)
    select v_farm, 'Chili ' || chr(64 + g), 'Chili',
           current_date - 80, current_date,
           0.2 + (g - 1) * 0.25, 0.12, 90, 'healthy', 'active'
    from generate_series(1, 3) g
    returning id
  )
  insert into growth_logs (plant_id, event_type, note, metadata, created_at)
  select id, 'water', 'Watered', '{}'::jsonb, now() - interval '2 hours' from hp
  union all
  select id, 'fertilize', 'Fertilized',
         '{"fertilizer_category":"organic"}'::jsonb, now() - interval '1 day' from hp;

  -- 26 NEEDS WATERING (never watered, planted 6 days ago)
  insert into plants (farm_id, name, type, plant_date,
                      position_x, position_y, health_score, manual_status, lifecycle_status)
  select v_farm, 'Tomato ' || g, 'Tomato', current_date - 6,
         0.08 + ((g - 1) % 8) * 0.11,
         0.40 + floor((g - 1) / 8.0) * 0.13,
         30, 'attention', 'active'
  from generate_series(1, 26) g;

  -- 8 NEEDS FERTILIZING (watered recently, never fertilized, planted 12 days ago)
  with fp as (
    insert into plants (farm_id, name, type, plant_date,
                        position_x, position_y, health_score, manual_status, lifecycle_status)
    select v_farm, 'Brinjal ' || g, 'Brinjal', current_date - 12,
           0.08 + ((g - 1) % 8) * 0.11, 0.92, 62, 'healthy', 'active'
    from generate_series(1, 8) g
    returning id
  )
  insert into growth_logs (plant_id, event_type, note, metadata, created_at)
  select id, 'water', 'Watered', '{}'::jsonb, now() - interval '3 hours' from fp;

  -- 5 ALL GOOD (no tasks; recently watered + fertilized)
  with gp as (
    insert into plants (farm_id, name, type, plant_date,
                        position_x, position_y, health_score, manual_status, lifecycle_status)
    select v_farm, 'Okra ' || g, 'Okra', current_date - 15,
           0.1 + (g - 1) * 0.2, 0.28, 92, 'healthy', 'active'
    from generate_series(1, 5) g
    returning id
  )
  insert into growth_logs (plant_id, event_type, note, metadata, created_at)
  select id, 'water', 'Watered', '{}'::jsonb, now() - interval '4 hours' from gp
  union all
  select id, 'fertilize', 'Fertilized',
         '{"fertilizer_category":"organic"}'::jsonb, now() - interval '2 days' from gp;

  raise notice 'Test Plot ready: 3 harvest, 26 watering, 8 fertilizing, 5 healthy (42 plants).';
end $$;
