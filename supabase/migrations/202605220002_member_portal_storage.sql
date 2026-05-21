-- =============================================================================
-- Migration: 202605220002_member_portal_storage
-- Purpose:   Storage buckets used by the member portal (need attachments,
--            member documents). Both private; access via signed URLs only.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('member-needs',     'member-needs',     false, 26214400, ARRAY['application/pdf','image/jpeg','image/png','image/heic','image/heif']),
  ('member-documents', 'member-documents', false, 26214400, ARRAY['application/pdf','image/jpeg','image/png','image/heic','image/heif'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: service role bypasses; members access only via signed URLs from
-- our API routes. Authenticated members can read paths whose first segment
-- matches their member_id (defence-in-depth — the API routes already gate this).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='member_needs_owner_read'
  ) THEN
    CREATE POLICY member_needs_owner_read ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'member-needs' AND
        (storage.foldername(name))[1] = 'needs' AND
        (storage.foldername(name))[2] IN (
          SELECT m.id::text FROM members m
          JOIN profiles p ON p.email = m.email AND p.organization_id = m.organization_id
          WHERE p.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='member_docs_owner_read'
  ) THEN
    CREATE POLICY member_docs_owner_read ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'member-documents' AND
        (storage.foldername(name))[1] IN (
          SELECT m.id::text FROM members m
          JOIN profiles p ON p.email = m.email AND p.organization_id = m.organization_id
          WHERE p.user_id = auth.uid()
        )
      );
  END IF;
END $$;
