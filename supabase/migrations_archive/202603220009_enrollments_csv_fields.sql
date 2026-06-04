-- ============================================================================
-- Enrollments CSV Gap Fill — Add all missing CSV-mapped columns (ADDITIVE ONLY)
-- Zero existing columns or data deleted
-- ============================================================================

-- Date tracking
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_created_date timestamptz;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS first_billing_date date;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS next_billing_date date;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS fulfillment_date date;

-- Hold tracking
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS hold_date date;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS hold_reason text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS hold_return_date date;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS hold_amount numeric(10,2);

-- Product description snapshots
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_label text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_benefit text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS period_label text;

-- Categorization
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS category3 text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS category4 text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS permanent_bill_day integer;

-- Product source / pipeline
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_source text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_source_detail text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_status text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_stage text;

-- Product call tracking
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_number_of_calls integer DEFAULT 0;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_call_status text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_next_step text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_next_step_date date;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_estimated_close_date date;

-- Additional fee columns
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS administration_fee numeric(10,2);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS association_fee numeric(10,2);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS iua_fee numeric(10,2);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_fee numeric(10,2);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS monthly_contribution_fee numeric(10,2);

-- Contract
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS contract_number text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS contract_length integer;

-- Enroller (separate from advisor)
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS enroller_id text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS enroller_name text;

-- Payment
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS pay_type text;

-- Refunds
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS refund_requested boolean DEFAULT false;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS refund_requested_date date;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS refund_provided boolean DEFAULT false;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS refund_provided_date date;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS refund_comment text;

-- Product agent (distinct from enrollment advisor)
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_agent_id text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_agent_label text;

-- Billing / sales state
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT false;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS renewal_date date;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS sale_date date;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS next_billing_amount numeric(10,2);

-- Tracking
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS assigned_agents text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS last_payment_date date;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS source_detail text;

-- TPV (Third Party Verification)
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS tpv_code text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS tpv_date date;

-- Product / agent codes
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_code text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS agent_code text;

-- Notes / tracking
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS note_date date;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS system_id text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS underwriter text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS category text;

-- Paid through
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS product_paid_through_date date;

NOTIFY pgrst, 'reload schema';
