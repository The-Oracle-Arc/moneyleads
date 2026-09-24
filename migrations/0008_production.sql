-- Production-ready additions: preferred name, date-preserving historical ledger, agent runs.
-- Never store COLUMN_API_KEY, PANs, full SSNs, biometric samples, or passwords.

alter table customer_profiles add column if not exists preferred_name text;

alter table transactions add column if not exists occurred_at timestamptz;
update transactions set occurred_at = coalesce(occurred_at, created_at) where occurred_at is null;

create table if not exists historical_sources (
  id text primary key,
  name text not null,
  kind text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists historical_records (
  id text primary key,
  user_id text,
  source_id text,
  source_name text not null,
  kind text not null,
  source_occurred_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  amount_cents bigint,
  description text not null,
  counterparty text,
  reference text,
  status text not null default 'ingested',
  original_payload text,
  superseded_by text,
  created_at timestamptz not null default now()
);
create index if not exists historical_records_user_idx on historical_records (user_id, source_occurred_at);
create index if not exists historical_records_occurred_idx on historical_records (source_occurred_at);

create table if not exists historical_corrections (
  id text primary key,
  original_id text not null,
  corrected_id text not null,
  actor_user_id text,
  actor_role text,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists agent_runs (
  id text primary key,
  agent text not null,
  actor_user_id text,
  subject_user_id text,
  status text not null,
  summary text not null,
  findings text,
  created_at timestamptz not null default now()
);
create index if not exists agent_runs_agent_idx on agent_runs (agent, created_at desc);

create table if not exists kyc_capture_sessions (
  id text primary key,
  user_id text not null,
  status text not null,
  prompts_completed integer not null default 0,
  camera_available boolean not null default false,
  provider_required boolean not null default true,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists kyc_capture_sessions_user_idx on kyc_capture_sessions (user_id, created_at desc);

insert into feature_flags (key, enabled, description) values
  ('historical_ingest', true, 'Allow authorized staff to ingest historical records. Source dates are preserved. Nothing is invented.')
on conflict (key) do nothing;
