/*
  # RLS Performance Optimization Part 4 - Team Collaboration & Final Policies

  Final batch covering:
  - Team meetings and announcements
  - Chat features (quick responses, preferences, notes)
  - System health monitoring
  - Projects and tasks
  - Tickets and profiles
*/

-- =============================================
-- TEAM MEETINGS
-- =============================================

DROP POLICY IF EXISTS "Staff can view all meetings" ON public.team_meetings;
CREATE POLICY "Staff can view all meetings"
  ON public.team_meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Staff can create meetings" ON public.team_meetings;
CREATE POLICY "Staff can create meetings"
  ON public.team_meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Meeting creators can update their meetings" ON public.team_meetings;
CREATE POLICY "Meeting creators can update their meetings"
  ON public.team_meetings FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Meeting creators can delete their meetings" ON public.team_meetings;
CREATE POLICY "Meeting creators can delete their meetings"
  ON public.team_meetings FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

-- =============================================
-- MEETING PARTICIPANTS
-- =============================================

DROP POLICY IF EXISTS "Staff can view meeting participants" ON public.meeting_participants;
CREATE POLICY "Staff can view meeting participants"
  ON public.meeting_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Meeting creators can add participants" ON public.meeting_participants;
CREATE POLICY "Meeting creators can add participants"
  ON public.meeting_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_meetings tm
      WHERE tm.id = meeting_participants.meeting_id
      AND tm.created_by = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own participation status" ON public.meeting_participants;
CREATE POLICY "Users can update their own participation status"
  ON public.meeting_participants FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- =============================================
-- TEAM ANNOUNCEMENTS
-- =============================================

DROP POLICY IF EXISTS "Staff can view announcements for their role" ON public.team_announcements;
CREATE POLICY "Staff can view announcements for their role"
  ON public.team_announcements FOR SELECT
  TO authenticated
  USING (
    target_roles IS NULL
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role = ANY(target_roles)
    )
  );

DROP POLICY IF EXISTS "Admins can create announcements" ON public.team_announcements;
CREATE POLICY "Admins can create announcements"
  ON public.team_announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update announcements" ON public.team_announcements;
CREATE POLICY "Admins can update announcements"
  ON public.team_announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete announcements" ON public.team_announcements;
CREATE POLICY "Admins can delete announcements"
  ON public.team_announcements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- ANNOUNCEMENT READS
-- =============================================

DROP POLICY IF EXISTS "Users can view their own reads" ON public.announcement_reads;
CREATE POLICY "Users can view their own reads"
  ON public.announcement_reads FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can mark announcements as read" ON public.announcement_reads;
CREATE POLICY "Users can mark announcements as read"
  ON public.announcement_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- =============================================
-- TEAM PRESENCE
-- =============================================

DROP POLICY IF EXISTS "Staff can view team presence" ON public.team_presence;
CREATE POLICY "Staff can view team presence"
  ON public.team_presence FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Users can update their own presence" ON public.team_presence;
CREATE POLICY "Users can update their own presence"
  ON public.team_presence FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own presence status" ON public.team_presence;
CREATE POLICY "Users can update their own presence status"
  ON public.team_presence FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- =============================================
-- TEAM ACTIVITIES
-- =============================================

DROP POLICY IF EXISTS "Staff can view team activities" ON public.team_activities;
CREATE POLICY "Staff can view team activities"
  ON public.team_activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- =============================================
-- CHAT QUICK RESPONSES
-- =============================================

DROP POLICY IF EXISTS "quick_responses_agent_read" ON public.chat_quick_responses;
CREATE POLICY "quick_responses_agent_read"
  ON public.chat_quick_responses FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "quick_responses_agent_insert" ON public.chat_quick_responses;
CREATE POLICY "quick_responses_agent_insert"
  ON public.chat_quick_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "quick_responses_creator_update" ON public.chat_quick_responses;
CREATE POLICY "quick_responses_creator_update"
  ON public.chat_quick_responses FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "quick_responses_creator_delete" ON public.chat_quick_responses;
CREATE POLICY "quick_responses_creator_delete"
  ON public.chat_quick_responses FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

-- =============================================
-- AGENT CHAT PREFERENCES
-- =============================================

DROP POLICY IF EXISTS "chat_prefs_agent_all" ON public.agent_chat_preferences;
CREATE POLICY "chat_prefs_agent_all"
  ON public.agent_chat_preferences FOR ALL
  TO authenticated
  USING (agent_id = (select auth.uid()));

DROP POLICY IF EXISTS "chat_prefs_admin_read" ON public.agent_chat_preferences;
CREATE POLICY "chat_prefs_admin_read"
  ON public.agent_chat_preferences FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- CHAT SESSION NOTES
-- =============================================

DROP POLICY IF EXISTS "session_notes_agent_read" ON public.chat_session_notes;
CREATE POLICY "session_notes_agent_read"
  ON public.chat_session_notes FOR SELECT
  TO authenticated
  USING (
    agent_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "session_notes_agent_insert" ON public.chat_session_notes;
CREATE POLICY "session_notes_agent_insert"
  ON public.chat_session_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- =============================================
-- SYSTEM HEALTH LOGS
-- =============================================

DROP POLICY IF EXISTS "Super admins and admins can read health logs" ON public.system_health_logs;
CREATE POLICY "Super admins and admins can read health logs"
  ON public.system_health_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- SYSTEM METRICS
-- =============================================

DROP POLICY IF EXISTS "Super admins and admins can read metrics" ON public.system_metrics;
CREATE POLICY "Super admins and admins can read metrics"
  ON public.system_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- SYSTEM INCIDENTS
-- =============================================

DROP POLICY IF EXISTS "Super admins and admins can read incidents" ON public.system_incidents;
CREATE POLICY "Super admins and admins can read incidents"
  ON public.system_incidents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Super admins and admins can create incidents" ON public.system_incidents;
CREATE POLICY "Super admins and admins can create incidents"
  ON public.system_incidents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Super admins and admins can update incidents" ON public.system_incidents;
CREATE POLICY "Super admins and admins can update incidents"
  ON public.system_incidents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- SYSTEM ALERTS
-- =============================================

DROP POLICY IF EXISTS "Super admins and admins can manage alerts" ON public.system_alerts;
CREATE POLICY "Super admins and admins can manage alerts"
  ON public.system_alerts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- CHANGE & REQUEST TASKS
-- =============================================

DROP POLICY IF EXISTS "change_tasks_staff_access" ON public.change_tasks;
CREATE POLICY "change_tasks_staff_access"
  ON public.change_tasks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "request_tasks_staff_access" ON public.request_tasks;
CREATE POLICY "request_tasks_staff_access"
  ON public.request_tasks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "request_tasks_requester_read" ON public.request_tasks;
CREATE POLICY "request_tasks_requester_read"
  ON public.request_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_tasks.request_id
      AND r.requester_id = (select auth.uid())
    )
  );

-- =============================================
-- PROJECTS
-- =============================================

DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Users can create projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can read own and member projects" ON public.projects;
CREATE POLICY "Users can read own and member projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    owner_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id
      AND pm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners and editors can update projects" ON public.projects;
CREATE POLICY "Owners and editors can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    owner_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id
      AND pm.user_id = (select auth.uid())
      AND pm.role IN ('owner', 'editor')
    )
  )
  WITH CHECK (
    owner_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id
      AND pm.user_id = (select auth.uid())
      AND pm.role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "Owners can delete projects" ON public.projects;
CREATE POLICY "Owners can delete projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (owner_id = (select auth.uid()));

-- =============================================
-- PROJECT MEMBERS
-- =============================================

DROP POLICY IF EXISTS "Users can read project members" ON public.project_members;
CREATE POLICY "Users can read project members"
  ON public.project_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      AND (
        p.owner_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.project_members pm2
          WHERE pm2.project_id = p.id
          AND pm2.user_id = (select auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Project owners can add members" ON public.project_members;
CREATE POLICY "Project owners can add members"
  ON public.project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      AND p.owner_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Project owners can update members" ON public.project_members;
CREATE POLICY "Project owners can update members"
  ON public.project_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      AND p.owner_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Project owners can remove members" ON public.project_members;
CREATE POLICY "Project owners can remove members"
  ON public.project_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      AND p.owner_id = (select auth.uid())
    )
  );

-- =============================================
-- TASKS
-- =============================================

DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
CREATE POLICY "Users can create tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can read relevant tasks" ON public.tasks;
CREATE POLICY "Users can read relevant tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    created_by = (select auth.uid())
    OR assigned_to = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
      AND (
        p.owner_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id
          AND pm.user_id = (select auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Relevant users can update tasks" ON public.tasks;
CREATE POLICY "Relevant users can update tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    created_by = (select auth.uid())
    OR assigned_to = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
      AND (
        p.owner_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id
          AND pm.user_id = (select auth.uid())
          AND pm.role IN ('owner', 'editor')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Creators and project owners can delete tasks" ON public.tasks;
CREATE POLICY "Creators and project owners can delete tasks"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
      AND p.owner_id = (select auth.uid())
    )
  );

-- =============================================
-- TASK WATCHERS
-- =============================================

DROP POLICY IF EXISTS "Users can read task watchers" ON public.task_watchers;
CREATE POLICY "Users can read task watchers"
  ON public.task_watchers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_watchers.task_id
      AND (
        t.created_by = (select auth.uid())
        OR t.assigned_to = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = t.project_id
          AND (
            p.owner_id = (select auth.uid())
            OR EXISTS (
              SELECT 1 FROM public.project_members pm
              WHERE pm.project_id = p.id
              AND pm.user_id = (select auth.uid())
            )
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can watch tasks" ON public.task_watchers;
CREATE POLICY "Users can watch tasks"
  ON public.task_watchers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can unwatch tasks" ON public.task_watchers;
CREATE POLICY "Users can unwatch tasks"
  ON public.task_watchers FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- =============================================
-- TICKETS (CRITICAL PERFORMANCE)
-- =============================================

DROP POLICY IF EXISTS "tickets_anonymous_view_own" ON public.tickets;
CREATE POLICY "tickets_anonymous_view_own"
  ON public.tickets FOR SELECT
  TO anon
  USING (submitter_email = current_setting('request.headers')::json->>'x-customer-email');

DROP POLICY IF EXISTS "tickets_requester_read" ON public.tickets;
CREATE POLICY "tickets_requester_read"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (requester_id = (select auth.uid()));

DROP POLICY IF EXISTS "tickets_agent_all" ON public.tickets;
CREATE POLICY "tickets_agent_all"
  ON public.tickets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- =============================================
-- TICKET ATTACHMENTS
-- =============================================

DROP POLICY IF EXISTS "attachments_ticket_access" ON public.ticket_attachments;
CREATE POLICY "attachments_ticket_access"
  ON public.ticket_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_attachments.ticket_id
      AND (
        t.requester_id = (select auth.uid())
        OR t.assignee_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = (select auth.uid())
          AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
        )
      )
    )
  );

DROP POLICY IF EXISTS "attachments_insert" ON public.ticket_attachments;
CREATE POLICY "attachments_insert"
  ON public.ticket_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_attachments.ticket_id
      AND (
        t.requester_id = (select auth.uid())
        OR t.assignee_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = (select auth.uid())
          AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
        )
      )
    )
  );

-- =============================================
-- KB ARTICLES
-- =============================================

DROP POLICY IF EXISTS "kb_author_all" ON public.kb_articles;
CREATE POLICY "kb_author_all"
  ON public.kb_articles FOR ALL
  TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- PROFILES
-- =============================================

DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
CREATE POLICY "users_update_own_profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;
CREATE POLICY "users_insert_own_profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));
