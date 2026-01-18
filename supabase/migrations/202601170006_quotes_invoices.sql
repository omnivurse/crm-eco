-- ============================================================================
-- QUOTES & INVOICES SYSTEM
-- Professional quotes and invoice generation
-- ============================================================================

-- ============================================================================
-- QUOTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Quote identifiers
  quote_number text NOT NULL,
  title text,

  -- Related entities
  contact_id uuid REFERENCES crm_records(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES crm_records(id) ON DELETE SET NULL,

  -- Quote details
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
  valid_until date,

  -- Financial
  subtotal numeric(12,2) DEFAULT 0,
  discount_type text DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value numeric(12,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  tax_amount numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  currency text DEFAULT 'USD',

  -- Terms and notes
  terms text,
  notes text,
  internal_notes text,

  -- Tracking
  sent_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,

  -- Owner
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_org ON quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotes_contact ON quotes(contact_id);
CREATE INDEX IF NOT EXISTS idx_quotes_deal ON quotes(deal_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_number ON quotes(organization_id, quote_number);

-- ============================================================================
-- QUOTE LINE ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,

  -- Line item details
  name text NOT NULL,
  description text,
  quantity numeric(10,2) DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  discount_type text DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value numeric(12,2) DEFAULT 0,
  total numeric(12,2) NOT NULL,

  -- Ordering
  sort_order integer DEFAULT 0,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_line_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_product ON quote_line_items(product_id);

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Invoice identifiers
  invoice_number text NOT NULL,
  title text,

  -- Related entities
  contact_id uuid REFERENCES crm_records(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES crm_records(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,

  -- Invoice details
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'cancelled')),
  due_date date,

  -- Financial
  subtotal numeric(12,2) DEFAULT 0,
  discount_type text DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value numeric(12,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  tax_amount numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  amount_paid numeric(12,2) DEFAULT 0,
  balance_due numeric(12,2) DEFAULT 0,
  currency text DEFAULT 'USD',

  -- Terms and notes
  terms text,
  notes text,
  internal_notes text,

  -- Tracking
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,

  -- Owner
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_deal ON invoices(deal_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quote ON invoices(quote_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(organization_id, invoice_number);

-- ============================================================================
-- INVOICE LINE ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,

  -- Line item details
  name text NOT NULL,
  description text,
  quantity numeric(10,2) DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  discount_type text DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value numeric(12,2) DEFAULT 0,
  total numeric(12,2) NOT NULL,

  -- Ordering
  sort_order integer DEFAULT 0,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_line_items(product_id);

-- ============================================================================
-- INVOICE PAYMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  -- Payment details
  amount numeric(12,2) NOT NULL,
  payment_method text,
  payment_date date NOT NULL,
  reference_number text,
  notes text,

  -- Timestamps
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

-- Quotes policies
DROP POLICY IF EXISTS "Users can view quotes in their org" ON quotes;
CREATE POLICY "Users can view quotes in their org"
  ON quotes FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can manage quotes in their org" ON quotes;
CREATE POLICY "Users can manage quotes in their org"
  ON quotes FOR ALL
  USING (organization_id = get_user_organization_id());

-- Quote line items policies
DROP POLICY IF EXISTS "Users can view quote items" ON quote_line_items;
CREATE POLICY "Users can view quote items"
  ON quote_line_items FOR SELECT
  USING (quote_id IN (SELECT id FROM quotes WHERE organization_id = get_user_organization_id()));

DROP POLICY IF EXISTS "Users can manage quote items" ON quote_line_items;
CREATE POLICY "Users can manage quote items"
  ON quote_line_items FOR ALL
  USING (quote_id IN (SELECT id FROM quotes WHERE organization_id = get_user_organization_id()));

-- Invoices policies
DROP POLICY IF EXISTS "Users can view invoices in their org" ON invoices;
CREATE POLICY "Users can view invoices in their org"
  ON invoices FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can manage invoices in their org" ON invoices;
CREATE POLICY "Users can manage invoices in their org"
  ON invoices FOR ALL
  USING (organization_id = get_user_organization_id());

-- Invoice line items policies
DROP POLICY IF EXISTS "Users can view invoice items" ON invoice_line_items;
CREATE POLICY "Users can view invoice items"
  ON invoice_line_items FOR SELECT
  USING (invoice_id IN (SELECT id FROM invoices WHERE organization_id = get_user_organization_id()));

DROP POLICY IF EXISTS "Users can manage invoice items" ON invoice_line_items;
CREATE POLICY "Users can manage invoice items"
  ON invoice_line_items FOR ALL
  USING (invoice_id IN (SELECT id FROM invoices WHERE organization_id = get_user_organization_id()));

-- Invoice payments policies
DROP POLICY IF EXISTS "Users can view payments" ON invoice_payments;
CREATE POLICY "Users can view payments"
  ON invoice_payments FOR SELECT
  USING (invoice_id IN (SELECT id FROM invoices WHERE organization_id = get_user_organization_id()));

DROP POLICY IF EXISTS "Users can manage payments" ON invoice_payments;
CREATE POLICY "Users can manage payments"
  ON invoice_payments FOR ALL
  USING (invoice_id IN (SELECT id FROM invoices WHERE organization_id = get_user_organization_id()));

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_quotes_updated_at ON quotes;
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quote_items_updated_at ON quote_line_items;
CREATE TRIGGER update_quote_items_updated_at
  BEFORE UPDATE ON quote_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoice_items_updated_at ON invoice_line_items;
CREATE TRIGGER update_invoice_items_updated_at
  BEFORE UPDATE ON invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTION: Generate quote number
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_quote_number(org_id uuid)
RETURNS text AS $$
DECLARE
  next_num integer;
  year_prefix text;
BEGIN
  year_prefix := to_char(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(NULLIF(regexp_replace(quote_number, '[^0-9]', '', 'g'), '')::integer), 0) + 1
  INTO next_num
  FROM quotes
  WHERE organization_id = org_id
    AND quote_number LIKE 'Q-' || year_prefix || '-%';

  RETURN 'Q-' || year_prefix || '-' || LPAD(next_num::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION: Generate invoice number
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_invoice_number(org_id uuid)
RETURNS text AS $$
DECLARE
  next_num integer;
  year_prefix text;
BEGIN
  year_prefix := to_char(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '')::integer), 0) + 1
  INTO next_num
  FROM invoices
  WHERE organization_id = org_id
    AND invoice_number LIKE 'INV-' || year_prefix || '-%';

  RETURN 'INV-' || year_prefix || '-' || LPAD(next_num::text, 4, '0');
END;
$$ LANGUAGE plpgsql;
