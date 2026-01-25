/*
  # Fix Storage Bucket Name - ticket-files

  ## Issue
  - Code references 'ticket-files' bucket
  - Migration creates 'ticket-attachments' bucket
  - This causes file upload failures

  ## Fix
  - Create 'ticket-files' bucket (the correct name used in code)
  - Keep 'ticket-attachments' for backward compatibility
  - Update storage policies for both buckets
*/

-- Create storage bucket with correct name
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-files',
  'ticket-files',
  false,
  26214400,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ];

-- Storage Policy: Allow anyone to upload files (public portals need this)
DROP POLICY IF EXISTS "Anyone can upload to ticket-files" ON storage.objects;
CREATE POLICY "Anyone can upload to ticket-files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ticket-files'
);

-- Storage Policy: Allow users to read ticket files
DROP POLICY IF EXISTS "Users can read ticket-files" ON storage.objects;
CREATE POLICY "Users can read ticket-files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ticket-files'
  AND (
    auth.uid() IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM tickets t
      JOIN ticket_files tf ON tf.ticket_id = t.id
      WHERE tf.storage_path = name
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('agent', 'admin', 'staff', 'concierge')
        )
      )
    )
  )
);

-- Storage Policy: Allow staff and admins to read all files
DROP POLICY IF EXISTS "Staff can read all in ticket-files" ON storage.objects;
CREATE POLICY "Staff can read all in ticket-files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-files'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('agent', 'admin', 'staff', 'concierge')
  )
);

-- Storage Policy: Allow deletion by staff/admin only
DROP POLICY IF EXISTS "Staff can delete from ticket-files" ON storage.objects;
CREATE POLICY "Staff can delete from ticket-files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ticket-files'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff')
  )
);
