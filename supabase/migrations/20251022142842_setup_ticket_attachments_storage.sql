/*
  # Setup Ticket Attachments Storage

  ## Overview
  Creates and configures Supabase Storage bucket for ticket file attachments
  with proper security policies for public and authenticated uploads.

  ## Storage Bucket
    - `ticket-attachments` - Main bucket for all ticket files
      - Public: false (files require authentication or specific access)
      - File size limit: 25MB per file
      - Allowed MIME types: Images, PDFs, Documents

  ## Storage Policies
    - Allow authenticated users to upload files
    - Allow anonymous users to upload files (for public portals)
    - Allow users to read files from their tickets
    - Allow staff/admin to read all files
*/

-- Create storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
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
DROP POLICY IF EXISTS "Anyone can upload ticket files" ON storage.objects;
CREATE POLICY "Anyone can upload ticket files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ticket-attachments'
);

-- Storage Policy: Allow authenticated users to upload
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments'
);

-- Storage Policy: Allow users to read their ticket files
DROP POLICY IF EXISTS "Users can read own ticket files" ON storage.objects;
CREATE POLICY "Users can read own ticket files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ticket-attachments'
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
DROP POLICY IF EXISTS "Staff can read all ticket files" ON storage.objects;
CREATE POLICY "Staff can read all ticket files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('agent', 'admin', 'staff', 'concierge')
  )
);

-- Storage Policy: Allow deletion by staff/admin only
DROP POLICY IF EXISTS "Staff can delete ticket files" ON storage.objects;
CREATE POLICY "Staff can delete ticket files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff')
  )
);