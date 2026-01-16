'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { 
  Upload, 
  ChevronRight, 
  Check, 
  AlertCircle, 
  Loader2, 
  FileSpreadsheet,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Users,
  UserPlus,
  DollarSign,
  Building2,
  FileText,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Progress } from '@crm-eco/ui/components/progress';
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
  autoMapped: boolean;
}

interface ParsedRow {
  [key: string]: string;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <Users className="w-5 h-5" />,
  leads: <UserPlus className="w-5 h-5" />,
  deals: <DollarSign className="w-5 h-5" />,
  accounts: <Building2 className="w-5 h-5" />,
};

const MODULE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  contacts: { text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  leads: { text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  deals: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  accounts: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
};

const STEP_LABELS: Record<WizardStep, string> = {
  module: 'Select Module',
  upload: 'Upload File',
  mapping: 'Map Fields',
  preview: 'Preview',
  importing: 'Importing',
  complete: 'Complete',
};

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
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [saveMapping, setSaveMapping] = useState(false);
  const [mappingName, setMappingName] = useState('');

  // Calculate step progress
  const steps: WizardStep[] = ['module', 'upload', 'mapping', 'preview', 'complete'];
  const currentStepIndex = steps.indexOf(step === 'importing' ? 'preview' : step);
  const progressPercent = ((currentStepIndex) / (steps.length - 1)) * 100;

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

  // Smart field matching
  const findBestFieldMatch = useCallback((header: string, fieldList: CrmField[]): CrmField | undefined => {
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    
    // Direct key match
    let match = fieldList.find(f => f.key === normalizedHeader);
    if (match) return match;
    
    // Label match (case insensitive)
    match = fieldList.find(f => f.label.toLowerCase() === header.toLowerCase());
    if (match) return match;
    
    // Partial label match
    match = fieldList.find(f => 
      f.label.toLowerCase().includes(header.toLowerCase()) ||
      header.toLowerCase().includes(f.label.toLowerCase())
    );
    if (match) return match;
    
    // Common field aliases
    const aliases: Record<string, string[]> = {
      'first_name': ['first name', 'firstname', 'fname', 'given name'],
      'last_name': ['last name', 'lastname', 'lname', 'surname', 'family name'],
      'email': ['email address', 'e-mail', 'mail'],
      'phone': ['phone number', 'telephone', 'mobile', 'cell'],
      'mailing_street': ['street', 'address', 'mailing address', 'street address'],
      'mailing_city': ['city', 'town'],
      'mailing_state': ['state', 'province', 'region'],
      'mailing_zip': ['zip', 'zip code', 'postal code', 'postcode'],
      'contact_status': ['status', 'contact status'],
      'lead_status': ['status', 'lead status'],
      'lead_source': ['source', 'lead source'],
      'date_of_birth': ['dob', 'birthdate', 'birth date', 'birthday'],
    };
    
    for (const [fieldKey, aliasList] of Object.entries(aliases)) {
      if (aliasList.some(alias => normalizedHeader.includes(alias.replace(/\s+/g, '_')))) {
        match = fieldList.find(f => f.key === fieldKey);
        if (match) return match;
      }
    }
    
    return undefined;
  }, []);

  // Parse CSV file
  const processFile = useCallback((file: File) => {
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

        // Smart auto-map columns
        const autoMappings = csvHeaders.map(header => {
          const matchedField = findBestFieldMatch(header, fields);
          return {
            sourceColumn: header,
            targetField: matchedField?.key || null,
            autoMapped: !!matchedField,
          };
        });
        setMappings(autoMappings);
        setStep('mapping');
      } catch (err) {
        setError('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
  }, [fields, findBestFieldMatch]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  // Update mapping
  const updateMapping = useCallback((sourceColumn: string, targetField: string | null) => {
    setMappings(prev => prev.map(m => 
      m.sourceColumn === sourceColumn ? { ...m, targetField, autoMapped: false } : m
    ));
  }, []);

  // Execute import
  const handleImport = useCallback(async () => {
    if (!selectedModule) return;
    
    setImporting(true);
    setStep('importing');
    setError(null);
    setImportProgress(0);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setImportProgress(prev => Math.min(prev + Math.random() * 15, 90));
    }, 500);

    try {
      const res = await fetch('/api/crm/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: selectedModule.id,
          organizationId,
          mappings: mappings.filter(m => m.targetField),
          data: csvData,
          fileName,
          saveMappingAs: saveMapping ? mappingName : undefined,
        }),
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }

      const result = await res.json();
      setImportResult(result);
      
      setTimeout(() => {
        setStep('complete');
      }, 500);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
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
    setImportProgress(0);
    setError(null);
    setSaveMapping(false);
    setMappingName('');
  }, []);

  const mappedFieldsCount = mappings.filter(m => m.targetField).length;
  const autoMappedCount = mappings.filter(m => m.autoMapped).length;

  return (
    <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
      {/* Progress Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/30">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-slate-900 dark:text-white font-semibold">Import Wizard</h3>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
        </div>
        
        {/* Step indicators */}
        <div className="flex items-center gap-1">
          {steps.map((s, idx) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all
                ${step === s || (step === 'importing' && s === 'preview')
                  ? 'bg-gradient-to-br from-teal-500 to-emerald-500 text-white glow-sm' 
                  : currentStepIndex > idx 
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-white/10'
                }
              `}>
                {currentStepIndex > idx ? (
                  <Check className="w-4 h-4" />
                ) : (
                  idx + 1
                )}
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 rounded ${
                  currentStepIndex > idx ? 'bg-emerald-500/50' : 'bg-slate-300 dark:bg-slate-700'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Step Content */}
      <div className="p-6">
        {/* Step 1: Module Selection */}
        {step === 'module' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Select Target Module</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Choose which module you want to import records into.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {modules.map((module) => {
                const icon = MODULE_ICONS[module.key] || <FileText className="w-5 h-5" />;
                const colors = MODULE_COLORS[module.key] || { text: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' };
                
                return (
                  <button
                    key={module.id}
                    onClick={() => handleModuleSelect(module)}
                    className={`p-4 rounded-xl border transition-all text-left hover:scale-[1.02] ${colors.bg} ${colors.border} hover:border-opacity-100`}
                  >
                    <div className={`p-2 rounded-lg ${colors.bg} w-fit mb-3`}>
                      <span className={colors.text}>{icon}</span>
                    </div>
                    <p className="text-slate-900 dark:text-white font-medium">{module.name}</p>
                    <p className="text-slate-500 text-xs">{module.name_plural || module.name}</p>
                  </button>
                );
              })}
              
              {modules.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <p className="text-slate-600 dark:text-slate-400">No modules available. Please run the CRM seed first.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                  Upload CSV for {selectedModule?.name_plural}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Upload a CSV file with your data. The first row should contain column headers.
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setSelectedModule(null);
                  setStep('module');
                }}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Change Module
              </Button>
            </div>
            
            <label 
              className={`
                flex flex-col items-center justify-center w-full h-56 
                border-2 border-dashed rounded-2xl transition-all cursor-pointer
                ${dragActive 
                  ? 'border-teal-500 bg-teal-500/10' 
                  : 'border-slate-300 dark:border-slate-700 hover:border-teal-500/50 hover:bg-slate-100 dark:hover:bg-slate-900/30'
                }
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="p-4 rounded-full bg-slate-200 dark:bg-slate-800/50 mb-4">
                <Upload className={`w-8 h-8 ${dragActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500'}`} />
              </div>
              <span className="text-slate-900 dark:text-white font-medium">
                {dragActive ? 'Drop your file here' : 'Click to upload CSV'}
              </span>
              <span className="text-slate-500 text-sm mt-1">or drag and drop</span>
              <span className="text-slate-500 dark:text-slate-600 text-xs mt-3">Supports .csv files up to 50MB</span>
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
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Map Columns to Fields</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Match your CSV columns to {selectedModule?.name} fields
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {autoMappedCount > 0 && (
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                    {autoMappedCount} auto-mapped
                  </span>
                )}
                <span className="text-slate-600 dark:text-slate-400">
                  {csvData.length.toLocaleString()} rows • {mappedFieldsCount} fields mapped
                </span>
              </div>
            </div>
            
            <div className="glass rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-white/5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <div>CSV Column</div>
                <div>CRM Field</div>
              </div>
              
              <div className="max-h-80 overflow-y-auto scrollbar-thin divide-y divide-slate-200 dark:divide-white/5">
                {mappings.map((mapping) => (
                  <div key={mapping.sourceColumn} className="grid grid-cols-2 gap-4 p-3 items-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-slate-900 dark:text-white truncate">{mapping.sourceColumn}</span>
                      {mapping.autoMapped && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          Auto
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-600 flex-shrink-0" />
                      <select
                        value={mapping.targetField || ''}
                        onChange={(e) => updateMapping(mapping.sourceColumn, e.target.value || null)}
                        className={`
                          flex-1 bg-white dark:bg-slate-900/50 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50
                          ${mapping.targetField 
                            ? 'border-teal-500/30 text-slate-900 dark:text-white' 
                            : 'border-slate-300 dark:border-white/10 text-slate-500'
                          }
                        `}
                      >
                        <option value="">-- Skip this column --</option>
                        {fields.map((field) => (
                          <option key={field.key} value={field.key}>
                            {field.label} {field.required ? '*' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="ghost"
                onClick={() => setStep('upload')}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep('preview')}
                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
                disabled={mappedFieldsCount === 0}
              >
                Preview Import
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Preview Import</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Review the first 5 rows before importing {csvData.length.toLocaleString()} records
              </p>
            </div>

            <div className="glass rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-white/5">
                      {mappings.filter(m => m.targetField).map((m) => (
                        <th key={m.sourceColumn} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {fields.find(f => f.key === m.targetField)?.label || m.targetField}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {csvData.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        {mappings.filter(m => m.targetField).map((m) => (
                          <td key={m.sourceColumn} className="px-4 py-3 text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                            {row[m.sourceColumn] || <span className="text-slate-400 dark:text-slate-600">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Save Mapping Option */}
            <div className="glass rounded-xl border border-slate-200 dark:border-white/5 p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveMapping}
                  onChange={(e) => setSaveMapping(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-teal-500 focus:ring-teal-500/20"
                />
                <div>
                  <span className="text-slate-900 dark:text-white font-medium">Save mapping for future imports</span>
                  <p className="text-slate-500 text-xs">Reuse this column mapping next time you import from the same source</p>
                </div>
              </label>
              
              {saveMapping && (
                <div className="mt-3 ml-7">
                  <input
                    type="text"
                    value={mappingName}
                    onChange={(e) => setMappingName(e.target.value)}
                    placeholder="Enter mapping name (e.g., Zoho Contacts Export)"
                    className="w-full bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="ghost"
                onClick={() => setStep('mapping')}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || (saveMapping && !mappingName.trim())}
                className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white glow-sm hover:glow-md"
              >
                {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Import {csvData.length.toLocaleString()} Records
              </Button>
            </div>
          </div>
        )}

        {/* Step 4b: Importing Progress */}
        {step === 'importing' && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-teal-500/20 to-emerald-500/20 mb-6 animate-pulse">
              <Loader2 className="w-10 h-10 text-teal-600 dark:text-teal-400 animate-spin" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Importing Records...</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Please wait while we process your data
            </p>
            
            <div className="max-w-md mx-auto space-y-2">
              <Progress value={importProgress} className="h-2" />
              <p className="text-sm text-slate-500">{Math.round(importProgress)}% complete</p>
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && importResult && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 mb-6 glow-accent">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Import Complete!</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-8">
              Successfully imported {importResult.success.toLocaleString()} of {importResult.total.toLocaleString()} records
            </p>
            
            <div className="flex justify-center gap-6 mb-8">
              <div className="px-6 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{importResult.success.toLocaleString()}</span>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Imported</p>
              </div>
              {importResult.errors > 0 && (
                <div className="px-6 py-4 rounded-xl bg-red-500/10 border border-red-500/30">
                  <span className="text-3xl font-bold text-red-600 dark:text-red-400">{importResult.errors.toLocaleString()}</span>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Errors</p>
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={handleReset}
                className="border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-white/20"
              >
                Import More
              </Button>
              <Button
                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
                asChild
              >
                <Link href={`/crm/modules/${selectedModule?.key}`}>
                  View {selectedModule?.name_plural}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
