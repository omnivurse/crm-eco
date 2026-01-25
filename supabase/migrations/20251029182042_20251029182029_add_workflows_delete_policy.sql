/*
  # Add DELETE Policy for Workflows Table

  ## Issue Identified
  - Users cannot delete workflows from the UI
  - Only SELECT, INSERT, and UPDATE policies exist for workflows table
  - Missing DELETE policy causes all delete operations to fail silently

  ## Root Cause
  - Migration 20251027000100_optimize_rls_policies.sql only created SELECT, INSERT, and UPDATE policies
  - No DELETE policy was ever created for the workflows table
  - RLS blocks all DELETE operations when no policy allows them

  ## Solution
  - Add DELETE policy allowing workflow creators to delete their own workflows
  - Allow admin and super_admin users to delete any workflow
  - Maintain security by ensuring only authorized users can delete workflows

  ## Security
  - Users can only delete workflows they created (WHERE created_by = auth.uid())
  - Admins and super_admins can delete any workflow (for moderation/cleanup)
  - Prevents unauthorized deletion of workflows

  ## Testing
  After applying this migration:
  1. Workflow creators should be able to delete their own workflows
  2. Admins should be able to delete any workflow
  3. Regular users should not be able to delete workflows they didn't create
*/

-- Add DELETE policy for workflow creators
DROP POLICY IF EXISTS "Workflow creators can delete workflows" ON public.workflows;
CREATE POLICY "Workflow creators can delete workflows"
  ON public.workflows
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Add DELETE policy for admins
DROP POLICY IF EXISTS "Admins can delete any workflow" ON public.workflows;
CREATE POLICY "Admins can delete any workflow"
  ON public.workflows
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_super_admin());

-- Log the fix to audit_logs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    INSERT INTO public.audit_logs (actor_id, action, details)
    VALUES (
      NULL,
      'add_workflows_delete_policy',
      jsonb_build_object(
        'timestamp', now(),
        'issue', 'Users could not delete workflows - no DELETE policy existed',
        'solution', 'Added DELETE policies for workflow creators and admins',
        'policies_created', jsonb_build_array(
          'Workflow creators can delete workflows',
          'Admins can delete any workflow'
        ),
        'security_notes', 'Users can only delete workflows they created; admins can delete any workflow'
      )
    );
  END IF;
END $$;
