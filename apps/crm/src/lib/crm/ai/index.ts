/**
 * Client-safe CRM AI surface.
 *
 * Do NOT re-export server modules (briefing / invoke) from this barrel —
 * client components like NeedsAttentionChip import here, and pulling in
 * `next/headers` via queries → record-insights breaks the production build.
 *
 * Server routes: `import { … } from '@/lib/crm/ai/server'`
 */

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
