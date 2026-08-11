/**
 * POST /api/crm/ai/field-suggest
 *
 * Given a record + a target field, returns a short AI-generated draft
 * the inline editor can paste in one click. Used by `AiSuggestChip`.
 *
 * Body schema:
 *   { recordId: uuid, fieldKey: string, fieldLabel: string,
 *     fieldType: 'text'|'textarea'|'email'|..., currentValue?: string,
 *     instruction?: string }
 *
 * Returns: { suggestion: string, model: string }
 *
 * Service unavailable (503) if `OPENAI_API_KEY` isn't configured — the
 * chip reflects this state without breaking the editor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { loadAiRecordContext, formatAiContextBlock } from '@/lib/crm/ai-context';
import {
  CrmAiBudgetExceededError,
  CrmAiNotConfiguredError,
  invokeCrmAi,
} from '@/lib/crm/ai/server';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  recordId: z.string().uuid(),
  fieldKey: z.string().min(1).max(64),
  fieldLabel: z.string().min(1).max(120),
  fieldType: z.string().min(1).max(32),
  currentValue: z.string().max(4000).nullable().optional(),
  instruction: z.string().max(500).optional(),
});

const DEFAULT_MODEL = process.env.OPENAI_MODEL_FIELD_SUGGEST || 'gpt-4o-mini';

const SYSTEM = `You are an assistant embedded in a CRM. Your only job is to draft a \
concise, plausible value for a single field on a record, using the \
provided context as grounding. Rules:
- Output plain text only. No markdown, no quotes around the value, no commentary.
- Keep responses under 200 characters unless the field type is "textarea".
- If the field is an email address, output a single valid address.
- Never invent a phone number or email. If context lacks the information, \
  output an empty string.
- Never include PHI beyond what's already in the context.`;

export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { recordId, fieldKey, fieldLabel, fieldType, currentValue, instruction } =
      parsed.data;

    const supabase = await createClient();
    const ctx = await loadAiRecordContext({
      supabase,
      orgId: profile.organization_id,
      recordId,
    });
    if (!ctx) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    const userPrompt = [
      `Record context:`,
      formatAiContextBlock(ctx),
      ``,
      `Target field:`,
      `  key: ${fieldKey}`,
      `  label: ${fieldLabel}`,
      `  type: ${fieldType}`,
      currentValue ? `  current value: ${currentValue.slice(0, 400)}` : null,
      instruction ? `  instruction: ${instruction}` : null,
      ``,
      `Draft the best value for this field now.`,
    ]
      .filter(Boolean)
      .join('\n');

    const result = await invokeCrmAi({
      purpose: 'field_suggest',
      system: SYSTEM,
      user: userPrompt,
      model: DEFAULT_MODEL,
      temperature: 0.3,
      maxTokens: fieldType === 'textarea' ? 400 : 120,
      orgId: profile.organization_id,
      actorId: profile.id,
      recordId,
      supabase,
    });

    const suggestion = result.text.trim().replace(/^"|"$/g, '');
    return NextResponse.json({ suggestion, model: result.model });
  } catch (err) {
    if (err instanceof CrmAiNotConfiguredError) {
      return NextResponse.json(
        { error: 'AI features are not configured', code: 'AI_NOT_CONFIGURED' },
        { status: 503 },
      );
    }
    if (err instanceof CrmAiBudgetExceededError) {
      return NextResponse.json(
        { error: 'AI budget exceeded', code: 'AI_BUDGET_EXCEEDED' },
        { status: 429 },
      );
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ai/field-suggest] error', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
