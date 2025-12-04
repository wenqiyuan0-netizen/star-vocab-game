alter table public.profiles 
add column if not exists daily_stats jsonb default '{}'::jsonb;
