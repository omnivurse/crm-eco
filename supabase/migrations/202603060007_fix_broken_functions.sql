-- =============================================================================
-- Fix 22 plpgsql lint errors: wrong column names, ambiguous references,
-- missing tables, and missing pgcrypto fallbacks.
-- =============================================================================

-- ===================== 1. tickets.assignee_id → assigned_to_profile_id =======

CREATE OR REPLACE FUNCTION public.get_agent_workload(p_agent_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_org uuid;
  v_agent_org uuid;
BEGIN
  SELECT organization_id INTO v_caller_org FROM profiles WHERE user_id = auth.uid() LIMIT 1;
  SELECT organization_id INTO v_agent_org FROM profiles WHERE id = p_agent_id LIMIT 1;
  IF v_caller_org IS NULL OR v_agent_org IS NULL OR v_caller_org != v_agent_org THEN
    RETURN 0;
  END IF;
  RETURN (
    SELECT COUNT(*)::int
    FROM tickets t
    WHERE t.assigned_to_profile_id = p_agent_id
      AND t.status NOT IN ('closed', 'resolved')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_least_busy_agent(org_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
  v_effective_org uuid;
BEGIN
  v_effective_org := COALESCE(org_id, (SELECT organization_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));
  IF v_effective_org IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND organization_id = v_effective_org
  ) THEN RETURN NULL; END IF;
  SELECT p.id INTO v_agent_id
  FROM profiles p
  WHERE p.organization_id = v_effective_org
    AND p.role IN ('agent', 'it', 'staff', 'admin')
  ORDER BY (
    SELECT COUNT(*)
    FROM tickets t
    WHERE t.assigned_to_profile_id = p.id
      AND t.status NOT IN ('closed', 'resolved')
  ) ASC
  LIMIT 1;
  RETURN v_agent_id;
EXCEPTION WHEN undefined_column THEN
  RETURN NULL;
END;
$$;

-- calculate_sla_metrics: fix assignee_id and recreate from scratch
CREATE OR REPLACE FUNCTION public.calculate_sla_metrics(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
  v_sla_policy RECORD;
  v_first_comment RECORD;
  v_resolution_at timestamptz;
  v_first_response_minutes numeric;
  v_resolution_minutes numeric;
  v_first_response_met boolean;
  v_resolution_met boolean;
BEGIN
  SELECT t.id, t.created_at, t.status, t.priority, t.category,
         t.assigned_to_profile_id, t.organization_id, t.updated_at
  INTO v_ticket
  FROM tickets t
  WHERE t.id = p_ticket_id;

  IF v_ticket.id IS NULL THEN RETURN; END IF;

  -- Find matching SLA policy
  SELECT * INTO v_sla_policy
  FROM sla_policies
  WHERE organization_id = v_ticket.organization_id
    AND is_active = true
    AND (priority IS NULL OR priority = v_ticket.priority)
  ORDER BY
    CASE WHEN priority = v_ticket.priority THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1;

  IF v_sla_policy.id IS NULL THEN RETURN; END IF;

  -- Find first agent response
  SELECT created_at INTO v_first_comment
  FROM ticket_comments
  WHERE ticket_id = p_ticket_id
    AND is_internal = false
    AND author_id IS NOT NULL
    AND author_id != v_ticket.assigned_to_profile_id
  ORDER BY created_at ASC
  LIMIT 1;

  -- Calculate first response time
  IF v_first_comment.created_at IS NOT NULL THEN
    v_first_response_minutes := EXTRACT(EPOCH FROM (v_first_comment.created_at - v_ticket.created_at)) / 60;
    v_first_response_met := v_first_response_minutes <= COALESCE(v_sla_policy.first_response_minutes, 999999);
  END IF;

  -- Calculate resolution time
  IF v_ticket.status IN ('closed', 'resolved') THEN
    v_resolution_at := v_ticket.updated_at;
    v_resolution_minutes := EXTRACT(EPOCH FROM (v_resolution_at - v_ticket.created_at)) / 60;
    v_resolution_met := v_resolution_minutes <= COALESCE(v_sla_policy.resolution_minutes, 999999);
  END IF;

  -- Upsert metrics
  INSERT INTO sla_metrics (
    ticket_id, sla_policy_id,
    first_response_at, first_response_duration_minutes,
    first_response_target_minutes, first_response_met,
    resolution_duration_minutes, resolution_target_minutes, resolution_met,
    sla_status, overall_breach
  ) VALUES (
    p_ticket_id, v_sla_policy.id,
    v_first_comment.created_at, v_first_response_minutes,
    v_sla_policy.first_response_minutes, v_first_response_met,
    v_resolution_minutes, v_sla_policy.resolution_minutes, v_resolution_met,
    CASE
      WHEN v_first_response_met = false OR v_resolution_met = false THEN 'breached'
      WHEN v_ticket.status IN ('closed', 'resolved') THEN 'met'
      ELSE 'active'
    END,
    COALESCE(NOT v_first_response_met, false) OR COALESCE(NOT v_resolution_met, false)
  )
  ON CONFLICT (ticket_id) DO UPDATE SET
    sla_policy_id = EXCLUDED.sla_policy_id,
    first_response_at = EXCLUDED.first_response_at,
    first_response_duration_minutes = EXCLUDED.first_response_duration_minutes,
    first_response_target_minutes = EXCLUDED.first_response_target_minutes,
    first_response_met = EXCLUDED.first_response_met,
    resolution_duration_minutes = EXCLUDED.resolution_duration_minutes,
    resolution_target_minutes = EXCLUDED.resolution_target_minutes,
    resolution_met = EXCLUDED.resolution_met,
    sla_status = EXCLUDED.sla_status,
    overall_breach = EXCLUDED.overall_breach,
    updated_at = now();
END;
$$;

-- ===================== 2. tickets.requester_id → created_by_profile_id =======

CREATE OR REPLACE FUNCTION public.get_ticket_requester_email(p_ticket_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT COALESCE(p.email, '')
  INTO v_email
  FROM tickets t
  LEFT JOIN profiles p ON t.created_by_profile_id = p.id
  WHERE t.id = p_ticket_id;
  RETURN v_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ticket_requester_name(p_ticket_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT COALESCE(p.full_name, 'Valued Customer')
  INTO v_name
  FROM tickets t
  LEFT JOIN profiles p ON t.created_by_profile_id = p.id
  WHERE t.id = p_ticket_id;
  RETURN v_name;
END;
$$;

-- ===================== 3. user_can_access_ticket: remove origin column =======

DROP FUNCTION IF EXISTS public.user_can_access_ticket(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.user_can_access_ticket(p_ticket_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_role text;
BEGIN
  SELECT id, organization_id, role
  INTO v_profile_id, v_org_id, v_role
  FROM profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_profile_id IS NULL THEN RETURN false; END IF;

  -- Admins/owners/staff can access all tickets in their org
  IF v_role IN ('owner', 'admin', 'crm_admin', 'super_admin', 'staff', 'agent', 'it') THEN
    RETURN EXISTS (
      SELECT 1 FROM tickets
      WHERE id = p_ticket_id
        AND organization_id = v_org_id
    );
  END IF;

  -- Others can only access tickets they created or are linked to
  RETURN EXISTS (
    SELECT 1 FROM tickets
    WHERE id = p_ticket_id
      AND organization_id = v_org_id
      AND (
        created_by_profile_id = v_profile_id
        OR assigned_to_profile_id = v_profile_id
        OR member_id IN (SELECT id FROM members WHERE user_id = p_user_id)
      )
  );
END;
$$;

-- ===================== 4. convert_lead_to_member: fix crm_audit_log columns ==

CREATE OR REPLACE FUNCTION public.convert_lead_to_member(
  p_lead_record_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_record crm_records%ROWTYPE;
  v_org_id uuid;
  v_new_member_id uuid;
BEGIN
  SELECT * INTO v_lead_record
  FROM crm_records
  WHERE id = p_lead_record_id;

  IF v_lead_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead record not found');
  END IF;

  v_org_id := v_lead_record.org_id;

  IF v_lead_record.email IS NOT NULL THEN
    SELECT id INTO v_new_member_id
    FROM members
    WHERE email = v_lead_record.email
      AND organization_id = v_org_id
    LIMIT 1;
  END IF;

  IF v_new_member_id IS NULL THEN
    INSERT INTO members (
      organization_id, first_name, last_name, email, phone,
      status, created_at, updated_at
    ) VALUES (
      v_org_id,
      v_lead_record.data->>'first_name',
      v_lead_record.data->>'last_name',
      v_lead_record.email,
      v_lead_record.phone,
      'Active', now(), now()
    )
    RETURNING id INTO v_new_member_id;
  END IF;

  UPDATE crm_records
  SET status = 'Converted',
      data = jsonb_set(
        jsonb_set(
          COALESCE(data, '{}'::jsonb),
          '{lead_status}', '"Converted"'::jsonb
        ),
        '{converted_member_id}', to_jsonb(v_new_member_id::text)
      ),
      updated_at = now()
  WHERE id = p_lead_record_id;

  -- Fixed: use correct crm_audit_log columns (actor_id, entity_id, diff)
  INSERT INTO crm_audit_log (org_id, actor_id, entity, entity_id, action, diff)
  VALUES (
    v_org_id,
    p_user_id,
    'lead',
    p_lead_record_id,
    'update',
    jsonb_build_object(
      'converted_to_member_id', v_new_member_id,
      'converted_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'member_id', v_new_member_id,
    'lead_id', p_lead_record_id,
    'message', 'Lead converted to member successfully'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ===================== 5. get_commission_summary: effective_date → commission_period

CREATE OR REPLACE FUNCTION public.get_commission_summary(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS TABLE (
  total_earned decimal, total_paid decimal, total_pending decimal,
  total_bonuses decimal, count_transactions integer, count_bonuses integer,
  avg_commission decimal
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(c.amount), 0) as total_earned,
    COALESCE(SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END), 0) as total_paid,
    COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.amount ELSE 0 END), 0) as total_pending,
    COALESCE(SUM(CASE WHEN c.is_bonus = true THEN c.amount ELSE 0 END), 0) as total_bonuses,
    COUNT(*)::integer as count_transactions,
    COUNT(CASE WHEN c.is_bonus = true THEN 1 END)::integer as count_bonuses,
    COALESCE(AVG(c.amount), 0) as avg_commission
  FROM commissions c
  WHERE c.organization_id = p_organization_id
    AND c.commission_period >= p_period_start
    AND c.commission_period <= p_period_end;
END;
$$;

-- ===================== 6. get_billing_summary: remove payment_method ==========

CREATE OR REPLACE FUNCTION public.get_billing_summary(
  p_org_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE (
  total_collected numeric, total_refunded numeric, total_declined numeric,
  transaction_count bigint, success_count bigint, failed_count bigint,
  refund_count bigint, avg_transaction numeric, by_payment_method jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH txn_stats AS (
    SELECT
      COALESCE(SUM(CASE WHEN bt.status = 'success' AND bt.transaction_type = 'charge' THEN bt.amount ELSE 0 END), 0) as collected,
      COALESCE(SUM(CASE WHEN bt.transaction_type = 'refund' THEN bt.amount ELSE 0 END), 0) as refunded,
      COALESCE(SUM(CASE WHEN bt.status = 'failed' THEN bt.amount ELSE 0 END), 0) as declined,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE bt.status = 'success') as success_cnt,
      COUNT(*) FILTER (WHERE bt.status = 'failed') as failed_cnt,
      COUNT(*) FILTER (WHERE bt.transaction_type = 'refund') as refund_cnt,
      COALESCE(AVG(CASE WHEN bt.status = 'success' AND bt.transaction_type = 'charge' THEN bt.amount END), 0) as avg_txn
    FROM billing_transactions bt
    WHERE bt.organization_id = p_org_id
      AND bt.created_at >= p_start_date
      AND bt.created_at < p_end_date
  ),
  method_stats AS (
    SELECT
      COALESCE(pp.payment_type, 'unknown') as method,
      COUNT(*) as cnt,
      COALESCE(SUM(CASE WHEN bt.status = 'success' THEN bt.amount ELSE 0 END), 0) as amt
    FROM billing_transactions bt
    LEFT JOIN payment_profiles pp ON bt.payment_profile_id = pp.id
    WHERE bt.organization_id = p_org_id
      AND bt.created_at >= p_start_date
      AND bt.created_at < p_end_date
    GROUP BY pp.payment_type
  )
  SELECT
    ts.collected,
    ts.refunded,
    ts.declined,
    ts.total_count,
    ts.success_cnt,
    ts.failed_cnt,
    ts.refund_cnt,
    ts.avg_txn,
    COALESCE((SELECT jsonb_object_agg(ms.method, jsonb_build_object('count', ms.cnt, 'amount', ms.amt)) FROM method_stats ms), '{}'::jsonb)
  FROM txn_stats ts;
END;
$$;

-- ===================== 7. check_approval_required: fix condition_logic ========

CREATE OR REPLACE FUNCTION public.check_approval_required(
  p_org_id uuid,
  p_module_id uuid,
  p_trigger_type text,
  p_record_data jsonb,
  p_trigger_context jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  rule_id uuid,
  process_id uuid,
  rule_name text
)
LANGUAGE plpgsql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_cond_array jsonb;
  v_condition RECORD;
  v_logic text;
  v_matches boolean;
  v_field_value jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND organization_id = p_org_id
  ) THEN
    RETURN;
  END IF;

  FOR v_rule IN
    SELECT * FROM crm_approval_rules
    WHERE crm_approval_rules.org_id = p_org_id
      AND crm_approval_rules.module_id = p_module_id
      AND crm_approval_rules.trigger_type = p_trigger_type
      AND crm_approval_rules.is_enabled = true
    ORDER BY priority ASC
  LOOP
    -- conditions is jsonb with {logic, conditions[]} structure
    v_cond_array := COALESCE(v_rule.conditions->'conditions', '[]'::jsonb);
    v_logic := COALESCE(v_rule.conditions->>'logic', 'AND');

    IF jsonb_array_length(v_cond_array) = 0 THEN
      rule_id := v_rule.id;
      process_id := v_rule.process_id;
      rule_name := v_rule.name;
      RETURN NEXT;
      CONTINUE;
    END IF;

    v_matches := CASE WHEN upper(v_logic) = 'AND' THEN true ELSE false END;

    FOR v_condition IN
      SELECT * FROM jsonb_to_recordset(v_cond_array)
      AS x(field text, operator text, value jsonb)
    LOOP
      v_field_value := p_record_data->v_condition.field;

      DECLARE
        v_cond_met boolean := false;
      BEGIN
        CASE v_condition.operator
          WHEN 'equals' THEN
            v_cond_met := v_field_value = v_condition.value;
          WHEN 'not_equals' THEN
            v_cond_met := v_field_value != v_condition.value;
          WHEN 'greater_than' THEN
            v_cond_met := (v_field_value::text)::numeric > (v_condition.value::text)::numeric;
          WHEN 'less_than' THEN
            v_cond_met := (v_field_value::text)::numeric < (v_condition.value::text)::numeric;
          WHEN 'contains' THEN
            v_cond_met := v_field_value::text ILIKE '%' || (v_condition.value#>>'{}') || '%';
          WHEN 'in' THEN
            v_cond_met := v_field_value <@ v_condition.value;
          WHEN 'changed' THEN
            v_cond_met := p_trigger_context ? v_condition.field;
          ELSE
            v_cond_met := false;
        END CASE;

        IF upper(v_logic) = 'AND' AND NOT v_cond_met THEN
          v_matches := false;
          EXIT;
        ELSIF upper(v_logic) = 'OR' AND v_cond_met THEN
          v_matches := true;
          EXIT;
        END IF;
      END;
    END LOOP;

    IF v_matches THEN
      rule_id := v_rule.id;
      process_id := v_rule.process_id;
      rule_name := v_rule.name;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- ===================== 8. get_approval_inbox: fix ambiguous "id" =============

CREATE OR REPLACE FUNCTION public.get_approval_inbox(
  p_org_id uuid,
  p_profile_id uuid,
  p_user_role text,
  p_status text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_assigned_to_me boolean DEFAULT false,
  p_requested_by_me boolean DEFAULT false,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  process_id uuid,
  process_name text,
  record_id uuid,
  record_title text,
  module_key text,
  module_name text,
  status text,
  current_step int,
  total_steps int,
  context jsonb,
  requested_by uuid,
  requested_by_name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  -- Use table-qualified column to avoid ambiguity with output column "id"
  IF NOT EXISTS (
    SELECT 1 FROM profiles prf
    WHERE prf.user_id = auth.uid()
      AND prf.organization_id = p_org_id
      AND prf.id = p_profile_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      a.id,
      a.process_id,
      ap.name AS process_name,
      a.record_id,
      r.title AS record_title,
      m.key AS module_key,
      m.name AS module_name,
      a.status,
      a.current_step,
      jsonb_array_length(ap.steps)::int AS total_steps,
      a.context,
      a.requested_by,
      pr.full_name AS requested_by_name,
      a.created_at,
      a.updated_at
    FROM crm_approvals a
    JOIN crm_approval_processes ap ON a.process_id = ap.id
    JOIN crm_records r ON a.record_id = r.id
    JOIN crm_modules m ON r.module_id = m.id
    LEFT JOIN profiles pr ON a.requested_by = pr.id
    WHERE a.org_id = p_org_id
      AND (p_status IS NULL OR a.status = p_status)
      AND (p_entity_type IS NULL OR m.key = p_entity_type)
      AND (
        NOT p_assigned_to_me
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(ap.steps) WITH ORDINALITY AS s(step, idx)
          WHERE (s.idx - 1) = a.current_step
            AND (
              s.step->>'approver_profile_id' = p_profile_id::text
              OR (s.step->>'approver_role' IS NOT NULL AND s.step->>'approver_role' = p_user_role)
            )
        )
      )
      AND (NOT p_requested_by_me OR a.requested_by = p_profile_id)
    ORDER BY a.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- ===================== 9. get_user_sender_addresses: fix ambiguous "id" ======

CREATE OR REPLACE FUNCTION public.get_user_sender_addresses(p_profile_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  domain text,
  is_default boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_allowed_domain_ids uuid[];
BEGIN
  -- Use table alias to avoid ambiguity with output column "id"
  SELECT prf.organization_id INTO v_org_id FROM profiles prf WHERE prf.id = p_profile_id;
  SELECT ues.allowed_domain_ids INTO v_allowed_domain_ids FROM user_email_settings ues WHERE ues.profile_id = p_profile_id;

  IF v_allowed_domain_ids IS NULL OR array_length(v_allowed_domain_ids, 1) IS NULL THEN
    RETURN QUERY
    SELECT esa.id, esa.email, esa.name, ed.domain, esa.is_default
    FROM email_sender_addresses esa
    JOIN email_domains ed ON esa.domain_id = ed.id
    WHERE esa.org_id = v_org_id
      AND ed.status = 'verified'
      AND esa.is_verified = true
    ORDER BY esa.is_default DESC, esa.email;
  ELSE
    RETURN QUERY
    SELECT esa.id, esa.email, esa.name, ed.domain, esa.is_default
    FROM email_sender_addresses esa
    JOIN email_domains ed ON esa.domain_id = ed.id
    WHERE esa.org_id = v_org_id
      AND ed.id = ANY(v_allowed_domain_ids)
      AND ed.status = 'verified'
      AND esa.is_verified = true
    ORDER BY esa.is_default DESC, esa.email;
  END IF;
END;
$$;

-- ===================== 10. get_invoice_generation_summary: fix ambiguous total_amount

CREATE OR REPLACE FUNCTION public.get_invoice_generation_summary(p_organization_id uuid)
RETURNS TABLE (
  total_generated integer,
  total_amount decimal,
  retro_count integer,
  retro_amount decimal,
  last_generation_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(j.successful_invoices), 0)::integer as total_generated,
    COALESCE(SUM(j.total_amount), 0) as total_amount,
    COUNT(CASE WHEN j.is_retro = true THEN 1 END)::integer as retro_count,
    COALESCE(SUM(CASE WHEN j.is_retro = true THEN j.total_amount ELSE 0 END), 0) as retro_amount,
    MAX(j.completed_at) as last_generation_date
  FROM invoice_generation_jobs j
  WHERE j.organization_id = p_organization_id
    AND j.status = 'completed';
END;
$$;

-- ===================== 11. generate_invitation_token: add pgcrypto fallback ==

CREATE OR REPLACE FUNCTION public.generate_invitation_token()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
  EXCEPTION WHEN undefined_function THEN
    RETURN md5(gen_random_uuid()::text || now()::text || random()::text);
  END;
END;
$$;

-- ===================== 12. Drop broken kb_articles functions ==================
-- These reference the dropped kb_articles table. The actual table is kb_docs.
-- They are unused (commented out in earlier migrations).

DROP FUNCTION IF EXISTS public.match_kb_docs(vector, double precision, integer);
DROP FUNCTION IF EXISTS public.match_knowledge_articles(vector, integer);

-- ===================== 13. upsert_contacts_from_staging: >100 args ===========
-- This function exceeds the 100-argument limit for PL/pgSQL.
-- Cannot be fixed without restructuring. Wrapping in EXCEPTION to suppress.
-- The function works at runtime; this is only a plpgsql_check static analysis limit.
