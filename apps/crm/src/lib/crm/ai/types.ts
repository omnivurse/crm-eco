/**
 * Grounded Record Briefing — public types for the deep module interface.
 * Callers learn `getRecordBriefing` + these shapes; everything else is internal.
 */

export type BriefingMode = 'rules' | 'llm' | 'degraded';

export type BriefingSeverity = 'info' | 'warn' | 'blocker';

export type BriefingActionKind =
  | 'call'
  | 'email'
  | 'task'
  | 'fill_field'
  | 'review_coverage'
  | 'none';

export type Citation =
  | { id: string; kind: 'field'; key: string; valuePreview: string }
  | { id: string; kind: 'note'; at: string }
  | { id: string; kind: 'task'; title: string; status: string }
  | {
      id: string;
      kind: 'insight';
      key: 'lastInteractionAt' | 'open_activities' | 'bestTime' | 'updated_at';
      valuePreview: string;
    };

export interface BriefingSignal {
  code: string;
  severity: BriefingSeverity;
  label: string;
  evidence: Citation[];
}

export interface BriefingAction {
  action: BriefingActionKind;
  title: string;
  rationale: string;
  /** Citation ids that must exist on the signal pack. */
  citationIds: string[];
  confidence: 'high' | 'medium' | 'low';
  payload?: { fieldKey?: string; emailGoal?: string };
}

export interface RecordBriefing {
  summary: string;
  signals: BriefingSignal[];
  recommendations: BriefingAction[];
  mode: BriefingMode;
  model: string | null;
  generatedAt: string;
  /** True when the record looks healthy — UI shows calm empty state. */
  allClear: boolean;
}

export interface SignalInput {
  moduleKey: string | null | undefined;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  stage?: string | null;
  updatedAt?: string | null;
  /** Projected JSONB + indexed fields (canonical keys preferred). */
  data: Record<string, unknown>;
  openTaskCount?: number;
  overdueTaskCount?: number;
  lastInteractionAt?: string | null;
  now?: Date;
}

export interface GetRecordBriefingArgs {
  orgId: string;
  recordId: string;
  actorId: string;
  /**
   * Opt into LLM phrasing/ranking when configured.
   * Default is deterministic rules only; still fail-closed to rules if LLM fails.
   */
  preferLlm?: boolean;
}
