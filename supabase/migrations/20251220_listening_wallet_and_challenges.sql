-- Create listening_wallet table
create table if not exists public.listening_wallet (
  user_id uuid references auth.users(id) primary key,
  balance integer default 0,
  penalty_multiplier float default 1.0,
  updated_at timestamptz default now()
);

alter table public.listening_wallet enable row level security;

create policy "Users can view own wallet"
  on public.listening_wallet for select
  using (auth.uid() = user_id);

create policy "Users can update own wallet"
  on public.listening_wallet for update
  using (auth.uid() = user_id);

create policy "Users can insert own wallet"
  on public.listening_wallet for insert
  with check (auth.uid() = user_id);

-- Create listening_challenges table (Ephemeral sessions)
create table if not exists public.listening_challenges (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  status text check (status in ('pending', 'completed', 'failed')) default 'pending',
  audio_url text,
  transcript jsonb,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  completed_at timestamptz
);

alter table public.listening_challenges enable row level security;

create policy "Users can view own challenges"
  on public.listening_challenges for select
  using (auth.uid() = user_id);

create policy "Users can update own challenges"
  on public.listening_challenges for update
  using (auth.uid() = user_id);

create policy "Users can insert own challenges"
  on public.listening_challenges for insert
  with check (auth.uid() = user_id);

-- Create listening_materials table (Permanent library)
create table if not exists public.listening_materials (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  title text,
  audio_url text,
  transcript jsonb,
  duration integer, -- seconds
  created_at timestamptz default now()
);

alter table public.listening_materials enable row level security;

create policy "Users can view own materials"
  on public.listening_materials for select
  using (auth.uid() = user_id);

create policy "Users can insert own materials"
  on public.listening_materials for insert
  with check (auth.uid() = user_id);

-- RPC to handle "Start Challenge" (Deduct balance, create challenge)
create or replace function public.start_listening_challenge(
  p_cost integer,
  p_transcript jsonb,
  p_audio_url text
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_challenge_id uuid;
begin
  -- Check balance
  select balance into v_balance from public.listening_wallet where user_id = v_user_id;
  
  if v_balance is null or v_balance < p_cost then
    return jsonb_build_object('success', false, 'error', 'Insufficient balance');
  end if;

  -- Deduct balance
  update public.listening_wallet
  set balance = balance - p_cost, updated_at = now()
  where user_id = v_user_id;

  -- Create challenge
  insert into public.listening_challenges (user_id, status, transcript, audio_url, expires_at)
  values (v_user_id, 'pending', p_transcript, p_audio_url, now() + interval '24 hours')
  returning id into v_challenge_id;

  return jsonb_build_object('success', true, 'challenge_id', v_challenge_id);
end;
$$;

-- RPC to handle "Complete Challenge" (Archive to library, clear debuff)
create or replace function public.complete_listening_challenge(
  p_challenge_id uuid,
  p_title text,
  p_duration integer
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_challenge record;
begin
  -- Get challenge
  select * into v_challenge from public.listening_challenges 
  where id = p_challenge_id and user_id = v_user_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Challenge not found');
  end if;

  if v_challenge.status = 'completed' then
    return jsonb_build_object('success', false, 'error', 'Already completed');
  end if;

  -- Update challenge status
  update public.listening_challenges
  set status = 'completed', completed_at = now()
  where id = p_challenge_id;

  -- Add to library
  insert into public.listening_materials (user_id, title, audio_url, transcript, duration)
  values (v_user_id, p_title, v_challenge.audio_url, v_challenge.transcript, p_duration);

  -- Reset penalty multiplier (Clear Debuff)
  update public.listening_wallet
  set penalty_multiplier = 1.0, updated_at = now()
  where user_id = v_user_id;

  return jsonb_build_object('success', true);
end;
$$;

-- RPC to handle "Fail Challenge" (Apply Debuff)
create or replace function public.fail_listening_challenge(
  p_challenge_id uuid
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
begin
  -- Mark as failed
  update public.listening_challenges
  set status = 'failed'
  where id = p_challenge_id and user_id = v_user_id;

  -- Apply Debuff (0.5 multiplier)
  update public.listening_wallet
  set penalty_multiplier = 0.5, updated_at = now()
  where user_id = v_user_id;

  return jsonb_build_object('success', true);
end;
$$;
