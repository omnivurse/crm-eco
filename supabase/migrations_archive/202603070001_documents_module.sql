-- =============================================================================
-- Documents Module
-- Tables: doc_folders, documents, document_versions, document_favorites,
--         document_links, document_audit_log
-- Storage: org-documents bucket (private, 50 MB limit)
-- =============================================================================

-- ======================== STORAGE BUCKET ====================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('org-documents', 'org-documents', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- ======================== TABLES ============================================

-- 1. doc_folders
CREATE TABLE IF NOT EXISTS public.doc_folders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES public.doc_folders(id) ON DELETE CASCADE,
  name        text NOT NULL,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX idx_doc_folders_org_parent ON public.doc_folders (org_id, parent_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_doc_folders_trash ON public.doc_folders (org_id)
  WHERE deleted_at IS NOT NULL;
CREATE UNIQUE INDEX uq_doc_folders_name ON public.doc_folders (org_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name)
  WHERE deleted_at IS NULL;

-- 2. documents
CREATE TABLE IF NOT EXISTS public.documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  folder_id       uuid REFERENCES public.doc_folders(id) ON DELETE SET NULL,
  name            text NOT NULL,
  storage_path    text NOT NULL,
  mime_type       text,
  size_bytes      bigint,
  current_version int NOT NULL DEFAULT 1,
  uploaded_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_documents_org_folder ON public.documents (org_id, folder_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_trash ON public.documents (org_id)
  WHERE deleted_at IS NOT NULL;
CREATE UNIQUE INDEX uq_documents_name ON public.documents (org_id, COALESCE(folder_id, '00000000-0000-0000-0000-000000000000'::uuid), name)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_search ON public.documents USING gin (name public.gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- 3. document_versions
CREATE TABLE IF NOT EXISTS public.document_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  storage_path   text NOT NULL,
  size_bytes     bigint,
  uploaded_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_doc_version ON public.document_versions (document_id, version_number);

-- 4. document_favorites
CREATE TABLE IF NOT EXISTS public.document_favorites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  folder_id   uuid REFERENCES public.doc_folders(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fav_target CHECK (
    (document_id IS NOT NULL AND folder_id IS NULL) OR
    (document_id IS NULL AND folder_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_fav_document ON public.document_favorites (user_id, document_id)
  WHERE document_id IS NOT NULL;
CREATE UNIQUE INDEX uq_fav_folder ON public.document_favorites (user_id, folder_id)
  WHERE folder_id IS NOT NULL;

-- 5. document_links
CREATE TABLE IF NOT EXISTS public.document_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id    uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  token          text NOT NULL UNIQUE,
  expires_at     timestamptz,
  max_downloads  int,
  download_count int NOT NULL DEFAULT 0,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 6. document_audit_log
CREATE TABLE IF NOT EXISTS public.document_audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id uuid,
  folder_id   uuid,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      text NOT NULL,
  meta        jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_audit_org_time ON public.document_audit_log (org_id, created_at DESC);

-- ======================== TRIGGERS ==========================================

CREATE TRIGGER set_updated_at_doc_folders
  BEFORE UPDATE ON public.doc_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_documents
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ======================== RLS ===============================================

ALTER TABLE public.doc_folders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_folders_select" ON public.doc_folders FOR SELECT TO authenticated
  USING (org_id = get_user_organization_id());
CREATE POLICY "doc_folders_insert" ON public.doc_folders FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_organization_id());
CREATE POLICY "doc_folders_update" ON public.doc_folders FOR UPDATE TO authenticated
  USING (org_id = get_user_organization_id())
  WITH CHECK (org_id = get_user_organization_id());
CREATE POLICY "doc_folders_delete" ON public.doc_folders FOR DELETE TO authenticated
  USING (org_id = get_user_organization_id());

CREATE POLICY "documents_select" ON public.documents FOR SELECT TO authenticated
  USING (org_id = get_user_organization_id());
CREATE POLICY "documents_insert" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_organization_id());
CREATE POLICY "documents_update" ON public.documents FOR UPDATE TO authenticated
  USING (org_id = get_user_organization_id())
  WITH CHECK (org_id = get_user_organization_id());
CREATE POLICY "documents_delete" ON public.documents FOR DELETE TO authenticated
  USING (org_id = get_user_organization_id());

CREATE POLICY "doc_versions_select" ON public.document_versions FOR SELECT TO authenticated
  USING (document_id IN (SELECT id FROM public.documents WHERE org_id = get_user_organization_id()));
CREATE POLICY "doc_versions_insert" ON public.document_versions FOR INSERT TO authenticated
  WITH CHECK (document_id IN (SELECT id FROM public.documents WHERE org_id = get_user_organization_id()));

CREATE POLICY "doc_favorites_select" ON public.document_favorites FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "doc_favorites_insert" ON public.document_favorites FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND org_id = get_user_organization_id());
CREATE POLICY "doc_favorites_delete" ON public.document_favorites FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "doc_links_select" ON public.document_links FOR SELECT TO authenticated
  USING (org_id = get_user_organization_id());
CREATE POLICY "doc_links_insert" ON public.document_links FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_organization_id());
CREATE POLICY "doc_links_update" ON public.document_links FOR UPDATE TO authenticated
  USING (org_id = get_user_organization_id());
CREATE POLICY "doc_links_delete" ON public.document_links FOR DELETE TO authenticated
  USING (org_id = get_user_organization_id());
CREATE POLICY "doc_links_anon_select" ON public.document_links FOR SELECT TO anon
  USING (true);

CREATE POLICY "doc_audit_select" ON public.document_audit_log FOR SELECT TO authenticated
  USING (org_id = get_user_organization_id());
CREATE POLICY "doc_audit_insert" ON public.document_audit_log FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_organization_id());

CREATE POLICY "doc_folders_service" ON public.doc_folders FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "documents_service" ON public.documents FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "doc_versions_service" ON public.document_versions FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "doc_favorites_service" ON public.document_favorites FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "doc_links_service" ON public.document_links FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "doc_audit_service" ON public.document_audit_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ======================== STORAGE RLS =======================================

CREATE POLICY "org_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'org-documents' AND (storage.foldername(name))[1] = get_user_organization_id()::text);
CREATE POLICY "org_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-documents' AND (storage.foldername(name))[1] = get_user_organization_id()::text);
CREATE POLICY "org_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'org-documents' AND (storage.foldername(name))[1] = get_user_organization_id()::text);
CREATE POLICY "org_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'org-documents' AND (storage.foldername(name))[1] = get_user_organization_id()::text);
