-- Milestone 6: Username Security & Data Integrity Fixes
-- Run this in Supabase SQL Editor

-- 1. Ensure username is unique in profiles
-- We drop first to ensure idempotency (avoid "already exists" error)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);

-- 2. Create/Update the secure RPC function
-- Using standard single quotes to avoid dollar-quoting syntax issues in some clients
CREATE OR REPLACE FUNCTION check_username_exists(username_input text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS '
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE username = username_input
  );
END;
';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_username_exists(text) TO anon, authenticated;

-- 3. FIX: user_words gender constraint

-- 3a. Clean up existing invalid data FIRST
-- Convert full articles to codes
UPDATE public.user_words SET gender = 'm' WHERE lower(gender) IN ('der', 'maskulin');
UPDATE public.user_words SET gender = 'f' WHERE lower(gender) IN ('die', 'feminin');
UPDATE public.user_words SET gender = 'n' WHERE lower(gender) IN ('das', 'neutral');
-- Set anything else (including empty strings or other junk) to NULL
UPDATE public.user_words SET gender = NULL WHERE gender NOT IN ('m', 'f', 'n');

-- 3b. Drop old constraint to avoid conflicts
ALTER TABLE public.user_words DROP CONSTRAINT IF EXISTS user_words_gender_check;

-- 3c. Add new strict constraint (allows NULL, m, f, n)
ALTER TABLE public.user_words 
ADD CONSTRAINT user_words_gender_check 
CHECK (gender IS NULL OR gender IN ('m', 'f', 'n'));
