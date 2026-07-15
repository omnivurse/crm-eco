-- Re-assert Gender picklist = Male / Female only (Leads / Contacts / Members).
--
-- 202607140015 already does this; this migration is a second pass for
-- environments that still show Other / Prefer not to say on Lead Gender
-- (migration lag, or a later seed that widened options again). Idempotent.
--
-- OPTIONS-ONLY — does not rewrite stored gender values on records.

SET lock_timeout = '5s';

DO $$
DECLARE
  v_updated bigint;
BEGIN
  UPDATE crm_fields
     SET options = '["Male","Female"]'::jsonb
   WHERE (
           key = 'gender'
        OR key = 'primary_member_gender'
        OR key LIKE '%\_gender' ESCAPE '\'
        OR lower(label) = 'gender'
       )
     AND options IS DISTINCT FROM '["Male","Female"]'::jsonb;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Gender options re-asserted Male/Female on % crm_fields row(s)', v_updated;
END $$;
