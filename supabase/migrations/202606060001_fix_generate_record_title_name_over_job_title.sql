-- Fix: generate_record_title must derive PERSON-record titles from the name,
-- not from the `title` field (which is a JOB title, e.g. "Minister", for
-- contacts/leads/members). The trigger set_crm_record_title runs this on every
-- insert/update and was clobbering display names with the job title.
CREATE OR REPLACE FUNCTION public.generate_record_title(p_data jsonb) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
  v_first text := coalesce(nullif(p_data->>'preferred_name', ''), nullif(p_data->>'first_name', ''));
  v_last  text := nullif(p_data->>'last_name', '');
  v_name  text;
BEGIN
  -- Person records: name wins. preferred_name overrides first_name (matches app).
  IF v_first IS NOT NULL OR v_last IS NOT NULL THEN
    v_name := btrim(coalesce(v_first, '') || ' ' || coalesce(v_last, ''));
    IF v_name <> '' THEN
      RETURN v_name;
    END IF;
  END IF;

  -- Entity / fallback patterns (unchanged order).
  IF p_data->>'title' IS NOT NULL THEN
    RETURN p_data->>'title';
  ELSIF p_data->>'account_name' IS NOT NULL THEN
    RETURN p_data->>'account_name';
  ELSIF p_data->>'name' IS NOT NULL THEN
    RETURN p_data->>'name';
  ELSIF p_data->>'company' IS NOT NULL THEN
    RETURN p_data->>'company';
  ELSIF p_data->>'deal_name' IS NOT NULL THEN
    RETURN p_data->>'deal_name';
  ELSIF p_data->>'email' IS NOT NULL THEN
    RETURN p_data->>'email';
  ELSE
    RETURN 'Untitled';
  END IF;
END;
$$;

-- Backfill: re-derive titles for existing person records whose display title
-- was clobbered by the job title. Updating only `title` (not `data`) means the
-- trigger's `NEW.data IS DISTINCT FROM OLD.data` guard skips, so this stands.
UPDATE public.crm_records r
SET title = public.generate_record_title(r.data)
FROM public.crm_modules m
WHERE r.module_id = m.id
  AND m.key IN ('contacts', 'leads', 'members', 'prospects')
  AND r.title IS NOT DISTINCT FROM (r.data->>'title')
  AND (nullif(r.data->>'first_name', '') IS NOT NULL OR nullif(r.data->>'last_name', '') IS NOT NULL)
  AND r.title IS DISTINCT FROM public.generate_record_title(r.data);
