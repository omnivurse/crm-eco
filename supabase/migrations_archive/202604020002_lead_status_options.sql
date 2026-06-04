-- Update contact_status options for leads module with client-requested values
DO $$
DECLARE
  v_mod record;
BEGIN
  FOR v_mod IN
    SELECT id, org_id FROM crm_modules WHERE key = 'leads'
  LOOP
    UPDATE crm_fields
    SET options = '["New","Contacted","In Process","Qualified","Future Prospect","Pending","Converted","Unqualified","Lost"]'::jsonb
    WHERE module_id = v_mod.id AND key = 'contact_status';

    -- Also update lead_status if it exists
    UPDATE crm_fields
    SET options = '["New","Contacted","In Process","Qualified","Future Prospect","Pending","Converted","Unqualified","Lost"]'::jsonb
    WHERE module_id = v_mod.id AND key = 'lead_status';
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
