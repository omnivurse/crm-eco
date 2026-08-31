-- ============================================================================
-- Partner + Referring Partner (PIFH) — configuration only, no record data
-- ----------------------------------------------------------------------------
-- The Relationship picker (crm_fields.relationship_type, section `main`) had a
-- word for members, advisors, agencies, clinical providers and employees, and
-- no word at all for the two kinds of partner PIFH actually works with:
--
--   Partner            an organization PIFH contracts WITH to deliver services
--                      to members — MEC, virtual care / telehealth, a DPC
--                      clinic, pharmacy, labs. They serve our members.
--   Referring Partner  a professional or organization in ANOTHER field who
--                      sends us business — an insurance agent in a different
--                      line, a financial advisor, a CPA, a trainer, a chamber
--                      or association. They send us members.
--
-- With no value for either, partners were typed into free text and lost:
-- `referring_member` holds 1,618 records across 1,035 distinct spellings,
-- `referral_source` 3,495 across 1,744. The names in there — Beverly Garretson
-- (54), Andrea Hinman (22), C4HCO (10), ASHI (9), NAWBO (7), WWSRA (7) — ARE
-- the partner list; it just has nowhere to live.
--
-- WHAT THIS DOES NOT DO. `Provider` (9 records) and `DPC Provider` (102) are
-- deliberately left alone. They are narrower, clinical, and already in use;
-- folding them into `Partner` would rewrite 111 production rows to buy a
-- tidier list. Every value instead gets a written definition on the field
-- tooltip so the distinction stops drifting — the same failure that produced
-- the contact_role / relationship_type collision fixed in 20260821180000.
--
-- `partner_industry` is the reporting dimension: it is what "which industries
-- generate the most referrals?" groups by. It ships with a curated seed list
-- the owner extends in Settings → Dropdown lists — no deploy needed, and
-- curated-away values are deactivated, never deleted (lib/crm/field-options).
--
-- Attribution (linking a referred record back to the partner that sent it) is
-- deliberately NOT here. It needs a lookup field plus a reviewed backfill of
-- those 1,035 free-text spellings, and that earns its own dry-run and ledger.
--
-- Idempotent: option lists are rewritten only when they differ, and the
-- previous list is preserved under metadata->'previous'. New fields use
-- ON CONFLICT DO NOTHING. Safe to re-run.
--
-- Rollback:
--   DELETE FROM public.crm_fields
--    WHERE key IN ('partner_industry','partner_services','partner_since')
--      AND metadata->>'source' = 'partner_taxonomy_20260830';
--   UPDATE public.crm_fields
--      SET options = metadata->'previous'->'partner_taxonomy_20260830'->'options',
--          tooltip = NULLIF(metadata->'previous'->'partner_taxonomy_20260830'->>'tooltip','')
--    WHERE key = 'relationship_type'
--      AND metadata->'previous' ? 'partner_taxonomy_20260830';
--   UPDATE public.crm_layouts l
--      SET config = jsonb_set(config, '{sections}',
--            (SELECT jsonb_agg(e) FROM jsonb_array_elements(config->'sections') e
--              WHERE e->>'key' <> 'partner'))
--     FROM public.crm_modules m
--    WHERE m.id = l.module_id AND m.key IN ('contacts','leads','members');
-- ============================================================================

SET lock_timeout = '5s';
SET statement_timeout = '120s';

DO $$
DECLARE
  v_org     constant uuid := '00000000-0000-0000-0000-000000000001';
  v_source  constant text := 'partner_taxonomy_20260830';

  -- Partner / Referring Partner sit next to Agency: the business-relationship
  -- band. Provider / DPC Provider keep their existing meaning and position.
  v_rel constant jsonb := '[
    "Member","Advisor","Agency","Partner","Referring Partner",
    "DPC Provider","Provider","Employee","Personal"
  ]'::jsonb;

  v_rel_tip constant text :=
    'Partner = delivers services to PIFH members (MEC, virtual care, DPC). '
    'Referring Partner = sends us referrals from another field (insurance, financial, fitness).';

  -- Curated seed. The owner adds to this in Settings -> Dropdown lists; the
  -- list only has to be good enough to start tagging today.
  v_industry constant jsonb := '[
    "Insurance - Property & Casualty",
    "Insurance - Life & Annuity",
    "Insurance - Medicare",
    "Insurance - Group Benefits",
    "Financial Advisor / Wealth Management",
    "CPA / Accounting / Bookkeeping",
    "Attorney / Legal",
    "Mortgage / Lending",
    "Real Estate",
    "Payroll / HR / PEO",
    "Business Consultant / Coach",
    "Health & Fitness / Personal Training",
    "Chiropractic",
    "Nutrition / Wellness",
    "Behavioral Health",
    "Direct Primary Care / Clinic",
    "Telehealth / Virtual Care",
    "Dental",
    "Vision",
    "Pharmacy / Rx",
    "Labs & Imaging",
    "Association / Chamber of Commerce",
    "Faith Community / Ministry",
    "Nonprofit",
    "Employer / Business Owner",
    "Technology / Software",
    "Marketing / Media",
    "Other"
  ]'::jsonb;

  v_services constant jsonb := '[
    "MEC / Minimum Essential Coverage",
    "Virtual Care / Telehealth",
    "Direct Primary Care",
    "Concierge / Member Advocacy",
    "Pharmacy / Rx",
    "Dental",
    "Vision",
    "Labs & Imaging",
    "Behavioral Health",
    "Wellness / Fitness",
    "Benefits Administration / TPA",
    "Other"
  ]'::jsonb;

  v_partner_section constant jsonb := jsonb_build_object(
    'key', 'partner',
    'label', 'Partner Details',
    'columns', 2,
    'accent', 'indigo'
  );

  v_mod      record;
  v_layout   record;
  v_sections jsonb;
  v_n        int;
  v_modules  int := 0;
  v_opts     int := 0;
  v_added    int := 0;
  v_layouts  int := 0;
BEGIN
  -- Fresh-database guard (pattern of commit 7c60dec8). This is a PIFH prod
  -- configuration change: on a bare database (supabase start, the CI walk
  -- runner) the org does not exist and there is nothing to configure.
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org) THEN
    RAISE NOTICE '20260830120000_partner_relationship_types_and_industry: org % not present (fresh database) — skipped', v_org;
    RETURN;
  END IF;

  -- ------------------------------------------------------------------------
  -- 0. Refuse to collide. If partner_* keys already exist meaning something
  --    else, stop — that is exactly how contact_role acquired two meanings.
  -- ------------------------------------------------------------------------
  SELECT count(*) INTO v_n
    FROM public.crm_fields f
    JOIN public.crm_modules m ON m.id = f.module_id
   WHERE m.org_id = v_org
     AND m.key IN ('contacts', 'leads', 'members')
     AND f.key IN ('partner_industry', 'partner_services', 'partner_since')
     AND COALESCE(f.metadata->>'source', '') <> v_source;
  IF v_n > 0 THEN
    RAISE EXCEPTION
      'partner_industry / partner_services / partner_since already defined with another meaning (% rows) — inspect before proceeding', v_n;
  END IF;

  FOR v_mod IN
    SELECT id, key FROM public.crm_modules
     WHERE org_id = v_org AND key IN ('contacts', 'leads', 'members')
     ORDER BY key
  LOOP
    v_modules := v_modules + 1;

    -- ----------------------------------------------------------------------
    -- 1. Relationship gains Partner + Referring Partner, and a definition.
    --    Rewritten only when it actually differs; the previous list and
    --    tooltip are kept under metadata->'previous' for the rollback above.
    -- ----------------------------------------------------------------------
    UPDATE public.crm_fields f
       SET options  = v_rel,
           tooltip  = v_rel_tip,
           metadata = COALESCE(f.metadata, '{}'::jsonb)
                      || jsonb_build_object('previous',
                           COALESCE(f.metadata->'previous', '{}'::jsonb)
                           || jsonb_build_object(v_source, jsonb_build_object(
                                'options', f.options,
                                'tooltip', COALESCE(f.tooltip, ''))))
     WHERE f.module_id = v_mod.id
       AND f.key = 'relationship_type'
       AND (f.options IS DISTINCT FROM v_rel OR f.tooltip IS DISTINCT FROM v_rel_tip);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_opts := v_opts + v_n;

    -- ----------------------------------------------------------------------
    -- 2. The partner section. The app hides it on any record that is not
    --    tagged Partner / Referring Partner and holds no partner data
    --    (lib/crm/partner-fields.ts), so defining these on all three person
    --    modules costs the other ~99% of records nothing.
    -- ----------------------------------------------------------------------
    --    `organization_id` is set EXPLICITLY, not left to trg_sync_org_tenant_key:
    --    both crm_fields RLS policies ("CRM members can view fields",
    --    "CRM admins can manage fields") read organization_id, so a NULL there
    --    would define the fields and then hide them from every non-service-role
    --    caller. The trigger does mirror org_id today; this does not depend on it.
    INSERT INTO public.crm_fields
      (org_id, organization_id, module_id, key, label, type, options, validation,
       section, display_order, width, required, tooltip, metadata)
    VALUES
      (v_org, v_org, v_mod.id, 'partner_industry', 'Partner Industry', 'select',
       v_industry, '{}'::jsonb, 'partner', 10, 'half', false,
       'The industry this partner works in. Referral reports group by this.',
       jsonb_build_object('source', v_source)),

      (v_org, v_org, v_mod.id, 'partner_services', 'Services Provided', 'multiselect',
       v_services, '{}'::jsonb, 'partner', 20, 'half', false,
       'What a PIFH service partner delivers to members. Leave blank for a referring partner.',
       jsonb_build_object('source', v_source)),

      (v_org, v_org, v_mod.id, 'partner_since', 'Partner Since', 'date',
       '[]'::jsonb, '{}'::jsonb, 'partner', 30, 'half', false,
       'When the partner relationship started.',
       jsonb_build_object('source', v_source))
    ON CONFLICT (module_id, key) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_added := v_added + v_n;
  END LOOP;

  IF v_modules = 0 THEN
    -- The org EXISTS but its person modules do not: real drift on a populated
    -- database, and still worth a hard stop (cf 7c60dec8).
    RAISE EXCEPTION 'No contacts/leads/members module for org % — refusing to no-op silently', v_org;
  END IF;

  -- ------------------------------------------------------------------------
  -- 3. Put Partner Details directly under Main in every layout that has a
  --    Main band. Layouts without one (the legacy non-default "Default
  --    Layout" rows) are skipped — the app appends unknown field sections on
  --    its own, so nothing is lost there.
  -- ------------------------------------------------------------------------
  FOR v_layout IN
    SELECT l.id, l.config
      FROM public.crm_layouts l
      JOIN public.crm_modules m ON m.id = l.module_id
     WHERE l.org_id = v_org
       AND m.key IN ('contacts', 'leads', 'members')
       AND jsonb_typeof(l.config->'sections') = 'array'
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(l.config->'sections') e WHERE e->>'key' = 'main')
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(l.config->'sections') e WHERE e->>'key' = 'partner')
  LOOP
    SELECT jsonb_agg(elem ORDER BY ord) INTO v_sections
      FROM (
        SELECT e.elem AS elem, e.ord::numeric AS ord
          FROM jsonb_array_elements(v_layout.config->'sections') WITH ORDINALITY AS e(elem, ord)
        UNION ALL
        SELECT v_partner_section AS elem, first_main.ord::numeric + 0.5 AS ord
          FROM (
            SELECT e.ord
              FROM jsonb_array_elements(v_layout.config->'sections') WITH ORDINALITY AS e(elem, ord)
             WHERE e.elem->>'key' = 'main'
             ORDER BY e.ord
             LIMIT 1
          ) first_main
      ) merged;

    UPDATE public.crm_layouts
       SET config = jsonb_set(config, '{sections}', v_sections)
     WHERE id = v_layout.id;
    v_layouts := v_layouts + 1;
  END LOOP;

  RAISE NOTICE 'partner taxonomy: % module(s), % relationship picklist(s) rewritten, % field definition(s) added, % layout(s) updated',
    v_modules, v_opts, v_added, v_layouts;
END $$;

-- ============================================================================
-- Verify (read-only — run after applying):
--
--   -- 1. Both new values are offered on all three person modules.
--   SELECT m.key AS module, f.options
--     FROM public.crm_fields f JOIN public.crm_modules m ON m.id = f.module_id
--    WHERE f.key = 'relationship_type' AND m.key IN ('contacts','leads','members');
--
--   -- 2. The three partner fields exist, and RLS can see them
--   --    (organization_id must NOT be null — see the INSERT comment).
--   SELECT m.key AS module, f.key, f.type, f.section, f.organization_id
--     FROM public.crm_fields f JOIN public.crm_modules m ON m.id = f.module_id
--    WHERE f.metadata->>'source' = 'partner_taxonomy_20260830'
--    ORDER BY m.key, f.display_order;
--   -- expect 9 rows (3 modules x 3 fields), organization_id non-null on all.
--
--   -- 3. Partner Details sits directly after Main in each default layout.
--   SELECT m.key AS module, l.name,
--          (SELECT string_agg(e->>'key', ' > ' ORDER BY o)
--             FROM jsonb_array_elements(l.config->'sections') WITH ORDINALITY t(e, o)) AS section_order
--     FROM public.crm_layouts l JOIN public.crm_modules m ON m.id = l.module_id
--    WHERE m.key IN ('contacts','leads','members') AND l.is_default;
--
--   -- 4. Nothing was reclassified: Provider / DPC Provider counts unchanged
--   --    (expect Provider 9, DPC Provider 102, Advisor 426, Personal 84,
--   --     Agency 35, Member 3, Employee 3 as of 2026-08-30).
--   SELECT data->>'relationship_type' AS relationship, count(*)
--     FROM public.crm_records
--    WHERE org_id = '00000000-0000-0000-0000-000000000001' AND deleted_at IS NULL
--    GROUP BY 1 ORDER BY 2 DESC;
--
--   -- 5. The report this unlocks: partners by industry.
--   SELECT data->>'partner_industry' AS industry, count(*)
--     FROM public.crm_records
--    WHERE org_id = '00000000-0000-0000-0000-000000000001' AND deleted_at IS NULL
--      AND data->>'relationship_type' IN ('Partner','Referring Partner')
--    GROUP BY 1 ORDER BY 2 DESC;
-- ============================================================================
