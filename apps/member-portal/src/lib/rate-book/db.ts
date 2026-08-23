import {
  DEFAULT_BOOK_NAME,
  MAX_BOOKS_PER_MEMBER,
  MAX_CLIPS_PER_BOOK,
} from '@crm-eco/cash-pay';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import type { RateBookRecord, RateClipRecord, ClipInput } from './types';

type Client = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export async function listBooks(
  supabase: Client,
  memberId: string,
  organizationId: string,
): Promise<RateBookRecord[]> {
  const { data, error } = await supabase
    .from('rate_books')
    .select('id, organization_id, member_id, name, is_default, created_at, updated_at')
    .eq('member_id', memberId)
    .eq('organization_id', organizationId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RateBookRecord[];
}

export async function getOwnedBook(
  supabase: Client,
  bookId: string,
  memberId: string,
  organizationId: string,
): Promise<RateBookRecord | null> {
  const { data, error } = await supabase
    .from('rate_books')
    .select('id, organization_id, member_id, name, is_default, created_at, updated_at')
    .eq('id', bookId)
    .eq('member_id', memberId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw error;
  return (data as RateBookRecord | null) ?? null;
}

export async function ensureDefaultBook(
  supabase: Client,
  memberId: string,
  organizationId: string,
): Promise<RateBookRecord> {
  const { data: existing, error: findError } = await supabase
    .from('rate_books')
    .select('id, organization_id, member_id, name, is_default, created_at, updated_at')
    .eq('member_id', memberId)
    .eq('organization_id', organizationId)
    .eq('is_default', true)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing as RateBookRecord;

  const { data, error } = await supabase
    .from('rate_books')
    .insert({
      organization_id: organizationId,
      member_id: memberId,
      name: DEFAULT_BOOK_NAME,
      is_default: true,
    })
    .select('id, organization_id, member_id, name, is_default, created_at, updated_at')
    .single();

  if (error?.code === '23505') {
    const { data: raced } = await supabase
      .from('rate_books')
      .select('id, organization_id, member_id, name, is_default, created_at, updated_at')
      .eq('member_id', memberId)
      .eq('organization_id', organizationId)
      .eq('is_default', true)
      .maybeSingle();
    if (raced) return raced as RateBookRecord;
  }
  if (error) throw error;
  return data as RateBookRecord;
}

export async function countBooks(
  supabase: Client,
  memberId: string,
  organizationId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('rate_books')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .eq('organization_id', organizationId);
  if (error) throw error;
  return count ?? 0;
}

export async function countClips(
  supabase: Client,
  bookId: string,
  memberId: string,
  organizationId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('rate_clips')
    .select('id', { count: 'exact', head: true })
    .eq('rate_book_id', bookId)
    .eq('member_id', memberId)
    .eq('organization_id', organizationId);
  if (error) throw error;
  return count ?? 0;
}

export async function listClips(
  supabase: Client,
  bookId: string,
  memberId: string,
  organizationId: string,
): Promise<RateClipRecord[]> {
  const { data, error } = await supabase
    .from('rate_clips')
    .select('*')
    .eq('rate_book_id', bookId)
    .eq('member_id', memberId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(MAX_CLIPS_PER_BOOK);
  if (error) throw error;
  return (data ?? []) as RateClipRecord[];
}

export async function insertClip(
  supabase: Client,
  memberId: string,
  organizationId: string,
  book: RateBookRecord,
  input: ClipInput,
): Promise<{ clip: RateClipRecord; deduplicated: boolean }> {
  const payload = {
    organization_id: organizationId,
    member_id: memberId,
    rate_book_id: book.id,
    hcl_rate_id: String(input.id),
    hospital_id: input.hospitalId ?? null,
    facility_name: input.facilityName,
    city: input.city ?? null,
    state: input.state ?? null,
    procedure_code: input.procedureCode,
    code_description: input.codeDescription ?? null,
    category: input.category ?? null,
    rate: input.rate,
    payment_method: input.paymentMethod ?? null,
    cms_relativity: input.cmsRelativity ?? null,
    query_state_name: input.queryStateName ?? null,
    query_msa_name: input.queryMsaName ?? null,
    query_specialty: input.querySpecialty ?? null,
    slice_high: input.sliceHigh ?? null,
    slice_median: input.sliceMedian ?? null,
    file_size: input.fileSize ?? null,
    clipped_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('rate_clips')
    .insert(payload)
    .select('*')
    .single();

  if (error?.code === '23505') {
    let existing = supabase
      .from('rate_clips')
      .select('*')
      .eq('rate_book_id', book.id)
      .eq('member_id', memberId)
      .eq('hcl_rate_id', String(input.id))
      .eq('procedure_code', input.procedureCode);
    existing =
      input.hospitalId == null
        ? existing.is('hospital_id', null)
        : existing.eq('hospital_id', input.hospitalId);
    const { data: row } = await existing.maybeSingle();
    if (row) return { clip: row as RateClipRecord, deduplicated: true };
  }
  if (error) throw error;
  return { clip: data as RateClipRecord, deduplicated: false };
}

export async function deleteOwnedClip(
  supabase: Client,
  clipId: string,
  memberId: string,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('rate_clips')
    .delete()
    .eq('id', clipId)
    .eq('member_id', memberId)
    .eq('organization_id', organizationId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export { MAX_BOOKS_PER_MEMBER, MAX_CLIPS_PER_BOOK };
