-- Refactor `apply_age_65_auto_cancellation` so outbox writes happen at the API
-- layer instead of inside the SECURITY DEFINER function.
--
-- Why: the original function performed `UPDATE crm_records` + `INSERT INTO
-- crm_age_65_cancellation_outbox` in the same body. The cron's first run
-- reported `applied.count = 153` (153 records cancelled successfully) but a
-- subsequent COUNT(*) on the outbox returned 0. Debugging-via-DB is gated, so
-- the safer path is to remove the side-effect from inside the function and let
-- the Vercel cron route do the outbox insert with full visibility.
--
-- The function now returns one JSONB row per cancelled record with everything
-- the route needs to write the outbox entry: record_id, org_id, member_name,
-- member_email, cancellation_date, owner_id (rep_user_id). The route then
-- inserts to the outbox in a single batch and sends the rep emails.

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
           cr.data->>'date_of_birth' AS dob_text
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

    v_birthday_month := make_date(
      EXTRACT(YEAR FROM v_dob)::int + 65,
      EXTRACT(MONTH FROM v_dob)::int,
      1
    );

    IF v_birthday_month > CURRENT_DATE THEN
      CONTINUE;
    END IF;

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

    v_count := v_count + 1;
    v_results := v_results || jsonb_build_object(
      'record_id', r.id,
      'org_id', r.org_id,
      'member_name', r.title,
      'member_email', r.email,
      'cancellation_date', v_birthday_month,
      'owner_id', r.owner_id
    );
  END LOOP;

  RETURN jsonb_build_object('count', v_count, 'cancelled', v_results);
END;
$$;

NOTIFY pgrst, 'reload schema';
