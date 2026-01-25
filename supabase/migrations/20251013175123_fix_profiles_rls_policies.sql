/*
  # Fix Profiles RLS Policies

  1. Security Changes
    - Add SELECT policy for users to read their own profile
    - Add SELECT policy for authenticated users to read other profiles (needed for admin features)
    - Add UPDATE policy for users to update their own profile
    
  2. Notes
    - RLS is already enabled on profiles table
    - Currently there are NO policies which blocks all access
    - These policies restore proper access control
*/

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow authenticated users to read other profiles (for admin/team features)
CREATE POLICY "Authenticated users can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
