-- Immutability guard for commission_ledger
-- Prevents modification of amount and commission_id after insert.
-- These fields define the financial truth of the ledger entry and must
-- never change once created. Status, payout_batch_id, payout_id, etc.
-- remain updatable for the payout workflow.

CREATE OR REPLACE FUNCTION prevent_ledger_immutable_field_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    RAISE EXCEPTION 'commission_ledger.amount is immutable after insert';
  END IF;
  IF NEW.commission_id IS DISTINCT FROM OLD.commission_id THEN
    RAISE EXCEPTION 'commission_ledger.commission_id is immutable after insert';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_immutable_fields ON commission_ledger;
CREATE TRIGGER trg_ledger_immutable_fields
  BEFORE UPDATE ON commission_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_immutable_field_change();
