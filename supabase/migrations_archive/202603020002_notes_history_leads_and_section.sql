-- Migration: Add notes_history field to leads module, move to prominent section,
-- and update both layouts so Notes History is visible and uncollapsed.
-- Date: 2026-03-02

DO $$
DECLARE
  v_org_id uuid := 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';
  v_contacts_module_id uuid := '7913796d-bda6-4fff-b81d-5f707b06b71b';
  v_leads_module_id uuid := 'd2eebec8-1612-4ed2-a240-0c40fefe6ec5';
BEGIN

  -- 1. Add notes_history to leads module (contacts already has it)
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, section, display_order)
  VALUES (v_org_id, v_leads_module_id, 'notes_history', 'Notes History', 'textarea', false, false, 'notes_history', 1)
  ON CONFLICT (module_id, key) DO UPDATE SET
    label = EXCLUDED.label,
    section = EXCLUDED.section,
    display_order = EXCLUDED.display_order;

  -- 2. Move contacts notes_history from 'system' section to 'notes_history' section
  UPDATE crm_fields
  SET section = 'notes_history', display_order = 1
  WHERE module_id = v_contacts_module_id
    AND key = 'notes_history';

  -- 3. Update Default Contact Layout: insert notes_history section after core
  UPDATE crm_layouts
  SET config = '{"sections":[
    {"key":"core","label":"Contact Information","columns":2},
    {"key":"notes_history","label":"Notes History","columns":1},
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

  -- 4. Update Default Lead Layout: insert notes_history section after core
  UPDATE crm_layouts
  SET config = '{"sections":[
    {"key":"core","label":"Lead Information","columns":2},
    {"key":"notes_history","label":"Notes History","columns":1},
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

  RAISE NOTICE 'notes_history field added to leads and moved to prominent section for both modules';
END $$;
