-- Milestone 5: Add Soft Delete Support
-- Run this script in the Supabase SQL Editor

-- 1. Add is_deleted and local_updated_at columns to user_words
ALTER TABLE public.user_words 
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS local_updated_at timestamptz DEFAULT now();

-- 2. Update existing rows to have a default local_updated_at (same as updated_at)
UPDATE public.user_words 
SET local_updated_at = updated_at 
WHERE local_updated_at IS NULL;

-- 3. (Optional but recommended) Create an index on is_deleted for faster filtering
CREATE INDEX IF NOT EXISTS idx_user_words_is_deleted ON public.user_words(is_deleted);
