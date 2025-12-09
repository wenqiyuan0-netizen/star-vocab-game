-- 1. Cleanup duplicates
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, lower(de)
      ORDER BY 
        COALESCE(proficiency, 0) DESC, 
        COALESCE(step, 0) DESC, 
        updated_at DESC
    ) as rn
  FROM user_words
)
DELETE FROM user_words
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 2. Add normalized column for case-insensitive uniqueness
ALTER TABLE public.user_words 
  ADD COLUMN IF NOT EXISTS de_norm text GENERATED ALWAYS AS (lower(de)) STORED;

-- 3. Drop the old constraint and index
ALTER TABLE public.user_words DROP CONSTRAINT IF EXISTS user_words_user_id_de_gender_key;
DROP INDEX IF EXISTS user_words_user_id_de_gender_key;

-- 4. Create new unique index on normalized column
CREATE UNIQUE INDEX IF NOT EXISTS user_words_user_id_de_norm_key 
ON public.user_words (user_id, de_norm);

-- 5. Add constraint alias using the new index (optional)
ALTER TABLE public.user_words 
ADD CONSTRAINT user_words_user_id_de_norm_key 
UNIQUE USING INDEX user_words_user_id_de_norm_key;
