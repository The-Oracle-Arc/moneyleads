-- MONEYLEAD control plane: assistant threads, confirmations, product config, provider errors.
-- Never store COLUMN_API_KEY, webhook secrets, PANs, or full SSNs here.

create table if not exists assistant_threads (
  id text primary key,
  user_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assistant_threads_user_id_idx on assistant_threads (user_id);

create table if not exists assistant_messages (
  id text primary key,
  thread_id text not null,
  user_id text not null,
  role text not null,
  body text not null,
  tool_name text,
  source text not null default 'deterministic',
  created_at timestamptz not null default now()
);
create index if not exists assistant_messages_thread_idx on assistant_messages (thread_id, created_at);
create index if not exists assistant_messages_user_id_idx on assistant_messages (user_id);

create table if not exists action_confirmations (
  id text primary key,
  user_id text not null,
  action text not null,
  payload text not null,
  status text not null default 'pending',
  requested_by text not null default 'assistant',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  resolved_at timestamptz
);
create index if not exists action_confirmations_user_idx on action_confirmations (user_id, status);

create table if not exists product_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into product_config (key, value) values
  ('ach_outbound_daily_limit_cents', '500000'),
  ('ach_inbound_daily_limit_cents', '1000000'),
  ('support_hours', '24/7 messaging. Human operations follow up in the operations console.'),
  ('debit_cards_issued', 'false'),
  ('credit_issuer', 'none'),
  ('sandbox_disclaimer', 'Column Sandbox is not a live consumer bank account and is not FDIC insured.')
on conflict (key) do nothing;

create table if not exists provider_errors (
  id text primary key,
  provider text not null default 'column',
  operation text not null,
  http_status integer,
  customer_message text not null,
  user_id text,
  created_at timestamptz not null default now()
);
create index if not exists provider_errors_created_idx on provider_errors (created_at desc);

create table if not exists manual_reviews (
  id text primary key,
  user_id text not null,
  kind text not null,
  status text not null default 'open',
  summary text not null,
  entity_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);
create index if not exists manual_reviews_status_idx on manual_reviews (status, created_at desc);
