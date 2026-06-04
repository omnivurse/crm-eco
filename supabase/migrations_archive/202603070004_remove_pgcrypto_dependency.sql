-- =============================================================================
-- Remove pgcrypto dependency from all functions.
-- pgcrypto extension is not installed; gen_random_bytes/pgp_sym_encrypt/decrypt
-- are unavailable. Use gen_random_uuid() (core PG13+) for token generation
-- and base64 encoding for token encryption (reversible obfuscation).
-- =============================================================================

-- 1. generate_webhook_secret: 64-char hex from 2 UUIDs (256 bits of randomness)
CREATE OR REPLACE FUNCTION public.generate_webhook_secret()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', '');
END;
$$;

-- 2. generate_invitation_token: same approach
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'generate_invitation_token'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_invitation_token()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', '');
END;
$$;

-- 3. encrypt_token: XOR-based obfuscation with secret, base64 encoded
--    (pgp_sym_encrypt is unavailable; this provides reversible obfuscation)
CREATE OR REPLACE FUNCTION public.encrypt_token(token text, secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_bytes bytea;
  v_key_bytes bytea;
  v_result bytea;
  i int;
BEGIN
  v_token_bytes := convert_to(token, 'UTF8');
  v_key_bytes := decode(md5(secret), 'hex');
  v_result := v_token_bytes;
  FOR i IN 0..octet_length(v_token_bytes) - 1 LOOP
    v_result := set_byte(v_result, i,
      get_byte(v_token_bytes, i) # get_byte(v_key_bytes, i % octet_length(v_key_bytes))
    );
  END LOOP;
  RETURN encode(v_result, 'base64');
END;
$$;

-- 4. decrypt_token: reverse the XOR obfuscation
CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token text, secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted bytea;
  v_key_bytes bytea;
  v_result bytea;
  i int;
BEGIN
  v_encrypted := decode(encrypted_token, 'base64');
  v_key_bytes := decode(md5(secret), 'hex');
  v_result := v_encrypted;
  FOR i IN 0..octet_length(v_encrypted) - 1 LOOP
    v_result := set_byte(v_result, i,
      get_byte(v_encrypted, i) # get_byte(v_key_bytes, i % octet_length(v_key_bytes))
    );
  END LOOP;
  RETURN convert_from(v_result, 'UTF8');
END;
$$;
