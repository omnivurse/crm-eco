'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import { Badge } from '@crm-eco/ui/components/badge';
import { Progress } from '@crm-eco/ui/components/progress';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmModule, CrmField, CrmProfile } from '@/lib/crm/types';
import {
  Upload,
  FileText,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  X,
  Download,
  Loader2,
  CheckCircle,
} from 'lucide-react';

type ImportStep = 'upload' | 'module' | 'mapping' | 'preview' | 'execute';

interface ImportWizardClientProps {
  modules: CrmModule[];
  moduleFields: Record<string, CrmField[]>;
  profile: CrmProfile;
}

interface ParsedRow {
  index: number;
  data: Record<string, string>;
  errors: string[];
  warnings: string[];
}

export function ImportWizardClient({
  modules,
  moduleFields,
  profile,
}: ImportWizardClientProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    inserted: number;
    updated: number;
    errors: number;
    errorRows: ParsedRow[];
  } | null>(null);
  const router = useRouter();

  const steps: { key: ImportStep; label: string }[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'module', label: 'Module' },
    { key: 'mapping', label: 'Mapping' },
    { key: 'preview', label: 'Preview' },
    { key: 'execute', label: 'Import' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);
  const selectedModule = modules.find((m) => m.id === selectedModuleId);
  const targetFields = selectedModuleId ? moduleFields[selectedModuleId] || [] : [];

  // Parse CSV
  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return;

    // Parse header row
    const headers = parseCSVLine(lines[0]);
    setSourceColumns(headers);

    // Parse data rows
    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const data: Record<string, string> = {};
      headers.forEach((header, idx) => {
        data[header] = values[idx] || '';
      });
      rows.push({
        index: i,
        data,
        errors: [],
        warnings: [],
      });
    }
    setParsedRows(rows);
  };

  const parseCSVLine = (line: string): string[] => {
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
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  // Auto-map columns
  const autoMapColumns = () => {
    const mapping: Record<string, string> = {};
    
    for (const sourceCol of sourceColumns) {
      const normalizedSource = sourceCol.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      // Try to find matching field
      const matchedField = targetFields.find((field) => {
        const normalizedField = field.key.toLowerCase();
        const normalizedLabel = field.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
        return normalizedSource === normalizedField ||
               normalizedSource === normalizedLabel ||
               normalizedSource.includes(normalizedField) ||
               normalizedField.includes(normalizedSource);
      });

      if (matchedField) {
        mapping[sourceCol] = matchedField.key;
      }
    }

    setColumnMapping(mapping);
  };

  // Validate rows
  const validateRows = useMemo(() => {
    return parsedRows.map((row) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check required fields
      for (const field of targetFields.filter((f) => f.required)) {
        const sourceCol = Object.entries(columnMapping).find(([, target]) => target === field.key)?.[0];
        if (!sourceCol || !row.data[sourceCol]?.trim()) {
          errors.push(`Missing required field: ${field.label}`);
        }
      }

      // Validate email format
      const emailField = Object.entries(columnMapping).find(([, target]) => target === 'email');
      if (emailField && row.data[emailField[0]]) {
        const email = row.data[emailField[0]];
        if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          warnings.push('Invalid email format');
        }
      }

      return { ...row, errors, warnings };
    });
  }, [parsedRows, columnMapping, targetFields]);

  const validRows = validateRows.filter((r) => r.errors.length === 0);
  const invalidRows = validateRows.filter((r) => r.errors.length > 0);

  // Handle import
  const handleImport = async () => {
    if (!selectedModuleId) return;

    setIsProcessing(true);
    try {
      // Transform data according to mapping
      const records = validRows.map((row) => {
        const data: Record<string, unknown> = {};
        for (const [source, target] of Object.entries(columnMapping)) {
          if (target && row.data[source]) {
            data[target] = row.data[source];
          }
        }
        return data;
      });

      const response = await fetch('/api/crm/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: profile.organization_id,
          module_id: selectedModuleId,
          records,
          file_name: fileName,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setImportResult({
          success: true,
          inserted: result.inserted || records.length,
          updated: result.updated || 0,
          errors: invalidRows.length,
          errorRows: invalidRows,
        });
      } else {
        setImportResult({
          success: false,
          inserted: 0,
          updated: 0,
          errors: parsedRows.length,
          errorRows: parsedRows,
        });
      }
    } catch (error) {
      console.error('Import failed:', error);
      setImportResult({
        success: false,
        inserted: 0,
        updated: 0,
        errors: parsedRows.length,
        errorRows: parsedRows,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'upload':
        return parsedRows.length > 0;
      case 'module':
        return !!selectedModuleId;
      case 'mapping':
        return Object.keys(columnMapping).length > 0;
      case 'preview':
        return validRows.length > 0;
      default:
        return true;
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      // Auto-map when entering mapping step
      if (steps[nextIndex].key === 'mapping') {
        autoMapColumns();
      }
      setCurrentStep(steps[nextIndex].key);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].key);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-navy-800">Import Data</h1>
        <p className="text-muted-foreground">
          Import records from CSV files into your CRM
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.key} className="flex items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  index < currentStepIndex
                    ? 'bg-brand-emerald-500 text-white'
                    : index === currentStepIndex
                    ? 'bg-brand-teal-500 text-white'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {index < currentStepIndex ? (
                  <Check className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  'ml-2 text-sm font-medium',
                  index <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'w-12 h-0.5 mx-4',
                    index < currentStepIndex ? 'bg-brand-emerald-500' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="mb-6">
        <CardContent className="p-6">
          {/* Upload Step */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <div>
                <Label>Upload CSV File</Label>
                <div className="mt-2 border-2 border-dashed rounded-lg p-8 text-center hover:border-brand-teal-500 transition-colors">
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">
                    Drag and drop a CSV file here, or click to browse
                  </p>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="max-w-xs mx-auto"
                  />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Or paste CSV data</span>
                </div>
              </div>

              <div>
                <Label>Paste CSV Data</Label>
                <Textarea
                  placeholder="Paste your CSV data here..."
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value);
                    parseCSV(e.target.value);
                  }}
                  rows={8}
                  className="mt-2 font-mono text-sm"
                />
              </div>

              {parsedRows.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-brand-teal-500" />
                  <span>
                    Found <strong>{parsedRows.length}</strong> rows with{' '}
                    <strong>{sourceColumns.length}</strong> columns
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Module Selection Step */}
          {currentStep === 'module' && (
            <div className="space-y-4">
              <div>
                <Label>Select Target Module</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose which module to import records into
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {modules.map((module) => (
                    <button
                      key={module.id}
                      onClick={() => setSelectedModuleId(module.id)}
                      className={cn(
                        'p-4 border rounded-lg text-left hover:border-brand-teal-500 transition-colors',
                        selectedModuleId === module.id && 'border-brand-teal-500 bg-brand-teal-50'
                      )}
                    >
                      <p className="font-medium">{module.name_plural || module.name + 's'}</p>
                      <p className="text-sm text-muted-foreground">{module.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mapping Step */}
          {currentStep === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Map Columns</Label>
                  <p className="text-sm text-muted-foreground">
                    Map your CSV columns to {selectedModule?.name} fields
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={autoMapColumns}>
                  Auto-Map
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source Column</TableHead>
                      <TableHead>Target Field</TableHead>
                      <TableHead className="w-20">Sample</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sourceColumns.map((col) => (
                      <TableRow key={col}>
                        <TableCell className="font-medium">{col}</TableCell>
                        <TableCell>
                          <Select
                            value={columnMapping[col] || ''}
                            onValueChange={(value) => {
                              setColumnMapping((prev) => ({
                                ...prev,
                                [col]: value,
                              }));
                            }}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Skip this column</SelectItem>
                              {targetFields.map((field) => (
                                <SelectItem key={field.key} value={field.key}>
                                  {field.label}
                                  {field.required && ' *'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-32">
                          {parsedRows[0]?.data[col] || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {currentStep === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Preview Import</Label>
                  <p className="text-sm text-muted-foreground">
                    Review the data before importing
                  </p>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1 text-brand-emerald-600">
                    <CheckCircle className="w-4 h-4" />
                    {validRows.length} valid
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="w-4 h-4" />
                      {invalidRows.length} errors
                    </span>
                  )}
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      {Object.entries(columnMapping)
                        .filter(([, target]) => target)
                        .slice(0, 5)
                        .map(([source, target]) => (
                          <TableHead key={target}>
                            {targetFields.find((f) => f.key === target)?.label || target}
                          </TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validateRows.slice(0, 20).map((row) => (
                      <TableRow key={row.index}>
                        <TableCell>{row.index}</TableCell>
                        <TableCell>
                          {row.errors.length > 0 ? (
                            <Badge variant="destructive" className="gap-1">
                              <X className="w-3 h-3" />
                              Error
                            </Badge>
                          ) : row.warnings.length > 0 ? (
                            <Badge variant="secondary" className="gap-1 bg-warning/20 text-warning">
                              <AlertTriangle className="w-3 h-3" />
                              Warning
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 bg-brand-emerald-100 text-brand-emerald-700">
                              <Check className="w-3 h-3" />
                              Valid
                            </Badge>
                          )}
                        </TableCell>
                        {Object.entries(columnMapping)
                          .filter(([, target]) => target)
                          .slice(0, 5)
                          .map(([source]) => (
                            <TableCell key={source} className="truncate max-w-32">
                              {row.data[source] || '—'}
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Execute Step */}
          {currentStep === 'execute' && (
            <div className="space-y-6">
              {!importResult ? (
                <div className="text-center py-8">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-12 h-12 animate-spin mx-auto text-brand-teal-500 mb-4" />
                      <p className="text-lg font-medium">Importing records...</p>
                      <p className="text-muted-foreground">This may take a moment</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-lg font-medium">Ready to Import</p>
                      <p className="text-muted-foreground mb-6">
                        {validRows.length} records will be imported into {selectedModule?.name_plural}
                      </p>
                      <Button
                        onClick={handleImport}
                        className="bg-brand-teal-600 hover:bg-brand-teal-700"
                      >
                        Start Import
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  {importResult.success ? (
                    <>
                      <CheckCircle className="w-12 h-12 mx-auto text-brand-emerald-500 mb-4" />
                      <p className="text-lg font-medium text-brand-emerald-600">
                        Import Completed Successfully
                      </p>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-12 h-12 mx-auto text-destructive mb-4" />
                      <p className="text-lg font-medium text-destructive">
                        Import Failed
                      </p>
                    </>
                  )}

                  <div className="flex justify-center gap-8 my-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-brand-emerald-600">
                        {importResult.inserted}
                      </p>
                      <p className="text-sm text-muted-foreground">Inserted</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-brand-teal-600">
                        {importResult.updated}
                      </p>
                      <p className="text-sm text-muted-foreground">Updated</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-destructive">
                        {importResult.errors}
                      </p>
                      <p className="text-sm text-muted-foreground">Errors</p>
                    </div>
                  </div>

                  <div className="flex justify-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/modules/${selectedModule?.key}`)}
                    >
                      View Records
                    </Button>
                    <Button
                      onClick={() => {
                        setCurrentStep('upload');
                        setCsvText('');
                        setParsedRows([]);
                        setColumnMapping({});
                        setImportResult(null);
                      }}
                    >
                      Import More
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      {currentStep !== 'execute' && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={currentStepIndex === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={goNext}
            disabled={!canProceed()}
            className="bg-brand-teal-600 hover:bg-brand-teal-700"
          >
            {currentStep === 'preview' ? 'Review & Import' : 'Continue'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
