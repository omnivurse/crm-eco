-- Backfill Reply-To onto the Resend inbound subdomain for PIFH apex senders.
-- Additive and idempotent. Does not change From addresses, DNS, or RLS.
--
-- Rollback:
--   UPDATE public.email_sender_addresses
--   SET reply_to = NULL
--   WHERE org_id = '00000000-0000-0000-0000-000000000001'
--     AND split_part(lower(email), '@', 2) = 'payitforwardhealth.com'
--     AND reply_to LIKE '%@mail.payitforwardhealth.com';

SET lock_timeout = '5s';

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM public.email_sender_addresses
  WHERE org_id = '00000000-0000-0000-0000-000000000001'
    AND split_part(lower(email), '@', 2) = 'payitforwardhealth.com'
    AND reply_to IS NULL;

  -- First apply: 16 live apex senders. Re-run: 0 remaining.
  IF n NOT IN (0, 16) THEN
    RAISE EXCEPTION 'sender inbound reply_to backfill expected 0 or 16 rows, found %', n;
  END IF;
END $$;

UPDATE public.email_sender_addresses
SET
  reply_to = CASE
    WHEN split_part(lower(email), '@', 1) = 'noreply'
      THEN 'support@mail.payitforwardhealth.com'
    ELSE split_part(lower(email), '@', 1) || '@mail.payitforwardhealth.com'
  END,
  updated_at = now()
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND split_part(lower(email), '@', 2) = 'payitforwardhealth.com'
  AND reply_to IS NULL;
