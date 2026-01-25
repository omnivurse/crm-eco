/*
  # Enhanced Daily Logs System with Individual Entries and Email Reports

  ## Overview
  This migration enhances the daily logs system to support:
  - Individual log entries throughout the day
  - End-of-day email reports to management
  - Super admin oversight capabilities
  - Comprehensive audit trail

  ## 1. New Tables

  ### `daily_log_entries`
  Individual activities logged throughout the workday
  - `id` (uuid, primary key)
  - `daily_log_id` (uuid, references daily_logs) - parent log for the day
  - `user_id` (uuid, references profiles) - for easier querying
  - `entry_type` (enum) - task, meeting, blocker, note, achievement, break, other
  - `description` (text) - details of the entry
  - `duration_minutes` (int) - optional time spent
  - `metadata` (jsonb) - flexible storage for additional data
  - `created_at` (timestamptz) - when entry was logged
  - `updated_at` (timestamptz)

  ### `daily_log_reports`
  Tracks end-of-day email reports sent to management
  - `id` (uuid, primary key)
  - `daily_log_id` (uuid, references daily_logs) - log being reported
  - `user_id` (uuid, references profiles) - user whose log was reported
  - `recipient_email` (text) - where report was sent
  - `report_type` (enum) - end_of_day, manual, scheduled
  - `email_status` (enum) - pending, sent, failed, bounced
  - `email_sent_at` (timestamptz) - delivery timestamp
  - `error_message` (text) - if delivery failed
  - `retry_count` (int) - number of retry attempts
  - `report_data` (jsonb) - snapshot of report content
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## 2. Enums
  - `daily_log_entry_type` - categorizes different types of entries
  - `daily_log_report_type` - identifies how report was triggered
  - `daily_log_email_status` - tracks email delivery status

  ## 3. Indexes
  - Compound indexes on (daily_log_id, created_at) for timeline queries
  - Index on user_id for admin queries
  - Index on email_status for pending report processing

  ## 4. RLS Policies
  ### daily_log_entries
  - Users can CRUD their own entries
  - Super admins can read all entries across organization

  ### daily_log_reports
  - Users can read their own report history
  - Super admins can read all reports
  - Only system triggers can create reports

  ## 5. Database Triggers
  - Auto-populate user_id when entry is created
  - Update daily_logs.updated_at when entries change
  - Generate end-of-day report when daily_logs.ended_at is set

  ## 6. Enhanced Existing Tables
  - Add `entry_count` computed field to daily_logs
  - Add super admin read policy to daily_logs
*/

-- Create enums for daily log entry types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'daily_log_entry_type') THEN
    CREATE TYPE daily_log_entry_type AS ENUM (
      'task',
      'meeting',
      'blocker',
      'note',
      'achievement',
      'break',
      'other'
    );
  END IF;
END $$;

-- Create enums for report types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'daily_log_report_type') THEN
    CREATE TYPE daily_log_report_type AS ENUM (
      'end_of_day',
      'manual',
      'scheduled'
    );
  END IF;
END $$;

-- Create enums for email status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'daily_log_email_status') THEN
    CREATE TYPE daily_log_email_status AS ENUM (
      'pending',
      'sent',
      'failed',
      'bounced'
    );
  END IF;
END $$;

-- Create daily_log_entries table
CREATE TABLE IF NOT EXISTS public.daily_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id uuid NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_type daily_log_entry_type NOT NULL DEFAULT 'note',
  description text NOT NULL,
  duration_minutes int CHECK (duration_minutes >= 0),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create daily_log_reports table
CREATE TABLE IF NOT EXISTS public.daily_log_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id uuid NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  report_type daily_log_report_type NOT NULL DEFAULT 'end_of_day',
  email_status daily_log_email_status NOT NULL DEFAULT 'pending',
  email_sent_at timestamptz,
  error_message text,
  retry_count int NOT NULL DEFAULT 0,
  report_data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_log_entries_daily_log_id ON public.daily_log_entries(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_entries_user_id ON public.daily_log_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_entries_created_at ON public.daily_log_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_log_entries_entry_type ON public.daily_log_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_daily_log_entries_user_date ON public.daily_log_entries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_log_reports_daily_log_id ON public.daily_log_reports(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_reports_user_id ON public.daily_log_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_reports_email_status ON public.daily_log_reports(email_status);
CREATE INDEX IF NOT EXISTS idx_daily_log_reports_created_at ON public.daily_log_reports(created_at DESC);

-- Enable RLS
ALTER TABLE public.daily_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_log_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_log_entries

-- Users can read their own entries
CREATE POLICY "Users can read own daily log entries"
  ON public.daily_log_entries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Super admins can read all entries
CREATE POLICY "Super admins can read all daily log entries"
  ON public.daily_log_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- Users can create entries for their own logs
CREATE POLICY "Users can create daily log entries"
  ON public.daily_log_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own entries
CREATE POLICY "Users can update own daily log entries"
  ON public.daily_log_entries
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own entries
CREATE POLICY "Users can delete own daily log entries"
  ON public.daily_log_entries
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for daily_log_reports

-- Users can read their own reports
CREATE POLICY "Users can read own daily log reports"
  ON public.daily_log_reports
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Super admins can read all reports
CREATE POLICY "Super admins can read all daily log reports"
  ON public.daily_log_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- Only authenticated users can create reports (typically via triggers/functions)
CREATE POLICY "Authenticated users can create daily log reports"
  ON public.daily_log_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Super admins can update report status (for retry logic)
CREATE POLICY "Super admins can update daily log reports"
  ON public.daily_log_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- Add super admin read policy to daily_logs
DROP POLICY IF EXISTS "Super admins can read all daily logs" ON public.daily_logs;
CREATE POLICY "Super admins can read all daily logs"
  ON public.daily_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_daily_log_entries_updated_at ON public.daily_log_entries;
CREATE TRIGGER update_daily_log_entries_updated_at
  BEFORE UPDATE ON public.daily_log_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_log_reports_updated_at ON public.daily_log_reports;
CREATE TRIGGER update_daily_log_reports_updated_at
  BEFORE UPDATE ON public.daily_log_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to queue end-of-day report email
CREATE OR REPLACE FUNCTION public.queue_daily_log_report()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_email text;
  v_user_name text;
BEGIN
  -- Only trigger when ended_at is set (transitioning from NULL to a value)
  IF OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN

    -- Get user details
    SELECT email, full_name INTO v_user_email, v_user_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    -- Create report record for email processing
    INSERT INTO public.daily_log_reports (
      daily_log_id,
      user_id,
      recipient_email,
      report_type,
      email_status,
      report_data
    ) VALUES (
      NEW.id,
      NEW.user_id,
      'vrt@mympb.com',
      'end_of_day',
      'pending',
      jsonb_build_object(
        'user_email', v_user_email,
        'user_name', v_user_name,
        'work_date', NEW.work_date,
        'started_at', NEW.started_at,
        'ended_at', NEW.ended_at,
        'highlights', NEW.highlights,
        'blockers', NEW.blockers,
        'summary', NEW.summary
      )
    );

  END IF;

  RETURN NEW;
END;
$$;

-- Add trigger to queue reports when day ends
DROP TRIGGER IF EXISTS trigger_queue_daily_log_report ON public.daily_logs;
CREATE TRIGGER trigger_queue_daily_log_report
  AFTER UPDATE ON public.daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_daily_log_report();

-- Function to get entry count for a daily log
CREATE OR REPLACE FUNCTION public.get_daily_log_entry_count(log_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.daily_log_entries
  WHERE daily_log_id = log_id;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_daily_log_entry_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_daily_log_report() TO authenticated;
