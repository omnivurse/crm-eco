/**
 * Central resolver: which `crm_records.id` values contribute notes to a given record’s UI.
 *
 * - **Person modules** (leads / contacts / members): this row + Zoho lineage fields
 *   (`converted_from_lead_id`, `converted_contact_id`) + `lead_to_contact` graph peers.
 * - **Deals**: this row + `deal_to_contact` / `deal_to_account` linked records; for each
 *   linked person row, same lineage + lead/contact graph as above (batched link query).
 *
 * Other modules: only the record itself.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CrmRecord } from './types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PERSON_MODULE_KEYS = new Set(['leads', 'contacts', 'members']);
const DEAL_MODULE_KEYS = new Set(['deals']);

const LINK_LEAD_CONTACT = 'lead_to_contact';
const LINK_DEAL_TO_RELATED = ['deal_to_contact', 'deal_to_account'] as const;

function normalizeModuleKey(moduleKey: string): string {
  return (moduleKey || '').trim().toLowerCase();
}

export function isPersonModuleKey(moduleKey: string): boolean {
  return PERSON_MODULE_KEYS.has(normalizeModuleKey(moduleKey));
}

export function isDealModuleKey(moduleKey: string): boolean {
  return DEAL_MODULE_KEYS.has(normalizeModuleKey(moduleKey));
}

/** Supabase may return a joined one-to-one relation as an object or a single-element array. */
export function moduleKeyFromJoinedRelation(module: unknown): string {
  if (Array.isArray(module)) {
    return (module[0] as { key?: string } | undefined)?.key ?? '';
  }
  return (module as { key?: string } | null | undefined)?.key ?? '';
}

/** Accepts UUID strings possibly wrapped in quotes from imports. */
export function parseUuidLoose(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim().replace(/^["']+|["']+$/g, '');
  return UUID_RE.test(t) ? t : null;
}

/**
 * For `recordId`, returns the ids on the *other* end of undirected links
 * whose `link_type` is in `linkTypes`.
 */
async function fetchUndirectedLinkPeers(
  supabase: SupabaseClient,
  recordId: string,
  linkTypes: readonly string[],
): Promise<string[]> {
  if (!parseUuidLoose(recordId) || linkTypes.length === 0) return [];

  const { data, error } = await supabase
    .from('crm_record_links')
    .select('source_record_id, target_record_id')
    .in('link_type', [...linkTypes])
    .is('deleted_at' as never, null)
    .or(`source_record_id.eq.${recordId},target_record_id.eq.${recordId}`);

  if (error || !data?.length) return [];

  const peers: string[] = [];
  for (const row of data) {
    if (row.source_record_id === recordId) {
      const p = parseUuidLoose(row.target_record_id);
      if (p) peers.push(p);
    } else if (row.target_record_id === recordId) {
      const p = parseUuidLoose(row.source_record_id);
      if (p) peers.push(p);
    }
  }
  return [...new Set(peers)];
}

function applyZohoPersonLineageFromData(
  ids: Set<string>,
  data: Record<string, unknown> | null | undefined,
): void {
  const d = data || {};
  const fromLead = parseUuidLoose(d.converted_from_lead_id);
  if (fromLead) ids.add(fromLead);
  const toContact = parseUuidLoose(d.converted_contact_id);
  if (toContact) ids.add(toContact);
}

/**
 * Adds every `lead_to_contact` edge touching any of `seedPersonIds` (both endpoints),
 * so lead + contact + any linked pair are all included in one round-trip.
 */
async function addLeadContactNeighborhood(
  supabase: SupabaseClient,
  seedPersonIds: string[],
  into: Set<string>,
): Promise<void> {
  const unique = [
    ...new Set(
      seedPersonIds.map((id) => parseUuidLoose(id)).filter(Boolean) as string[],
    ),
  ];
  if (unique.length === 0) return;

  for (const id of unique) into.add(id);

  const orParts = [
    ...unique.map((id) => `source_record_id.eq.${id}`),
    ...unique.map((id) => `target_record_id.eq.${id}`),
  ].join(',');

  // NOTE: `lead_to_contact` links are conversion lineage — the SAME person before
  // and after a lead→contact/member conversion. We intentionally DO NOT filter out
  // soft-deleted links here: when a converted lead is trashed (or the link itself is
  // soft-deleted by the undo-delete flow), the person's note history must still
  // surface on their surviving record. Trashing a record hides the record, it must
  // not orphan the person's notes. (The notes fetch still filters deleted_at on the
  // notes themselves, so genuinely-deleted notes stay hidden.)
  const { data: links } = await supabase
    .from('crm_record_links')
    .select('source_record_id, target_record_id')
    .eq('link_type', LINK_LEAD_CONTACT)
    .or(orParts);

  for (const row of links || []) {
    const a = parseUuidLoose(row.source_record_id);
    const b = parseUuidLoose(row.target_record_id);
    if (a) into.add(a);
    if (b) into.add(b);
  }
}

async function resolvePersonNoteSources(
  supabase: SupabaseClient,
  record: Pick<CrmRecord, 'id' | 'data'>,
): Promise<string[]> {
  const root = parseUuidLoose(record.id);
  if (!root) return [];

  const ids = new Set<string>([root]);
  applyZohoPersonLineageFromData(ids, record.data as Record<string, unknown> | undefined);
  await addLeadContactNeighborhood(supabase, [root], ids);
  return [...ids];
}

async function resolveDealNoteSources(
  supabase: SupabaseClient,
  record: Pick<CrmRecord, 'id' | 'data'>,
): Promise<string[]> {
  const root = parseUuidLoose(record.id);
  if (!root) return [];

  const ids = new Set<string>([root]);

  const linked = await fetchUndirectedLinkPeers(supabase, root, LINK_DEAL_TO_RELATED);
  for (const lid of linked) ids.add(lid);

  if (linked.length === 0) return [...ids];

  const { data: rows, error } = await supabase
    .from('crm_records')
    .select('id, data, module:crm_modules!crm_records_module_id_fkey(key)')
    .in('id', linked);

  if (error || !rows?.length) return [...ids];

  const personIds: string[] = [];
  for (const row of rows) {
    if (!isPersonModuleKey(moduleKeyFromJoinedRelation(row.module))) continue;
    personIds.push(row.id);
    applyZohoPersonLineageFromData(ids, row.data as Record<string, unknown>);
  }

  await addLeadContactNeighborhood(supabase, personIds, ids);

  return [...ids];
}

/**
 * All `crm_records.id` values whose `crm_notes` should appear on this record’s detail view.
 */
export async function resolveNoteSourceRecordIdsWithClient(
  supabase: SupabaseClient,
  record: Pick<CrmRecord, 'id' | 'data'>,
  moduleKey: string,
): Promise<string[]> {
  if (!parseUuidLoose(record.id)) return [];

  const mk = normalizeModuleKey(moduleKey);

  if (isPersonModuleKey(mk)) {
    return resolvePersonNoteSources(supabase, record);
  }

  if (isDealModuleKey(mk)) {
    return resolveDealNoteSources(supabase, record);
  }

  return [record.id];
}
