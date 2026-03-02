-- Add multi-module report support columns to crm_reports
ALTER TABLE public.crm_reports ADD COLUMN IF NOT EXISTS related_modules jsonb DEFAULT '[]';
ALTER TABLE public.crm_reports ADD COLUMN IF NOT EXISTS filter_logic jsonb;

-- RPC function: execute_report_query
-- Supports multi-module queries by joining crm_records via crm_record_links
CREATE OR REPLACE FUNCTION public.execute_report_query(
  p_org_id uuid,
  p_primary_module_id uuid,
  p_related_modules text DEFAULT '[]',
  p_columns text DEFAULT '[]',
  p_filters text DEFAULT '[]',
  p_filter_logic text DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_related jsonb;
  v_result jsonb;
  v_sql text;
  v_where text := '';
  v_joins text := '';
  v_select text := '';
  v_rm record;
  v_i int := 0;
  v_alias text;
  v_mod_id uuid;
  v_join_type text;
BEGIN
  v_related := p_related_modules::jsonb;

  -- Build base SELECT
  v_select := 'SELECT p.id, p.data AS primary_data, p.created_at, p.updated_at';

  -- Build JOINs for each related module
  FOR v_rm IN SELECT * FROM jsonb_array_elements(v_related)
  LOOP
    v_i := v_i + 1;
    v_alias := 'r' || v_i;
    v_mod_id := (v_rm.value->>'module_id')::uuid;
    v_join_type := COALESCE(v_rm.value->>'join_type', 'inclusive');

    -- Add related module data to SELECT
    v_select := v_select || format(
      ', %I.data AS %s_data',
      v_alias,
      COALESCE(v_rm.value->>'module_key', 'related' || v_i)
    );

    -- Build JOIN via crm_record_links
    IF v_join_type = 'exclusive' THEN
      v_joins := v_joins || format(
        ' INNER JOIN crm_record_links %s_link ON (%s_link.source_record_id = p.id OR %s_link.target_record_id = p.id)'
        || ' INNER JOIN crm_records %I ON (%I.id = CASE WHEN %s_link.source_record_id = p.id THEN %s_link.target_record_id ELSE %s_link.source_record_id END'
        || ' AND %I.module_id = %L AND %I.org_id = %L)',
        v_alias, v_alias, v_alias,
        v_alias, v_alias, v_alias, v_alias, v_alias,
        v_alias, v_mod_id, v_alias, p_org_id
      );
    ELSE
      v_joins := v_joins || format(
        ' LEFT JOIN crm_record_links %s_link ON (%s_link.source_record_id = p.id OR %s_link.target_record_id = p.id)'
        || ' LEFT JOIN crm_records %I ON (%I.id = CASE WHEN %s_link.source_record_id = p.id THEN %s_link.target_record_id ELSE %s_link.source_record_id END'
        || ' AND %I.module_id = %L AND %I.org_id = %L)',
        v_alias, v_alias, v_alias,
        v_alias, v_alias, v_alias, v_alias, v_alias,
        v_alias, v_mod_id, v_alias, p_org_id
      );
    END IF;
  END LOOP;

  -- Build WHERE clause
  v_where := format(' WHERE p.org_id = %L AND p.module_id = %L', p_org_id, p_primary_module_id);

  -- Assemble final query
  v_sql := v_select
    || ' FROM crm_records p'
    || v_joins
    || v_where
    || ' ORDER BY p.created_at DESC'
    || format(' LIMIT %s OFFSET %s', p_limit, p_offset);

  -- Execute and return as JSONB array
  EXECUTE format('SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t', v_sql)
    INTO v_result;

  RETURN v_result;
END;
$$;

-- Ensure crm_record_links table exists (for cross-module relationships)
CREATE TABLE IF NOT EXISTS public.crm_record_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  target_record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  link_type text DEFAULT 'related',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_crm_record_links_source ON public.crm_record_links(source_record_id);
CREATE INDEX IF NOT EXISTS idx_crm_record_links_target ON public.crm_record_links(target_record_id);
CREATE INDEX IF NOT EXISTS idx_crm_record_links_org ON public.crm_record_links(org_id);

-- RLS for crm_record_links
ALTER TABLE public.crm_record_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'crm_record_links' AND policyname = 'crm_record_links_org_access'
  ) THEN
    CREATE POLICY crm_record_links_org_access ON public.crm_record_links
      FOR ALL
      USING (org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));
  END IF;
END $$;
