-- ============================================================================
-- Partner Type label — configuration only, no record data
-- ----------------------------------------------------------------------------
-- The person-module picklist `relationship_type` and the layout card
-- `relationships` were both still labelled Relationship / Relationships.
-- The business name for that picker is Partner Type (Member, Advisor, Partner,
-- Referring Partner, …). Keys stay the same so JSONB data and filters do not
-- move.
--
-- Idempotent: only rewrites the legacy labels. Safe to re-run.
--
-- Rollback:
--   UPDATE public.crm_fields SET label = 'Relationship', updated_at = now()
--    WHERE key = 'relationship_type' AND label = 'Partner Type';
--   UPDATE public.crm_layouts l
--      SET config = jsonb_set(config, '{sections}', (
--            SELECT jsonb_agg(
--              CASE WHEN e->>'key' = 'relationships' AND e->>'label' = 'Partner Type'
--                   THEN e || '{"label":"Relationships"}'::jsonb
--                   ELSE e END)
--              FROM jsonb_array_elements(config->'sections') e
--          )),
--          updated_at = now()
--    WHERE EXISTS (
--      SELECT 1 FROM jsonb_array_elements(l.config->'sections') e
--       WHERE e->>'key' = 'relationships' AND e->>'label' = 'Partner Type'
--    );
-- ============================================================================

SET lock_timeout = '5s';
SET statement_timeout = '60s';

DO $$
DECLARE
  v_fields  int;
  v_layouts int;
BEGIN
  UPDATE public.crm_fields
     SET label = 'Partner Type',
         updated_at = now()
   WHERE key = 'relationship_type'
     AND label IN ('Relationship', 'Relationships');
  GET DIAGNOSTICS v_fields = ROW_COUNT;

  UPDATE public.crm_layouts l
     SET config = jsonb_set(config, '{sections}', (
           SELECT jsonb_agg(
             CASE
               WHEN e->>'key' = 'relationships'
                AND e->>'label' IN ('Relationships', 'Relationship')
               THEN e || '{"label":"Partner Type"}'::jsonb
               ELSE e
             END
           )
           FROM jsonb_array_elements(COALESCE(l.config->'sections', '[]'::jsonb)) e
         )),
         updated_at = now()
   WHERE EXISTS (
     SELECT 1
       FROM jsonb_array_elements(COALESCE(l.config->'sections', '[]'::jsonb)) e
      WHERE e->>'key' = 'relationships'
        AND e->>'label' IN ('Relationships', 'Relationship')
   );
  GET DIAGNOSTICS v_layouts = ROW_COUNT;

  RAISE NOTICE 'partner_type_label: % field(s), % layout(s)', v_fields, v_layouts;
END $$;
