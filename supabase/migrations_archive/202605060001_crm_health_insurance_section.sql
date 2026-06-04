-- Dedicated "Health Insurance" section (ACA / major medical) on contacts / leads / members.
-- Complements — does not replace — Health Share (ministries / sharing orgs): many households
-- consider one or both; both sections stay exposed side-by-side in the layout.
-- Also separate from legacy insurance_coverage shorthand fields and other_coverage supplements.

ALTER TABLE crm_fields ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE
  v_org_id uuid;
  v_module_id uuid;
  v_hi jsonb :=
    '{"key":"health_insurance","label":"Health Insurance (major medical)","columns":2,"accent":"sky","collapsed":false}'::jsonb;
  r record;
  v_sections jsonb;
  v_elem jsonb;
  v_new jsonb;
  v_have_hi boolean;
  v_inserted boolean;
BEGIN
  FOR v_org_id IN SELECT DISTINCT org_id FROM crm_modules WHERE key IN ('contacts', 'leads', 'members')
  LOOP
    FOR v_module_id IN
      SELECT id FROM crm_modules
       WHERE org_id = v_org_id AND key IN ('contacts', 'leads', 'members')
    LOOP
      INSERT INTO crm_fields (
        org_id, module_id, key, label, type, required,
        is_system, display_order, section, width, tooltip
      ) VALUES
        (v_org_id, v_module_id,
         'health_insurance_carrier', 'Insurance carrier', 'select',
         false, false, 275, 'health_insurance', 'half',
         'Major medical / ACA insurer'),
        (v_org_id, v_module_id,
         'health_insurance_plan_name', 'Plan name', 'text',
         false, false, 276, 'health_insurance', 'half', NULL),
        (v_org_id, v_module_id,
         'health_insurance_deductible', 'Annual deductible', 'currency',
         false, false, 277, 'health_insurance', 'half', NULL),
        (v_org_id, v_module_id,
         'health_insurance_max_out_of_pocket', 'Max out-of-pocket', 'currency',
         false, false, 278, 'health_insurance', 'half',
         'Family or individual MOOP depending on enrollment'),
        (v_org_id, v_module_id,
         'health_insurance_premium', 'Monthly premium', 'currency',
         false, false, 279, 'health_insurance', 'half',
         'Before tax credit unless noted otherwise'),
        (v_org_id, v_module_id,
         'health_insurance_tax_credit_amount', 'Tax credit (APTC)', 'currency',
         false, false, 280, 'health_insurance', 'half',
         'Subsidy / advance premium tax credit amount'),
        (v_org_id, v_module_id,
         'health_insurance_annual_income', 'Household income (annual)', 'currency',
         false, false, 281, 'health_insurance', 'half',
         'Baseline used when quoting subsidies'),
        (v_org_id, v_module_id,
         'health_insurance_coverage_year', 'Coverage year', 'text',
         false, false, 282, 'health_insurance', 'half',
         'Plan / policy year, e.g. 2026'),
        (v_org_id, v_module_id,
         'health_insurance_start_date', 'Coverage start', 'date',
         false, false, 283, 'health_insurance', 'half', NULL),
        (v_org_id, v_module_id,
         'health_insurance_end_date', 'Coverage end', 'date',
         false, false, 284, 'health_insurance', 'half',
         'Termination or renewal boundary'),
        (v_org_id, v_module_id,
         'health_insurance_status', 'Status', 'select',
         false, false, 285, 'health_insurance', 'half', NULL)
      ON CONFLICT (module_id, key) DO NOTHING;

      UPDATE crm_fields SET options =
        '["Anthem","Cigna","Kaiser","UnitedHealthcare","Aetna","Humana","Blue Cross","Oscar","Molina","Centene/Ambetter","Florida Blue","Select Health","RMHP","Other"]'::jsonb
      WHERE module_id = v_module_id AND key = 'health_insurance_carrier';

      UPDATE crm_fields SET options =
        '["Active","Pending","Terminated","Cancelled","Proposed"]'::jsonb
      WHERE module_id = v_module_id AND key = 'health_insurance_status';

      UPDATE crm_fields
         SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('carrier_type', 'insurance')
       WHERE module_id = v_module_id AND key = 'health_insurance_carrier';
    END LOOP;
  END LOOP;

  -------------------------------------------------------------------------
  -- Patch default layouts (insert Health Insurance row once per layout JSON).
  -- Prefer position right after Health Share; else before insurance_coverage;
  -- else before other_coverage; else append.
  -------------------------------------------------------------------------
  FOR r IN
    SELECT cl.id AS layout_id, cl.config
      FROM crm_layouts cl
      JOIN crm_modules m ON m.id = cl.module_id
     WHERE cl.is_default = true
       AND m.key IN ('contacts', 'leads', 'members')
  LOOP
    v_sections := COALESCE(r.config->'sections', '[]'::jsonb);

    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_sections) e(value)
      WHERE value->>'key' = 'health_insurance'
    ) INTO v_have_hi;

    IF v_have_hi THEN
      CONTINUE;
    END IF;

    v_new := '[]'::jsonb;
    v_inserted := false;

    FOR v_elem IN SELECT value FROM jsonb_array_elements(v_sections) AS x(value)
    LOOP
      IF v_elem->>'key' = 'health_insurance' THEN
        CONTINUE;
      END IF;

      IF v_elem->>'key' = 'health_sharing' THEN
        v_new := v_new || jsonb_build_array(v_elem);
        IF NOT v_inserted THEN
          v_new := v_new || jsonb_build_array(v_hi);
          v_inserted := true;
        END IF;
      ELSIF v_elem->>'key' = 'insurance_coverage' AND NOT v_inserted THEN
        v_new := v_new || jsonb_build_array(v_hi);
        v_new := v_new || jsonb_build_array(v_elem);
        v_inserted := true;
      ELSIF v_elem->>'key' = 'other_coverage' AND NOT v_inserted THEN
        v_new := v_new || jsonb_build_array(v_hi);
        v_new := v_new || jsonb_build_array(v_elem);
        v_inserted := true;
      ELSE
        v_new := v_new || jsonb_build_array(v_elem);
      END IF;
    END LOOP;

    IF NOT v_inserted THEN
      v_new := v_sections || jsonb_build_array(v_hi);
    END IF;

    UPDATE crm_layouts
       SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{sections}', v_new, true),
           updated_at = now()
     WHERE id = r.layout_id;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
