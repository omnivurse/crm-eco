-- =============================================================================
-- OPTIONAL hardening: auto-attach the tenant-key invariant to any FUTURE table
-- that is created with BOTH org_id and organization_id columns.
--
-- Rationale: 202607300005/006 cover every table that exists today. This event
-- trigger stops the dual-column drift pattern from ever silently reappearing in
-- a new table -- a future migration cannot forget the sync trigger + CHECK.
--
-- It only ADDS the standard invariant (never removes anything) and swallows its
-- own errors so it can never block a legitimate CREATE TABLE. It targets only
-- ordinary tables in schema public that carry both columns.
--
-- Compatible with the eventual org_id drop: once a table no longer has both
-- columns, this trigger is a no-op for it.
--
-- Reversible. PROD WRITE RISK: YES (adds an event trigger + function; no data).
-- Apply this ONLY if you want the standing guarantee; the audit script
-- scripts/db-audit-tenant-key-drift.sql already DETECTS any new gap without it.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_tenant_key_invariant_on_new_tables()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  obj   record;
  tname text;
  cname text;
BEGIN
  FOR obj IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS')
  LOOP
    -- Only ordinary tables in public that carry BOTH tenant columns.
    IF EXISTS (
      SELECT 1
      FROM   pg_class c
      JOIN   pg_namespace n ON n.oid = c.relnamespace
      WHERE  c.oid = obj.objid
        AND  c.relkind = 'r'
        AND  n.nspname = 'public'
        AND  EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='org_id'          AND NOT a.attisdropped)
        AND  EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='organization_id' AND NOT a.attisdropped)
    ) THEN
      tname := split_part(obj.object_identity, '.', 2);
      cname := left(tname, 41) || '_org_tenant_key_match';

      BEGIN
        EXECUTE format('DROP TRIGGER IF EXISTS trg_sync_org_tenant_key ON %s', obj.object_identity);
        EXECUTE format(
          'CREATE TRIGGER trg_sync_org_tenant_key BEFORE INSERT OR UPDATE ON %s '
          || 'FOR EACH ROW EXECUTE FUNCTION public.sync_org_tenant_key()', obj.object_identity);

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = obj.objid AND conname = cname) THEN
          EXECUTE format(
            'ALTER TABLE %s ADD CONSTRAINT %I CHECK (org_id IS NOT DISTINCT FROM organization_id) NOT VALID',
            obj.object_identity, cname);
        END IF;

        RAISE NOTICE 'tenant-key invariant auto-attached to new table %', obj.object_identity;
      EXCEPTION WHEN OTHERS THEN
        -- Never block the DDL; the standing audit will surface anything missed.
        RAISE WARNING 'tenant-key auto-attach skipped for % (%)', obj.object_identity, SQLERRM;
      END;
    END IF;
  END LOOP;
END;
$function$;

DROP EVENT TRIGGER IF EXISTS trg_enforce_tenant_key_invariant;
CREATE EVENT TRIGGER trg_enforce_tenant_key_invariant
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS')
  EXECUTE FUNCTION public.enforce_tenant_key_invariant_on_new_tables();

-- Rollback:
--   DROP EVENT TRIGGER IF EXISTS trg_enforce_tenant_key_invariant;
--   DROP FUNCTION  IF EXISTS public.enforce_tenant_key_invariant_on_new_tables();
