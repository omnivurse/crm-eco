-- Fix fn_audit_security_changes so it works on tables WITHOUT an organization_id
-- column (crm_user_roles). The function already branched on crm_user_roles, but
-- plpgsql resolves NEW.organization_id / NEW.user_id against the record TYPE at
-- plan time, so the static field references failed to compile for tables that
-- lack them — every insert into crm_user_roles threw "record new has no field
-- organization_id", leaving the role-assignment junction unusable.
--
-- Fix: read those two fields dynamically via to_jsonb(NEW)->>'...', which yields
-- NULL for an absent field instead of failing to parse. Behavior-preserving for
-- crm_roles / crm_sso_config / crm_trusted_domains (which have organization_id);
-- unblocks crm_user_roles (org resolved from profiles via user_id, as intended).
-- Also more robust on DELETE (to_jsonb(NULL) -> NULL instead of erroring).
--
-- CREATE OR REPLACE = atomic body swap, reversible, modifies no data.
CREATE OR REPLACE FUNCTION public.fn_audit_security_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_actor_id uuid;
BEGIN
  v_org_id := COALESCE(
    CASE WHEN TG_TABLE_NAME = 'crm_user_roles' THEN
      (SELECT organization_id FROM profiles
       WHERE user_id = COALESCE((to_jsonb(NEW)->>'user_id')::uuid, (to_jsonb(OLD)->>'user_id')::uuid)
       LIMIT 1)
    ELSE COALESCE((to_jsonb(NEW)->>'organization_id')::uuid, (to_jsonb(OLD)->>'organization_id')::uuid)
    END,
    '00000000-0000-0000-0000-000000000000'::uuid
  );

  SELECT id INTO v_actor_id FROM profiles
    WHERE user_id = (SELECT auth.uid()) LIMIT 1;

  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    v_org_id, 'crm', v_actor_id,
    TG_TABLE_NAME || '.' || lower(TG_OP),
    'authorization',
    'high',
    jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP),
    CASE TG_OP
      WHEN 'INSERT' THEN jsonb_build_object('new', row_to_json(NEW)::jsonb)
      WHEN 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD)::jsonb, 'new', row_to_json(NEW)::jsonb)
      WHEN 'DELETE' THEN jsonb_build_object('old', row_to_json(OLD)::jsonb)
    END
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;
