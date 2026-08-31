/**
 * Central resolver: which `crm_records.id` values contribute notes to a given record’s UI.
 *
 * - **Person modules** (leads / contacts / members / history): this row + Zoho lineage fields
 *   (`converted_from_lead_id`, `converted_contact_id`) + `lead_to_contact` graph peers.
 * - **Contacts**: also same-email sibling contacts in the same org (Zoho duplicate contacts
 *   that share an email but were never linked via lead_to_contact).
 * - **Deals**: this row + `deal_to_contact` / `deal_to_account` linked records; for each
 *   linked person row, same lineage + lead/contact graph as above (batched link query).
 *
 * Other modules: only the record itself.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isPersonModuleKey } from '@/lib/crm/person-module-keys';
import {
  buildTwinLookup,
  pickRicherTwin,
} from './resolve-record-twin';
import type { MemberCrmRecordCandidate } from './resolve-member-crm-record';
import type { CrmRecord } from './types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEAL_MODULE_KEYS = new Set(['deals']);

const LINK_LEAD_CONTACT = 'lead_to_contact';
const LINK_DEAL_TO_RELATED = ['deal_to_contact', 'deal_to_account'] as const;

/**
 * Record fields used to resolve note sources.
 * `email` + `org_id` are required for same-email contact sibling lookup;
 * without them, lineage + lead↔contact peers still work.
 */
export type NoteAggregateRecord = Pick<CrmRecord, 'id' | 'data'> &
  Partial<Pick<CrmRecord, 'email' | 'org_id'>>;

function normalizeModuleKey(moduleKey: string): string {
  return (moduleKey || '').trim().toLowerCase();
}

export { isPersonModuleKey };

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

/** Trim + lowercase for same-email sibling matching. Empty → null (skip lookup). */
export function normalizeEmailForNoteAggregate(
  value: string | null | undefined,
): string | null {
  const t = (value ?? '').trim().toLowerCase();
  return t.length > 0 ? t : null;
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
 * Members-module twins often use a portal/hushmail primary email while Zoho notes
 * live on a contacts row under a different email. Pull those contacts in when
 * `member_number` matches (same org, contacts module only).
 */
export async function addSameMemberNumberContactSiblings(
  supabase: SupabaseClient,
  orgId: string | null | undefined,
  memberNumber: string | null | undefined,
  excludeId: string,
  into: Set<string>,
): Promise<void> {
  const org = parseUuidLoose(orgId);
  const exclude = parseUuidLoose(excludeId);
  const number = (memberNumber ?? '').trim();
  if (!org || !exclude || !number) return;

  const { data: siblings, error } = await supabase
    .from('crm_records')
    .select('id, crm_modules!inner(key)')
    .eq('org_id', org)
    .eq('data->>member_number', number)
    .eq('crm_modules.key', 'contacts')
    .is('deleted_at' as never, null)
    .neq('id', exclude);

  if (error || !siblings?.length) return;

  for (const row of siblings) {
    const joined = (row as { crm_modules?: unknown }).crm_modules;
    if (normalizeModuleKey(moduleKeyFromJoinedRelation(joined)) !== 'contacts') {
      continue;
    }
    const id = parseUuidLoose(row.id);
    if (id) into.add(id);
  }
}

function emailsFromPersonRecord(record: NoteAggregateRecord): string[] {
  const data = (record.data || {}) as Record<string, unknown>;
  const candidates = [
    record.email,
    typeof data.email === 'string' ? data.email : null,
    typeof data.email2 === 'string' ? data.email2 : null,
    typeof data.secondary_email === 'string' ? data.secondary_email : null,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of candidates) {
    const normalized = normalizeEmailForNoteAggregate(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
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

/**
 * Adds other **contacts** in the same org that share a normalized email.
 * Guards: contacts module only, non-empty email, org-scoped, exclude soft-deleted
 * and the current record. Does not cross tenants.
 */
export async function addSameEmailContactSiblings(
  supabase: SupabaseClient,
  orgId: string | null | undefined,
  email: string | null | undefined,
  excludeId: string,
  into: Set<string>,
): Promise<void> {
  const normalized = normalizeEmailForNoteAggregate(email);
  const org = parseUuidLoose(orgId);
  const exclude = parseUuidLoose(excludeId);
  if (!normalized || !org || !exclude) return;

  const { data: siblings, error } = await supabase
    .from('crm_records')
    .select('id, crm_modules!inner(key)')
    .eq('org_id', org)
    .ilike('email', normalized)
    .eq('crm_modules.key', 'contacts')
    .is('deleted_at' as never, null)
    .neq('id', exclude);

  if (error || !siblings?.length) return;

  for (const row of siblings) {
    // Defense in depth: only accept rows whose joined module is contacts.
    const joined = (row as { crm_modules?: unknown }).crm_modules;
    if (normalizeModuleKey(moduleKeyFromJoinedRelation(joined)) !== 'contacts') {
      continue;
    }
    const id = parseUuidLoose(row.id);
    if (id) into.add(id);
  }
}

async function resolvePersonNoteSources(
  supabase: SupabaseClient,
  record: NoteAggregateRecord,
  moduleKey: string,
): Promise<string[]> {
  const root = parseUuidLoose(record.id);
  if (!root) return [];

  const ids = new Set<string>([root]);
  applyZohoPersonLineageFromData(ids, record.data as Record<string, unknown> | undefined);
  await addLeadContactNeighborhood(supabase, [root], ids);

  const mk = normalizeModuleKey(moduleKey);

  // Same-email Zoho duplicate contacts — contacts module.
  if (mk === 'contacts') {
    await addSameEmailContactSiblings(
      supabase,
      record.org_id,
      record.email,
      root,
      ids,
    );
  }

  // Members twins: also pull contact notes via alternate emails + member_number.
  // Enrollment sync often creates a hushmail/portal primary while Zoho history
  // stays on the gmail (or other) contacts row.
  if (mk === 'members') {
    for (const email of emailsFromPersonRecord(record)) {
      await addSameEmailContactSiblings(
        supabase,
        record.org_id,
        email,
        root,
        ids,
      );
    }
    const data = (record.data || {}) as Record<string, unknown>;
    const memberNumber =
      typeof data.member_number === 'string' ? data.member_number : null;
    await addSameMemberNumberContactSiblings(
      supabase,
      record.org_id,
      memberNumber,
      root,
      ids,
    );
    await addRicherContactTwin(supabase, record, ids);
  }

  return [...ids];
}

/**
 * Members twins often have a blank `data.email` and a Contacts row that holds
 * the Zoho note history. Reuse the same identity match as field overlay so
 * notes follow the richer Contact even when the module-join sibling queries
 * miss (org_id vs organization_id, missing JSONB email, etc.).
 */
export async function addRicherContactTwin(
  supabase: SupabaseClient,
  record: NoteAggregateRecord,
  into: Set<string>,
): Promise<void> {
  const org = parseUuidLoose(record.org_id);
  const exclude = parseUuidLoose(record.id);
  const lookup = buildTwinLookup({
    id: record.id,
    email: record.email,
    data: record.data,
  });
  if (!org || !exclude || !lookup) return;

  const columns = 'id, email, phone, data';
  const byId = new Map<string, MemberCrmRecordCandidate>();

  const ingest = (rows: MemberCrmRecordCandidate[] | null | undefined) => {
    for (const row of rows ?? []) {
      if (row?.id) byId.set(row.id, row);
    }
  };

  if (lookup.email) {
    const { data, error } = await supabase
      .from('crm_records')
      .select(columns)
      .eq('org_id', org)
      .is('deleted_at' as never, null)
      .neq('id', exclude)
      .ilike('email', lookup.email)
      .limit(20);
    if (!error) ingest(data as MemberCrmRecordCandidate[] | null);
  }
  if (lookup.member_number) {
    const { data, error } = await supabase
      .from('crm_records')
      .select(columns)
      .eq('org_id', org)
      .is('deleted_at' as never, null)
      .neq('id', exclude)
      .eq('data->>member_number', lookup.member_number)
      .limit(20);
    if (!error) ingest(data as MemberCrmRecordCandidate[] | null);
  }

  const twin = pickRicherTwin(
    { id: record.id, email: record.email, data: record.data },
    [...byId.values()],
  );
  const id = parseUuidLoose(twin?.id);
  if (id) into.add(id);
}

async function resolveDealNoteSources(
  supabase: SupabaseClient,
  record: NoteAggregateRecord,
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
  record: NoteAggregateRecord,
  moduleKey: string,
): Promise<string[]> {
  if (!parseUuidLoose(record.id)) return [];

  const mk = normalizeModuleKey(moduleKey);

  if (isPersonModuleKey(mk)) {
    return resolvePersonNoteSources(supabase, record, mk);
  }

  if (isDealModuleKey(mk)) {
    return resolveDealNoteSources(supabase, record);
  }

  return [record.id];
}
