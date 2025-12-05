-- 1. Cleanup duplicates
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, de, gender
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

-- 2. Drop the old constraint (this will drop the index too usually)
ALTER TABLE public.user_words DROP CONSTRAINT IF EXISTS user_words_user_id_de_gender_key;
-- Drop index just in case it wasn't dropped by constraint
DROP INDEX IF EXISTS user_words_user_id_de_gender_key;

-- 3. Create new index with NULLS NOT DISTINCT
CREATE UNIQUE INDEX user_words_user_id_de_gender_key 
ON public.user_words (user_id, de, gender) 
NULLS NOT DISTINCT;

-- 4. Add constraint back
ALTER TABLE public.user_words 
ADD CONSTRAINT user_words_user_id_de_gender_key 
UNIQUE USING INDEX user_words_user_id_de_gender_key;
