-- Column sandbox integration. Provider IDs reconcile MONEYLEAD rows with Column.
-- Never store API keys, webhook secrets, or full SSNs in these tables.

alter table customer_profiles
  add column if not exists provider text,
  add column if not exists provider_entity_id text,
  add column if not exists provider_verification_status text;

alter table customer_profiles alter column is_demo set default false;

create unique index if not exists customer_profiles_provider_entity_idx
  on customer_profiles (provider_entity_id)
  where provider_entity_id is not null;

alter table identity_verifications
  add column if not exists provider_verification_status text;

alter table bank_accounts
  add column if not exists provider text,
  add column if not exists provider_account_id text,
  add column if not exists provider_account_number_id text;

alter table bank_accounts alter column is_demo set default false;

create unique index if not exists bank_accounts_provider_account_idx
  on bank_accounts (provider_account_id)
  where provider_account_id is not null;

alter table bank_account_balances
  add column if not exists holding_cents bigint not null default 0,
  add column if not exists pending_cents bigint not null default 0,
  add column if not exists locked_cents bigint not null default 0,
  add column if not exists last_provider_sync_at timestamptz;

alter table transactions
  add column if not exists provider text,
  add column if not exists provider_transfer_id text,
  add column if not exists provider_status text,
  add column if not exists is_incoming boolean;

create unique index if not exists transactions_provider_transfer_idx
  on transactions (provider_transfer_id)
  where provider_transfer_id is not null;

alter table transfers
  add column if not exists provider text,
  add column if not exists provider_transfer_id text,
  add column if not exists provider_counterparty_id text,
  add column if not exists provider_status text;

create unique index if not exists transfers_provider_transfer_idx
  on transfers (provider_transfer_id)
  where provider_transfer_id is not null;

create table if not exists column_entities (
  id text primary key,
  user_id text not null unique,
  provider_entity_id text not null unique,
  verification_status text not null,
  review_reasons text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists column_entities_user_id_idx on column_entities (user_id);

create table if not exists webhook_events (
  id text primary key,
  provider text not null default 'column',
  provider_event_id text not null,
  event_type text,
  payload text,
  signature_valid boolean not null default false,
  processing_status text not null default 'received',
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create unique index if not exists webhook_events_provider_event_idx
  on webhook_events (provider, provider_event_id);
create index if not exists webhook_events_received_idx on webhook_events (received_at desc);

create table if not exists reconciliation_alerts (
  id text primary key,
  user_id text,
  account_id text,
  kind text not null,
  detail text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists reconciliation_alerts_status_idx on reconciliation_alerts (status, created_at desc);
