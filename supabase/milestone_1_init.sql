-- Milestone 1: Core Tables & RLS
-- Run this script in the Supabase SQL Editor

-- 1. Enable necessary extensions (if any)
-- create extension if not exists "uuid-ossp"; -- Usually enabled by default

-- 2. Create Profiles Table (Public user info)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  email text,
  username text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Create User Words Table (The core vocabulary data)
create table if not exists public.user_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  de text not null,           -- German word
  de_norm text generated always as (lower(de)) stored,
  cn text,                    -- Chinese definition
  gender text,                -- der/die/das
  state text default 'new',   -- learning state
  step integer default 0,
  interval integer default 0,
  ease_factor double precision default 2.5,
  due_date timestamptz default 'epoch', -- default to past
  fsrs jsonb,                 -- full FSRS state blob for future proofing
  proficiency integer default 0,
  graduated boolean default false,
  last_review timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
);

-- 4. Create Daily Stats Table (For heatmaps/activity tracking)
create table if not exists public.daily_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default CURRENT_DATE,
  review_count integer default 0,
  new_count integer default 0,
  time_spent_seconds integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique (user_id, date)
);

-- 5. Enable Row Level Security (RLS) - CRITICAL
alter table public.profiles enable row level security;
alter table public.user_words enable row level security;
alter table public.daily_stats enable row level security;

-- 6. Create RLS Policies

-- Profiles: Users can view their own profile. 
-- (Optional: Allow viewing others if you want social features later)
create policy "Users can view own profile" 
on public.profiles for select 
using ( auth.uid() = id );

create policy "Users can update own profile" 
on public.profiles for update 
using ( auth.uid() = id );

-- User Words: Strictly private
create policy "Users can view own words" 
on public.user_words for select 
using ( auth.uid() = user_id );

create policy "Users can insert own words" 
on public.user_words for insert 
with check ( auth.uid() = user_id );

create policy "Users can update own words" 
on public.user_words for update 
using ( auth.uid() = user_id );

create policy "Users can delete own words" 
on public.user_words for delete 
using ( auth.uid() = user_id );

-- Daily Stats: Strictly private
create policy "Users can view own stats" 
on public.daily_stats for select 
using ( auth.uid() = user_id );

create policy "Users can insert own stats" 
on public.daily_stats for insert 
with check ( auth.uid() = user_id );

create policy "Users can update own stats" 
on public.daily_stats for update 
using ( auth.uid() = user_id );

-- 7. Create Indexes for Performance
create index if not exists idx_user_words_user on public.user_words(user_id);
create index if not exists idx_user_words_due on public.user_words(user_id, due_date);
create unique index if not exists user_words_user_id_de_norm_key on public.user_words(user_id, de_norm);
create index if not exists idx_daily_stats_user_date on public.daily_stats(user_id, date);

-- 8. Set up Triggers for automatic Profile creation on Sign Up
-- This function runs whenever a new user is created in auth.users
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Safely recreate the trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
