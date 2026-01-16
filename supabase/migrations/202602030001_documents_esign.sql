-- ============================================================================
-- PHASE W17: DOCUMENTS + E-SIGN
-- Proposal generation and e-signature integration
-- ============================================================================

-- ============================================================================
-- DOCUMENT TEMPLATES
-- Templates for generating proposals and contracts
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Template info
  name text NOT NULL,
  description text,
  category text DEFAULT 'proposal', -- proposal, contract, quote, invoice
  
  -- Content
  content_html text NOT NULL,
  content_variables jsonb DEFAULT '[]'::jsonb,
  -- [{ name: 'customer_name', label: 'Customer Name', type: 'text' }]
  
  -- Settings
  header_html text,
  footer_html text,
  
  -- Status
  is_active boolean DEFAULT true,
  
  -- Ownership
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_document_templates_org ON document_templates(org_id);

-- ============================================================================
-- CRM DOCUMENTS (Extended)
-- Generated documents from templates
-- ============================================================================

-- Add columns to existing crm_documents if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_documents') THEN
    ALTER TABLE crm_documents ADD COLUMN IF NOT EXISTS doc_status text DEFAULT 'draft';
    ALTER TABLE crm_documents ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES document_templates(id);
    ALTER TABLE crm_documents ADD COLUMN IF NOT EXISTS generated_from jsonb;
    ALTER TABLE crm_documents ADD COLUMN IF NOT EXISTS version int DEFAULT 1;
  END IF;
END $$;

-- ============================================================================
-- E-SIGN CONNECTIONS
-- E-sign provider OAuth connections
-- ============================================================================

CREATE TABLE IF NOT EXISTS esign_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Provider
  provider text NOT NULL, -- docusign, pandadoc, hellosign
  
  -- OAuth tokens
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  
  -- Account info
  account_id text,
  account_name text,
  
  -- Settings
  settings jsonb DEFAULT '{}'::jsonb,
  
  -- Status
  status text DEFAULT 'active',
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(org_id, provider)
);

CREATE INDEX idx_esign_connections_org ON esign_connections(org_id);

-- ============================================================================
-- E-SIGN ENVELOPES
-- Signature requests sent for documents
-- ============================================================================

CREATE TABLE IF NOT EXISTS esign_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES esign_connections(id) ON DELETE SET NULL,
  
  -- Document reference
  document_id uuid,
  
  -- CRM links
  deal_id uuid,
  contact_id uuid,
  
  -- Provider info
  provider text NOT NULL,
  external_id text NOT NULL,
  
  -- Envelope details
  subject text NOT NULL,
  message text,
  
  -- Recipients
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ email, name, role: 'signer'|'cc', order, status, signed_at }]
  
  -- Status
  status text DEFAULT 'created',
  -- Status: created, sent, delivered, viewed, completed, voided, declined
  
  -- Timestamps
  sent_at timestamptz,
  viewed_at timestamptz,
  completed_at timestamptz,
  
  -- Signed document
  signed_document_url text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_esign_envelopes_org ON esign_envelopes(org_id);
CREATE INDEX idx_esign_envelopes_deal ON esign_envelopes(deal_id);
CREATE INDEX idx_esign_envelopes_external ON esign_envelopes(provider, external_id);
CREATE INDEX idx_esign_envelopes_status ON esign_envelopes(status);

-- RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE esign_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE esign_envelopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view document templates for their org"
  ON document_templates FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "Admins can manage document templates"
  ON document_templates FOR ALL USING (org_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

CREATE POLICY "Users can view esign connections for their org"
  ON esign_connections FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "Admins can manage esign connections"
  ON esign_connections FOR ALL USING (org_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

CREATE POLICY "Users can view esign envelopes for their org"
  ON esign_envelopes FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "Users can manage esign envelopes for their org"
  ON esign_envelopes FOR ALL USING (org_id = get_user_organization_id());
