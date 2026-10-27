-- Household wallet, Web Push subscriptions, and expiry-reminder dedupe.
-- Apply this yourself in the Supabase SQL editor. Do not run it from CI.
-- New profiles default to reminders 30, 7 and 1 days before expiry.
-- Existing profiles.reminder_days values are left unchanged.

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to postgres, service_role, authenticated;

comment on schema private is
  'Security-definer helpers for RLS. Not part of the Data API.';

alter table public.profiles
  add column if not exists email_reminders boolean not null default true;

alter table public.profiles
  alter column reminder_days set default '{30,7,1}';

comment on column public.profiles.email_reminders is
  'When true, the daily reminder job may email this profile if they have no push subscription.';

comment on column public.profiles.reminder_days is
  'Days before a confirmed expiry. New rows default to {30,7,1}. Existing arrays stay as stored.';

alter table public.vouchers
  add column if not exists shared boolean not null default false;

comment on column public.vouchers.shared is
  'Household members can read a shared voucher and record a redemption. Only the owner can edit or delete it.';

create index if not exists vouchers_shared_owner_idx
  on public.vouchers (user_id)
  where shared = true;

create index if not exists vouchers_expiry_reminder_idx
  on public.vouchers (expiry_date)
  where expiry_confidence = 'confirmed'
    and remaining_amount_agorot > 0
    and status in ('active', 'partially_redeemed');

-- ---------------------------------------------------------------------------
-- Household: one membership per user. Owner invites; members can read shared rows.
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'הבית',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint households_name_len check (char_length(name) between 1 and 40)
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create unique index household_members_one_user_idx
  on public.household_members (user_id);

create index household_members_household_idx
  on public.household_members (household_id);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text,
  token_hash text not null unique,
  invited_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint household_invites_hash_hex check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint household_invites_email_len check (email is null or char_length(email) <= 200)
);

create index household_invites_pending_idx
  on public.household_invites (household_id)
  where accepted_at is null;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

-- ---------------------------------------------------------------------------
-- RLS helpers. security definer so policies can read membership without recursion.
-- ---------------------------------------------------------------------------

create or replace function private.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id
  from public.household_members m
  where m.user_id = (select auth.uid())
  limit 1
$$;

create or replace function private.shares_household_with(owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members me
    join public.household_members them
      on them.household_id = me.household_id
    where me.user_id = (select auth.uid())
      and them.user_id = owner_id
  )
$$;

create or replace function private.is_household_owner(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = hid
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
$$;

revoke all on function private.my_household_id() from public, anon;
revoke all on function private.shares_household_with(uuid) from public, anon;
revoke all on function private.is_household_owner(uuid) from public, anon;
grant execute on function private.my_household_id() to authenticated, service_role;
grant execute on function private.shares_household_with(uuid) to authenticated, service_role;
grant execute on function private.is_household_owner(uuid) to authenticated, service_role;

create policy "households_select_member"
  on public.households for select
  to authenticated
  using (
    id = private.my_household_id()
    or created_by = (select auth.uid())
  );

create policy "households_insert_self"
  on public.households for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and private.my_household_id() is null
  );

create policy "households_update_owner"
  on public.households for update
  to authenticated
  using (private.is_household_owner(id))
  with check (
    private.is_household_owner(id)
    and created_by = (select auth.uid())
  );

create policy "household_members_select"
  on public.household_members for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or household_id = private.my_household_id()
  );

-- Direct join of someone else's household is not allowed. The accept path is service-role only.
create policy "household_members_insert_owner_self"
  on public.household_members for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'owner'
    and private.my_household_id() is null
    and exists (
      select 1
      from public.households h
      where h.id = household_id
        and h.created_by = (select auth.uid())
    )
  );

create policy "household_members_delete"
  on public.household_members for delete
  to authenticated
  using (
    (
      user_id = (select auth.uid())
      and role = 'member'
    )
    or (
      private.is_household_owner(household_id)
      and user_id <> (select auth.uid())
    )
  );

create policy "household_invites_select_member"
  on public.household_invites for select
  to authenticated
  using (household_id = private.my_household_id());

revoke all on table public.households from anon;
revoke all on table public.household_members from anon;
revoke all on table public.household_invites from public, anon, authenticated;

grant select, insert, update on table public.households to authenticated;
grant select, insert, delete on table public.household_members to authenticated;
grant select (
  id,
  household_id,
  email,
  invited_by,
  expires_at,
  accepted_at,
  accepted_by,
  created_at
) on table public.household_invites to authenticated;

-- ---------------------------------------------------------------------------
-- Shared voucher visibility. Owner policies from the initial migration stay.
-- ---------------------------------------------------------------------------

create policy "vouchers_select_shared_household"
  on public.vouchers for select
  to authenticated
  using (
    shared = true
    and user_id <> (select auth.uid())
    and private.shares_household_with(user_id)
  );

create policy "redemptions_select_visible_voucher"
  on public.redemptions for select
  to authenticated
  using (
    exists (
      select 1
      from public.vouchers v
      where v.id = voucher_id
        and (
          v.user_id = (select auth.uid())
          or (
            v.shared = true
            and private.shares_household_with(v.user_id)
          )
        )
    )
  );

create policy "redemptions_insert_shared_household"
  on public.redemptions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.vouchers v
      where v.id = voucher_id
        and v.shared = true
        and v.user_id <> (select auth.uid())
        and private.shares_household_with(v.user_id)
    )
  );

create policy "profiles_select_household"
  on public.profiles for select
  to authenticated
  using (
    id <> (select auth.uid())
    and private.shares_household_with(id)
  );

-- Path: {owner_user_id}/{voucher_id}/{filename}
-- A member can read only the document of a voucher that is actually shared.
create policy "docs_select_shared_voucher"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'voucher-documents'
    and exists (
      select 1
      from public.vouchers v
      where v.shared = true
        and v.user_id::text = (storage.foldername(name))[1]
        and v.id::text = (storage.foldername(name))[2]
        and v.user_id <> (select auth.uid())
        and private.shares_household_with(v.user_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Push subscriptions (browser) and reminder dedupe (cron only).
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint),
  constraint push_subscriptions_endpoint_https check (endpoint like 'https://%'),
  constraint push_subscriptions_endpoint_len check (char_length(endpoint) <= 2000),
  constraint push_subscriptions_key_len check (
    char_length(p256dh) <= 200 and char_length(auth_key) <= 200
  )
);

create index push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.push_subscriptions from anon;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  voucher_id uuid not null references public.vouchers (id) on delete cascade,
  threshold_days integer not null,
  channel text not null check (channel in ('push', 'email')),
  sent_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, voucher_id, threshold_days, sent_on)
);

create index reminder_deliveries_sent_on_idx
  on public.reminder_deliveries (sent_on);

alter table public.reminder_deliveries enable row level security;

revoke all on table public.reminder_deliveries from public, anon, authenticated;

comment on table public.reminder_deliveries is
  'One reminder per user, voucher, and threshold per Jerusalem date. Written only by the cron secret route.';

-- ---------------------------------------------------------------------------
-- Mutations that must see rows the caller cannot select yet (invite accept).
-- Private definer functions. Public wrappers are service_role only.
-- ---------------------------------------------------------------------------

create or replace function private.create_household(actor uuid, household_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  clean_name text;
begin
  if actor is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.household_members m where m.user_id = actor
  ) then
    raise exception 'already_in_household' using errcode = 'P0001';
  end if;

  clean_name := left(btrim(coalesce(household_name, '')), 40);
  if clean_name = '' then
    clean_name := 'הבית';
  end if;

  insert into public.households (name, created_by)
  values (clean_name, actor)
  returning id into new_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_id, actor, 'owner');

  return new_id;
end;
$$;

create or replace function private.create_household_invite(
  actor uuid,
  p_token_hash text,
  invite_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
  new_id uuid;
  clean_email text;
begin
  if actor is null or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_invite' using errcode = 'P0001';
  end if;

  select m.household_id into hid
  from public.household_members m
  where m.user_id = actor
    and m.role = 'owner'
  limit 1;

  if hid is null then
    raise exception 'not_owner' using errcode = 'P0001';
  end if;

  clean_email := nullif(lower(btrim(coalesce(invite_email, ''))), '');
  if clean_email is not null and clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;

  insert into public.household_invites (
    household_id,
    email,
    token_hash,
    invited_by,
    expires_at
  )
  values (
    hid,
    clean_email,
    p_token_hash,
    actor,
    now() + interval '14 days'
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function private.accept_household_invite(
  p_token_hash text,
  joiner uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.household_invites%rowtype;
begin
  if joiner is null or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_invite' using errcode = 'P0001';
  end if;

  select * into inv
  from public.household_invites
  where token_hash = p_token_hash
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invite_not_found' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.household_members m
    where m.household_id = inv.household_id
      and m.user_id = joiner
  ) then
    update public.household_invites
    set accepted_at = now(), accepted_by = joiner
    where id = inv.id
      and accepted_at is null;
    return inv.household_id;
  end if;

  if exists (
    select 1 from public.household_members m where m.user_id = joiner
  ) then
    raise exception 'already_in_household' using errcode = 'P0001';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, joiner, 'member');

  update public.household_invites
  set accepted_at = now(), accepted_by = joiner
  where id = inv.id;

  return inv.household_id;
end;
$$;

create or replace function private.leave_household(actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
  actor_role text;
  others bigint;
begin
  if actor is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select m.household_id, m.role into hid, actor_role
  from public.household_members m
  where m.user_id = actor
  limit 1;

  if hid is null then
    return;
  end if;

  select count(*) into others
  from public.household_members m
  where m.household_id = hid
    and m.user_id <> actor;

  if actor_role = 'owner' and others > 0 then
    raise exception 'owner_must_remove_members' using errcode = 'P0001';
  end if;

  delete from public.household_members m
  where m.household_id = hid
    and m.user_id = actor;

  if others = 0 then
    delete from public.households h where h.id = hid;
  end if;
end;
$$;

create or replace function private.remove_household_member(actor uuid, member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  if actor is null or member is null or actor = member then
    raise exception 'not_owner' using errcode = 'P0001';
  end if;

  select m.household_id into hid
  from public.household_members m
  where m.user_id = actor
    and m.role = 'owner'
  limit 1;

  if hid is null then
    raise exception 'not_owner' using errcode = 'P0001';
  end if;

  delete from public.household_members m
  where m.household_id = hid
    and m.user_id = member
    and m.role = 'member';

  if not found then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.revoke_household_invite(actor uuid, invite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  select m.household_id into hid
  from public.household_members m
  where m.user_id = actor
    and m.role = 'owner'
  limit 1;

  if hid is null then
    raise exception 'not_owner' using errcode = 'P0001';
  end if;

  delete from public.household_invites i
  where i.id = invite
    and i.household_id = hid
    and i.accepted_at is null;

  if not found then
    raise exception 'invite_not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function private.create_household(uuid, text) from public, anon, authenticated;
revoke all on function private.create_household_invite(uuid, text, text) from public, anon, authenticated;
revoke all on function private.accept_household_invite(text, uuid) from public, anon, authenticated;
revoke all on function private.leave_household(uuid) from public, anon, authenticated;
revoke all on function private.remove_household_member(uuid, uuid) from public, anon, authenticated;
revoke all on function private.revoke_household_invite(uuid, uuid) from public, anon, authenticated;

grant execute on function private.create_household(uuid, text) to service_role;
grant execute on function private.create_household_invite(uuid, text, text) to service_role;
grant execute on function private.accept_household_invite(text, uuid) to service_role;
grant execute on function private.leave_household(uuid) to service_role;
grant execute on function private.remove_household_member(uuid, uuid) to service_role;
grant execute on function private.revoke_household_invite(uuid, uuid) to service_role;

-- Thin public wrappers so the service-role client can rpc() them.
-- security invoker: they do not bypass RLS themselves. Execute is service_role only.

create or replace function public.service_create_household(actor uuid, household_name text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_household(actor, household_name);
$$;

create or replace function public.service_create_household_invite(
  actor uuid,
  p_token_hash text,
  invite_email text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_household_invite(actor, p_token_hash, invite_email);
$$;

create or replace function public.service_accept_household_invite(
  p_token_hash text,
  joiner uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.accept_household_invite(p_token_hash, joiner);
$$;

create or replace function public.service_leave_household(actor uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.leave_household(actor);
end;
$$;

create or replace function public.service_remove_household_member(actor uuid, member uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.remove_household_member(actor, member);
end;
$$;

create or replace function public.service_revoke_household_invite(actor uuid, invite uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.revoke_household_invite(actor, invite);
end;
$$;

revoke all on function public.service_create_household(uuid, text) from public, anon, authenticated;
revoke all on function public.service_create_household_invite(uuid, text, text) from public, anon, authenticated;
revoke all on function public.service_accept_household_invite(text, uuid) from public, anon, authenticated;
revoke all on function public.service_leave_household(uuid) from public, anon, authenticated;
revoke all on function public.service_remove_household_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.service_revoke_household_invite(uuid, uuid) from public, anon, authenticated;

grant execute on function public.service_create_household(uuid, text) to service_role;
grant execute on function public.service_create_household_invite(uuid, text, text) to service_role;
grant execute on function public.service_accept_household_invite(text, uuid) to service_role;
grant execute on function public.service_leave_household(uuid) to service_role;
grant execute on function public.service_remove_household_member(uuid, uuid) to service_role;
grant execute on function public.service_revoke_household_invite(uuid, uuid) to service_role;
