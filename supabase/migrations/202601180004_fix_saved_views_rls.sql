-- Fix saved_views RLS policies to use the correct profile lookup
-- The previous policies incorrectly compared owner_profile_id to auth.uid()
-- but auth.uid() returns the auth user ID, not the profile ID.

-- Drop existing policies
DROP POLICY IF EXISTS "saved_views_select_own" ON public.saved_views;
DROP POLICY IF EXISTS "saved_views_insert_own" ON public.saved_views;
DROP POLICY IF EXISTS "saved_views_update_own" ON public.saved_views;
DROP POLICY IF EXISTS "saved_views_delete_own" ON public.saved_views;

-- Recreate with correct policy using profile lookup
-- Select: owner only (via profile lookup)
CREATE POLICY "saved_views_select_own" ON public.saved_views
  FOR SELECT
  USING (
    owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Insert: owner can insert their own
CREATE POLICY "saved_views_insert_own" ON public.saved_views
  FOR INSERT
  WITH CHECK (
    owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Update: owner can update their own
CREATE POLICY "saved_views_update_own" ON public.saved_views
  FOR UPDATE
  USING (
    owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Delete: owner can delete their own
CREATE POLICY "saved_views_delete_own" ON public.saved_views
  FOR DELETE
  USING (
    owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );
