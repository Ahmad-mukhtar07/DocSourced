-- Snip limit applies only to "Snip and Plug" (screenshots), not "Plug it in" (text).
-- Run after supabase-snip-history-text-storage.sql (or whichever defines record_snip_and_check_limit with 5 params).
--
-- record_snip_and_check_limit is used by "Plug it in" (text). It must:
-- - Still insert text into snips_history when content is non-empty (for Format References / history).
-- - NOT check user_usage limit and NOT increment user_usage (so text plugs are unlimited).
-- Snip limit is enforced only in record_image_snip_and_check_limit ("Snip and Plug").

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
  v_content_trim text;
  v_domain text;
  v_snip_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Derive domain from URL if not provided
  v_content_trim := trim(p_content);
  v_domain := nullif(trim(p_domain), '');
  IF v_domain IS NULL AND trim(p_source_url) <> '' THEN
    v_domain := regexp_replace(
      split_part(split_part(trim(p_source_url), '//', 2), '/', 1),
      '^www\.', ''
    );
  END IF;

  -- Insert text row into snips_history when content is non-empty (for sources / Format References).
  -- Do NOT check or increment user_usage — limit applies only to "Snip and Plug" (images).
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

  RETURN jsonb_build_object('success', true, 'snip_id', v_snip_id);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'record_snip_failed', 'message', SQLERRM);
END;
$$;
