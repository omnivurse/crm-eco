-- ============================================================================
-- check_crm_duplicate: compare phones by DIGITS + make Contacts.email optional
-- ============================================================================
-- Context (create-form-safety cluster, 2026-08-17)
--
--   1. `check_crm_duplicate(...)` compared `r.phone = p_phone` as raw strings.
--      Prod (PIFH) stores 7,801 phones as "3035551212", 5,549 as
--      "303-555-1212", 1,761 as "(303) 555-1212", plus dotted / spaced / +1
--      variants, so a rep typing "(303) 555-1212" never matched "3035551212"
--      and the pre-insert duplicate warning silently missed. This re-emits the
--      function with the ONLY change being the phone predicate: both sides are
--      reduced to digits (a leading US "1" on the probe is tolerated). The
--      signature, return columns, STABLE/SECURITY DEFINER/search_path, the
--      email (case-insensitive) match, the "phone only when no email" fallback,
--      the deleted_at filter, the exclude-id and LIMIT 5 are byte-for-byte the
--      same as the live definition (last set by 202607140012). CREATE OR
--      REPLACE preserves grants (202606130008 revoked anon EXECUTE).
--      The digits expression matches the existing expression index
--      idx_crm_records_phone_digits
--        (regexp_replace(COALESCE(phone,''),'\D','','g')
--         WHERE phone IS NOT NULL AND phone <> '')
--      so this stays an index lookup, not a scan.
--
--   2. Contacts required only first_name, last_name, email — members who have
--      no email address could not be entered at all. This flips ONE
--      configuration row to required=false:
--        crm_fields.id = 1bbe0ec4-78ce-4883-8b6f-9fc188ef7cdc
--        (org 00000000-0000-0000-0000-000000000001, module contacts
--         f9869598-18f2-4277-94a0-255ba9044cb9, key 'email')
--      No record data is touched. The create service never required email
--      separately (it only uses email for the duplicate pre-check).
--
-- Additive + reversible. NOT auto-pushed — lead rehearses in a rolled-back txn.
--
-- ROLLBACK ---------------------------------------------------------------------
--   UPDATE public.crm_fields SET required = true
--    WHERE id = '1bbe0ec4-78ce-4883-8b6f-9fc188ef7cdc' AND key = 'email';
--
--   CREATE OR REPLACE FUNCTION public.check_crm_duplicate(p_org_id uuid, p_module_id uuid, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_exclude_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, title text, email text, phone text, status text, created_at timestamp with time zone)
--       LANGUAGE plpgsql STABLE SECURITY DEFINER
--       SET search_path TO 'public'
--       AS $$
--   BEGIN
--     RETURN QUERY
--     SELECT r.id, r.title, r.email, r.phone, r.status, r.created_at
--     FROM crm_records r
--     WHERE r.organization_id = p_org_id
--       AND r.module_id = p_module_id
--       AND r.deleted_at IS NULL
--       AND (p_exclude_id IS NULL OR r.id != p_exclude_id)
--       AND (
--         -- Primary: match by email (case-insensitive)
--         (p_email IS NOT NULL AND p_email != '' AND LOWER(r.email) = LOWER(p_email))
--         OR
--         -- Fallback: match by phone only when no email provided
--         (
--           (p_email IS NULL OR p_email = '')
--           AND p_phone IS NOT NULL AND p_phone != ''
--           AND r.phone = p_phone
--         )
--       )
--     LIMIT 5;
--   END;
--   $$;
-- ------------------------------------------------------------------------------

-- 1) check_crm_duplicate — digits-based phone comparison ----------------------
CREATE OR REPLACE FUNCTION public.check_crm_duplicate(p_org_id uuid, p_module_id uuid, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_exclude_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, title text, email text, phone text, status text, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_phone_digits text := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
BEGIN
  -- Tolerate a US country code on the probe ("+1 303 555 1212" → "3035551212").
  IF length(v_phone_digits) = 11 AND left(v_phone_digits, 1) = '1' THEN
    v_phone_digits := substr(v_phone_digits, 2);
  END IF;

  RETURN QUERY
  SELECT r.id, r.title, r.email, r.phone, r.status, r.created_at
  FROM crm_records r
  WHERE r.organization_id = p_org_id
    AND r.module_id = p_module_id
    AND r.deleted_at IS NULL
    AND (p_exclude_id IS NULL OR r.id != p_exclude_id)
    AND (
      -- Primary: match by email (case-insensitive)
      (p_email IS NOT NULL AND p_email != '' AND LOWER(r.email) = LOWER(p_email))
      OR
      -- Fallback: match by phone only when no email provided.
      -- Digits-only comparison so every stored format collides
      -- ("3035551212" = "303-555-1212" = "(303) 555-1212"); a stored US
      -- country code is tolerated too. Predicates mirror the partial
      -- expression index idx_crm_records_phone_digits.
      (
        (p_email IS NULL OR p_email = '')
        AND p_phone IS NOT NULL AND p_phone != ''
        AND length(v_phone_digits) >= 7
        AND r.phone IS NOT NULL AND r.phone <> ''
        AND regexp_replace(COALESCE(r.phone, ''), '\D', '', 'g') IN (v_phone_digits, '1' || v_phone_digits)
      )
    )
  LIMIT 5;
END;
$$;

-- 2) Contacts.email → optional (single configuration row; reversible) ---------
UPDATE public.crm_fields
   SET required = false
 WHERE id = '1bbe0ec4-78ce-4883-8b6f-9fc188ef7cdc'
   AND key = 'email'
   AND module_id = 'f9869598-18f2-4277-94a0-255ba9044cb9'
   AND required = true;
