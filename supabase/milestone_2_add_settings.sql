alter table public.profiles 
add column if not exists settings jsonb default '{}'::jsonb;
