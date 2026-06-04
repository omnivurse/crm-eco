-- Auto-cancel HealthShare members on the 1st of their birthday month at age 65.
--
-- Rule (per client requirement):
--   - Applies to records with module IN (contacts, members) and market_type = 'healthshare'.
--   - When `data->>'date_of_birth'` exists and the 1st of the birthday month in
--     the year the member turns 65 has arrived, the record is cancelled:
--       crm_records.status            = 'Cancelled'
--       crm_records.cancellation_date = first-of-birthday-month
--       data.cancellation_date        = first-of-birthday-month (mirrored for legacy reads)
--       data.cancellation_reason      = 'Aged out at 65'
--       data.auto_cancelled_at        = timestamp
--   - The assigned rep (record.owner_id) is queued for email notification via
--     `crm_age_65_cancellation_outbox`. A Vercel cron picks up unsent rows and
--     calls the existing Resend send-email path.
--   - Already-cancelled / terminated records are skipped.
--   - An opt-out flag `data.age_65_cancel_override = true` is honoured for
--     edge cases (e.g. dependent on a parent's plan).
--
-- The function accepts an optional p_record_id so the record-detail page can
-- apply the rule "live" for a single record on view, in addition to the
-- nightly batch run.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Notification outbox
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_age_65_cancellation_outbox (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id              uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  record_id           uuid        NOT NULL REFERENCES public.crm_records(id) ON DELETE CASCADE,
  member_name         text,
  member_email        text,
  cancellation_date   date        NOT NULL,
  rep_user_id         uuid,
  rep_email           text,
  rep_name            text,
  notified_at         timestamptz,
  notification_error  text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_age_65_outbox_unsent
  ON public.crm_age_65_cancellation_outbox (created_at)
  WHERE notified_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_age_65_outbox_record
  ON public.crm_age_65_cancellation_outbox (record_id);

-- One outbox row per record per cancellation_date — re-runs of the function
-- shouldn't enqueue duplicate emails.
CREATE UNIQUE INDEX IF NOT EXISTS uq_age_65_outbox_record_date
  ON public.crm_age_65_cancellation_outbox (record_id, cancellation_date);

-- RLS: service role only, plus org admins read.
ALTER TABLE public.crm_age_65_cancellation_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "age_65_outbox_service" ON public.crm_age_65_cancellation_outbox;
CREATE POLICY "age_65_outbox_service" ON public.crm_age_65_cancellation_outbox
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "age_65_outbox_org_read" ON public.crm_age_65_cancellation_outbox;
CREATE POLICY "age_65_outbox_org_read" ON public.crm_age_65_cancellation_outbox
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND p.organization_id = crm_age_65_cancellation_outbox.org_id
         AND p.crm_role IN ('crm_admin', 'crm_manager')
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Apply function — handles both batch (no arg) and live (specific record)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_age_65_auto_cancellation(
  p_record_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_dob date;
  v_birthday_month date;
  v_owner_email text;
  v_owner_name text;
  v_count int := 0;
  v_results jsonb := '[]'::jsonb;
BEGIN
  FOR r IN
    SELECT cr.id,
           cr.org_id,
           cr.title,
           cr.email,
           cr.owner_id,
           cr.advisor_id,
           cr.data->>'date_of_birth' AS dob_text,
           cr.data
      FROM public.crm_records cr
      JOIN public.crm_modules m ON m.id = cr.module_id
     WHERE m.key IN ('contacts', 'members')
       AND cr.market_type = 'healthshare'
       AND cr.data ? 'date_of_birth'
       AND cr.data->>'date_of_birth' ~ '^\d{4}-\d{2}-\d{2}'
       AND (cr.status IS NULL OR cr.status NOT IN ('Cancelled', 'Terminated'))
       AND COALESCE((cr.data->>'age_65_cancel_override')::boolean, false) = false
       AND (p_record_id IS NULL OR cr.id = p_record_id)
  LOOP
    BEGIN
      v_dob := substring(r.dob_text from 1 for 10)::date;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    -- 1st of birthday month, year the member turns 65
    v_birthday_month := make_date(
      EXTRACT(YEAR FROM v_dob)::int + 65,
      EXTRACT(MONTH FROM v_dob)::int,
      1
    );

    IF v_birthday_month > CURRENT_DATE THEN
      CONTINUE;
    END IF;

    -- Lookup rep contact info (owner_id → profiles)
    v_owner_email := NULL;
    v_owner_name := NULL;
    IF r.owner_id IS NOT NULL THEN
      SELECT p.email, p.full_name
        INTO v_owner_email, v_owner_name
        FROM public.profiles p
       WHERE p.id = r.owner_id
       LIMIT 1;
    END IF;

    -- Apply cancellation
    UPDATE public.crm_records
       SET status = 'Cancelled',
           cancellation_date = v_birthday_month,
           data = data || jsonb_build_object(
             'cancellation_date', v_birthday_month::text,
             'cancellation_reason', 'Aged out at 65',
             'auto_cancelled_at', now()::text
           ),
           updated_at = now()
     WHERE id = r.id;

    -- Queue notification (idempotent via uq_age_65_outbox_record_date)
    INSERT INTO public.crm_age_65_cancellation_outbox (
      org_id, record_id, member_name, member_email, cancellation_date,
      rep_user_id, rep_email, rep_name
    ) VALUES (
      r.org_id, r.id, r.title, r.email, v_birthday_month,
      r.owner_id, v_owner_email, v_owner_name
    )
    ON CONFLICT (record_id, cancellation_date) DO NOTHING;

    v_count := v_count + 1;
    v_results := v_results || jsonb_build_object(
      'record_id', r.id,
      'member_name', r.title,
      'cancellation_date', v_birthday_month
    );
  END LOOP;

  RETURN jsonb_build_object('count', v_count, 'cancelled', v_results);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_age_65_auto_cancellation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_age_65_auto_cancellation(uuid) TO service_role;

COMMENT ON FUNCTION public.apply_age_65_auto_cancellation(uuid) IS
  'Auto-cancels HealthShare members at age 65 on the 1st of their birthday month. '
  'Pass a record id for live single-record application; pass NULL for the nightly batch. '
  'Returns {count, cancelled[]}. Queues rep email notifications via crm_age_65_cancellation_outbox.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Schedule daily batch (06:00 UTC; safe-create — pg_cron may be unavailable
--    in some environments so the failure is logged, not raised).
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.schedule(
    'age-65-auto-cancellation',
    '0 6 * * *',
    $cron$SELECT public.apply_age_65_auto_cancellation()$cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule for age-65-auto-cancellation skipped: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
