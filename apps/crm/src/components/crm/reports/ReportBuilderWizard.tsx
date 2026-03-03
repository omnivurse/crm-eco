'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Loader2,
  Check,
  Database,
  Link2,
  Columns3,
  ArrowUpDown,
  Filter,
  BarChart3,
} from 'lucide-react';
import { useReportBuilder, STEP_LABELS, type WizardStep } from './useReportBuilder';
import { StepModuleSelect } from './steps/StepModuleSelect';
import { StepRelatedModules } from './steps/StepRelatedModules';
import { StepColumns } from './steps/StepColumns';
import { StepGrouping } from './steps/StepGrouping';
import { StepFilters } from './steps/StepFilters';
import { StepVisualize } from './steps/StepVisualize';

const STEP_ICONS: Record<WizardStep, React.ReactNode> = {
  1: <Database className="w-4 h-4" />,
  2: <Link2 className="w-4 h-4" />,
  3: <Columns3 className="w-4 h-4" />,
  4: <ArrowUpDown className="w-4 h-4" />,
  5: <Filter className="w-4 h-4" />,
  6: <BarChart3 className="w-4 h-4" />,
};

export function ReportBuilderWizard() {
  const builder = useReportBuilder();

  if (builder.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/crm/reports">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {builder.reportId ? 'Edit Report' : 'Create Custom Report'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
            Build a powerful report to analyze your CRM data
          </p>
        </div>
      </div>

      {/* Step Navigation */}
      <nav className="flex items-center gap-1 overflow-x-auto pb-1">
        {([1, 2, 3, 4, 5, 6] as WizardStep[]).map((s) => {
          const isActive = builder.step === s;
          const isPast = s < builder.step;
          const isFuture = s > builder.step;

          return (
            <button
              key={s}
              onClick={() => builder.goToStep(s)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg transition-all whitespace-nowrap text-sm',
                isActive && 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 font-medium',
                isPast && 'text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10',
                isFuture && 'text-slate-400 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              )}
            >
              <span className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                isActive && 'bg-violet-500 text-white',
                isPast && 'bg-teal-500 text-white',
                isFuture && 'bg-slate-200 dark:bg-slate-700 text-slate-500'
              )}>
                {isPast ? <Check className="w-3 h-3" /> : s}
              </span>
              <span className="hidden sm:flex items-center gap-1.5">
                {STEP_ICONS[s]}
                {STEP_LABELS[s]}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Step Content */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 min-h-[400px]">
        {builder.step === 1 && (
          <StepModuleSelect
            modules={builder.modules}
            primaryModuleId={builder.primaryModuleId}
            dataSource={builder.dataSource}
            reportType={builder.reportType}
            reportName={builder.reportName}
            reportDescription={builder.reportDescription}
            onModuleChange={builder.setPrimaryModuleId}
            onDataSourceChange={builder.setDataSource}
            onReportTypeChange={builder.setReportType}
            onNameChange={builder.setReportName}
            onDescriptionChange={builder.setReportDescription}
          />
        )}

        {builder.step === 2 && (
          <StepRelatedModules
            modules={builder.modules}
            primaryModuleId={builder.primaryModuleId}
            primaryModuleKey={builder.primaryModuleKey}
            relatedModules={builder.relatedModules}
            onAddRelated={builder.addRelatedModule}
            onRemoveRelated={builder.removeRelatedModule}
            onUpdateJoin={builder.updateRelatedModuleJoin}
          />
        )}

        {builder.step === 3 && (
          <StepColumns
            columns={builder.columns}
            allFields={builder.allFields}
            primaryModuleKey={builder.primaryModuleKey}
            relatedModuleKeys={builder.relatedModules.map(rm => rm.module_key)}
            onAddColumn={builder.addColumn}
            onRemoveColumn={builder.removeColumn}
            onReorderColumns={builder.reorderColumns}
          />
        )}

        {builder.step === 4 && (
          <StepGrouping
            reportType={builder.reportType}
            allFields={builder.allFields}
            grouping={builder.grouping}
            columnGroupField={builder.columnGroupField}
            aggregations={builder.aggregations}
            onAddGrouping={builder.addGrouping}
            onUpdateGrouping={builder.updateGrouping}
            onRemoveGrouping={builder.removeGrouping}
            onSetColumnGroup={builder.setColumnGroupField}
            onAddAggregation={builder.addAggregation}
            onUpdateAggregation={builder.updateAggregation}
            onRemoveAggregation={builder.removeAggregation}
          />
        )}

        {builder.step === 5 && (
          <StepFilters
            allFields={builder.allFields}
            filters={builder.filters}
            filterLogic={builder.filterLogic}
            onAddFilter={builder.addFilter}
            onUpdateFilter={builder.updateFilter}
            onRemoveFilter={builder.removeFilter}
            onSetFilterLogic={builder.setFilterLogic}
            productTypeFilter={builder.productTypeFilter}
            reportScope={builder.reportScope}
            advisorId={builder.advisorId}
            includeDownline={builder.includeDownline}
            onProductTypeChange={builder.setProductTypeFilter}
            onScopeChange={builder.setReportScope}
            onAdvisorIdChange={builder.setAdvisorId}
            onIncludeDownlineChange={builder.setIncludeDownline}
          />
        )}

        {builder.step === 6 && (
          <StepVisualize
            reportName={builder.reportName}
            reportType={builder.reportType}
            primaryModule={builder.primaryModule}
            relatedModules={builder.relatedModules}
            columns={builder.columns}
            filters={builder.filters}
            grouping={builder.grouping}
            aggregations={builder.aggregations}
            chartType={builder.chartType}
            chartConfig={builder.chartConfig}
            isShared={builder.isShared}
            allFields={builder.allFields}
            onChartTypeChange={builder.setChartType}
            onChartConfigChange={builder.setChartConfig}
            onSharedChange={builder.setIsShared}
            onNameChange={builder.setReportName}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={builder.goPrev}
          disabled={builder.step === 1}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          {builder.step < 6 ? (
            <Button
              onClick={builder.goNext}
              disabled={!builder.canProceed(builder.step)}
              className="gap-2 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={builder.handleSave}
              disabled={builder.saving || !builder.canProceed(6)}
              className="gap-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
            >
              {builder.saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Report
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
