'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Check,
  ChevronDown,
  X,
  Plus,
  Trash2,
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
import { getFieldOptions } from '@/lib/crm/utils';
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
  { preset: 'website_activity', label: 'Website Activity', icon: MousePointer, enabled: true },
  { preset: 'chats', label: 'Chats', icon: Mail, enabled: true },
  { preset: 'campaigns', label: 'Campaigns', icon: Mail, enabled: true },
  { preset: 'cadences', label: 'Cadences', icon: Activity, enabled: true },
  // Value-based
  { preset: 'record_action', label: 'Record Action', icon: Activity, enabled: true,
    needsValue: true, valueType: 'select', valuePlaceholder: 'Select action...',
    valueOptions: [
      { value: 'create', label: 'Create' }, { value: 'update', label: 'Update' },
      { value: 'delete', label: 'Delete' }, { value: 'stage_change', label: 'Stage Change' },
    ] },
  { preset: 'related_records_action', label: 'Related Records Action', icon: Link2, enabled: true,
    needsValue: true, valueType: 'select', valuePlaceholder: 'Select action...',
    valueOptions: [
      { value: 'create', label: 'Create' }, { value: 'update', label: 'Update' },
      { value: 'delete', label: 'Delete' }, { value: 'stage_change', label: 'Stage Change' },
    ] },
  { preset: 'scoring_rules', label: 'Scoring Rules', icon: Target, enabled: true,
    needsValue: true, valueType: 'number', valuePlaceholder: 'Min score...' },
  { preset: 'latest_email_status', label: 'Latest Email Status', icon: Mail, enabled: true,
    needsValue: true, valueType: 'select', valuePlaceholder: 'Select status...',
    valueOptions: [
      { value: 'sent', label: 'Sent' }, { value: 'delivered', label: 'Delivered' },
      { value: 'bounced', label: 'Bounced' }, { value: 'failed', label: 'Failed' },
    ] },
  { preset: 'attended_by', label: 'Attended By', icon: Users, enabled: true,
    needsValue: true, valueType: 'text', valuePlaceholder: 'Name or ID...' },
  { preset: 'browser', label: 'Browser', icon: MousePointer, enabled: true,
    needsValue: true, valueType: 'text', valuePlaceholder: 'e.g. Chrome' },
  { preset: 'operating_system', label: 'Operating System', icon: MousePointer, enabled: true,
    needsValue: true, valueType: 'text', valuePlaceholder: 'e.g. Windows' },
  { preset: 'portal_name', label: 'Portal Name', icon: MousePointer, enabled: true,
    needsValue: true, valueType: 'text', valuePlaceholder: 'Portal name...' },
  { preset: 'search_engine', label: 'Search Engine', icon: MousePointer, enabled: true,
    needsValue: true, valueType: 'text', valuePlaceholder: 'e.g. Google' },
  { preset: 'time_spent_minutes', label: 'Time Spent (Minutes)', icon: Activity, enabled: true,
    needsValue: true, valueType: 'number', valuePlaceholder: 'Min minutes...' },
  { preset: 'time_visited', label: 'Time Visited', icon: Activity, enabled: true,
    needsValue: true, valueType: 'number', valuePlaceholder: 'Min visits...' },
  { preset: 'avg_time_spent_minutes', label: 'Average Time Spent (Minutes)', icon: Activity, enabled: true,
    needsValue: true, valueType: 'number', valuePlaceholder: 'Min avg minutes...' },
  { preset: 'days_visited', label: 'Days Visited', icon: CalendarDays, enabled: true,
    needsValue: true, valueType: 'number', valuePlaceholder: 'Min days...' },
  { preset: 'first_page_visited', label: 'First Page Visited', icon: MousePointer, enabled: true,
    needsValue: true, valueType: 'text', valuePlaceholder: 'URL contains...' },
  { preset: 'first_visit', label: 'First Visit', icon: Calendar, enabled: true,
    needsValue: true, valueType: 'date', valuePlaceholder: 'On or after...' },
  { preset: 'most_recent_visit', label: 'Most Recent Visit', icon: Calendar, enabled: true,
    needsValue: true, valueType: 'date', valuePlaceholder: 'On or after...' },
  { preset: 'number_of_chats', label: 'Number Of Chats', icon: Mail, enabled: true,
    needsValue: true, valueType: 'number', valuePlaceholder: 'Min chats...' },
  { preset: 'referrer', label: 'Referrer', icon: Link2, enabled: true,
    needsValue: true, valueType: 'text', valuePlaceholder: 'URL contains...' },
  { preset: 'visitor_score', label: 'Visitor Score', icon: Target, enabled: true,
    needsValue: true, valueType: 'number', valuePlaceholder: 'Min score...' },
];

// ============================================================================
// Related Module config
// ============================================================================

interface RelatedModuleDef {
  key: string;
  label: string;
  icon: typeof Phone;
  enabled: boolean;
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
  { key: 'campaigns', label: 'Campaigns (Connected Records)', icon: Mail, enabled: true },
  { key: 'products', label: 'Products (Connected Records)', icon: Package, enabled: true },
  { key: 'lead_products', label: 'Lead Product Relation (Products)', icon: Package, enabled: true },
  { key: 'invoices', label: 'Invoices (Connected Records)', icon: FileText, enabled: true },
  { key: 'prospects', label: 'Prospects (Connected Records)', icon: Users, enabled: true },
  { key: 'prospect_roles', label: 'Prospect Contact Roles', icon: Users, enabled: true },
  { key: 'providers', label: 'Providers (Connected Records)', icon: Package, enabled: true },
  // Health sharing specific
  { key: 'aca_clients', label: 'ACA Clients (Connected Records)', icon: Heart, enabled: true },
  { key: 'cirrusmd_contacts', label: 'CirrusMD Contacts (Connected Records)', icon: Shield, enabled: true },
  { key: 'planstin_contacts', label: 'Planstin Contacts (Connected Records)', icon: Shield, enabled: true },
  { key: 'pricing_matrix', label: 'Pricing Matrix (Connected Records)', icon: Package, enabled: true },
  { key: 'producers', label: 'Producers (Connected Records)', icon: Users, enabled: true },
  // Service & support
  { key: 'services', label: 'Services (Connected Records)', icon: Package, enabled: true },
  { key: 'solutions', label: 'Solutions (Connected Records)', icon: Package, enabled: true },
  { key: 'support', label: 'Support (Connected Records)', icon: AlertTriangle, enabled: true },
  // System
  { key: 'data_subject_requests', label: 'Data Subject Requests', icon: FileText, enabled: true },
  { key: 'meeting_invitees', label: 'Invitees (Invited Meetings)', icon: Calendar, enabled: true },
  { key: 'reporting_contacts', label: 'Contacts (Reporting Contacts)', icon: Users, enabled: true },
];

// ============================================================================
// Inline Field Filter Row
// ============================================================================

function FieldFilterRow({
  filter,
  field,
  onUpdate,
  onRemove,
}: {
  filter: ViewFilter;
  field: CrmField | undefined;
  onUpdate: (f: ViewFilter) => void;
  onRemove: () => void;
}) {
  const fieldType = field?.type || 'text';
  const operators = getOperatorsForType(fieldType);
  const opConfig = OPERATORS[filter.operator];
  const needsValue = opConfig?.needsValue !== false;
  const needsNValue = opConfig?.needsNValue === true;
  const isBetween = filter.operator === 'between';

  return (
    <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
      <div className="flex items-center gap-1">
        <Select
          value={filter.operator}
          onValueChange={(op) => onUpdate({ ...filter, operator: op as FilterOperator })}
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
        >
          <Trash2 className="w-3 h-3" />
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
                <SelectValue placeholder="Select..." />
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
                <SelectValue placeholder="Select..." />
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
              placeholder="Value..."
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
              placeholder="Value..."
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
              placeholder="Value..."
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
  filters: ViewFilter[];
  onFiltersChange: (filters: ViewFilter[]) => void;
  orgId?: string;
}

export function FilterSidebar({ fields, filters, onFiltersChange, orgId }: FilterSidebarProps) {
  const [fieldSearch, setFieldSearch] = useState('');
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [advisorsList, setAdvisorsList] = useState<ComboboxOption[]>([]);

  // Fetch advisors for owner filter
  useEffect(() => {
    if (!orgId) return;
    async function fetchAdvisors() {
      const supabase = createClient();
      const { data } = await supabase
        .from('advisors')
        .select('id, first_name, last_name, email')
        .eq('organization_id', orgId!)
        .eq('status', 'active')
        .order('first_name');
      setAdvisorsList(
        (data ?? []).map((a: any) => ({
          value: a.id,
          label: `${a.first_name} ${a.last_name}`,
          subtext: a.email,
        }))
      );
    }
    fetchAdvisors();
  }, [orgId]);

  // Owner filter derived state
  const activeOwnerFilter = useMemo(
    () => filters.find((f) => f.category === 'system' && f.systemPreset === 'owner_is'),
    [filters]
  );
  const activeOwnerId = (activeOwnerFilter?.secondValue as string) || '';

  const handleOwnerFilterChange = useCallback((ownerId: string) => {
    const otherFilters = filters.filter(
      (f) => !(f.category === 'system' && f.systemPreset === 'owner_is')
    );
    if (ownerId) {
      onFiltersChange([
        ...otherFilters,
        {
          field: '__system',
          operator: 'equals',
          value: 'owner_is',
          category: 'system',
          systemPreset: 'owner_is',
          secondValue: ownerId,
        },
      ]);
    } else {
      onFiltersChange(otherFilters);
    }
  }, [filters, onFiltersChange]);

  // Partition filters
  const activeSystemFilters = useMemo(
    () => new Map(
      filters
        .filter((f) => f.category === 'system' && f.systemPreset)
        .map((f) => [f.systemPreset!, f.secondValue ?? null] as const),
    ),
    [filters],
  );
  const activeSystemPresets = useMemo(
    () => new Set(activeSystemFilters.keys()),
    [activeSystemFilters],
  );

  const activeRelatedModules = useMemo(
    () => new Map(
      filters
        .filter((f) => f.category === 'related')
        .map((f) => [f.relatedModule!, f.relatedCondition || 'has_any'] as const),
    ),
    [filters],
  );

  const fieldFilters = useMemo(
    () => filters.filter((f) => !f.category || f.category === 'field'),
    [filters],
  );

  // Field search
  const filteredFields = useMemo(() => {
    if (!fieldSearch) return fields;
    const q = fieldSearch.toLowerCase();
    return fields.filter((f) => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q));
  }, [fields, fieldSearch]);

  // ── System filter toggle ──
  const toggleSystemFilter = useCallback((preset: SystemFilterPreset, filterValue?: string | number | null) => {
    const def = SYSTEM_FILTERS.find((f) => f.preset === preset);
    const isActive = activeSystemPresets.has(preset);
    const otherFilters = filters.filter(
      (f) => !(f.category === 'system' && f.systemPreset === preset),
    );

    if (isActive && filterValue === undefined) {
      // Remove: clicked the same toggle with no new value
      onFiltersChange(otherFilters);
    } else {
      onFiltersChange([
        ...otherFilters,
        {
          field: '__system',
          operator: 'equals',
          value: preset,
          category: 'system',
          systemPreset: preset,
          secondValue: def?.needsValue ? (filterValue ?? null) : null,
        },
      ]);
    }
  }, [filters, activeSystemPresets, onFiltersChange]);

  // ── Related module toggle ──
  const toggleRelatedModule = useCallback(
    (moduleKey: string, condition: RelatedFilterCondition) => {
      const currentCondition = activeRelatedModules.get(moduleKey);
      const otherFilters = filters.filter(
        (f) => !(f.category === 'related' && f.relatedModule === moduleKey),
      );

      if (currentCondition === condition) {
        // Remove if same condition clicked again
        onFiltersChange(otherFilters);
      } else {
        onFiltersChange([
          ...otherFilters,
          {
            field: '__related',
            operator: 'equals',
            value: moduleKey,
            category: 'related',
            relatedModule: moduleKey,
            relatedCondition: condition,
          },
        ]);
      }
    },
    [filters, activeRelatedModules, onFiltersChange],
  );

  // ── Field filter helpers ──
  const addFieldFilter = useCallback(
    (fieldKey: string) => {
      const f = fields.find((x) => x.key === fieldKey);
      const defaultOp: FilterOperator =
        f?.type === 'boolean' || ['number', 'currency', 'date', 'datetime', 'select', 'multiselect', 'lookup', 'user'].includes(f?.type ?? '')
          ? 'equals'
          : 'contains';
      onFiltersChange([
        ...filters,
        { field: fieldKey, operator: defaultOp, value: null, category: 'field' },
      ]);
      setExpandedField(fieldKey);
    },
    [fields, filters, onFiltersChange],
  );

  const updateFieldFilter = useCallback(
    (index: number, updated: ViewFilter) => {
      const copy = [...filters];
      // Find the actual index in the full filters array (field filters only)
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
      onFiltersChange(copy);
    },
    [filters, onFiltersChange],
  );

  const removeFieldFilter = useCallback(
    (index: number) => {
      let fieldIdx = -1;
      const copy = filters.filter((f, i) => {
        if (!f.category || f.category === 'field') {
          fieldIdx++;
          return fieldIdx !== index;
        }
        return true;
      });
      onFiltersChange(copy);
    },
    [filters, onFiltersChange],
  );

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

  const activeFilterCount = filters.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Filters</h3>
          {activeFilterCount > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{activeFilterCount} active</p>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => onFiltersChange([])}
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Accordion Sections */}
      <div className="flex-1 overflow-y-auto">
        <Accordion type="multiple" defaultValue={['system', 'owner', 'fields', 'related']} className="w-full">
          {/* ── Section 1: System Defined Filters ── */}
          <AccordionItem value="system" className="border-b border-slate-200 dark:border-slate-700">
            <AccordionTrigger className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:no-underline">
              System Defined Filters
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-3">
              <div className="space-y-0.5">
                {SYSTEM_FILTERS.map(({ preset, label, icon: Icon, enabled, needsValue, valueType, valueOptions, valuePlaceholder }) => {
                  const isActive = activeSystemPresets.has(preset);
                  const currentValue = activeSystemFilters.get(preset) ?? null;

                  return (
                    <div key={preset}>
                      <button
                        onClick={() => {
                          if (!enabled) return;
                          if (needsValue && !isActive) {
                            toggleSystemFilter(preset, null);
                          } else {
                            toggleSystemFilter(preset);
                          }
                        }}
                        disabled={!enabled}
                        className={cn(
                          'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs transition-colors text-left',
                          isActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
                          !enabled && 'opacity-40 cursor-not-allowed',
                        )}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex-1">{label}</span>
                        {isActive && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                      </button>

                      {isActive && needsValue && (
                        <div className="pl-8 pr-3 py-1">
                          {valueType === 'select' && valueOptions ? (
                            <Select
                              value={String(currentValue || '')}
                              onValueChange={(v) => toggleSystemFilter(preset, v)}
                            >
                              <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-900/50">
                                <SelectValue placeholder={valuePlaceholder || 'Select...'} />
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
                              placeholder={valuePlaceholder || 'Value...'}
                              className="h-7 text-xs bg-white dark:bg-slate-900/50"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── Section: Filter by Owner ── */}
          <AccordionItem value="owner" className="border-b border-slate-200 dark:border-slate-700">
            <AccordionTrigger className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:no-underline">
              Filter by Owner
              {activeOwnerFilter && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-primary/15 text-primary rounded-full font-bold">1</span>
              )}
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <Combobox
                options={advisorsList}
                value={activeOwnerId}
                onValueChange={handleOwnerFilterChange}
                placeholder="Choose an Advisor"
                searchPlaceholder="Search by name..."
                emptyText="No advisors found."
                clearable
                triggerClassName="h-8 text-xs"
              />
              <p className="text-[10px] text-slate-400 mt-1.5 px-1">
                Search and filter by a specific advisor
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* ── Section 2: Filter By Fields ── */}
          <AccordionItem value="fields" className="border-b border-slate-200 dark:border-slate-700">
            <AccordionTrigger className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:no-underline">
              Filter By Fields
              {fieldFilters.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-primary/15 text-primary rounded-full font-bold">
                  {fieldFilters.length}
                </span>
              )}
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-3">
              {/* Search fields */}
              <div className="relative mb-2 px-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder="Search fields..."
                  className="h-8 pl-8 text-xs bg-white dark:bg-slate-900/50"
                />
              </div>

              {/* Field list */}
              <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                {filteredFields.map((field) => {
                  const activeFiltersForField = fieldFiltersByKey.get(field.key) || [];
                  const hasFilter = activeFiltersForField.length > 0;

                  return (
                    <div key={field.key}>
                      <button
                        onClick={() => {
                          if (hasFilter) {
                            setExpandedField(expandedField === field.key ? null : field.key);
                          } else {
                            addFieldFilter(field.key);
                          }
                        }}
                        className={cn(
                          'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs transition-colors text-left',
                          hasFilter
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
                        )}
                      >
                        <span className="flex-1 truncate">{field.label}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                          {field.type}
                        </span>
                        {hasFilter ? (
                          <ChevronDown className={cn(
                            'w-3 h-3 transition-transform shrink-0',
                            expandedField === field.key && 'rotate-180',
                          )} />
                        ) : (
                          <Plus className="w-3 h-3 text-slate-400 shrink-0" />
                        )}
                      </button>

                      {/* Inline filter rows */}
                      {hasFilter && expandedField === field.key && (
                        <div className="pl-3 pr-1 py-1 space-y-1">
                          {activeFiltersForField.map(({ filter, index }) => (
                            <FieldFilterRow
                              key={index}
                              filter={filter}
                              field={field}
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
                            <Plus className="w-3 h-3 mr-1" />
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

          {/* ── Section 3: Filter By Related Modules ── */}
          <AccordionItem value="related" className="border-b-0">
            <AccordionTrigger className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:no-underline">
              Filter By Related Modules
              {activeRelatedModules.size > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-primary/15 text-primary rounded-full font-bold">
                  {activeRelatedModules.size}
                </span>
              )}
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-3">
              <div className="space-y-0.5">
                {RELATED_MODULES.map(({ key, label, icon: Icon, enabled }) => {
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
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex-1 truncate">{label}</span>
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          onClick={() => enabled && toggleRelatedModule(key, 'has_any')}
                          disabled={!enabled}
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
                          onClick={() => enabled && toggleRelatedModule(key, 'has_none')}
                          disabled={!enabled}
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
                          onClick={() => toggleRelatedModule(key, currentCondition!)}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}

              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
