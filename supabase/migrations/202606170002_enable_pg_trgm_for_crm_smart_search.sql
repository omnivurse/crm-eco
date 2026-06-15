-- Enable pg_trgm search_path for crm_smart_search fuzzy matching (similarity()).
-- pg_trgm was already installed in extensions schema on PIF prod, but
-- crm_smart_search had search_path=public only → similarity() not found.
-- Rollback: ALTER FUNCTION public.crm_smart_search(uuid, text, text, integer, real)
--           SET search_path = public;

SET lock_timeout = '4s';

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

ALTER FUNCTION public.crm_smart_search(uuid, text, text, integer, real)
  SET search_path = public, extensions;
