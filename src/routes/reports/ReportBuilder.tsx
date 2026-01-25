import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Database,
  Columns,
  Filter as FilterIcon,
  BarChart3,
  Play,
  LayoutTemplate,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toaster';
import {
  DataSourceSelector,
  ColumnPicker,
  FilterBuilder,
  ReportResultsTable,
  ReportActionsPanel,
} from '../../components/reports';
import type {
  DataSource,
  Filter,
  Sorting,
  ColumnDefinition,
  ExportFormat,
  ReportTemplate,
} from 'shared';
import {
  getColumnsForDataSource,
  REPORT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  convertTemplateToReport,
  exportData,
  downloadExport,
} from 'shared';

type BuilderStep = 'source' | 'columns' | 'filters' | 'preview';

const STEPS: { id: BuilderStep; label: string; icon: React.ReactNode }[] = [
  { id: 'source', label: 'Data Source', icon: <Database className="w-4 h-4" /> },
  { id: 'columns', label: 'Columns', icon: <Columns className="w-4 h-4" /> },
  { id: 'filters', label: 'Filters', icon: <FilterIcon className="w-4 h-4" /> },
  { id: 'preview', label: 'Preview & Export', icon: <BarChart3 className="w-4 h-4" /> },
];

export function ReportBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');
  const { addToast } = useToast();

  const [currentStep, setCurrentStep] = useState<BuilderStep>('source');
  const [showTemplates, setShowTemplates] = useState(!templateId);

  // Report configuration state
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sorting, setSorting] = useState<Sorting[]>([]);

  // Results state
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Export/Save state
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load template if specified
  useEffect(() => {
    if (templateId) {
      const template = REPORT_TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        loadTemplate(template);
      }
    }
  }, [templateId]);

  const loadTemplate = (template: ReportTemplate) => {
    setDataSource(template.dataSource);
    setSelectedColumns(template.columns);
    setFilters(template.filters);
    setSorting(template.sorting);
    setShowTemplates(false);
    setCurrentStep('filters');
  };

  const columns = useMemo(() => {
    if (!dataSource) return [];
    return getColumnsForDataSource(dataSource);
  }, [dataSource]);

  const selectedColumnDefs = useMemo(() => {
    return selectedColumns
      .map((key) => columns.find((c) => c.key === key))
      .filter((c): c is ColumnDefinition => !!c);
  }, [selectedColumns, columns]);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'source':
        return !!dataSource;
      case 'columns':
        return selectedColumns.length > 0;
      case 'filters':
        return true; // Filters are optional
      case 'preview':
        return true;
      default:
        return false;
    }
  };

  const goToStep = (step: BuilderStep) => {
    setCurrentStep(step);
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const executeReport = async () => {
    if (!dataSource) return;

    setLoading(true);
    try {
      // Build Supabase query
      let query = supabase.from(dataSource).select('*', { count: 'exact' });

      // Apply filters
      filters.forEach((filter) => {
        const column = filter.column.replace('.', '_');
        switch (filter.operator) {
          case 'eq':
            query = query.eq(column, filter.value);
            break;
          case 'neq':
            query = query.neq(column, filter.value);
            break;
          case 'gt':
            query = query.gt(column, filter.value);
            break;
          case 'gte':
            query = query.gte(column, filter.value);
            break;
          case 'lt':
            query = query.lt(column, filter.value);
            break;
          case 'lte':
            query = query.lte(column, filter.value);
            break;
          case 'like':
          case 'ilike':
            query = query.ilike(column, `%${filter.value}%`);
            break;
          case 'in':
            if (Array.isArray(filter.value)) {
              query = query.in(column, filter.value);
            }
            break;
          case 'is_null':
            query = query.is(column, null);
            break;
          case 'is_not_null':
            query = query.not(column, 'is', null);
            break;
        }
      });

      // Apply sorting
      if (sorting.length > 0) {
        sorting.forEach((sort) => {
          query = query.order(sort.column, { ascending: sort.direction === 'asc' });
        });
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setResults(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error executing report:', error);
      addToast({ type: 'error', message: 'Failed to execute report' });
    } finally {
      setLoading(false);
    }
  };

  // Execute report when reaching preview step
  useEffect(() => {
    if (currentStep === 'preview' && dataSource && selectedColumns.length > 0) {
      executeReport();
    }
  }, [currentStep, page, pageSize, sorting]);

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    try {
      const columnTypes: Record<string, any> = {};
      selectedColumnDefs.forEach((col) => {
        columnTypes[col.key.replace('.', '_')] = col.type;
      });

      const result = exportData(
        results,
        selectedColumns.map((c) => c.replace('.', '_')),
        format,
        columnTypes
      );

      downloadExport(result);
      addToast({ type: 'success', message: `Report exported as ${format.toUpperCase()}` });
    } catch (error) {
      console.error('Export error:', error);
      addToast({ type: 'error', message: 'Failed to export report' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSave = async (name: string, description?: string) => {
    if (!dataSource) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('crm_reports').insert({
        name,
        description,
        data_source: dataSource,
        columns: selectedColumns,
        filters,
        sorting,
        is_template: false,
      });

      if (error) throw error;

      addToast({ type: 'success', message: 'Report saved successfully' });
    } catch (error) {
      console.error('Save error:', error);
      addToast({ type: 'error', message: 'Failed to save report' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSegment = async (name: string, description?: string) => {
    if (!dataSource) return;

    try {
      const entityType = dataSource === 'members' || dataSource === 'advisors' ? dataSource : 'members';

      const { error } = await supabase.from('report_segments').insert({
        name,
        description,
        entity_type: entityType,
        filter_snapshot: filters,
        record_count: selectedRows.size > 0 ? selectedRows.size : totalCount,
        is_dynamic: selectedRows.size === 0,
      });

      if (error) throw error;

      addToast({ type: 'success', message: 'Segment created successfully' });
    } catch (error) {
      console.error('Segment error:', error);
      addToast({ type: 'error', message: 'Failed to create segment' });
    }
  };

  const handleSetAlert = () => {
    addToast({ type: 'info', message: 'Alert configuration coming soon' });
  };

  const handleSchedule = () => {
    addToast({ type: 'info', message: 'Report scheduling coming soon' });
  };

  // Template selection view
  if (showTemplates) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Report Builder
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Start with a template or build from scratch
            </p>
          </div>
          <button
            onClick={() => setShowTemplates(false)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <Database className="w-4 h-4" />
            Build from Scratch
          </button>
        </div>

        <div className="space-y-8">
          {TEMPLATE_CATEGORIES.map((category) => {
            const categoryTemplates = REPORT_TEMPLATES.filter(
              (t) => t.category === category.id
            );

            if (categoryTemplates.length === 0) return null;

            return (
              <div key={category.id}>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                  <LayoutTemplate className="w-5 h-5 text-primary-500" />
                  {category.label}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => loadTemplate(template)}
                      className="p-4 text-left bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:border-primary-500 hover:shadow-md transition-all"
                    >
                      <h3 className="font-medium text-neutral-900 dark:text-white mb-1">
                        {template.name}
                      </h3>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded">
                          {template.dataSource}
                        </span>
                        <span className="px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded">
                          {template.columns.length} columns
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => setShowTemplates(true)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline mb-2 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Templates
          </button>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            Report Builder
          </h1>
        </div>
      </div>

      {/* Steps Navigation */}
      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
        {STEPS.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = index < currentStepIndex;
          const isClickable = index <= currentStepIndex || (index === currentStepIndex + 1 && canProceed());

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => isClickable && goToStep(step.id)}
                disabled={!isClickable}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                  ${isActive
                    ? 'bg-primary-600 text-white'
                    : isCompleted
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                  }
                  ${isClickable && !isActive ? 'hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer' : ''}
                  ${!isClickable ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : step.icon}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <ChevronRight className="w-5 h-5 mx-2 text-neutral-400" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="glass-card p-6 mb-6">
        {currentStep === 'source' && (
          <DataSourceSelector
            selectedSource={dataSource}
            onSelect={(source) => {
              setDataSource(source);
              setSelectedColumns([]);
              setFilters([]);
            }}
          />
        )}

        {currentStep === 'columns' && dataSource && (
          <ColumnPicker
            dataSource={dataSource}
            selectedColumns={selectedColumns}
            onColumnsChange={setSelectedColumns}
          />
        )}

        {currentStep === 'filters' && dataSource && (
          <FilterBuilder
            dataSource={dataSource}
            filters={filters}
            onFiltersChange={setFilters}
          />
        )}

        {currentStep === 'preview' && dataSource && (
          <div className="space-y-6">
            <ReportActionsPanel
              onExport={handleExport}
              onSave={handleSave}
              onCreateSegment={handleCreateSegment}
              onSetAlert={handleSetAlert}
              onSchedule={handleSchedule}
              isExporting={isExporting}
              isSaving={isSaving}
              selectedRowCount={selectedRows.size}
            />

            <ReportResultsTable
              data={results}
              columns={selectedColumnDefs}
              totalCount={totalCount}
              page={page}
              pageSize={pageSize}
              sorting={sorting}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              onSortChange={setSorting}
              selectedRows={selectedRows}
              onRowSelectionChange={setSelectedRows}
              loading={loading}
            />
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          onClick={prevStep}
          disabled={currentStepIndex === 0}
          className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        {currentStep === 'preview' ? (
          <button
            onClick={executeReport}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Running...' : 'Run Report'}
          </button>
        ) : (
          <button
            onClick={nextStep}
            disabled={!canProceed()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
