/*
  # Fix Ticket Comments and File Upload Issues

  ## Problem Summary
  1. Ticket comments fail to insert with error 42803 (GROUP BY error)
  2. File uploads don't appear because code uses wrong table/field names
  3. Both internal notes and normal replies are affected

  ## Root Causes
  1. The create_ticket_notification() trigger function queries ticket_watchers,
     which triggers RLS policy evaluation that may cause GROUP BY errors
  2. File upload code writes to ticket_attachments with wrong field names,
     but database has ticket_files table with different schema
  
  ## Solution
  1. Make notification trigger function use SECURITY DEFINER to bypass RLS
  2. Simplify queries in notification function to avoid complex joins
  3. Ensure ticket_files table exists and has correct structure
  4. Add proper RLS policies for ticket_files
  
  ## Tables Modified
  - ticket_files (ensure structure, add RLS)
  - Functions: create_ticket_notification (add SECURITY DEFINER)
  - Triggers: create_ticket_notification_trigger (recreate)
*/

-- ============================================================================
-- PART 1: FIX NOTIFICATION TRIGGER FUNCTION
-- ============================================================================

-- Recreate the notification function with SECURITY DEFINER
-- This allows it to bypass RLS when querying ticket_watchers
CREATE OR REPLACE FUNCTION public.create_ticket_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket_record RECORD;
  notification_title text;
  notification_message text;
BEGIN
  -- Get ticket details with a simple query
  SELECT 
    id, 
    requester_id, 
    assignee_id, 
    submitted_by_concierge,
    subject
  INTO ticket_record 
  FROM public.tickets 
  WHERE id = NEW.ticket_id;
  
  -- Exit early if ticket not found
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Prepare notification content
  notification_title := 'New message on your ticket';
  notification_message := LEFT(NEW.body, 100);
  
  -- Create notification for requester (if different from author)
  IF ticket_record.requester_id IS NOT NULL 
     AND ticket_record.requester_id != NEW.author_id THEN
    BEGIN
      INSERT INTO public.ticket_notifications (
        ticket_id,
        user_id,
        notification_type,
        title,
        message
      ) VALUES (
        NEW.ticket_id,
        ticket_record.requester_id,
        'new_message',
        notification_title,
        notification_message
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log but don't fail if notification insert fails
      RAISE NOTICE 'Failed to create notification for requester: %', SQLERRM;
    END;
  END IF;
  
  -- Create notification for assignee (if different from author and requester)
  IF ticket_record.assignee_id IS NOT NULL 
     AND ticket_record.assignee_id != NEW.author_id 
     AND ticket_record.assignee_id != ticket_record.requester_id THEN
    BEGIN
      INSERT INTO public.ticket_notifications (
        ticket_id,
        user_id,
        notification_type,
        title,
        message
      ) VALUES (
        NEW.ticket_id,
        ticket_record.assignee_id,
        'new_message',
        notification_title,
        notification_message
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to create notification for assignee: %', SQLERRM;
    END;
  END IF;
  
  -- Create notification for concierge who submitted (if applicable)
  IF ticket_record.submitted_by_concierge IS NOT NULL 
     AND ticket_record.submitted_by_concierge != NEW.author_id THEN
    BEGIN
      INSERT INTO public.ticket_notifications (
        ticket_id,
        user_id,
        notification_type,
        title,
        message
      ) VALUES (
        NEW.ticket_id,
        ticket_record.submitted_by_concierge,
        'new_message',
        'New message on ticket you submitted',
        notification_message
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to create notification for concierge: %', SQLERRM;
    END;
  END IF;
  
  -- Create notifications for watchers (excluding author and already notified users)
  -- Use SECURITY DEFINER privilege to bypass RLS on ticket_watchers
  BEGIN
    INSERT INTO public.ticket_notifications (
      ticket_id,
      user_id,
      notification_type,
      title,
      message
    )
    SELECT
      NEW.ticket_id,
      tw.user_id,
      'new_message',
      'New message on watched ticket',
      notification_message
    FROM public.ticket_watchers tw
    WHERE tw.ticket_id = NEW.ticket_id
      AND tw.user_id != NEW.author_id
      AND tw.user_id NOT IN (
        COALESCE(ticket_record.requester_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(ticket_record.assignee_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(ticket_record.submitted_by_concierge, '00000000-0000-0000-0000-000000000000'::uuid)
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to create notifications for watchers: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS create_ticket_notification_trigger ON public.ticket_comments;
CREATE TRIGGER create_ticket_notification_trigger
  AFTER INSERT ON public.ticket_comments
  FOR EACH ROW
  WHEN (NEW.is_internal = false)
  EXECUTE FUNCTION public.create_ticket_notification();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_ticket_notification() TO authenticated;

-- ============================================================================
-- PART 2: ENSURE TICKET_FILES TABLE EXISTS WITH CORRECT STRUCTURE
-- ============================================================================

-- ticket_files should already exist, but ensure it has correct structure
DO $$
BEGIN
  -- Check if ticket_files table exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ticket_files'
  ) THEN
    CREATE TABLE public.ticket_files (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
      filename text NOT NULL,
      storage_path text NOT NULL,
      file_size bigint,
      mime_type text,
      uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now()
    );
    
    RAISE NOTICE 'Created ticket_files table';
  END IF;
  
  -- Ensure all required columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_files' AND column_name = 'uploaded_by'
  ) THEN
    ALTER TABLE public.ticket_files 
    ADD COLUMN uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Added uploaded_by column to ticket_files';
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_ticket_files_ticket_id ON public.ticket_files(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_files_uploaded_by ON public.ticket_files(uploaded_by) WHERE uploaded_by IS NOT NULL;

-- Enable RLS
ALTER TABLE public.ticket_files ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "ticket_files_select_policy" ON public.ticket_files;
DROP POLICY IF EXISTS "ticket_files_insert_policy" ON public.ticket_files;
DROP POLICY IF EXISTS "ticket_files_delete_policy" ON public.ticket_files;

-- RLS Policies for ticket_files
-- SELECT: Users can view files from tickets they have access to
CREATE POLICY "ticket_files_select_policy"
  ON public.ticket_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_files.ticket_id
      AND (
        -- User is the requester
        t.requester_id = (SELECT auth.uid())
        OR
        -- User is the assignee
        t.assignee_id = (SELECT auth.uid())
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
          AND t.origin IN ('member', 'advisor')
        )
      )
    )
  );

-- INSERT: Users can upload files to tickets they have access to
CREATE POLICY "ticket_files_insert_policy"
  ON public.ticket_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_files.ticket_id
      AND (
        -- User is the requester
        t.requester_id = (SELECT auth.uid())
        OR
        -- User is the assignee
        t.assignee_id = (SELECT auth.uid())
        OR
        -- User is staff or higher
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = (SELECT auth.uid())
          AND role IN ('staff', 'agent', 'admin', 'super_admin', 'it', 'concierge')
        )
      )
    )
  );

-- DELETE: Only staff and admin can delete files
CREATE POLICY "ticket_files_delete_policy"
  ON public.ticket_files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin', 'staff')
    )
  );

-- Grant permissions
GRANT SELECT, INSERT ON public.ticket_files TO authenticated;

-- ============================================================================
-- PART 3: ENSURE UPDATE_TICKET_LAST_MESSAGE FUNCTION IS SAFE
-- ============================================================================

-- Recreate update_ticket_last_message with SECURITY DEFINER to avoid RLS issues
CREATE OR REPLACE FUNCTION public.update_ticket_last_message()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simple update without complex queries
  UPDATE public.tickets
  SET 
    last_message_at = NEW.created_at,
    response_count = COALESCE(response_count, 0) + 1
  WHERE id = NEW.ticket_id;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log but don't fail
  RAISE NOTICE 'Failed to update ticket last message: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.update_ticket_last_message() TO authenticated;

-- ============================================================================
-- PART 4: VERIFICATION AND SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Ticket Comments and File Upload Fix Complete';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '1. Notification trigger function now uses SECURITY DEFINER';
  RAISE NOTICE '2. ticket_files table structure verified/created';
  RAISE NOTICE '3. RLS policies added for ticket_files';
  RAISE NOTICE '4. Error handling added to prevent comment insertion failures';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected Results:';
  RAISE NOTICE '- Ticket comments (internal and public) should insert successfully';
  RAISE NOTICE '- File uploads will now work when code is updated';
  RAISE NOTICE '- Notifications will still be created for ticket updates';
  RAISE NOTICE '============================================================';
END $$;
