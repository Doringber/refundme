-- BuyMe connector: connection status (client-readable) + encrypted session (server only).

create table public.wallet_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('buyme')),
  status text not null default 'login_required'
    check (status in ('connected', 'login_required')),
  expires_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.wallet_connections enable row level security;

create policy "wallet_connections_select_own"
  on public.wallet_connections for select
  using (auth.uid() = user_id);

-- Writes go through the service role (bypasses RLS). No insert/update for clients
-- so a stolen browser session cannot overwrite the stored BuyMe token metadata
-- except by reading status.

create table public.wallet_connection_secrets (
  connection_id uuid primary key
    references public.wallet_connections (id) on delete cascade,
  token_ciphertext text not null,
  updated_at timestamptz not null default now()
);

alter table public.wallet_connection_secrets enable row level security;

-- No policies: authenticated/anon cannot read the ciphertext.
-- Service role bypasses RLS for sync + cron.

create index wallet_connections_status_idx
  on public.wallet_connections (status, provider);

-- Stable identity for BuyMe upserts into existing vouchers.
create unique index vouchers_buyme_external_idx
  on public.vouchers (
    user_id,
    (extraction_raw->>'provider'),
    (extraction_raw->>'externalId')
  )
  where extraction_raw->>'provider' = 'buyme'
    and extraction_raw->>'externalId' is not null;
