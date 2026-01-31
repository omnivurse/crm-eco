/**
 * Audit Logging System - Shared Types
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AppSource = 'crm' | 'admin' | 'portal' | 'system';
export type ActionCategory =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'data_deletion'
  | 'data_export'
  | 'configuration'
  | 'integration'
  | 'system';

export interface AuditLogEntry {
  id: string;
  sequence_number?: number;
  organization_id: string;
  app_source: AppSource;
  actor_id: string | null;
  actor_role: string | null;
  actor_email: string | null;
  actor_name?: string | null;
  actor_avatar_url?: string | null;
  target_user_id: string | null;
  target_entity_type: string | null;
  target_entity_id: string | null;
  action: string;
  action_category: ActionCategory;
  description: string | null;
  risk_level: RiskLevel;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown>;
  changes: Record<string, unknown>;
  created_at: string;
}

export interface UseAuditFeedOptions {
  orgId: string;
  appSource?: AppSource;
  minRiskLevel?: RiskLevel;
  maxEvents?: number;
  throttleMs?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onHighRiskEvent?: (event: AuditLogEntry) => void;
}

export interface UseAuditFeedReturn {
  events: AuditLogEntry[];
  isPaused: boolean;
  newEventCount: number;
  isLoading: boolean;
  error: Error | null;
  pause: () => void;
  resume: () => void;
  clear: () => void;
  refresh: () => Promise<void>;
  prepend: (event: AuditLogEntry) => void;
}

export const RISK_ORDER: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};
