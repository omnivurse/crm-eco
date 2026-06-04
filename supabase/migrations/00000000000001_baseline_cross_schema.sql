-- 00000000000001_baseline_cross_schema.sql
-- Companion to 00000000000000_baseline.sql. The baseline is pg_dump --schema=public, which
-- omits objects the app created OUTSIDE public. This file restores them, captured from LIVE
-- prod (sffisarikcreyyjzdjvb) on 2026-06-04T13:40:38Z — reproduces prod truth, not migration history.
-- Idempotent + guarded so it replays on a fresh Supabase branch and is a safe no-op on prod
-- (marked applied in the ledger alongside the baseline; see MIGRATION_CONSOLIDATION_RUNBOOK.md §7).

-- The storage-policy expressions below reference UNQUALIFIED public objects (files, members,
-- profiles, get_user_organization_id, ...). The baseline runs `set_config('search_path','',false)`
-- at session scope, which can persist into this file when db push reuses the connection; set an
-- explicit search_path so those references resolve regardless. (storage./auth./cron. are qualified.)
SET search_path = public;

-- 1) Auth: profile-bootstrap trigger on auth.users (public.handle_new_user lives in the baseline).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Storage: RLS policies on storage.objects (27, live).
DROP POLICY IF EXISTS "Anyone can upload ticket files" ON storage.objects;
CREATE POLICY "Anyone can upload ticket files" ON storage.objects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((bucket_id = 'ticket-attachments'::text));

DROP POLICY IF EXISTS "Anyone can upload to ticket-files" ON storage.objects;
CREATE POLICY "Anyone can upload to ticket-files" ON storage.objects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((bucket_id = 'ticket-files'::text));

DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'ticket-attachments'::text));

DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Users can delete own files" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'it_files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "Users can read org files" ON storage.objects;
CREATE POLICY "Users can read org files" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'it_files'::text) AND (EXISTS ( SELECT 1
   FROM files
  WHERE ((files.storage_path = objects.name) AND (files.visibility = 'org'::text))))));

DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
CREATE POLICY "Users can read own files" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'it_files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "Users can read team files" ON storage.objects;
CREATE POLICY "Users can read team files" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'it_files'::text) AND (EXISTS ( SELECT 1
   FROM files f
  WHERE ((f.storage_path = objects.name) AND (f.visibility = 'team'::text) AND (f.linked_project_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM (projects p
             LEFT JOIN project_members pm ON ((pm.project_id = p.id)))
          WHERE ((p.id = f.linked_project_id) AND ((p.owner_id = auth.uid()) OR (pm.user_id = auth.uid()))))))))));

DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
CREATE POLICY "Users can update own files" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'it_files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
CREATE POLICY "Users can upload own files" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'it_files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS crm_attachments_storage_delete ON storage.objects;
CREATE POLICY crm_attachments_storage_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'crm-attachments'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

DROP POLICY IF EXISTS crm_attachments_storage_insert ON storage.objects;
CREATE POLICY crm_attachments_storage_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'crm-attachments'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

DROP POLICY IF EXISTS crm_attachments_storage_select ON storage.objects;
CREATE POLICY crm_attachments_storage_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'crm-attachments'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

DROP POLICY IF EXISTS crm_attachments_storage_update ON storage.objects;
CREATE POLICY crm_attachments_storage_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'crm-attachments'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

DROP POLICY IF EXISTS email_assets_storage_delete ON storage.objects;
CREATE POLICY email_assets_storage_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'email-assets'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

DROP POLICY IF EXISTS email_assets_storage_insert ON storage.objects;
CREATE POLICY email_assets_storage_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'email-assets'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

DROP POLICY IF EXISTS email_assets_storage_select ON storage.objects;
CREATE POLICY email_assets_storage_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'email-assets'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

DROP POLICY IF EXISTS email_assets_storage_update ON storage.objects;
CREATE POLICY email_assets_storage_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'email-assets'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

DROP POLICY IF EXISTS email_attachments_storage_delete ON storage.objects;
CREATE POLICY email_attachments_storage_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'email-attachments'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

DROP POLICY IF EXISTS email_attachments_storage_insert ON storage.objects;
CREATE POLICY email_attachments_storage_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'email-attachments'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

DROP POLICY IF EXISTS email_attachments_storage_select ON storage.objects;
CREATE POLICY email_attachments_storage_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'email-attachments'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

DROP POLICY IF EXISTS email_attachments_storage_update ON storage.objects;
CREATE POLICY email_attachments_storage_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'email-attachments'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

DROP POLICY IF EXISTS member_docs_owner_read ON storage.objects;
CREATE POLICY member_docs_owner_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'member-documents'::text) AND ((storage.foldername(name))[1] IN ( SELECT (m.id)::text AS id
   FROM (members m
     JOIN profiles p ON (((p.email = m.email) AND (p.organization_id = m.organization_id))))
  WHERE (p.user_id = auth.uid())))));

DROP POLICY IF EXISTS member_needs_owner_read ON storage.objects;
CREATE POLICY member_needs_owner_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'member-needs'::text) AND ((storage.foldername(name))[1] = 'needs'::text) AND ((storage.foldername(name))[2] IN ( SELECT (m.id)::text AS id
   FROM (members m
     JOIN profiles p ON (((p.email = m.email) AND (p.organization_id = m.organization_id))))
  WHERE (p.user_id = auth.uid())))));

DROP POLICY IF EXISTS org_docs_delete ON storage.objects;
CREATE POLICY org_docs_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'org-documents'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

DROP POLICY IF EXISTS org_docs_insert ON storage.objects;
CREATE POLICY org_docs_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'org-documents'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

DROP POLICY IF EXISTS org_docs_select ON storage.objects;
CREATE POLICY org_docs_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'org-documents'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

DROP POLICY IF EXISTS org_docs_update ON storage.objects;
CREATE POLICY org_docs_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'org-documents'::text) AND ((storage.foldername(name))[1] = (get_user_organization_id())::text)));

-- 3) Scheduled jobs (pg_cron). Guarded: skips cleanly if pg_cron is absent on the target
--    (so a preview branch never fails); schedules where pg_cron exists. cron.schedule is
--    idempotent (re-scheduling a jobname replaces it).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
  PERFORM cron.schedule('nightly_refresh_reporting_views', '0 2 * * *', 'SELECT refresh_reporting_views()');
  PERFORM cron.schedule('nightly_refresh_commission_summary', '0 3 * * *', 'SELECT refresh_advisor_commission_summary()');
  PERFORM cron.schedule('nightly_refresh_rankings', '0 4 * * *', 'SELECT refresh_advisor_rankings()');
  PERFORM cron.schedule('weekly_auto_payout_batches', '0 2 * * 5', 'SELECT auto_create_weekly_batches()');
  PERFORM cron.schedule('refresh-executive-views', '30 2 * * *', 'SELECT refresh_executive_views()');
  PERFORM cron.schedule('cleanup-old-events', '0 5 * * *', 'SELECT cleanup_old_events()');
  PERFORM cron.schedule('age-65-auto-cancellation', '0 6 * * *', 'SELECT public.apply_age_65_auto_cancellation()');
  ELSE
    RAISE NOTICE 'pg_cron not installed on this target; skipping cron.schedule (add jobs later).';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'cron.schedule setup skipped: %', SQLERRM;
END $$;
