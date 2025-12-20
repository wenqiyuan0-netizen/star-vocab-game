-- 1. Create user_word_skills table
create table if not exists public.user_word_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  word_id uuid not null references public.user_words (id) on delete cascade,
  skill text not null, -- 'listening', 'speaking', etc.
  state text not null default 'new', -- 'new', 'learning', 'review', 'relearning'
  fsrs jsonb, -- FSRS state for this specific skill
  interval integer not null default 0,
  due_date timestamptz,
  proficiency integer not null default 0,
  last_review timestamptz,
  last_seen_at timestamptz, -- For cooldown logic
  local_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint user_word_skills_unique unique (user_id, word_id, skill),
  constraint user_word_skills_skill_check check (skill in ('listening', 'speaking', 'reading', 'writing')),
  constraint user_word_skills_state_check check (state in ('new', 'learning', 'review', 'relearning'))
);

-- 2. Create user_daily_plans table
create table if not exists public.user_daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null default current_date,
  mode text not null, -- 'listening', 'speaking', etc.
  target_new_count integer not null default 20,
  target_review_count integer not null default 100,
  completed_new_count integer not null default 0,
  completed_review_count integer not null default 0,
  time_spent_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint user_daily_plans_unique unique (user_id, date, mode)
);

-- 3. Enable RLS
alter table public.user_word_skills enable row level security;
alter table public.user_daily_plans enable row level security;

-- 4. RLS Policies for user_word_skills
-- Note: We use "do $$ ... end $$" block to avoid errors if policies already exist, 
-- or we can just drop them first. For simplicity in this script, we'll drop and recreate.

drop policy if exists "Users can view own word skills" on public.user_word_skills;
create policy "Users can view own word skills"
on public.user_word_skills for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own word skills" on public.user_word_skills;
create policy "Users can insert own word skills"
on public.user_word_skills for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own word skills" on public.user_word_skills;
create policy "Users can update own word skills"
on public.user_word_skills for update
using (auth.uid() = user_id);

drop policy if exists "Users can delete own word skills" on public.user_word_skills;
create policy "Users can delete own word skills"
on public.user_word_skills for delete
using (auth.uid() = user_id);

-- 5. RLS Policies for user_daily_plans
drop policy if exists "Users can view own daily plans" on public.user_daily_plans;
create policy "Users can view own daily plans"
on public.user_daily_plans for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own daily plans" on public.user_daily_plans;
create policy "Users can insert own daily plans"
on public.user_daily_plans for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own daily plans" on public.user_daily_plans;
create policy "Users can update own daily plans"
on public.user_daily_plans for update
using (auth.uid() = user_id);

-- 6. Function to get new listening candidates
drop function if exists public.get_new_listening_candidates;

create or replace function public.get_new_listening_candidates(
  p_limit integer default 10,
  p_skill text default 'listening'
)
returns table (
  id uuid,
  word text,
  proficiency integer,
  translation text
)
language plpgsql
security invoker
as $$
begin
  return query
  select 
    uw.id,
    uw.de as word,
    uw.proficiency,
    uw.cn as translation
  from 
    public.user_words uw
  where 
    uw.user_id = auth.uid()
    and uw.proficiency > 0 -- Only learned words
    and not exists (
      select 1 
      from public.user_word_skills uws 
      where uws.word_id = uw.id 
      and uws.user_id = auth.uid()
      and uws.skill = p_skill
    )
  order by 
    uw.proficiency desc -- Start with best known words
  limit p_limit;
end;
$$;
