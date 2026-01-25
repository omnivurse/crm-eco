/*
  # Staff Management and Technical Logging System
  
  This migration creates a comprehensive staff management, ticket logging,
  knowledge base, and communication system built on top of the audit logs foundation.
  
  ## New Tables
  - staff_logs: Main table for tickets, notes, fixes, issues, projects
  - staff_log_comments: Threaded comments and discussions
  - staff_log_attachments: File attachments with version tracking
  - staff_log_assignments: Many-to-many staff assignments
  - staff_log_notifications: Notification tracking
  - staff_log_templates: Reusable templates
  - staff_log_tags: Tagging system
  - staff_log_watchers: Watch lists for logs
  - staff_log_related: Related logs linking
  - staff_log_time_tracking: Time tracking entries
  
  ## Features
  - Full audit trail with triggers
  - Real-time collaboration
  - SLA tracking
  - Knowledge base integration
  - Project/component tracking
  - Advanced search and filtering
  - Notification system
  - Time tracking
*/

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log type enum
CREATE TYPE log_type AS ENUM (
  'ticket', 'note', 'fix', 'update', 'project', 'issue', 'documentation', 'deployment', 'security', 'maintenance'
);

-- Log status enum  
CREATE TYPE log_status AS ENUM (
  'new', 'in_progress', 'blocked', 'review', 'resolved', 'closed', 'archived'
);

-- Log priority enum
CREATE TYPE log_priority AS ENUM (
  'low', 'normal', 'high', 'urgent', 'critical'
);

-- Category enum
CREATE TYPE log_category AS ENUM (
  'bug', 'feature', 'maintenance', 'security', 'deployment', 'documentation', 'infrastructure', 'performance', 'other'
);

-- Environment enum
CREATE TYPE log_environment AS ENUM (
  'production', 'staging', 'development', 'testing'
);

-- Assignment role enum
CREATE TYPE assignment_role AS ENUM (
  'owner', 'contributor', 'reviewer', 'watcher'
);

-- Main staff logs table
CREATE TABLE IF NOT EXISTS public.staff_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_number serial UNIQUE NOT NULL,
  
  -- Core fields
  log_type log_type NOT NULL DEFAULT 'ticket',
  title text NOT NULL,
  description text,
  status log_status NOT NULL DEFAULT 'new',
  priority log_priority NOT NULL DEFAULT 'normal',
  category log_category NOT NULL DEFAULT 'other',
  
  -- Project and component tracking
  project_name text,
  software_component text,
  environment log_environment,
  affected_systems text[],
  
  -- Assignment
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Tracking
  tags text[] DEFAULT ARRAY[]::text[],
  severity_level integer CHECK (severity_level >= 1 AND severity_level <= 5),
  
  -- Resolution
  resolution_steps text,
  resolution_time interval,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Relationships
  parent_log_id uuid REFERENCES public.staff_logs(id) ON DELETE SET NULL,
  related_ticket_ids uuid[],
  
  -- Technical details
  technical_details jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- SLA tracking
  due_date timestamptz,
  sla_breach boolean DEFAULT false,
  first_response_at timestamptz,
  first_response_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  
  -- Search
  search_vector tsvector
);

-- Comments table with threading support
CREATE TABLE IF NOT EXISTS public.staff_log_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES public.staff_logs(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.staff_log_comments(id) ON DELETE CASCADE,
  
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  
  -- Visibility
  is_internal boolean DEFAULT false,
  
  -- Mentions and reactions
  mentions uuid[] DEFAULT ARRAY[]::uuid[],
  reactions jsonb DEFAULT '{}'::jsonb,
  
  -- Attachments
  has_attachments boolean DEFAULT false,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  
  -- Soft delete
  deleted_at timestamptz
);

-- Attachments table
CREATE TABLE IF NOT EXISTS public.staff_log_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid REFERENCES public.staff_logs(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.staff_log_comments(id) ON DELETE CASCADE,
  
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  storage_path text NOT NULL,
  storage_bucket text DEFAULT 'staff-logs',
  
  -- Version tracking
  version integer DEFAULT 1,
  previous_version_id uuid REFERENCES public.staff_log_attachments(id),
  
  -- Metadata
  thumbnail_path text,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT attachment_parent_check CHECK (
    (log_id IS NOT NULL AND comment_id IS NULL) OR 
    (log_id IS NULL AND comment_id IS NOT NULL)
  )
);

-- Assignments table (many-to-many)
CREATE TABLE IF NOT EXISTS public.staff_log_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES public.staff_logs(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  role assignment_role NOT NULL DEFAULT 'contributor',
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  
  completed_at timestamptz,
  notes text,
  
  UNIQUE(log_id, staff_id, role)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.staff_log_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_id uuid NOT NULL REFERENCES public.staff_logs(id) ON DELETE CASCADE,
  
  notification_type text NOT NULL, -- 'mention', 'assignment', 'comment', 'status_change', etc.
  title text NOT NULL,
  message text,
  link text,
  
  -- Status
  read_at timestamptz,
  delivered_at timestamptz,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Index for user's unread notifications
  CONSTRAINT check_notification_type CHECK (
    notification_type IN ('mention', 'assignment', 'comment', 'status_change', 'due_soon', 'overdue', 'resolved', 'escalated')
  )
);

-- Templates table
CREATE TABLE IF NOT EXISTS public.staff_log_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  
  log_type log_type NOT NULL,
  category log_category,
  
  -- Template content
  title_template text,
  description_template text,
  technical_details jsonb DEFAULT '{}'::jsonb,
  
  -- Default values
  default_priority log_priority DEFAULT 'normal',
  default_tags text[],
  required_fields text[],
  
  -- Sharing
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_shared boolean DEFAULT false,
  team_only boolean DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(name, created_by)
);

-- Tags table for better organization
CREATE TABLE IF NOT EXISTS public.staff_log_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text,
  description text,
  category text,
  
  usage_count integer DEFAULT 0,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Watchers table (for notifications on logs you're watching)
CREATE TABLE IF NOT EXISTS public.staff_log_watchers (
  log_id uuid NOT NULL REFERENCES public.staff_logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  PRIMARY KEY (log_id, user_id)
);

-- Related logs table (for linking related logs)
CREATE TABLE IF NOT EXISTS public.staff_log_related (
  log_id uuid NOT NULL REFERENCES public.staff_logs(id) ON DELETE CASCADE,
  related_log_id uuid NOT NULL REFERENCES public.staff_logs(id) ON DELETE CASCADE,
  
  relationship_type text NOT NULL, -- 'blocks', 'blocked_by', 'relates_to', 'duplicates', 'causes', 'caused_by'
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  PRIMARY KEY (log_id, related_log_id, relationship_type),
  
  CONSTRAINT no_self_relation CHECK (log_id != related_log_id)
);

-- Time tracking table
CREATE TABLE IF NOT EXISTS public.staff_log_time_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES public.staff_logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration interval,
  
  description text,
  is_billable boolean DEFAULT false,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_logs_status ON public.staff_logs(status) WHERE status NOT IN ('closed', 'archived');
CREATE INDEX IF NOT EXISTS idx_staff_logs_priority ON public.staff_logs(priority);
CREATE INDEX IF NOT EXISTS idx_staff_logs_created_by ON public.staff_logs(created_by);
CREATE INDEX IF NOT EXISTS idx_staff_logs_assigned_to ON public.staff_logs(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_logs_created_at ON public.staff_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_logs_log_type ON public.staff_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_staff_logs_project ON public.staff_logs(project_name) WHERE project_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_logs_tags ON public.staff_logs USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_staff_logs_technical_details ON public.staff_logs USING gin(technical_details);
CREATE INDEX IF NOT EXISTS idx_staff_logs_search_vector ON public.staff_logs USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_staff_logs_due_date ON public.staff_logs(due_date) WHERE due_date IS NOT NULL AND status NOT IN ('closed', 'archived');

CREATE INDEX IF NOT EXISTS idx_staff_log_comments_log_id ON public.staff_log_comments(log_id);
CREATE INDEX IF NOT EXISTS idx_staff_log_comments_author ON public.staff_log_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_staff_log_comments_parent ON public.staff_log_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_log_comments_created_at ON public.staff_log_comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_log_attachments_log_id ON public.staff_log_attachments(log_id) WHERE log_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_log_attachments_comment_id ON public.staff_log_attachments(comment_id) WHERE comment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_log_assignments_log_id ON public.staff_log_assignments(log_id);
CREATE INDEX IF NOT EXISTS idx_staff_log_assignments_staff_id ON public.staff_log_assignments(staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_log_notifications_user_unread ON public.staff_log_notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_log_notifications_log_id ON public.staff_log_notifications(log_id);

CREATE INDEX IF NOT EXISTS idx_staff_log_time_tracking_log_id ON public.staff_log_time_tracking(log_id);
CREATE INDEX IF NOT EXISTS idx_staff_log_time_tracking_user_id ON public.staff_log_time_tracking(user_id);

-- Enable RLS on all tables
ALTER TABLE public.staff_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_log_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_log_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_log_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_log_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_log_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_log_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_log_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_log_related ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_log_time_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_logs
-- Staff and above can view all logs
CREATE POLICY "staff_logs_view_all"
ON public.staff_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('staff', 'it', 'admin', 'super_admin')
  )
);

-- Staff and above can create logs
CREATE POLICY "staff_logs_create"
ON public.staff_logs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('staff', 'it', 'admin', 'super_admin')
  )
);

-- Staff can update their own logs, IT+ can update all
CREATE POLICY "staff_logs_update"
ON public.staff_logs FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (
      role IN ('it', 'admin', 'super_admin')
      OR (role = 'staff' AND id = staff_logs.created_by)
    )
  )
);

-- Only admin+ can delete logs
CREATE POLICY "staff_logs_delete"
ON public.staff_logs FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- RLS Policies for staff_log_comments
CREATE POLICY "comments_view_all"
ON public.staff_log_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('staff', 'it', 'admin', 'super_admin')
  )
);

CREATE POLICY "comments_create"
ON public.staff_log_comments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('staff', 'it', 'admin', 'super_admin')
  )
);

CREATE POLICY "comments_update_own"
ON public.staff_log_comments FOR UPDATE
TO authenticated
USING (author_id = auth.uid());

CREATE POLICY "comments_delete_own_or_admin"
ON public.staff_log_comments FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- RLS Policies for attachments (similar to comments)
CREATE POLICY "attachments_view_all"
ON public.staff_log_attachments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('staff', 'it', 'admin', 'super_admin')
  )
);

CREATE POLICY "attachments_create"
ON public.staff_log_attachments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('staff', 'it', 'admin', 'super_admin')
  )
);

CREATE POLICY "attachments_delete_own_or_admin"
ON public.staff_log_attachments FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- RLS Policies for assignments
CREATE POLICY "assignments_view_all"
ON public.staff_log_assignments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('staff', 'it', 'admin', 'super_admin')
  )
);

CREATE POLICY "assignments_manage"
ON public.staff_log_assignments FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('it', 'admin', 'super_admin')
  )
);

-- RLS Policies for notifications (users see their own)
CREATE POLICY "notifications_view_own"
ON public.staff_log_notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
ON public.staff_log_notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- RLS Policies for templates
CREATE POLICY "templates_view"
ON public.staff_log_templates FOR SELECT
TO authenticated
USING (
  is_shared = true
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('it', 'admin', 'super_admin')
  )
);

CREATE POLICY "templates_create"
ON public.staff_log_templates FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('staff', 'it', 'admin', 'super_admin')
  )
);

CREATE POLICY "templates_update_own"
ON public.staff_log_templates FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "templates_delete_own"
ON public.staff_log_templates FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- RLS Policies for tags (all staff can view, IT+ can manage)
CREATE POLICY "tags_view_all"
ON public.staff_log_tags FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('staff', 'it', 'admin', 'super_admin')
  )
);

CREATE POLICY "tags_manage"
ON public.staff_log_tags FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('it', 'admin', 'super_admin')
  )
);

-- RLS Policies for watchers
CREATE POLICY "watchers_view_all"
ON public.staff_log_watchers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('staff', 'it', 'admin', 'super_admin')
  )
);

CREATE POLICY "watchers_manage_own"
ON public.staff_log_watchers FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- RLS Policies for related logs
CREATE POLICY "related_logs_view_all"
ON public.staff_log_related FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('staff', 'it', 'admin', 'super_admin')
  )
);

CREATE POLICY "related_logs_manage"
ON public.staff_log_related FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('staff', 'it', 'admin', 'super_admin')
  )
);

-- RLS Policies for time tracking
CREATE POLICY "time_tracking_view_own_or_it"
ON public.staff_log_time_tracking FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('it', 'admin', 'super_admin')
  )
);

CREATE POLICY "time_tracking_manage_own"
ON public.staff_log_time_tracking FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Functions and Triggers

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for staff_logs updated_at
DROP TRIGGER IF EXISTS trg_staff_logs_updated_at ON public.staff_logs;
CREATE TRIGGER trg_staff_logs_updated_at
BEFORE UPDATE ON public.staff_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for staff_log_comments updated_at
DROP TRIGGER IF EXISTS trg_staff_log_comments_updated_at ON public.staff_log_comments;
CREATE TRIGGER trg_staff_log_comments_updated_at
BEFORE UPDATE ON public.staff_log_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update search vector
CREATE OR REPLACE FUNCTION public.staff_logs_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.project_name, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.software_component, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for search vector
DROP TRIGGER IF EXISTS trg_staff_logs_search_vector ON public.staff_logs;
CREATE TRIGGER trg_staff_logs_search_vector
BEFORE INSERT OR UPDATE ON public.staff_logs
FOR EACH ROW
EXECUTE FUNCTION public.staff_logs_search_vector_update();

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_staff_log_notification(
  p_user_id uuid,
  p_log_id uuid,
  p_type text,
  p_title text,
  p_message text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO public.staff_log_notifications (
    user_id, log_id, notification_type, title, message, metadata
  ) VALUES (
    p_user_id, p_log_id, p_type, p_title, p_message, p_metadata
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle assignment notifications
CREATE OR REPLACE FUNCTION public.notify_staff_log_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.create_staff_log_notification(
      NEW.staff_id,
      NEW.log_id,
      'assignment',
      'You have been assigned to a log',
      'You have been assigned as ' || NEW.role || ' to log #' || (SELECT log_number FROM public.staff_logs WHERE id = NEW.log_id),
      jsonb_build_object('assignment_id', NEW.id, 'role', NEW.role)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for assignment notifications
DROP TRIGGER IF EXISTS trg_notify_staff_log_assignment ON public.staff_log_assignments;
CREATE TRIGGER trg_notify_staff_log_assignment
AFTER INSERT ON public.staff_log_assignments
FOR EACH ROW
EXECUTE FUNCTION public.notify_staff_log_assignment();

-- Function to handle mention notifications
CREATE OR REPLACE FUNCTION public.notify_staff_log_mentions()
RETURNS TRIGGER AS $$
DECLARE
  mentioned_user uuid;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.mentions IS NOT NULL) THEN
    FOREACH mentioned_user IN ARRAY NEW.mentions
    LOOP
      PERFORM public.create_staff_log_notification(
        mentioned_user,
        NEW.log_id,
        'mention',
        'You were mentioned in a comment',
        'You were mentioned in a comment on log #' || (SELECT log_number FROM public.staff_logs WHERE id = NEW.log_id),
        jsonb_build_object('comment_id', NEW.id)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for mention notifications
DROP TRIGGER IF EXISTS trg_notify_staff_log_mentions ON public.staff_log_comments;
CREATE TRIGGER trg_notify_staff_log_mentions
AFTER INSERT ON public.staff_log_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_staff_log_mentions();

-- Function to handle status change notifications
CREATE OR REPLACE FUNCTION public.notify_staff_log_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Notify assigned user
    IF NEW.assigned_to IS NOT NULL THEN
      PERFORM public.create_staff_log_notification(
        NEW.assigned_to,
        NEW.id,
        'status_change',
        'Log status changed',
        'Log #' || NEW.log_number || ' status changed from ' || OLD.status || ' to ' || NEW.status,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
    
    -- Notify creator if different from assigned
    IF NEW.created_by IS NOT NULL AND NEW.created_by != NEW.assigned_to THEN
      PERFORM public.create_staff_log_notification(
        NEW.created_by,
        NEW.id,
        'status_change',
        'Log status changed',
        'Log #' || NEW.log_number || ' status changed from ' || OLD.status || ' to ' || NEW.status,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
    
    -- Notify all watchers
    PERFORM public.create_staff_log_notification(
      w.user_id,
      NEW.id,
      'status_change',
      'Log status changed',
      'Log #' || NEW.log_number || ' status changed from ' || OLD.status || ' to ' || NEW.status,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    )
    FROM public.staff_log_watchers w
    WHERE w.log_id = NEW.id 
    AND w.user_id NOT IN (COALESCE(NEW.assigned_to, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for status change notifications
DROP TRIGGER IF EXISTS trg_notify_staff_log_status_change ON public.staff_logs;
CREATE TRIGGER trg_notify_staff_log_status_change
AFTER UPDATE ON public.staff_logs
FOR EACH ROW
EXECUTE FUNCTION public.notify_staff_log_status_change();

-- Function to audit log changes
CREATE OR REPLACE FUNCTION public.audit_staff_log_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_changes jsonb DEFAULT '{}'::jsonb;
  v_action text;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_action := 'staff_log_create';
    v_changes := jsonb_build_object(
      'log_id', NEW.id,
      'log_number', NEW.log_number,
      'log_type', NEW.log_type,
      'title', NEW.title,
      'status', NEW.status,
      'priority', NEW.priority
    );
    
    PERFORM public.insert_audit_log(
      auth.uid(),
      NEW.created_by,
      v_action,
      v_changes
    );
    
  ELSIF (TG_OP = 'UPDATE') THEN
    v_action := 'staff_log_update';
    
    -- Track specific changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_changes := v_changes || jsonb_build_object('status_changed', jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      v_changes := v_changes || jsonb_build_object('priority_changed', jsonb_build_object('from', OLD.priority, 'to', NEW.priority));
    END IF;
    
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      v_changes := v_changes || jsonb_build_object('assigned_to_changed', jsonb_build_object('from', OLD.assigned_to, 'to', NEW.assigned_to));
    END IF;
    
    IF v_changes != '{}'::jsonb THEN
      v_changes := v_changes || jsonb_build_object('log_id', NEW.id, 'log_number', NEW.log_number);
      
      PERFORM public.insert_audit_log(
        auth.uid(),
        NULL,
        v_action,
        v_changes
      );
    END IF;
    
  ELSIF (TG_OP = 'DELETE') THEN
    v_action := 'staff_log_delete';
    v_changes := jsonb_build_object(
      'log_id', OLD.id,
      'log_number', OLD.log_number,
      'title', OLD.title
    );
    
    PERFORM public.insert_audit_log(
      auth.uid(),
      NULL,
      v_action,
      v_changes
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for audit logging
DROP TRIGGER IF EXISTS trg_audit_staff_log_changes ON public.staff_logs;
CREATE TRIGGER trg_audit_staff_log_changes
AFTER INSERT OR UPDATE OR DELETE ON public.staff_logs
FOR EACH ROW
EXECUTE FUNCTION public.audit_staff_log_changes();

-- Insert some default tags
INSERT INTO public.staff_log_tags (name, color, category, description) VALUES
  ('urgent', '#ef4444', 'priority', 'Requires immediate attention'),
  ('backend', '#3b82f6', 'component', 'Backend/API related'),
  ('frontend', '#8b5cf6', 'component', 'Frontend/UI related'),
  ('database', '#10b981', 'component', 'Database related'),
  ('security', '#f59e0b', 'category', 'Security related issue'),
  ('performance', '#06b6d4', 'category', 'Performance optimization'),
  ('bug-fix', '#ef4444', 'type', 'Bug fix'),
  ('feature', '#22c55e', 'type', 'New feature'),
  ('documentation', '#64748b', 'type', 'Documentation update'),
  ('deployment', '#f97316', 'type', 'Deployment related')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_log_comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.staff_log_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_log_assignments TO authenticated;
GRANT SELECT, UPDATE ON public.staff_log_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_log_templates TO authenticated;
GRANT SELECT, INSERT ON public.staff_log_tags TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.staff_log_watchers TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.staff_log_related TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.staff_log_time_tracking TO authenticated;

GRANT USAGE ON SEQUENCE staff_logs_log_number_seq TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_log_notification TO authenticated;
