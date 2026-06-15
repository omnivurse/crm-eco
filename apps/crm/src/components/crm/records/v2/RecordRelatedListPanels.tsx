'use client';

import Link from 'next/link';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  RecordRelatedListDataPanel,
  formatDate,
  formatMoney,
} from './RecordRelatedListDataPanel';
import type {
  RecordCampaignRow,
  RecordCadenceRow,
  RecordMeetingRow,
  RecordVisitRow,
  RecordSocialRow,
  RecordProductRow,
} from '@/lib/crm/record-related-lists';

interface PanelProps {
  recordId: string;
  className?: string;
}

export function RecordCampaignsPanel({ recordId, className }: PanelProps) {
  return (
    <RecordRelatedListDataPanel<RecordCampaignRow>
      recordId={recordId}
      kind="campaigns"
      title="Campaigns"
      emptyTitle="No campaigns"
      emptyHint="When this record is included in an email campaign, sends and engagement will show here."
      viewAllHref="/crm/campaigns"
      className={className}
      columns={[
        {
          key: 'campaign_name',
          label: 'Campaign',
          render: (row) => (
            <Link
              href={`/crm/campaigns?highlight=${row.campaign_id}`}
              className="text-teal-600 dark:text-teal-400 hover:underline"
            >
              {row.campaign_name}
            </Link>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <Badge variant="outline" className="text-[10px] capitalize">
              {row.status}
            </Badge>
          ),
        },
        { key: 'sent_at', label: 'Sent', render: (row) => formatDate(row.sent_at) },
        { key: 'opened_at', label: 'Opened', render: (row) => formatDate(row.opened_at) },
        { key: 'clicked_at', label: 'Clicked', render: (row) => formatDate(row.clicked_at) },
      ]}
    />
  );
}

export function RecordCadencesPanel({ recordId, className }: PanelProps) {
  return (
    <RecordRelatedListDataPanel<RecordCadenceRow>
      recordId={recordId}
      kind="cadences"
      title="Cadences"
      emptyTitle="No cadence enrollments"
      emptyHint="Enroll this record in a cadence from Automations to see step progress here."
      viewAllHref="/crm/settings/automations"
      className={className}
      columns={[
        { key: 'cadence_name', label: 'Cadence' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <Badge variant="outline" className="text-[10px] capitalize">
              {row.status}
            </Badge>
          ),
        },
        { key: 'current_step', label: 'Step' },
        { key: 'next_step_at', label: 'Next step', render: (row) => formatDate(row.next_step_at) },
        { key: 'created_at', label: 'Enrolled', render: (row) => formatDate(row.created_at) },
      ]}
    />
  );
}

export function RecordMeetingsPanel({
  recordId,
  recordEmail,
  className,
}: PanelProps & { recordEmail?: string | null }) {
  return (
    <RecordRelatedListDataPanel<RecordMeetingRow>
      recordId={recordId}
      kind="meetings"
      title="Invited Meetings"
      emptyTitle="No meetings"
      emptyHint="Scheduled meetings, calendar events, and booking links for this contact will appear here."
      viewAllHref="/crm/calendar"
      queryParams={recordEmail ? { email: recordEmail } : undefined}
      className={className}
      columns={[
        { key: 'title', label: 'Meeting' },
        {
          key: 'source',
          label: 'Source',
          render: (row) => (
            <Badge variant="outline" className="text-[10px] capitalize">
              {row.source}
            </Badge>
          ),
        },
        { key: 'start_time', label: 'Starts', render: (row) => formatDate(row.start_time) },
        { key: 'status', label: 'Status' },
        {
          key: 'meeting_url',
          label: 'Join',
          render: (row) =>
            row.meeting_url ? (
              <a
                href={row.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-600 dark:text-teal-400 hover:underline text-xs"
              >
                Open
              </a>
            ) : (
              '—'
            ),
        },
      ]}
    />
  );
}

export function RecordVisitsPanel({ recordId, className }: PanelProps) {
  return (
    <RecordRelatedListDataPanel<RecordVisitRow>
      recordId={recordId}
      kind="visits"
      title="Visits"
      emptyTitle="No portal visits"
      emptyHint="Web and portal sessions tied to this record will show browser, OS, and page activity."
      className={className}
      columns={[
        { key: 'started_at', label: 'Started', render: (row) => formatDate(row.started_at) },
        { key: 'duration_seconds', label: 'Duration (s)' },
        { key: 'browser', label: 'Browser' },
        { key: 'operating_system', label: 'OS' },
        { key: 'first_page', label: 'Landing page' },
        { key: 'page_count', label: 'Pages' },
      ]}
    />
  );
}

export function RecordSocialPanel({ recordId, className }: PanelProps) {
  return (
    <RecordRelatedListDataPanel<RecordSocialRow>
      recordId={recordId}
      kind="social"
      title="Social"
      emptyTitle="No social conversations"
      emptyHint="Social inbox threads linked to this record will appear here."
      viewAllHref="/crm/inbox"
      className={className}
      columns={[
        { key: 'subject', label: 'Subject', render: (row) => row.subject || row.preview || 'Conversation' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <Badge variant="outline" className="text-[10px] capitalize">
              {row.status}
            </Badge>
          ),
        },
        { key: 'message_count', label: 'Messages' },
        { key: 'last_message_at', label: 'Last message', render: (row) => formatDate(row.last_message_at) },
      ]}
    />
  );
}

export function RecordProductsPanel({ recordId, className }: PanelProps) {
  return (
    <RecordRelatedListDataPanel<RecordProductRow>
      recordId={recordId}
      kind="products"
      title="Products"
      emptyTitle="No products"
      emptyHint="Quote line items and linked product records for this contact or deal will show here."
      viewAllHref="/crm/quotes"
      className={className}
      columns={[
        { key: 'name', label: 'Product' },
        {
          key: 'source',
          label: 'Source',
          render: (row) => (
            <Badge variant="outline" className="text-[10px] capitalize">
              {row.source}
            </Badge>
          ),
        },
        { key: 'quantity', label: 'Qty' },
        { key: 'unit_price', label: 'Unit', render: (row) => formatMoney(row.unit_price) },
        { key: 'total', label: 'Total', render: (row) => formatMoney(row.total) },
        { key: 'quote_number', label: 'Quote #' },
      ]}
    />
  );
}
