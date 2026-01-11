'use client';

import { useState, useCallback } from 'react';
import { Upload, ChevronRight, Check, AlertCircle, Loader2 } from 'lucide-react';
import type { CrmModule, CrmField } from '@/lib/crm/types';

interface ImportWizardProps {
  modules: CrmModule[];
  organizationId: string;
  preselectedModule?: string;
}

type WizardStep = 'module' | 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

interface ColumnMapping {
  sourceColumn: string;
  targetField: string | null;
}

interface ParsedRow {
  [key: string]: string;
}

export function ImportWizard({ modules, organizationId, preselectedModule }: ImportWizardProps) {
  const [step, setStep] = useState<WizardStep>(preselectedModule ? 'upload' : 'module');
  const [selectedModule, setSelectedModule] = useState<CrmModule | null>(
    modules.find(m => m.key === preselectedModule) || null
  );
  const [fields, setFields] = useState<CrmField[]>([]);
  const [csvData, setCsvData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch fields when module is selected
  const handleModuleSelect = useCallback(async (module: CrmModule) => {
    setSelectedModule(module);
    setError(null);
    
    try {
      const res = await fetch(`/api/crm/modules/${module.id}/fields`);
      if (!res.ok) throw new Error('Failed to fetch fields');
      const data = await res.json();
      setFields(data.fields || []);
      setStep('upload');
    } catch (err) {
      setError('Failed to load module fields');
    }
  }, []);

  // Parse CSV file
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setError('CSV must have at least a header row and one data row');
          return;
        }

        // Parse header
        const headerLine = lines[0];
        const csvHeaders = parseCSVLine(headerLine);
        setHeaders(csvHeaders);

        // Parse data rows
        const rows: ParsedRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const row: ParsedRow = {};
          csvHeaders.forEach((header, idx) => {
            row[header] = values[idx] || '';
          });
          rows.push(row);
        }
        setCsvData(rows);

        // Auto-map columns
        const autoMappings = csvHeaders.map(header => {
          const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const matchedField = fields.find(f => 
            f.key === normalizedHeader ||
            f.label.toLowerCase() === header.toLowerCase()
          );
          return {
            sourceColumn: header,
            targetField: matchedField?.key || null,
          };
        });
        setMappings(autoMappings);
        setStep('mapping');
      } catch (err) {
        setError('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
  }, [fields]);

  // Parse CSV line handling quotes
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  // Update mapping
  const updateMapping = useCallback((sourceColumn: string, targetField: string | null) => {
    setMappings(prev => prev.map(m => 
      m.sourceColumn === sourceColumn ? { ...m, targetField } : m
    ));
  }, []);

  // Execute import
  const handleImport = useCallback(async () => {
    if (!selectedModule) return;
    
    setImporting(true);
    setError(null);

    try {
      const res = await fetch('/api/crm/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: selectedModule.id,
          organizationId,
          mappings,
          data: csvData,
          fileName,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }

      const result = await res.json();
      setImportResult(result);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [selectedModule, organizationId, mappings, csvData, fileName]);

  // Reset wizard
  const handleReset = useCallback(() => {
    setStep('module');
    setSelectedModule(null);
    setFields([]);
    setCsvData([]);
    setHeaders([]);
    setMappings([]);
    setFileName('');
    setImportResult(null);
    setError(null);
  }, []);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      {/* Progress Steps */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50">
        {(['module', 'upload', 'mapping', 'preview', 'complete'] as const).map((s, idx) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step === s ? 'bg-blue-600 text-white' :
              (['module', 'upload', 'mapping', 'preview', 'complete'].indexOf(step) > idx) ? 'bg-emerald-600 text-white' :
              'bg-slate-700 text-slate-400'
            }`}>
              {(['module', 'upload', 'mapping', 'preview', 'complete'].indexOf(step) > idx) ? (
                <Check className="w-4 h-4" />
              ) : (
                idx + 1
              )}
            </div>
            <span className={`ml-2 text-sm ${
              step === s ? 'text-white' : 'text-slate-400'
            }`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
            {idx < 4 && (
              <ChevronRight className="w-5 h-5 mx-4 text-slate-600" />
            )}
          </div>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Step Content */}
      <div className="p-6">
        {/* Step 1: Module Selection */}
        {step === 'module' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Select Target Module</h3>
            <p className="text-slate-400 text-sm">
              Choose which module you want to import records into.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {modules.map((module) => (
                <button
                  key={module.id}
                  onClick={() => handleModuleSelect(module)}
                  className="p-4 bg-slate-700/50 border border-slate-600 rounded-lg hover:border-blue-500/50 hover:bg-slate-700 transition-all text-left"
                >
                  <p className="text-white font-medium">{module.name}</p>
                  <p className="text-slate-400 text-sm">{module.name_plural || module.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">
              Upload CSV for {selectedModule?.name_plural}
            </h3>
            <p className="text-slate-400 text-sm">
              Upload a CSV file with your data. The first row should contain column headers.
            </p>
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-600 rounded-xl hover:border-blue-500/50 transition-colors cursor-pointer">
              <Upload className="w-12 h-12 text-slate-500 mb-4" />
              <span className="text-white font-medium">Click to upload CSV</span>
              <span className="text-slate-400 text-sm mt-1">or drag and drop</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Step 3: Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Map Columns</h3>
                <p className="text-slate-400 text-sm">
                  Match your CSV columns to {selectedModule?.name} fields
                </p>
              </div>
              <span className="text-sm text-slate-400">
                {csvData.length} rows to import
              </span>
            </div>
            
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {mappings.map((mapping) => (
                <div key={mapping.sourceColumn} className="flex items-center gap-4 p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex-1">
                    <span className="text-white">{mapping.sourceColumn}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500" />
                  <div className="flex-1">
                    <select
                      value={mapping.targetField || ''}
                      onChange={(e) => updateMapping(mapping.sourceColumn, e.target.value || null)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Skip this column --</option>
                      {fields.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep('preview')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                Preview Import
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Preview Import</h3>
            <p className="text-slate-400 text-sm">
              Review the first 5 rows before importing
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {mappings.filter(m => m.targetField).map((m) => (
                      <th key={m.sourceColumn} className="px-3 py-2 text-left text-slate-400 font-medium">
                        {fields.find(f => f.key === m.targetField)?.label || m.targetField}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-700/50">
                      {mappings.filter(m => m.targetField).map((m) => (
                        <td key={m.sourceColumn} className="px-3 py-2 text-slate-300">
                          {row[m.sourceColumn] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setStep('mapping')}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                {importing ? 'Importing...' : `Import ${csvData.length} Records`}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && importResult && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-6">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Import Complete!</h3>
            <p className="text-slate-400 mb-6">
              Successfully imported {importResult.success} of {importResult.total} records
            </p>
            
            <div className="flex justify-center gap-4 mb-8">
              <div className="px-4 py-2 bg-emerald-500/10 rounded-lg">
                <span className="text-2xl font-bold text-emerald-400">{importResult.success}</span>
                <p className="text-sm text-slate-400">Imported</p>
              </div>
              {importResult.errors > 0 && (
                <div className="px-4 py-2 bg-red-500/10 rounded-lg">
                  <span className="text-2xl font-bold text-red-400">{importResult.errors}</span>
                  <p className="text-sm text-slate-400">Errors</p>
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 rounded-lg transition-colors"
              >
                Import More
              </button>
              <a
                href={`/crm/modules/${selectedModule?.key}`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                View {selectedModule?.name_plural}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
