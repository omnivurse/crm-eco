import { rosterMatchKey, parseRelationship, parseRosterStatus } from './match';
import { isDependentRelationship, wouldExceedDependentCap } from './caps';
import type { RosterImportResult, RosterPersonInput, RosterImportRowResult } from './types';

export interface ExistingRosterRow {
  id: string;
  match_key: string;
  status: string;
  external_id: string | null;
  relationship?: string | null;
}

export function parseRosterCsv(text: string): RosterPersonInput[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const idx = (names: string[]) => names.map((n) => headers.indexOf(n)).find((i) => i >= 0) ?? -1;

  const firstI = idx(['first_name', 'firstname', 'first', 'employee_first_name']);
  const lastI = idx(['last_name', 'lastname', 'last', 'employee_last_name']);
  const dobI = idx(['date_of_birth', 'dob', 'birthdate', 'birth_date']);
  const emailI = idx(['email', 'work_email', 'employee_email']);
  const extI = idx(['external_id', 'employee_id', 'ee_id', 'id']);
  const relI = idx(['relationship', 'type', 'rel']);
  const startI = idx(['eligible_start', 'start_date', 'coverage_start']);
  const endI = idx(['eligible_end', 'end_date', 'term_date', 'termination_date']);
  const statusI = idx(['status']);

  if (firstI < 0 || lastI < 0) {
    throw new Error('CSV must include first_name and last_name columns.');
  }

  const rows: RosterPersonInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const first = (cols[firstI] ?? '').trim();
    const last = (cols[lastI] ?? '').trim();
    if (!first && !last) continue;
    const status = statusI >= 0 ? parseRosterStatus(cols[statusI]) : 'eligible';
    rows.push({
      first_name: first,
      last_name: last,
      date_of_birth: dobI >= 0 ? normalizeCsvDate(cols[dobI]) : null,
      email: emailI >= 0 ? (cols[emailI] || '').trim() || null : null,
      external_id: extI >= 0 ? (cols[extI] || '').trim() || null : null,
      relationship: relI >= 0 ? parseRelationship(cols[relI]) : 'employee',
      eligible_start: startI >= 0 ? normalizeCsvDate(cols[startI]) : null,
      eligible_end: endI >= 0 ? normalizeCsvDate(cols[endI]) : null,
      ...(status === 'terminated' ? { eligible_end: normalizeCsvDate(endI >= 0 ? cols[endI] : '') || new Date().toISOString().slice(0, 10) } : {}),
    });
  }
  return rows;
}

export function planRosterImport(
  incoming: RosterPersonInput[],
  existing: ExistingRosterRow[]
): RosterImportResult {
  const byKey = new Map(existing.map((r) => [r.match_key, r]));
  const byExternal = new Map(
    existing.filter((r) => r.external_id).map((r) => [r.external_id as string, r])
  );

  const rows: RosterImportRowResult[] = [];

  incoming.forEach((person, index) => {
    const row_number = index + 1;
    if (!person.first_name?.trim() || !person.last_name?.trim()) {
      rows.push({
        row_number,
        action: 'error',
        message: 'Missing first or last name',
        match_key: '',
        payload: person,
      });
      return;
    }
    const match_key = rosterMatchKey(person.first_name, person.last_name, person.date_of_birth);
    const found =
      (person.external_id ? byExternal.get(person.external_id) : undefined) ?? byKey.get(match_key);
    const terminating = Boolean(person.eligible_end) && person.eligible_end! <= new Date().toISOString().slice(0, 10);

    if (!found) {
      if (terminating) {
        rows.push({
          row_number,
          action: 'skip',
          message: 'Terminate for a person not on the roster',
          match_key,
          payload: person,
        });
        return;
      }
      rows.push({ row_number, action: 'insert', match_key, payload: person });
      return;
    }
    if (terminating || found.status === 'terminated') {
      rows.push({
        row_number,
        action: 'terminate',
        match_key,
        payload: person,
        message: 'Mark terminated / end eligibility',
      });
      return;
    }
    rows.push({ row_number, action: 'update', match_key, payload: person });
  });

  return recountImport({
    total_rows: incoming.length,
    rows,
  });
}

/** Fail extra spouse/child rows when they would exceed dependent_cap * employees. */
export function applyDependentCapToImport(
  plan: RosterImportResult,
  existing: ExistingRosterRow[],
  cap: number | null | undefined
): RosterImportResult {
  if (cap == null) return plan;

  const terminatingKeys = new Set(
    plan.rows.filter((row) => row.action === 'terminate').map((row) => row.match_key)
  );
  const surviving = existing.filter(
    (row) => row.status !== 'terminated' && !terminatingKeys.has(row.match_key)
  );
  const incomingEmployees = plan.rows.filter(
    (row) => row.action === 'insert' && (row.payload.relationship ?? 'employee') === 'employee'
  ).length;
  const employees =
    surviving.filter((row) => (row.relationship ?? 'employee') === 'employee').length + incomingEmployees;

  let dependents = surviving.filter((row) => isDependentRelationship(row.relationship)).length;
  const rows = plan.rows.map((row) => {
    if (row.action !== 'insert') return row;
    if (!isDependentRelationship(row.payload.relationship)) return row;
    dependents += 1;
    if (
      wouldExceedDependentCap({
        cap,
        employeeCount: employees,
        dependentCountAfter: dependents,
      })
    ) {
      return {
        ...row,
        action: 'error' as const,
        message: `Dependent cap exceeded (max ${cap} per employee)`,
      };
    }
    return row;
  });

  return recountImport({ total_rows: plan.total_rows, rows });
}

function recountImport(input: {
  total_rows: number;
  rows: RosterImportRowResult[];
}): RosterImportResult {
  return {
    total_rows: input.total_rows,
    matched_rows: input.rows.filter((row) => row.action === 'update' || row.action === 'terminate').length,
    inserted_rows: input.rows.filter((row) => row.action === 'insert').length,
    updated_rows: input.rows.filter((row) => row.action === 'update').length,
    terminated_rows: input.rows.filter((row) => row.action === 'terminate').length,
    error_rows: input.rows.filter((row) => row.action === 'error').length,
    rows: input.rows,
  };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function normalizeCsvDate(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  const iso = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const mdy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }
  return null;
}
