-- -----------------------------------------------------------------------------
-- CRM + email attachment storage buckets and RLS
-- Apps expect private buckets `crm-attachments` and `email-attachments` with
-- object keys scoped by org: first path segment must equal the caller's org.
-- Paths in use:
--   crm-attachments:  {organization_id}/{record_id}/{file} |
--                     {organization_id}/imports/{job_id}/{file}
--   email-attachments: {organization_id}/{timestamp}_{sanitized_file}
--   email-assets:     {organization_id}/{folder}/{timestamp}_{sanitized_file}
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('crm-attachments', 'crm-attachments', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('email-attachments', 'email-attachments', false, 10485760, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('email-assets', 'email-assets', false, 5242880, NULL)
ON CONFLICT (id) DO NOTHING;

-- storage.objects policies (authenticated users, org folder prefix)
DROP POLICY IF EXISTS "crm_attachments_storage_select" ON storage.objects;
CREATE POLICY "crm_attachments_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'crm-attachments' AND (storage.foldername(name))[1] = get_user_organization_id()::text);

DROP POLICY IF EXISTS "crm_attachments_storage_insert" ON storage.objects;
CREATE POLICY "crm_attachments_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm-attachments' AND (storage.foldername(name))[1] = get_user_organization_id()::text);

DROP POLICY IF EXISTS "crm_attachments_storage_update" ON storage.objects;
CREATE POLICY "crm_attachments_storage_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'crm-attachments' AND (storage.foldername(name))[1] = get_user_organization_id()::text);

DROP POLICY IF EXISTS "crm_attachments_storage_delete" ON storage.objects;
CREATE POLICY "crm_attachments_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'crm-attachments' AND (storage.foldername(name))[1] = get_user_organization_id()::text);

DROP POLICY IF EXISTS "email_attachments_storage_select" ON storage.objects;
CREATE POLICY "email_attachments_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'email-attachments' AND (storage.foldername(name))[1] = get_user_organization_id()::text);

DROP POLICY IF EXISTS "email_attachments_storage_insert" ON storage.objects;
CREATE POLICY "email_attachments_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'email-attachments' AND (storage.foldername(name))[1] = get_user_organization_id()::text);

DROP POLICY IF EXISTS "email_attachments_storage_update" ON storage.objects;
CREATE POLICY "email_attachments_storage_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'email-attachments' AND (storage.foldername(name))[1] = get_user_organization_id()::text);

DROP POLICY IF EXISTS "email_attachments_storage_delete" ON storage.objects;
CREATE POLICY "email_attachments_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'email-attachments' AND (storage.foldername(name))[1] = get_user_organization_id()::text);

DROP POLICY IF EXISTS "email_assets_storage_select" ON storage.objects;
CREATE POLICY "email_assets_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'email-assets' AND (storage.foldername(name))[1] = get_user_organization_id()::text);

DROP POLICY IF EXISTS "email_assets_storage_insert" ON storage.objects;
CREATE POLICY "email_assets_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'email-assets' AND (storage.foldername(name))[1] = get_user_organization_id()::text);

DROP POLICY IF EXISTS "email_assets_storage_update" ON storage.objects;
CREATE POLICY "email_assets_storage_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'email-assets' AND (storage.foldername(name))[1] = get_user_organization_id()::text);

DROP POLICY IF EXISTS "email_assets_storage_delete" ON storage.objects;
CREATE POLICY "email_assets_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'email-assets' AND (storage.foldername(name))[1] = get_user_organization_id()::text);
