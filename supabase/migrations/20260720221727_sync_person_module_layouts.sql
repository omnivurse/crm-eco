-- Backfilled from the production migration ledger.
-- This migration was applied directly to production on 2026-07-20 22:17:27 UTC
-- (outside the repo) and was missing from version control. The SQL below is
-- reproduced verbatim from supabase_migrations.schema_migrations so that a
-- rebuild from migrations reproduces production. Already recorded as applied
-- in production -- it will not re-run there.

CREATE TABLE IF NOT EXISTS public.crm_layout_section_sync_backup_20260720 (
  layout_id uuid PRIMARY KEY REFERENCES public.crm_layouts(id) ON DELETE CASCADE,
  config_before jsonb NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crm_layout_section_sync_backup_20260720 IS
  'Backup from 202607200002_sync_person_module_layouts. Safe to DROP after verification.';

ALTER TABLE public.crm_layout_section_sync_backup_20260720 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_layout_section_sync_backup_20260720 FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_mod RECORD;
  v_layout_id uuid;
  v_org_id uuid;
  v_config jsonb;
  v_sections jsonb;
  v_existing text[];
  v_section text;
  v_label text;
  v_accent text;
  v_columns int;
  v_collapsed boolean;
  v_variant text;
  v_new_obj jsonb;
  v_order text[] := ARRAY[
    'core','main','personal','contact','notes_history','notes','start_date',
    'health_sharing','insurance','coverage','insurance_coverage','health_insurance',
    'dental_coverage','vision_coverage','other_coverage','life_coverage','product',
    'family_spouse','family_children','family','relationships','address','advisor',
    'management','payment','identifiers','portal','compliance','fulfillment',
    'business','preferences','additional','activity','commissions','conversion',
    'zoho_system','system'
  ];
  v_field_sections text[];
  v_sorted jsonb;
BEGIN
  FOR v_mod IN
    SELECT m.id AS module_id, m.key AS module_key, m.organization_id, m.org_id
    FROM public.crm_modules m
    WHERE m.is_enabled
      AND m.key IN ('contacts', 'leads', 'members')
  LOOP
    v_org_id := COALESCE(v_mod.organization_id, v_mod.org_id);
    v_layout_id := NULL;
    v_config := NULL;

    SELECT l.id, l.config
      INTO v_layout_id, v_config
    FROM public.crm_layouts l
    WHERE l.module_id = v_mod.module_id
      AND l.is_default = true
    ORDER BY l.updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_layout_id IS NULL THEN
      v_sections := '[]'::jsonb;

      SELECT COALESCE(array_agg(DISTINCT f.section), ARRAY[]::text[])
        INTO v_field_sections
      FROM public.crm_fields f
      WHERE f.module_id = v_mod.module_id
        AND f.section IS NOT NULL
        AND trim(f.section) <> '';

      FOREACH v_section IN ARRAY v_order LOOP
        IF v_section = ANY (v_field_sections) THEN
          v_label := initcap(replace(v_section, '_', ' '));
          IF v_section = 'core' THEN v_label := 'Name'; END IF;
          IF v_section = 'insurance' THEN v_label := 'Membership & Product'; END IF;
          IF v_section = 'health_sharing' THEN v_label := 'Health Share'; END IF;
          IF v_section = 'health_insurance' THEN v_label := 'Health Insurance (major medical)'; END IF;
          IF v_section = 'family_spouse' THEN v_label := 'Spouse'; END IF;
          IF v_section = 'family_children' THEN v_label := 'Children'; END IF;
          IF v_section = 'notes_history' THEN v_label := 'Notes History'; END IF;

          v_accent := 'slate';
          v_columns := 2;
          v_collapsed := true;
          v_variant := NULL;

          IF v_section = 'core' THEN
            v_accent := 'slate'; v_collapsed := false; v_variant := 'hero';
          ELSIF v_section IN ('health_sharing') THEN
            v_accent := 'emerald'; v_collapsed := false;
          ELSIF v_section IN ('health_insurance', 'insurance', 'coverage') THEN
            v_accent := 'sky'; v_collapsed := false;
          ELSIF v_section = 'notes_history' THEN
            v_accent := 'sky'; v_columns := 1;
          ELSIF v_section IN ('family', 'family_spouse', 'family_children') THEN
            v_accent := 'pink';
          ELSIF v_section = 'address' THEN
            v_accent := 'teal';
          END IF;

          v_new_obj := jsonb_build_object(
            'key', v_section,
            'label', v_label,
            'accent', v_accent,
            'columns', v_columns,
            'collapsed', v_collapsed
          );
          IF v_variant IS NOT NULL THEN
            v_new_obj := v_new_obj || jsonb_build_object('variant', v_variant);
          END IF;

          v_sections := v_sections || jsonb_build_array(v_new_obj);
        END IF;
      END LOOP;

      FOREACH v_section IN ARRAY v_field_sections LOOP
        IF NOT (v_section = ANY (v_order)) THEN
          v_sections := v_sections || jsonb_build_array(
            jsonb_build_object(
              'key', v_section,
              'label', initcap(replace(v_section, '_', ' ')),
              'accent', 'slate',
              'columns', 2,
              'collapsed', true
            )
          );
        END IF;
      END LOOP;

      INSERT INTO public.crm_layouts (org_id, organization_id, module_id, name, is_default, config)
      VALUES (
        v_org_id,
        v_org_id,
        v_mod.module_id,
        CASE v_mod.module_key
          WHEN 'members' THEN 'Default Member Layout'
          WHEN 'leads' THEN 'Default Lead Layout'
          ELSE 'Default Contact Layout'
        END,
        true,
        jsonb_build_object('sections', v_sections)
      )
      RETURNING id, config INTO v_layout_id, v_config;

      INSERT INTO public.crm_layout_section_sync_backup_20260720 (layout_id, config_before)
      VALUES (v_layout_id, jsonb_build_object('sections', '[]'::jsonb, '_created', true))
      ON CONFLICT (layout_id) DO NOTHING;

      CONTINUE;
    END IF;

    INSERT INTO public.crm_layout_section_sync_backup_20260720 (layout_id, config_before)
    VALUES (v_layout_id, v_config)
    ON CONFLICT (layout_id) DO NOTHING;

    v_sections := COALESCE(v_config->'sections', '[]'::jsonb);

    SELECT COALESCE(array_agg(s->>'key'), ARRAY[]::text[])
      INTO v_existing
    FROM jsonb_array_elements(v_sections) s;

    SELECT COALESCE(array_agg(DISTINCT f.section), ARRAY[]::text[])
      INTO v_field_sections
    FROM public.crm_fields f
    WHERE f.module_id = v_mod.module_id
      AND f.section IS NOT NULL
      AND trim(f.section) <> '';

    FOREACH v_section IN ARRAY v_field_sections LOOP
      IF v_section = ANY (v_existing) THEN
        CONTINUE;
      END IF;

      v_label := initcap(replace(v_section, '_', ' '));
      IF v_section = 'insurance' THEN v_label := 'Membership & Product'; END IF;
      IF v_section = 'family_spouse' THEN v_label := 'Spouse'; END IF;
      IF v_section = 'family_children' THEN v_label := 'Children'; END IF;
      IF v_section = 'main' THEN v_label := 'Main'; END IF;
      IF v_section = 'personal' THEN v_label := 'Personal'; END IF;
      IF v_section = 'relationships' THEN v_label := 'Relationships'; END IF;
      IF v_section = 'contact' THEN v_label := 'Contact'; END IF;
      IF v_section = 'system' THEN v_label := 'System'; END IF;
      IF v_section = 'conversion' THEN v_label := 'Conversion'; END IF;
      IF v_section = 'compliance' THEN v_label := 'Compliance'; END IF;
      IF v_section = 'advisor' THEN v_label := 'Advisor'; END IF;
      IF v_section = 'coverage' THEN v_label := 'Coverage'; END IF;

      v_accent := 'slate';
      v_columns := 2;
      IF v_section IN ('family', 'family_spouse', 'family_children') THEN v_accent := 'pink'; END IF;
      IF v_section = 'insurance' OR v_section = 'coverage' THEN v_accent := 'teal'; END IF;
      IF v_section = 'conversion' THEN v_accent := 'emerald'; END IF;
      IF v_section = 'personal' OR v_section = 'main' OR v_section = 'contact' THEN v_accent := 'blue'; END IF;

      v_sections := v_sections || jsonb_build_array(
        jsonb_build_object(
          'key', v_section,
          'label', v_label,
          'accent', v_accent,
          'columns', v_columns,
          'collapsed', true
        )
      );
      v_existing := array_append(v_existing, v_section);
    END LOOP;

    SELECT COALESCE(jsonb_agg(elem ORDER BY
      CASE
        WHEN array_position(v_order, elem->>'key') IS NULL THEN 1000 + ascii(left(elem->>'key', 1))
        ELSE array_position(v_order, elem->>'key')
      END,
      elem->>'key'
    ), '[]'::jsonb)
      INTO v_sorted
    FROM jsonb_array_elements(v_sections) elem;

    UPDATE public.crm_layouts
    SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{sections}', v_sorted),
        updated_at = now()
    WHERE id = v_layout_id;
  END LOOP;
END $$;
