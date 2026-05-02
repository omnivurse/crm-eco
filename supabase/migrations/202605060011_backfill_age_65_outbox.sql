-- One-shot reconciliation: insert outbox rows for HealthShare records that
-- were already auto-cancelled by the first cron run (migration 009 era), but
-- whose outbox INSERTs never persisted (root cause superseded by 010 — outbox
-- writes now happen at the API layer instead of inside the SECURITY DEFINER
-- function). Without this backfill, the rep emails for those 153 records
-- would never fire.
--
-- Match criteria: any record with `data->>'cancellation_reason' = 'Aged out at 65'`
-- and no matching outbox row. The unique index `(record_id, cancellation_date)`
-- makes the INSERT idempotent — re-running this migration is a no-op.

INSERT INTO public.crm_age_65_cancellation_outbox (
  org_id,
  record_id,
  member_name,
  member_email,
  cancellation_date,
  rep_user_id,
  rep_email,
  rep_name
)
SELECT
  cr.org_id,
  cr.id,
  cr.title,
  cr.email,
  cr.cancellation_date,
  cr.owner_id,
  p.email,
  p.full_name
  FROM public.crm_records cr
  LEFT JOIN public.profiles p ON p.id = cr.owner_id
 WHERE cr.market_type = 'healthshare'
   AND cr.cancellation_date IS NOT NULL
   AND cr.data->>'cancellation_reason' = 'Aged out at 65'
   AND NOT EXISTS (
     SELECT 1
       FROM public.crm_age_65_cancellation_outbox o
      WHERE o.record_id = cr.id
        AND o.cancellation_date = cr.cancellation_date
   )
ON CONFLICT (record_id, cancellation_date) DO NOTHING;

NOTIFY pgrst, 'reload schema';
