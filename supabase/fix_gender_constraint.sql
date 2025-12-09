-- Fix gender constraint to allow 'm', 'f', 'n' codes
-- Run this in Supabase SQL Editor to resolve the "check constraint violated" error

-- 1. Drop the existing (possibly incorrect) constraint
ALTER TABLE public.user_words DROP CONSTRAINT IF EXISTS user_words_gender_check;

-- 2. Add the correct constraint that allows 'm', 'f', 'n' (and NULL)
ALTER TABLE public.user_words 
ADD CONSTRAINT user_words_gender_check 
CHECK (gender IS NULL OR gender IN ('m', 'f', 'n'));

-- 3. Clean up any legacy data that might use full articles instead of codes
-- (This helps if you have old data from before the fix)
UPDATE public.user_words SET gender = 'm' WHERE gender = 'der';
UPDATE public.user_words SET gender = 'f' WHERE gender = 'die';
UPDATE public.user_words SET gender = 'n' WHERE gender = 'das';
