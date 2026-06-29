/**
 * Client-side "find in record" helpers — shared by InlineRecordSearch and
 * the global CommandPalette when the user is on a record detail page.
 */

import type { CrmField, CrmRecord } from '@/lib/crm/types';

export type RecordFieldNavigateTarget =
  | { type: 'field'; fieldKey: string }
  | { type: 'notes' };

export interface RecordFieldSearchHit {
  id: string;
  navigate: RecordFieldNavigateTarget;
  label: string;
  snippet: string;
}

function stringifyValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (Array.isArray(val)) return val.map(stringifyValue).filter(Boolean).join(', ');
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return '';
    }
  }
  return String(val);
}

/** Core columns mirrored on CrmRecord; custom fields usually live under `data` only */
export function recordValueFor(record: CrmRecord, key: string): unknown {
  switch (key) {
    case 'title':
      return record.title;
    case 'email':
      return record.email;
    case 'phone':
      return record.phone;
    case 'status':
      return record.status;
    case 'stage':
      return record.stage;
    default:
      return record.data?.[key];
  }
}

function snippetAround(text: string, queryLower: string, maxLen = 96): string {
  const raw = text.trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const lower = raw.toLowerCase();
  let i = lower.indexOf(queryLower);
  if (i === -1) i = 0;
  const half = Math.floor((maxLen - queryLower.length) / 2);
  const start = Math.max(0, i - Math.max(half, 0));
  const slice = raw.slice(start, start + maxLen);
  const prefix = start > 0 ? '…' : '';
  const suffix = start + maxLen < raw.length ? '…' : '';
  return `${prefix}${slice}${suffix}`;
}

export function buildRecordSearchableRows(
  record: CrmRecord,
  fields: CrmField[],
): Array<{ fieldKey: string; label: string; text: string }> {
  const sortedFields = [...fields].sort((a, b) => a.display_order - b.display_order);
  const rows: Array<{ fieldKey: string; label: string; text: string }> = [];
  const seen = new Set<string>();

  for (const f of sortedFields) {
    if (seen.has(f.key)) continue;
    seen.add(f.key);
    const text = stringifyValue(recordValueFor(record, f.key));
    if (text.trim()) {
      rows.push({ fieldKey: f.key, label: f.label, text });
    }
  }

  const standard: Array<{ key: string; label: string }> = [
    { key: 'title', label: 'Title' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'status', label: 'Status' },
    { key: 'stage', label: 'Stage' },
  ];
  for (const s of standard) {
    if (seen.has(s.key)) continue;
    const text = stringifyValue(recordValueFor(record, s.key));
    if (text.trim()) {
      seen.add(s.key);
      rows.push({ fieldKey: s.key, label: s.label, text });
    }
  }

  return rows;
}

export function buildRecordFieldSearchHits(
  rows: Array<{ fieldKey: string; label: string; text: string }>,
  noteText: string,
  rawQuery: string,
  limit = 30,
): RecordFieldSearchHit[] {
  const queryLower = rawQuery.trim().toLowerCase();
  if (!queryLower) return [];

  const hits: RecordFieldSearchHit[] = [];
  let id = 0;

  for (const row of rows) {
    const hay = `${row.label} ${row.text}`.toLowerCase();
    if (!hay.includes(queryLower)) continue;
    hits.push({
      id: `f-${row.fieldKey}-${id++}`,
      navigate: { type: 'field', fieldKey: row.fieldKey },
      label: row.label,
      snippet: snippetAround(row.text, queryLower),
    });
  }

  const nt = noteText.trim();
  if (nt && nt.toLowerCase().includes(queryLower)) {
    hits.push({
      id: `notes-${id++}`,
      navigate: { type: 'notes' },
      label: 'Notes',
      snippet: snippetAround(nt, queryLower),
    });
  }

  return hits.slice(0, limit);
}
