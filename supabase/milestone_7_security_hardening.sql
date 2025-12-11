-- Milestone 7: Security Hardening (Revised V2)
-- Run this in Supabase SQL Editor

-- 0. Ensure columns exist (Fixing missing column error)
-- We check and add columns one by one to avoid errors if some exist
DO $$
BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS check_in_dates TEXT[] DEFAULT '{}';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_stats JSONB DEFAULT '{}';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_plan JSONB DEFAULT '{}';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_xp INT DEFAULT 0;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level INT DEFAULT 1;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'Column already exists, ignoring.';
END
$$;

-- 1. Security: Restrict column updates
-- By default, Supabase grants ALL on tables to authenticated. We need to restrict this.

-- Revoke all updates first
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;

-- Grant update only on safe columns
-- Note: This requires the columns to exist (which we ensured above)
GRANT UPDATE (username, avatar_url, settings, check_in_dates, daily_stats, daily_plan, updated_at) 
ON public.profiles TO authenticated;

-- 2. Create Secure RPC for XP/Level updates
-- This function runs with SECURITY DEFINER, meaning it bypasses the above restrictions
CREATE OR REPLACE FUNCTION add_xp(xp_amount int, new_level int DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_xp int;
  current_level int;
  final_level int;
BEGIN
  -- 1. Validate input (Anti-cheat)
  IF xp_amount < 0 THEN
    RAISE EXCEPTION 'XP amount cannot be negative';
  END IF;
  
  IF xp_amount > 2000 THEN
    RAISE EXCEPTION 'XP amount too high for single transaction';
  END IF;

  -- 2. Get current state
  SELECT total_xp, level INTO current_xp, current_level
  FROM profiles
  WHERE id = auth.uid();

  -- 3. Determine new level
  -- If frontend provided a level, check it against constraints
  IF new_level IS NOT NULL THEN
    IF new_level > current_level + 1 THEN
       -- Prevent skipping levels (e.g. 1 -> 10)
       -- We silently clamp it or error? Let's error to warn devs/hackers.
       RAISE EXCEPTION 'Invalid level jump';
    END IF;
    IF new_level < current_level THEN
       -- Prevent downgrading
       final_level := current_level;
    ELSE
       final_level := new_level;
    END IF;
  ELSE
    final_level := current_level;
  END IF;

  -- 4. Perform Update
  UPDATE profiles 
  SET total_xp = total_xp + xp_amount,
      level = final_level,
      updated_at = now()
  WHERE id = auth.uid();
  
  RETURN jsonb_build_object(
    'level', final_level, 
    'total_xp', current_xp + xp_amount
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION add_xp(int, int) TO authenticated;
