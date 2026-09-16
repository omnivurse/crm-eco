-- Phase 1: admin/canonical writes emit integration_events and invalidate report cache.
-- Additive. Fail-safe: emit never rolls back the parent write.
-- Rollback: DROP TRIGGER the four analytics triggers + DROP FUNCTION emit_analytics_event.

BEGIN;

SET lock_timeout = '5s';

-- timestamptz::date is not IMMUTABLE, so no unique expression index on occurred_at.
-- Idempotency is the EXISTS check inside emit_analytics_event.
CREATE INDEX IF NOT EXISTS idx_integration_events_analytics_lookup
  ON public.integration_events (organization_id, event_type, entity_id);

CREATE OR REPLACE FUNCTION public.emit_analytics_event(
  p_org_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_previous_state jsonb DEFAULT NULL,
  p_source text DEFAULT 'admin'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_event_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.integration_events
    WHERE COALESCE(organization_id, org_id) = p_org_id
      AND event_type = p_event_type
      AND entity_id = p_entity_id
      AND (COALESCE(occurred_at, created_at))::date = CURRENT_DATE
  ) THEN
    RETURN NULL;
  END IF;

  BEGIN
    INSERT INTO public.integration_events (
      org_id,
      organization_id,
      event_type,
      entity_type,
      entity_id,
      payload,
      previous_state,
      source,
      occurred_at
    ) VALUES (
      p_org_id,
      p_org_id,
      p_event_type,
      p_entity_type,
      p_entity_id,
      COALESCE(p_payload, '{}'::jsonb),
      p_previous_state,
      COALESCE(p_source, 'admin'),
      now()
    )
    RETURNING id INTO v_event_id;
  EXCEPTION WHEN unique_violation THEN
    v_event_id := NULL;
  END;

  BEGIN
    DELETE FROM public.crm_report_results_cache
    WHERE org_id = p_org_id
      AND (
        template_key LIKE 'advisor-%'
        OR template_key LIKE 'network-%'
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'analytics cache invalidate failed: %', SQLERRM;
  END;

  -- system_events.event_type is a closed check list; map onto live values only.
  IF p_event_type = 'commission.created' THEN
    BEGIN
      PERFORM public.emit_system_event(
        p_org_id,
        'commission_created',
        p_entity_type,
        p_entity_id,
        p_payload
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'emit_system_event failed: %', SQLERRM;
    END;
  END IF;

  RETURN v_event_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'emit_analytics_event failed: %', SQLERRM;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_enrollments_emit_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_type text;
  v_prev text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_type := CASE NEW.status
      WHEN 'submitted' THEN 'enrollment.submitted'
      WHEN 'approved' THEN 'enrollment.approved'
      WHEN 'rejected' THEN 'enrollment.rejected'
      WHEN 'cancelled' THEN 'enrollment.cancelled'
      ELSE NULL
    END;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_type := CASE NEW.status
      WHEN 'submitted' THEN 'enrollment.submitted'
      WHEN 'pending_review' THEN 'enrollment.submitted'
      WHEN 'more_info' THEN 'enrollment.submitted'
      WHEN 'approved' THEN 'enrollment.approved'
      WHEN 'active' THEN 'enrollment.approved'
      WHEN 'rejected' THEN 'enrollment.rejected'
      WHEN 'cancelled' THEN 'enrollment.cancelled'
      ELSE NULL
    END;
    v_prev := OLD.status;
  END IF;

  IF v_type IS NOT NULL AND NEW.organization_id IS NOT NULL THEN
    PERFORM public.emit_analytics_event(
      NEW.organization_id,
      v_type,
      'enrollment',
      NEW.id,
      jsonb_build_object(
        'status', NEW.status,
        'advisor_id', NEW.advisor_id,
        'plan_id', NEW.selected_plan_id,
        'amount', COALESCE(NEW.total_monthly_cost, NEW.base_monthly_cost)
      ),
      CASE WHEN v_prev IS NULL THEN NULL ELSE jsonb_build_object('status', v_prev) END,
      'admin'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_enrollments_emit_analytics failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_members_emit_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_type text;
  v_contact_id uuid;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    v_type := 'member.activated';
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'active' AND COALESCE(OLD.status, '') <> 'active' THEN
      v_type := 'member.activated';
    ELSIF NEW.status IN ('cancelled', 'terminated', 'inactive') THEN
      v_type := 'member.cancelled';
    END IF;
  END IF;

  IF v_type IS NULL OR NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.emit_analytics_event(
    NEW.organization_id,
    v_type,
    'member',
    NEW.id,
    jsonb_build_object(
      'status', NEW.status,
      'advisor_id', NEW.advisor_id
    ),
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('status', OLD.status) ELSE NULL END,
    'admin'
  );

  SELECT cr.id INTO v_contact_id
  FROM public.crm_records cr
  JOIN public.crm_modules cm ON cm.id = cr.module_id
  WHERE cr.org_id = NEW.organization_id
    AND cm.key IN ('contacts', 'members')
    AND (
      cr.data->>'linked_member_id' = NEW.id::text
      OR cr.data->'system'->>'source_id' = NEW.id::text
      OR cr.data->>'source_id' = NEW.id::text
    )
  ORDER BY CASE WHEN cm.key = 'contacts' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_contact_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.member_lifecycle_events (
        organization_id,
        contact_id,
        event_type,
        event_date,
        advisor_id,
        source,
        metadata
      ) VALUES (
        NEW.organization_id,
        v_contact_id,
        CASE WHEN v_type = 'member.activated' THEN 'enrolled' ELSE 'cancelled' END,
        CURRENT_DATE,
        NEW.advisor_id,
        'admin',
        jsonb_build_object('member_id', NEW.id, 'status', NEW.status)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'member_lifecycle_events write skipped: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_members_emit_analytics failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_advisors_emit_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.emit_analytics_event(
    NEW.organization_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'advisor.created' ELSE 'advisor.updated' END,
    'advisor',
    NEW.id,
    jsonb_build_object('status', NEW.status),
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('status', OLD.status) ELSE NULL END,
    'admin'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_advisors_emit_analytics failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_commissions_emit_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_org uuid;
  v_period date;
BEGIN
  v_org := COALESCE(NEW.organization_id, NEW.org_id);
  IF v_org IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.emit_analytics_event(
    v_org,
    CASE WHEN TG_OP = 'INSERT' THEN 'commission.created' ELSE 'commission.updated' END,
    'commission',
    NEW.id,
    jsonb_build_object(
      'status', NEW.status,
      'advisor_id', NEW.advisor_id,
      'amount', COALESCE(NEW.commission_amount, NEW.amount)
    ),
    NULL,
    'admin'
  );

  IF TG_OP = 'INSERT' THEN
    -- commission_period is text in live schema; fall back to today if unparsable.
    BEGIN
      v_period := date_trunc(
        'month',
        COALESCE(NULLIF(NEW.commission_period, '')::date, CURRENT_DATE)
      )::date;
    EXCEPTION WHEN OTHERS THEN
      v_period := date_trunc('month', CURRENT_DATE)::date;
    END;
    BEGIN
      PERFORM public.refresh_advisor_commission_summary(v_org, v_period);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'refresh_advisor_commission_summary failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_commissions_emit_analytics failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enrollments_emit_analytics ON public.enrollments;
CREATE TRIGGER trg_enrollments_emit_analytics
  AFTER INSERT OR UPDATE OF status ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enrollments_emit_analytics();

DROP TRIGGER IF EXISTS trg_members_emit_analytics ON public.members;
CREATE TRIGGER trg_members_emit_analytics
  AFTER INSERT OR UPDATE OF status ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_members_emit_analytics();

DROP TRIGGER IF EXISTS trg_advisors_emit_analytics ON public.advisors;
CREATE TRIGGER trg_advisors_emit_analytics
  AFTER INSERT OR UPDATE OF status ON public.advisors
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_advisors_emit_analytics();

DROP TRIGGER IF EXISTS trg_commissions_emit_analytics ON public.commissions;
CREATE TRIGGER trg_commissions_emit_analytics
  AFTER INSERT OR UPDATE OF status ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_commissions_emit_analytics();

REVOKE ALL ON FUNCTION public.emit_analytics_event(uuid, text, text, uuid, jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emit_analytics_event(uuid, text, text, uuid, jsonb, jsonb, text) TO service_role;

COMMIT;
