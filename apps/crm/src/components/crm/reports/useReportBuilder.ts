'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type {
  CrmReport,
  ReportColumn,
  ReportFilter,
  ReportGrouping,
  ReportAggregation,
  ReportType,
  ChartType,
  ChartConfig,
  AggregationFunction,
  RelatedModuleConfig,
  FilterGroup,
} from '@/lib/reports/types';

/* ------------------------------------------------------------------ */
/*  Shared constants                                                  */
/* ------------------------------------------------------------------ */

export const REPORT_TYPES: { value: ReportType; label: string; description: string; icon: string }[] = [
  { value: 'tabular', label: 'Tabular', description: 'Flat list of records — best for detailed exports', icon: '📋' },
  { value: 'summary', label: 'Summary', description: 'Grouped records with totals and sub-totals', icon: '📊' },
  { value: 'matrix', label: 'Matrix', description: 'Cross-tabulation with row and column groups', icon: '🔢' },
];

export const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'none', label: 'No Chart' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'funnel', label: 'Funnel Chart' },
  { value: 'stacked_bar', label: 'Stacked Bar' },
];

export const AGGREGATION_FUNCTIONS: { value: AggregationFunction; label: string }[] = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
];

export const FILTER_OPERATORS_BY_TYPE: Record<string, { value: string; label: string; needsValue: boolean }[]> = {
  text: [
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'not_equals', label: 'Not equals', needsValue: true },
    { value: 'contains', label: 'Contains', needsValue: true },
    { value: 'not_contains', label: 'Does not contain', needsValue: true },
    { value: 'starts_with', label: 'Starts with', needsValue: true },
    { value: 'ends_with', label: 'Ends with', needsValue: true },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
    { value: 'is_not_empty', label: 'Is not empty', needsValue: false },
  ],
  number: [
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'not_equals', label: 'Not equals', needsValue: true },
    { value: 'gt', label: 'Greater than', needsValue: true },
    { value: 'gte', label: 'Greater than or equal', needsValue: true },
    { value: 'lt', label: 'Less than', needsValue: true },
    { value: 'lte', label: 'Less than or equal', needsValue: true },
    { value: 'between', label: 'Between', needsValue: true },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
  ],
  currency: [
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'not_equals', label: 'Not equals', needsValue: true },
    { value: 'gt', label: 'Greater than', needsValue: true },
    { value: 'gte', label: 'Greater than or equal', needsValue: true },
    { value: 'lt', label: 'Less than', needsValue: true },
    { value: 'lte', label: 'Less than or equal', needsValue: true },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
  ],
  date: [
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'before', label: 'Before', needsValue: true },
    { value: 'after', label: 'After', needsValue: true },
    { value: 'between', label: 'Between', needsValue: true },
    { value: 'today', label: 'Today', needsValue: false },
    { value: 'this_week', label: 'This week', needsValue: false },
    { value: 'this_month', label: 'This month', needsValue: false },
    { value: 'this_year', label: 'This year', needsValue: false },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
  ],
  select: [
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'not_equals', label: 'Not equals', needsValue: true },
    { value: 'is_any_of', label: 'Is any of', needsValue: true },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
  ],
  boolean: [
    { value: 'is_true', label: 'Is true', needsValue: false },
    { value: 'is_false', label: 'Is false', needsValue: false },
  ],
};

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ModuleOption {
  id: string;
  name: string;
  key: string;
  name_plural?: string;
}

export interface FieldOption {
  key: string;
  label: string;
  type: string;
  module_key: string;
  module_name: string;
}

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Module & Type',
  2: 'Related Modules',
  3: 'Columns',
  4: 'Grouping',
  5: 'Filters',
  6: 'Visualization',
};

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useReportBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id');

  // ----- Wizard navigation -----
  const [step, setStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ----- Data sources -----
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [fieldsByModule, setFieldsByModule] = useState<Record<string, FieldOption[]>>({});

  // ----- Report config -----
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportType, setReportType] = useState<ReportType>('tabular');
  const [primaryModuleId, setPrimaryModuleId] = useState('');
  const [dataSource, setDataSource] = useState<string>('');
  const [relatedModules, setRelatedModules] = useState<RelatedModuleConfig[]>([]);
  const [columns, setColumns] = useState<ReportColumn[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [filterLogic, setFilterLogic] = useState<FilterGroup | null>(null);
  const [grouping, setGrouping] = useState<ReportGrouping[]>([]);
  const [columnGroupField, setColumnGroupField] = useState<string>('');
  const [aggregations, setAggregations] = useState<ReportAggregation[]>([]);
  const [chartType, setChartType] = useState<ChartType>('none');
  const [chartConfig, setChartConfig] = useState<ChartConfig>({});
  const [isShared, setIsShared] = useState(false);

  // Derived
  const primaryModule = modules.find(m => m.id === primaryModuleId);
  const primaryModuleKey = primaryModule?.key || '';

  // All fields across primary + related modules
  const allFields: FieldOption[] = [
    ...(fieldsByModule[primaryModuleKey] || []),
    ...relatedModules.flatMap(rm => fieldsByModule[rm.module_key] || []),
  ];

  // ----- Data fetching -----

  const loadModules = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/modules');
      const data = await res.json();
      setModules(data.modules || []);
    } catch {
      toast.error('Failed to load modules');
    }
  }, []);

  const loadFieldsForModule = useCallback(async (moduleId: string, moduleKey: string, moduleName: string) => {
    if (fieldsByModule[moduleKey]) return; // already loaded
    try {
      const res = await fetch(`/api/crm/modules/${moduleId}/fields`);
      const data = await res.json();
      const fields: FieldOption[] = (data.fields || []).map((f: { key: string; label: string; type: string }) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        module_key: moduleKey,
        module_name: moduleName,
      }));
      setFieldsByModule(prev => ({ ...prev, [moduleKey]: fields }));
    } catch {
      // silently fail, fields just won't be available
    }
  }, [fieldsByModule]);

  // When primary module changes, load its fields
  useEffect(() => {
    if (primaryModule) {
      loadFieldsForModule(primaryModule.id, primaryModule.key, primaryModule.name);
    }
  }, [primaryModuleId, primaryModule, loadFieldsForModule]);

  // When related modules change, load their fields
  useEffect(() => {
    relatedModules.forEach(rm => {
      loadFieldsForModule(rm.module_id, rm.module_key, rm.module_name);
    });
  }, [relatedModules, loadFieldsForModule]);

  // Load modules on mount + optionally load report for editing
  useEffect(() => {
    loadModules();
    if (reportId) {
      loadReport(reportId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  async function loadReport(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${id}`);
      if (!res.ok) throw new Error('Failed to load report');
      const report: CrmReport = await res.json();
      setReportName(report.name);
      setReportDescription(report.description || '');
      setPrimaryModuleId(report.module_id || '');
      setDataSource(report.data_source || '');
      setReportType(report.report_type);
      setColumns(report.columns);
      setFilters(report.filters);
      setGrouping(report.grouping);
      setAggregations(report.aggregations);
      setChartType(report.chart_type);
      setChartConfig(report.chart_config || {});
      setIsShared(report.is_shared);
      setRelatedModules(report.related_modules || []);
      setFilterLogic(report.filter_logic || null);
    } catch {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  // ----- Column management -----

  const addColumn = useCallback((field: FieldOption) => {
    const key = `${field.module_key}.${field.key}`;
    if (columns.some(c => c.field === key || (c.field === field.key && c.module_key === field.module_key))) return;
    setColumns(prev => [
      ...prev,
      {
        field: field.key,
        label: field.label,
        type: field.type as ReportColumn['type'],
        sortable: true,
        module_key: field.module_key,
      },
    ]);
  }, [columns]);

  const removeColumn = useCallback((field: string, moduleKey?: string) => {
    setColumns(prev => prev.filter(c => !(c.field === field && (!moduleKey || c.module_key === moduleKey))));
  }, []);

  const reorderColumns = useCallback((from: number, to: number) => {
    setColumns(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  // ----- Filter management -----

  const addFilter = useCallback(() => {
    if (allFields.length === 0) return;
    const field = allFields[0];
    setFilters(prev => [...prev, { field: field.key, operator: 'equals', value: '' }]);
  }, [allFields]);

  const updateFilter = useCallback((index: number, updates: Partial<ReportFilter>) => {
    setFilters(prev => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  }, []);

  const removeFilter = useCallback((index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ----- Grouping management -----

  const addGrouping = useCallback(() => {
    if (allFields.length === 0) return;
    setGrouping(prev => [...prev, { field: allFields[0].key, order: 'asc' }]);
  }, [allFields]);

  const updateGrouping = useCallback((index: number, updates: Partial<ReportGrouping>) => {
    setGrouping(prev => prev.map((g, i) => (i === index ? { ...g, ...updates } : g)));
  }, []);

  const removeGrouping = useCallback((index: number) => {
    setGrouping(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ----- Aggregation management -----

  const addAggregation = useCallback(() => {
    const numericFields = allFields.filter(f => ['number', 'currency'].includes(f.type));
    const targetField = numericFields[0] || allFields[0];
    if (!targetField) return;
    setAggregations(prev => [...prev, { field: targetField.key, function: 'count' }]);
  }, [allFields]);

  const updateAggregation = useCallback((index: number, updates: Partial<ReportAggregation>) => {
    setAggregations(prev => prev.map((a, i) => (i === index ? { ...a, ...updates } : a)));
  }, []);

  const removeAggregation = useCallback((index: number) => {
    setAggregations(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ----- Related module management -----

  const addRelatedModule = useCallback((mod: ModuleOption, joinType: 'inclusive' | 'exclusive' = 'inclusive') => {
    if (relatedModules.some(rm => rm.module_id === mod.id)) return;
    setRelatedModules(prev => [
      ...prev,
      {
        module_key: mod.key,
        module_id: mod.id,
        module_name: mod.name,
        join_type: joinType,
        relationship: 'child',
      },
    ]);
  }, [relatedModules]);

  const removeRelatedModule = useCallback((moduleId: string) => {
    setRelatedModules(prev => prev.filter(rm => rm.module_id !== moduleId));
    // Also clean up columns from that module
    const mod = relatedModules.find(rm => rm.module_id === moduleId);
    if (mod) {
      setColumns(prev => prev.filter(c => c.module_key !== mod.module_key));
    }
  }, [relatedModules]);

  const updateRelatedModuleJoin = useCallback((moduleId: string, joinType: 'inclusive' | 'exclusive') => {
    setRelatedModules(prev =>
      prev.map(rm => (rm.module_id === moduleId ? { ...rm, join_type: joinType } : rm))
    );
  }, []);

  // ----- Navigation -----

  const goNext = useCallback(() => {
    setStep(prev => (prev < 6 ? (prev + 1) as WizardStep : prev));
  }, []);

  const goPrev = useCallback(() => {
    setStep(prev => (prev > 1 ? (prev - 1) as WizardStep : prev));
  }, []);

  const goToStep = useCallback((s: WizardStep) => setStep(s), []);

  const canProceed = useCallback((s: WizardStep): boolean => {
    switch (s) {
      case 1: return !!(primaryModuleId || dataSource) && !!reportType;
      case 2: return true; // related modules are optional
      case 3: return columns.length > 0;
      case 4: return true; // grouping is optional
      case 5: return true; // filters are optional
      case 6: return !!reportName.trim();
      default: return true;
    }
  }, [primaryModuleId, dataSource, reportType, columns.length, reportName]);

  // ----- Save -----

  const handleSave = useCallback(async () => {
    if (!reportName.trim()) {
      toast.error('Please enter a report name');
      return;
    }
    if (!primaryModuleId && !dataSource) {
      toast.error('Please select a module or data source');
      return;
    }
    if (columns.length === 0) {
      toast.error('Please select at least one column');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: reportName,
        description: reportDescription,
        module_id: primaryModuleId || undefined,
        data_source: dataSource || undefined,
        report_type: reportType,
        columns,
        filters,
        sorting: [],
        grouping,
        aggregations,
        chart_type: chartType,
        chart_config: chartConfig,
        related_modules: relatedModules,
        filter_logic: filterLogic,
        is_shared: isShared,
      };

      const url = reportId ? `/api/reports/${reportId}` : '/api/reports';
      const res = await fetch(url, {
        method: reportId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      toast.success('Report saved');
      router.push(`/crm/reports/${data.id || reportId}`);
    } catch {
      toast.error('Failed to save report');
    } finally {
      setSaving(false);
    }
  }, [
    reportName, reportDescription, primaryModuleId, dataSource, reportType,
    columns, filters, grouping, aggregations, chartType, chartConfig,
    relatedModules, filterLogic, isShared, reportId, router,
  ]);

  return {
    // State
    step,
    loading,
    saving,
    reportId,
    modules,
    fieldsByModule,
    allFields,
    reportName,
    reportDescription,
    reportType,
    primaryModuleId,
    primaryModule,
    primaryModuleKey,
    dataSource,
    relatedModules,
    columns,
    filters,
    filterLogic,
    grouping,
    columnGroupField,
    aggregations,
    chartType,
    chartConfig,
    isShared,

    // Setters
    setReportName,
    setReportDescription,
    setReportType,
    setPrimaryModuleId,
    setDataSource,
    setFilterLogic,
    setColumnGroupField,
    setChartType,
    setChartConfig,
    setIsShared,

    // Column actions
    addColumn,
    removeColumn,
    reorderColumns,

    // Filter actions
    addFilter,
    updateFilter,
    removeFilter,

    // Grouping actions
    addGrouping,
    updateGrouping,
    removeGrouping,

    // Aggregation actions
    addAggregation,
    updateAggregation,
    removeAggregation,

    // Related module actions
    addRelatedModule,
    removeRelatedModule,
    updateRelatedModuleJoin,

    // Navigation
    goNext,
    goPrev,
    goToStep,
    canProceed,

    // Save
    handleSave,
  };
}
