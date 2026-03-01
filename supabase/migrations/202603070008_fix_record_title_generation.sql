-- Fix generate_record_title to recognize account_name and other common title fields
-- Also fix set_record_title trigger to regenerate title when data changes

CREATE OR REPLACE FUNCTION generate_record_title(p_data jsonb)
RETURNS text AS $$
BEGIN
  -- Try common title patterns
  IF p_data->>'title' IS NOT NULL THEN
    RETURN p_data->>'title';
  ELSIF p_data->>'account_name' IS NOT NULL THEN
    RETURN p_data->>'account_name';
  ELSIF p_data->>'name' IS NOT NULL THEN
    RETURN p_data->>'name';
  ELSIF p_data->>'first_name' IS NOT NULL OR p_data->>'last_name' IS NOT NULL THEN
    RETURN trim(coalesce(p_data->>'first_name', '') || ' ' || coalesce(p_data->>'last_name', ''));
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fix trigger: regenerate title when data changes (not just when title is NULL)
CREATE OR REPLACE FUNCTION set_record_title()
RETURNS TRIGGER AS $$
BEGIN
  -- Regenerate title from data on INSERT, or on UPDATE when data changed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.data IS DISTINCT FROM OLD.data) THEN
    NEW.title := generate_record_title(NEW.data);
  END IF;

  -- Also extract email and phone if present
  IF NEW.email IS NULL AND NEW.data->>'email' IS NOT NULL THEN
    NEW.email := NEW.data->>'email';
  END IF;

  IF NEW.phone IS NULL THEN
    NEW.phone := coalesce(NEW.data->>'phone', NEW.data->>'mobile');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill: fix existing records stuck with 'Untitled'
UPDATE crm_records
SET title = generate_record_title(data)
WHERE title = 'Untitled' OR title IS NULL;
