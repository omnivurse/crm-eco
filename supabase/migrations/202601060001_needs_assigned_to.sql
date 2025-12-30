-- ============================================================================
-- Migration: Add assigned_to_profile_id to needs table
-- Purpose: Enable assignee-based workload tracking in the Needs Command Center
-- ============================================================================

-- Add assignee column to needs table
ALTER TABLE public.needs
  ADD COLUMN IF NOT EXISTS assigned_to_profile_id uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add index for efficient filtering by assignee
CREATE INDEX IF NOT EXISTS idx_needs_assigned_to_profile
  ON public.needs(assigned_to_profile_id);

-- ============================================================================
-- NOTE: After applying this migration, regenerate TypeScript types:
--   npx supabase gen types typescript --project-id <your-project-id> > packages/lib/src/types/database.ts
-- ============================================================================

