export type {
  BriefingAction,
  BriefingActionKind,
  BriefingMode,
  BriefingSeverity,
  BriefingSignal,
  Citation,
  GetRecordBriefingArgs,
  RecordBriefing,
  SignalInput,
} from './types';

export { getRecordBriefing } from './briefing';
export {
  attentionScore,
  buildRulesSummary,
  computeRecordSignals,
  projectSignalData,
  rankRulesRecommendations,
  topAttentionLabel,
} from './signals';
export { validateRecommendations, collectCitationIds } from './citations';
export { playbookWeights, signalPriority, staleTouchDays } from './playbooks';
export {
  invokeCrmAi,
  isAiConfigured,
  CrmAiNotConfiguredError,
  CrmAiBudgetExceededError,
  type CrmAiPurpose,
  type InvokeCrmAiArgs,
  type InvokeCrmAiResult,
} from './invoke';
