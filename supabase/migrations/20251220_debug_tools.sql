-- DEBUG TOOLS for Listening Mode
-- Usage: Call these RPCs from the frontend to test the game flow.

-- 1. Add Balance
create or replace function debug_add_balance(
  p_amount integer
)
returns integer
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_new_balance integer;
begin
  insert into public.listening_wallet (user_id, balance)
  values (v_user_id, 0)
  on conflict (user_id) do nothing;

  update public.listening_wallet
  set balance = balance + p_amount
  where user_id = v_user_id
  returning balance into v_new_balance;

  return v_new_balance;
end;
$$;

-- 2. Force Expire Current Challenge
create or replace function debug_force_expire_challenge()
returns boolean
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
begin
  update public.listening_challenges
  set expires_at = now() - interval '1 minute'
  where user_id = v_user_id
  and status = 'pending';
  
  return found;
end;
$$;

-- 3. Reset Penalty
create or replace function debug_reset_penalty()
returns boolean
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
begin
  update public.listening_wallet
  set penalty_multiplier = 1.0
  where user_id = v_user_id;
  
  return true;
end;
$$;
