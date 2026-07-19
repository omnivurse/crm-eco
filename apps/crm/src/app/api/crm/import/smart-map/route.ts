/**
 * POST /api/crm/import/smart-map
 *
 * The brain behind "Smart Import". Given the CSV headers (and, optionally, a
 * chosen module) it:
 *   1. Detects the most likely target module from the header signals.
 *   2. Loads that module's field schema.
 *   3. Deterministically maps columns → fields (Zoho-aware alias + fuzzy).
 *   4. Optionally asks an LLM to resolve ONLY the still-unmapped headers,
 *      when `OPENAI_API_KEY` is configured. Never sends row values (PHI-safe).
 *
 * Returns everything the wizard needs to drop the user straight onto the
 * review step: the detected module, its fields, and per-column mappings.
 *
 * Body: { headers: string[], moduleId?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { requireActiveOrgCrmRoles } from '@/lib/crm/require-crm-role';
import type { CrmField } from '@/lib/crm/types';
import {
  detectModule,
  suggestSmartMappings,
  normalizeLabel,
  type SmartMapping,
} from '@/lib/crm/import/smart-mapping';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  headers: z.array(z.string()).min(1).max(500),
  moduleId: z.string().uuid().optional(),
});

const AI_MODEL = process.env.OPENAI_MODEL_FIELD_SUGGEST || 'gpt-4o-mini';
/** Cap the AI ask so a wide export can't balloon the prompt. */
const MAX_AI_HEADERS = 40;

export async function POST(request: NextRequest) {
  const profile = await getAuthProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = await createClient();
  const roleGate = await requireActiveOrgCrmRoles(supabase, profile.organization_id, [
    'crm_admin',
    'crm_manager',
  ]);
  if (!roleGate.ok) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof z.ZodError ? 'Invalid request body' : 'Invalid JSON' },
      { status: 400 },
    );
  }

  const { headers, moduleId } = parsed;
  // `supabase` already created for the active-org role gate above.

  // Available modules for this org (id, key, name) — detection only picks
  // among modules that actually exist.
  const { data: modules, error: modulesError } = await supabase
    .from('crm_modules')
    .select('id, key, name, name_plural')
    .eq('org_id', profile.organization_id)
    .eq('is_enabled', true);

  if (modulesError || !modules || modules.length === 0) {
    return NextResponse.json(
      { error: modulesError?.message || 'No modules configured' },
      { status: modulesError ? 500 : 400 },
    );
  }

  // Resolve the target module: explicit choice wins, else auto-detect.
  let target = moduleId ? modules.find((m) => m.id === moduleId) ?? null : null;
  let moduleConfidence = target ? 1 : 0;

  if (!target) {
    const detection = detectModule(
      headers,
      modules.map((m) => m.key),
    );
    target = modules.find((m) => m.key === detection.moduleKey) ?? modules[0];
    moduleConfidence = detection.confidence;
  }

  // Load the target module's fields.
  const { data: fieldRows, error: fieldsError } = await supabase
    .from('crm_fields')
    .select('*')
    .eq('module_id', target.id)
    .order('display_order');

  if (fieldsError) {
    return NextResponse.json({ error: fieldsError.message }, { status: 500 });
  }
  const fields = (fieldRows ?? []) as CrmField[];

  // Deterministic first pass — always runs.
  let mappings = suggestSmartMappings(headers, fields);

  // Optional AI pass: resolve only the unmapped headers, header-names only.
  let aiUsed = false;
  const unmapped = mappings.filter((m) => !m.targetField).map((m) => m.sourceColumn);
  if (process.env.OPENAI_API_KEY && unmapped.length > 0) {
    try {
      const aiResolved = await aiResolveUnmapped(unmapped.slice(0, MAX_AI_HEADERS), fields);
      if (aiResolved.size > 0) {
        aiUsed = true;
        const claimed = new Set(
          mappings.filter((m) => m.targetField).map((m) => m.targetField as string),
        );
        mappings = mappings.map((m) => {
          if (m.targetField) return m;
          const key = aiResolved.get(m.sourceColumn);
          if (key && !claimed.has(key)) {
            claimed.add(key);
            return {
              ...m,
              targetField: key,
              confidence: 0.75,
              autoMapped: true,
              reason: 'AI suggested',
            } satisfies SmartMapping;
          }
          return m;
        });
      }
    } catch (err) {
      // AI is best-effort — deterministic mappings already stand.
      console.error('[smart-map] AI pass failed:', err);
    }
  }

  const autoMappedCount = mappings.filter((m) => m.autoMapped).length;

  return NextResponse.json({
    module: {
      id: target.id,
      key: target.key,
      name: target.name,
      name_plural: target.name_plural,
    },
    moduleConfidence,
    fields,
    mappings,
    stats: {
      totalColumns: headers.length,
      autoMapped: autoMappedCount,
      unmapped: mappings.filter((m) => !m.targetField).length,
      aiUsed,
    },
  });
}

/**
 * Ask the LLM to map leftover headers to field keys. Sends only header names +
 * the field catalog (key, label, type) — never any row values, so no PHI
 * leaves the tenant. Returns a Map<sourceHeader, fieldKey> for confident hits.
 */
async function aiResolveUnmapped(
  unmapped: string[],
  fields: CrmField[],
): Promise<Map<string, string>> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const catalog = fields.map((f) => ({ key: f.key, label: f.label, type: f.type }));
  const validKeys = new Set(fields.map((f) => f.key));

  const system =
    'You map spreadsheet column headers (often exported from Zoho CRM) to CRM ' +
    'field keys. Only use keys from the provided catalog. If a header has no ' +
    'good match, omit it. Return STRICT JSON: {"mappings":[{"header":"...",' +
    '"field_key":"..."}]}. Never invent field keys.';

  const user = JSON.stringify({
    headers: unmapped,
    field_catalog: catalog,
  });

  const completion = await client.chat.completions.create({
    model: AI_MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return new Map();

  const result = new Map<string, string>();
  try {
    const parsed = JSON.parse(raw) as {
      mappings?: Array<{ header?: string; field_key?: string }>;
    };
    const headerLookup = new Map(unmapped.map((h) => [normalizeLabel(h), h]));
    for (const entry of parsed.mappings ?? []) {
      if (!entry.header || !entry.field_key) continue;
      if (!validKeys.has(entry.field_key)) continue;
      // Match the AI's echoed header back to the exact original casing.
      const original = headerLookup.get(normalizeLabel(entry.header)) ?? entry.header;
      result.set(original, entry.field_key);
    }
  } catch {
    return new Map();
  }
  return result;
}
