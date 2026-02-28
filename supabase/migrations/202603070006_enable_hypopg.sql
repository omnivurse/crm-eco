-- Fix: extensions.index_advisor calls hypopg_reset() without schema qualification.
-- We can't ALTER the extension function (not owner), so create public shims
-- that forward to the real extensions.hypopg_* functions.

CREATE EXTENSION IF NOT EXISTS hypopg SCHEMA extensions;

-- Create shim so unqualified hypopg_reset() resolves from any search_path
CREATE OR REPLACE FUNCTION public.hypopg_reset()
RETURNS void
LANGUAGE sql
SET search_path = extensions, public
AS $$ SELECT extensions.hypopg_reset(); $$;
