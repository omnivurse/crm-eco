-- =============================================================================
-- FIX: crm_territories RLS -- org-scoped policies
-- Previous policies used USING(true) allowing cross-tenant access.
-- =============================================================================

-- Drop permissive policies
DROP POLICY IF EXISTS "Territories visible to authenticated org members" ON crm_territories;
DROP POLICY IF EXISTS "Territories managed by authenticated users" ON crm_territories;

-- Org-scoped SELECT
CREATE POLICY "Territories visible to org members"
  ON crm_territories FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Org-scoped INSERT/UPDATE/DELETE
CREATE POLICY "Territories managed by org members"
  ON crm_territories FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );
