-- Revoke anon (unauthenticated) API access on reporting views and products.
-- Project: sffisarikcreyyjzdjvb
-- Status:  APPLIED 2026-08-04 via Supabase MCP (schema_migrations version 20260804110056).
-- Risk:    LOW. GRANTS ONLY. No policy bodies, no DDL, no data. Revoking a grant
--          that was never made is a no-op, so this is safe to re-run.
--
-- WHY
--   Six views carry `GRANT ALL ... TO anon` and lack `security_invoker`. A view
--   without that flag executes with the VIEW OWNER's privileges, and a table
--   owner is exempt from RLS unless the table is FORCE RLS:
--
--     advisor_contact_summary          baseline:24450  grant :88501
--     change_feed_view                 baseline:26054  grant :89023
--     crm_contact_coverage_reporting_v baseline:27702  grant :89446
--     crm_duplicate_audit              baseline:27873  grant :89500
--     medicaid_dashboard_stats         baseline:33429  grant :91019
--     medicaid_state_breakdown         baseline:33444  grant :91028
--
--   advisor_contact_summary joins advisors + members, whose RLS is enabled but
--   NOT forced — so it exposes every advisor's name, email, state and book size
--   across every tenant to anyone holding the public anon key (which ships in
--   every browser bundle). change_feed_view leaks the same way over change_events.
--
--   Note 202606160001_unify_leads_to_crm_records.sql:8 redefines
--   advisor_contact_summary with CREATE OR REPLACE VIEW, which does NOT set
--   reloptions — which is why the flag is still absent after that migration.
--
--   products: policy `advisors_see_capacity_products` (baseline:76767) is
--     USING ((product_type IS NULL) OR ...)
--   with NO `TO` clause, so it applies to PUBLIC including anon, and its first
--   branch is unconditional. products.product_type is nullable with no default,
--   so any row predating that column is world-readable. Live check 2026-08-02:
--   0 product rows, so this is currently dormant — it re-arms on first insert.
--
-- WHAT THIS DOES *NOT* DO
--   It does not set `security_invoker` on the views. That is a separate, riskier
--   change (it alters what AUTHENTICATED users see) and is deliberately deferred
--   so this migration stays a pure, instantly-reversible grant revoke.
--
-- BLAST RADIUS: none expected. Every consumer of these six views uses an
--   authenticated client and filters by org:
--     apps/crm/src/lib/crm/queries.ts (advisor summary)
--     apps/crm/src/app/api/crm/advisors/summary/route.ts
--     apps/admin/src/app/api/changes/route.ts
--     apps/crm/src/app/api/changes/route.ts
--     apps/crm/src/app/api/crm/medicaid/route.ts
--   `authenticated` keeps its grant throughout.
--   products is already covered for authenticated users by
--   "Users can view products in their organization" (baseline:75859), so the
--   capacity policy's only net effect today is the anon read.
--
-- VERIFY AFTER APPLYING (negative test — this is the point):
--   Using the project's PUBLIC anon key, each of these must return
--   401/permission denied rather than rows:
--     curl "$SUPABASE_URL/rest/v1/advisor_contact_summary?select=*&limit=1" \
--          -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--   ...and the same for the other five views and for products.
--   Positive: as an authenticated PIFH user, /crm/products, the dashboard
--   advisor widget, /analytics/medicaid and both change feeds return the same
--   row counts as a pre-change capture.

SET lock_timeout = '5s';

BEGIN;

REVOKE ALL ON TABLE public.advisor_contact_summary            FROM anon;
REVOKE ALL ON TABLE public.change_feed_view                   FROM anon;
REVOKE ALL ON TABLE public.crm_contact_coverage_reporting_v   FROM anon;
REVOKE ALL ON TABLE public.crm_duplicate_audit                FROM anon;
REVOKE ALL ON TABLE public.medicaid_dashboard_stats           FROM anon;
REVOKE ALL ON TABLE public.medicaid_state_breakdown           FROM anon;

REVOKE ALL ON TABLE public.products FROM anon;

-- Constrain the policy to authenticated so the unconditional
-- `product_type IS NULL` branch can never be evaluated for anon.
ALTER POLICY advisors_see_capacity_products ON public.products TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── ROLLBACK ────────────────────────────────────────────────────────────────
--   GRANT ALL ON TABLE public.advisor_contact_summary          TO anon;
--   GRANT ALL ON TABLE public.change_feed_view                 TO anon;
--   GRANT ALL ON TABLE public.crm_contact_coverage_reporting_v TO anon;
--   GRANT ALL ON TABLE public.crm_duplicate_audit              TO anon;
--   GRANT ALL ON TABLE public.medicaid_dashboard_stats         TO anon;
--   GRANT ALL ON TABLE public.medicaid_state_breakdown         TO anon;
--   GRANT ALL ON TABLE public.products                         TO anon;
--   ALTER POLICY advisors_see_capacity_products ON public.products TO public;
--   NOTIFY pgrst, 'reload schema';
