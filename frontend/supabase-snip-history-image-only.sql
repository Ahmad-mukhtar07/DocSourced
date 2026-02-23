-- Snip History: image-only storage with metadata. Run after supabase-snip-freemium and supabase-snip-history-panel.

-- 1. Add columns for image snippet metadata (keep existing for backward compat)
ALTER TABLE public.snips_history ADD COLUMN IF NOT EXISTS page_title text;
ALTER TABLE public.snips_history ADD COLUMN IF NOT EXISTS domain text;
ALTER TABLE public.snips_history ADD COLUMN IF NOT EXISTS snippet_type text;
ALTER TABLE public.snips_history ADD COLUMN IF NOT EXISTS drive_url text;

-- Make content nullable so image rows don't require it
ALTER TABLE public.snips_history ALTER COLUMN content DROP NOT NULL;

-- 2. RPC: record IMAGE snip only — inserts into snips_history with new metadata and enforces limit.
-- source_url = page URL (window.location.href), drive_url = uploaded image URL, created_at = default now().
CREATE OR REPLACE FUNCTION public.record_image_snip_and_check_limit(
  p_source_url text DEFAULT '',
  p_page_title text DEFAULT '',
  p_domain text DEFAULT '',
  p_drive_url text DEFAULT '',
  p_target_doc_id text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_tier text;
  v_period text;
  v_count int;
  v_limit int := 25;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT tier INTO v_tier FROM public.profiles WHERE id = v_uid;
  v_tier := COALESCE(v_tier, 'free');

  IF v_tier = 'free' THEN
    v_period := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
    SELECT COALESCE(snip_count, 0) INTO v_count
      FROM public.user_usage
      WHERE user_id = v_uid AND period = v_period;
    v_count := COALESCE(v_count, 0);
    IF v_count >= v_limit THEN
      RETURN jsonb_build_object('error', 'snip_limit_reached', 'limit', v_limit);
    END IF;
  END IF;

  INSERT INTO public.snips_history (
    user_id,
    source_url,
    page_title,
    domain,
    snippet_type,
    drive_url,
    target_doc_id
  )
  VALUES (
    v_uid,
    left(p_source_url, 2048),
    left(p_page_title, 1024),
    left(p_domain, 512),
    'image',
    left(p_drive_url, 2048),
    left(p_target_doc_id, 256)
  );

  v_period := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  INSERT INTO public.user_usage (user_id, period, snip_count)
  VALUES (v_uid, v_period, 1)
  ON CONFLICT (user_id, period)
  DO UPDATE SET snip_count = public.user_usage.snip_count + 1;

  RETURN jsonb_build_object('success', true);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'record_snip_failed', 'message', SQLERRM);
END;
$$;

-- 3. Existing RPC: only enforce limit and increment usage; do NOT insert into snips_history (text plugs).
CREATE OR REPLACE FUNCTION public.record_snip_and_check_limit(
  p_content text DEFAULT '',
  p_source_url text DEFAULT '',
  p_target_doc_id text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_tier text;
  v_period text;
  v_count int;
  v_limit int := 25;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT tier INTO v_tier FROM public.profiles WHERE id = v_uid;
  v_tier := COALESCE(v_tier, 'free');

  IF v_tier = 'free' THEN
    v_period := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
    SELECT COALESCE(snip_count, 0) INTO v_count
      FROM public.user_usage
      WHERE user_id = v_uid AND period = v_period;
    v_count := COALESCE(v_count, 0);
    IF v_count >= v_limit THEN
      RETURN jsonb_build_object('error', 'snip_limit_reached', 'limit', v_limit);
    END IF;
  END IF;

  -- Text snippets: count toward limit but do not store in snips_history
  v_period := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  INSERT INTO public.user_usage (user_id, period, snip_count)
  VALUES (v_uid, v_period, 1)
  ON CONFLICT (user_id, period)
  DO UPDATE SET snip_count = public.user_usage.snip_count + 1;

  RETURN jsonb_build_object('success', true);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'record_snip_failed', 'message', SQLERRM);
END;
$$;
