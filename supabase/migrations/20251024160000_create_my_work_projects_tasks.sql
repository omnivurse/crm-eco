/*
  # My Work - Projects & Tasks Schema

  1. New Tables
    - `projects`
      - `id` (uuid, primary key)
      - `owner_id` (uuid, references profiles)
      - `name` (text, required)
      - `description` (text)
      - `status` (enum: active, on_hold, completed, archived)
      - `start_date` (date)
      - `target_date` (date)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `project_members`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `user_id` (uuid, references profiles)
      - `role` (enum: owner, editor, viewer)
      - `added_at` (timestamptz)
      - Unique constraint on (project_id, user_id)

    - `tasks`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects, nullable)
      - `assignee_id` (uuid, references profiles, nullable)
      - `created_by_id` (uuid, references profiles)
      - `title` (text, required)
      - `description` (text)
      - `status` (enum: todo, in_progress, review, done)
      - `priority` (enum: low, med, high, urgent)
      - `due_at` (timestamptz)
      - `estimate_hours` (numeric)
      - `parent_task_id` (uuid, self-reference, nullable)
      - `ticket_id` (uuid, nullable) - links to existing tickets table
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `task_watchers`
      - `id` (uuid, primary key)
      - `task_id` (uuid, references tasks)
      - `user_id` (uuid, references profiles)
      - `added_at` (timestamptz)
      - Unique constraint on (task_id, user_id)

  2. Security
    - Enable RLS on all tables
    - Projects: owner and project members can read/update
    - Tasks: assignee, creator, and project members can read/update
    - Task watchers: users can manage their own subscriptions

  3. Indexes
    - Index on project owner_id for fast user project lookup
    - Index on task assignee_id, project_id, status for filtering
    - Index on task parent_task_id for subtask queries
    - Index on task_watchers for notification queries
*/

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL CHECK (status IN ('active', 'on_hold', 'completed', 'archived')) DEFAULT 'active',
  start_date date,
  target_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create project_members table
CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')) DEFAULT 'viewer',
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL CHECK (status IN ('todo', 'in_progress', 'review', 'done')) DEFAULT 'todo',
  priority text NOT NULL CHECK (priority IN ('low', 'med', 'high', 'urgent')) DEFAULT 'med',
  due_at timestamptz,
  estimate_hours numeric,
  parent_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ticket_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create task_watchers table
CREATE TABLE IF NOT EXISTS public.task_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by_id ON public.tasks(created_by_id);
CREATE INDEX IF NOT EXISTS idx_task_watchers_user_id ON public.task_watchers(user_id);
CREATE INDEX IF NOT EXISTS idx_task_watchers_task_id ON public.task_watchers(task_id);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_watchers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects

-- Users can read projects they own or are members of
CREATE POLICY "Users can read own and member projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id
        AND pm.user_id = auth.uid()
    )
  );

-- Users can create projects (become owner)
CREATE POLICY "Users can create projects"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Owners and editors can update projects
CREATE POLICY "Owners and editors can update projects"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'editor')
    )
  );

-- Only owners can delete projects
CREATE POLICY "Owners can delete projects"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- RLS Policies for project_members

-- Users can read project members for projects they have access to
CREATE POLICY "Users can read project members"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_members pm2
            WHERE pm2.project_id = p.id
              AND pm2.user_id = auth.uid()
          )
        )
    )
  );

-- Project owners can add members
CREATE POLICY "Project owners can add members"
  ON public.project_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND p.owner_id = auth.uid()
    )
  );

-- Project owners can update member roles
CREATE POLICY "Project owners can update members"
  ON public.project_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND p.owner_id = auth.uid()
    )
  );

-- Project owners can remove members
CREATE POLICY "Project owners can remove members"
  ON public.project_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND p.owner_id = auth.uid()
    )
  );

-- RLS Policies for tasks

-- Users can read tasks they're assigned to, created, watching, or part of project
CREATE POLICY "Users can read relevant tasks"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    assignee_id = auth.uid()
    OR created_by_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.task_watchers tw
      WHERE tw.task_id = tasks.id
        AND tw.user_id = auth.uid()
    )
    OR (
      project_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.projects p
        LEFT JOIN public.project_members pm ON pm.project_id = p.id
        WHERE p.id = tasks.project_id
          AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
      )
    )
  );

-- Users can create tasks
CREATE POLICY "Users can create tasks"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by_id = auth.uid());

-- Assignees, creators, and project editors can update tasks
CREATE POLICY "Relevant users can update tasks"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    assignee_id = auth.uid()
    OR created_by_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = tasks.project_id
          AND pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'editor')
      )
    )
  );

-- Creators and project owners can delete tasks
CREATE POLICY "Creators and project owners can delete tasks"
  ON public.tasks
  FOR DELETE
  TO authenticated
  USING (
    created_by_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = tasks.project_id
          AND p.owner_id = auth.uid()
      )
    )
  );

-- RLS Policies for task_watchers

-- Users can read watchers for tasks they have access to
CREATE POLICY "Users can read task watchers"
  ON public.task_watchers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_watchers.task_id
        AND (
          t.assignee_id = auth.uid()
          OR t.created_by_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.task_watchers tw2
            WHERE tw2.task_id = t.id
              AND tw2.user_id = auth.uid()
          )
          OR (
            t.project_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.projects p
              LEFT JOIN public.project_members pm ON pm.project_id = p.id
              WHERE p.id = t.project_id
                AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
            )
          )
        )
    )
  );

-- Users can add themselves as watchers to tasks they can see
CREATE POLICY "Users can watch tasks"
  ON public.task_watchers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id
        AND (
          t.assignee_id = auth.uid()
          OR t.created_by_id = auth.uid()
          OR (
            t.project_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.projects p
              LEFT JOIN public.project_members pm ON pm.project_id = p.id
              WHERE p.id = t.project_id
                AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
            )
          )
        )
    )
  );

-- Users can remove themselves as watchers
CREATE POLICY "Users can unwatch tasks"
  ON public.task_watchers
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create updated_at trigger function if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
