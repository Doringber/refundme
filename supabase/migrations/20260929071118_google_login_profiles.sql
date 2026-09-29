-- Store Google (and other OAuth) profile fields on public.profiles.
-- Auth users still live in auth.users; this keeps app-facing data under RLS.

alter table public.profiles
  add column if not exists email text,
  add column if not exists avatar_url text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  resolved_name text;
  resolved_avatar text;
begin
  resolved_name := coalesce(
    nullif(meta->>'display_name', ''),
    nullif(meta->>'full_name', ''),
    nullif(meta->>'name', ''),
    split_part(new.email, '@', 1)
  );

  resolved_avatar := coalesce(
    nullif(meta->>'avatar_url', ''),
    nullif(meta->>'picture', '')
  );

  insert into public.profiles (id, display_name, email, avatar_url)
  values (new.id, resolved_name, new.email, resolved_avatar);
  return new;
end;
$$;

-- Keep email / avatar in sync when Google (or email confirm) updates auth.users.
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  resolved_name text;
  resolved_avatar text;
begin
  resolved_name := coalesce(
    nullif(meta->>'display_name', ''),
    nullif(meta->>'full_name', ''),
    nullif(meta->>'name', ''),
    split_part(new.email, '@', 1)
  );

  resolved_avatar := coalesce(
    nullif(meta->>'avatar_url', ''),
    nullif(meta->>'picture', '')
  );

  update public.profiles
  set
    email = coalesce(new.email, email),
    avatar_url = coalesce(resolved_avatar, avatar_url),
    display_name = case
      when display_name is null or display_name = '' then resolved_name
      else display_name
    end,
    updated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_updated();

-- Mirror revoke_security_definer_execute: triggers only, not callable via Data API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_updated() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres, service_role;
grant execute on function public.handle_user_updated() to postgres, service_role;
