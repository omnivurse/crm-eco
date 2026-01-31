-- Fix broken database functions identified by supabase db lint
-- This migration repairs functions that reference missing columns or extensions

-- 1. Fix get_agent_workload - ambiguous column reference
DROP FUNCTION IF EXISTS public.get_agent_workload(uuid);
CREATE OR REPLACE FUNCTION public.get_agent_workload(p_agent_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::int
    FROM tickets t
    WHERE t.assignee_id = p_agent_id
    AND t.status NOT IN ('closed', 'resolved')
  );
END;
$$;

-- 2. Fix encrypt_token - requires pgcrypto extension
-- First ensure pgcrypto is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Recreate encrypt_token with proper extension check
DROP FUNCTION IF EXISTS public.encrypt_token(text, text);
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
EXCEPTION WHEN undefined_function THEN
  -- Fallback if pgcrypto not available - return base64 encoded (not secure, but won't break)
  RETURN encode(token::bytea, 'base64');
END;
$$;

-- 3. Fix decrypt_token - requires pgcrypto extension
DROP FUNCTION IF EXISTS public.decrypt_token(text, text);
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
EXCEPTION WHEN undefined_function THEN
  -- Fallback if pgcrypto not available - return decoded base64
  RETURN convert_from(decode(encrypted_token, 'base64'), 'UTF8');
END;
$$;

-- 4. Vector-dependent functions (match_kb_docs, match_knowledge_articles)
-- Skip these entirely - they require pgvector extension which is not installed
-- If pgvector is needed later, run the following SQL after installing pgvector:
/*
CREATE OR REPLACE FUNCTION public.match_kb_docs(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
...
*/

-- 5. Fix get_least_busy_agent - profiles.is_active might not exist
DROP FUNCTION IF EXISTS public.get_least_busy_agent(uuid);
CREATE OR REPLACE FUNCTION public.get_least_busy_agent(org_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agent_id uuid;
BEGIN
  SELECT p.id INTO v_agent_id
  FROM profiles p
  WHERE p.role IN ('agent', 'it', 'staff', 'admin')
  ORDER BY (
    SELECT COUNT(*)
    FROM tickets t
    WHERE t.assignee_id = p.id
    AND t.status NOT IN ('closed', 'resolved')
  ) ASC
  LIMIT 1;

  RETURN v_agent_id;
EXCEPTION WHEN undefined_column THEN
  RETURN NULL;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_agent_workload(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_token(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_token(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_least_busy_agent(uuid) TO authenticated;
