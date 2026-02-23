-- Snip History panel: timestamp column + delete policy.
-- Run after supabase-snip-freemium.sql and supabase-pro-feature-gating.sql.

-- 1. created_at for ordering (if column missing)
ALTER TABLE public.snips_history
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Backfill existing rows that have NULL created_at (optional, run once)
-- UPDATE public.snips_history SET created_at = now() WHERE created_at IS NULL;

-- 2. Pro users can delete their own snips (SELECT already Pro-only)
DROP POLICY IF EXISTS "Users can delete own snips" ON public.snips_history;
CREATE POLICY "Pro users can delete own snips"
  ON public.snips_history FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND lower(tier) = 'pro'
    )
  );
