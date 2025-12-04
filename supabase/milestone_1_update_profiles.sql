-- Add game stats columns to profiles table
alter table public.profiles 
add column if not exists level integer default 1,
add column if not exists total_xp integer default 0,
add column if not exists check_in_dates jsonb default '[]'::jsonb;

-- Optional: Create a secure view or function if needed, but direct access with RLS is fine for now.
-- RLS policies already exist for profiles (update own profile).
