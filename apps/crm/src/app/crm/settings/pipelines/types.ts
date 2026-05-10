export type PipelineType = 'standard' | 'lead' | 'enrollment' | 'support' | 'custom';

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  organization_id: string;
  name: string;
  key: string;
  color: string | null;
  probability: number | null;
  is_won: boolean;
  is_lost: boolean;
  display_order: number;
  is_active: boolean;
  required_fields: string[] | null;
  allowed_from: string[] | null;
  allowed_to: string[] | null;
  auto_actions: unknown[] | null;
  sla_hours: number | null;
  rotting_days: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Pipeline {
  id: string;
  organization_id: string;
  module_id: string | null;
  name: string;
  key: string;
  description: string | null;
  pipeline_type: PipelineType;
  is_default: boolean;
  is_active: boolean;
  color: string | null;
  icon: string | null;
  display_order: number;
  config: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineWithStages extends Pipeline {
  crm_pipeline_stages: PipelineStage[];
}
