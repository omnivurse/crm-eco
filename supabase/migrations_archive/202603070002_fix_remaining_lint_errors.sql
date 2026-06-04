-- =============================================================================
-- Fix remaining plpgsql lint errors:
-- 1. get_least_busy_agent: force-drop old overload and recreate
-- 2. calculate_sla_metrics: drop (references non-existent sla_policies/sla_metrics tables)
-- 3. user_can_access_ticket: fix members.user_id (column doesn't exist)
-- 4. get_commission_summary: cast commission_period (text) for date comparison
-- 5. match_kb_docs / match_knowledge_articles: dynamic drop (vector type unavailable)
-- =============================================================================

-- ===================== 1. get_least_busy_agent ===============================
-- Force-drop ALL overloads then recreate with correct body

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_least_busy_agent'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
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

-- ===================== 2. calculate_sla_metrics ==============================
-- This function references sla_policies and sla_metrics tables which do not exist.
-- (The project only has crm_sla_policies with a completely different schema.)
-- Drop the broken function entirely.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'calculate_sla_metrics'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END;
$$;

-- ===================== 3. user_can_access_ticket =============================
-- Fix: members table has no user_id column.
-- Use profiles to check if user has a member link via advisor chain.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'user_can_access_ticket'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END;
$$;

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

  -- Others can access tickets they created, are assigned to, or are linked as member
  RETURN EXISTS (
    SELECT 1 FROM tickets
    WHERE id = p_ticket_id
      AND organization_id = v_org_id
      AND (
        created_by_profile_id = v_profile_id
        OR assigned_to_profile_id = v_profile_id
        OR member_id IN (
          SELECT m.id FROM members m
          JOIN advisors a ON m.advisor_id = a.id
          WHERE a.profile_id = v_profile_id
        )
      )
  );
END;
$$;

-- ===================== 4. get_commission_summary ==============================
-- Fix: commission_period is text (YYYY-MM format), not date.
-- Cast date params to text for comparison.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_commission_summary'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END;
$$;

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
    AND c.commission_period >= to_char(p_period_start, 'YYYY-MM')
    AND c.commission_period <= to_char(p_period_end, 'YYYY-MM');
END;
$$;

-- ===================== 5. match_kb_docs / match_knowledge_articles ===========
-- These reference the dropped kb_articles table. Cannot use typed DROP because
-- the vector type is not available. Use dynamic SQL to find and drop by OID.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN ('match_kb_docs', 'match_knowledge_articles')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END;
$$;
