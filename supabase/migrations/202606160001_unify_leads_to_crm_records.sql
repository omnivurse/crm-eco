-- Unify legacy public.leads into crm_records (module key: leads).
-- Production verified 0 rows in public.leads; all lead data lives in crm_records.
-- Repoint lead_id FKs so activities / enrollments / landing events reference crm_records.

SET lock_timeout = '5s';

-- advisor_contact_summary still JOINed public.leads — repoint to crm_records (leads module)
CREATE OR REPLACE VIEW public.advisor_contact_summary AS
SELECT
  a.organization_id,
  a.id AS advisor_id,
  a.full_name,
  a.email,
  a.state,
  a.is_active AS advisor_active,
  COUNT(DISTINCT l.id) AS total_leads,
  COUNT(DISTINCT m.id) AS total_members,
  COUNT(DISTINCT l.id) + COUNT(DISTINCT m.id) AS total_contacts,
  MAX(GREATEST(
    COALESCE(l.created_at, '1900-01-01'::timestamptz),
    COALESCE(m.created_at, '1900-01-01'::timestamptz)
  )) AS last_contact_at
FROM public.advisors a
LEFT JOIN public.crm_records l
  ON l.advisor_id = a.id
 AND l.org_id = a.organization_id
 AND EXISTS (
   SELECT 1
   FROM public.crm_modules cm
   WHERE cm.id = l.module_id
     AND cm.org_id = a.organization_id
     AND cm.key = 'leads'
     AND cm.is_enabled = true
 )
LEFT JOIN public.members m ON m.advisor_id = a.id
GROUP BY a.organization_id, a.id, a.full_name, a.email, a.state, a.is_active;

COMMENT ON VIEW public.advisor_contact_summary IS
  'Per-advisor aggregate of crm_records (leads module) + members. Legacy public.leads removed.';

-- activities.lead_id → crm_records
ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS activities_lead_id_fkey;

ALTER TABLE public.activities
  ADD CONSTRAINT activities_lead_id_fkey
  FOREIGN KEY (lead_id)
  REFERENCES public.crm_records(id)
  ON DELETE SET NULL;

-- enrollments.lead_id → crm_records
ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS enrollments_lead_id_fkey;

ALTER TABLE public.enrollments
  ADD CONSTRAINT enrollments_lead_id_fkey
  FOREIGN KEY (lead_id)
  REFERENCES public.crm_records(id)
  ON DELETE SET NULL;

-- landing_page_events.lead_id → crm_records
ALTER TABLE public.landing_page_events
  DROP CONSTRAINT IF EXISTS landing_page_events_lead_id_fkey;

ALTER TABLE public.landing_page_events
  ADD CONSTRAINT landing_page_events_lead_id_fkey
  FOREIGN KEY (lead_id)
  REFERENCES public.crm_records(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.activities.lead_id IS
  'Optional FK to crm_records.id (leads module). Legacy public.leads removed.';

COMMENT ON COLUMN public.enrollments.lead_id IS
  'Optional FK to crm_records.id (leads module). Legacy public.leads removed.';

COMMENT ON COLUMN public.landing_page_events.lead_id IS
  'Optional FK to crm_records.id (leads module). Legacy public.leads removed.';

-- Drop empty legacy table (policies and indexes cascade with table)
DROP TABLE IF EXISTS public.leads;
