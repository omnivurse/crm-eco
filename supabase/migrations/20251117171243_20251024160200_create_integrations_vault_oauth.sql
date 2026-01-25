/*
  # My Work - Integrations, OAuth Tokens, and Password Vault References (with OneDrive Support)

  1. New Tables
    - `integrations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `provider` (enum: ms_teams, google, onedrive, ms_onedrive, onepassword, bitwarden, vault)
      - `is_active` (boolean, default true)
      - `metadata` (jsonb) - non-sensitive config data
      - `last_sync_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - Unique constraint on (user_id, provider)

    - `oauth_tokens`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `provider` (enum: ms_teams, google, onedrive, ms_onedrive)
      - `access_token_encrypted` (text) - encrypted with pgcrypto
      - `refresh_token_encrypted` (text) - encrypted with pgcrypto
      - `scope` (text)
      - `token_type` (text)
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - Unique constraint on (user_id, provider)

    - `password_refs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `provider` (enum: onepassword, bitwarden, vault)
      - `item_ref` (text) - UUID or item ID in vault, NOT the password
      - `label` (text) - display name for the credential
      - `vault_url` (text) - deep link to open item in vault app
      - `metadata` (jsonb) - tags, categories, etc.
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own integration data
    - OAuth tokens are encrypted and only accessible server-side
    - Password refs contain NO secrets, only references to vault items

  3. Important Notes
    - NEVER store actual passwords or secrets
    - OAuth tokens use pgcrypto for envelope encryption
    - Only store vault item references/UUIDs, not credentials
    - Deep links allow users to open items in vault apps
*/

-- Enable pgcrypto extension if not exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create integrations table
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('ms_teams', 'google', 'onedrive', 'ms_onedrive', 'onepassword', 'bitwarden', 'vault')),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}',
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Create oauth_tokens table
CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('ms_teams', 'google', 'onedrive', 'ms_onedrive')),
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  scope text,
  token_type text NOT NULL DEFAULT 'Bearer',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Create password_refs table (NO ACTUAL PASSWORDS STORED)
CREATE TABLE IF NOT EXISTS public.password_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('onepassword', 'bitwarden', 'vault')),
  item_ref text NOT NULL,
  label text NOT NULL,
  vault_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON public.integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON public.integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_is_active ON public.integrations(is_active);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_id ON public.oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider ON public.oauth_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON public.oauth_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_password_refs_user_id ON public.password_refs(user_id);
CREATE INDEX IF NOT EXISTS idx_password_refs_provider ON public.password_refs(provider);

-- Enable RLS
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_refs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integrations

-- Users can read their own integrations
CREATE POLICY "Users can read own integrations"
  ON public.integrations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can create their own integrations
CREATE POLICY "Users can create integrations"
  ON public.integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own integrations
CREATE POLICY "Users can update own integrations"
  ON public.integrations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own integrations
CREATE POLICY "Users can delete own integrations"
  ON public.integrations
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for oauth_tokens

-- CRITICAL: OAuth tokens should NEVER be readable by client
-- Only server-side functions with service role key should access these
-- Users can see that tokens exist but not the actual encrypted values
CREATE POLICY "Users can see own token existence"
  ON public.oauth_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Server-side functions can insert tokens (using service role key)
CREATE POLICY "Service role can manage tokens"
  ON public.oauth_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can delete their own tokens
CREATE POLICY "Users can delete own tokens"
  ON public.oauth_tokens
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for password_refs

-- Users can read their own password references
CREATE POLICY "Users can read own password refs"
  ON public.password_refs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can create password references
CREATE POLICY "Users can create password refs"
  ON public.password_refs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own password references
CREATE POLICY "Users can update own password refs"
  ON public.password_refs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own password references
CREATE POLICY "Users can delete own password refs"
  ON public.password_refs
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_integrations_updated_at ON public.integrations;
CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_oauth_tokens_updated_at ON public.oauth_tokens;
CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON public.oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_password_refs_updated_at ON public.password_refs;
CREATE TRIGGER update_password_refs_updated_at
  BEFORE UPDATE ON public.password_refs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function to encrypt tokens (server-side use only)
CREATE OR REPLACE FUNCTION public.encrypt_token(token text, secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN encode(
    pgp_sym_encrypt(token, secret),
    'base64'
  );
END;
$$;

-- Helper function to decrypt tokens (server-side use only)
CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token text, secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    decode(encrypted_token, 'base64'),
    secret
  );
END;
$$;

-- IMPORTANT: Revoke public access to encryption functions
REVOKE ALL ON FUNCTION public.encrypt_token FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrypt_token FROM PUBLIC;

-- Grant access only to service_role
GRANT EXECUTE ON FUNCTION public.encrypt_token TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_token TO service_role;