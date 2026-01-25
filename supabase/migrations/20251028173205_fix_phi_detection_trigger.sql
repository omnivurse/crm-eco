/*
  # Fix PHI Detection Trigger

  ## Problem
  The enforce_no_phi() trigger is incorrectly checking for a 'body' field on tickets table,
  causing INSERT errors. The tickets table uses 'description' not 'body'.

  ## Fix
  Update the trigger logic to properly handle both tables without cross-referencing fields.
*/

CREATE OR REPLACE FUNCTION public.enforce_no_phi()
RETURNS TRIGGER AS $$
BEGIN
  -- Check ticket description field for PHI
  IF TG_TABLE_NAME = 'tickets' THEN
    IF NEW.description IS NOT NULL THEN
      IF NOT public.validate_free_text(NEW.description) THEN
        RAISE EXCEPTION 'PHI-like content detected in description. Please use secure forms for sensitive information.'
        USING ERRCODE = 'P0001',
        HINT = 'Remove Social Security Numbers, Medical Record Numbers, diagnoses, or dates of birth.';
      END IF;
    END IF;
    
    IF NEW.subject IS NOT NULL THEN
      IF NOT public.validate_free_text(NEW.subject) THEN
        RAISE EXCEPTION 'PHI-like content detected in subject. Please use secure forms for sensitive information.'
        USING ERRCODE = 'P0001',
        HINT = 'Remove Social Security Numbers, Medical Record Numbers, diagnoses, or dates of birth.';
      END IF;
    END IF;
  END IF;

  -- Check ticket comment body field for PHI
  IF TG_TABLE_NAME = 'ticket_comments' THEN
    IF NEW.body IS NOT NULL THEN
      IF NOT public.validate_free_text(NEW.body) THEN
        RAISE EXCEPTION 'PHI-like content detected in comment. Please use secure forms for sensitive information.'
        USING ERRCODE = 'P0001',
        HINT = 'Remove Social Security Numbers, Medical Record Numbers, diagnoses, or dates of birth.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;
