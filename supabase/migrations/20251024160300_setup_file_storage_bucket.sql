/*
  # Setup File Storage Bucket for My Work Files

  1. Storage Bucket Creation
    - Create `it_files` bucket for storing user files
    - Configure bucket as private with authenticated access
    - Enable file size limits and allowed MIME types

  2. Storage Policies
    - Users can upload files they own
    - Users can read files based on visibility settings
    - Users can delete their own files
    - File downloads require authentication

  3. Security
    - All file operations require authentication
    - RLS-style policies for storage bucket
    - Virus scanning status tracked in files table
*/

-- Create storage bucket for IT files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'it_files',
  'it_files',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for it_files bucket

-- Users can upload files to their own folder
CREATE POLICY "Users can upload own files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'it_files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can read their own files
CREATE POLICY "Users can read own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'it_files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can read org-visible files
CREATE POLICY "Users can read org files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'it_files'
  AND EXISTS (
    SELECT 1 FROM public.files
    WHERE files.storage_path = storage.objects.name
      AND files.visibility = 'org'
  )
);

-- Users can read team-visible files if they're in the linked project
CREATE POLICY "Users can read team files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'it_files'
  AND EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.storage_path = storage.objects.name
      AND f.visibility = 'team'
      AND f.linked_project_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.projects p
        LEFT JOIN public.project_members pm ON pm.project_id = p.id
        WHERE p.id = f.linked_project_id
          AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
      )
  )
);

-- Users can update their own files (versioning)
CREATE POLICY "Users can update own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'it_files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'it_files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
