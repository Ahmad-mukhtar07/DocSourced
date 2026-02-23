-- Pro feature gating: doc limit (free = 1), snip history (Pro only).
-- Run in Supabase SQL Editor after supabase-connected-docs.sql and supabase-snip-freemium.sql.

-- 1. RPC: Add connected doc with tier-based limit. Free = max 1 doc; Pro = unlimited.
-- Returns { success: true, id, google_doc_id, doc_title } or { error: "doc_limit_reached" } or { error: "not_authenticated" }.
CREATE OR REPLACE FUNCTION public.add_connected_doc(p_google_doc_id text, p_doc_title text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_tier text;
  v_count int;
  v_row public.connected_docs%ROWTYPE;
  v_title text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  v_title := COALESCE(trim(p_doc_title), 'Untitled');
  IF trim(p_google_doc_id) = '' THEN
    RETURN jsonb_build_object('error', 'invalid_doc_id');
  END IF;

  SELECT tier INTO v_tier FROM public.profiles WHERE id = v_uid;
  v_tier := COALESCE(v_tier, 'free');

  -- If this doc is already connected for this user, update and return it (does not count toward limit).
  SELECT * INTO v_row FROM public.connected_docs
    WHERE user_id = v_uid AND google_doc_id = trim(p_google_doc_id)
    LIMIT 1;
  IF FOUND THEN
    UPDATE public.connected_docs
      SET last_accessed_at = now(), doc_title = v_title
      WHERE id = v_row.id;
    RETURN jsonb_build_object(
      'success', true,
      'id', v_row.id,
      'google_doc_id', v_row.google_doc_id,
      'doc_title', v_title
    );
  END IF;

  IF v_tier = 'free' THEN
    SELECT count(*) INTO v_count FROM public.connected_docs WHERE user_id = v_uid;
    IF v_count >= 1 THEN
      RETURN jsonb_build_object('error', 'doc_limit_reached');
    END IF;
  END IF;

  INSERT INTO public.connected_docs (user_id, google_doc_id, doc_title, last_accessed_at)
  VALUES (v_uid, trim(p_google_doc_id), v_title, now())
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_row.id,
    'google_doc_id', v_row.google_doc_id,
    'doc_title', v_row.doc_title
  );
END;
$$;

-- 2. snips_history: allow SELECT only for Pro users (free users cannot read history).
DROP POLICY IF EXISTS "Users can read own snips" ON public.snips_history;
CREATE POLICY "Pro users can read own snips"
  ON public.snips_history FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND lower(tier) = 'pro'
    )
  );

-- 3. On downgrade to free: disconnect excess documents (keep only the most recently accessed).
CREATE OR REPLACE FUNCTION public.enforce_free_doc_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(COALESCE(NEW.tier, 'free')) = 'free' THEN
    DELETE FROM public.connected_docs
    WHERE user_id = NEW.id
    AND id NOT IN (
      SELECT id FROM public.connected_docs
      WHERE user_id = NEW.id
      ORDER BY last_accessed_at DESC NULLS LAST
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_free_doc_limit_trigger ON public.profiles;
CREATE TRIGGER enforce_free_doc_limit_trigger
  AFTER UPDATE OF tier ON public.profiles
  FOR EACH ROW
  WHEN (OLD.tier IS DISTINCT FROM NEW.tier)
  EXECUTE FUNCTION public.enforce_free_doc_limit();
