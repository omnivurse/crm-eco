/**
 * Shared CRM AI invoke — one OpenAI client path for field-suggest, email-draft,
 * and briefing. Never logs prompt bodies / PHI.
 */

import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_ORG_DAILY_TOKEN_BUDGET, getOrgTokensUsedToday } from '@/lib/crm/habits/ai-tips';

export type CrmAiPurpose =
  | 'field_suggest'
  | 'email_draft'
  | 'record_briefing'
  | 'habits_tips';

export interface InvokeCrmAiArgs {
  purpose: CrmAiPurpose;
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  orgId?: string;
  actorId?: string;
  recordId?: string | null;
  supabase?: SupabaseClient;
  /** Skip budget check (e.g. habits cron already gated). */
  skipBudget?: boolean;
}

export interface InvokeCrmAiResult {
  text: string;
  model: string;
  tokens: number;
}

export class CrmAiNotConfiguredError extends Error {
  code = 'AI_NOT_CONFIGURED' as const;
  constructor() {
    super('AI features are not configured');
    this.name = 'CrmAiNotConfiguredError';
  }
}

export class CrmAiBudgetExceededError extends Error {
  code = 'AI_BUDGET_EXCEEDED' as const;
  constructor() {
    super('Organization daily AI token budget exceeded');
    this.name = 'CrmAiBudgetExceededError';
  }
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function invokeCrmAi(
  args: InvokeCrmAiArgs,
): Promise<InvokeCrmAiResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new CrmAiNotConfiguredError();
  }

  const model =
    args.model ||
    process.env.OPENAI_MODEL_CRM ||
    process.env.OPENAI_MODEL_FIELD_SUGGEST ||
    'gpt-4o-mini';

  if (args.supabase && args.orgId && !args.skipBudget) {
    const used = await getOrgTokensUsedToday(args.supabase, args.orgId);
    const budget = Number(
      process.env.CRM_AI_ORG_DAILY_TOKEN_BUDGET || DEFAULT_ORG_DAILY_TOKEN_BUDGET,
    );
    if (used >= budget) {
      throw new CrmAiBudgetExceededError();
    }
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model,
    temperature: args.temperature ?? 0.3,
    max_tokens: args.maxTokens ?? 400,
    messages: [
      { role: 'system', content: args.system },
      { role: 'user', content: args.user },
    ],
    ...(args.json ? { response_format: { type: 'json_object' as const } } : {}),
  });

  const text = completion.choices[0]?.message?.content ?? '';
  const tokens = completion.usage?.total_tokens ?? 0;

  // Safe metadata only — never prompt bodies.
  console.info('[crm-ai]', {
    purpose: args.purpose,
    model,
    tokens,
    orgId: args.orgId ?? null,
    actorId: args.actorId ?? null,
    recordId: args.recordId ?? null,
  });

  if (args.supabase && args.orgId) {
    void writeAiAudit(args.supabase, {
      orgId: args.orgId,
      actorId: args.actorId ?? null,
      recordId: args.recordId ?? null,
      purpose: args.purpose,
      model,
      tokens,
      mode: 'llm',
    });
  }

  return { text, model, tokens };
}

async function writeAiAudit(
  supabase: SupabaseClient,
  row: {
    orgId: string;
    actorId: string | null;
    recordId: string | null;
    purpose: string;
    model: string;
    tokens: number;
    mode: string;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from('crm_ai_audit').insert({
      org_id: row.orgId,
      actor_id: row.actorId,
      record_id: row.recordId,
      purpose: row.purpose,
      model: row.model,
      tokens: row.tokens,
      mode: row.mode,
    });
    if (error) {
      console.warn('[crm-ai] audit write skipped', {
        purpose: row.purpose,
        reason: error.message,
      });
    }
  } catch (err) {
    // Table may not exist yet — never fail the user path.
    console.warn('[crm-ai] audit write skipped', {
      purpose: row.purpose,
      reason: err instanceof Error ? err.message : 'unknown',
    });
  }
}
