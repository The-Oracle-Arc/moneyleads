-- MONEYLEAD platform: invitation-only staff, designated Ultimate Administrator,
-- banking-program status. Never store COLUMN_API_KEY, PANs, or passwords here.

create table if not exists staff_designations (
  email text primary key,
  role text not null,
  user_id text,
  invited_by text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  activated_at timestamptz
);
create index if not exists staff_designations_user_id_idx on staff_designations (user_id);

insert into staff_designations (email, role, status)
values ('coltonhogan444@gmail.com', 'ultimate_admin', 'pending')
on conflict (email) do nothing;

create table if not exists staff_invites (
  id text primary key,
  email text not null,
  role text not null,
  invited_by text not null,
  status text not null default 'pending',
  note text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz
);
create index if not exists staff_invites_email_idx on staff_invites (email);

alter table staff_users add column if not exists email text;
alter table staff_users add column if not exists invited_by text;

insert into product_config (key, value) values
  ('banking_program_status', 'preparing'),
  ('production_banking_status', 'pending_onboarding')
on conflict (key) do nothing;
