/**
 * Server-only CRM AI entry — safe for Route Handlers / Server Components.
 * Never import this from `'use client'` modules.
 */

export { getRecordBriefing } from './briefing';
export {
  invokeCrmAi,
  isAiConfigured,
  CrmAiNotConfiguredError,
  CrmAiBudgetExceededError,
  type CrmAiPurpose,
  type InvokeCrmAiArgs,
  type InvokeCrmAiResult,
} from './invoke';

export type {
  BriefingAction,
  BriefingMode,
  GetRecordBriefingArgs,
  RecordBriefing,
} from './types';
