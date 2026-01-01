-- Fix user_words id column default value
-- This script ensures that the id column has a default value of gen_random_uuid()
-- and handles cases where it might have been dropped or altered incorrectly.

-- 1. Ensure pgcrypto extension is enabled (for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Alter the column to set the default value
ALTER TABLE public.user_words
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Verify the change (this will be output in the result)
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_words' AND column_name = 'id';
