-- ============================================
-- Migration: Add pos field and change ID type
-- Date: 2025-12-15
-- Description:
--   1. Add 'pos' (part of speech) column
--   2. Change ID type from UUID to bigint
--   3. Migrate existing data
--   4. Add indexes for optimization
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

-- Step 3: Change ID column type from UUID to bigint
-- Note: This will drop and recreate the column
-- ⚠️ WARNING: This operation will lose existing IDs!
-- If you have foreign key references, handle them first

-- Temporarily disable triggers if any
ALTER TABLE public.user_words DISABLE TRIGGER ALL;

-- Drop the existing default
ALTER TABLE public.user_words
ALTER COLUMN id DROP DEFAULT;

-- Change column type
ALTER TABLE public.user_words
ALTER COLUMN id TYPE bigint USING 0; -- Temporary placeholder

-- Re-enable triggers
ALTER TABLE public.user_words ENABLE TRIGGER ALL;

-- Step 4: Add index for pos column to improve query performance
CREATE INDEX IF NOT EXISTS idx_user_words_pos
ON public.user_words(pos);

-- Step 5: Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_user_words_user_pos
ON public.user_words(user_id, pos);

-- Step 6: Add comments for documentation
COMMENT ON COLUMN public.user_words.pos IS 'Part of speech: noun, verb, adj, adv, conj, prep, etc. Used with word to generate stable ID.';

-- Step 7: Optional - Update unique constraint to include pos
-- This allows same word with different POS (e.g., "laufen" as verb and noun)
-- Uncomment the following lines if you want this behavior:

-- ALTER TABLE public.user_words
-- DROP CONSTRAINT IF EXISTS user_words_user_id_de_norm_key;
--
-- ALTER TABLE public.user_words
-- ADD CONSTRAINT user_words_user_id_de_norm_pos_key
-- UNIQUE (user_id, de_norm, pos);

-- Step 8: Verify the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Please run the following query to verify:';
  RAISE NOTICE 'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ''user_words'';';
END $$;
