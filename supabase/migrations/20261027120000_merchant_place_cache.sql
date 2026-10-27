-- Chain branches found on OpenStreetMap, saved so the stores page can list a
-- merchant's branches without a new map query. Rows come only from the
-- coordinate-free, country-wide exact-name query: no user location, user id
-- or search area is stored.
--
-- Writes: server only (service role) in src/lib/stores/place-store.ts, and only
-- for a signed-in user who holds a voucher for that merchant.
-- The app works without this table; apply manually (SQL editor or
-- `npx supabase db push`). The app does not run migrations.

create table if not exists public.merchant_place_cache (
  merchant_key text primary key
    check (char_length(merchant_key) between 2 and 80),
  merchant_name text not null
    check (char_length(merchant_name) between 2 and 80),
  -- [{ "name": text, "address": text | null, "lat": number, "lng": number }]
  places jsonb not null default '[]'::jsonb
    check (jsonb_typeof(places) = 'array' and jsonb_array_length(places) <= 600),
  source text not null default 'osm' check (source in ('osm')),
  refreshed_at timestamptz not null default now()
);

alter table public.merchant_place_cache enable row level security;

-- Public map data. Signed-in clients may read; nobody but the service role writes.
create policy "merchant_place_cache_select_authenticated"
  on public.merchant_place_cache for select
  to authenticated
  using (true);
