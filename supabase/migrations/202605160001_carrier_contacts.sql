-- ============================================================================
-- MODULE: Carrier Contacts & Credentials
--
-- Extends the insurance_carriers system with a child table for storing
-- multiple contacts, credentials, and portal links per carrier.
--
-- Use case: advisors need to track broker support numbers, commissions
-- contacts, agent IDs, portal logins, and custom links for each carrier.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table — carrier_contacts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carrier_contacts (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  carrier_id        uuid         NOT NULL REFERENCES insurance_carriers(id) ON DELETE CASCADE,
  contact_role      text         NOT NULL DEFAULT 'general'
    CHECK (contact_role IN (
      'general',
      'broker_support',
      'direct_rep',
      'commissions',
      'client_support',
      'underwriting',
      'claims',
      'enrollment',
      'other'
    )),
  label             text,
  contact_name      text,
  phone             text,
  email             text,
  -- Credentials
  agent_id          text,
  username          text,
  password          text,
  secure_email_user text,
  secure_email_addr text,
  -- Links
  portal_url        text,
  custom_link       text,
  custom_link_label text,
  -- Metadata
  notes             text,
  is_primary        boolean      NOT NULL DEFAULT false,
  sort_order        integer      NOT NULL DEFAULT 0,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  carrier_contacts IS 'Multiple contacts, credentials, and links per insurance carrier';
COMMENT ON COLUMN carrier_contacts.contact_role IS 'Department / role type for this contact entry';
COMMENT ON COLUMN carrier_contacts.agent_id IS 'Carrier-assigned agent or broker ID';
COMMENT ON COLUMN carrier_contacts.portal_url IS 'Broker portal login URL';
COMMENT ON COLUMN carrier_contacts.secure_email_addr IS 'Secure / encrypted email address for carrier communications';

-- ----------------------------------------------------------------------------
-- 2. Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_carrier_contacts_carrier
  ON carrier_contacts (carrier_id);

CREATE INDEX IF NOT EXISTS idx_carrier_contacts_org_carrier
  ON carrier_contacts (organization_id, carrier_id);

CREATE INDEX IF NOT EXISTS idx_carrier_contacts_role
  ON carrier_contacts (carrier_id, contact_role);

-- ----------------------------------------------------------------------------
-- 3. Auto-update trigger
-- ----------------------------------------------------------------------------
CREATE TRIGGER update_carrier_contacts_updated_at
  BEFORE UPDATE ON carrier_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------
ALTER TABLE carrier_contacts ENABLE ROW LEVEL SECURITY;

-- Read: any CRM member in the org
DROP POLICY IF EXISTS "carrier_contacts_select_member" ON carrier_contacts;
CREATE POLICY "carrier_contacts_select_member" ON carrier_contacts
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

-- Insert: admin or manager
DROP POLICY IF EXISTS "carrier_contacts_insert_manager" ON carrier_contacts;
CREATE POLICY "carrier_contacts_insert_manager" ON carrier_contacts
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

-- Update: admin or manager
DROP POLICY IF EXISTS "carrier_contacts_update_manager" ON carrier_contacts;
CREATE POLICY "carrier_contacts_update_manager" ON carrier_contacts
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

-- Delete: admin only
DROP POLICY IF EXISTS "carrier_contacts_delete_admin" ON carrier_contacts;
CREATE POLICY "carrier_contacts_delete_admin" ON carrier_contacts
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

-- Service role: full access
DROP POLICY IF EXISTS "carrier_contacts_service" ON carrier_contacts;
CREATE POLICY "carrier_contacts_service" ON carrier_contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Notify PostgREST to pick up the new table
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- END MODULE: Carrier Contacts & Credentials
-- ============================================================================
