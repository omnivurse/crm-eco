-- Add FK from document_audit_log.user_id to profiles(user_id)
-- so PostgREST can resolve the join: profiles:user_id(full_name)

-- First ensure profiles.user_id has a unique index (required for FK target).
-- profiles already has UNIQUE(user_id, organization_id); we add a standalone
-- unique index only if one doesn't already exist.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id_unique
  ON public.profiles (user_id);

-- Now add the FK constraint (skip if it already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_audit_log_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.document_audit_log
      ADD CONSTRAINT document_audit_log_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;
