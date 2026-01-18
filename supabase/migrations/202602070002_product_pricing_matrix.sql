-- ============================================================================
-- PRODUCT PRICING MATRIX ENHANCEMENTS
-- Extends existing pricing tables with additional fields
-- ============================================================================

-- ============================================================================
-- PRODUCTS TABLE (Create if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  label text,
  description text,
  category text,
  provider text,
  status text DEFAULT 'active',
  is_public boolean DEFAULT true,
  start_date date,
  end_date date,
  default_iua_id uuid,
  require_dependent_info boolean DEFAULT true,
  require_dependent_address_match boolean DEFAULT false,
  min_age integer DEFAULT 0,
  max_age integer DEFAULT 64,
  sort_order integer DEFAULT 0,
  color text,
  icon text,
  features jsonb DEFAULT '[]'::jsonb,
  terms_url text,
  brochure_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_organization_id ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- ============================================================================
-- EXTEND EXISTING PRODUCT_IUA TABLE
-- ============================================================================
DO $$
BEGIN
  -- Add product_id column if not exists (the existing table uses plan_id)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_iua' AND column_name = 'product_id') THEN
    ALTER TABLE product_iua ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE CASCADE;
  END IF;

  -- Add is_default column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_iua' AND column_name = 'is_default') THEN
    ALTER TABLE product_iua ADD COLUMN is_default boolean DEFAULT false;
  END IF;

  -- Add is_active column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_iua' AND column_name = 'is_active') THEN
    ALTER TABLE product_iua ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  -- Add description column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_iua' AND column_name = 'description') THEN
    ALTER TABLE product_iua ADD COLUMN description text;
  END IF;

  -- Add updated_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_iua' AND column_name = 'updated_at') THEN
    ALTER TABLE product_iua ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_iua_product_id ON product_iua(product_id) WHERE product_id IS NOT NULL;

-- ============================================================================
-- EXTEND EXISTING PRODUCT_AGE_BRACKETS TABLE
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_age_brackets' AND column_name = 'product_id') THEN
    ALTER TABLE product_age_brackets ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_age_brackets' AND column_name = 'is_active') THEN
    ALTER TABLE product_age_brackets ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_age_brackets' AND column_name = 'updated_at') THEN
    ALTER TABLE product_age_brackets ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_age_brackets_product_id ON product_age_brackets(product_id) WHERE product_id IS NOT NULL;

-- ============================================================================
-- EXTEND EXISTING PRODUCT_BENEFIT_TYPES TABLE
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_benefit_types' AND column_name = 'label') THEN
    ALTER TABLE product_benefit_types ADD COLUMN label text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_benefit_types' AND column_name = 'includes_spouse') THEN
    ALTER TABLE product_benefit_types ADD COLUMN includes_spouse boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_benefit_types' AND column_name = 'includes_children') THEN
    ALTER TABLE product_benefit_types ADD COLUMN includes_children boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_benefit_types' AND column_name = 'max_dependents') THEN
    ALTER TABLE product_benefit_types ADD COLUMN max_dependents integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_benefit_types' AND column_name = 'is_active') THEN
    ALTER TABLE product_benefit_types ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_benefit_types' AND column_name = 'updated_at') THEN
    ALTER TABLE product_benefit_types ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- ============================================================================
-- EXTEND EXISTING PRODUCT_PRICING_MATRIX TABLE
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_pricing_matrix' AND column_name = 'product_id') THEN
    ALTER TABLE product_pricing_matrix ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_pricing_matrix' AND column_name = 'tobacco_surcharge') THEN
    ALTER TABLE product_pricing_matrix ADD COLUMN tobacco_surcharge numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_pricing_matrix' AND column_name = 'tobacco_surcharge_percent') THEN
    ALTER TABLE product_pricing_matrix ADD COLUMN tobacco_surcharge_percent numeric(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_pricing_matrix' AND column_name = 'effective_date') THEN
    ALTER TABLE product_pricing_matrix ADD COLUMN effective_date date DEFAULT CURRENT_DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_pricing_matrix' AND column_name = 'end_date') THEN
    ALTER TABLE product_pricing_matrix ADD COLUMN end_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_pricing_matrix' AND column_name = 'notes') THEN
    ALTER TABLE product_pricing_matrix ADD COLUMN notes text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_pricing_matrix_product_id ON product_pricing_matrix(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_pricing_matrix_effective_date ON product_pricing_matrix(effective_date);

-- ============================================================================
-- VENDOR COSTS TABLE (Create if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  plan_id uuid, -- For compatibility with existing schema
  iua_id uuid,
  age_bracket_id uuid,
  benefit_type_id uuid,
  cost numeric(10,2) NOT NULL,
  effective_date date DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_costs_product_id ON vendor_costs(product_id);
CREATE INDEX IF NOT EXISTS idx_vendor_costs_plan_id ON vendor_costs(plan_id);

-- ============================================================================
-- EXTEND PRODUCT_BENEFITS TABLE
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_benefits' AND column_name = 'product_id') THEN
    ALTER TABLE product_benefits ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_benefits' AND column_name = 'icon') THEN
    ALTER TABLE product_benefits ADD COLUMN icon text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_benefits' AND column_name = 'category') THEN
    ALTER TABLE product_benefits ADD COLUMN category text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_benefits' AND column_name = 'is_highlighted') THEN
    ALTER TABLE product_benefits ADD COLUMN is_highlighted boolean DEFAULT false;
  END IF;
END $$;

-- ============================================================================
-- EXTEND PRODUCT_EXTRA_COSTS TABLE
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_extra_costs' AND column_name = 'product_id') THEN
    ALTER TABLE product_extra_costs ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_extra_costs' AND column_name = 'apply_on') THEN
    ALTER TABLE product_extra_costs ADD COLUMN apply_on text DEFAULT 'enrollment';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_extra_costs' AND column_name = 'condition_type') THEN
    ALTER TABLE product_extra_costs ADD COLUMN condition_type text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_extra_costs' AND column_name = 'condition_value') THEN
    ALTER TABLE product_extra_costs ADD COLUMN condition_value text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_extra_costs' AND column_name = 'is_commissionable') THEN
    ALTER TABLE product_extra_costs ADD COLUMN is_commissionable boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_extra_costs' AND column_name = 'is_active') THEN
    ALTER TABLE product_extra_costs ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'product_extra_costs' AND column_name = 'updated_at') THEN
    ALTER TABLE product_extra_costs ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- ============================================================================
-- PRODUCT DOCUMENTS TABLE (Create if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  plan_id uuid,
  name text NOT NULL,
  document_type text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_size integer,
  mime_type text,
  is_required_reading boolean DEFAULT false,
  is_signature_required boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_documents_product_id ON product_documents(product_id);
CREATE INDEX IF NOT EXISTS idx_product_documents_plan_id ON product_documents(plan_id);

-- ============================================================================
-- ADVISOR PRODUCT ACCESS TABLE (Create if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS advisor_product_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  plan_id uuid,
  can_view boolean DEFAULT true,
  can_sell boolean DEFAULT true,
  custom_commission_rate numeric(5,2),
  granted_at timestamptz DEFAULT now(),
  granted_by uuid REFERENCES profiles(id),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisor_product_access_advisor_id ON advisor_product_access(advisor_id);
CREATE INDEX IF NOT EXISTS idx_advisor_product_access_product_id ON advisor_product_access(product_id);

-- ============================================================================
-- RLS FOR NEW TABLES
-- ============================================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisor_product_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view products in their organization" ON products;
CREATE POLICY "Users can view products in their organization"
  ON products FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage products" ON products;
CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Admins can view vendor costs" ON vendor_costs;
CREATE POLICY "Admins can view vendor costs"
  ON vendor_costs FOR SELECT
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Admins can manage vendor costs" ON vendor_costs;
CREATE POLICY "Admins can manage vendor costs"
  ON vendor_costs FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Users can view product documents" ON product_documents;
CREATE POLICY "Users can view product documents"
  ON product_documents FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage product documents" ON product_documents;
CREATE POLICY "Admins can manage product documents"
  ON product_documents FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Users can view advisor product access" ON advisor_product_access;
CREATE POLICY "Users can view advisor product access"
  ON advisor_product_access FOR SELECT
  USING (advisor_id IN (SELECT id FROM advisors WHERE organization_id = get_user_organization_id()));

DROP POLICY IF EXISTS "Admins can manage advisor product access" ON advisor_product_access;
CREATE POLICY "Admins can manage advisor product access"
  ON advisor_product_access FOR ALL
  USING (advisor_id IN (SELECT id FROM advisors WHERE organization_id = get_user_organization_id()) AND get_user_role() IN ('owner', 'admin'));

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION get_product_price(
  p_product_id uuid,
  p_iua_id uuid,
  p_age integer,
  p_benefit_type_id uuid,
  p_is_tobacco_user boolean DEFAULT false
)
RETURNS numeric AS $$
DECLARE
  v_age_bracket_id uuid;
  v_base_price numeric;
  v_tobacco_surcharge numeric;
  v_tobacco_percent numeric;
BEGIN
  SELECT id INTO v_age_bracket_id
  FROM product_age_brackets
  WHERE product_id = p_product_id
    AND p_age >= min_age
    AND p_age <= max_age
    AND COALESCE(is_active, true) = true
  LIMIT 1;

  IF v_age_bracket_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT price, COALESCE(tobacco_surcharge, 0), COALESCE(tobacco_surcharge_percent, 0)
  INTO v_base_price, v_tobacco_surcharge, v_tobacco_percent
  FROM product_pricing_matrix
  WHERE product_id = p_product_id
    AND iua_id = p_iua_id
    AND age_bracket_id = v_age_bracket_id
    AND benefit_type_id = p_benefit_type_id
    AND COALESCE(effective_date, CURRENT_DATE) <= CURRENT_DATE
    AND (end_date IS NULL OR end_date > CURRENT_DATE)
  ORDER BY effective_date DESC NULLS LAST
  LIMIT 1;

  IF v_base_price IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_is_tobacco_user THEN
    IF v_tobacco_percent > 0 THEN
      v_base_price := v_base_price * (1 + v_tobacco_percent / 100);
    ELSE
      v_base_price := v_base_price + v_tobacco_surcharge;
    END IF;
  END IF;

  RETURN v_base_price;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_vendor_cost(
  p_product_id uuid,
  p_iua_id uuid,
  p_age_bracket_id uuid,
  p_benefit_type_id uuid
)
RETURNS numeric AS $$
  SELECT cost
  FROM vendor_costs
  WHERE product_id = p_product_id
    AND (iua_id IS NULL OR iua_id = p_iua_id)
    AND (age_bracket_id IS NULL OR age_bracket_id = p_age_bracket_id)
    AND (benefit_type_id IS NULL OR benefit_type_id = p_benefit_type_id)
    AND COALESCE(effective_date, CURRENT_DATE) <= CURRENT_DATE
    AND (end_date IS NULL OR end_date > CURRENT_DATE)
  ORDER BY effective_date DESC NULLS LAST
  LIMIT 1;
$$ LANGUAGE sql STABLE;
