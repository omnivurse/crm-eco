-- Backfill indexed start dates for pending contacts/members whose Start Date
-- lives only in JSONB (`data.start_date`). The daily activate-pending-members
-- cron reads `original_start_date` / `current_year_start_date` first; without
-- this backfill, records like a converted lead set to Pending with a future
-- start date would never auto-activate.

UPDATE public.crm_records cr
   SET original_start_date = COALESCE(
         cr.original_start_date,
         public._parse_import_date(cr.data->>'start_date'),
         public._parse_import_date(cr.data->>'sharing_effective_date'),
         public._parse_import_date(cr.data->>'insurance_effective_date'),
         public._parse_import_date(cr.data->>'health_insurance_start_date')
       ),
       current_year_start_date = COALESCE(
         cr.current_year_start_date,
         cr.original_start_date,
         public._parse_import_date(cr.data->>'start_date'),
         public._parse_import_date(cr.data->>'sharing_effective_date'),
         public._parse_import_date(cr.data->>'insurance_effective_date'),
         public._parse_import_date(cr.data->>'health_insurance_start_date')
       ),
       updated_at = now()
  FROM public.crm_modules m
 WHERE m.id = cr.module_id
   AND m.key IN ('contacts', 'members')
   AND cr.status IN (
     'Pending', 'Pending HS Member', 'Pending Member',
     'Enrolled', 'Enrolled - Pending Start', 'Approved Pending'
   )
   AND (
     cr.original_start_date IS NULL
     OR cr.current_year_start_date IS NULL
   )
   AND (
     cr.data->>'start_date' IS NOT NULL
     OR cr.data->>'sharing_effective_date' IS NOT NULL
     OR cr.data->>'insurance_effective_date' IS NOT NULL
     OR cr.data->>'health_insurance_start_date' IS NOT NULL
   );
