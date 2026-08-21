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

-- ---------------------------------------------------------------------------
-- Advisor hierarchy root, required by 202606280001_pifh_org_agent_hierarchy.
-- Synthetic identity; the migration matches on the id.
-- ---------------------------------------------------------------------------
INSERT INTO public.advisors (id, organization_id, first_name, last_name, email, advisor_code)
VALUES ('dc91befa-0364-49cf-9cfa-b452f0f49a28', '00000000-0000-0000-0000-000000000001',
        'Local', 'Seed Root', 'local-seed-root@example.invalid', 'LOCAL-ROOT')
ON CONFLICT (id) DO NOTHING;
