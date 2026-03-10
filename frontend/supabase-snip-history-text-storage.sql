-- Store text snippets in snips_history when user plugs text. Run after supabase-snip-history-image-only.sql.

-- record_snip_and_check_limit: when p_content is non-empty, insert a text row (content trimmed to 500 chars,
-- source_url, page_title, domain, snippet_type='text', target_doc_id; drive_url null). Then increment usage.
-- When p_content is empty, only increment usage (no insert). Domain derived from p_source_url if p_domain empty.
CREATE OR REPLACE FUNCTION public.record_snip_and_check_limit(
  p_content text DEFAULT '',
  p_source_url text DEFAULT '',
  p_target_doc_id text DEFAULT '',
  p_page_title text DEFAULT '',
  p_domain text DEFAULT ''
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
  v_limit int := 15;
  v_content_trim text;
  v_domain text;
  v_snip_id uuid;
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

  v_content_trim := trim(p_content);
  v_domain := nullif(trim(p_domain), '');
  IF v_domain IS NULL AND trim(p_source_url) <> '' THEN
    v_domain := regexp_replace(
      split_part(split_part(trim(p_source_url), '//', 2), '/', 1),
      '^www\.', ''
    );
  END IF;

  IF length(v_content_trim) > 0 THEN
    INSERT INTO public.snips_history (
      user_id,
      content,
      source_url,
      page_title,
      domain,
      snippet_type,
      target_doc_id,
      drive_url
    )
    VALUES (
      v_uid,
      left(v_content_trim, 500),
      left(trim(p_source_url), 2048),
      left(trim(p_page_title), 1024),
      left(v_domain, 512),
      'text',
      left(trim(p_target_doc_id), 256),
      NULL
    )
    RETURNING id INTO v_snip_id;
  END IF;

  v_period := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  INSERT INTO public.user_usage (user_id, period, snip_count)
  VALUES (v_uid, v_period, 1)
  ON CONFLICT (user_id, period)
  DO UPDATE SET snip_count = public.user_usage.snip_count + 1;

  RETURN jsonb_build_object('success', true, 'snip_id', v_snip_id);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'record_snip_failed', 'message', SQLERRM);
END;
$$;
