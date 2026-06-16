-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ GreenMap · 0002 · Auto-create profile on signup                      ║
-- ║ Mirrors {name, role} from auth metadata into public.profiles.       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Runs as the definer so it can insert into public.profiles regardless of RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, ''),
    -- default to 'grower' if metadata is missing or not a known role
    case
      when new.raw_user_meta_data ->> 'role' in ('grower', 'consumer')
        then new.raw_user_meta_data ->> 'role'
      else 'grower'
    end
  )
  on conflict (id) do nothing;  -- never error if the row already exists
  return new;
end;
$$;

-- Recreate the trigger cleanly (drop-if-exists keeps this re-runnable).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill: create profiles for any users who registered before this trigger
-- existed (e.g. the Phase 1 test accounts).
insert into public.profiles (id, name, email, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'name', ''),
  coalesce(u.email, ''),
  case
    when u.raw_user_meta_data ->> 'role' in ('grower', 'consumer')
      then u.raw_user_meta_data ->> 'role'
    else 'grower'
  end
from auth.users u
on conflict (id) do nothing;
