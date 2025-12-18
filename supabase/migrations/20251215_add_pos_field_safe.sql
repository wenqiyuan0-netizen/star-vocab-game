-- ============================================
-- Migration: Add pos field (Safe Version)
-- Date: 2025-12-15
-- Description:
--   1. Add 'pos' (part of speech) column
--   2. Fill default values for existing data
--   3. Add indexes for optimization
--   4. NOTE: ID type remains UUID for now (safer approach)
-- ============================================

-- Step 1: Add pos column
ALTER TABLE public.user_words
ADD COLUMN IF NOT EXISTS pos text;

-- Step 2: Fill default values for existing data
-- Infer pos from gender: if gender exists (m/f/n), it's a noun
UPDATE public.user_words
SET pos = CASE
  WHEN gender IN ('m', 'f', 'n') THEN 'noun'
  ELSE 'unknown'
END
WHERE pos IS NULL;

-- Step 3: Add index for pos column to improve query performance
CREATE INDEX IF NOT EXISTS idx_user_words_pos
ON public.user_words(pos);

-- Step 4: Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_user_words_user_pos
ON public.user_words(user_id, pos);

-- Step 5: Add comments for documentation
COMMENT ON COLUMN public.user_words.pos IS 'Part of speech: noun, verb, adj, adv, conj, prep, etc. Used with word to generate stable ID.';

-- Step 6: Verify the migration
DO $$
DECLARE
  pos_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_words'
      AND column_name = 'pos'
  ) INTO pos_exists;

  IF pos_exists THEN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE 'pos column added to user_words table';
    RAISE NOTICE 'Run the following to verify:';
    RAISE NOTICE 'SELECT id, de, pos, gender FROM public.user_words LIMIT 5;';
  ELSE
    RAISE EXCEPTION '❌ Migration failed: pos column not found';
  END IF;
END $$;
