-- Fix ID column default value to generate UUIDs automatically
ALTER TABLE public.user_words ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Add missing columns if they don't exist (fixing FSRS error)
ALTER TABLE public.user_words ADD COLUMN IF NOT EXISTS fsrs jsonb;
ALTER TABLE public.user_words ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE public.user_words ADD COLUMN IF NOT EXISTS local_updated_at timestamptz DEFAULT now();

-- Ensure de_norm column exists for case-insensitive uniqueness
ALTER TABLE public.user_words ADD COLUMN IF NOT EXISTS de_norm text GENERATED ALWAYS AS (lower(de)) STORED;

-- Ensure unique index is correct (for upsert conflict resolution)
DROP INDEX IF EXISTS user_words_user_id_de_gender_key;
CREATE UNIQUE INDEX IF NOT EXISTS user_words_user_id_de_norm_key ON public.user_words (user_id, de_norm);

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'user_words';
