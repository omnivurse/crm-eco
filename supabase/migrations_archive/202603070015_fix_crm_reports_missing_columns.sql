-- Fix crm_reports table: add columns that were missed because CREATE TABLE IF NOT EXISTS
-- was a no-op (table already existed from 20260125000000_reports_enhancements.sql).
-- The columns data_source, is_template, and template_category were only defined in
-- 202601250002_report_builder_system.sql's CREATE TABLE IF NOT EXISTS, which never ran.

DO $$
BEGIN
  ALTER TABLE public.crm_reports ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'members';
  ALTER TABLE public.crm_reports ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;
  ALTER TABLE public.crm_reports ADD COLUMN IF NOT EXISTS template_category text;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Some columns already exist: %', SQLERRM;
END $$;

-- Ensure the data_source index exists
CREATE INDEX IF NOT EXISTS idx_crm_reports_data_source ON public.crm_reports(org_id, data_source);
CREATE INDEX IF NOT EXISTS idx_crm_reports_is_template ON public.crm_reports(is_template);
