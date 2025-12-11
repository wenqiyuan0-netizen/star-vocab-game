-- Milestone 8: Cloud Dictionary Security Hardening (Revised)
-- Run this script in the Supabase SQL Editor

-- 0. Ensure Extension Exists (Required for search index)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Create Table (If it doesn't exist)
CREATE TABLE IF NOT EXISTS public.cloud_dictionary (
  word TEXT NOT NULL,
  pos TEXT NOT NULL,
  data JSONB NOT NULL,
  has_translation BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (word, pos)
);

-- 2. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_cloud_dict_translation 
  ON public.cloud_dictionary(has_translation);

CREATE INDEX IF NOT EXISTS idx_cloud_dict_updated 
  ON public.cloud_dictionary(updated_at);

CREATE INDEX IF NOT EXISTS idx_cloud_dict_word_gin
  ON public.cloud_dictionary USING gin(word gin_trgm_ops);

-- 3. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_cloud_dictionary_updated_at ON public.cloud_dictionary;
CREATE TRIGGER update_cloud_dictionary_updated_at 
  BEFORE UPDATE ON public.cloud_dictionary
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Enable RLS on cloud_dictionary
ALTER TABLE public.cloud_dictionary ENABLE ROW LEVEL SECURITY;

-- 5. Clean up old policies (if any exist)
DROP POLICY IF EXISTS "Allow public read access" ON public.cloud_dictionary;
DROP POLICY IF EXISTS "Allow public insert" ON public.cloud_dictionary;
DROP POLICY IF EXISTS "Allow public update" ON public.cloud_dictionary;
DROP POLICY IF EXISTS "Allow public delete" ON public.cloud_dictionary;

-- 6. Allow Read Access for everyone (Anon and Authenticated)
CREATE POLICY "Allow public read access"
ON public.cloud_dictionary
FOR SELECT
USING (true);

-- 7. Restrict Write Access
-- We intentionally do NOT create policies for INSERT/UPDATE/DELETE.
-- This restricts write access to the 'service_role' (Server-Side) only.
