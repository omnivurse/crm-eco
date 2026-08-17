import type { SupabaseClient } from '@supabase/supabase-js';
import {
  pickBestMemberCrmRecord,
  type MemberCrmLookupInput,
  type MemberCrmRecordCandidate,
} from '@/lib/crm/resolve-member-crm-record';

const CANDIDATE_SELECT =
  'id, email, phone, source_record_id, market_type, updated_at, data, crm_modules!inner(key)';

/** Keep PostgREST filter URLs well under gateway limits. */
const LOOKUP_CHUNK_SIZE = 80;

type RecordRow = {
  id: string;
  email: string | null;
  phone: string | null;
  source_record_id: string | null;
  market_type: string | null;
  updated_at: string | null;
  data: Record<string, unknown> | null;
  crm_modules: { key: string } | { key: string }[] | null;
};

/** PostgREST filter builder after `.select()` — keep loose so call sites stay simple. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CrmRecordsFilterQuery = any;

function toCandidate(row: RecordRow): MemberCrmRecordCandidate {
  const modules = Array.isArray(row.crm_modules)
    ? row.crm_modules
    : row.crm_modules
      ? [row.crm_modules]
      : [];
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    source_record_id: row.source_record_id,
    market_type: row.market_type,
    updated_at: row.updated_at,
    data: row.data,
    module_key: modules[0]?.key ?? null,
  };
}

function dedupeCandidates(rows: RecordRow[]): MemberCrmRecordCandidate[] {
  const byId = new Map<string, MemberCrmRecordCandidate>();
  for (const row of rows) {
    byId.set(row.id, toCandidate(row));
  }
  return Array.from(byId.values());
}

function chunkValues<T>(values: T[], size = LOOKUP_CHUNK_SIZE): T[][] {
  if (values.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

async function fetchContactModuleCandidates(
  supabase: SupabaseClient,
  orgId: string,
  applyFilters: (query: CrmRecordsFilterQuery) => CrmRecordsFilterQuery,
): Promise<RecordRow[]> {
  const base = supabase
    .from('crm_records')
    .select(CANDIDATE_SELECT)
    .eq('organization_id', orgId)
    .is('deleted_at' as never, null)
    .in('crm_modules.key', ['contacts', 'members']);

  const { data, error } = await applyFilters(base);
  if (error) {
    console.error('[resolveMemberCrmRecord] candidate query failed:', error.message);
    return [];
  }
  return (data ?? []) as RecordRow[];
}

async function fetchCandidatesByColumnIn(
  supabase: SupabaseClient,
  orgId: string,
  column: string,
  values: string[],
): Promise<RecordRow[]> {
  if (values.length === 0) return [];
  const batches = await Promise.all(
    chunkValues(values).map((group) =>
      fetchContactModuleCandidates(supabase, orgId, (query) => query.in(column, group)),
    ),
  );
  return batches.flat();
}

async function fetchCandidatesByEmailIlike(
  supabase: SupabaseClient,
  orgId: string,
  emails: string[],
): Promise<RecordRow[]> {
  if (emails.length === 0) return [];
  const batches = await Promise.all(
    chunkValues(emails).map((group) =>
      fetchContactModuleCandidates(supabase, orgId, (query) =>
        query.or(group.map((email) => `email.ilike.${escapeIlikeExact(email)}`).join(',')),
      ),
    ),
  );
  return batches.flat();
}

/** Collect alternate emails stored on already-fetched twins (email2 / secondary). */
function alternateEmailsFromRows(rows: RecordRow[], exclude: Set<string>): string[] {
  const out: string[] = [];
  const seen = new Set(exclude);
  for (const row of rows) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};
    for (const key of ['email2', 'secondary_email', 'email'] as const) {
      const raw = data[key];
      if (typeof raw !== 'string') continue;
      const normalized = raw.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
    const indexed = (row.email ?? '').trim().toLowerCase();
    if (indexed && !seen.has(indexed)) {
      seen.add(indexed);
      out.push(indexed);
    }
  }
  return out;
}

/**
 * Enrollment twins often store the Zoho/work email as `email2` while billing
 * `members.email` is a portal address. Expand the candidate set using those
 * alternate emails so pickBest can prefer the rich Zoho contact.
 */
async function expandCandidatesViaAlternateEmails(
  supabase: SupabaseClient,
  orgId: string,
  seedRows: RecordRow[],
  knownEmails: Set<string>,
): Promise<RecordRow[]> {
  const alternates = alternateEmailsFromRows(seedRows, knownEmails);
  if (alternates.length === 0) return [];

  const [byEmail, bySecondary, byEmail2] = await Promise.all([
    fetchCandidatesByEmailIlike(supabase, orgId, alternates),
    fetchCandidatesByColumnIn(supabase, orgId, 'data->>secondary_email', alternates),
    fetchCandidatesByColumnIn(supabase, orgId, 'data->>email2', alternates),
  ]);
  return [...byEmail, ...bySecondary, ...byEmail2];
}

/** Resolve the best CRM record for one enrollment member using targeted lookups. */
export async function resolveMemberCrmRecordId(
  supabase: SupabaseClient,
  orgId: string,
  member: MemberCrmLookupInput,
): Promise<string | null> {
  const resolved = await resolveMemberCrmRecordIds(supabase, orgId, [member]);
  return resolved.get(member.id) ?? null;
}

/** Batch-resolve CRM record ids for many members (members list API). */
export async function resolveMemberCrmRecordIds(
  supabase: SupabaseClient,
  orgId: string,
  members: MemberCrmLookupInput[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (members.length === 0) return out;

  const memberIds = members.map((m) => m.id);
  const memberNumbers = Array.from(
    new Set(members.map((m) => m.member_number?.trim()).filter((v): v is string => !!v)),
  );
  const emails = Array.from(
    new Set(members.map((m) => m.email?.trim().toLowerCase()).filter((v): v is string => !!v)),
  );

  const [linkedRows, numberRows, emailRows, secondaryRows, email2Rows] = await Promise.all([
    fetchCandidatesByColumnIn(supabase, orgId, 'data->>linked_member_id', memberIds),
    fetchCandidatesByColumnIn(supabase, orgId, 'data->>member_number', memberNumbers),
    fetchCandidatesByEmailIlike(supabase, orgId, emails),
    fetchCandidatesByColumnIn(supabase, orgId, 'data->>secondary_email', emails),
    fetchCandidatesByColumnIn(supabase, orgId, 'data->>email2', emails),
  ]);

  const rows: RecordRow[] = [
    ...linkedRows,
    ...numberRows,
    ...emailRows,
    ...secondaryRows,
    ...email2Rows,
  ];

  rows.push(
    ...(await expandCandidatesViaAlternateEmails(
      supabase,
      orgId,
      rows,
      new Set(emails),
    )),
  );

  const candidates = dedupeCandidates(rows);
  for (const member of members) {
    const best = pickBestMemberCrmRecord(member, candidates);
    if (best?.id) out.set(member.id, best.id);
  }

  return out;
}

function escapeIlikeExact(value: string): string {
  return value
    .replace(/[\\%_]/g, '\\$&')
    .replace(/[\r\n,()]/g, '');
}
