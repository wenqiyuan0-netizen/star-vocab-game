-- Ensure UUID default for user_words.id
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.user_words
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Optional: ensure id is UUID and NOT NULL
-- ALTER TABLE public.user_words
-- ALTER COLUMN id SET NOT NULL;
