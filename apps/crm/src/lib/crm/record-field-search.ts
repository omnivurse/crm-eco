/**
 * Client-side "find in record" helpers — shared by InlineRecordSearch and
 * the global CommandPalette when the user is on a record detail page.
 */

import type { CrmField, CrmRecord } from '@/lib/crm/types';
import { mergeCrmRecordRowIntoFormDefaults } from '@/lib/crm/record-form-defaults';
import {
  addressFormLabel,
  addressSlotForKey,
  formatRecordAddress,
  primaryAddressFieldKey,
} from '@/lib/crm/address-field-dedupe';

export type RecordFieldNavigateTarget =
  | { type: 'field'; fieldKey: string }
  | { type: 'notes' };

export interface RecordFieldSearchHit {
  id: string;
  navigate: RecordFieldNavigateTarget;
  label: string;
  snippet: string;
  /** Raw crm_fields.section key — UI maps this to Profile / Address / … */
  section?: string;
}

export interface RecordSearchableRow {
  fieldKey: string;
  label: string;
  text: string;
  section?: string;
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

/**
 * Core columns mirrored on CrmRecord; custom fields usually live under `data` only.
 *
 * `projectedData` is the legacy-projected view of `record.data` (see
 * `mergeCrmRecordRowIntoFormDefaults`). Find-in-record must search exactly what
 * the page displays — searching raw `data` made projected Zoho values
 * unfindable even though the rep could see them on screen.
 */
export function recordValueFor(
  record: CrmRecord,
  key: string,
  projectedData?: Record<string, unknown> | null,
): unknown {
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
      return projectedData ? projectedData[key] : record.data?.[key];
  }
}

/** Collapse punctuation so "eagle co" hits "Eagle, CO" and "po box" hits "P.O. Box". */
function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function addressSearchTokens(fieldKey: string): string {
  const slot = addressSlotForKey(fieldKey);
  if (!slot) return '';
  if (slot === 'line1') return 'address mailing street';
  return `address mailing ${slot}`;
}

export function buildRecordSearchableRows(
  record: CrmRecord,
  fields: CrmField[],
  moduleKey?: string | null,
): RecordSearchableRow[] {
  // Search the SAME projected values the detail page renders, so a Zoho-era
  // value surfaced through projection is also findable via ⌘K.
  const projectedData = mergeCrmRecordRowIntoFormDefaults(
    record as unknown as Record<string, unknown> & {
      data?: Record<string, unknown> | null;
      email?: string | null;
      phone?: string | null;
      status?: string | null;
    },
    { moduleKey },
  );

  const sortedFields = [...fields].sort((a, b) => a.display_order - b.display_order);
  const filled: RecordSearchableRow[] = [];
  const empty: RecordSearchableRow[] = [];
  const seen = new Set<string>();

  for (const f of sortedFields) {
    if (seen.has(f.key)) continue;
    seen.add(f.key);
    const text = stringifyValue(recordValueFor(record, f.key, projectedData));
    const label = addressFormLabel(f.key, moduleKey, f.label);
    const row: RecordSearchableRow = {
      fieldKey: f.key,
      label,
      text,
      section: f.section,
    };
    if (text.trim()) filled.push(row);
    else empty.push(row);
  }

  const standard: Array<{ key: string; label: string; section?: string }> = [
    { key: 'title', label: 'Title' },
    { key: 'email', label: 'Email', section: 'contact' },
    { key: 'phone', label: 'Phone', section: 'contact' },
    { key: 'status', label: 'Status' },
    { key: 'stage', label: 'Stage' },
  ];
  for (const s of standard) {
    if (seen.has(s.key)) continue;
    const text = stringifyValue(recordValueFor(record, s.key));
    if (!text.trim()) continue;
    seen.add(s.key);
    filled.push({ fieldKey: s.key, label: s.label, text, section: s.section });
  }

  const rows = [...filled, ...empty];
  const composed = formatRecordAddress(projectedData, moduleKey);
  if (composed) {
    const fieldKey = primaryAddressFieldKey(moduleKey);
    rows.unshift({
      fieldKey,
      label: 'Address',
      text: composed,
      section: 'address',
    });
  }

  return rows;
}

export function buildRecordFieldSearchHits(
  rows: RecordSearchableRow[],
  noteText: string,
  rawQuery: string,
  limit = 30,
): RecordFieldSearchHit[] {
  const queryLower = rawQuery.trim().toLowerCase();
  const queryNorm = normalizeForSearch(rawQuery);
  if (!queryNorm) return [];

  const hits: RecordFieldSearchHit[] = [];
  const seenRow = new Set<string>();
  let id = 0;

  for (const row of rows) {
    const valueHay = normalizeForSearch(row.text);
    const labelHay = normalizeForSearch(
      `${row.section ?? ''} ${row.label} ${addressSearchTokens(row.fieldKey)}`,
    );
    const matchValue = valueHay.includes(queryNorm);
    const matchLabel = queryNorm.length >= 2 && labelHay.includes(queryNorm);
    if (!matchValue && !matchLabel) continue;
    const rowId = `${row.fieldKey}::${row.label}`;
    if (seenRow.has(rowId)) continue;
    seenRow.add(rowId);
    hits.push({
      id: `f-${row.fieldKey}-${id++}`,
      navigate: { type: 'field', fieldKey: row.fieldKey },
      label: row.label,
      snippet: row.text.trim()
        ? snippetAround(row.text, queryLower)
        : 'Empty — jump to this field',
      section: row.section,
    });
  }

  const nt = noteText.trim();
  if (nt && normalizeForSearch(nt).includes(queryNorm)) {
    hits.push({
      id: `notes-${id++}`,
      navigate: { type: 'notes' },
      label: 'Notes',
      snippet: snippetAround(nt, queryLower),
    });
  }

  return hits.slice(0, limit);
}
