'use client';

import { Button } from '@crm-eco/ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import { Plus, Trash2, ArrowUpDown, Sigma } from 'lucide-react';
import {
  AGGREGATION_FUNCTIONS,
  type FieldOption,
} from '../useReportBuilder';
import type {
  ReportType,
  ReportGrouping,
  ReportAggregation,
  AggregationFunction,
} from '@/lib/reports/types';

interface StepGroupingProps {
  reportType: ReportType;
  allFields: FieldOption[];
  grouping: ReportGrouping[];
  columnGroupField: string;
  aggregations: ReportAggregation[];
  onAddGrouping: () => void;
  onUpdateGrouping: (index: number, updates: Partial<ReportGrouping>) => void;
  onRemoveGrouping: (index: number) => void;
  onSetColumnGroup: (field: string) => void;
  onAddAggregation: () => void;
  onUpdateAggregation: (index: number, updates: Partial<ReportAggregation>) => void;
  onRemoveAggregation: (index: number) => void;
}

export function StepGrouping({
  reportType,
  allFields,
  grouping,
  columnGroupField,
  aggregations,
  onAddGrouping,
  onUpdateGrouping,
  onRemoveGrouping,
  onSetColumnGroup,
  onAddAggregation,
  onUpdateAggregation,
  onRemoveAggregation,
}: StepGroupingProps) {
  const numericFields = allFields.filter(f => ['number', 'currency'].includes(f.type));

  if (reportType === 'tabular') {
    return (
      <div className="text-center py-12">
        <ArrowUpDown className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
          Grouping not available for Tabular reports
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Switch to Summary or Matrix report type to use grouping and aggregations.
          Tabular reports display a flat list of records.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Row Grouping */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-violet-500" />
              Row Groups
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Group records by field values. Add multiple levels for nested grouping.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onAddGrouping} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add Group
          </Button>
        </div>

        {grouping.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center">
            <p className="text-sm text-slate-500">No row groups defined. Click "Add Group" to start.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {grouping.map((group, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
              >
                <span className="text-xs font-medium text-slate-400 w-8">
                  Level {index + 1}
                </span>

                <Select
                  value={group.field}
                  onValueChange={(v) => onUpdateGrouping(index, { field: v })}
                >
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {allFields.map((f) => (
                      <SelectItem key={`${f.module_key}.${f.key}`} value={f.key}>
                        {f.label}
                        {f.module_key && (
                          <span className="text-xs text-slate-400 ml-1">({f.module_key})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={group.order}
                  onValueChange={(v: string) => onUpdateGrouping(index, { order: v as 'asc' | 'desc' })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-400 hover:text-red-600"
                  onClick={() => onRemoveGrouping(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Column Grouping (Matrix only) */}
      {reportType === 'matrix' && (
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-amber-500 rotate-90" />
            Column Group (Matrix Axis)
          </h3>
          <p className="text-sm text-slate-500 mb-3">
            Pick a field for the column headers of your matrix.
          </p>
          <Select value={columnGroupField} onValueChange={onSetColumnGroup}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select column group field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {allFields.map((f) => (
                <SelectItem key={`${f.module_key}.${f.key}`} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Aggregations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Sigma className="w-4 h-4 text-emerald-500" />
              Aggregations
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Calculate summary values (Count, Sum, Average, etc.) for each group.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onAddAggregation} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add Aggregation
          </Button>
        </div>

        {aggregations.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center">
            <p className="text-sm text-slate-500">No aggregations defined.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {aggregations.map((agg, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
              >
                <Select
                  value={agg.function}
                  onValueChange={(v: string) => onUpdateAggregation(index, { function: v as AggregationFunction })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATION_FUNCTIONS.map((fn) => (
                      <SelectItem key={fn.value} value={fn.value}>
                        {fn.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-sm text-slate-500 font-medium">of</span>

                <Select
                  value={agg.field}
                  onValueChange={(v) => onUpdateAggregation(index, { field: v })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {(agg.function === 'count' ? allFields : numericFields).map((f) => (
                      <SelectItem key={`${f.module_key}.${f.key}`} value={f.key}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-400 hover:text-red-600"
                  onClick={() => onRemoveAggregation(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
