/**
 * Change Intelligence System - Type Definitions
 */

// Source types for changes
export type ChangeSource = 'user' | 'system' | 'integration' | 'vendor' | 'import';

// Severity levels for prioritization
export type ChangeSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

// Reconciliation status for review workflow
export type ReconciliationStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'auto_resolved';

// Sync status for cross-system reconciliation
export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'stale';

// Actor types
export type ActorType = 'user' | 'system' | 'integration' | 'vendor';

/**
 * Core Change Event interface
 * Represents a single change in the system
 */
export interface ChangeEvent {
  id: string;
  org_id: string;

  // Source identification
  source_type: ChangeSource;
  source_name?: string;
  source_id?: string;

  // Change classification
  change_type: string;
  entity_type: string;
  entity_id: string;
  entity_title?: string;

  // Severity and priority
  severity: ChangeSeverity;
  requires_review: boolean;

  // Change details
  title: string;
  description?: string;
  diff?: Record<string, { from: unknown; to: unknown }>;
  payload?: Record<string, unknown>;

  // Actor information
  actor_id?: string;
  actor_name?: string;
  actor_type: ActorType;

  // Reconciliation
  reconciliation_status: ReconciliationStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;

  // Hash for deduplication
  content_hash?: string;
  previous_hash?: string;

  // Sync status
  sync_status: SyncStatus;
  synced_at?: string;

  // Timestamps
  detected_at: string;
  created_at: string;
}

/**
 * Change Event with joined actor information
 * Used in feed views
 */
export interface ChangeEventWithActor extends ChangeEvent {
  actor_full_name?: string;
  actor_avatar_url?: string;
  reviewer_full_name?: string;
}

/**
 * Options for fetching change feed
 */
export interface ChangeFeedOptions {
  orgId: string;
  entityTypes?: string[];
  sourceTypes?: ChangeSource[];
  minSeverity?: ChangeSeverity;
  requiresReview?: boolean;
  syncStatus?: SyncStatus;
  reconciliationStatus?: ReconciliationStatus;
  limit?: number;
  offset?: number;
  since?: Date;
}

/**
 * Options for the useChangeFeed hook
 */
export interface UseChangeFeedOptions extends ChangeFeedOptions {
  maxEvents?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  realtime?: boolean;
}

/**
 * Return type for useChangeFeed hook
 */
export interface UseChangeFeedReturn {
  events: ChangeEventWithActor[];
  isPaused: boolean;
  newEventCount: number;
  isLoading: boolean;
  error: Error | null;
  pause: () => void;
  resume: () => void;
  clear: () => void;
  refresh: () => Promise<void>;
}

/**
 * User subscription preferences for change notifications
 */
export interface ChangeSubscription {
  id: string;
  org_id: string;
  user_id: string;
  entity_types: string[];
  source_types: ChangeSource[];
  min_severity: ChangeSeverity;
  show_in_ticker: boolean;
  send_push: boolean;
  send_email: boolean;
  email_digest: 'none' | 'hourly' | 'daily' | 'weekly';
  sound_enabled: boolean;
  sound_critical_only: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a new change event
 */
export interface CreateChangeEventInput {
  orgId: string;
  sourceType: ChangeSource;
  sourceName?: string;
  sourceId?: string;
  changeType: string;
  entityType: string;
  entityId: string;
  entityTitle?: string;
  title: string;
  description?: string;
  current?: Record<string, unknown>;
  previous?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  actorId?: string;
  actorType?: ActorType;
  severity?: ChangeSeverity;
  requiresReview?: boolean;
}

/**
 * Change feed statistics
 */
export interface ChangeFeedStats {
  total_today: number;
  critical_count: number;
  high_count: number;
  pending_review: number;
  sync_conflicts: number;
  by_source: Record<string, number>;
}

/**
 * Event payload for the client-side event bus
 */
export interface ChangeEventPayload {
  id: string;
  type: string;
  orgId: string;
  severity: ChangeSeverity;
  title: string;
  description?: string;
  entityType: string;
  entityId: string;
  entityTitle?: string;
  actorName?: string;
  sourceType: ChangeSource;
  sourceName?: string;
  requiresReview: boolean;
  syncStatus: SyncStatus;
  timestamp: Date;
  data?: Record<string, unknown>;
}
