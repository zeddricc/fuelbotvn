create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  telegram_username text,
  first_name text,
  last_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_active boolean not null default true,
  registered_at timestamp with time zone not null default now(),
  last_active_at timestamp with time zone,
  metadata jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_users_telegram_id on users(telegram_id);
create index if not exists idx_users_role on users(role);
create index if not exists idx_users_is_active on users(is_active);
create index if not exists idx_users_registered_at on users(registered_at);

-- Enable RLS
alter table users enable row level security;

-- RLS Policy: Users can read their own data
create policy "Users can read own data" on users
  for select using (auth.uid()::text = id::text or current_setting('app.is_admin') = 'true');

-- RLS Policy: Only admins can update users
create policy "Admins can update users" on users
  for update using (current_setting('app.is_admin') = 'true');
