create table if not exists user_activity (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  command text not null,
  executed_at timestamp with time zone not null default now(),
  metadata jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_user_activity_user_id on user_activity(user_id);
create index if not exists idx_user_activity_command on user_activity(command);
create index if not exists idx_user_activity_executed_at on user_activity(executed_at);
create index if not exists idx_user_activity_user_command on user_activity(user_id, command);

-- Enable RLS
alter table user_activity enable row level security;

-- RLS Policy: Users can read their own activity
create policy "Users can read own activity" on user_activity
  for select using (user_id::text = auth.uid()::text or current_setting('app.is_admin') = 'true');
