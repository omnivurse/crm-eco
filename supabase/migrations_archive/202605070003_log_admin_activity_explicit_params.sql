-- Update log_admin_activity to accept explicit org / actor params.
--
-- The function (202601240001) was defined with 5 params:
--   (p_entity_type, p_entity_id, p_action, p_description, p_metadata)
-- and derived org/actor from `profiles` via auth.uid(). But every API caller
-- in apps/admin passes `p_organization_id` + `p_actor_profile_id` as named
-- args — PostgREST rejects unknown named args, so those RPC calls have
-- been silently failing (the caller's try/catch swallowed the error and
-- the audit log row was never written).
--
-- Fix: accept explicit org_id + actor_profile_id; fall back to auth.uid()
-- when omitted so older / hypothetical callers still work.

CREATE OR REPLACE FUNCTION public.log_admin_activity(
  p_entity_type      text,
  p_entity_id        uuid,
  p_action           text,
  p_description      text DEFAULT NULL,
  p_metadata         jsonb DEFAULT '{}'::jsonb,
  p_organization_id  uuid DEFAULT NULL,
  p_actor_profile_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_id uuid;
  v_org_id      uuid := p_organization_id;
  v_profile_id  uuid := p_actor_profile_id;
BEGIN
  -- Fallback path: look up org + profile from the calling user's session
  -- when explicit values weren't supplied.
  IF v_org_id IS NULL OR v_profile_id IS NULL THEN
    SELECT organization_id, id
      INTO v_org_id, v_profile_id
      FROM public.profiles
     WHERE user_id = auth.uid()
     LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    -- Nothing to log against — silent return preserves old behaviour.
    RETURN NULL;
  END IF;

  INSERT INTO public.admin_activity_log (
    organization_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    description,
    metadata
  ) VALUES (
    v_org_id,
    v_profile_id,
    p_entity_type,
    p_entity_id,
    p_action,
    p_description,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_activity(text, uuid, text, text, jsonb, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_activity(text, uuid, text, text, jsonb, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.log_admin_activity(text, uuid, text, text, jsonb, uuid, uuid) IS
  'Inserts a row into admin_activity_log. p_organization_id + p_actor_profile_id '
  'should be passed explicitly when the caller already knows them (every admin '
  'API route does); they fall back to a lookup by auth.uid() when omitted.';

NOTIFY pgrst, 'reload schema';
