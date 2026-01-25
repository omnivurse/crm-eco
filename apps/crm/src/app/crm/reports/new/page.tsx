'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  BarChart3,
  FileText,
  Settings,
  Loader2,
  Plus,
  Minus,
  X,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Checkbox } from '@crm-eco/ui/components/checkbox';

const DATA_SOURCES = ['members', 'advisors', 'enrollments', 'commissions'] as const;

const DATA_SOURCE_COLUMNS: Record<string, string[]> = {
  members: [
    'id',
    'member_number',
    'first_name',
    'last_name',
    'email',
    'phone',
    'state',
    'status',
    'enrollment_date',
    'created_at',
  ],
  advisors: [
    'id',
    'code',
    'first_name',
    'last_name',
    'email',
    'phone',
    'state',
    'status',
    'level',
    'created_at',
  ],
  enrollments: [
    'id',
    'member_id',
    'advisor_id',
    'product_id',
    'status',
    'monthly_premium',
    'enrollment_date',
    'effective_date',
    'created_at',
  ],
  commissions: [
    'id',
    'advisor_id',
    'enrollment_id',
    'commission_type',
    'commission_period',
    'amount',
    'status',
    'created_at',
  ],
};

const OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater than or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less than or equal' },
  { value: 'ilike', label: 'contains' },
];

interface Filter {
  column: string;
  operator: string;
  value: string;
}

export default function NewReportPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Data Source & Columns
  const [dataSource, setDataSource] = useState<string>('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  // Step 3: Filters
  const [filters, setFilters] = useState<Filter[]>([]);

  const availableColumns = dataSource ? DATA_SOURCE_COLUMNS[dataSource] || [] : [];

  const handleAddFilter = () => {
    setFilters([...filters, { column: '', operator: 'eq', value: '' }]);
  };

  const handleRemoveFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleUpdateFilter = (index: number, field: keyof Filter, value: string) => {
    setFilters(
      filters.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  };

  const handleToggleColumn = (column: string) => {
    setSelectedColumns((prev) =>
      prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column]
    );
  };

  const handleSelectAllColumns = () => {
    if (selectedColumns.length === availableColumns.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns([...availableColumns]);
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          dataSource,
          columns: selectedColumns,
          filters: filters.filter((f) => f.column && f.value),
          grouping: [],
          aggregations: [],
          sorting: [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create report');
      }

      const data = await response.json();
      router.push(`/crm/reports/saved/${data.report.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsCreating(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim().length > 0;
      case 2:
        return dataSource && selectedColumns.length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/crm/reports"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Reports
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Create Custom Report
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-0.5">
          Build a custom report from scratch
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {[
          { num: 1, label: 'Basic Info', icon: FileText },
          { num: 2, label: 'Data & Columns', icon: BarChart3 },
          { num: 3, label: 'Filters', icon: Settings },
        ].map((s, index) => (
          <div key={s.num} className="flex items-center">
            <div
              className={`flex items-center gap-2 ${
                step >= s.num ? 'text-teal-600' : 'text-slate-400'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step > s.num
                    ? 'bg-teal-600 text-white'
                    : step === s.num
                    ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
              >
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span className="font-medium hidden sm:block">{s.label}</span>
            </div>
            {index < 2 && (
              <div
                className={`w-16 h-0.5 mx-4 ${
                  step > s.num ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Step Content */}
      <div className="glass-card rounded-xl p-6 border border-slate-200 dark:border-white/10">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Report Information
            </h2>
            <div className="space-y-2">
              <Label htmlFor="name">Report Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Monthly Sales Report"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this report tracks..."
                rows={3}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Data Source & Columns
            </h2>
            <div className="space-y-2">
              <Label>Data Source *</Label>
              <Select value={dataSource} onValueChange={setDataSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a data source" />
                </SelectTrigger>
                <SelectContent>
                  {DATA_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source.charAt(0).toUpperCase() + source.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {dataSource && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Columns *</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllColumns}
                  >
                    {selectedColumns.length === availableColumns.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg max-h-64 overflow-y-auto">
                  {availableColumns.map((column) => (
                    <label
                      key={column}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedColumns.includes(column)}
                        onCheckedChange={() => handleToggleColumn(column)}
                      />
                      <span className="text-slate-700 dark:text-slate-300">
                        {column.replace(/_/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  {selectedColumns.length} of {availableColumns.length} columns selected
                </p>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Filters (Optional)
              </h2>
              <Button variant="outline" size="sm" onClick={handleAddFilter}>
                <Plus className="w-4 h-4 mr-1" />
                Add Filter
              </Button>
            </div>

            {filters.length > 0 ? (
              <div className="space-y-3">
                {filters.map((filter, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={filter.column}
                      onValueChange={(v) => handleUpdateFilter(index, 'column', v)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Column" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedColumns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filter.operator}
                      onValueChange={(v) => handleUpdateFilter(index, 'operator', v)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      value={filter.value}
                      onChange={(e) => handleUpdateFilter(index, 'value', e.target.value)}
                      placeholder="Value"
                      className="flex-1"
                    />

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFilter(index)}
                      className="text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p>No filters added. Click "Add Filter" to filter your report data.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

        {step < 3 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleCreate}
            disabled={isCreating || !canProceed()}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Create Report
          </Button>
        )}
      </div>
    </div>
  );
}
