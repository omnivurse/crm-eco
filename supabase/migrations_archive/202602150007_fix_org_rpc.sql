-- Create a one-time-use RPC to move records between orgs
CREATE OR REPLACE FUNCTION fix_wrong_org_records()
RETURNS TABLE(records_moved int, notes_moved int) AS $$
DECLARE
  v_correct_org_id uuid := 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';
  v_wrong_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_correct_contacts_module uuid := '7913796d-bda6-4fff-b81d-5f707b06b71b';
  v_wrong_contacts_module uuid := '5c26eeee-ec93-406d-94eb-1e947ee75aaa';
  v_records_moved int;
  v_notes_moved int;
BEGIN
  -- Move records
  UPDATE crm_records
  SET org_id = v_correct_org_id,
      module_id = v_correct_contacts_module
  WHERE org_id = v_wrong_org_id
    AND module_id = v_wrong_contacts_module;
  GET DIAGNOSTICS v_records_moved = ROW_COUNT;

  -- Move notes
  UPDATE crm_notes
  SET org_id = v_correct_org_id
  WHERE org_id = v_wrong_org_id;
  GET DIAGNOSTICS v_notes_moved = ROW_COUNT;

  RETURN QUERY SELECT v_records_moved, v_notes_moved;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION fix_wrong_org_records() SET statement_timeout = '120s';
NOTIFY pgrst, 'reload schema';
