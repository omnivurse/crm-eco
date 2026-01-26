/**
 * Change Intelligence System
 * Centralized change detection, scoring, and reconciliation
 */

// Types
export type {
  ChangeSource,
  ChangeSeverity,
  ReconciliationStatus,
  SyncStatus,
  ActorType,
  ChangeEvent,
  ChangeEventWithActor,
  ChangeFeedOptions,
  UseChangeFeedOptions,
  UseChangeFeedReturn,
  ChangeSubscription,
  CreateChangeEventInput,
  ChangeFeedStats,
  ChangeEventPayload,
} from './types';

// Constants
export {
  SEVERITY_CONFIG,
  SOURCE_CONFIG,
  SYNC_STATUS_CONFIG,
  RECONCILIATION_CONFIG,
  ENTITY_TYPES,
  CHANGE_TYPES,
  SEVERITY_ORDER,
  DEFAULT_FEED_SETTINGS,
  ENTITY_ICONS,
  CHANGE_TYPE_LABELS,
} from './constants';

// Event Bus
export { ChangeEventBus, ChangeEventBusClass } from './event-bus';

// Severity Calculator
export {
  calculateSeverity,
  shouldRequireReview,
  parseSeverity,
} from './severity-calculator';
export type { SeverityInput, SeverityResult } from './severity-calculator';

// Formatters
export {
  formatRelativeTime,
  formatSeverity,
  formatSource,
  formatChangeType,
  getEntityIcon,
  formatDiff,
  formatFieldLabel,
  formatValue,
  isSignificantChange,
  generateChangeTitle,
  generateChangeDescription,
  groupEventsByPeriod,
} from './formatters';

// Hooks
export { useChangeFeed, useChangeSubscription } from './hooks/use-change-feed';
