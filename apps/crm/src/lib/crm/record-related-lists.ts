/**
 * Record-scoped related-list queries for the V2 detail shell.
 * Each helper degrades gracefully when optional tables are absent.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

type Client = SupabaseClient;

export interface RecordCampaignRow {
  id: string;
  campaign_id: string;
  campaign_name: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
}

export interface RecordCadenceRow {
  id: string;
  cadence_id: string;
  cadence_name: string;
  status: string;
  current_step: number;
  next_step_at: string | null;
  created_at: string;
}

export interface RecordMeetingRow {
  id: string;
  source: 'task' | 'calendar' | 'booking';
  title: string;
  start_time: string;
  end_time: string | null;
  status: string | null;
  meeting_url: string | null;
}

export interface RecordVisitRow {
  id: string;
  started_at: string;
  duration_seconds: number;
  browser: string | null;
  operating_system: string | null;
  first_page: string | null;
  page_count: number;
}

export interface RecordSocialRow {
  id: string;
  channel: string;
  subject: string | null;
  preview: string | null;
  status: string;
  last_message_at: string;
  message_count: number;
}

export interface RecordProductRow {
  id: string;
  source: 'quote' | 'link';
  name: string;
  quantity: number | null;
  unit_price: number | null;
  total: number | null;
  quote_number: string | null;
  quote_status: string | null;
}

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

function unwrapJoined<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function fetchRecordCampaigns(
  supabase: Client,
  recordId: string,
): Promise<RecordCampaignRow[]> {
  const { data, error } = await supabase
    .from('email_campaign_recipients')
    .select(
      `
      id,
      campaign_id,
      status,
      sent_at,
      opened_at,
      clicked_at,
      campaign:email_campaigns!inner(id, name)
    `,
    )
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }

  return (data ?? []).map((row) => {
    const campaign = unwrapJoined(row.campaign as { id: string; name: string } | { id: string; name: string }[] | null);
    return {
      id: row.id as string,
      campaign_id: row.campaign_id as string,
      campaign_name: campaign?.name ?? 'Campaign',
      status: row.status as string,
      sent_at: (row.sent_at as string | null) ?? null,
      opened_at: (row.opened_at as string | null) ?? null,
      clicked_at: (row.clicked_at as string | null) ?? null,
    };
  });
}

export async function countRecordCampaigns(
  supabase: Client,
  recordId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('email_campaign_recipients')
    .select('*', { count: 'exact', head: true })
    .eq('record_id', recordId);
  if (error) {
    if (isMissingTable(error)) return 0;
    return 0;
  }
  return count ?? 0;
}

export async function fetchRecordCadences(
  supabase: Client,
  recordId: string,
): Promise<RecordCadenceRow[]> {
  const { data, error } = await supabase
    .from('crm_cadence_enrollments')
    .select(
      `
      id,
      cadence_id,
      status,
      current_step,
      next_step_at,
      created_at,
      cadence:crm_cadences!inner(id, name)
    `,
    )
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }

  return (data ?? []).map((row) => {
    const cadence = unwrapJoined(row.cadence as { id: string; name: string } | { id: string; name: string }[] | null);
    return {
      id: row.id as string,
      cadence_id: row.cadence_id as string,
      cadence_name: cadence?.name ?? 'Cadence',
      status: row.status as string,
      current_step: (row.current_step as number) ?? 0,
      next_step_at: (row.next_step_at as string | null) ?? null,
      created_at: row.created_at as string,
    };
  });
}

export async function countRecordCadences(
  supabase: Client,
  recordId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('crm_cadence_enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('record_id', recordId);
  if (error) {
    if (isMissingTable(error)) return 0;
    return 0;
  }
  return count ?? 0;
}

export async function fetchRecordMeetings(
  supabase: Client,
  recordId: string,
  inviteeEmail?: string | null,
): Promise<RecordMeetingRow[]> {
  const rows: RecordMeetingRow[] = [];

  const { data: tasks, error: taskError } = await supabase
    .from('crm_tasks')
    .select('id, title, due_at, status, completed_at')
    .eq('record_id', recordId)
    .eq('activity_type', 'meeting')
    .is('deleted_at' as never, null)
    .order('due_at', { ascending: false })
    .limit(50);

  if (!taskError && tasks?.length) {
    for (const task of tasks) {
      const dueAt = task.due_at as string | null;
      if (!dueAt) continue;
      rows.push({
        id: `task-${task.id}`,
        source: 'task',
        title: (task.title as string) || 'Meeting',
        start_time: dueAt,
        end_time: null,
        status: (task.status as string) ?? null,
        meeting_url: null,
      });
    }
  }

  const { data: calendarEvents, error: calError } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, end_time, status, meeting_url')
    .or(`linked_contact_id.eq.${recordId},linked_deal_id.eq.${recordId}`)
    .order('start_time', { ascending: false })
    .limit(50);

  if (!calError && calendarEvents?.length) {
    for (const ev of calendarEvents) {
      rows.push({
        id: `cal-${ev.id}`,
        source: 'calendar',
        title: (ev.title as string) || 'Calendar event',
        start_time: ev.start_time as string,
        end_time: (ev.end_time as string | null) ?? null,
        status: (ev.status as string) ?? null,
        meeting_url: (ev.meeting_url as string | null) ?? null,
      });
    }
  }

  const normalizedEmail = inviteeEmail?.trim().toLowerCase();
  if (normalizedEmail) {
    const { data: bookings, error: bookingError } = await supabase
      .from('scheduling_bookings')
      .select('id, invitee_name, start_time, end_time, status, meeting_type')
      .ilike('invitee_email', normalizedEmail)
      .order('start_time', { ascending: false })
      .limit(50);

    if (!bookingError && bookings?.length) {
      for (const booking of bookings) {
        rows.push({
          id: `book-${booking.id}`,
          source: 'booking',
          title: `${(booking.invitee_name as string) || 'Invitee'} — ${(booking.meeting_type as string) || 'meeting'}`,
          start_time: booking.start_time as string,
          end_time: (booking.end_time as string | null) ?? null,
          status: (booking.status as string) ?? null,
          meeting_url: null,
        });
      }
    }
  }

  rows.sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
  );
  return rows.slice(0, 100);
}

export async function countRecordMeetings(
  supabase: Client,
  recordId: string,
  inviteeEmail?: string | null,
): Promise<number> {
  const meetings = await fetchRecordMeetings(supabase, recordId, inviteeEmail);
  return meetings.length;
}

export async function fetchRecordVisits(
  supabase: Client,
  recordId: string,
): Promise<RecordVisitRow[]> {
  const { data, error } = await supabase
    .from('crm_visitor_sessions')
    .select('id, started_at, duration_seconds, browser, operating_system, first_page, page_count')
    .eq('record_id', recordId)
    .order('started_at', { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    started_at: row.started_at as string,
    duration_seconds: (row.duration_seconds as number) ?? 0,
    browser: (row.browser as string | null) ?? null,
    operating_system: (row.operating_system as string | null) ?? null,
    first_page: (row.first_page as string | null) ?? null,
    page_count: (row.page_count as number) ?? 0,
  }));
}

export async function countRecordVisits(
  supabase: Client,
  recordId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('crm_visitor_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('record_id', recordId);
  if (error) {
    if (isMissingTable(error)) return 0;
    return 0;
  }
  return count ?? 0;
}

export async function fetchRecordSocial(
  supabase: Client,
  recordId: string,
): Promise<RecordSocialRow[]> {
  const { data, error } = await supabase
    .from('inbox_conversations')
    .select('id, channel, subject, preview, status, last_message_at, message_count')
    .eq('channel', 'social')
    .or(
      [
        `contact_id.eq.${recordId}`,
        `linked_lead_id.eq.${recordId}`,
        `linked_deal_id.eq.${recordId}`,
        `linked_account_id.eq.${recordId}`,
      ].join(','),
    )
    .order('last_message_at', { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    channel: row.channel as string,
    subject: (row.subject as string | null) ?? null,
    preview: (row.preview as string | null) ?? null,
    status: row.status as string,
    last_message_at: row.last_message_at as string,
    message_count: (row.message_count as number) ?? 0,
  }));
}

export async function countRecordSocial(
  supabase: Client,
  recordId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('inbox_conversations')
    .select('*', { count: 'exact', head: true })
    .eq('channel', 'social')
    .or(
      [
        `contact_id.eq.${recordId}`,
        `linked_lead_id.eq.${recordId}`,
        `linked_deal_id.eq.${recordId}`,
        `linked_account_id.eq.${recordId}`,
      ].join(','),
    );
  if (error) {
    if (isMissingTable(error)) return 0;
    return 0;
  }
  return count ?? 0;
}

export async function fetchRecordProducts(
  supabase: Client,
  recordId: string,
): Promise<RecordProductRow[]> {
  const rows: RecordProductRow[] = [];

  const { data: quotes, error: quoteError } = await supabase
    .from('quotes')
    .select('id, quote_number, status')
    .or(`contact_id.eq.${recordId},deal_id.eq.${recordId}`)
    .order('created_at', { ascending: false })
    .limit(25);

  if (!quoteError && quotes?.length) {
    const quoteIds = quotes.map((q) => q.id as string);
    const quoteById = new Map(
      quotes.map((q) => [
        q.id as string,
        { quote_number: q.quote_number as string, status: q.status as string },
      ]),
    );

    const { data: lineItems, error: lineError } = await supabase
      .from('quote_line_items')
      .select('id, quote_id, name, quantity, unit_price, total, product_id')
      .in('quote_id', quoteIds)
      .order('sort_order', { ascending: true });

    if (!lineError && lineItems?.length) {
      for (const item of lineItems) {
        const quote = quoteById.get(item.quote_id as string);
        rows.push({
          id: `quote-item-${item.id}`,
          source: 'quote',
          name: (item.name as string) || 'Line item',
          quantity: (item.quantity as number | null) ?? null,
          unit_price: (item.unit_price as number | null) ?? null,
          total: (item.total as number | null) ?? null,
          quote_number: quote?.quote_number ?? null,
          quote_status: quote?.status ?? null,
        });
      }
    }
  }

  const { data: outLinks, error: outError } = await supabase
    .from('crm_record_links')
    .select(
      `
      id,
      link_type,
      target:crm_records!crm_record_links_target_record_id_fkey(
        id,
        title,
        module:crm_modules!crm_records_module_id_fkey(key)
      )
    `,
    )
    .eq('source_record_id', recordId)
    .ilike('link_type', '%product%')
    .limit(50);

  if (!outError && outLinks?.length) {
    for (const link of outLinks) {
      const target = unwrapJoined(
        link.target as
          | {
              id: string;
              title: string | null;
              module: { key: string } | { key: string }[] | null;
            }
          | Array<{
              id: string;
              title: string | null;
              module: { key: string } | { key: string }[] | null;
            }>
          | null,
      );
      const moduleKey = unwrapJoined(target?.module ?? null)?.key;
      if (moduleKey && moduleKey !== 'products') continue;
      rows.push({
        id: `link-${link.id}`,
        source: 'link',
        name: target?.title ?? 'Linked product',
        quantity: null,
        unit_price: null,
        total: null,
        quote_number: null,
        quote_status: (link.link_type as string) ?? null,
      });
    }
  }

  const { data: inLinks, error: inError } = await supabase
    .from('crm_record_links')
    .select(
      `
      id,
      link_type,
      source:crm_records!crm_record_links_source_record_id_fkey(
        id,
        title,
        module:crm_modules!crm_records_module_id_fkey(key)
      )
    `,
    )
    .eq('target_record_id', recordId)
    .ilike('link_type', '%product%')
    .limit(50);

  if (!inError && inLinks?.length) {
    for (const link of inLinks) {
      const source = unwrapJoined(
        link.source as
          | {
              id: string;
              title: string | null;
              module: { key: string } | { key: string }[] | null;
            }
          | Array<{
              id: string;
              title: string | null;
              module: { key: string } | { key: string }[] | null;
            }>
          | null,
      );
      const moduleKey = unwrapJoined(source?.module ?? null)?.key;
      if (moduleKey && moduleKey !== 'products') continue;
      rows.push({
        id: `link-in-${link.id}`,
        source: 'link',
        name: source?.title ?? 'Linked product',
        quantity: null,
        unit_price: null,
        total: null,
        quote_number: null,
        quote_status: (link.link_type as string) ?? null,
      });
    }
  }

  return rows;
}

export async function countRecordProducts(
  supabase: Client,
  recordId: string,
): Promise<number> {
  const products = await fetchRecordProducts(supabase, recordId);
  return products.length;
}

export type RelatedListKind =
  | 'campaigns'
  | 'cadences'
  | 'meetings'
  | 'visits'
  | 'social'
  | 'products';

export const RELATED_LIST_KINDS: RelatedListKind[] = [
  'campaigns',
  'cadences',
  'meetings',
  'visits',
  'social',
  'products',
];

export function isRelatedListKind(value: string): value is RelatedListKind {
  return (RELATED_LIST_KINDS as string[]).includes(value);
}
