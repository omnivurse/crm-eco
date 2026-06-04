-- Migration: Insert ALL field definitions for Contacts and Leads modules
-- Target: System Administration org
-- Date: 2026-02-14

DO $$
DECLARE
  v_org_id uuid := 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';
  v_contacts_module_id uuid := '7913796d-bda6-4fff-b81d-5f707b06b71b';
  v_leads_module_id uuid := 'd2eebec8-1612-4ed2-a240-0c40fefe6ec5';
  v_module_id uuid;
  v_display_order int;
BEGIN

  -- ============================================================
  -- CONTACTS FIELDS
  -- ============================================================
  v_module_id := v_contacts_module_id;
  v_display_order := 0;

  -- ---- Section: core ----
  -- NOTE: 'record_id' field removed — Zoho record IDs are stored as 'zoho_record_id'
  -- in the JSONB data column. See system section for the zoho_record_id field.

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'first_name', 'First Name', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'last_name', 'Last Name', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'contact_name', 'Contact Name', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'salutation', 'Salutation', 'select', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'middle_initial', 'Middle Initial', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'title', 'Title', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'email', 'Email', 'email', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'secondary_email', 'Secondary Email', 'email', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'phone', 'Phone', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mobile', 'Mobile', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'work_phone', 'Work Phone', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'fax', 'Fax', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'date_of_birth', 'Date of Birth', 'date', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'birth_month', 'Birth Month', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order, options)
  VALUES (v_org_id, v_module_id, 'primary_member_gender', 'Primary Member Gender', 'select', 'core', v_display_order, '["Male","Female","Other"]'::jsonb)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order, options)
  VALUES (v_org_id, v_module_id, 'marital_status', 'Marital Status', 'select', 'core', v_display_order, '["Single","Married","Divorced","Widowed"]'::jsonb)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: management ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'contact_status', 'Contact Status', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'contact_owner', 'Contact Owner', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'lead_source', 'Lead Source', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'affiliate', 'Affiliate', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'producer_name', 'Producer Name', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'referral_source', 'Referral Source', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'referring_member', 'Referring Member', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'tag', 'Tag', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'territories', 'Territories', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'company_association', 'Company Association', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'data_source', 'Data Source', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: address ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mailing_street', 'Mailing Street', 'text', 'address', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mailing_city', 'Mailing City', 'text', 'address', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mailing_state', 'Mailing State', 'text', 'address', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mailing_zip', 'Mailing Zip', 'text', 'address', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: family_spouse ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'spouse', 'Spouse', 'text', 'family_spouse', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'spouse_dob', 'Spouse DOB', 'date', 'family_spouse', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'spouse_ss_number', 'Spouse SS Number', 'text', 'family_spouse', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'spouse_address', 'Spouse Address', 'text', 'family_spouse', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'spouse_phone_number', 'Spouse Phone Number', 'text', 'family_spouse', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'spouse_email', 'Spouse Email', 'email', 'family_spouse', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: family_children ----
  -- Child 1
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_1', 'Child 1', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_1_dob', 'Child 1 DOB', 'date', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_1_ss_number', 'Child 1 SS Number', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_1_address', 'Child 1 Address', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_1_phone_number', 'Child 1 Phone Number', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_1_email', 'Child 1 Email', 'email', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- Child 2
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_2', 'Child 2', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_2_dob', 'Child 2 DOB', 'date', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_2_ss_number', 'Child 2 SS Number', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_2_address', 'Child 2 Address', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_2_phone_number', 'Child 2 Phone Number', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_2_email', 'Child 2 Email', 'email', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- Child 3
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_3', 'Child 3', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_3_dob', 'Child 3 DOB', 'date', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_3_ss_number', 'Child 3 SS Number', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_3_address', 'Child 3 Address', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_3_phone_number', 'Child 3 Phone Number', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_3_email', 'Child 3 Email', 'email', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- Child 4
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_4', 'Child 4', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_4_dob', 'Child 4 DOB', 'date', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_4_ss_number', 'Child 4 SS Number', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_4_address', 'Child 4 Address', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_4_phone_number', 'Child 4 Phone Number', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_4_email', 'Child 4 Email', 'email', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- Child 5
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_5', 'Child 5', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_5_dob', 'Child 5 DOB', 'date', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_5_ss_number', 'Child 5 SS Number', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_5_address', 'Child 5 Address', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_5_phone_number', 'Child 5 Phone Number', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_5_email', 'Child 5 Email', 'email', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: insurance ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'product', 'Product', 'text', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'coverage_option', 'Coverage Option', 'text', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'carrier', 'Carrier', 'text', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'previous_product', 'Previous Product', 'text', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'monthly_premium', 'Monthly Premium', 'number', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'start_date', 'Start Date', 'date', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'cancellation_date', 'Cancellation Date', 'date', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'iua_amount', 'IUA Amount', 'text', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'add_on_product', 'Add-On Product', 'text', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'vision', 'Vision', 'text', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'dental', 'Dental', 'text', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: commissions ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'commission_percentage', 'Commission Percentage', 'number', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'producer_commission', 'Producer Commission', 'number', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'amount_received', 'Amount Received', 'number', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'team_leader', 'Team Leader', 'text', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'team_leader_monthly', 'Team Leader Monthly', 'number', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'team_leader_referral', 'Team Leader Referral', 'number', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'director', 'Director', 'text', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'director_monthly', 'Director Monthly', 'number', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'director_referral', 'Director Referral', 'number', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'affiliate_referral', 'Affiliate Referral', 'text', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'affiliate_rep_monthly', 'Affiliate Rep Monthly', 'number', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'referral_fee', 'Referral Fee', 'number', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'date_referral_paid', 'Date Referral Paid', 'date', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'referral_requirement_satisfied', 'Referral Requirement Satisfied', 'text', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: payment ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'declined', 'Declined', 'boolean', 'payment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'charge_waived', 'Charge Waived', 'boolean', 'payment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'household_annual_adj_gross', 'Household Annual Adj Gross', 'number', 'payment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: identifiers ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'primary_ss_number', 'Primary SS Number', 'text', 'identifiers', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'tax_id', 'Tax ID', 'text', 'identifiers', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mpower_life_code', 'mPower Life Code', 'text', 'identifiers', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'life_code_2nd', 'Life Code 2nd', 'text', 'identifiers', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'life_code_3rd', 'Life Code 3rd', 'text', 'identifiers', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'life_code_4th', 'Life Code 4th', 'text', 'identifiers', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'life_code_5th', 'Life Code 5th', 'text', 'identifiers', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'e123_member_id', 'E123 Member ID', 'text', 'identifiers', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: portal ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'portal_username', 'Portal Username', 'text', 'portal', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'portal_password', 'Portal Password', 'text', 'portal', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'cirrus_registration_date', 'Cirrus Registration Date', 'date', 'portal', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'app_downloaded', 'App Downloaded', 'boolean', 'portal', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'select_conversion_completed', 'Select Conversion Completed', 'boolean', 'portal', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: compliance ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mec_submitted', 'MEC Submitted', 'boolean', 'compliance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mec_decision_confirmed', 'MEC Decision Confirmed', 'boolean', 'compliance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'medical_release_form_on_file', 'Medical Release Form on File', 'boolean', 'compliance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'permission_to_discuss_plan', 'Permission to Discuss Plan', 'boolean', 'compliance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'atap', 'ATAP', 'text', 'compliance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'third_party_payor', 'Third Party Payor', 'text', 'compliance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'risk_assessment_paid', 'Risk Assessment Paid', 'text', 'compliance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: fulfillment ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'welcome_call_status', 'Welcome Call Status', 'text', 'fulfillment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'welcome_call_performed_by', 'Welcome Call Performed By', 'text', 'fulfillment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'wc_outreach_date', 'WC Outreach Date', 'date', 'fulfillment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'fulfillment_letter_mailed', 'Fulfillment Letter Mailed', 'date', 'fulfillment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'fulfillment_email_sent', 'Fulfillment Email Sent', 'date', 'fulfillment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'complete_date', 'Complete Date', 'date', 'fulfillment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: business ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'business_or_practice_name', 'Business or Practice Name', 'text', 'business', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'dpc_name', 'DPC Name', 'text', 'business', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: preferences ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'email_opt_out', 'Email Opt Out', 'boolean', 'preferences', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'preferred_method_of_communication', 'Preferred Method of Communication', 'text', 'preferences', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: system ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'notes_history', 'Notes History', 'textarea', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'created_by_name', 'Created By Name', 'text', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'modified_by_name', 'Modified By Name', 'text', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'zoho_record_id', 'Zoho Record ID', 'text', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'zoho_contact_owner_id', 'Zoho Contact Owner ID', 'text', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'zoho_producer_id', 'Zoho Producer ID', 'text', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'zoho_created_time', 'Zoho Created Time', 'datetime', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'zoho_modified_time', 'Zoho Modified Time', 'datetime', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'locked', 'Locked', 'boolean', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'admin123', 'Admin123', 'text', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ============================================================
  -- LEADS FIELDS
  -- ============================================================
  v_module_id := v_leads_module_id;
  v_display_order := 0;

  -- ---- Section: core ----
  -- NOTE: 'record_id' field removed — Zoho record IDs are stored as 'zoho_record_id'
  -- in the JSONB data column. See system section for the zoho_record_id field.

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'first_name', 'First Name', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'last_name', 'Last Name', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'lead_name', 'Lead Name', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'salutation', 'Salutation', 'select', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'middle_name', 'Middle Name', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'email', 'Email', 'email', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'phone', 'Phone', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mobile', 'Mobile', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mobile_2', 'Mobile 2', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'date_of_birth', 'Date of Birth', 'date', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'company', 'Company', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: address ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'street', 'Street', 'text', 'address', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'city', 'City', 'text', 'address', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'state', 'State', 'text', 'address', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'zip_code', 'Zip Code', 'text', 'address', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: management ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'lead_status', 'Lead Status', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'lead_source', 'Lead Source', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'lead_owner', 'Lead Owner', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'producer', 'Producer', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'referring_member', 'Referring Member', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'tag', 'Tag', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'is_converted', 'Is Converted', 'boolean', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'next_step', 'Next Step', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: product ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'product_type', 'Product Type', 'text', 'product', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'coverage_option', 'Coverage Option', 'text', 'product', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'business_type', 'Business Type', 'text', 'product', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'business_or_practice_name', 'Business or Practice Name', 'text', 'product', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: family ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'spouse', 'Spouse', 'text', 'family', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'spouse_dob', 'Spouse DOB', 'date', 'family', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_1', 'Child 1', 'text', 'family', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_1_dob', 'Child 1 DOB', 'date', 'family', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_2', 'Child 2', 'text', 'family', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_2_dob', 'Child 2 DOB', 'date', 'family', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_3', 'Child 3', 'text', 'family', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_3_dob', 'Child 3 DOB', 'date', 'family', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_4', 'Child 4', 'text', 'family', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_4_dob', 'Child 4 DOB', 'date', 'family', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_5', 'Child 5', 'text', 'family', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_5_dob', 'Child 5 DOB', 'date', 'family', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: conversion ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'converted_date_time', 'Converted Date Time', 'datetime', 'conversion', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'converted_account', 'Converted Account', 'text', 'conversion', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'converted_contact', 'Converted Contact', 'text', 'conversion', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'converted_deal', 'Converted Deal', 'text', 'conversion', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: preferences ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'email_opt_out', 'Email Opt Out', 'boolean', 'preferences', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ---- Section: system ----
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'data_source', 'Data Source', 'text', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'created_by_name', 'Created By Name', 'text', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'modified_by_name', 'Modified By Name', 'text', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'zoho_record_id', 'Zoho Record ID', 'text', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'zoho_lead_owner_id', 'Zoho Lead Owner ID', 'text', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'zoho_producer_id', 'Zoho Producer ID', 'text', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'zoho_created_time', 'Zoho Created Time', 'datetime', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'zoho_modified_time', 'Zoho Modified Time', 'datetime', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'locked', 'Locked', 'boolean', 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, display_order = EXCLUDED.display_order;
  v_display_order := v_display_order + 1;

  -- ============================================================
  -- LAYOUTS
  -- ============================================================

  -- Default Contact Layout (update existing or insert new)
  UPDATE crm_layouts
  SET name = 'Default Contact Layout',
      config = '{"sections":[
        {"key":"core","label":"Contact Information","columns":2},
        {"key":"management","label":"Contact Management","columns":2},
        {"key":"address","label":"Address","columns":2},
        {"key":"family_spouse","label":"Spouse Information","columns":2},
        {"key":"family_children","label":"Children","columns":2,"collapsed":true},
        {"key":"insurance","label":"Insurance / Product","columns":2},
        {"key":"commissions","label":"Commissions & Referrals","columns":2,"collapsed":true},
        {"key":"payment","label":"Payment Information","columns":2},
        {"key":"identifiers","label":"Codes & Identifiers","columns":2,"collapsed":true},
        {"key":"portal","label":"Portal Access","columns":2,"collapsed":true},
        {"key":"compliance","label":"Compliance","columns":2,"collapsed":true},
        {"key":"fulfillment","label":"Welcome & Fulfillment","columns":2,"collapsed":true},
        {"key":"business","label":"Business Information","columns":2},
        {"key":"preferences","label":"Communication Preferences","columns":2},
        {"key":"system","label":"System Information","columns":2,"collapsed":true}
      ]}'::jsonb,
      updated_at = now()
  WHERE module_id = v_contacts_module_id AND is_default = true;

  IF NOT FOUND THEN
    INSERT INTO crm_layouts (org_id, module_id, name, is_default, config)
    VALUES (v_org_id, v_contacts_module_id, 'Default Contact Layout', true,
      '{"sections":[
        {"key":"core","label":"Contact Information","columns":2},
        {"key":"management","label":"Contact Management","columns":2},
        {"key":"address","label":"Address","columns":2},
        {"key":"family_spouse","label":"Spouse Information","columns":2},
        {"key":"family_children","label":"Children","columns":2,"collapsed":true},
        {"key":"insurance","label":"Insurance / Product","columns":2},
        {"key":"commissions","label":"Commissions & Referrals","columns":2,"collapsed":true},
        {"key":"payment","label":"Payment Information","columns":2},
        {"key":"identifiers","label":"Codes & Identifiers","columns":2,"collapsed":true},
        {"key":"portal","label":"Portal Access","columns":2,"collapsed":true},
        {"key":"compliance","label":"Compliance","columns":2,"collapsed":true},
        {"key":"fulfillment","label":"Welcome & Fulfillment","columns":2,"collapsed":true},
        {"key":"business","label":"Business Information","columns":2},
        {"key":"preferences","label":"Communication Preferences","columns":2},
        {"key":"system","label":"System Information","columns":2,"collapsed":true}
      ]}'::jsonb
    );
  END IF;

  -- Default Lead Layout (update existing or insert new)
  UPDATE crm_layouts
  SET name = 'Default Lead Layout',
      config = '{"sections":[
        {"key":"core","label":"Lead Information","columns":2},
        {"key":"address","label":"Address","columns":2},
        {"key":"management","label":"Lead Management","columns":2},
        {"key":"product","label":"Product Interest","columns":2},
        {"key":"family","label":"Family","columns":2,"collapsed":true},
        {"key":"conversion","label":"Conversion","columns":2,"collapsed":true},
        {"key":"preferences","label":"Preferences","columns":2},
        {"key":"system","label":"System Information","columns":2,"collapsed":true}
      ]}'::jsonb,
      updated_at = now()
  WHERE module_id = v_leads_module_id AND is_default = true;

  IF NOT FOUND THEN
    INSERT INTO crm_layouts (org_id, module_id, name, is_default, config)
    VALUES (v_org_id, v_leads_module_id, 'Default Lead Layout', true,
      '{"sections":[
        {"key":"core","label":"Lead Information","columns":2},
        {"key":"address","label":"Address","columns":2},
        {"key":"management","label":"Lead Management","columns":2},
        {"key":"product","label":"Product Interest","columns":2},
        {"key":"family","label":"Family","columns":2,"collapsed":true},
        {"key":"conversion","label":"Conversion","columns":2,"collapsed":true},
        {"key":"preferences","label":"Preferences","columns":2},
        {"key":"system","label":"System Information","columns":2,"collapsed":true}
      ]}'::jsonb
    );
  END IF;

  RAISE NOTICE 'All contact and lead fields created/updated';
END $$;
