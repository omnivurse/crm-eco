/*
  # My Work - Notes, Daily Logs, Files, and Assignments Schema

  1. New Tables
    - `notes`
      - `id` (uuid, primary key)
      - `owner_id` (uuid, references profiles)
      - `title` (text, required)
      - `content_rich` (text) - stores rich text / markdown
      - `is_private` (boolean, default true)
      - `shared_with_roles` (text[]) - array of role names if shared
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `daily_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `work_date` (date, required)
      - `started_at` (timestamptz)
      - `ended_at` (timestamptz)
      - `blockers` (text)
      - `highlights` (text)
      - `summary` (text) - auto-generated end of day
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - Unique constraint on (user_id, work_date)

    - `files`
      - `id` (uuid, primary key)
      - `owner_id` (uuid, references profiles)
      - `filename` (text, required)
      - `storage_path` (text, required) - Supabase Storage path
      - `byte_size` (bigint)
      - `mime_type` (text)
      - `sha256` (text) - hash for version comparison
      - `version` (int, default 1)
      - `parent_file_id` (uuid, self-reference) - for versioning
      - `visibility` (enum: private, team, org)
      - `linked_task_id` (uuid, references tasks)
      - `linked_ticket_id` (uuid)
      - `linked_project_id` (uuid, references projects)
      - `virus_scan_status` (text, default 'pending')
      - `virus_scan_result` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `assignments`
      - `id` (uuid, primary key)
      - `assigned_to` (uuid, references profiles, required)
      - `assigned_by` (uuid, references profiles, required)
      - `title` (text, required)
      - `details` (text)
      - `due_at` (timestamptz)
      - `priority` (enum: low, med, high, urgent)
      - `status` (enum: new, accepted, in_progress, done, blocked, declined)
      - `progress_percent` (int, default 0, check 0-100)
      - `decline_reason` (text)
      - `accepted_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `assignment_attachments`
      - `id` (uuid, primary key)
      - `assignment_id` (uuid, references assignments)
      - `file_id` (uuid, references files)
      - `added_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Notes: owner can CRUD; if shared, specific roles can read
    - Daily logs: owner only
    - Files: owner always; team/org visibility based on enum
    - Assignments: assigned_to can read/update; assigned_by can read/manage

  3. Indexes
    - Index on notes owner_id and is_private for filtering
    - Index on daily_logs user_id and work_date for lookups
    - Index on files owner_id, linked fields, and visibility
    - Index on assignments assigned_to, assigned_by, status for dashboard queries
*/

-- Create notes table
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content_rich text,
  is_private boolean NOT NULL DEFAULT true,
  shared_with_roles text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create daily_logs table
CREATE TABLE IF NOT EXISTS public.daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  blockers text,
  highlights text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, work_date)
);

-- Create files table
CREATE TABLE IF NOT EXISTS public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,
  byte_size bigint,
  mime_type text,
  sha256 text,
  version int NOT NULL DEFAULT 1,
  parent_file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
  visibility text NOT NULL CHECK (visibility IN ('private', 'team', 'org')) DEFAULT 'private',
  linked_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  linked_ticket_id uuid,
  linked_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  virus_scan_status text NOT NULL DEFAULT 'pending',
  virus_scan_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create assignments table
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_to uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  details text,
  due_at timestamptz,
  priority text NOT NULL CHECK (priority IN ('low', 'med', 'high', 'urgent')) DEFAULT 'med',
  status text NOT NULL CHECK (status IN ('new', 'accepted', 'in_progress', 'done', 'blocked', 'declined')) DEFAULT 'new',
  progress_percent int NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  decline_reason text,
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create assignment_attachments table
CREATE TABLE IF NOT EXISTS public.assignment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, file_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_owner_id ON public.notes(owner_id);
CREATE INDEX IF NOT EXISTS idx_notes_is_private ON public.notes(is_private);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON public.notes(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON public.daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_work_date ON public.daily_logs(work_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON public.daily_logs(user_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_files_owner_id ON public.files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_visibility ON public.files(visibility);
CREATE INDEX IF NOT EXISTS idx_files_linked_task_id ON public.files(linked_task_id);
CREATE INDEX IF NOT EXISTS idx_files_linked_project_id ON public.files(linked_project_id);
CREATE INDEX IF NOT EXISTS idx_files_virus_scan_status ON public.files(virus_scan_status);
CREATE INDEX IF NOT EXISTS idx_files_parent_file_id ON public.files(parent_file_id);

CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to ON public.assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_by ON public.assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_due_at ON public.assignments(due_at);

CREATE INDEX IF NOT EXISTS idx_assignment_attachments_assignment_id ON public.assignment_attachments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_attachments_file_id ON public.assignment_attachments(file_id);

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notes

-- Owners can read their own notes
CREATE POLICY "Users can read own notes"
  ON public.notes
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Users can read shared notes if their role matches
CREATE POLICY "Users can read shared notes"
  ON public.notes
  FOR SELECT
  TO authenticated
  USING (
    NOT is_private
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY(notes.shared_with_roles)
    )
  );

-- Users can create their own notes
CREATE POLICY "Users can create notes"
  ON public.notes
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Users can update their own notes
CREATE POLICY "Users can update own notes"
  ON public.notes
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- Users can delete their own notes
CREATE POLICY "Users can delete own notes"
  ON public.notes
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- RLS Policies for daily_logs

-- Users can only read their own logs
CREATE POLICY "Users can read own daily logs"
  ON public.daily_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can create their own logs
CREATE POLICY "Users can create daily logs"
  ON public.daily_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own logs
CREATE POLICY "Users can update own daily logs"
  ON public.daily_logs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own logs
CREATE POLICY "Users can delete own daily logs"
  ON public.daily_logs
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for files

-- Users can read their own files
CREATE POLICY "Users can read own files"
  ON public.files
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Users can read team-visible files if they're in the linked project
CREATE POLICY "Users can read team files"
  ON public.files
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'team'
    AND (
      linked_project_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.projects p
        LEFT JOIN public.project_members pm ON pm.project_id = p.id
        WHERE p.id = files.linked_project_id
          AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
      )
    )
  );

-- Users can read org-visible files
CREATE POLICY "Users can read org files"
  ON public.files
  FOR SELECT
  TO authenticated
  USING (visibility = 'org');

-- Users can create files
CREATE POLICY "Users can create files"
  ON public.files
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Users can update their own files
CREATE POLICY "Users can update own files"
  ON public.files
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
  ON public.files
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- RLS Policies for assignments

-- Users can read assignments assigned to them
CREATE POLICY "Users can read assigned tasks"
  ON public.assignments
  FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());

-- Assigners can read assignments they created
CREATE POLICY "Assigners can read own assignments"
  ON public.assignments
  FOR SELECT
  TO authenticated
  USING (assigned_by = auth.uid());

-- Only specific roles can create assignments (e.g., super_admin, admin)
CREATE POLICY "Admins can create assignments"
  ON public.assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    assigned_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin')
    )
  );

-- Assigned users can update their assignments
CREATE POLICY "Users can update assigned tasks"
  ON public.assignments
  FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid());

-- Assigners can update assignments they created
CREATE POLICY "Assigners can update own assignments"
  ON public.assignments
  FOR UPDATE
  TO authenticated
  USING (assigned_by = auth.uid());

-- Only assigners can delete assignments
CREATE POLICY "Assigners can delete assignments"
  ON public.assignments
  FOR DELETE
  TO authenticated
  USING (assigned_by = auth.uid());

-- RLS Policies for assignment_attachments

-- Users can read attachments for assignments they can see
CREATE POLICY "Users can read assignment attachments"
  ON public.assignment_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_attachments.assignment_id
        AND (a.assigned_to = auth.uid() OR a.assigned_by = auth.uid())
    )
  );

-- Assigners can add attachments
CREATE POLICY "Assigners can add attachments"
  ON public.assignment_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id
        AND a.assigned_by = auth.uid()
    )
  );

-- Assigners can remove attachments
CREATE POLICY "Assigners can remove attachments"
  ON public.assignment_attachments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id
        AND a.assigned_by = auth.uid()
    )
  );

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_logs_updated_at ON public.daily_logs;
CREATE TRIGGER update_daily_logs_updated_at
  BEFORE UPDATE ON public.daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_files_updated_at ON public.files;
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_assignments_updated_at ON public.assignments;
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();