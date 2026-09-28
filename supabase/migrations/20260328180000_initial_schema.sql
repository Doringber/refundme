-- זיכוי שלי — initial schema
-- Store credits / vouchers with RLS, private document storage, redemptions

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.document_type as enum (
  'store_credit',
  'gift_voucher',
  'shopping_voucher',
  'receipt'
);

create type public.voucher_status as enum (
  'active',
  'partially_redeemed',
  'fully_redeemed',
  'expired',
  'archived'
);

create type public.expiry_confidence as enum (
  'confirmed',
  'uncertain',
  'missing'
);

create type public.branch_acceptance as enum (
  'verified',
  'unverified',
  'not_accepted'
);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  orb_scale_agorot integer check (orb_scale_agorot is null or orb_scale_agorot > 0),
  reminder_days integer[] not null default '{30,14,7,3,1}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Merchants & branches (shared reference data, readable by all authenticated)
-- ---------------------------------------------------------------------------
create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  name_he text not null,
  slug text not null unique,
  category text,
  website text,
  logo_color text,
  created_at timestamptz not null default now()
);

create table public.merchant_branches (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  name_he text not null,
  city text not null,
  address_he text not null,
  lat double precision,
  lng double precision,
  acceptance public.branch_acceptance not null default 'unverified',
  notes_he text,
  created_at timestamptz not null default now()
);

create index merchant_branches_city_idx on public.merchant_branches (city);
create index merchant_branches_merchant_idx on public.merchant_branches (merchant_id);

alter table public.merchants enable row level security;
alter table public.merchant_branches enable row level security;

create policy "merchants_select_authenticated"
  on public.merchants for select
  to authenticated
  using (true);

create policy "branches_select_authenticated"
  on public.merchant_branches for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Vouchers (user-owned)
-- ---------------------------------------------------------------------------
create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  merchant_id uuid references public.merchants (id) on delete set null,
  merchant_name text not null,
  document_type public.document_type not null,
  status public.voucher_status not null default 'active',
  original_amount_agorot integer not null check (original_amount_agorot >= 0),
  remaining_amount_agorot integer not null check (remaining_amount_agorot >= 0),
  currency text not null default 'ILS',
  issue_date date,
  expiry_date date,
  expiry_confidence public.expiry_confidence not null default 'missing',
  voucher_code text,
  barcode_value text,
  usage_terms text,
  notes text,
  -- storage path under voucher-documents bucket: {user_id}/{voucher_id}/{filename}
  document_path text,
  document_mime_type text,
  document_file_name text,
  extraction_raw jsonb,
  fields_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint remaining_lte_original check (remaining_amount_agorot <= original_amount_agorot)
);

create index vouchers_user_idx on public.vouchers (user_id);
create index vouchers_status_idx on public.vouchers (user_id, status);
create index vouchers_expiry_idx on public.vouchers (user_id, expiry_date);
create index vouchers_merchant_name_idx on public.vouchers (user_id, merchant_name);

alter table public.vouchers enable row level security;

create policy "vouchers_select_own"
  on public.vouchers for select
  using (auth.uid() = user_id);

create policy "vouchers_insert_own"
  on public.vouchers for insert
  with check (auth.uid() = user_id);

create policy "vouchers_update_own"
  on public.vouchers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "vouchers_delete_own"
  on public.vouchers for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Redemptions
-- ---------------------------------------------------------------------------
create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_agorot integer not null check (amount_agorot > 0),
  redeemed_at date not null default (timezone('Asia/Jerusalem', now()))::date,
  note text,
  created_at timestamptz not null default now()
);

create index redemptions_voucher_idx on public.redemptions (voucher_id);
create index redemptions_user_idx on public.redemptions (user_id);

alter table public.redemptions enable row level security;

create policy "redemptions_select_own"
  on public.redemptions for select
  using (auth.uid() = user_id);

create policy "redemptions_insert_own"
  on public.redemptions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.vouchers v
      where v.id = voucher_id and v.user_id = auth.uid()
    )
  );

create policy "redemptions_update_own"
  on public.redemptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "redemptions_delete_own"
  on public.redemptions for delete
  using (auth.uid() = user_id);

-- Recalculate remaining balance after redemption changes
create or replace function public.recalc_voucher_remaining()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  spent integer;
  orig integer;
  new_remaining integer;
  new_status public.voucher_status;
  exp_date date;
begin
  v_id := coalesce(new.voucher_id, old.voucher_id);

  select original_amount_agorot, expiry_date
    into orig, exp_date
  from public.vouchers
  where id = v_id;

  select coalesce(sum(amount_agorot), 0) into spent
  from public.redemptions
  where voucher_id = v_id;

  new_remaining := greatest(orig - spent, 0);

  if new_remaining = 0 then
    new_status := 'fully_redeemed';
  elsif spent > 0 then
    new_status := 'partially_redeemed';
  elsif exp_date is not null and exp_date < (timezone('Asia/Jerusalem', now()))::date then
    new_status := 'expired';
  else
    new_status := 'active';
  end if;

  update public.vouchers
  set remaining_amount_agorot = new_remaining,
      status = new_status,
      updated_at = now()
  where id = v_id;

  return coalesce(new, old);
end;
$$;

create trigger redemptions_recalc
  after insert or update or delete on public.redemptions
  for each row execute function public.recalc_voucher_remaining();

-- ---------------------------------------------------------------------------
-- Activity log (user-visible recent activity)
-- ---------------------------------------------------------------------------
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  voucher_id uuid references public.vouchers (id) on delete set null,
  kind text not null,
  summary_he text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_user_idx on public.activity_events (user_id, created_at desc);

alter table public.activity_events enable row level security;

create policy "activity_select_own"
  on public.activity_events for select
  using (auth.uid() = user_id);

create policy "activity_insert_own"
  on public.activity_events for insert
  with check (auth.uid() = user_id);

create policy "activity_delete_own"
  on public.activity_events for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Private storage bucket for original documents
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voucher-documents',
  'voucher-documents',
  false,
  10485760, -- 10 MB
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {user_id}/{voucher_id}/{filename}
create policy "docs_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'voucher-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "docs_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'voucher-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "docs_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'voucher-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'voucher-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "docs_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'voucher-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Seed merchants / branches (small maintainable dataset)
-- ---------------------------------------------------------------------------
insert into public.merchants (id, name_he, slug, category, logo_color) values
  ('11111111-1111-1111-1111-111111111101', 'FOX', 'fox', 'אופנה', '#47B5A8'),
  ('11111111-1111-1111-1111-111111111102', 'זארה', 'zara', 'אופנה', '#252D45'),
  ('11111111-1111-1111-1111-111111111103', 'סופר-פארם', 'super-pharm', 'פארם', '#F76F54'),
  ('11111111-1111-1111-1111-111111111104', 'רמי לוי', 'rami-levy', 'מזון', '#FBB28B'),
  ('11111111-1111-1111-1111-111111111105', 'איקאה', 'ikea', 'בית', '#F7E289'),
  ('11111111-1111-1111-1111-111111111106', 'מקס סטוק', 'max-stock', 'בית', '#A3C1E2');

insert into public.merchant_branches (merchant_id, name_he, city, address_he, lat, lng, acceptance, notes_he) values
  ('11111111-1111-1111-1111-111111111101', 'FOX דיזנגוף סנטר', 'תל אביב', 'דיזנגוף 50', 32.0753, 34.7750, 'verified', 'אושר לקבלת זיכוי החזרה בחנות זו'),
  ('11111111-1111-1111-1111-111111111101', 'FOX עזריאלי', 'תל אביב', 'דרך מנחם בגין 132', 32.0743, 34.7922, 'unverified', null),
  ('11111111-1111-1111-1111-111111111101', 'FOX גרנד קניון', 'חיפה', 'שדרות ההסתדרות 55', 32.7900, 35.0400, 'unverified', null),
  ('11111111-1111-1111-1111-111111111102', 'זארה מלחה', 'ירושלים', 'דרך אגודת ספורט בית״ר 1', 31.7510, 35.1870, 'verified', null),
  ('11111111-1111-1111-1111-111111111102', 'זארה רמת אביב', 'תל אביב', 'איינשטיין 40', 32.1120, 34.8000, 'unverified', null),
  ('11111111-1111-1111-1111-111111111103', 'סופר-פארם רוטשילד', 'תל אביב', 'רוטשילד 45', 32.0635, 34.7730, 'verified', null),
  ('11111111-1111-1111-1111-111111111103', 'סופר-פארם באר שבע', 'באר שבע', 'דרך אילן רמון 2', 31.2520, 34.7910, 'unverified', null),
  ('11111111-1111-1111-1111-111111111104', 'רמי לוי גבעתיים', 'גבעתיים', 'כצנלסון 58', 32.0700, 34.8100, 'unverified', 'קבלה בחנות עשויה להיות מוגבלת לסניף ההנפקה'),
  ('11111111-1111-1111-1111-111111111105', 'איקאה ראשון לציון', 'ראשון לציון', 'פארק עסקים', 31.9870, 34.7700, 'verified', null),
  ('11111111-1111-1111-1111-111111111105', 'איקאה נתניה', 'נתניה', 'פארק התעשייה', 32.3100, 34.8700, 'unverified', null),
  ('11111111-1111-1111-1111-111111111106', 'מקס סטוק פתח תקווה', 'פתח תקווה', 'ז׳בוטינסקי 100', 32.0900, 34.8800, 'unverified', null);
