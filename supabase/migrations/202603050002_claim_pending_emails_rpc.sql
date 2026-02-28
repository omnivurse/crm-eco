-- Atomic claim function for email queue processing.
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions
-- when multiple cron workers process the queue concurrently.
CREATE OR REPLACE FUNCTION claim_pending_emails(batch_size int DEFAULT 50)
RETURNS SETOF notification_queue
LANGUAGE sql
AS $$
  UPDATE notification_queue
  SET status = 'sending',
      attempts = attempts + 1,
      last_attempt_at = now(),
      updated_at = now()
  WHERE id IN (
    SELECT id
    FROM notification_queue
    WHERE status = 'pending'
      AND channel = 'email'
      AND scheduled_for <= now()
    ORDER BY scheduled_for ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
