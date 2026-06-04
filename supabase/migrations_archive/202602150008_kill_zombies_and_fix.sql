-- Function to cancel long-running queries that are blocking our fix
CREATE OR REPLACE FUNCTION cancel_long_running_queries()
RETURNS TABLE(pid int, duration interval, query_text text, cancelled boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.pid::int,
    now() - a.query_start AS duration,
    LEFT(a.query, 200) AS query_text,
    pg_cancel_backend(a.pid) AS cancelled
  FROM pg_stat_activity a
  WHERE a.state = 'active'
    AND a.query_start < now() - interval '2 minutes'
    AND a.pid != pg_backend_pid()
    AND a.query NOT LIKE '%pg_stat_activity%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Batched fix that moves records 1000 at a time to avoid lock issues
CREATE OR REPLACE FUNCTION fix_wrong_org_batch(p_limit int DEFAULT 1000)
RETURNS TABLE(records_moved int, notes_moved int) AS $$
DECLARE
  v_correct_org uuid := 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';
  v_wrong_org uuid := '00000000-0000-0000-0000-000000000001';
  v_correct_module uuid := '7913796d-bda6-4fff-b81d-5f707b06b71b';
  v_wrong_module uuid := '5c26eeee-ec93-406d-94eb-1e947ee75aaa';
  v_rec_moved int;
  v_note_moved int;
  v_ids uuid[];
BEGIN
  -- Get a batch of record IDs to move
  SELECT array_agg(id) INTO v_ids
  FROM (
    SELECT id FROM crm_records
    WHERE org_id = v_wrong_org AND module_id = v_wrong_module
    LIMIT p_limit
  ) sub;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  -- Move records
  UPDATE crm_records
  SET org_id = v_correct_org, module_id = v_correct_module
  WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_rec_moved = ROW_COUNT;

  -- Move associated notes
  UPDATE crm_notes
  SET org_id = v_correct_org
  WHERE org_id = v_wrong_org
    AND record_id = ANY(v_ids);
  GET DIAGNOSTICS v_note_moved = ROW_COUNT;

  RETURN QUERY SELECT v_rec_moved, v_note_moved;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
