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
import OpenAI from 'openai';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { loadAiRecordContext, formatAiContextBlock } from '@/lib/crm/ai-context';

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
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'AI features are not configured', code: 'AI_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

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

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    let subject = '';
    let body = '';
    try {
      const parsedOut = JSON.parse(raw) as { subject?: string; body?: string };
      subject = (parsedOut.subject ?? '').trim();
      body = (parsedOut.body ?? '').trim();
    } catch {
      // Fall back to treating the whole output as body text if the model
      // drifted from JSON — better than a 500 when the user pressed the
      // button in good faith.
      body = raw;
    }

    if (!subject) {
      subject = ctx.record.title ? `Follow-up on ${ctx.record.title}` : 'Quick follow-up';
    }

    return NextResponse.json({ subject, body, model: DEFAULT_MODEL });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ai/email-draft] error', err);
    return NextResponse.json(
      { error: 'AI request failed', details: message },
      { status: 500 },
    );
  }
}
