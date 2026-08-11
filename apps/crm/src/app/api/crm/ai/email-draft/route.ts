/**
 * POST /api/crm/ai/email-draft
 *
 * Generates a subject + HTML body for a follow-up email addressed to
 * the record's primary contact, grounded in the CRM record context and
 * recent activity. Plugs straight into `SendEmailDialog`'s
 * `initialSubject` / `initialBody` props.
 *
 * Body schema:
 *   { recordId: uuid, goal?: string, tone?: 'friendly'|'formal'|'concise' }
 *
 * Returns: { subject: string, body: string, model: string }
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
  goal: z.string().max(500).optional(),
  tone: z.enum(['friendly', 'formal', 'concise']).optional(),
});

const DEFAULT_MODEL = process.env.OPENAI_MODEL_EMAIL_DRAFT || 'gpt-4o-mini';

const SYSTEM = `You are drafting a follow-up email from a CRM user to a contact \
on a record. Return a JSON object exactly matching:
{"subject": "...", "body": "<p>...</p>"}
- subject: concise, <= 80 characters, no emojis.
- body: short HTML using simple <p>, <br>, <strong> tags only. 2–4 short paragraphs.
- Start with a brief, specific greeting referring to the record by name.
- Close with a clear call-to-action and a signature placeholder like \
  "— {{senderName}}".
- Never invent specifics (prices, dates, meeting times) that aren't in the context.
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
    const { recordId, goal, tone = 'friendly' } = parsed.data;

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
      `Tone: ${tone}.`,
      goal ? `Goal: ${goal}` : `Goal: move the relationship forward with the next logical step.`,
      ``,
      `Draft the email now and return only the JSON object.`,
    ].join('\n');

    const result = await invokeCrmAi({
      purpose: 'email_draft',
      system: SYSTEM,
      user: userPrompt,
      model: DEFAULT_MODEL,
      temperature: 0.5,
      maxTokens: 600,
      json: true,
      orgId: profile.organization_id,
      actorId: profile.id,
      recordId,
      supabase,
    });

    const raw = result.text || '{}';
    let subject = '';
    let body = '';
    try {
      const parsedOut = JSON.parse(raw) as { subject?: string; body?: string };
      subject = (parsedOut.subject ?? '').trim();
      body = (parsedOut.body ?? '').trim();
    } catch {
      body = raw;
    }

    if (!subject) {
      subject = ctx.record.title ? `Follow-up on ${ctx.record.title}` : 'Quick follow-up';
    }

    return NextResponse.json({ subject, body, model: result.model });
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
    console.error('[ai/email-draft] error', err);
    return NextResponse.json(
      { error: 'AI request failed', details: message },
      { status: 500 },
    );
  }
}
