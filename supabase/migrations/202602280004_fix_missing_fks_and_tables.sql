-- Fix missing foreign keys and tables

-- Ensure tasks.assignee_id FK exists
DO $$
BEGIN
  -- Add assignee_id column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'assignee_id'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN assignee_id uuid REFERENCES public.profiles(id);
  END IF;

  -- Add FK constraint if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'tasks' AND c.conname = 'tasks_assignee_id_fkey'
  ) THEN
    -- Check if column exists before adding constraint
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'assignee_id'
    ) THEN
      ALTER TABLE public.tasks
        ADD CONSTRAINT tasks_assignee_id_fkey
        FOREIGN KEY (assignee_id) REFERENCES public.profiles(id);
    END IF;
  END IF;
END $$;

-- Ensure admin_notifications table exists with proper structure
-- If it already exists, just add missing columns
DO $$
BEGIN
  -- Create table if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_notifications') THEN
    CREATE TABLE public.admin_notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      message text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;

  -- Add organization_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_notifications' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.admin_notifications ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;

  -- Add type if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_notifications' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.admin_notifications ADD COLUMN type text DEFAULT 'info';
  END IF;

  -- Add title if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_notifications' AND column_name = 'title'
  ) THEN
    ALTER TABLE public.admin_notifications ADD COLUMN title text;
  END IF;

  -- Add is_read if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_notifications' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE public.admin_notifications ADD COLUMN is_read boolean DEFAULT false;
  END IF;
END $$;

-- Create indexes (only on columns that exist)
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_id ON public.admin_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON public.admin_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin_notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.admin_notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.admin_notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.admin_notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.admin_notifications FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Super admins can manage all notifications" ON public.admin_notifications;
CREATE POLICY "Super admins can manage all notifications"
  ON public.admin_notifications FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_super_admin = true)
  );

DROP POLICY IF EXISTS "System can insert notifications" ON public.admin_notifications;
CREATE POLICY "System can insert notifications"
  ON public.admin_notifications FOR INSERT
  WITH CHECK (true);
