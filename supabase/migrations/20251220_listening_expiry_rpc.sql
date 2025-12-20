create or replace function check_listening_challenge_expiry()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_expired_count int;
begin
  -- Update pending challenges that have expired
  with expired as (
    update listening_challenges
    set status = 'failed'
    where user_id = v_user_id
    and status = 'pending'
    and expires_at < now()
    returning id
  )
  select count(*) into v_expired_count from expired;

  -- If any expired, apply penalty
  if v_expired_count > 0 then
    update listening_wallet
    set penalty_multiplier = 0.5
    where user_id = v_user_id;
  end if;

  return jsonb_build_object(
    'expired_count', v_expired_count,
    'penalty_applied', (v_expired_count > 0)
  );
end;
$$;
