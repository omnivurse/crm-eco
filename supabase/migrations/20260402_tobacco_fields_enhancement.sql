-- Improve tobacco field label and add quit date tracking fields

-- Update tobacco_user field label to be clearer
DO $$
DECLARE
  v_mod record;
BEGIN
  FOR v_mod IN
    SELECT id, org_id FROM crm_modules WHERE key IN ('contacts', 'leads', 'members')
  LOOP
    -- Update existing tobacco_user label
    UPDATE crm_fields
    SET label = 'Tobacco User (Check ONLY if yes)',
        tooltip = 'Check this box ONLY if the member currently uses tobacco products. Leave unchecked for non-tobacco users.'
    WHERE module_id = v_mod.id AND key = 'tobacco_user';

    -- Add tobacco quit date and duration fields
    INSERT INTO crm_fields (
      org_id, module_id, key, label, type, required,
      is_system, is_pinned, display_order, section, tooltip
    ) VALUES
      (v_mod.org_id, v_mod.id, 'tobacco_quit_date', 'Tobacco Quit Date', 'date', false,
       false, false, 110, 'management', 'Date the member officially quit using tobacco products'),
      (v_mod.org_id, v_mod.id, 'tobacco_quit_duration', 'Time Since Quitting', 'text', false,
       false, false, 111, 'management', 'How long since the member quit tobacco (auto-calculated or manually entered). Used to determine when the tobacco surcharge can be removed.')
    ON CONFLICT (module_id, key) DO NOTHING;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
