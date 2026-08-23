'use client';

import { useState, useEffect, useMemo, useCallback, useId, useRef } from 'react';
import {
  Search,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Trash2,
  Loader2,
  Lock,
  MousePointer,
  MousePointerClick,
  Calendar,
  CalendarDays,
  Pencil,
  UserX,
  Activity,
  FileText,
  CheckSquare,
  AlertTriangle,
  Phone,
  Mail,
  Users,
  Package,
  Target,
  Link2,
  Heart,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { Input } from '@crm-eco/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@crm-eco/ui/components/accordion';
import { Button } from '@crm-eco/ui/components/button';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import { Combobox, type ComboboxOption } from '@crm-eco/ui';
import { cn } from '@crm-eco/ui/lib/utils';
import { createClient } from '@crm-eco/lib/supabase/client';
import type {
  CrmField,
  ViewFilter,
  FilterOperator,
  SystemFilterPreset,
  RelatedFilterCondition,
} from '@/lib/crm/types';
import {
  type FilterSidebarVariant,
  applyFilterButtonLabel,
  shouldCloseFilterHost,
  railKeyTargetInOwnKeyScope,
} from '@/lib/crm/filter-rail';
import { getFieldOptions } from '@/lib/crm/utils';
import {
  DISPLAY_ONLY_FIELD_BADGE,
  DISPLAY_ONLY_FIELD_HINT,
  isDisplayOnlyListField,
} from '@/lib/crm/list-field-policy';
import {
  STATUS_LANES,
  groupStatusValuesByLane,
  type StatusLane,
} from '@/lib/crm/status-lanes';
import {
  useStatusValues,
  type StatusValueRow,
  type StatusValuesState,
} from '@/lib/crm/status-values-client';
import {
  CURRENCY_INPUT_STEP,
  formatCurrencyInputValue,
  isValidCurrencyTyping,
  parseCurrencyInput,
} from '@/lib/crm/currency-input';

// ============================================================================
// Operator config for field-based filters
// ============================================================================

interface OperatorConfig {
  label: string;
  types: string[];
  needsValue: boolean;
  isDatePreset?: boolean;
  needsNValue?: boolean;
}

const OPERATORS: Record<string, OperatorConfig> = {
  equals: { label: 'is', types: ['text', 'select', 'email', 'phone', 'number', 'date', 'boolean'], needsValue: true },
  not_equals: { label: 'is not', types: ['text', 'select', 'email', 'phone', 'number', 'date', 'boolean'], needsValue: true },
  contains: { label: 'contains', types: ['text', 'textarea', 'email', 'phone'], needsValue: true },
  starts_with: { label: 'starts with', types: ['text', 'email', 'phone'], needsValue: true },
  ends_with: { label: 'ends with', types: ['text', 'email', 'phone'], needsValue: true },
  gt: { label: 'greater than', types: ['number', 'currency', 'date', 'datetime'], needsValue: true },
  gte: { label: 'greater or equal', types: ['number', 'currency', 'date', 'datetime'], needsValue: true },
  lt: { label: 'less than', types: ['number', 'currency', 'date', 'datetime'], needsValue: true },
  lte: { label: 'less or equal', types: ['number', 'currency', 'date', 'datetime'], needsValue: true },
  is_null: { label: 'is empty', types: ['text', 'textarea', 'select', 'email', 'phone', 'number', 'date', 'datetime', 'url'], needsValue: false },
  is_not_null: { label: 'is not empty', types: ['text', 'textarea', 'select', 'email', 'phone', 'number', 'date', 'datetime', 'url'], needsValue: false },
  in: { label: 'is any of', types: ['text', 'select', 'email'], needsValue: true },
  not_in: { label: 'is none of', types: ['text', 'select', 'email'], needsValue: true },
  between: { label: 'is between', types: ['number', 'currency', 'date', 'datetime'], needsValue: true },
  today: { label: 'is today', types: ['date', 'datetime'], needsValue: false, isDatePreset: true },
  yesterday: { label: 'is yesterday', types: ['date', 'datetime'], needsValue: false, isDatePreset: true },
  this_week: { label: 'is this week', types: ['date', 'datetime'], needsValue: false, isDatePreset: true },
  last_week: { label: 'was last week', types: ['date', 'datetime'], needsValue: false, isDatePreset: true },
  this_month: { label: 'is this month', types: ['date', 'datetime'], needsValue: false, isDatePreset: true },
  last_month: { label: 'was last month', types: ['date', 'datetime'], needsValue: false, isDatePreset: true },
  this_quarter: { label: 'is this quarter', types: ['date', 'datetime'], needsValue: false, isDatePreset: true },
  last_quarter: { label: 'was last quarter', types: ['date', 'datetime'], needsValue: false, isDatePreset: true },
  this_year: { label: 'is this year', types: ['date', 'datetime'], needsValue: false, isDatePreset: true },
  last_year: { label: 'was last year', types: ['date', 'datetime'], needsValue: false, isDatePreset: true },
  last_n_days: { label: 'in last N days', types: ['date', 'datetime'], needsValue: true, isDatePreset: true, needsNValue: true },
  next_n_days: { label: 'in next N days', types: ['date', 'datetime'], needsValue: true, isDatePreset: true, needsNValue: true },
};

function getOperatorsForType(type: string): FilterOperator[] {
  return Object.entries(OPERATORS)
    .filter(([, config]) => config.types.includes(type))
    .map(([key]) => key as FilterOperator);
}

// ============================================================================
// System Defined Filters config
// ============================================================================

type SystemFilterValueType = 'text' | 'number' | 'date' | 'select';

interface SystemFilterDef {
  preset: SystemFilterPreset;
  label: string;
  icon: typeof MousePointer;
  enabled: boolean;
  needsValue?: boolean;
  valueType?: SystemFilterValueType;
  valueOptions?: { value: string; label: string }[];
  valuePlaceholder?: string;
  /**
   * Web-analytics / marketing-automation presets (browser, visitor score,
   * cadences…) mean nothing on a health-share people list. They stay
   * available under "Show all", and always show when already active.
   */
  defaultHidden?: boolean;
}

const SYSTEM_FILTERS: SystemFilterDef[] = [
  // Business lane filters
  { preset: 'healthshare_records', label: 'HealthShare Records', icon: Heart, enabled: true },
  { preset: 'insurance_records', label: 'Insurance Records', icon: Shield, enabled: true },
  { preset: 'unclassified_records', label: 'Needs Classification', icon: HelpCircle, enabled: true },
  { preset: 'needs_review_records', label: 'Needs Review', icon: AlertTriangle, enabled: true },
  // Existing toggle-only
  { preset: 'touched_records', label: 'Touched Records', icon: MousePointerClick, enabled: true },
  { preset: 'untouched_records', label: 'Untouched Records', icon: MousePointer, enabled: true },
  { preset: 'my_records', label: 'My Records', icon: Users, enabled: true },
  { preset: 'unassigned', label: 'Unassigned Records', icon: UserX, enabled: true },
  { preset: 'created_today', label: 'Created Today', icon: Calendar, enabled: true },
  { preset: 'created_this_week', label: 'Created This Week', icon: CalendarDays, enabled: true },
  { preset: 'modified_today', label: 'Modified Today', icon: Pencil, enabled: true },
  { preset: 'modified_this_week', label: 'Modified This Week', icon: Pencil, enabled: true },
  { preset: 'has_activities', label: 'Has Activities', icon: Activity, enabled: true },
  { preset: 'no_activities', label: 'No Activities', icon: Activity, enabled: true },
  { preset: 'has_notes', label: 'Has Notes', icon: FileText, enabled: true },
  { preset: 'has_open_tasks', label: 'Has Open Tasks', icon: CheckSquare, enabled: true },
  { preset: 'has_overdue_tasks', label: 'Has Overdue Tasks', icon: AlertTriangle, enabled: true },
  // New toggle-only
  { preset: 'locked', label: 'Locked', icon: Lock, enabled: true },
  { preset: 'website_activity', defaultHidden: true, label: 'Website Activity', icon: MousePointer, enabled: true },
  { preset: 'chats', defaultHidden: true, label: 'Chats', icon: Mail, enabled: true },
  { preset: 'campaigns', label: 'Campaigns', icon: Mail, enabled: true },
  { preset: 'cadences', defaultHidden: true, label: 'Cadences', icon: Activity, enabled: true },
  // Value-based
  { preset: 'record_action', label: 'Record Action', icon: Activity, enabled: true,
    needsValue: true, valueType: 'select', valuePlaceholder: 'Select action…',
    valueOptions: [
      { value: 'create', label: 'Create' }, { value: 'update', label: 'Update' },
      { value: 'delete', label: 'Delete' }, { value: 'stage_change', label: 'Stage Change' },
    ] },
  { preset: 'related_records_action', label: 'Related Records Action', icon: Link2, enabled: true,
    needsValue: true, valueType: 'select', valuePlaceholder: 'Select action…',
    valueOptions: [
      { value: 'create', label: 'Create' }, { value: 'update', label: 'Update' },
      { value: 'delete', label: 'Delete' }, { value: 'stage_change', label: 'Stage Change' },
    ] },
  { preset: 'scoring_rules', defaultHidden: true, label: 'Scoring Rules', icon: Target, enabled: true,
    needsValue: true, valueType: 'number', valuePlaceholder: 'Min score…' },
  { preset: 'latest_email_status', label: 'Latest Email Status', icon: Mail, enabled: true,
    needsValue: true, valueType: 'select', valuePlaceholder: 'Select status…',
    valueOptions: [
      { value: 'sent', label: 'Sent' }, { value: 'delivered', label: 'Delivered' },
      { value: 'bounced', label: 'Bounced' }, { value: 'failed', label: 'Failed' },
    ] },
  { preset: 'attended_by', defaultHidden: true, label: 'Attended By', icon: Users, enabled: true,
    needsValue: true, valueType: 'text', valuePlaceholder: 'Name or ID…' },
  { preset: 'browser', defaultHidden: true, label: 'Browser', icon: MousePointer, enabled: true,
    needsValue: true, valueType: 'text', valuePlaceholder: 'e.g. Chrome' },
  { preset: 'operating_system', defaultHidden: true, label: 'Operating System', icon: MousePointer, enabled: true,
    needsValue: true, valueType: 'text', valuePlaceholder: 'e.g. Windows' },
  { preset: 'portal_name', defaultHidden: true, label: 'Portal Name', icon: MousePointer, enabled: true,
    needsValue: true, valueType: 'text', valuePlaceholder: 'Portal name…' },
  { preset: 'search_engine', defaultHidden: true, label: 'Search Engine', icon: MousePointer, enabled: true,
    needsValue: true, valueType: 'text', valuePlaceholder: 'e.g. Google' },
  { preset: 'time_spent_minutes', defaultHidden: true, label: 'Time Spent (Minutes)', icon: Activity, enabled: true,
    needsValue: true, valueType: 'number', valuePlaceholder: 'Min minutes…' },
  { preset: 'time_visited', defaultHidden: true, label: 'Time Visited', icon: Activity, enabled: true,
    needsValue: true, valueType: 'number', valuePlaceholder: 'Min visits…' },
  { preset: 'avg_time_spent_minutes', defaultHidden: true, label: 'Average Time Spent (Minutes)', icon: Activity, enabled: true,
    needsValue: true, valueType: 'number', valuePlaceholder: 'Min avg minutes…' },
  { preset: 'days_visited', defaultHidden: true, label: 'Days Visited', icon: CalendarDays, enabled: true,
    needsValue: true, valueType: 'number', valuePlaceholder: 'Min days…' },
  { preset: 'first_page_visited', defaultHidden: true, label: 'First Page Visited', icon: MousePointer, enabled: true,
    needsValue: true, valueType: 'text', valuePlaceholder: 'URL contains…' },
  { preset: 'first_visit', defaultHidden: true, label: 'First Visit', icon: Calendar, enabled: true,
    needsValue: true, valueType: 'date', valuePlaceholder: 'On or after…' },
  { preset: 'most_recent_visit', defaultHidden: true, label: 'Most Recent Visit', icon: Calendar, enabled: true,
    needsValue: true, valueType: 'date', valuePlaceholder: 'On or after…' },
  { preset: 'number_of_chats', defaultHidden: true, label: 'Number Of Chats', icon: Mail, enabled: true,
    needsValue: true, valueType: 'number', valuePlaceholder: 'Min chats…' },
  { preset: 'referrer', defaultHidden: true, label: 'Referrer', icon: Link2, enabled: true,
    needsValue: true, valueType: 'text', valuePlaceholder: 'URL contains…' },
  { preset: 'visitor_score', defaultHidden: true, label: 'Visitor Score', icon: Target, enabled: true,
    needsValue: true, valueType: 'number', valuePlaceholder: 'Min score…' },
];

// ============================================================================
// Related Module config
// ============================================================================

interface RelatedModuleDef {
  key: string;
  label: string;
  icon: typeof Phone;
  enabled: boolean;
  /**
   * Zoho-migration leftovers (Campaigns, Invoices, Solutions, CirrusMD,
   * Planstin…). A PIFH desk never filters people by them, so under the
   * `crm.lists.trim_surface` org flag they move behind "Show all". With the
   * flag off nothing is hidden — the list is exactly as it was.
   */
  defaultHidden?: boolean;
}

const RELATED_MODULES: RelatedModuleDef[] = [
  // Core activities
  { key: 'activities', label: 'Activities (All)', icon: Activity, enabled: true },
  { key: 'calls', label: 'Calls', icon: Phone, enabled: true },
  { key: 'emails', label: 'Emails', icon: Mail, enabled: true },
  { key: 'meetings', label: 'Meetings', icon: Calendar, enabled: true },
  { key: 'tasks', label: 'Tasks', icon: CheckSquare, enabled: true },
  { key: 'notes', label: 'Notes', icon: FileText, enabled: true },
  // Connected records
  { key: 'accounts', label: 'Accounts (Connected Records)', icon: Users, enabled: true },
  { key: 'contacts', label: 'Contacts (Connected Records)', icon: Users, enabled: true },
  { key: 'leads', label: 'Leads (Converted)', icon: Target, enabled: true },
  { key: 'campaigns', defaultHidden: true, label: 'Campaigns (Connected Records)', icon: Mail, enabled: true },
  { key: 'products', defaultHidden: true, label: 'Products (Connected Records)', icon: Package, enabled: true },
  { key: 'lead_products', defaultHidden: true, label: 'Lead Product Relation (Products)', icon: Package, enabled: true },
  { key: 'invoices', defaultHidden: true, label: 'Invoices (Connected Records)', icon: FileText, enabled: true },
  { key: 'prospects', defaultHidden: true, label: 'Prospects (Connected Records)', icon: Users, enabled: true },
  { key: 'prospect_roles', defaultHidden: true, label: 'Prospect Contact Roles', icon: Users, enabled: true },
  { key: 'providers', defaultHidden: true, label: 'Providers (Connected Records)', icon: Package, enabled: true },
  // Health sharing specific
  { key: 'aca_clients', label: 'ACA Clients (Connected Records)', icon: Heart, enabled: true },
  { key: 'cirrusmd_contacts', defaultHidden: true, label: 'CirrusMD Contacts (Connected Records)', icon: Shield, enabled: true },
  { key: 'planstin_contacts', defaultHidden: true, label: 'Planstin Contacts (Connected Records)', icon: Shield, enabled: true },
  { key: 'pricing_matrix', defaultHidden: true, label: 'Pricing Matrix (Connected Records)', icon: Package, enabled: true },
  { key: 'producers', defaultHidden: true, label: 'Producers (Connected Records)', icon: Users, enabled: true },
  // Service & support
  { key: 'services', defaultHidden: true, label: 'Services (Connected Records)', icon: Package, enabled: true },
  { key: 'solutions', defaultHidden: true, label: 'Solutions (Connected Records)', icon: Package, enabled: true },
  { key: 'support', defaultHidden: true, label: 'Support (Connected Records)', icon: AlertTriangle, enabled: true },
  // System
  { key: 'data_subject_requests', defaultHidden: true, label: 'Data Subject Requests', icon: FileText, enabled: true },
  { key: 'meeting_invitees', defaultHidden: true, label: 'Invitees (Invited Meetings)', icon: Calendar, enabled: true },
  { key: 'reporting_contacts', defaultHidden: true, label: 'Contacts (Reporting Contacts)', icon: Users, enabled: true },
];

/**
 * Related-module rows to render. Pure, exported for tests.
 *
 * `trimSurface` off → every module, in catalogue order (today's behaviour).
 * On → the Zoho leftovers collapse behind "Show all", except any module the
 * draft already filters by, which always stays visible.
 */
export function visibleRelatedModules(
  trimSurface: boolean,
  showAll: boolean,
  activeKeys: ReadonlySet<string>,
  catalogue: readonly RelatedModuleDef[] = RELATED_MODULES,
): RelatedModuleDef[] {
  if (!trimSurface || showAll) return [...catalogue];
  return catalogue.filter((m) => !m.defaultHidden || activeKeys.has(m.key));
}

// ============================================================================
// Status-type fields — live values grouped by lane
// ============================================================================

/** Field keys that hold a person's lifecycle status. */
const STATUS_FIELD_KEYS: ReadonlySet<string> = new Set(['contact_status', 'lead_status', 'status']);

function isStatusField(field: Pick<CrmField, 'key'>): boolean {
  return STATUS_FIELD_KEYS.has(field.key);
}

// Live status spellings come from the shared, cached fetcher
// (lib/crm/status-values-client — same request as QuickFilterChips and the
// bulk Change Status dialog). Read-only: the values are the client's own
// free-text statuses, shown exactly as stored and grouped by lane on the
// read side (never rewritten).

/**
 * Lane-grouped multi-select. Ticking a lane header selects every raw
 * spelling in that lane ("Active" → 'Active', 'Active HS Member', …); the
 * spellings stay visible under a disclosure so nothing is hidden or renamed.
 */
function StatusLanePicker({
  rows,
  selected,
  onChange,
  loading,
  error,
}: {
  rows: StatusValueRow[];
  selected: string[];
  onChange: (next: string[]) => void;
  loading?: boolean;
  error?: boolean;
}) {
  const [openLanes, setOpenLanes] = useState<Set<StatusLane>>(() => new Set());
  // Checkbox ids must be unique per picker instance (two status conditions can
  // be open at once) and valid HTML — so: React id prefix + lane + item INDEX,
  // never the raw spelling (which may contain spaces / punctuation).
  const idPrefix = useId();
  const grouped = useMemo(() => groupStatusValuesByLane(rows), [rows]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const setMany = (values: string[], on: boolean) => {
    const next = new Set(selected);
    values.forEach((v) => (on ? next.add(v) : next.delete(v)));
    onChange(Array.from(next));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-[11px] text-slate-500" role="status">
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
        Loading statuses…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="py-2 text-[11px] text-slate-500" role="status">
        {error ? 'Could not load statuses. Try again in a moment.' : 'No status values yet.'}
      </p>
    );
  }

  return (
    <div className="w-full space-y-0.5" role="group" aria-label="Status values by group">
      {STATUS_LANES.map((lane) => {
        const items = grouped[lane.id] ?? [];
        if (items.length === 0) return null;
        const values = items.map((i) => i.value);
        const picked = values.filter((v) => selectedSet.has(v)).length;
        const state: boolean | 'indeterminate' =
          picked === 0 ? false : picked === values.length ? true : 'indeterminate';
        const total = items.reduce((n, i) => n + (i.count || 0), 0);
        const isOpen = openLanes.has(lane.id);
        const laneCheckboxId = `${idPrefix}-lane-${lane.id}`;
        return (
          <div key={lane.id} className="rounded-md">
            <div className="flex items-center gap-1.5 px-1 py-1">
              <Checkbox
                id={laneCheckboxId}
                checked={state}
                onCheckedChange={(v) => setMany(values, v === true)}
                aria-label={`Select all ${lane.label} statuses`}
                className="h-3.5 w-3.5"
              />
              <label htmlFor={laneCheckboxId} className="flex-1 cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200">
                {lane.label}
              </label>
              {total > 0 && (
                <span className="text-[10px] tabular-nums text-slate-400">{total.toLocaleString()}</span>
              )}
              <button
                type="button"
                onClick={() =>
                  setOpenLanes((prev) => {
                    const next = new Set(prev);
                    if (next.has(lane.id)) next.delete(lane.id); else next.add(lane.id);
                    return next;
                  })
                }
                aria-expanded={isOpen}
                aria-label={`${isOpen ? 'Hide' : 'Show'} ${values.length} ${lane.label} spelling${values.length === 1 ? '' : 's'}`}
                className="rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                {isOpen ? <ChevronDown className="w-3 h-3" aria-hidden /> : <ChevronRight className="w-3 h-3" aria-hidden />}
              </button>
            </div>
            {isOpen && (
              <div className="ml-5 mb-1 space-y-0.5 border-l border-slate-200 pl-2 dark:border-slate-700">
                {items.map((item, itemIdx) => {
                  const id = `${idPrefix}-status-${lane.id}-${itemIdx}`;
                  return (
                    <div key={item.value} className="flex items-center gap-1.5 py-0.5">
                      <Checkbox
                        id={id}
                        checked={selectedSet.has(item.value)}
                        onCheckedChange={(v) => setMany([item.value], v === true)}
                        className="h-3.5 w-3.5"
                      />
                      <label htmlFor={id} className="flex-1 cursor-pointer truncate text-[11px] text-slate-700 dark:text-slate-300" title={item.value}>
                        {item.value}
                      </label>
                      {item.count > 0 && (
                        <span className="text-[10px] tabular-nums text-slate-400">{item.count.toLocaleString()}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {selected.length > 0 && (
        <p className="px-1 pt-1 text-[10px] text-slate-500">
          {selected.length} spelling{selected.length === 1 ? '' : 's'} selected
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Draft → applied
// ============================================================================

function hasUsableValue(v: ViewFilter['value']): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.length > 0;
  return true; // boolean
}

/**
 * Drop half-built conditions before they ever reach the URL. A field filter
 * whose operator needs a value but has none (or an empty `in` list, or a
 * `between` missing an end) would otherwise blank the list behind the dialog.
 */
export function finalizeDraftFilters(draft: ViewFilter[]): ViewFilter[] {
  return draft.filter((f) => {
    if (f.category === 'system') {
      const def = SYSTEM_FILTERS.find((d) => d.preset === f.systemPreset);
      if (f.systemPreset === 'owner_is') return hasUsableValue((f.secondValue as string) ?? null);
      if (def?.needsValue) return hasUsableValue((f.secondValue as ViewFilter['value']) ?? null);
      return true;
    }
    if (f.category === 'related') return !!f.relatedModule;
    const op = OPERATORS[f.operator];
    if (op && op.needsValue === false) return true;
    if (f.operator === 'between') {
      return hasUsableValue(f.value) && hasUsableValue((f.secondValue as ViewFilter['value']) ?? null);
    }
    return hasUsableValue(f.value);
  });
}

function countIncomplete(draft: ViewFilter[]): number {
  return draft.length - finalizeDraftFilters(draft).length;
}

function sameFilters(a: ViewFilter[], b: ViewFilter[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ============================================================================
// Inline Field Filter Row
// ============================================================================

function FieldFilterRow({
  filter,
  field,
  onUpdate,
  onRemove,
  statusValues,
}: {
  filter: ViewFilter;
  field: CrmField | undefined;
  onUpdate: (f: ViewFilter) => void;
  onRemove: () => void;
  /** Live status values for status-type fields (undefined for other fields). */
  statusValues?: StatusValuesState;
}) {
  const fieldType = field?.type || 'text';
  const isStatus = !!field && isStatusField(field);
  // Status fields are `select` in crm_fields but the stored data has dozens
  // of free-text spellings — offer the multi-value operators first.
  const operators = isStatus
    ? (['in', 'not_in', 'equals', 'not_equals', 'is_null', 'is_not_null'] as FilterOperator[])
    : getOperatorsForType(fieldType);
  const opConfig = OPERATORS[filter.operator];
  const needsValue = opConfig?.needsValue !== false;
  const needsNValue = opConfig?.needsNValue === true;
  const isBetween = filter.operator === 'between';
  const staticOptions = field?.options?.length ? getFieldOptions(field.options, field.key) : [];
  // Live values win; fall back to the crm_fields options when the endpoint
  // is unavailable so the filter is never a dead end.
  const statusOptionRows: StatusValueRow[] =
    statusValues && statusValues.values.length > 0
      ? statusValues.values
      : staticOptions.map((value) => ({ value, count: 0 }));

  return (
    <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
      <div className="flex items-center gap-1">
        <Select
          value={filter.operator}
          onValueChange={(op) => {
            const next = op as FilterOperator;
            const wantsArray = next === 'in' || next === 'not_in';
            const hasArray = Array.isArray(filter.value);
            onUpdate({
              ...filter,
              operator: next,
              value: wantsArray === hasArray ? filter.value : null,
            });
          }}
        >
          <SelectTrigger className="h-7 text-xs flex-1 bg-white dark:bg-slate-900/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900 max-h-60">
            {operators.map((op) => (
              <SelectItem key={op} value={op} className="text-xs">
                {OPERATORS[op]?.label || op}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-slate-400 hover:text-red-500"
          onClick={onRemove}
          aria-label="Remove condition"
          title="Remove condition"
        >
          <Trash2 className="w-3 h-3" aria-hidden />
        </Button>
      </div>

      {needsValue && (
        <div className="flex items-center gap-1">
          {needsNValue ? (
            <Input
              type="number"
              min={1}
              value={String(filter.value || 7)}
              onChange={(e) => onUpdate({ ...filter, value: e.target.valueAsNumber || 7 })}
              placeholder="Days"
              className="h-7 text-xs bg-white dark:bg-slate-900/50"
            />
          ) : isStatus && (filter.operator === 'in' || filter.operator === 'not_in') ? (
            <StatusLanePicker
              rows={statusOptionRows}
              loading={statusValues?.status === 'loading'}
              error={statusValues?.status === 'error' && statusOptionRows.length === 0}
              selected={Array.isArray(filter.value) ? filter.value : []}
              onChange={(next) => onUpdate({ ...filter, value: next })}
            />
          ) : isStatus ? (
            <Select
              value={typeof filter.value === 'string' ? filter.value : ''}
              onValueChange={(v) => onUpdate({ ...filter, value: v })}
            >
              <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-900/50" aria-label="Status value">
                <SelectValue placeholder={statusValues?.status === 'loading' ? 'Loading…' : 'Select…'} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 max-h-60">
                {statusOptionRows.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.value}
                    {opt.count > 0 && <span className="ml-2 text-[10px] text-slate-400 tabular-nums">{opt.count.toLocaleString()}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : isBetween ? (
            <>
              <Input
                type={fieldType === 'currency' ? 'text' : ['date', 'datetime'].includes(fieldType) ? 'date' : 'number'}
                inputMode={fieldType === 'currency' ? 'decimal' : undefined}
                step={fieldType === 'currency' ? CURRENCY_INPUT_STEP : undefined}
                value={fieldType === 'currency' ? formatCurrencyInputValue(filter.value) : String(filter.value || '')}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (fieldType === 'currency') {
                    if (raw !== '' && !isValidCurrencyTyping(raw)) return;
                    onUpdate({ ...filter, value: raw === '' ? null : raw });
                    return;
                  }
                  onUpdate({
                    ...filter,
                    value: fieldType === 'number' ? e.target.valueAsNumber : raw,
                  });
                }}
                onBlur={fieldType === 'currency' ? (e) => {
                  onUpdate({ ...filter, value: parseCurrencyInput(e.target.value) });
                } : undefined}
                placeholder="Min"
                className="h-7 text-xs flex-1 bg-white dark:bg-slate-900/50"
              />
              <span className="text-[10px] text-slate-400">to</span>
              <Input
                type={fieldType === 'currency' ? 'text' : ['date', 'datetime'].includes(fieldType) ? 'date' : 'number'}
                inputMode={fieldType === 'currency' ? 'decimal' : undefined}
                step={fieldType === 'currency' ? CURRENCY_INPUT_STEP : undefined}
                value={fieldType === 'currency' ? formatCurrencyInputValue(filter.secondValue) : String(filter.secondValue || '')}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (fieldType === 'currency') {
                    if (raw !== '' && !isValidCurrencyTyping(raw)) return;
                    onUpdate({ ...filter, secondValue: raw === '' ? null : raw });
                    return;
                  }
                  onUpdate({
                    ...filter,
                    secondValue: fieldType === 'number' ? e.target.valueAsNumber : raw,
                  });
                }}
                onBlur={fieldType === 'currency' ? (e) => {
                  onUpdate({ ...filter, secondValue: parseCurrencyInput(e.target.value) });
                } : undefined}
                placeholder="Max"
                className="h-7 text-xs flex-1 bg-white dark:bg-slate-900/50"
              />
            </>
          ) : fieldType === 'select' && field?.options?.length ? (
            <Select
              value={String(filter.value || '')}
              onValueChange={(v) => onUpdate({ ...filter, value: v })}
            >
              <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-900/50">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 max-h-60">
                {getFieldOptions(field.options, field.key).map((opt) => (
                  <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : fieldType === 'boolean' ? (
            <Select
              value={String(filter.value ?? '')}
              onValueChange={(v) => onUpdate({ ...filter, value: v === 'true' })}
            >
              <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-900/50">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900">
                <SelectItem value="true" className="text-xs">Yes</SelectItem>
                <SelectItem value="false" className="text-xs">No</SelectItem>
              </SelectContent>
            </Select>
          ) : fieldType === 'currency' ? (
            <Input
              type="text"
              inputMode="decimal"
              step={CURRENCY_INPUT_STEP}
              value={formatCurrencyInputValue(filter.value)}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw !== '' && !isValidCurrencyTyping(raw)) return;
                onUpdate({ ...filter, value: raw === '' ? null : raw });
              }}
              onBlur={(e) => {
                onUpdate({ ...filter, value: parseCurrencyInput(e.target.value) });
              }}
              placeholder="Value…"
              className="h-7 text-xs bg-white dark:bg-slate-900/50"
            />
          ) : fieldType === 'number' ? (
            <Input
              type="number"
              step="1"
              value={String(filter.value || '')}
              onChange={(e) => onUpdate({
                ...filter,
                value: e.target.valueAsNumber,
              })}
              placeholder="Value…"
              className="h-7 text-xs bg-white dark:bg-slate-900/50"
            />
          ) : (
            <Input
              type={['date', 'datetime'].includes(fieldType) ? 'date' : 'text'}
              value={String(filter.value || '')}
              onChange={(e) => onUpdate({
                ...filter,
                value: e.target.value,
              })}
              placeholder="Value…"
              className="h-7 text-xs bg-white dark:bg-slate-900/50"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FilterSidebar
// ============================================================================

interface FilterSidebarProps {
  fields: CrmField[];
  /** Currently *applied* filters (URL state). Edits accumulate in a local draft. */
  filters: ViewFilter[];
  /** Called once with the cleaned draft when the user presses Apply. */
  onFiltersChange: (filters: ViewFilter[]) => void;
  /** Called after Apply and on Cancel so a host dialog can close. */
  onClose?: () => void;
  orgId?: string;
  /** Module key — powers the live status-values picker. */
  moduleKey?: string;
  /** Header title. Dialog default is “Filters”; docked rail uses “Filter Contacts by”. */
  title?: string;
  /** Dialog closes the host on Apply; docked keeps the rail mounted. */
  variant?: FilterSidebarVariant;
  /** Docked rail only — collapse the column without discarding the draft. */
  onCollapse?: () => void;
  /**
   * `crm.lists.trim_surface` (LS-9 / decision D11). Off by default, so the
   * rail renders exactly as it does today unless the org opts in.
   */
  trimSurface?: boolean;
}

const SECTION_TRIGGER_CLASS =
  'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:no-underline';
const COUNT_PILL_CLASS =
  'ml-2 px-1.5 py-0.5 text-[10px] bg-primary/15 text-primary rounded-full font-bold';

export function FilterSidebar({
  fields,
  filters,
  onFiltersChange,
  onClose,
  orgId,
  moduleKey,
  title = 'Filters',
  variant = 'dialog',
  onCollapse,
  trimSurface = false,
}: FilterSidebarProps) {
  // ── Draft state: nothing reaches the URL/list until Apply ──
  const [draft, setDraft] = useState<ViewFilter[]>(filters);
  const [fieldSearch, setFieldSearch] = useState('');
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [showAllSystem, setShowAllSystem] = useState(false);
  const [showAllRelated, setShowAllRelated] = useState(false);
  const [advisorsList, setAdvisorsList] = useState<ComboboxOption[]>([]);
  const [advisorsStatus, setAdvisorsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const isDirty = !sameFilters(draft, filters);
  const incompleteCount = countIncomplete(draft);
  const appliedKey = JSON.stringify(filters);
  const appliedKeyRef = useRef(appliedKey);

  // Docked rail stays mounted — pick up chip / URL removals without wiping
  // an in-progress draft unless the applied set actually changed.
  useEffect(() => {
    if (appliedKeyRef.current === appliedKey) return;
    appliedKeyRef.current = appliedKey;
    setDraft(filters);
  }, [appliedKey, filters]);

  const hasStatusFields = useMemo(() => fields.some(isStatusField), [fields]);
  const statusValues = useStatusValues(moduleKey, hasStatusFields);

  // Fetch advisors for owner filter
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function fetchAdvisors() {
      setAdvisorsStatus('loading');
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('advisors')
          .select('id, first_name, last_name, email')
          .eq('organization_id', orgId!)
          .eq('status', 'active')
          .order('first_name');
        if (cancelled) return;
        if (error) {
          setAdvisorsStatus('error');
          return;
        }
        setAdvisorsList(
          (data ?? []).map((a: { id: string; first_name: string | null; last_name: string | null; email: string | null }) => ({
            value: a.id,
            label: [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || a.id,
            subtext: a.email ?? undefined,
          })),
        );
        setAdvisorsStatus('ready');
      } catch {
        if (!cancelled) setAdvisorsStatus('error');
      }
    }
    fetchAdvisors();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  // Owner filter derived state
  const activeOwnerFilter = useMemo(
    () => draft.find((f) => f.category === 'system' && f.systemPreset === 'owner_is'),
    [draft],
  );
  const activeOwnerId = (activeOwnerFilter?.secondValue as string) || '';

  const handleOwnerFilterChange = useCallback((ownerId: string) => {
    setDraft((prev) => {
      const others = prev.filter((f) => !(f.category === 'system' && f.systemPreset === 'owner_is'));
      if (!ownerId) return others;
      return [
        ...others,
        {
          field: '__system',
          operator: 'equals',
          value: 'owner_is',
          category: 'system',
          systemPreset: 'owner_is',
          secondValue: ownerId,
        },
      ];
    });
  }, []);

  // Partition draft
  const activeSystemFilters = useMemo(
    () => new Map(
      draft
        .filter((f) => f.category === 'system' && f.systemPreset)
        .map((f) => [f.systemPreset!, f.secondValue ?? null] as const),
    ),
    [draft],
  );
  const activeSystemPresets = useMemo(() => new Set(activeSystemFilters.keys()), [activeSystemFilters]);

  const activeRelatedModules = useMemo(
    () => new Map(
      draft
        .filter((f) => f.category === 'related')
        .map((f) => [f.relatedModule!, f.relatedCondition || 'has_any'] as const),
    ),
    [draft],
  );

  const fieldFilters = useMemo(
    () => draft.filter((f) => !f.category || f.category === 'field'),
    [draft],
  );

  // System presets that count as "shown": not analytics noise, or the user
  // asked for all, or the preset is already active (never hide active state).
  const visibleSystemFilters = useMemo(
    () => SYSTEM_FILTERS.filter(
      (f) => f.preset !== 'owner_is' && (showAllSystem || !f.defaultHidden || activeSystemPresets.has(f.preset)),
    ),
    [showAllSystem, activeSystemPresets],
  );
  const hiddenSystemCount = SYSTEM_FILTERS.length - visibleSystemFilters.length;

  // Related modules — same "hidden, not removed" contract as the system list.
  const relatedModulesToRender = useMemo(
    () => visibleRelatedModules(trimSurface, showAllRelated, new Set(activeRelatedModules.keys())),
    [trimSurface, showAllRelated, activeRelatedModules],
  );
  const hiddenRelatedCount = RELATED_MODULES.length - relatedModulesToRender.length;
  const systemFilterCount = Array.from(activeSystemPresets).filter((p) => p !== 'owner_is').length;

  // Field search
  const filteredFields = useMemo(() => {
    if (!fieldSearch) return fields;
    const q = fieldSearch.toLowerCase();
    return fields.filter((f) => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q));
  }, [fields, fieldSearch]);

  // ── System filter toggle ──
  const toggleSystemFilter = useCallback((preset: SystemFilterPreset, filterValue?: string | number | null) => {
    const def = SYSTEM_FILTERS.find((f) => f.preset === preset);
    setDraft((prev) => {
      const isActive = prev.some((f) => f.category === 'system' && f.systemPreset === preset);
      const others = prev.filter((f) => !(f.category === 'system' && f.systemPreset === preset));
      if (isActive && filterValue === undefined) return others;
      return [
        ...others,
        {
          field: '__system',
          operator: 'equals',
          value: preset,
          category: 'system',
          systemPreset: preset,
          secondValue: def?.needsValue ? (filterValue ?? null) : null,
        },
      ];
    });
  }, []);

  // ── Related module toggle ──
  const toggleRelatedModule = useCallback((relatedKey: string, condition: RelatedFilterCondition) => {
    setDraft((prev) => {
      const current = prev.find((f) => f.category === 'related' && f.relatedModule === relatedKey);
      const others = prev.filter((f) => !(f.category === 'related' && f.relatedModule === relatedKey));
      if (current && (current.relatedCondition || 'has_any') === condition) return others;
      return [
        ...others,
        {
          field: '__related',
          operator: 'equals',
          value: relatedKey,
          category: 'related',
          relatedModule: relatedKey,
          relatedCondition: condition,
        },
      ];
    });
  }, []);

  // ── Field filter helpers ──
  const addFieldFilter = useCallback((fieldKey: string) => {
    const f = fields.find((x) => x.key === fieldKey);
    let defaultOp: FilterOperator = 'contains';
    let defaultValue: ViewFilter['value'] = null;
    if (f && isStatusField(f)) {
      defaultOp = 'in';
      defaultValue = [];
    } else if (
      f?.type === 'boolean' ||
      ['number', 'currency', 'date', 'datetime', 'select', 'multiselect', 'lookup', 'user'].includes(f?.type ?? '')
    ) {
      defaultOp = 'equals';
    }
    setDraft((prev) => [...prev, { field: fieldKey, operator: defaultOp, value: defaultValue, category: 'field' }]);
    setExpandedField(fieldKey);
  }, [fields]);

  const updateFieldFilter = useCallback((index: number, updated: ViewFilter) => {
    setDraft((prev) => {
      const copy = [...prev];
      let fieldIdx = -1;
      for (let i = 0; i < copy.length; i++) {
        if (!copy[i].category || copy[i].category === 'field') {
          fieldIdx++;
          if (fieldIdx === index) {
            copy[i] = updated;
            break;
          }
        }
      }
      return copy;
    });
  }, []);

  const removeFieldFilter = useCallback((index: number) => {
    setDraft((prev) => {
      let fieldIdx = -1;
      return prev.filter((f) => {
        if (!f.category || f.category === 'field') {
          fieldIdx++;
          return fieldIdx !== index;
        }
        return true;
      });
    });
  }, []);

  // Group field filters by field key for display
  const fieldFiltersByKey = useMemo(() => {
    const map = new Map<string, { filter: ViewFilter; index: number }[]>();
    let idx = 0;
    for (const f of fieldFilters) {
      const arr = map.get(f.field) || [];
      arr.push({ filter: f, index: idx });
      map.set(f.field, arr);
      idx++;
    }
    return map;
  }, [fieldFilters]);

  // ── Apply / Cancel ──
  const handleApply = useCallback(() => {
    const clean = finalizeDraftFilters(draft);
    setDraft(clean);
    onFiltersChange(clean);
    if (shouldCloseFilterHost(variant)) onClose?.();
  }, [draft, onFiltersChange, onClose, variant]);

  const handleCancel = useCallback(() => {
    setDraft(filters);
    if (shouldCloseFilterHost(variant)) onClose?.();
  }, [filters, onClose, variant]);

  // ── Docked rail keyboard (LS-8): Enter in a value input applies the draft,
  // Esc restores it to the applied set. Buttons / comboboxes / open popovers
  // keep their own Enter & Esc (Radix portals bubble through React, so an
  // Escape a layer already handled arrives `defaultPrevented`).
  const rootRef = useRef<HTMLDivElement>(null);
  const handleRailKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (variant !== 'docked' || e.defaultPrevented) return;
      const t = e.target as HTMLElement;
      if (e.key === 'Enter') {
        // Only value inputs apply; the field-search box narrows the field list.
        if (t.tagName !== 'INPUT' || t.getAttribute('role') === 'combobox' || t.hasAttribute('data-filter-field-search')) return;
        if (t.closest('[role="combobox"], [role="listbox"], [role="dialog"], [aria-expanded="true"]')) return;
        e.preventDefault();
        handleApply();
        return;
      }
      if (e.key === 'Escape') {
        // NOT data-state="open" — the rail's own accordion carries it and
        // would swallow every Escape (railKeyTargetInOwnKeyScope, tested).
        if (railKeyTargetInOwnKeyScope(t)) return;
        if (!isDirty) return;
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
      }
    },
    [variant, handleApply, handleCancel, isDirty],
  );

  // Collapsing unmounts this sidebar; move focus to the rail's "Show …"
  // toggle (FilterRailFrame) so keyboard users are not dropped on <body>.
  const handleCollapse = useCallback(() => {
    const workspace = rootRef.current?.closest<HTMLElement>('[data-filter-workspace]') ?? document;
    onCollapse?.();
    window.requestAnimationFrame(() => {
      const toggle = workspace.querySelector<HTMLElement>('[data-testid="crm-filter-toggle"]');
      toggle?.focus();
    });
  }, [onCollapse]);

  const draftCount = draft.length;

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col" onKeyDown={handleRailKeyDown}>
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {draftCount > 0
              ? `${draftCount} condition${draftCount === 1 ? '' : 's'}${isDirty ? ' · not applied yet' : ''}`
              : 'Pick a field to start narrowing the list'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {draftCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
              onClick={() => setDraft([])}
            >
              Clear All
            </Button>
          )}
          {variant === 'docked' && onCollapse && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              onClick={handleCollapse}
              aria-label={`Collapse ${title}`}
              title={`Collapse ${title}`}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {/* Accordion Sections */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Accordion type="multiple" defaultValue={['fields', 'owner']} className="w-full">
          {/* ── Section 1: Filter By Fields ── */}
          <AccordionItem value="fields" className="border-b border-slate-200 dark:border-slate-700">
            <AccordionTrigger className={SECTION_TRIGGER_CLASS}>
              Filter By Fields
              {fieldFilters.length > 0 && (
                <span className={COUNT_PILL_CLASS}>{fieldFilters.length}</span>
              )}
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-3">
              {/* Search fields */}
              <div className="relative mb-2 px-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" aria-hidden />
                <Input
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder="Search fields…"
                  aria-label="Search fields"
                  data-filter-field-search
                  className="h-8 pl-8 text-xs bg-white dark:bg-slate-900/50"
                />
              </div>

              {/* Field list */}
              <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                {filteredFields.map((field) => {
                  const activeFiltersForField = fieldFiltersByKey.get(field.key) || [];
                  const hasFilter = activeFiltersForField.length > 0;
                  const isExpanded = expandedField === field.key;
                  // LS-4 / D11: twin-overlay / resolved columns stay visible
                  // but cannot start a filter (the stored value is not what the
                  // list shows). An existing filter on one (URL / saved view)
                  // can still be opened and removed.
                  const displayOnly = !hasFilter && isDisplayOnlyListField(field.key, moduleKey);

                  return (
                    <div key={field.key}>
                      <button
                        type="button"
                        onClick={() => {
                          if (displayOnly) return;
                          if (hasFilter) {
                            setExpandedField(isExpanded ? null : field.key);
                          } else {
                            addFieldFilter(field.key);
                          }
                        }}
                        disabled={displayOnly}
                        aria-disabled={displayOnly || undefined}
                        title={displayOnly ? DISPLAY_ONLY_FIELD_HINT : undefined}
                        data-display-only={displayOnly || undefined}
                        aria-expanded={hasFilter ? isExpanded : undefined}
                        className={cn(
                          'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs transition-colors text-left',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                          hasFilter
                            ? 'bg-primary/10 text-primary font-medium'
                            : displayOnly
                              ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
                        )}
                      >
                        <span className="flex-1 truncate">{field.label}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                          {displayOnly ? DISPLAY_ONLY_FIELD_BADGE : field.type}
                        </span>
                        {displayOnly ? null : hasFilter ? (
                          <ChevronDown className={cn('w-3 h-3 transition-transform shrink-0', isExpanded && 'rotate-180')} aria-hidden />
                        ) : (
                          <Plus className="w-3 h-3 text-slate-400 shrink-0" aria-hidden />
                        )}
                      </button>

                      {/* Inline filter rows */}
                      {hasFilter && isExpanded && (
                        <div className="pl-3 pr-1 py-1 space-y-1">
                          {activeFiltersForField.map(({ filter, index }) => (
                            <FieldFilterRow
                              key={index}
                              filter={filter}
                              field={field}
                              statusValues={isStatusField(field) ? statusValues : undefined}
                              onUpdate={(updated) => updateFieldFilter(index, updated)}
                              onRemove={() => removeFieldFilter(index)}
                            />
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-primary hover:text-primary/80 pl-2"
                            onClick={() => addFieldFilter(field.key)}
                          >
                            <Plus className="w-3 h-3 mr-1" aria-hidden />
                            Add condition
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredFields.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">
                    No fields match &quot;{fieldSearch}&quot;
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── Section 2: Filter by Owner ── */}
          <AccordionItem value="owner" className="border-b border-slate-200 dark:border-slate-700">
            <AccordionTrigger className={SECTION_TRIGGER_CLASS}>
              Filter by Owner
              {activeOwnerFilter && <span className={COUNT_PILL_CLASS}>1</span>}
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              {!orgId ? (
                <p className="text-[11px] text-slate-500 px-1 py-1">
                  Owner filter is unavailable here (no organization in context).
                </p>
              ) : (
                <>
                  <Combobox
                    options={advisorsList}
                    value={activeOwnerId}
                    onValueChange={handleOwnerFilterChange}
                    placeholder={advisorsStatus === 'loading' ? 'Loading advisors…' : 'Choose an Advisor'}
                    searchPlaceholder="Search by name…"
                    emptyText={
                      advisorsStatus === 'error'
                        ? 'Could not load advisors.'
                        : advisorsStatus === 'loading'
                          ? 'Loading…'
                          : 'No active advisors found.'
                    }
                    clearable
                    disabled={advisorsStatus === 'loading'}
                    triggerClassName="h-8 text-xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5 px-1">
                    Only records owned by that advisor
                  </p>
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* ── Section 3: System Defined Filters (collapsed) ── */}
          <AccordionItem value="system" className="border-b border-slate-200 dark:border-slate-700">
            <AccordionTrigger className={SECTION_TRIGGER_CLASS}>
              System Defined Filters
              {systemFilterCount > 0 && <span className={COUNT_PILL_CLASS}>{systemFilterCount}</span>}
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-3">
              <div className="space-y-0.5">
                {visibleSystemFilters.map(({ preset, label, icon: Icon, enabled, needsValue, valueType, valueOptions, valuePlaceholder }) => {
                  const isActive = activeSystemPresets.has(preset);
                  const currentValue = activeSystemFilters.get(preset) ?? null;

                  return (
                    <div key={preset}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!enabled) return;
                          if (needsValue && !isActive) {
                            toggleSystemFilter(preset, null);
                          } else {
                            toggleSystemFilter(preset);
                          }
                        }}
                        disabled={!enabled}
                        aria-pressed={isActive}
                        className={cn(
                          'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs transition-colors text-left',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                          isActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
                          !enabled && 'opacity-40 cursor-not-allowed',
                        )}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
                        <span className="flex-1">{label}</span>
                        {isActive && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" aria-hidden />}
                      </button>

                      {isActive && needsValue && (
                        <div className="pl-8 pr-3 py-1">
                          {valueType === 'select' && valueOptions ? (
                            <Select
                              value={String(currentValue || '')}
                              onValueChange={(v) => toggleSystemFilter(preset, v)}
                            >
                              <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-900/50" aria-label={`${label} value`}>
                                <SelectValue placeholder={valuePlaceholder || 'Select…'} />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-slate-900 max-h-60">
                                {valueOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              type={valueType === 'number' ? 'number' : valueType === 'date' ? 'date' : 'text'}
                              value={String(currentValue || '')}
                              onChange={(e) => {
                                const v = valueType === 'number' ? (e.target.valueAsNumber || null) : e.target.value;
                                toggleSystemFilter(preset, v);
                              }}
                              placeholder={valuePlaceholder || 'Value…'}
                              aria-label={`${label} value`}
                              className="h-7 text-xs bg-white dark:bg-slate-900/50"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {(hiddenSystemCount > 0 || showAllSystem) && (
                  <button
                    type="button"
                    onClick={() => setShowAllSystem((v) => !v)}
                    aria-expanded={showAllSystem}
                    className="mt-1 flex w-full items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {showAllSystem ? <ChevronDown className="w-3 h-3" aria-hidden /> : <ChevronRight className="w-3 h-3" aria-hidden />}
                    {showAllSystem
                      ? 'Hide web-analytics filters'
                      : `Show all (${hiddenSystemCount} more web-analytics filters)`}
                  </button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── Section 4: Filter By Related Modules (collapsed) ── */}
          <AccordionItem value="related" className="border-b-0">
            <AccordionTrigger className={SECTION_TRIGGER_CLASS}>
              Filter By Related Modules
              {activeRelatedModules.size > 0 && (
                <span className={COUNT_PILL_CLASS}>{activeRelatedModules.size}</span>
              )}
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-3">
              <div className="space-y-0.5">
                {relatedModulesToRender.map(({ key, label, icon: Icon, enabled }) => {
                  const currentCondition = activeRelatedModules.get(key);
                  const isActive = currentCondition !== undefined;

                  return (
                    <div key={key} className="flex items-center gap-1 px-1">
                      <div className={cn(
                        'flex items-center gap-2 flex-1 min-w-0 px-2 py-2 rounded-lg text-xs',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-slate-700 dark:text-slate-300',
                      )}>
                        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
                        <span className="flex-1 truncate">{label}</span>
                      </div>
                      <div className="flex shrink-0 gap-0.5" role="group" aria-label={`${label} condition`}>
                        <button
                          type="button"
                          onClick={() => enabled && toggleRelatedModule(key, 'has_any')}
                          disabled={!enabled}
                          aria-pressed={currentCondition === 'has_any'}
                          className={cn(
                            'px-2 py-1 rounded text-[10px] font-medium transition-colors',
                            currentCondition === 'has_any'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700',
                            !enabled && 'opacity-40 cursor-not-allowed',
                          )}
                        >
                          Has
                        </button>
                        <button
                          type="button"
                          onClick={() => enabled && toggleRelatedModule(key, 'has_none')}
                          disabled={!enabled}
                          aria-pressed={currentCondition === 'has_none'}
                          className={cn(
                            'px-2 py-1 rounded text-[10px] font-medium transition-colors',
                            currentCondition === 'has_none'
                              ? 'bg-red-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700',
                            !enabled && 'opacity-40 cursor-not-allowed',
                          )}
                        >
                          None
                        </button>
                      </div>
                      {isActive && (
                        <button
                          type="button"
                          onClick={() => toggleRelatedModule(key, currentCondition!)}
                          aria-label={`Remove ${label} filter`}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <X className="w-3 h-3" aria-hidden />
                        </button>
                      )}
                    </div>
                  );
                })}
                {(hiddenRelatedCount > 0 || showAllRelated) && (
                  <button
                    type="button"
                    onClick={() => setShowAllRelated((v) => !v)}
                    aria-expanded={showAllRelated}
                    className="mt-1 flex w-full items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {showAllRelated ? <ChevronDown className="w-3 h-3" aria-hidden /> : <ChevronRight className="w-3 h-3" aria-hidden />}
                    {showAllRelated
                      ? 'Hide the rest'
                      : `Show all (${hiddenRelatedCount} more related modules)`}
                  </button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Footer — the only place the draft leaves the dialog. shrink-0 so
          the accordion cannot clip Apply off the bottom of a docked rail. */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
        {(incompleteCount > 0 || isDirty) && (
          <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400" aria-live="polite">
            {incompleteCount > 0
              ? `${incompleteCount} condition${incompleteCount === 1 ? '' : 's'} without a value will be skipped`
              : `Changes apply when you press ${applyFilterButtonLabel(variant)}`}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 text-xs"
            onClick={handleCancel}
            data-testid="crm-filter-cancel"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 min-w-0 flex-1 text-xs"
            onClick={handleApply}
            data-testid="crm-filter-apply"
          >
            {applyFilterButtonLabel(variant, Math.max(0, draftCount - incompleteCount))}
          </Button>
        </div>
      </div>
    </div>
  );
}
