-- MONEYLEAD banking schema. All money is integer USD cents (bigint).
-- Every customer row is demonstration data until a regulated partner is wired.

create table if not exists customer_profiles (
  id text primary key,
  user_id text not null unique,
  email text,
  email_verified_at timestamptz,
  legal_first_name text,
  middle_name text,
  legal_last_name text,
  dob date,
  citizenship text,
  residency_status text,
  ssn_last4 text,
  ssn_token text,
  phone text,
  phone_verified_at timestamptz,
  onboarding_step text not null default 'welcome',
  onboarding_status text not null default 'not_started',
  kyc_status text not null default 'not_started',
  checking_status text not null default 'not_started',
  debit_card_status text not null default 'not_started',
  credit_status text not null default 'not_applied',
  passcode_hash text,
  biometrics_enabled boolean not null default false,
  two_factor_enabled boolean not null default false,
  login_alerts boolean not null default true,
  is_demo boolean not null default true,
  account_closed_at timestamptz,
  close_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_profiles_user_id_idx on customer_profiles (user_id);

create table if not exists addresses (
  id text primary key,
  user_id text not null,
  kind text not null default 'residential',
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'US',
  created_at timestamptz not null default now()
);
create index if not exists addresses_user_id_idx on addresses (user_id);

create table if not exists identity_verifications (
  id text primary key,
  user_id text not null,
  provider text not null,
  provider_ref text,
  status text not null,
  document_type text,
  failure_reason text,
  selfie_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists identity_verifications_user_id_idx on identity_verifications (user_id);

create table if not exists applications (
  id text primary key,
  user_id text not null,
  product text not null,
  status text not null,
  submitted_at timestamptz,
  decision_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists applications_user_id_idx on applications (user_id);

create table if not exists bank_accounts (
  id text primary key,
  user_id text not null,
  product text not null default 'checking',
  name text not null default 'Checking',
  account_number text not null,
  routing_number text not null,
  status text not null,
  is_demo boolean not null default true,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bank_accounts_user_id_idx on bank_accounts (user_id);
create unique index if not exists bank_accounts_number_idx on bank_accounts (account_number);

create table if not exists bank_account_balances (
  account_id text primary key references bank_accounts (id) on delete cascade,
  current_cents bigint not null default 0,
  available_cents bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists ledger_entries (
  id text primary key,
  account_id text not null references bank_accounts (id),
  user_id text not null,
  amount_cents bigint not null,
  available_delta bigint not null,
  current_delta bigint not null,
  currency text not null default 'USD',
  description text not null,
  created_at timestamptz not null default now()
);
create index if not exists ledger_entries_account_id_idx on ledger_entries (account_id);

create table if not exists transactions (
  id text primary key,
  user_id text not null,
  account_id text,
  card_id text,
  ledger_id text,
  amount_cents bigint not null,
  status text not null,
  category text not null default 'other',
  merchant text not null,
  description text not null,
  counterparty text,
  last4 text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  posted_at timestamptz
);
create index if not exists transactions_user_id_idx on transactions (user_id, created_at desc);
create index if not exists transactions_account_id_idx on transactions (account_id);

create table if not exists transfers (
  id text primary key,
  user_id text not null,
  account_id text not null,
  direction text not null,
  method text not null,
  amount_cents bigint not null,
  status text not null,
  counterparty_name text not null,
  counterparty_detail text,
  idempotency_key text not null unique,
  estimated_settlement timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists transfers_user_id_idx on transfers (user_id, created_at desc);

create table if not exists debit_cards (
  id text primary key,
  user_id text not null,
  account_id text not null,
  last4 text not null,
  pan_token text not null,
  exp_month integer not null,
  exp_year integer not null,
  status text not null,
  holder_name text not null,
  pin_hash text,
  frozen boolean not null default false,
  shipping_status text,
  online_enabled boolean not null default true,
  atm_enabled boolean not null default true,
  pos_enabled boolean not null default true,
  international_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists debit_cards_user_id_idx on debit_cards (user_id);

create table if not exists credit_cards (
  id text primary key,
  user_id text not null,
  last4 text not null,
  pan_token text not null,
  exp_month integer not null,
  exp_year integer not null,
  status text not null,
  holder_name text not null,
  frozen boolean not null default false,
  current_balance_cents bigint not null default 0,
  credit_limit_cents bigint not null,
  statement_balance_cents bigint not null default 0,
  minimum_payment_cents bigint not null default 0,
  payment_due_date date,
  autopay_enabled boolean not null default false,
  autopay_amount text,
  apr_purchase_bps integer not null default 1899,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists credit_cards_user_id_idx on credit_cards (user_id);

create table if not exists credit_applications (
  id text primary key,
  user_id text not null,
  status text not null,
  employment_status text,
  annual_income_cents bigint,
  housing_status text,
  housing_payment_cents bigint,
  decision_reason text,
  adverse_action text,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists credit_applications_user_id_idx on credit_applications (user_id);

create table if not exists credit_payments (
  id text primary key,
  user_id text not null,
  credit_card_id text not null,
  account_id text not null,
  amount_cents bigint not null,
  status text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists credit_payments_user_id_idx on credit_payments (user_id);

create table if not exists statements (
  id text primary key,
  user_id text not null,
  account_id text,
  credit_card_id text,
  product text not null,
  period_start date not null,
  period_end date not null,
  opening_cents bigint not null,
  closing_cents bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists statements_user_id_idx on statements (user_id);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  title text not null,
  body text not null,
  kind text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_id_idx on notifications (user_id, created_at desc);

create table if not exists devices (
  id text primary key,
  user_id text not null,
  name text not null,
  trusted boolean not null default false,
  current_flag boolean not null default false,
  last_seen_at timestamptz not null default now(),
  ip_city text,
  created_at timestamptz not null default now()
);
create index if not exists devices_user_id_idx on devices (user_id);

create table if not exists app_sessions (
  id text primary key,
  user_id text not null,
  device_id text,
  ip_city text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists app_sessions_user_id_idx on app_sessions (user_id);

create table if not exists support_cases (
  id text primary key,
  user_id text not null,
  subject text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_cases_user_id_idx on support_cases (user_id);

create table if not exists support_messages (
  id text primary key,
  case_id text not null references support_cases (id) on delete cascade,
  user_id text not null,
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_case_id_idx on support_messages (case_id);

create table if not exists disputes (
  id text primary key,
  user_id text not null,
  transaction_id text not null,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists disputes_user_id_idx on disputes (user_id);

create table if not exists fraud_alerts (
  id text primary key,
  user_id text not null,
  title text not null,
  body text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists fraud_alerts_user_id_idx on fraud_alerts (user_id);

create table if not exists audit_logs (
  id text primary key,
  actor_user_id text,
  actor_role text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_at_idx on audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on audit_logs (actor_user_id);

create table if not exists staff_users (
  user_id text primary key,
  role text not null,
  created_at timestamptz not null default now()
);

create table if not exists phone_challenges (
  id text primary key,
  user_id text not null,
  phone text not null,
  method text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists phone_challenges_user_id_idx on phone_challenges (user_id);

create table if not exists rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

create table if not exists notification_preferences (
  user_id text primary key,
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  login_alerts boolean not null default true,
  transaction_alerts boolean not null default true,
  marketing boolean not null default false
);

create table if not exists card_replacements (
  id text primary key,
  user_id text not null,
  card_id text not null,
  card_kind text not null,
  reason text not null,
  status text not null,
  created_at timestamptz not null default now()
);
