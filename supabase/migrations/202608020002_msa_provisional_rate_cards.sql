-- ============================================================
-- MSA provisional product rate cards + enrollment contribution
-- Idempotent. PROD WRITE: do not apply without explicit approval.
-- Rollback notes at bottom.
-- ============================================================
SET lock_timeout = '5s';

-- Schema extensions (additive)
CREATE UNIQUE INDEX IF NOT EXISTS plans_organization_id_code_uidx
  ON public.plans (organization_id, code);

ALTER TABLE public.plan_rate_sets
  ADD COLUMN IF NOT EXISTS age_rating_basis text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'plan_rate_sets_age_rating_basis_check'
  ) THEN
    ALTER TABLE public.plan_rate_sets
      ADD CONSTRAINT plan_rate_sets_age_rating_basis_check
      CHECK (age_rating_basis IS NULL OR age_rating_basis IN ('primary', 'older_of_couple'));
  END IF;
END $$;

ALTER TABLE public.plan_fees
  ADD COLUMN IF NOT EXISTS fee_key text,
  ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.plan_rate_sets.age_rating_basis IS
  'primary = employee/member age; older_of_couple = max(member, spouse) for spouse/family tiers';

-- Org settings (PIFH)
INSERT INTO public.system_settings (
  organization_id, setting_key, setting_value, setting_type, category, subcategory, label, is_active
) VALUES
  ('00000000-0000-0000-0000-000000000001', 'enrollment_contribution_amount', '800', 'string', 'rates', 'enrollment_contribution', 'Enrollment Contribution Amount', true),
  ('00000000-0000-0000-0000-000000000001', 'enrollment_contribution_founding_waiver', '650', 'string', 'rates', 'enrollment_contribution', 'Founding Member Waiver Amount', true),
  ('00000000-0000-0000-0000-000000000001', 'enrollment_contribution_founding_cap', '250', 'string', 'rates', 'enrollment_contribution', 'Founding Member Cap', true),
  ('00000000-0000-0000-0000-000000000001', 'enrollment_contribution_founding_enabled', 'true', 'string', 'rates', 'enrollment_contribution', 'Founding Waiver Enabled', true),
  ('00000000-0000-0000-0000-000000000001', 'enrollment_contribution_founding_count', '0', 'string', 'rates', 'enrollment_contribution', 'Founding Members Enrolled Count', true),
  ('00000000-0000-0000-0000-000000000001', 'enrollment_contribution_split_referring', '100', 'string', 'rates', 'enrollment_contribution', 'Contribution Split — Referring Member', true),
  ('00000000-0000-0000-0000-000000000001', 'enrollment_contribution_split_admin_ops', '50', 'string', 'rates', 'enrollment_contribution', 'Contribution Split — Admin/Ops', true),
  ('00000000-0000-0000-0000-000000000001', 'enrollment_contribution_split_partner', '25', 'string', 'rates', 'enrollment_contribution', 'Contribution Split — Partner Marketing', true),
  ('00000000-0000-0000-0000-000000000001', 'enrollment_contribution_split_pifh', '25', 'string', 'rates', 'enrollment_contribution', 'Contribution Split — PIFH', true)
ON CONFLICT (organization_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value, updated_at = now();

DO $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_plan_id uuid;
  v_rate_set_id uuid;
  v_age_bands jsonb := '[{"id":"18-34","min":18,"max":34,"label":"18–34"},{"id":"35-49","min":35,"max":49,"label":"35–49"},{"id":"50-59","min":50,"max":59,"label":"50–59"},{"id":"60-64","min":60,"max":64,"label":"60–64"}]'::jsonb;
BEGIN
  -- PIFH-MSA-IND-1250
  INSERT INTO public.plans (
    organization_id, name, code, plan_code, brand_name, internal_name,
    category, effective_year, is_active, public_visible, description,
    rating_model, iua_amount, default_iua, enrollment_fee, metadata
  ) VALUES (
    v_org_id,
    'MSA Individual $1,250 IUA',
    'PIFH-MSA-IND-1250',
    'PIFH-MSA-IND-1250',
    'MSA Individual $1,250 IUA',
    'pifh_msa_ind_1250',
    'healthshare',
    2026,
    true,
    true,
    'Provisional MSA individual sharing — IUA $1,250. Partnership & wellness lab costs not included.',
    'tiered_household',
    1250,
    1250,
    800,
    '{"product_line":"msa","market_segment":"individual","age_rating_basis":"older_of_couple","provisional":true,"excludes":["partnership_costs","wellness_lab"],"iua_amount":1250}'::jsonb
  )
  ON CONFLICT (organization_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    plan_code = EXCLUDED.plan_code,
    brand_name = EXCLUDED.brand_name,
    category = EXCLUDED.category,
    rating_model = EXCLUDED.rating_model,
    iua_amount = EXCLUDED.iua_amount,
    default_iua = EXCLUDED.default_iua,
    enrollment_fee = EXCLUDED.enrollment_fee,
    metadata = EXCLUDED.metadata,
    public_visible = EXCLUDED.public_visible,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING id INTO v_plan_id;

  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM public.plans WHERE organization_id = v_org_id AND code = 'PIFH-MSA-IND-1250';
  END IF;

  INSERT INTO public.plan_rate_sets (
    plan_id, rate_set_key, label, effective_date, rating_model,
    age_bands, tobacco_config, age_rating_basis
  ) VALUES (
    v_plan_id, 'current', 'MSA Provisional Rates', '2026-08-01', 'tiered_household',
    v_age_bands, '{"enabled": false}'::jsonb, 'older_of_couple'
  )
  ON CONFLICT (plan_id, rate_set_key) DO UPDATE SET
    label = EXCLUDED.label,
    effective_date = EXCLUDED.effective_date,
    rating_model = EXCLUDED.rating_model,
    age_bands = EXCLUDED.age_bands,
    age_rating_basis = EXCLUDED.age_rating_basis,
    tobacco_config = EXCLUDED.tobacco_config,
    updated_at = now()
  RETURNING id INTO v_rate_set_id;

  IF v_rate_set_id IS NULL THEN
    SELECT id INTO v_rate_set_id FROM public.plan_rate_sets
    WHERE plan_id = v_plan_id AND rate_set_key = 'current';
  END IF;

  DELETE FROM public.plan_rate_entries WHERE rate_set_id = v_rate_set_id;
  DELETE FROM public.plan_fees WHERE rate_set_id = v_rate_set_id;

  INSERT INTO public.plan_rate_entries (rate_set_id, coverage_tier, age_band_id, person_type, rate_type, amount)
  VALUES
    (v_rate_set_id, 'member', '18-34', 'primary', 'banded', 197.1),
    (v_rate_set_id, 'member', '35-49', 'primary', 'banded', 275.94),
    (v_rate_set_id, 'member', '50-59', 'primary', 'banded', 354.78),
    (v_rate_set_id, 'member', '60-64', 'primary', 'banded', 413.91),
    (v_rate_set_id, 'member_spouse', '18-34', 'primary', 'banded', 394.2),
    (v_rate_set_id, 'member_spouse', '35-49', 'primary', 'banded', 551.88),
    (v_rate_set_id, 'member_spouse', '50-59', 'primary', 'banded', 709.56),
    (v_rate_set_id, 'member_spouse', '60-64', 'primary', 'banded', 827.82),
    (v_rate_set_id, 'member_children', '18-34', 'primary', 'banded', 354.78),
    (v_rate_set_id, 'member_children', '35-49', 'primary', 'banded', 496.69),
    (v_rate_set_id, 'member_children', '50-59', 'primary', 'banded', 638.6),
    (v_rate_set_id, 'member_children', '60-64', 'primary', 'banded', 745.04),
    (v_rate_set_id, 'family', '18-34', 'primary', 'banded', 551.88),
    (v_rate_set_id, 'family', '35-49', 'primary', 'banded', 772.63),
    (v_rate_set_id, 'family', '50-59', 'primary', 'banded', 993.38),
    (v_rate_set_id, 'family', '60-64', 'primary', 'banded', 1158.95);

  INSERT INTO public.plan_fees (rate_set_id, fee_key, label, fee_type, amount, applies_to, enabled, sort_order, meta)
  VALUES
    (v_rate_set_id, 'enrollment-contribution', 'Enrollment Contribution', 'flat_one_time', 800, 'enrollment', true, 0,
     '{"splits":{"referringMember":100,"adminOps":50,"partnerMarketing":25,"pifh":25}}'::jsonb),
    (v_rate_set_id, 'partnership-cost', 'Partnership Cost (Doctor/Nurse)', 'flat_monthly', 0, 'quote', false, 1, '{}'::jsonb),
    (v_rate_set_id, 'wellness-lab', 'Wellness Lab Panel', 'flat_monthly', 0, 'quote', false, 2, '{}'::jsonb);

  INSERT INTO public.plan_rate_sets (
    plan_id, rate_set_key, label, effective_date, rating_model,
    age_bands, tobacco_config, age_rating_basis
  ) VALUES (
    v_plan_id, 'rates_2026', 'MSA Provisional Rates (2026)', '2026-01-01', 'tiered_household',
    v_age_bands, '{"enabled": false}'::jsonb, 'older_of_couple'
  )
  ON CONFLICT (plan_id, rate_set_key) DO UPDATE SET
    label = EXCLUDED.label,
    effective_date = EXCLUDED.effective_date,
    rating_model = EXCLUDED.rating_model,
    age_bands = EXCLUDED.age_bands,
    age_rating_basis = EXCLUDED.age_rating_basis,
    tobacco_config = EXCLUDED.tobacco_config,
    updated_at = now()
  RETURNING id INTO v_rate_set_id;

  IF v_rate_set_id IS NULL THEN
    SELECT id INTO v_rate_set_id FROM public.plan_rate_sets
    WHERE plan_id = v_plan_id AND rate_set_key = 'rates_2026';
  END IF;

  DELETE FROM public.plan_rate_entries WHERE rate_set_id = v_rate_set_id;
  DELETE FROM public.plan_fees WHERE rate_set_id = v_rate_set_id;

  INSERT INTO public.plan_rate_entries (rate_set_id, coverage_tier, age_band_id, person_type, rate_type, amount)
  VALUES
    (v_rate_set_id, 'member', '18-34', 'primary', 'banded', 197.1),
    (v_rate_set_id, 'member', '35-49', 'primary', 'banded', 275.94),
    (v_rate_set_id, 'member', '50-59', 'primary', 'banded', 354.78),
    (v_rate_set_id, 'member', '60-64', 'primary', 'banded', 413.91),
    (v_rate_set_id, 'member_spouse', '18-34', 'primary', 'banded', 394.2),
    (v_rate_set_id, 'member_spouse', '35-49', 'primary', 'banded', 551.88),
    (v_rate_set_id, 'member_spouse', '50-59', 'primary', 'banded', 709.56),
    (v_rate_set_id, 'member_spouse', '60-64', 'primary', 'banded', 827.82),
    (v_rate_set_id, 'member_children', '18-34', 'primary', 'banded', 354.78),
    (v_rate_set_id, 'member_children', '35-49', 'primary', 'banded', 496.69),
    (v_rate_set_id, 'member_children', '50-59', 'primary', 'banded', 638.6),
    (v_rate_set_id, 'member_children', '60-64', 'primary', 'banded', 745.04),
    (v_rate_set_id, 'family', '18-34', 'primary', 'banded', 551.88),
    (v_rate_set_id, 'family', '35-49', 'primary', 'banded', 772.63),
    (v_rate_set_id, 'family', '50-59', 'primary', 'banded', 993.38),
    (v_rate_set_id, 'family', '60-64', 'primary', 'banded', 1158.95);

  INSERT INTO public.plan_fees (rate_set_id, fee_key, label, fee_type, amount, applies_to, enabled, sort_order, meta)
  VALUES
    (v_rate_set_id, 'enrollment-contribution', 'Enrollment Contribution', 'flat_one_time', 800, 'enrollment', true, 0,
     '{"splits":{"referringMember":100,"adminOps":50,"partnerMarketing":25,"pifh":25}}'::jsonb),
    (v_rate_set_id, 'partnership-cost', 'Partnership Cost (Doctor/Nurse)', 'flat_monthly', 0, 'quote', false, 1, '{}'::jsonb),
    (v_rate_set_id, 'wellness-lab', 'Wellness Lab Panel', 'flat_monthly', 0, 'quote', false, 2, '{}'::jsonb);

  -- PIFH-MSA-IND-2500
  INSERT INTO public.plans (
    organization_id, name, code, plan_code, brand_name, internal_name,
    category, effective_year, is_active, public_visible, description,
    rating_model, iua_amount, default_iua, enrollment_fee, metadata
  ) VALUES (
    v_org_id,
    'MSA Individual $2,500 IUA',
    'PIFH-MSA-IND-2500',
    'PIFH-MSA-IND-2500',
    'MSA Individual $2,500 IUA',
    'pifh_msa_ind_2500',
    'healthshare',
    2026,
    true,
    true,
    'Provisional MSA individual sharing — IUA $2,500. Partnership & wellness lab costs not included.',
    'tiered_household',
    2500,
    2500,
    800,
    '{"product_line":"msa","market_segment":"individual","age_rating_basis":"older_of_couple","provisional":true,"excludes":["partnership_costs","wellness_lab"],"iua_amount":2500}'::jsonb
  )
  ON CONFLICT (organization_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    plan_code = EXCLUDED.plan_code,
    brand_name = EXCLUDED.brand_name,
    category = EXCLUDED.category,
    rating_model = EXCLUDED.rating_model,
    iua_amount = EXCLUDED.iua_amount,
    default_iua = EXCLUDED.default_iua,
    enrollment_fee = EXCLUDED.enrollment_fee,
    metadata = EXCLUDED.metadata,
    public_visible = EXCLUDED.public_visible,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING id INTO v_plan_id;

  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM public.plans WHERE organization_id = v_org_id AND code = 'PIFH-MSA-IND-2500';
  END IF;

  INSERT INTO public.plan_rate_sets (
    plan_id, rate_set_key, label, effective_date, rating_model,
    age_bands, tobacco_config, age_rating_basis
  ) VALUES (
    v_plan_id, 'current', 'MSA Provisional Rates', '2026-08-01', 'tiered_household',
    v_age_bands, '{"enabled": false}'::jsonb, 'older_of_couple'
  )
  ON CONFLICT (plan_id, rate_set_key) DO UPDATE SET
    label = EXCLUDED.label,
    effective_date = EXCLUDED.effective_date,
    rating_model = EXCLUDED.rating_model,
    age_bands = EXCLUDED.age_bands,
    age_rating_basis = EXCLUDED.age_rating_basis,
    tobacco_config = EXCLUDED.tobacco_config,
    updated_at = now()
  RETURNING id INTO v_rate_set_id;

  IF v_rate_set_id IS NULL THEN
    SELECT id INTO v_rate_set_id FROM public.plan_rate_sets
    WHERE plan_id = v_plan_id AND rate_set_key = 'current';
  END IF;

  DELETE FROM public.plan_rate_entries WHERE rate_set_id = v_rate_set_id;
  DELETE FROM public.plan_fees WHERE rate_set_id = v_rate_set_id;

  INSERT INTO public.plan_rate_entries (rate_set_id, coverage_tier, age_band_id, person_type, rate_type, amount)
  VALUES
    (v_rate_set_id, 'member', '18-34', 'primary', 'banded', 157.68),
    (v_rate_set_id, 'member', '35-49', 'primary', 'banded', 220.75),
    (v_rate_set_id, 'member', '50-59', 'primary', 'banded', 273.18),
    (v_rate_set_id, 'member', '60-64', 'primary', 'banded', 318.71),
    (v_rate_set_id, 'member_spouse', '18-34', 'primary', 'banded', 315.36),
    (v_rate_set_id, 'member_spouse', '35-49', 'primary', 'banded', 441.5),
    (v_rate_set_id, 'member_spouse', '50-59', 'primary', 'banded', 546.36),
    (v_rate_set_id, 'member_spouse', '60-64', 'primary', 'banded', 637.42),
    (v_rate_set_id, 'member_children', '18-34', 'primary', 'banded', 283.82),
    (v_rate_set_id, 'member_children', '35-49', 'primary', 'banded', 397.35),
    (v_rate_set_id, 'member_children', '50-59', 'primary', 'banded', 491.73),
    (v_rate_set_id, 'member_children', '60-64', 'primary', 'banded', 573.68),
    (v_rate_set_id, 'family', '18-34', 'primary', 'banded', 441.5),
    (v_rate_set_id, 'family', '35-49', 'primary', 'banded', 618.11),
    (v_rate_set_id, 'family', '50-59', 'primary', 'banded', 764.91),
    (v_rate_set_id, 'family', '60-64', 'primary', 'banded', 892.39);

  INSERT INTO public.plan_fees (rate_set_id, fee_key, label, fee_type, amount, applies_to, enabled, sort_order, meta)
  VALUES
    (v_rate_set_id, 'enrollment-contribution', 'Enrollment Contribution', 'flat_one_time', 800, 'enrollment', true, 0,
     '{"splits":{"referringMember":100,"adminOps":50,"partnerMarketing":25,"pifh":25}}'::jsonb),
    (v_rate_set_id, 'partnership-cost', 'Partnership Cost (Doctor/Nurse)', 'flat_monthly', 0, 'quote', false, 1, '{}'::jsonb),
    (v_rate_set_id, 'wellness-lab', 'Wellness Lab Panel', 'flat_monthly', 0, 'quote', false, 2, '{}'::jsonb);

  INSERT INTO public.plan_rate_sets (
    plan_id, rate_set_key, label, effective_date, rating_model,
    age_bands, tobacco_config, age_rating_basis
  ) VALUES (
    v_plan_id, 'rates_2026', 'MSA Provisional Rates (2026)', '2026-01-01', 'tiered_household',
    v_age_bands, '{"enabled": false}'::jsonb, 'older_of_couple'
  )
  ON CONFLICT (plan_id, rate_set_key) DO UPDATE SET
    label = EXCLUDED.label,
    effective_date = EXCLUDED.effective_date,
    rating_model = EXCLUDED.rating_model,
    age_bands = EXCLUDED.age_bands,
    age_rating_basis = EXCLUDED.age_rating_basis,
    tobacco_config = EXCLUDED.tobacco_config,
    updated_at = now()
  RETURNING id INTO v_rate_set_id;

  IF v_rate_set_id IS NULL THEN
    SELECT id INTO v_rate_set_id FROM public.plan_rate_sets
    WHERE plan_id = v_plan_id AND rate_set_key = 'rates_2026';
  END IF;

  DELETE FROM public.plan_rate_entries WHERE rate_set_id = v_rate_set_id;
  DELETE FROM public.plan_fees WHERE rate_set_id = v_rate_set_id;

  INSERT INTO public.plan_rate_entries (rate_set_id, coverage_tier, age_band_id, person_type, rate_type, amount)
  VALUES
    (v_rate_set_id, 'member', '18-34', 'primary', 'banded', 157.68),
    (v_rate_set_id, 'member', '35-49', 'primary', 'banded', 220.75),
    (v_rate_set_id, 'member', '50-59', 'primary', 'banded', 273.18),
    (v_rate_set_id, 'member', '60-64', 'primary', 'banded', 318.71),
    (v_rate_set_id, 'member_spouse', '18-34', 'primary', 'banded', 315.36),
    (v_rate_set_id, 'member_spouse', '35-49', 'primary', 'banded', 441.5),
    (v_rate_set_id, 'member_spouse', '50-59', 'primary', 'banded', 546.36),
    (v_rate_set_id, 'member_spouse', '60-64', 'primary', 'banded', 637.42),
    (v_rate_set_id, 'member_children', '18-34', 'primary', 'banded', 283.82),
    (v_rate_set_id, 'member_children', '35-49', 'primary', 'banded', 397.35),
    (v_rate_set_id, 'member_children', '50-59', 'primary', 'banded', 491.73),
    (v_rate_set_id, 'member_children', '60-64', 'primary', 'banded', 573.68),
    (v_rate_set_id, 'family', '18-34', 'primary', 'banded', 441.5),
    (v_rate_set_id, 'family', '35-49', 'primary', 'banded', 618.11),
    (v_rate_set_id, 'family', '50-59', 'primary', 'banded', 764.91),
    (v_rate_set_id, 'family', '60-64', 'primary', 'banded', 892.39);

  INSERT INTO public.plan_fees (rate_set_id, fee_key, label, fee_type, amount, applies_to, enabled, sort_order, meta)
  VALUES
    (v_rate_set_id, 'enrollment-contribution', 'Enrollment Contribution', 'flat_one_time', 800, 'enrollment', true, 0,
     '{"splits":{"referringMember":100,"adminOps":50,"partnerMarketing":25,"pifh":25}}'::jsonb),
    (v_rate_set_id, 'partnership-cost', 'Partnership Cost (Doctor/Nurse)', 'flat_monthly', 0, 'quote', false, 1, '{}'::jsonb),
    (v_rate_set_id, 'wellness-lab', 'Wellness Lab Panel', 'flat_monthly', 0, 'quote', false, 2, '{}'::jsonb);

  -- PIFH-MSA-IND-5000
  INSERT INTO public.plans (
    organization_id, name, code, plan_code, brand_name, internal_name,
    category, effective_year, is_active, public_visible, description,
    rating_model, iua_amount, default_iua, enrollment_fee, metadata
  ) VALUES (
    v_org_id,
    'MSA Individual $5,000 IUA',
    'PIFH-MSA-IND-5000',
    'PIFH-MSA-IND-5000',
    'MSA Individual $5,000 IUA',
    'pifh_msa_ind_5000',
    'healthshare',
    2026,
    true,
    true,
    'Provisional MSA individual sharing — IUA $5,000. Partnership & wellness lab costs not included.',
    'tiered_household',
    5000,
    5000,
    800,
    '{"product_line":"msa","market_segment":"individual","age_rating_basis":"older_of_couple","provisional":true,"excludes":["partnership_costs","wellness_lab"],"iua_amount":5000}'::jsonb
  )
  ON CONFLICT (organization_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    plan_code = EXCLUDED.plan_code,
    brand_name = EXCLUDED.brand_name,
    category = EXCLUDED.category,
    rating_model = EXCLUDED.rating_model,
    iua_amount = EXCLUDED.iua_amount,
    default_iua = EXCLUDED.default_iua,
    enrollment_fee = EXCLUDED.enrollment_fee,
    metadata = EXCLUDED.metadata,
    public_visible = EXCLUDED.public_visible,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING id INTO v_plan_id;

  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM public.plans WHERE organization_id = v_org_id AND code = 'PIFH-MSA-IND-5000';
  END IF;

  INSERT INTO public.plan_rate_sets (
    plan_id, rate_set_key, label, effective_date, rating_model,
    age_bands, tobacco_config, age_rating_basis
  ) VALUES (
    v_plan_id, 'current', 'MSA Provisional Rates', '2026-08-01', 'tiered_household',
    v_age_bands, '{"enabled": false}'::jsonb, 'older_of_couple'
  )
  ON CONFLICT (plan_id, rate_set_key) DO UPDATE SET
    label = EXCLUDED.label,
    effective_date = EXCLUDED.effective_date,
    rating_model = EXCLUDED.rating_model,
    age_bands = EXCLUDED.age_bands,
    age_rating_basis = EXCLUDED.age_rating_basis,
    tobacco_config = EXCLUDED.tobacco_config,
    updated_at = now()
  RETURNING id INTO v_rate_set_id;

  IF v_rate_set_id IS NULL THEN
    SELECT id INTO v_rate_set_id FROM public.plan_rate_sets
    WHERE plan_id = v_plan_id AND rate_set_key = 'current';
  END IF;

  DELETE FROM public.plan_rate_entries WHERE rate_set_id = v_rate_set_id;
  DELETE FROM public.plan_fees WHERE rate_set_id = v_rate_set_id;

  INSERT INTO public.plan_rate_entries (rate_set_id, coverage_tier, age_band_id, person_type, rate_type, amount)
  VALUES
    (v_rate_set_id, 'member', '18-34', 'primary', 'banded', 114.32),
    (v_rate_set_id, 'member', '35-49', 'primary', 'banded', 160.05),
    (v_rate_set_id, 'member', '50-59', 'primary', 'banded', 205.77),
    (v_rate_set_id, 'member', '60-64', 'primary', 'banded', 240.07),
    (v_rate_set_id, 'member_spouse', '18-34', 'primary', 'banded', 228.64),
    (v_rate_set_id, 'member_spouse', '35-49', 'primary', 'banded', 320.09),
    (v_rate_set_id, 'member_spouse', '50-59', 'primary', 'banded', 411.54),
    (v_rate_set_id, 'member_spouse', '60-64', 'primary', 'banded', 480.14),
    (v_rate_set_id, 'member_children', '18-34', 'primary', 'banded', 205.77),
    (v_rate_set_id, 'member_children', '35-49', 'primary', 'banded', 288.08),
    (v_rate_set_id, 'member_children', '50-59', 'primary', 'banded', 370.39),
    (v_rate_set_id, 'member_children', '60-64', 'primary', 'banded', 432.12),
    (v_rate_set_id, 'family', '18-34', 'primary', 'banded', 320.09),
    (v_rate_set_id, 'family', '35-49', 'primary', 'banded', 448.13),
    (v_rate_set_id, 'family', '50-59', 'primary', 'banded', 576.16),
    (v_rate_set_id, 'family', '60-64', 'primary', 'banded', 672.19);

  INSERT INTO public.plan_fees (rate_set_id, fee_key, label, fee_type, amount, applies_to, enabled, sort_order, meta)
  VALUES
    (v_rate_set_id, 'enrollment-contribution', 'Enrollment Contribution', 'flat_one_time', 800, 'enrollment', true, 0,
     '{"splits":{"referringMember":100,"adminOps":50,"partnerMarketing":25,"pifh":25}}'::jsonb),
    (v_rate_set_id, 'partnership-cost', 'Partnership Cost (Doctor/Nurse)', 'flat_monthly', 0, 'quote', false, 1, '{}'::jsonb),
    (v_rate_set_id, 'wellness-lab', 'Wellness Lab Panel', 'flat_monthly', 0, 'quote', false, 2, '{}'::jsonb);

  INSERT INTO public.plan_rate_sets (
    plan_id, rate_set_key, label, effective_date, rating_model,
    age_bands, tobacco_config, age_rating_basis
  ) VALUES (
    v_plan_id, 'rates_2026', 'MSA Provisional Rates (2026)', '2026-01-01', 'tiered_household',
    v_age_bands, '{"enabled": false}'::jsonb, 'older_of_couple'
  )
  ON CONFLICT (plan_id, rate_set_key) DO UPDATE SET
    label = EXCLUDED.label,
    effective_date = EXCLUDED.effective_date,
    rating_model = EXCLUDED.rating_model,
    age_bands = EXCLUDED.age_bands,
    age_rating_basis = EXCLUDED.age_rating_basis,
    tobacco_config = EXCLUDED.tobacco_config,
    updated_at = now()
  RETURNING id INTO v_rate_set_id;

  IF v_rate_set_id IS NULL THEN
    SELECT id INTO v_rate_set_id FROM public.plan_rate_sets
    WHERE plan_id = v_plan_id AND rate_set_key = 'rates_2026';
  END IF;

  DELETE FROM public.plan_rate_entries WHERE rate_set_id = v_rate_set_id;
  DELETE FROM public.plan_fees WHERE rate_set_id = v_rate_set_id;

  INSERT INTO public.plan_rate_entries (rate_set_id, coverage_tier, age_band_id, person_type, rate_type, amount)
  VALUES
    (v_rate_set_id, 'member', '18-34', 'primary', 'banded', 114.32),
    (v_rate_set_id, 'member', '35-49', 'primary', 'banded', 160.05),
    (v_rate_set_id, 'member', '50-59', 'primary', 'banded', 205.77),
    (v_rate_set_id, 'member', '60-64', 'primary', 'banded', 240.07),
    (v_rate_set_id, 'member_spouse', '18-34', 'primary', 'banded', 228.64),
    (v_rate_set_id, 'member_spouse', '35-49', 'primary', 'banded', 320.09),
    (v_rate_set_id, 'member_spouse', '50-59', 'primary', 'banded', 411.54),
    (v_rate_set_id, 'member_spouse', '60-64', 'primary', 'banded', 480.14),
    (v_rate_set_id, 'member_children', '18-34', 'primary', 'banded', 205.77),
    (v_rate_set_id, 'member_children', '35-49', 'primary', 'banded', 288.08),
    (v_rate_set_id, 'member_children', '50-59', 'primary', 'banded', 370.39),
    (v_rate_set_id, 'member_children', '60-64', 'primary', 'banded', 432.12),
    (v_rate_set_id, 'family', '18-34', 'primary', 'banded', 320.09),
    (v_rate_set_id, 'family', '35-49', 'primary', 'banded', 448.13),
    (v_rate_set_id, 'family', '50-59', 'primary', 'banded', 576.16),
    (v_rate_set_id, 'family', '60-64', 'primary', 'banded', 672.19);

  INSERT INTO public.plan_fees (rate_set_id, fee_key, label, fee_type, amount, applies_to, enabled, sort_order, meta)
  VALUES
    (v_rate_set_id, 'enrollment-contribution', 'Enrollment Contribution', 'flat_one_time', 800, 'enrollment', true, 0,
     '{"splits":{"referringMember":100,"adminOps":50,"partnerMarketing":25,"pifh":25}}'::jsonb),
    (v_rate_set_id, 'partnership-cost', 'Partnership Cost (Doctor/Nurse)', 'flat_monthly', 0, 'quote', false, 1, '{}'::jsonb),
    (v_rate_set_id, 'wellness-lab', 'Wellness Lab Panel', 'flat_monthly', 0, 'quote', false, 2, '{}'::jsonb);

  -- PIFH-MSA-GRP-1250
  INSERT INTO public.plans (
    organization_id, name, code, plan_code, brand_name, internal_name,
    category, effective_year, is_active, public_visible, description,
    rating_model, iua_amount, default_iua, enrollment_fee, metadata
  ) VALUES (
    v_org_id,
    'MSA Group $1,250 IUA',
    'PIFH-MSA-GRP-1250',
    'PIFH-MSA-GRP-1250',
    'MSA Group $1,250 IUA',
    'pifh_msa_grp_1250',
    'healthshare',
    2026,
    true,
    true,
    'Provisional MSA group sharing — IUA $1,250. Partnership & wellness lab costs not included.',
    'tiered_household',
    1250,
    1250,
    800,
    '{"product_line":"msa","market_segment":"group","age_rating_basis":"primary","provisional":true,"excludes":["partnership_costs","wellness_lab"],"iua_amount":1250}'::jsonb
  )
  ON CONFLICT (organization_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    plan_code = EXCLUDED.plan_code,
    brand_name = EXCLUDED.brand_name,
    category = EXCLUDED.category,
    rating_model = EXCLUDED.rating_model,
    iua_amount = EXCLUDED.iua_amount,
    default_iua = EXCLUDED.default_iua,
    enrollment_fee = EXCLUDED.enrollment_fee,
    metadata = EXCLUDED.metadata,
    public_visible = EXCLUDED.public_visible,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING id INTO v_plan_id;

  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM public.plans WHERE organization_id = v_org_id AND code = 'PIFH-MSA-GRP-1250';
  END IF;

  INSERT INTO public.plan_rate_sets (
    plan_id, rate_set_key, label, effective_date, rating_model,
    age_bands, tobacco_config, age_rating_basis
  ) VALUES (
    v_plan_id, 'current', 'MSA Provisional Rates', '2026-08-01', 'tiered_household',
    v_age_bands, '{"enabled": false}'::jsonb, 'primary'
  )
  ON CONFLICT (plan_id, rate_set_key) DO UPDATE SET
    label = EXCLUDED.label,
    effective_date = EXCLUDED.effective_date,
    rating_model = EXCLUDED.rating_model,
    age_bands = EXCLUDED.age_bands,
    age_rating_basis = EXCLUDED.age_rating_basis,
    tobacco_config = EXCLUDED.tobacco_config,
    updated_at = now()
  RETURNING id INTO v_rate_set_id;

  IF v_rate_set_id IS NULL THEN
    SELECT id INTO v_rate_set_id FROM public.plan_rate_sets
    WHERE plan_id = v_plan_id AND rate_set_key = 'current';
  END IF;

  DELETE FROM public.plan_rate_entries WHERE rate_set_id = v_rate_set_id;
  DELETE FROM public.plan_fees WHERE rate_set_id = v_rate_set_id;

  INSERT INTO public.plan_rate_entries (rate_set_id, coverage_tier, age_band_id, person_type, rate_type, amount)
  VALUES
    (v_rate_set_id, 'member', '18-34', 'primary', 'banded', 187.25),
    (v_rate_set_id, 'member', '35-49', 'primary', 'banded', 262.14),
    (v_rate_set_id, 'member', '50-59', 'primary', 'banded', 337.04),
    (v_rate_set_id, 'member', '60-64', 'primary', 'banded', 393.21),
    (v_rate_set_id, 'member_spouse', '18-34', 'primary', 'banded', 411.94),
    (v_rate_set_id, 'member_spouse', '35-49', 'primary', 'banded', 576.71),
    (v_rate_set_id, 'member_spouse', '50-59', 'primary', 'banded', 741.49),
    (v_rate_set_id, 'member_spouse', '60-64', 'primary', 'banded', 865.07),
    (v_rate_set_id, 'member_children', '18-34', 'primary', 'banded', 337.04),
    (v_rate_set_id, 'member_children', '35-49', 'primary', 'banded', 471.86),
    (v_rate_set_id, 'member_children', '50-59', 'primary', 'banded', 606.67),
    (v_rate_set_id, 'member_children', '60-64', 'primary', 'banded', 707.79),
    (v_rate_set_id, 'family', '18-34', 'primary', 'banded', 561.74),
    (v_rate_set_id, 'family', '35-49', 'primary', 'banded', 786.43),
    (v_rate_set_id, 'family', '50-59', 'primary', 'banded', 1011.12),
    (v_rate_set_id, 'family', '60-64', 'primary', 'banded', 1179.64);

  INSERT INTO public.plan_fees (rate_set_id, fee_key, label, fee_type, amount, applies_to, enabled, sort_order, meta)
  VALUES
    (v_rate_set_id, 'enrollment-contribution', 'Enrollment Contribution', 'flat_one_time', 800, 'enrollment', true, 0,
     '{"splits":{"referringMember":100,"adminOps":50,"partnerMarketing":25,"pifh":25}}'::jsonb),
    (v_rate_set_id, 'partnership-cost', 'Partnership Cost (Doctor/Nurse)', 'flat_monthly', 0, 'quote', false, 1, '{}'::jsonb),
    (v_rate_set_id, 'wellness-lab', 'Wellness Lab Panel', 'flat_monthly', 0, 'quote', false, 2, '{}'::jsonb);

  INSERT INTO public.plan_rate_sets (
    plan_id, rate_set_key, label, effective_date, rating_model,
    age_bands, tobacco_config, age_rating_basis
  ) VALUES (
    v_plan_id, 'rates_2026', 'MSA Provisional Rates (2026)', '2026-01-01', 'tiered_household',
    v_age_bands, '{"enabled": false}'::jsonb, 'primary'
  )
  ON CONFLICT (plan_id, rate_set_key) DO UPDATE SET
    label = EXCLUDED.label,
    effective_date = EXCLUDED.effective_date,
    rating_model = EXCLUDED.rating_model,
    age_bands = EXCLUDED.age_bands,
    age_rating_basis = EXCLUDED.age_rating_basis,
    tobacco_config = EXCLUDED.tobacco_config,
    updated_at = now()
  RETURNING id INTO v_rate_set_id;

  IF v_rate_set_id IS NULL THEN
    SELECT id INTO v_rate_set_id FROM public.plan_rate_sets
    WHERE plan_id = v_plan_id AND rate_set_key = 'rates_2026';
  END IF;

  DELETE FROM public.plan_rate_entries WHERE rate_set_id = v_rate_set_id;
  DELETE FROM public.plan_fees WHERE rate_set_id = v_rate_set_id;

  INSERT INTO public.plan_rate_entries (rate_set_id, coverage_tier, age_band_id, person_type, rate_type, amount)
  VALUES
    (v_rate_set_id, 'member', '18-34', 'primary', 'banded', 187.25),
    (v_rate_set_id, 'member', '35-49', 'primary', 'banded', 262.14),
    (v_rate_set_id, 'member', '50-59', 'primary', 'banded', 337.04),
    (v_rate_set_id, 'member', '60-64', 'primary', 'banded', 393.21),
    (v_rate_set_id, 'member_spouse', '18-34', 'primary', 'banded', 411.94),
    (v_rate_set_id, 'member_spouse', '35-49', 'primary', 'banded', 576.71),
    (v_rate_set_id, 'member_spouse', '50-59', 'primary', 'banded', 741.49),
    (v_rate_set_id, 'member_spouse', '60-64', 'primary', 'banded', 865.07),
    (v_rate_set_id, 'member_children', '18-34', 'primary', 'banded', 337.04),
    (v_rate_set_id, 'member_children', '35-49', 'primary', 'banded', 471.86),
    (v_rate_set_id, 'member_children', '50-59', 'primary', 'banded', 606.67),
    (v_rate_set_id, 'member_children', '60-64', 'primary', 'banded', 707.79),
    (v_rate_set_id, 'family', '18-34', 'primary', 'banded', 561.74),
    (v_rate_set_id, 'family', '35-49', 'primary', 'banded', 786.43),
    (v_rate_set_id, 'family', '50-59', 'primary', 'banded', 1011.12),
    (v_rate_set_id, 'family', '60-64', 'primary', 'banded', 1179.64);

  INSERT INTO public.plan_fees (rate_set_id, fee_key, label, fee_type, amount, applies_to, enabled, sort_order, meta)
  VALUES
    (v_rate_set_id, 'enrollment-contribution', 'Enrollment Contribution', 'flat_one_time', 800, 'enrollment', true, 0,
     '{"splits":{"referringMember":100,"adminOps":50,"partnerMarketing":25,"pifh":25}}'::jsonb),
    (v_rate_set_id, 'partnership-cost', 'Partnership Cost (Doctor/Nurse)', 'flat_monthly', 0, 'quote', false, 1, '{}'::jsonb),
    (v_rate_set_id, 'wellness-lab', 'Wellness Lab Panel', 'flat_monthly', 0, 'quote', false, 2, '{}'::jsonb);

  -- PIFH-MSA-GRP-2500
  INSERT INTO public.plans (
    organization_id, name, code, plan_code, brand_name, internal_name,
    category, effective_year, is_active, public_visible, description,
    rating_model, iua_amount, default_iua, enrollment_fee, metadata
  ) VALUES (
    v_org_id,
    'MSA Group $2,500 IUA',
    'PIFH-MSA-GRP-2500',
    'PIFH-MSA-GRP-2500',
    'MSA Group $2,500 IUA',
    'pifh_msa_grp_2500',
    'healthshare',
    2026,
    true,
    true,
    'Provisional MSA group sharing — IUA $2,500. Partnership & wellness lab costs not included.',
    'tiered_household',
    2500,
    2500,
    800,
    '{"product_line":"msa","market_segment":"group","age_rating_basis":"primary","provisional":true,"excludes":["partnership_costs","wellness_lab"],"iua_amount":2500}'::jsonb
  )
  ON CONFLICT (organization_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    plan_code = EXCLUDED.plan_code,
    brand_name = EXCLUDED.brand_name,
    category = EXCLUDED.category,
    rating_model = EXCLUDED.rating_model,
    iua_amount = EXCLUDED.iua_amount,
    default_iua = EXCLUDED.default_iua,
    enrollment_fee = EXCLUDED.enrollment_fee,
    metadata = EXCLUDED.metadata,
    public_visible = EXCLUDED.public_visible,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING id INTO v_plan_id;

  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM public.plans WHERE organization_id = v_org_id AND code = 'PIFH-MSA-GRP-2500';
  END IF;

  INSERT INTO public.plan_rate_sets (
    plan_id, rate_set_key, label, effective_date, rating_model,
    age_bands, tobacco_config, age_rating_basis
  ) VALUES (
    v_plan_id, 'current', 'MSA Provisional Rates', '2026-08-01', 'tiered_household',
    v_age_bands, '{"enabled": false}'::jsonb, 'primary'
  )
  ON CONFLICT (plan_id, rate_set_key) DO UPDATE SET
    label = EXCLUDED.label,
    effective_date = EXCLUDED.effective_date,
    rating_model = EXCLUDED.rating_model,
    age_bands = EXCLUDED.age_bands,
    age_rating_basis = EXCLUDED.age_rating_basis,
    tobacco_config = EXCLUDED.tobacco_config,
    updated_at = now()
  RETURNING id INTO v_rate_set_id;

  IF v_rate_set_id IS NULL THEN
    SELECT id INTO v_rate_set_id FROM public.plan_rate_sets
    WHERE plan_id = v_plan_id AND rate_set_key = 'current';
  END IF;

  DELETE FROM public.plan_rate_entries WHERE rate_set_id = v_rate_set_id;
  DELETE FROM public.plan_fees WHERE rate_set_id = v_rate_set_id;

  INSERT INTO public.plan_rate_entries (rate_set_id, coverage_tier, age_band_id, person_type, rate_type, amount)
  VALUES
    (v_rate_set_id, 'member', '18-34', 'primary', 'banded', 149.8),
    (v_rate_set_id, 'member', '35-49', 'primary', 'banded', 209.71),
    (v_rate_set_id, 'member', '50-59', 'primary', 'banded', 259.52),
    (v_rate_set_id, 'member', '60-64', 'primary', 'banded', 302.78),
    (v_rate_set_id, 'member_spouse', '18-34', 'primary', 'banded', 329.55),
    (v_rate_set_id, 'member_spouse', '35-49', 'primary', 'banded', 461.37),
    (v_rate_set_id, 'member_spouse', '50-59', 'primary', 'banded', 570.95),
    (v_rate_set_id, 'member_spouse', '60-64', 'primary', 'banded', 666.11),
    (v_rate_set_id, 'member_children', '18-34', 'primary', 'banded', 269.63),
    (v_rate_set_id, 'member_children', '35-49', 'primary', 'banded', 377.49),
    (v_rate_set_id, 'member_children', '50-59', 'primary', 'banded', 467.14),
    (v_rate_set_id, 'member_children', '60-64', 'primary', 'banded', 545),
    (v_rate_set_id, 'family', '18-34', 'primary', 'banded', 449.39),
    (v_rate_set_id, 'family', '35-49', 'primary', 'banded', 629.14),
    (v_rate_set_id, 'family', '50-59', 'primary', 'banded', 778.56),
    (v_rate_set_id, 'family', '60-64', 'primary', 'banded', 908.33);

  INSERT INTO public.plan_fees (rate_set_id, fee_key, label, fee_type, amount, applies_to, enabled, sort_order, meta)
  VALUES
    (v_rate_set_id, 'enrollment-contribution', 'Enrollment Contribution', 'flat_one_time', 800, 'enrollment', true, 0,
     '{"splits":{"referringMember":100,"adminOps":50,"partnerMarketing":25,"pifh":25}}'::jsonb),
    (v_rate_set_id, 'partnership-cost', 'Partnership Cost (Doctor/Nurse)', 'flat_monthly', 0, 'quote', false, 1, '{}'::jsonb),
    (v_rate_set_id, 'wellness-lab', 'Wellness Lab Panel', 'flat_monthly', 0, 'quote', false, 2, '{}'::jsonb);

  INSERT INTO public.plan_rate_sets (
    plan_id, rate_set_key, label, effective_date, rating_model,
    age_bands, tobacco_config, age_rating_basis
  ) VALUES (
    v_plan_id, 'rates_2026', 'MSA Provisional Rates (2026)', '2026-01-01', 'tiered_household',
    v_age_bands, '{"enabled": false}'::jsonb, 'primary'
  )
  ON CONFLICT (plan_id, rate_set_key) DO UPDATE SET
    label = EXCLUDED.label,
    effective_date = EXCLUDED.effective_date,
    rating_model = EXCLUDED.rating_model,
    age_bands = EXCLUDED.age_bands,
    age_rating_basis = EXCLUDED.age_rating_basis,
    tobacco_config = EXCLUDED.tobacco_config,
    updated_at = now()
  RETURNING id INTO v_rate_set_id;

  IF v_rate_set_id IS NULL THEN
    SELECT id INTO v_rate_set_id FROM public.plan_rate_sets
    WHERE plan_id = v_plan_id AND rate_set_key = 'rates_2026';
  END IF;

  DELETE FROM public.plan_rate_entries WHERE rate_set_id = v_rate_set_id;
  DELETE FROM public.plan_fees WHERE rate_set_id = v_rate_set_id;

  INSERT INTO public.plan_rate_entries (rate_set_id, coverage_tier, age_band_id, person_type, rate_type, amount)
  VALUES
    (v_rate_set_id, 'member', '18-34', 'primary', 'banded', 149.8),
    (v_rate_set_id, 'member', '35-49', 'primary', 'banded', 209.71),
    (v_rate_set_id, 'member', '50-59', 'primary', 'banded', 259.52),
    (v_rate_set_id, 'member', '60-64', 'primary', 'banded', 302.78),
    (v_rate_set_id, 'member_spouse', '18-34', 'primary', 'banded', 329.55),
    (v_rate_set_id, 'member_spouse', '35-49', 'primary', 'banded', 461.37),
    (v_rate_set_id, 'member_spouse', '50-59', 'primary', 'banded', 570.95),
    (v_rate_set_id, 'member_spouse', '60-64', 'primary', 'banded', 666.11),
    (v_rate_set_id, 'member_children', '18-34', 'primary', 'banded', 269.63),
    (v_rate_set_id, 'member_children', '35-49', 'primary', 'banded', 377.49),
    (v_rate_set_id, 'member_children', '50-59', 'primary', 'banded', 467.14),
    (v_rate_set_id, 'member_children', '60-64', 'primary', 'banded', 545),
    (v_rate_set_id, 'family', '18-34', 'primary', 'banded', 449.39),
    (v_rate_set_id, 'family', '35-49', 'primary', 'banded', 629.14),
    (v_rate_set_id, 'family', '50-59', 'primary', 'banded', 778.56),
    (v_rate_set_id, 'family', '60-64', 'primary', 'banded', 908.33);

  INSERT INTO public.plan_fees (rate_set_id, fee_key, label, fee_type, amount, applies_to, enabled, sort_order, meta)
  VALUES
    (v_rate_set_id, 'enrollment-contribution', 'Enrollment Contribution', 'flat_one_time', 800, 'enrollment', true, 0,
     '{"splits":{"referringMember":100,"adminOps":50,"partnerMarketing":25,"pifh":25}}'::jsonb),
    (v_rate_set_id, 'partnership-cost', 'Partnership Cost (Doctor/Nurse)', 'flat_monthly', 0, 'quote', false, 1, '{}'::jsonb),
    (v_rate_set_id, 'wellness-lab', 'Wellness Lab Panel', 'flat_monthly', 0, 'quote', false, 2, '{}'::jsonb);

  -- PIFH-MSA-GRP-5000
  INSERT INTO public.plans (
    organization_id, name, code, plan_code, brand_name, internal_name,
    category, effective_year, is_active, public_visible, description,
    rating_model, iua_amount, default_iua, enrollment_fee, metadata
  ) VALUES (
    v_org_id,
    'MSA Group $5,000 IUA',
    'PIFH-MSA-GRP-5000',
    'PIFH-MSA-GRP-5000',
    'MSA Group $5,000 IUA',
    'pifh_msa_grp_5000',
    'healthshare',
    2026,
    true,
    true,
    'Provisional MSA group sharing — IUA $5,000. Partnership & wellness lab costs not included.',
    'tiered_household',
    5000,
    5000,
    800,
    '{"product_line":"msa","market_segment":"group","age_rating_basis":"primary","provisional":true,"excludes":["partnership_costs","wellness_lab"],"iua_amount":5000}'::jsonb
  )
  ON CONFLICT (organization_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    plan_code = EXCLUDED.plan_code,
    brand_name = EXCLUDED.brand_name,
    category = EXCLUDED.category,
    rating_model = EXCLUDED.rating_model,
    iua_amount = EXCLUDED.iua_amount,
    default_iua = EXCLUDED.default_iua,
    enrollment_fee = EXCLUDED.enrollment_fee,
    metadata = EXCLUDED.metadata,
    public_visible = EXCLUDED.public_visible,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING id INTO v_plan_id;

  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM public.plans WHERE organization_id = v_org_id AND code = 'PIFH-MSA-GRP-5000';
  END IF;

  INSERT INTO public.plan_rate_sets (
    plan_id, rate_set_key, label, effective_date, rating_model,
    age_bands, tobacco_config, age_rating_basis
  ) VALUES (
    v_plan_id, 'current', 'MSA Provisional Rates', '2026-08-01', 'tiered_household',
    v_age_bands, '{"enabled": false}'::jsonb, 'primary'
  )
  ON CONFLICT (plan_id, rate_set_key) DO UPDATE SET
    label = EXCLUDED.label,
    effective_date = EXCLUDED.effective_date,
    rating_model = EXCLUDED.rating_model,
    age_bands = EXCLUDED.age_bands,
    age_rating_basis = EXCLUDED.age_rating_basis,
    tobacco_config = EXCLUDED.tobacco_config,
    updated_at = now()
  RETURNING id INTO v_rate_set_id;

  IF v_rate_set_id IS NULL THEN
    SELECT id INTO v_rate_set_id FROM public.plan_rate_sets
    WHERE plan_id = v_plan_id AND rate_set_key = 'current';
  END IF;

  DELETE FROM public.plan_rate_entries WHERE rate_set_id = v_rate_set_id;
  DELETE FROM public.plan_fees WHERE rate_set_id = v_rate_set_id;

  INSERT INTO public.plan_rate_entries (rate_set_id, coverage_tier, age_band_id, person_type, rate_type, amount)
  VALUES
    (v_rate_set_id, 'member', '18-34', 'primary', 'banded', 108.6),
    (v_rate_set_id, 'member', '35-49', 'primary', 'banded', 152.04),
    (v_rate_set_id, 'member', '50-59', 'primary', 'banded', 195.48),
    (v_rate_set_id, 'member', '60-64', 'primary', 'banded', 228.06),
    (v_rate_set_id, 'member_spouse', '18-34', 'primary', 'banded', 238.92),
    (v_rate_set_id, 'member_spouse', '35-49', 'primary', 'banded', 334.49),
    (v_rate_set_id, 'member_spouse', '50-59', 'primary', 'banded', 430.06),
    (v_rate_set_id, 'member_spouse', '60-64', 'primary', 'banded', 501.74),
    (v_rate_set_id, 'member_children', '18-34', 'primary', 'banded', 195.48),
    (v_rate_set_id, 'member_children', '35-49', 'primary', 'banded', 273.68),
    (v_rate_set_id, 'member_children', '50-59', 'primary', 'banded', 351.87),
    (v_rate_set_id, 'member_children', '60-64', 'primary', 'banded', 410.52),
    (v_rate_set_id, 'family', '18-34', 'primary', 'banded', 325.81),
    (v_rate_set_id, 'family', '35-49', 'primary', 'banded', 456.13),
    (v_rate_set_id, 'family', '50-59', 'primary', 'banded', 586.45),
    (v_rate_set_id, 'family', '60-64', 'primary', 'banded', 684.19);

  INSERT INTO public.plan_fees (rate_set_id, fee_key, label, fee_type, amount, applies_to, enabled, sort_order, meta)
  VALUES
    (v_rate_set_id, 'enrollment-contribution', 'Enrollment Contribution', 'flat_one_time', 800, 'enrollment', true, 0,
     '{"splits":{"referringMember":100,"adminOps":50,"partnerMarketing":25,"pifh":25}}'::jsonb),
    (v_rate_set_id, 'partnership-cost', 'Partnership Cost (Doctor/Nurse)', 'flat_monthly', 0, 'quote', false, 1, '{}'::jsonb),
    (v_rate_set_id, 'wellness-lab', 'Wellness Lab Panel', 'flat_monthly', 0, 'quote', false, 2, '{}'::jsonb);

  INSERT INTO public.plan_rate_sets (
    plan_id, rate_set_key, label, effective_date, rating_model,
    age_bands, tobacco_config, age_rating_basis
  ) VALUES (
    v_plan_id, 'rates_2026', 'MSA Provisional Rates (2026)', '2026-01-01', 'tiered_household',
    v_age_bands, '{"enabled": false}'::jsonb, 'primary'
  )
  ON CONFLICT (plan_id, rate_set_key) DO UPDATE SET
    label = EXCLUDED.label,
    effective_date = EXCLUDED.effective_date,
    rating_model = EXCLUDED.rating_model,
    age_bands = EXCLUDED.age_bands,
    age_rating_basis = EXCLUDED.age_rating_basis,
    tobacco_config = EXCLUDED.tobacco_config,
    updated_at = now()
  RETURNING id INTO v_rate_set_id;

  IF v_rate_set_id IS NULL THEN
    SELECT id INTO v_rate_set_id FROM public.plan_rate_sets
    WHERE plan_id = v_plan_id AND rate_set_key = 'rates_2026';
  END IF;

  DELETE FROM public.plan_rate_entries WHERE rate_set_id = v_rate_set_id;
  DELETE FROM public.plan_fees WHERE rate_set_id = v_rate_set_id;

  INSERT INTO public.plan_rate_entries (rate_set_id, coverage_tier, age_band_id, person_type, rate_type, amount)
  VALUES
    (v_rate_set_id, 'member', '18-34', 'primary', 'banded', 108.6),
    (v_rate_set_id, 'member', '35-49', 'primary', 'banded', 152.04),
    (v_rate_set_id, 'member', '50-59', 'primary', 'banded', 195.48),
    (v_rate_set_id, 'member', '60-64', 'primary', 'banded', 228.06),
    (v_rate_set_id, 'member_spouse', '18-34', 'primary', 'banded', 238.92),
    (v_rate_set_id, 'member_spouse', '35-49', 'primary', 'banded', 334.49),
    (v_rate_set_id, 'member_spouse', '50-59', 'primary', 'banded', 430.06),
    (v_rate_set_id, 'member_spouse', '60-64', 'primary', 'banded', 501.74),
    (v_rate_set_id, 'member_children', '18-34', 'primary', 'banded', 195.48),
    (v_rate_set_id, 'member_children', '35-49', 'primary', 'banded', 273.68),
    (v_rate_set_id, 'member_children', '50-59', 'primary', 'banded', 351.87),
    (v_rate_set_id, 'member_children', '60-64', 'primary', 'banded', 410.52),
    (v_rate_set_id, 'family', '18-34', 'primary', 'banded', 325.81),
    (v_rate_set_id, 'family', '35-49', 'primary', 'banded', 456.13),
    (v_rate_set_id, 'family', '50-59', 'primary', 'banded', 586.45),
    (v_rate_set_id, 'family', '60-64', 'primary', 'banded', 684.19);

  INSERT INTO public.plan_fees (rate_set_id, fee_key, label, fee_type, amount, applies_to, enabled, sort_order, meta)
  VALUES
    (v_rate_set_id, 'enrollment-contribution', 'Enrollment Contribution', 'flat_one_time', 800, 'enrollment', true, 0,
     '{"splits":{"referringMember":100,"adminOps":50,"partnerMarketing":25,"pifh":25}}'::jsonb),
    (v_rate_set_id, 'partnership-cost', 'Partnership Cost (Doctor/Nurse)', 'flat_monthly', 0, 'quote', false, 1, '{}'::jsonb),
    (v_rate_set_id, 'wellness-lab', 'Wellness Lab Panel', 'flat_monthly', 0, 'quote', false, 2, '{}'::jsonb);

END $$;

-- Keep admin rate-config saves in sync with fee_key / meta columns
CREATE OR REPLACE FUNCTION public.replace_plan_fees(
  p_rate_set_id uuid,
  p_fees        jsonb
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
BEGIN
  DELETE FROM public.plan_fees WHERE rate_set_id = p_rate_set_id;

  IF p_fees IS NOT NULL AND jsonb_typeof(p_fees) = 'array' AND jsonb_array_length(p_fees) > 0 THEN
    INSERT INTO public.plan_fees (
      rate_set_id,
      fee_key,
      label,
      fee_type,
      amount,
      applies_to,
      enabled,
      sort_order,
      meta
    )
    SELECT
      p_rate_set_id,
      e->>'fee_key',
      e->>'label',
      e->>'fee_type',
      (e->>'amount')::numeric,
      COALESCE(e->>'applies_to', 'quote'),
      COALESCE((e->>'enabled')::boolean, true),
      COALESCE((e->>'sort_order')::int, 0),
      COALESCE(e->'meta', '{}'::jsonb)
    FROM jsonb_array_elements(p_fees) AS e;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;

  RETURN v_inserted;
END;
$$;

-- Expected counts after apply (abort check for operators):
--   plans with code like 'PIFH-MSA-%' = 6
--   plan_rate_sets for those plans = 12
--   plan_rate_entries = 96 * 2 rate sets = 192
--
-- Rollback:
--   DELETE FROM plan_rate_entries WHERE rate_set_id IN (
--     SELECT rs.id FROM plan_rate_sets rs JOIN plans p ON p.id = rs.plan_id WHERE p.code LIKE 'PIFH-MSA-%');
--   DELETE FROM plan_fees WHERE rate_set_id IN (...same...);
--   DELETE FROM plan_rate_sets WHERE plan_id IN (SELECT id FROM plans WHERE code LIKE 'PIFH-MSA-%');
--   DELETE FROM plans WHERE code LIKE 'PIFH-MSA-%';
--   DELETE FROM system_settings WHERE setting_key LIKE 'enrollment_contribution_%'
--     AND organization_id = '00000000-0000-0000-0000-000000000001';
--   ALTER TABLE plan_rate_sets DROP COLUMN IF EXISTS age_rating_basis;
--   ALTER TABLE plan_fees DROP COLUMN IF EXISTS fee_key;
--   ALTER TABLE plan_fees DROP COLUMN IF EXISTS meta;
