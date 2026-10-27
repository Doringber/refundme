-- Slim BuyMe multi-brand lists (ALL, FOODY, STYLE, TOGETHER): brand titles
-- and the distinctive aliases from each brand's searchTerms. No user id and
-- no coordinates. Nearby search matches these names to the map at request
-- time and does not store where the user was.
--
-- Writes: server only (service role) from POST /api/cron/buyme-catalogs and
-- from an on-demand refresh after a nearby search. The app still answers
-- from the bundled snapshot in src/lib/stores/buyme-catalog-snapshot.json
-- when this table does not exist yet.
--
-- Apply manually (SQL editor or `npx supabase db push`). The app does not
-- run migrations and does not apply this file to production.

create table if not exists public.buyme_brand_catalogs (
  catalog_id text primary key
    check (catalog_id in ('13438757', '17573460', '7565407', '17574075')),
  label text not null
    check (char_length(label) between 2 and 200),
  -- [{ "title": text, "aliases": text[] }]
  brands jsonb not null
    check (jsonb_typeof(brands) = 'array' and jsonb_array_length(brands) between 1 and 2500),
  brand_count integer not null
    check (brand_count between 1 and 2500),
  source_url text not null,
  source_last_modified text,
  fetched_at timestamptz not null default now()
);

alter table public.buyme_brand_catalogs enable row level security;

-- Public brand names. Signed-in clients may read; nobody but the service role writes.
create policy "buyme_brand_catalogs_select_authenticated"
  on public.buyme_brand_catalogs for select
  to authenticated
  using (true);

comment on table public.buyme_brand_catalogs is
  'Slim BuyMe brand lists refreshed by cron. Service role writes. Apply manually.';
