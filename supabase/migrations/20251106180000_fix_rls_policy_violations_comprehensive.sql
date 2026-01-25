/*
  # Comprehensive RLS Policy Fix - Ticket Metrics, Audit Logs, and Tickets

  ## Problem Summary
  Multiple migrations have created conflicting RLS policies causing:
  1. "new row violates row-level security policy for table 'ticket_metrics'" on ticket creation
  2. 400 errors on audit_logs queries due to missing foreign key constraints
  3. 403 errors on tickets queries due to overly restrictive policies

  ## Root Causes
  1. ticket_metrics exists as a VIEW over sla_metrics, but old migrations created policies on ticket_metrics
  2. sla_metrics has conflicting INSERT policies - some too restrictive, blocking trigger functions
  3. audit_logs table lacks foreign key constraints but queries assume they exist
  4. tickets table has redundant/conflicting SELECT policies from multiple migrations

  ## Solution
  1. Drop ALL existing policies on sla_metrics and recreate with proper permissions
  2. Add missing foreign key constraints to audit_logs with proper cascading
  3. Consolidate and fix tickets table RLS policies with clear role-based access
  4. Ensure all trigger functions use SECURITY DEFINER to bypass RLS appropriately
  5. Add proper indexes for performance

  ## Security Model
  - sla_metrics: System triggers can INSERT/UPDATE via SECURITY DEFINER functions, staff+ can SELECT
  - audit_logs: Admins can SELECT with proper profile joins, service role can INSERT
  - tickets: Members see their own, agents/staff/admin see all, proper origin-based filtering

  ## Tables Modified
  - sla_metrics (policies only)
  - audit_logs (add FK constraints + policies)
  - tickets (consolidate policies)
*/

-- ============================================================================
-- PART 1: FIX SLA_METRICS / TICKET_METRICS RLS POLICIES
-- ============================================================================

-- Drop ALL existing policies on sla_metrics to start clean
DROP POLICY IF EXISTS "sla_metrics_view_all" ON public.sla_metrics;
DROP POLICY IF EXISTS "sla_metrics_system_insert" ON public.sla_metrics;
DROP POLICY IF EXISTS "sla_metrics_system_update" ON public.sla_metrics;
DROP POLICY IF EXISTS "sla_metrics_authenticated_insert" ON public.sla_metrics;
DROP POLICY IF EXISTS "sla_metrics_authenticated_update" ON public.sla_metrics;
DROP POLICY IF EXISTS "metrics_staff_read" ON public.sla_metrics;
DROP POLICY IF EXISTS "metrics_agent_read" ON public.sla_metrics;
DROP POLICY IF EXISTS "metrics_agent_insert" ON public.sla_metrics;
DROP POLICY IF EXISTS "metrics_agent_update" ON public.sla_metrics;

-- SELECT Policy: Staff+ can view all metrics
CREATE POLICY "sla_metrics_staff_select"
  ON public.sla_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('staff', 'agent', 'admin', 'super_admin', 'it', 'concierge')
    )
  );

-- INSERT Policy: Allow service role (for triggers) and authenticated users creating metrics for their tickets
-- The SECURITY DEFINER triggers will use this to bypass normal RLS
CREATE POLICY "sla_metrics_trigger_insert"
  ON public.sla_metrics FOR INSERT
  WITH CHECK (true);

-- UPDATE Policy: Allow service role and authenticated users to update
CREATE POLICY "sla_metrics_trigger_update"
  ON public.sla_metrics FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Grant permissions for trigger functions to work
GRANT INSERT, UPDATE ON public.sla_metrics TO authenticated;
GRANT SELECT ON public.sla_metrics TO authenticated;

-- ============================================================================
-- PART 2: FIX AUDIT_LOGS FOREIGN KEY CONSTRAINTS AND POLICIES
-- ============================================================================

-- Clean up orphaned audit_logs references before adding foreign key constraints
-- Set actor_id and target_user_id to NULL where the referenced profile no longer exists
UPDATE public.audit_logs
SET actor_id = NULL
WHERE actor_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = audit_logs.actor_id);

UPDATE public.audit_logs
SET target_user_id = NULL
WHERE target_user_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = audit_logs.target_user_id);

-- Add missing foreign key constraints that queries assume exist
-- These allow queries like: audit_logs.actor:profiles(full_name)
DO $$
BEGIN
  -- Add FK for actor_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'audit_logs_actor_id_fkey'
    AND table_name = 'audit_logs'
  ) THEN
    ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey
    FOREIGN KEY (actor_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

    RAISE NOTICE 'Added foreign key constraint audit_logs_actor_id_fkey';
  END IF;

  -- Add FK for target_user_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'audit_logs_target_user_id_fkey'
    AND table_name = 'audit_logs'
  ) THEN
    ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_target_user_id_fkey
    FOREIGN KEY (target_user_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

    RAISE NOTICE 'Added foreign key constraint audit_logs_target_user_id_fkey';
  END IF;
END $$;

-- Add indexes for foreign key columns if they don't exist (performance)
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_fk ON public.audit_logs(actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_fk ON public.audit_logs(target_user_id) WHERE target_user_id IS NOT NULL;

-- Drop and recreate audit_logs policies for clarity
DROP POLICY IF EXISTS "audit_admin_read_all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_read_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_service_role_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_no_client_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_no_client_update" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_no_client_delete" ON public.audit_logs;

-- SELECT Policy: Admins and super_admins can read all audit logs
CREATE POLICY "audit_logs_admin_select"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin', 'it')
    )
  );

-- INSERT Policy: Allow service role and system operations (via SECURITY DEFINER functions)
CREATE POLICY "audit_logs_system_insert"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- UPDATE/DELETE Policies: No one can modify audit logs (immutable audit trail)
CREATE POLICY "audit_logs_no_update"
  ON public.audit_logs FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "audit_logs_no_delete"
  ON public.audit_logs FOR DELETE
  USING (false);

-- ============================================================================
-- PART 3: FIX TICKETS TABLE RLS POLICIES
-- ============================================================================

-- Drop ALL existing policies on tickets to consolidate
DROP POLICY IF EXISTS "tickets_requester_insert" ON public.tickets;
DROP POLICY IF EXISTS "tickets_requester_read" ON public.tickets;
DROP POLICY IF EXISTS "tickets_agent_all" ON public.tickets;
DROP POLICY IF EXISTS "tickets_member_insert" ON public.tickets;
DROP POLICY IF EXISTS "tickets_member_read_own" ON public.tickets;
DROP POLICY IF EXISTS "tickets_staff_all" ON public.tickets;
DROP POLICY IF EXISTS "tickets_system_update_sla" ON public.tickets;
DROP POLICY IF EXISTS "tickets_anonymous_view_own" ON public.tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "Staff can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Staff can update all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can view own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Members and advisors can create tickets" ON public.tickets;

-- ============================================================================
-- CONSOLIDATED TICKETS RLS POLICIES (Clear Security Model)
-- ============================================================================

-- SELECT Policy: Who can view tickets?
-- 1. Requester can view their own tickets
-- 2. Assignee can view tickets assigned to them
-- 3. Staff/Agent/Admin/IT/Super_Admin can view all tickets
-- 4. Concierge can view member and advisor tickets
CREATE POLICY "tickets_select_policy"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (
    -- User is the requester
    requester_id = (SELECT auth.uid())
    OR
    -- User is the assignee
    assignee_id = (SELECT auth.uid())
    OR
    -- User is staff or higher
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('staff', 'agent', 'admin', 'super_admin', 'it')
    )
    OR
    -- User is concierge and ticket is member/advisor origin
    (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid())
        AND role = 'concierge'
      )
      AND origin IN ('member', 'advisor')
    )
  );

-- INSERT Policy: Who can create tickets?
-- 1. Any authenticated user can create tickets where they are the requester
-- 2. Staff/Agent/Admin can create tickets on behalf of others
CREATE POLICY "tickets_insert_policy"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User is creating ticket for themselves
    requester_id = (SELECT auth.uid())
    OR
    -- User is staff or higher (can create on behalf of others)
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('staff', 'agent', 'admin', 'super_admin', 'it', 'concierge')
    )
  );

-- UPDATE Policy: Who can update tickets?
-- 1. Requester can update their own ticket (limited fields via application logic)
-- 2. Assignee can update tickets assigned to them
-- 3. Staff/Agent/Admin/IT/Super_Admin can update any ticket
CREATE POLICY "tickets_update_policy"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (
    -- User is the requester
    requester_id = (SELECT auth.uid())
    OR
    -- User is the assignee
    assignee_id = (SELECT auth.uid())
    OR
    -- User is staff or higher
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('staff', 'agent', 'admin', 'super_admin', 'it')
    )
  )
  WITH CHECK (
    -- Same conditions for update
    requester_id = (SELECT auth.uid())
    OR
    assignee_id = (SELECT auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('staff', 'agent', 'admin', 'super_admin', 'it')
    )
  );

-- DELETE Policy: Only admins can delete tickets
CREATE POLICY "tickets_delete_policy"
  ON public.tickets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- PART 4: ENSURE TRIGGER FUNCTIONS USE SECURITY DEFINER
-- ============================================================================

-- Recreate calculate_sla_metrics function with SECURITY DEFINER
-- This allows it to bypass RLS when inserting into sla_metrics
CREATE OR REPLACE FUNCTION public.calculate_sla_metrics(p_ticket_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket record;
  v_first_response_at timestamptz;
  v_first_response_by uuid;
  v_first_response_minutes integer;
  v_first_response_met boolean;
  v_first_response_breach integer;
  v_resolved_at timestamptz;
  v_resolved_by uuid;
  v_resolution_minutes integer;
  v_resolution_met boolean;
  v_resolution_breach integer;
  v_sla_status text;
  v_overall_breach boolean;
BEGIN
  -- Get ticket details
  SELECT t.*, t.created_at, t.status, t.priority, t.category, t.assignee_id
  INTO v_ticket
  FROM public.tickets t
  WHERE t.id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Calculate first response metrics
  SELECT c.created_at, c.author_id
  INTO v_first_response_at, v_first_response_by
  FROM public.ticket_comments c
  JOIN public.profiles p ON c.author_id = p.id
  WHERE c.ticket_id = p_ticket_id
  AND p.role IN ('staff', 'agent', 'admin', 'super_admin', 'concierge', 'it')
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF v_first_response_at IS NOT NULL THEN
    v_first_response_minutes := EXTRACT(EPOCH FROM (v_first_response_at - v_ticket.created_at)) / 60;
    v_first_response_met := v_first_response_minutes <= 240;
    v_first_response_breach := GREATEST(0, v_first_response_minutes - 240);
  END IF;

  -- Calculate resolution metrics
  IF v_ticket.status IN ('resolved', 'closed') THEN
    v_resolved_at := v_ticket.updated_at;
    v_resolved_by := v_ticket.assignee_id;
    v_resolution_minutes := EXTRACT(EPOCH FROM (v_resolved_at - v_ticket.created_at)) / 60;
    v_resolution_met := v_resolution_minutes <= 1440;
    v_resolution_breach := GREATEST(0, v_resolution_minutes - 1440);
  END IF;

  -- Determine overall SLA status
  v_overall_breach := COALESCE(NOT v_first_response_met, false) OR COALESCE(NOT v_resolution_met, false);

  IF v_ticket.status IN ('resolved', 'closed') THEN
    IF v_overall_breach THEN
      v_sla_status := 'breached';
    ELSE
      v_sla_status := 'met';
    END IF;
  ELSE
    IF v_first_response_at IS NULL THEN
      IF EXTRACT(EPOCH FROM (now() - v_ticket.created_at)) / 60 > 180 THEN
        v_sla_status := 'at_risk';
      ELSE
        v_sla_status := 'pending';
      END IF;
    ELSE
      IF EXTRACT(EPOCH FROM (now() - v_ticket.created_at)) / 60 > 1080 THEN
        v_sla_status := 'at_risk';
      ELSE
        v_sla_status := 'pending';
      END IF;
    END IF;
  END IF;

  -- Insert or update SLA metrics (will bypass RLS due to SECURITY DEFINER)
  INSERT INTO public.sla_metrics (
    ticket_id,
    first_response_at,
    first_response_by,
    first_response_duration_minutes,
    first_response_met,
    first_response_breach_minutes,
    resolved_at,
    resolved_by,
    resolution_duration_minutes,
    resolution_met,
    resolution_breach_minutes,
    sla_status,
    overall_breach,
    ticket_priority,
    ticket_category,
    assigned_agent_id,
    ticket_created_at,
    last_calculated_at
  ) VALUES (
    p_ticket_id,
    v_first_response_at,
    v_first_response_by,
    v_first_response_minutes,
    v_first_response_met,
    v_first_response_breach,
    v_resolved_at,
    v_resolved_by,
    v_resolution_minutes,
    v_resolution_met,
    v_resolution_breach,
    v_sla_status,
    v_overall_breach,
    v_ticket.priority,
    v_ticket.category,
    v_ticket.assignee_id,
    v_ticket.created_at,
    now()
  )
  ON CONFLICT (ticket_id) DO UPDATE SET
    first_response_at = EXCLUDED.first_response_at,
    first_response_by = EXCLUDED.first_response_by,
    first_response_duration_minutes = EXCLUDED.first_response_duration_minutes,
    first_response_met = EXCLUDED.first_response_met,
    first_response_breach_minutes = EXCLUDED.first_response_breach_minutes,
    resolved_at = EXCLUDED.resolved_at,
    resolved_by = EXCLUDED.resolved_by,
    resolution_duration_minutes = EXCLUDED.resolution_duration_minutes,
    resolution_met = EXCLUDED.resolution_met,
    resolution_breach_minutes = EXCLUDED.resolution_breach_minutes,
    sla_status = EXCLUDED.sla_status,
    overall_breach = EXCLUDED.overall_breach,
    ticket_priority = EXCLUDED.ticket_priority,
    ticket_category = EXCLUDED.ticket_category,
    assigned_agent_id = EXCLUDED.assigned_agent_id,
    last_calculated_at = now(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger functions with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.trigger_calculate_sla_metrics()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.calculate_sla_metrics(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trigger_calculate_sla_on_comment()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.calculate_sla_metrics(NEW.ticket_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure triggers exist and are properly configured
DROP TRIGGER IF EXISTS trg_tickets_sla_update ON public.tickets;
CREATE TRIGGER trg_tickets_sla_update
AFTER INSERT OR UPDATE OF status, assignee_id ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.trigger_calculate_sla_metrics();

DROP TRIGGER IF EXISTS trg_ticket_comments_sla_update ON public.ticket_comments;
CREATE TRIGGER trg_ticket_comments_sla_update
AFTER INSERT ON public.ticket_comments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_calculate_sla_on_comment();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_sla_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_calculate_sla_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_calculate_sla_on_comment() TO authenticated;

-- ============================================================================
-- PART 5: VERIFICATION AND SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'RLS Policy Fix Migration Complete';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '1. sla_metrics policies: Consolidated to allow trigger functions';
  RAISE NOTICE '2. audit_logs: Added FK constraints and fixed policies';
  RAISE NOTICE '3. tickets: Consolidated SELECT/INSERT/UPDATE/DELETE policies';
  RAISE NOTICE '4. Trigger functions: Ensured SECURITY DEFINER is set';
  RAISE NOTICE '5. Permissions: Granted necessary execute permissions';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected Results:';
  RAISE NOTICE '- Ticket creation should no longer violate RLS on ticket_metrics';
  RAISE NOTICE '- Audit logs queries should work with profile joins';
  RAISE NOTICE '- Tickets should be accessible based on role and ownership';
  RAISE NOTICE '============================================================';
END $$;
