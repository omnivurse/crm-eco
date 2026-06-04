-- Fix: remove explicit "i int" declarations that shadow FOR loop auto-variables

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
