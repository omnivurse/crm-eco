/**
 * Shared CRM AI helpers — loads a compact record-context bundle that the
 * field-suggest and email-draft endpoints feed into the LLM prompt.
 *
 * Kept intentionally small (titles, recent note excerpts, upcoming task
 * summaries) so we stay well under the token budget and don't leak
 * unrelated PHI. Individual endpoints can extend the bundle if needed.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CrmRecord } from './types';
import { resolveNoteSourceRecordIdsWithClient, moduleKeyFromJoinedRelation } from './note-aggregate';

export interface AiRecordContext {
  record: CrmRecord;
  moduleName: string | null;
  recentNotes: Array<{ content: string; created_at: string }>;
  recentTasks: Array<{
    title: string;
    status: string | null;
    activity_type: string | null;
    created_at: string;
  }>;
}

export interface LoadAiContextArgs {
  supabase: SupabaseClient;
  orgId: string;
  recordId: string;
  /** Cap on notes / tasks returned. Defaults to 6 each. */
  limit?: number;
}

export async function loadAiRecordContext({
  supabase,
  orgId,
  recordId,
  limit = 6,
}: LoadAiContextArgs): Promise<AiRecordContext | null> {
  const { data: record } = await supabase
    .from('crm_records')
    .select('*, module:crm_modules!crm_records_module_id_fkey(key)')
    .eq('id', recordId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!record) return null;

  const moduleKey = moduleKeyFromJoinedRelation(record.module);
  const noteIds = await resolveNoteSourceRecordIdsWithClient(
    supabase,
    record as CrmRecord,
    moduleKey,
  );

  const [{ data: moduleRow }, { data: notes }, { data: tasks }] = await Promise.all([
    supabase
      .from('crm_modules')
      .select('name')
      .eq('id', record.module_id)
      .maybeSingle(),
    supabase
      .from('crm_notes')
      .select('body, created_at')
      .in('record_id', noteIds)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('crm_tasks')
      .select('title, status, activity_type, created_at')
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  return {
    record: record as CrmRecord,
    moduleName: moduleRow?.name ?? null,
    recentNotes:
      (notes ?? []).map((n) => ({
        // Trim long notes so a single runaway entry doesn't dominate the
        // prompt budget.
        content: String(n.body ?? '').slice(0, 500),
        created_at: n.created_at,
      })),
    recentTasks:
      (tasks ?? []).map((t) => ({
        title: String(t.title ?? ''),
        status: t.status ?? null,
        activity_type: t.activity_type ?? null,
        created_at: t.created_at,
      })),
  };
}

/**
 * Serialize a context bundle into a compact block for LLM consumption.
 * Deliberately text-only (no JSON) so the model treats it as background
 * rather than data to echo verbatim.
 */
export function formatAiContextBlock(ctx: AiRecordContext): string {
  const { record, moduleName, recentNotes, recentTasks } = ctx;
  const lines: string[] = [];
  lines.push(`Record title: ${record.title ?? '(untitled)'}`);
  if (moduleName) lines.push(`Module: ${moduleName}`);
  if (record.stage) lines.push(`Stage: ${record.stage}`);
  if (record.status) lines.push(`Status: ${record.status}`);
  if (record.email) lines.push(`Email: ${record.email}`);
  if (record.phone) lines.push(`Phone: ${record.phone}`);

  const data = (record.data ?? {}) as Record<string, unknown>;
  const interesting: Array<[string, unknown]> = Object.entries(data).filter(
    ([k, v]) =>
      v != null &&
      v !== '' &&
      !k.startsWith('_') &&
      k !== 'notes_history' &&
      k !== 'tags' &&
      k !== 'privacy',
  );
  if (interesting.length > 0) {
    lines.push('Key fields:');
    for (const [k, v] of interesting.slice(0, 12)) {
      const pretty = typeof v === 'string' ? v : JSON.stringify(v);
      lines.push(`  - ${k}: ${pretty.slice(0, 160)}`);
    }
  }

  if (recentNotes.length > 0) {
    lines.push('Recent notes:');
    for (const n of recentNotes) {
      lines.push(`  [${n.created_at}] ${n.content}`);
    }
  }

  if (recentTasks.length > 0) {
    lines.push('Recent activities:');
    for (const t of recentTasks) {
      const status = t.status ? ` (${t.status})` : '';
      const type = t.activity_type ? `${t.activity_type}: ` : '';
      lines.push(`  [${t.created_at}] ${type}${t.title}${status}`);
    }
  }

  return lines.join('\n');
}
