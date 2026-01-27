/*
  Import System Schema

  1. import_jobs - Track import operations
  2. import_staging - Staging area for imported data before processing
*/

-- Create import_jobs table
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  import_type text NOT NULL CHECK (import_type IN ('member', 'agent', 'billing', 'enrollment', 'product', 'custom')),
  file_name text NOT NULL,
  file_size integer,
  file_type text, -- csv, xlsx, etc
  status text NOT NULL CHECK (status IN ('pending', 'validating', 'mapping', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',

  -- Mapping configuration
  field_mapping jsonb DEFAULT '{}', -- { source_column: target_field }
  mapping_template_id uuid, -- Optional saved mapping template

  -- Progress tracking
  total_rows integer DEFAULT 0,
  processed_rows integer DEFAULT 0,
  success_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  skip_count integer DEFAULT 0,

  -- Validation results
  validation_errors jsonb DEFAULT '[]',

  -- Results
  result_summary jsonb,
  error_log jsonb DEFAULT '[]',

  -- Options
  options jsonb DEFAULT '{}', -- { skip_duplicates, update_existing, etc }

  -- Timestamps
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create import_staging table
CREATE TABLE IF NOT EXISTS public.import_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  raw_data jsonb NOT NULL, -- Original row data
  mapped_data jsonb, -- Data after field mapping
  status text NOT NULL CHECK (status IN ('pending', 'valid', 'invalid', 'processed', 'skipped')) DEFAULT 'pending',
  validation_errors jsonb DEFAULT '[]',
  target_record_id uuid, -- ID of created/updated record
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create import_mapping_templates table for saved mappings
CREATE TABLE IF NOT EXISTS public.import_mapping_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  import_type text NOT NULL,
  field_mapping jsonb NOT NULL,
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_import_jobs_org ON public.import_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_type ON public.import_jobs(import_type);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created ON public.import_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_staging_job ON public.import_staging(import_job_id);
CREATE INDEX IF NOT EXISTS idx_import_staging_status ON public.import_staging(status);
CREATE INDEX IF NOT EXISTS idx_import_staging_row ON public.import_staging(import_job_id, row_number);

CREATE INDEX IF NOT EXISTS idx_import_templates_org ON public.import_mapping_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_import_templates_type ON public.import_mapping_templates(import_type);

-- Enable RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_mapping_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for import_jobs
CREATE POLICY "Users can read import jobs in their org"
  ON public.import_jobs FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can create import jobs"
  ON public.import_jobs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')
    )
  );

CREATE POLICY "Staff can update import jobs"
  ON public.import_jobs FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')
    )
  );

CREATE POLICY "Admins can delete import jobs"
  ON public.import_jobs FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for import_staging
CREATE POLICY "Users can read staging data for their org's imports"
  ON public.import_staging FOR SELECT TO authenticated
  USING (
    import_job_id IN (
      SELECT id FROM public.import_jobs
      WHERE organization_id IN (
        SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Staff can manage staging data"
  ON public.import_staging FOR ALL TO authenticated
  USING (
    import_job_id IN (
      SELECT id FROM public.import_jobs
      WHERE organization_id IN (
        SELECT organization_id FROM public.profiles
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')
      )
    )
  )
  WITH CHECK (
    import_job_id IN (
      SELECT id FROM public.import_jobs
      WHERE organization_id IN (
        SELECT organization_id FROM public.profiles
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')
      )
    )
  );

-- RLS Policies for import_mapping_templates
CREATE POLICY "Users can read mapping templates in their org"
  ON public.import_mapping_templates FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage mapping templates"
  ON public.import_mapping_templates FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_import_jobs_updated_at ON public.import_jobs;
CREATE TRIGGER update_import_jobs_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_import_templates_updated_at ON public.import_mapping_templates;
CREATE TRIGGER update_import_templates_updated_at
  BEFORE UPDATE ON public.import_mapping_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
