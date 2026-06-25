-- Phase 0 / Branding: admin_settings → organizations.branding BACKFILL (PIFH-SAFE).
-- Project: sffisarikcreyyjzdjvb
-- Status:  DRAFT — not applied. Run the READ-ONLY verification block (bottom) FIRST,
--          confirm the would-backfill / would-skip counts, then run the single UPDATE.
-- Risk:    LOW. Additive + idempotent: writes only orgs whose branding is still '{}'
--          AND which customized AWAY from the admin_settings seed defaults. No DDL,
--          no new indexes, no DROP. Re-runnable (the WHERE clause makes it a no-op
--          on a second pass once branding is populated).
--
-- WHY THIS IS NOT A BLANKET BACKFILL (the PIFH trap):
--   organizations.branding is the single canonical brand store (jsonb, DEFAULT '{}'
--   NOT NULL). When branding='{}', packages/ui/src/lib/branding.ts brandingToCssText()
--   returns '' and the tenant FALLS THROUGH to packages/ui/src/styles/theme.css, whose
--   default --primary is cyan #06b6d4.
--   admin_settings, however, seeds its OWN defaults that are NOT cyan:
--       admin_settings.default_primary_color   DEFAULT '#1e40af'  (baseline L24321)
--       admin_settings.default_secondary_color DEFAULT '#3b82f6'  (baseline L24322)
--   A naive "copy admin_settings into branding for every org" would therefore stamp
--   the blue #1e40af/#3b82f6 seed onto orgs that never deliberately chose it —
--   including PIFH (00000000-0000-0000-0000-000000000001) — and silently FLIP PIFH's
--   look from the intended theme.css cyan to blue.
--   So we backfill ONLY orgs that customized away from BOTH seed defaults. PIFH, which
--   sits on the untouched seed (or has no admin_settings row at all), is intentionally
--   SKIPPED and keeps branding='{}' so it provably renders the theme.css cyan default.
--
-- SHAPE: the jsonb we write matches what brandingToCssText() actually reads — the
--   nested colors.{primary,secondary} form is tried FIRST by readColor()
--   (packages/ui/src/lib/branding.ts L93-97). logo_url / company_name / version are
--   stored for completeness (renderer ignores them today; future brand surfaces use them).
--   jsonb_strip_nulls() drops logo_url/company_name when admin_settings has them NULL,
--   so we never persist explicit nulls into the canonical store.
--
-- ONE-TO-ONE JOIN SAFETY: admin_settings.organization_id is UNIQUE
--   (admin_settings_organization_id_key, baseline L38548-38549) and FKs to
--   organizations(id) (baseline L62584-62585). So `FROM admin_settings s
--   WHERE s.organization_id = o.id` matches AT MOST ONE settings row per org — no fan-out.
--
-- RLS NOTE: this is a maintenance/migration UPDATE intended to run with elevated
--   (migration) privileges, NOT through the cookie/SSR client. It is the one-time
--   data move; ongoing per-tenant branding writes still go through the RLS-gated
--   organizations_update_owner_admin path in the app.

SET lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- (1) BACKFILL — additive + idempotent. Only orgs that BOTH:
--       (a) still have empty branding  (coalesce(o.branding,'{}') = '{}'), AND
--       (b) customized away from the admin_settings seed defaults
--           (NOT (primary='#1e40af' AND secondary='#3b82f6')).
--     PIFH on seed defaults => predicate (b) false => SKIPPED => branding stays '{}'.
-- ---------------------------------------------------------------------------
UPDATE public.organizations o
SET    branding = jsonb_strip_nulls(
         jsonb_build_object(
           'logo_url',     s.default_logo_url,
           'company_name', s.company_name,
           'colors', jsonb_build_object(
             'primary',   s.default_primary_color,
             'secondary', s.default_secondary_color
           ),
           'version', 1
         )
       )
FROM   public.admin_settings s
WHERE  s.organization_id = o.id
  AND  coalesce(o.branding, '{}'::jsonb) = '{}'::jsonb
  AND  NOT (
         s.default_primary_color   = '#1e40af'
     AND s.default_secondary_color = '#3b82f6'
       );

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- (2) VERIFICATION (READ-ONLY) — run BEFORE the UPDATE on staging/prod to preview,
--     and AFTER to confirm. None of these mutate state.
-- ---------------------------------------------------------------------------

-- 2a. WOULD-BACKFILL vs WOULD-SKIP breakdown. Run this BEFORE applying section (1).
--     Expect PIFH (seed defaults / empty branding) to land in 'skip_seed_default'
--     or 'skip_already_branded', NEVER in 'will_backfill'.
SELECT
  CASE
    WHEN s.organization_id IS NULL
      THEN 'skip_no_admin_settings'
    WHEN coalesce(o.branding, '{}'::jsonb) <> '{}'::jsonb
      THEN 'skip_already_branded'
    WHEN (s.default_primary_color = '#1e40af' AND s.default_secondary_color = '#3b82f6')
      THEN 'skip_seed_default'
    ELSE 'will_backfill'
  END AS disposition,
  count(*) AS orgs
FROM   public.organizations o
LEFT   JOIN public.admin_settings s ON s.organization_id = o.id
GROUP  BY 1
ORDER  BY 1;

-- 2b. Explicit PIFH guard — confirm PIFH is NOT in the backfill set and stays '{}'.
--     Should return one row with would_backfill = false and branding = '{}'.
SELECT
  o.id,
  o.name,
  o.branding,
  EXISTS (
    SELECT 1
    FROM   public.admin_settings s
    WHERE  s.organization_id = o.id
      AND  coalesce(o.branding, '{}'::jsonb) = '{}'::jsonb
      AND  NOT (s.default_primary_color = '#1e40af'
            AND s.default_secondary_color = '#3b82f6')
  ) AS would_backfill
FROM   public.organizations o
WHERE  o.id = '00000000-0000-0000-0000-000000000001';  -- canonical PIFH org

-- 2c. Post-apply spot check — list the rows the UPDATE actually wrote, with the
--     colors the renderer will pick up (nested colors.* is what readColor() reads first).
SELECT
  o.id,
  o.name,
  o.branding -> 'colors' ->> 'primary'   AS branding_primary,
  o.branding -> 'colors' ->> 'secondary' AS branding_secondary,
  o.branding ->> 'company_name'          AS branding_company_name
FROM   public.organizations o
WHERE  o.branding ? 'version'            -- only rows this migration stamped (version=1)
ORDER  BY o.name;

-- ---------------------------------------------------------------------------
-- ROLLBACK NOTE
--   This backfill ONLY populates orgs whose branding was '{}' (never overwrites an
--   existing customization), so the inverse is to clear exactly the rows it stamped.
--   The version=1 marker is what distinguishes migration-written branding from any
--   later app-authored branding (the app path does not write this exact shape blindly):
--
--     UPDATE public.organizations
--     SET    branding = '{}'::jsonb
--     WHERE  branding ? 'version'
--       AND  (branding -> 'colors' ->> 'primary')   IS NOT NULL
--       AND  (branding -> 'colors' ->> 'secondary') IS NOT NULL;
--
--   Review section 2c output BEFORE running rollback to ensure no human has edited
--   branding via the app in the interim (which would also carry colors but should be
--   preserved). PIFH is never touched by either direction (it was never backfilled).
--
-- DEPRECATION NOTE (single branding source):
--   organizations.branding is now canonical. admin_settings.default_primary_color /
--   default_secondary_color / default_logo_url / company_name are DEPRECATED as a
--   brand source and should be served via a READ-SHIM only — do NOT drop them here
--   (no DDL in this migration; this is the data move, not a schema change).
