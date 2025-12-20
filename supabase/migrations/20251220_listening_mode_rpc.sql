-- Function to submit listening review result and update SRS state
-- This function handles the core SRS logic on the backend, ensuring data integrity.

create or replace function public.submit_listening_review(
  p_word_id uuid,
  p_rating integer, -- 1: Again, 2: Hard, 3: Good, 4: Easy
  p_skill text default 'listening',
  p_time_spent integer default 0, -- seconds spent on this word
  p_chars_earned integer default 0 -- Chars earned in this gamble
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_record record;
  v_new_interval integer;
  v_new_proficiency integer;
  v_next_review timestamptz;
  v_fsrs jsonb;
  v_ease_factor float;
  v_interval float;
  v_state text;
  v_is_new boolean := false;
  v_existing_id uuid;
  v_new_balance integer;
begin
  -- 1. Check if record exists
  select id, fsrs, proficiency, state, interval into v_record 
  from public.user_word_skills 
  where user_id = v_user_id and word_id = p_word_id and skill = p_skill;
  
  if not found then
    v_is_new := true;
    -- Create initial record
    insert into public.user_word_skills (user_id, word_id, skill, state, created_at)
    values (v_user_id, p_word_id, p_skill, 'learning', now())
    returning id, fsrs, proficiency, state, interval into v_record;
  end if;

  -- 2. Calculate SRS (Simplified SM-2 for SQL)
  -- Robust implementation to run on backend
  v_fsrs := coalesce(v_record.fsrs, '{"ease": 2.5, "interval": 0}'::jsonb);
  v_ease_factor := coalesce((v_fsrs->>'ease')::float, 2.5);
  v_interval := coalesce((v_fsrs->>'interval')::float, 0);
  v_state := v_record.state;
  v_new_proficiency := coalesce(v_record.proficiency, 0);

  if p_rating = 1 then -- Again (Forget)
    v_new_interval := 1;
    v_ease_factor := greatest(1.3, v_ease_factor - 0.2);
    v_new_proficiency := greatest(0, v_new_proficiency - 20); -- Decrease proficiency
    v_state := 'learning';
  else
    -- Standard SM-2 interval calculation logic
    if v_interval <= 0 then v_interval := 1;
    elseif v_interval = 1 then v_interval := 6;
    else v_interval := v_interval * v_ease_factor;
    end if;
    
    -- Adjust ease
    if p_rating = 2 then -- Hard
      v_ease_factor := greatest(1.3, v_ease_factor - 0.15);
    elseif p_rating = 4 then -- Easy
      v_ease_factor := v_ease_factor + 0.15;
    end if;
    
    v_new_interval := ceil(v_interval);
    
    -- Proficiency (0-100)
    v_new_proficiency := least(100, v_new_proficiency + (p_rating * 5)); 
    
    if v_new_interval > 21 then
       v_state := 'review';
    end if;
  end if;

  v_next_review := now() + (v_new_interval || ' days')::interval;

  -- 3. Update user_word_skills
  update public.user_word_skills
  set 
    interval = v_new_interval,
    fsrs = jsonb_build_object('ease', v_ease_factor, 'interval', v_new_interval),
    proficiency = v_new_proficiency,
    last_review = now(),
    due_date = v_next_review,
    state = v_state,
    last_seen_at = now(), -- Update cooldown
    updated_at = now()
  where id = v_record.id;
  
  -- 4. Update Daily Stats (user_daily_plans)
  -- Ensure plan exists for today
  insert into public.user_daily_plans (user_id, date, mode)
  values (v_user_id, current_date, p_skill)
  on conflict (user_id, date, mode) do nothing;
  
  -- Increment stats
  -- Note: We use a simple logic: if it was just created (v_is_new), it counts as new.
  -- Otherwise it counts as review.
  update public.user_daily_plans
  set 
    time_spent_seconds = time_spent_seconds + p_time_spent,
    completed_new_count = completed_new_count + (case when v_is_new then 1 else 0 end),
    completed_review_count = completed_review_count + (case when not v_is_new then 1 else 0 end),
    updated_at = now()
  where user_id = v_user_id and date = current_date and mode = p_skill;

  -- 5. Update Wallet (New!)
  if p_chars_earned > 0 then
    -- Ensure wallet exists
    insert into public.listening_wallet (user_id, balance)
    values (v_user_id, 0)
    on conflict (user_id) do nothing;

    update public.listening_wallet
    set balance = balance + p_chars_earned, updated_at = now()
    where user_id = v_user_id
    returning balance into v_new_balance;
  else
    select balance into v_new_balance from public.listening_wallet where user_id = v_user_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'interval', v_new_interval,
    'due_date', v_next_review,
    'state', v_state,
    'proficiency', v_new_proficiency,
    'new_balance', v_new_balance
  );
end;
$$;
