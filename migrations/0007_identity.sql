-- MONEYLEAD identity, documents, KYC workflow, demonstration transfers, session security.
-- Never store COLUMN_API_KEY, PANs, full SSNs, biometric samples, or passwords here.

alter table customer_profiles add column if not exists username text;
alter table customer_profiles add column if not exists moneylead_user_id text;
alter table customer_profiles add column if not exists privacy_mode boolean not null default false;
alter table customer_profiles add column if not exists last_activity_at timestamptz;

create unique index if not exists customer_profiles_username_lower_idx
  on customer_profiles (lower(username))
  where username is not null;
create unique index if not exists customer_profiles_ml_user_id_idx
  on customer_profiles (moneylead_user_id)
  where moneylead_user_id is not null;

create table if not exists identity_counters (
  name text primary key,
  value bigint not null
);
insert into identity_counters (name, value) values ('moneylead_user', 18426)
on conflict (name) do nothing;

alter table identity_verifications add column if not exists workflow_status text;
alter table identity_verifications add column if not exists submitted_at timestamptz;
alter table identity_verifications add column if not exists review_started_at timestamptz;
alter table identity_verifications add column if not exists review_deadline timestamptz;
alter table identity_verifications add column if not exists review_completed_at timestamptz;
alter table identity_verifications add column if not exists expired_at timestamptz;
alter table identity_verifications add column if not exists assigned_reviewer text;
alter table identity_verifications add column if not exists priority text not null default 'normal';
alter table identity_verifications add column if not exists agent_recommendation text;
alter table identity_verifications add column if not exists agent_reason text;
alter table identity_verifications add column if not exists review_notes text;
alter table identity_verifications add column if not exists approved_by text;
alter table identity_verifications add column if not exists approval_method text;
alter table identity_verifications add column if not exists customer_reason text;

create table if not exists kyc_events (
  id text primary key,
  user_id text not null,
  verification_id text,
  actor_user_id text,
  actor_role text,
  action text not null,
  previous_status text,
  new_status text,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists kyc_events_user_idx on kyc_events (user_id, created_at desc);

create table if not exists customer_documents (
  id text primary key,
  user_id text not null,
  kind text not null,
  title text not null,
  filename text not null,
  mime text not null default 'application/pdf',
  source_id text,
  created_at timestamptz not null default now()
);
create index if not exists customer_documents_user_idx on customer_documents (user_id, created_at desc);

create table if not exists demo_transfers (
  id text primary key,
  user_id text not null,
  transaction_id text,
  amount_cents bigint not null,
  counterparty_name text not null,
  status text not null,
  failure_reason text,
  fail_after timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists demo_transfers_user_idx on demo_transfers (user_id, created_at desc);

alter table transactions add column if not exists is_demonstration boolean not null default false;

create table if not exists webauthn_credentials (
  id text primary key,
  user_id text not null,
  credential_id text not null unique,
  device_name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists webauthn_credentials_user_idx on webauthn_credentials (user_id);

create table if not exists webauthn_challenges (
  id text primary key,
  user_id text not null,
  challenge text not null,
  purpose text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create table if not exists failed_logins (
  id text primary key,
  email text,
  user_id text,
  ip_city text,
  created_at timestamptz not null default now()
);
create index if not exists failed_logins_email_idx on failed_logins (email, created_at desc);

insert into product_config (key, value) values
  ('kyc_sla_hours', '24'),
  ('kyc_auto_approval_enabled', 'false')
on conflict (key) do nothing;

insert into feature_flags (key, enabled, description) values
  ('sandbox_demonstration', true, 'Allow sandbox demonstration transfers. These never move real funds or change balances.'),
  ('banking_transfers', true, 'Allow real ACH through the banking partner when configured.'),
  ('cards_program', true, 'Show the card program. Cards are not issued without a processor.'),
  ('credit_program', true, 'Show credit applications. Nothing is auto-approved.'),
  ('support_messaging', true, 'Allow customers to open support cases.'),
  ('onboarding_open', true, 'Allow customers to continue onboarding.')
on conflict (key) do nothing;
