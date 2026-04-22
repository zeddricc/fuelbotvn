-- Migration: Update user_bikes to use user_id instead of chat_id
-- This version keeps chat_id for backward compatibility with broadcast messages

-- Add user_id column to user_bikes
alter table user_bikes add column if not exists user_id uuid references users(id) on delete cascade;

-- Create index on user_id
create index if not exists idx_user_bikes_user_id on user_bikes(user_id);

-- Add unique constraint on user_id and name
alter table user_bikes add constraint user_bikes_user_id_name_key unique (user_id, name);
