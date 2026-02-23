-- RLS for connected_docs. Table already exists with columns:
-- id, user_id (FK), google_doc_id, doc_title, last_accessed_at
-- Run in Supabase SQL Editor.

CREATE INDEX IF NOT EXISTS idx_connected_docs_user_id ON public.connected_docs (user_id);

ALTER TABLE public.connected_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own connected_docs" ON public.connected_docs;
CREATE POLICY "Users can read own connected_docs"
  ON public.connected_docs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own connected_docs" ON public.connected_docs;
CREATE POLICY "Users can insert own connected_docs"
  ON public.connected_docs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own connected_docs" ON public.connected_docs;
CREATE POLICY "Users can update own connected_docs"
  ON public.connected_docs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own connected_docs" ON public.connected_docs;
CREATE POLICY "Users can delete own connected_docs"
  ON public.connected_docs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
