-- LOCAL DEVELOPMENT SEED — never applied to production.
--
-- `supabase db push` pushes MIGRATIONS only; this file runs on
-- `supabase start` / `supabase db reset` against the local stack.
--
-- WHY THIS EXISTS
-- Most of this product's configuration migrations are scoped to the PIFH
-- tenant (org 00000000-0000-0000-0000-000000000001) and look their targets up
-- by (org_id, module key). A local database without that org does not fail
-- them — it SKIPS them. They report "module not found", exit 0, and prove
-- nothing. Two migrations reached production on the back of a rehearsal that
-- had silently matched zero rows, and one of them shipped a wrong label to
-- 907 live records.
--
-- Seeding a PIFH-SHAPED tenant makes those rehearsals real: a relabel
-- migration now finds rows locally, changes them, and can be re-run to prove
-- idempotence.
--
-- Everything here is SYNTHETIC. No customer names, no PHI, no production
-- values. Only the org id and the module/field KEYS mirror production,
-- because those are what the migrations match on.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- The tenant every PIFH-scoped migration targets
-- ---------------------------------------------------------------------------
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Pay It Forward Health (local seed)', 'pifh-local')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Core CRM modules. Ids are local-only; migrations resolve by (org_id, key).
-- ---------------------------------------------------------------------------
INSERT INTO public.crm_modules (id, org_id, key, name) VALUES
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000001', 'contacts', 'Contacts'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000000001', 'leads',    'Leads'),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-000000000001', 'members',  'Members')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- The crm_fields rows PIFH config migrations relabel or re-section.
-- Labels/sections are the PRE-migration values on purpose, so a rehearsal
-- exercises the real transition instead of matching zero rows.
-- ---------------------------------------------------------------------------
INSERT INTO public.crm_fields (org_id, module_id, key, label, type, section) VALUES
  -- contacts
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','product','Product','select','insurance'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','product_type','Product Type','select','main'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','health_insurance_plan_name','Plan name','text','health_insurance'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','monthly_contribution','Monthly Contribution','currency','health_sharing'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','monthly_premium','Monthly Contribution','number','insurance'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','normalized_advisor_name','Advisor','text','management'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','normalized_agent_name','Agent','text','management'),
  -- leads
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c002','product_type','Product Type','select','product'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c002','health_insurance_plan_name','Plan name','text','health_insurance'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c002','monthly_contribution','Monthly Contribution','currency','health_sharing'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c002','normalized_advisor_name','Advisor','text','management'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c002','normalized_agent_name','Agent','text','management'),
  -- members
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c003','health_insurance_plan_name','Plan name','text','health_insurance'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c003','monthly_contribution','Monthly Contribution','currency','health_sharing')
ON CONFLICT DO NOTHING;

-- The Family slots at their PRE-20260822120000 state (bare "Spouse"/"Child N"
-- labels, name → dob → ss → address → phone → email order), so the household
-- relabel/re-order migration exercises the real transition locally.
INSERT INTO public.crm_fields (org_id, module_id, key, label, type, section, display_order) VALUES
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','spouse','Spouse','text','family_spouse',32),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','spouse_dob','Spouse DOB','date','family_spouse',33),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','spouse_ss_number','Spouse SS Number','text','family_spouse',34),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','spouse_address','Spouse Address','text','family_spouse',35),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','spouse_phone_number','Spouse Phone Number','phone','family_spouse',36),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','spouse_email','Spouse Email','email','family_spouse',37),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','has_spouse','Has Spouse','boolean','family_spouse',937),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','has_kids','Has Children','boolean','family_children',938),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c002','spouse','Spouse','text','family',28),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c002','spouse_dob','Spouse DOB','date','family',29),
  -- leads carry the yes/no flags in core (as on prod), not in family
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c002','has_spouse','Has Spouse','boolean','core',12),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c002','has_kids','Has Kids','boolean','core',13)
ON CONFLICT DO NOTHING;

INSERT INTO public.crm_fields (org_id, module_id, key, label, type, section, display_order)
SELECT '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000c001',
       'child_' || i || sfx.key, 'Child ' || i || sfx.label, sfx.type, 'family_children', 38 + (i - 1) * 6 + sfx.off
  FROM generate_series(1, 5) i,
       (VALUES ('', '', 'text', 0), ('_dob', ' DOB', 'date', 1), ('_ss_number', ' SS Number', 'text', 2),
               ('_address', ' Address', 'text', 3), ('_phone_number', ' Phone Number', 'phone', 4),
               ('_email', ' Email', 'email', 5)) AS sfx(key, label, type, off)
ON CONFLICT DO NOTHING;

INSERT INTO public.crm_fields (org_id, module_id, key, label, type, section, display_order)
SELECT '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000c002',
       'child_' || i || sfx.key, 'Child ' || i || sfx.label, sfx.type, 'family', 30 + (i - 1) * 2 + sfx.off
  FROM generate_series(1, 5) i,
       (VALUES ('', '', 'text', 0), ('_dob', ' DOB', 'date', 1)) AS sfx(key, label, type, off)
ON CONFLICT DO NOTHING;

-- Status / pipeline / relationship picklists at their PRE-20260822150000
-- options (as on prod), so the vocabulary migration exercises the real rewrite.
INSERT INTO public.crm_fields (org_id, module_id, key, label, type, section, options) VALUES
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','contact_status','Contact Status','select','core','["Active","Inactive","Pending","Cancelled","Deceased","Terminated"]'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','lead_status','Lead Status','select','core','["New","Contacted","Qualified","Unqualified","Converted","Lost"]'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','relationship_type','Relationship','select','main','["Member","Advisor","Agency","DPC Provider","Provider","Employee"]'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c001','record_type','Record Type','select','management','["individual","group","unknown"]'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c002','contact_status','Contact Status','select','core','["New","Contacted","In Process","Qualified","Future Prospect","Pending","Converted","Unqualified","Lost"]'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c002','lead_status','Lead Status','select','core','["New","Contacted","In Process","Qualified","Future Prospect","Pending","Converted","Unqualified","Lost"]'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c002','relationship_type','Relationship','select','main','["Member","Advisor","Agency","DPC Provider","Provider","Employee"]'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c002','record_type','Record Type','select','management','["individual","group","unknown"]'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c003','contact_status','Contact Status','select','core','["Active","Inactive","Pending","Cancelled","Deceased","Terminated"]'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c003','lead_status','Lead Status','select','core','["New","Contacted","Qualified","Unqualified","Converted","Lost"]'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000c003','relationship_type','Relationship','select','main','["Member","Advisor","Agency","DPC Provider","Provider","Employee"]')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Advisor hierarchy root, required by 202606280001_pifh_org_agent_hierarchy.
-- Synthetic identity; the migration matches on the id.
-- ---------------------------------------------------------------------------
INSERT INTO public.advisors (id, organization_id, first_name, last_name, email, advisor_code)
VALUES ('dc91befa-0364-49cf-9cfa-b452f0f49a28', '00000000-0000-0000-0000-000000000001',
        'Local', 'Seed Root', 'local-seed-root@example.invalid', 'LOCAL-ROOT')
ON CONFLICT (id) DO NOTHING;
