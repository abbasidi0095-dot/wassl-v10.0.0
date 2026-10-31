-- ---------------------------------------------------------------------------
-- Wassl account directory
--
-- Run this once in the Supabase SQL editor. The app keeps roles and sessions in
-- its own database; this table mirrors verified accounts for reporting and for
-- other Supabase-backed services.
--
-- Writes use the service-role key from the server only. RLS is enabled with no
-- public policies, so the publishable/anon key cannot read or write profiles.
-- ---------------------------------------------------------------------------

create table if not exists public.users (
  id text primary key,
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'merchant', 'driver')),
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists users_role_idx on public.users (role);

alter table public.users enable row level security;

revoke all on public.users from anon, authenticated;
grant all on public.users to service_role;
