-- =============================================
-- ROAT DICTIONARY — Supabase SQL Schema
-- Run this in the Supabase SQL Editor
-- =============================================

-- 1. Create the "words" table with all dictionary fields
CREATE TABLE IF NOT EXISTS public.words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL,
  part_of_speech TEXT NOT NULL,
  phonetic TEXT,
  syllables TEXT,
  definition TEXT NOT NULL,
  example TEXT,
  etymology TEXT,
  synonyms TEXT,
  antonyms TEXT,
  tags TEXT,
  audio_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create an index on the word column for fast lookups
CREATE INDEX IF NOT EXISTS idx_words_word ON public.words(word);
CREATE INDEX IF NOT EXISTS idx_words_created_at ON public.words(created_at DESC);

-- 3. Enable Row Level Security
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: ANYONE can READ words (even non-logged-in users)
CREATE POLICY "Anyone can read words"
  ON public.words
  FOR SELECT
  USING (true);

-- 5. RLS Policy: Only @roat users can INSERT words
--    This checks that the user's email domain starts with "roat"
--    e.g. user@roat.com, user@roat.net, etc.
CREATE POLICY "Only roat users can insert words"
  ON public.words
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Email domain starts with 'roat' (e.g. @roat.com, @roat.net)
      split_part(auth.jwt()->>'email', '@', 2) LIKE 'roat%'
    )
  );

-- 6. RLS Policy: Only @roat users can UPDATE their own words
CREATE POLICY "Only roat users can update words"
  ON public.words
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND split_part(auth.jwt()->>'email', '@', 2) LIKE 'roat%'
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND split_part(auth.jwt()->>'email', '@', 2) LIKE 'roat%'
  );

-- 7. RLS Policy: Only @roat users can DELETE their own words
CREATE POLICY "Only roat users can delete words"
  ON public.words
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND split_part(auth.jwt()->>'email', '@', 2) LIKE 'roat%'
  );

-- 8. Create a storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true)
ON CONFLICT (id) DO NOTHING;

-- 9. Storage Policy: Anyone can read audio files
CREATE POLICY "Anyone can read audio"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'audio');

-- 10. Storage Policy: Only @roat users can upload audio
CREATE POLICY "Only roat users can upload audio"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'audio'
    AND auth.uid() IS NOT NULL
    AND split_part(auth.jwt()->>'email', '@', 2) LIKE 'roat%'
  );

-- 11. Function to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Trigger to auto-update updated_at on word changes
DROP TRIGGER IF EXISTS update_words_updated_at ON public.words;
CREATE TRIGGER update_words_updated_at
  BEFORE UPDATE ON public.words
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
