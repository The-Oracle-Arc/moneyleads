-- MONEYLEAD operations: feature flags and staff notes.
-- Never store COLUMN_API_KEY, webhook secrets, PANs, or full SSNs here.

create table if not exists feature_flags (
  key text primary key,
  enabled boolean not null default true,
  description text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into feature_flags (key, enabled, description) values
  ('credit_applications_open', true, 'Allow customers to submit a credit application. Applications are stored; no issuer is connected.'),
  ('assistant_enabled', true, 'Show the MONEYLEAD Assistant. Banking still works if this is off.'),
  ('sandbox_incoming_ach', true, 'Allow sandbox incoming ACH credits through Column.'),
  ('new_signups_open', true, 'Allow new customer sign-ups.'),
  ('staff_customer_messaging', true, 'Allow operators to send in-app messages to customers.')
on conflict (key) do nothing;

create table if not exists staff_notes (
  id text primary key,
  customer_user_id text not null,
  author_user_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists staff_notes_customer_idx on staff_notes (customer_user_id, created_at desc);
