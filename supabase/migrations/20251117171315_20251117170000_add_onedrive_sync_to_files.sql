/*
  # Add OneDrive Sync Support to Files Table

  ## Overview
  This migration extends the files table to support Microsoft OneDrive synchronization:
  - Adds OneDrive-specific sync tracking fields
  - Creates indexes for efficient sync operations
  - Adds helper functions for sync management

  ## 1. Schema Extensions

  ### Extend `files` table
  - `onedrive_id` (text) - OneDrive file ID for synced files
  - `onedrive_sync_status` (text) - sync status: not_synced, syncing, synced, conflict, error
  - `onedrive_last_sync_at` (timestamptz) - last successful sync timestamp
  - `onedrive_metadata` (jsonb) - OneDrive-specific metadata (webUrl, parentReference, eTag, etc)

  ## 2. Indexes
  - Index on onedrive_id for reverse lookup from OneDrive to local files
  - Index on onedrive_sync_status for batch sync operations
  - Compound index on (owner_id, onedrive_sync_status) for user-specific sync queries
  - Index on onedrive_last_sync_at for finding stale syncs

  ## 3. Helper Functions
  - Function to mark files as needing sync
  - Function to get files pending sync for a user
  - Function to update sync status in bulk

  ## 4. Security
  - No changes to RLS policies needed (existing file policies cover new fields)
  - OneDrive metadata is user-owned and protected by existing RLS
*/

-- Add OneDrive sync columns to files table
ALTER TABLE public.files 
  ADD COLUMN IF NOT EXISTS onedrive_id text,
  ADD COLUMN IF NOT EXISTS onedrive_sync_status text 
    CHECK (onedrive_sync_status IN ('not_synced', 'syncing', 'synced', 'conflict', 'error')) 
    DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS onedrive_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS onedrive_metadata jsonb DEFAULT '{}';

-- Create indexes for OneDrive sync operations
CREATE INDEX IF NOT EXISTS idx_files_onedrive_id ON public.files(onedrive_id) 
  WHERE onedrive_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_files_onedrive_sync_status ON public.files(onedrive_sync_status);

CREATE INDEX IF NOT EXISTS idx_files_owner_onedrive_status ON public.files(owner_id, onedrive_sync_status);

CREATE INDEX IF NOT EXISTS idx_files_onedrive_last_sync ON public.files(onedrive_last_sync_at DESC);

-- Helper function to mark files for sync
CREATE OR REPLACE FUNCTION public.mark_file_for_onedrive_sync(file_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.files
  SET onedrive_sync_status = 'not_synced',
      updated_at = now()
  WHERE id = file_id
    AND owner_id = auth.uid();
END;
$$;

-- Helper function to get files pending OneDrive sync for a user
CREATE OR REPLACE FUNCTION public.get_onedrive_pending_files(p_user_id uuid)
RETURNS TABLE (
  file_id uuid,
  filename text,
  storage_path text,
  byte_size bigint,
  mime_type text,
  sha256 text,
  onedrive_id text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id as file_id,
    f.filename,
    f.storage_path,
    f.byte_size,
    f.mime_type,
    f.sha256,
    f.onedrive_id,
    f.created_at,
    f.updated_at
  FROM public.files f
  WHERE f.owner_id = p_user_id
    AND f.onedrive_sync_status IN ('not_synced', 'error')
  ORDER BY f.created_at DESC
  LIMIT 100;
END;
$$;

-- Helper function to update OneDrive sync status
CREATE OR REPLACE FUNCTION public.update_onedrive_sync_status(
  p_file_id uuid,
  p_status text,
  p_onedrive_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.files
  SET 
    onedrive_sync_status = p_status,
    onedrive_last_sync_at = CASE 
      WHEN p_status = 'synced' THEN now()
      ELSE onedrive_last_sync_at
    END,
    onedrive_id = COALESCE(p_onedrive_id, onedrive_id),
    onedrive_metadata = CASE 
      WHEN p_metadata != '{}'::jsonb THEN p_metadata
      ELSE onedrive_metadata
    END,
    updated_at = now()
  WHERE id = p_file_id
    AND owner_id = auth.uid();
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.mark_file_for_onedrive_sync(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_onedrive_pending_files(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_onedrive_sync_status(uuid, text, text, jsonb) TO authenticated;

-- Comment on new columns for documentation
COMMENT ON COLUMN public.files.onedrive_id IS 'Microsoft OneDrive file ID for synced files';
COMMENT ON COLUMN public.files.onedrive_sync_status IS 'Sync status: not_synced, syncing, synced, conflict, error';
COMMENT ON COLUMN public.files.onedrive_last_sync_at IS 'Timestamp of last successful sync with OneDrive';
COMMENT ON COLUMN public.files.onedrive_metadata IS 'OneDrive-specific metadata including webUrl, parentReference, eTag, cTag, etc';
