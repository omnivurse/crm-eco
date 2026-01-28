'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Badge,
} from '@crm-eco/ui';
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Download,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

interface ImportLicensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId?: string;
  organizationId: string;
  onImportComplete: () => void;
}

type ImportType = 'licenses' | 'appointments';
type ImportStep = 'select' | 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

interface ParsedRow {
  [key: string]: string;
}

interface ValidationResult {
  row: number;
  valid: boolean;
  errors: string[];
  data: ParsedRow;
}

const LICENSE_FIELDS = [
  { key: 'state_code', label: 'State', required: true },
  { key: 'license_number', label: 'License Number', required: true },
  { key: 'license_type', label: 'License Type', required: false },
  { key: 'issue_date', label: 'Issue Date', required: false },
  { key: 'expiration_date', label: 'Expiration Date', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'ce_hours_required', label: 'CE Hours Required', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

const APPOINTMENT_FIELDS = [
  { key: 'carrier_name', label: 'Carrier Name', required: true },
  { key: 'carrier_code', label: 'Carrier Code', required: false },
  { key: 'appointment_number', label: 'Appointment Number', required: false },
  { key: 'appointment_type', label: 'Appointment Type', required: false },
  { key: 'states', label: 'States (comma-separated)', required: false },
  { key: 'effective_date', label: 'Effective Date', required: false },
  { key: 'commission_level', label: 'Commission Level', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

export function ImportLicensesModal({
  isOpen,
  onClose,
  agentId,
  organizationId,
  onImportComplete,
}: ImportLicensesModalProps) {
  const [importType, setImportType] = useState<ImportType>('licenses');
  const [step, setStep] = useState<ImportStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState({ success: 0, failed: 0 });

  const supabase = createClient();
  const fields = importType === 'licenses' ? LICENSE_FIELDS : APPOINTMENT_FIELDS;

  const resetState = () => {
    setStep('select');
    setFile(null);
    setParsedData([]);
    setCsvHeaders([]);
    setFieldMapping({});
    setValidationResults([]);
    setImportResults({ success: 0, failed: 0 });
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const parseCSV = (text: string): { headers: string[]; rows: ParsedRow[] } => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: ParsedRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }

    return { headers, rows };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setFile(selectedFile);

    const text = await selectedFile.text();
    const { headers, rows } = parseCSV(text);

    setCsvHeaders(headers);
    setParsedData(rows);

    // Auto-map fields
    const autoMapping: Record<string, string> = {};
    fields.forEach(field => {
      const match = headers.find(h =>
        h.toLowerCase().replace(/[_\s]/g, '') === field.key.toLowerCase().replace(/[_\s]/g, '') ||
        h.toLowerCase().includes(field.label.toLowerCase())
      );
      if (match) {
        autoMapping[field.key] = match;
      }
    });
    setFieldMapping(autoMapping);

    setStep('mapping');
  };

  const validateData = useCallback((): ValidationResult[] => {
    const results: ValidationResult[] = [];
    const requiredFields = fields.filter(f => f.required).map(f => f.key);

    parsedData.forEach((row, index) => {
      const errors: string[] = [];
      const mappedData: ParsedRow = {};

      // Map fields
      Object.entries(fieldMapping).forEach(([fieldKey, csvHeader]) => {
        mappedData[fieldKey] = row[csvHeader] || '';
      });

      // Validate required fields
      requiredFields.forEach(fieldKey => {
        if (!mappedData[fieldKey]) {
          const field = fields.find(f => f.key === fieldKey);
          errors.push(`${field?.label || fieldKey} is required`);
        }
      });

      // Validate state code for licenses
      if (importType === 'licenses' && mappedData.state_code) {
        const validStates = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'];
        if (!validStates.includes(mappedData.state_code.toUpperCase())) {
          errors.push('Invalid state code');
        }
      }

      results.push({
        row: index + 2, // +2 for header row and 0-indexing
        valid: errors.length === 0,
        errors,
        data: mappedData,
      });
    });

    return results;
  }, [parsedData, fieldMapping, fields, importType]);

  const handleValidate = () => {
    const results = validateData();
    setValidationResults(results);
    setStep('preview');
  };

  const handleImport = async () => {
    if (!organizationId) return;

    setIsProcessing(true);
    setStep('importing');

    let success = 0;
    let failed = 0;

    const validRows = validationResults.filter(r => r.valid);

    for (const result of validRows) {
      try {
        if (importType === 'licenses') {
          const data: Record<string, unknown> = {
            organization_id: organizationId,
            advisor_id: agentId,
            state_code: result.data.state_code?.toUpperCase(),
            license_number: result.data.license_number,
            license_type: result.data.license_type || 'life_health',
            issue_date: result.data.issue_date || null,
            expiration_date: result.data.expiration_date || null,
            status: result.data.status || 'active',
            ce_hours_required: result.data.ce_hours_required ? parseInt(result.data.ce_hours_required) : null,
            notes: result.data.notes || null,
          };

          const { error } = await (supabase as any).from('agent_licenses').insert(data);
          if (error) throw error;
        } else {
          const states = result.data.states
            ? result.data.states.split(',').map((s: string) => s.trim().toUpperCase())
            : [];

          const data: Record<string, unknown> = {
            organization_id: organizationId,
            advisor_id: agentId,
            carrier_name: result.data.carrier_name,
            carrier_code: result.data.carrier_code || null,
            appointment_number: result.data.appointment_number || null,
            appointment_type: result.data.appointment_type || 'writing',
            states,
            effective_date: result.data.effective_date || null,
            commission_level: result.data.commission_level || null,
            status: result.data.status || 'active',
            notes: result.data.notes || null,
          };

          const { error } = await (supabase as any).from('agent_appointments').insert(data);
          if (error) throw error;
        }
        success++;
      } catch (error) {
        console.error('Import error:', error);
        failed++;
      }
    }

    setImportResults({ success, failed });
    setIsProcessing(false);
    setStep('complete');

    if (success > 0) {
      onImportComplete();
    }
  };

  const downloadTemplate = () => {
    const headers = fields.map(f => f.key).join(',');
    const exampleRow = importType === 'licenses'
      ? 'TX,12345678,life_health,2024-01-01,2026-01-01,active,24,Notes here'
      : 'Blue Cross,BCBS001,APT123,writing,"TX,CA,FL",2024-01-01,Level 1,active,Notes here';

    const csv = `${headers}\n${exampleRow}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${importType}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = validationResults.filter(r => r.valid).length;
  const invalidCount = validationResults.filter(r => !r.valid).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import {importType === 'licenses' ? 'Licenses' : 'Appointments'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' && 'Select what you want to import'}
            {step === 'upload' && 'Upload a CSV file with the data to import'}
            {step === 'mapping' && 'Map CSV columns to data fields'}
            {step === 'preview' && 'Review the data before importing'}
            {step === 'importing' && 'Importing data...'}
            {step === 'complete' && 'Import complete'}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Select Import Type */}
        {step === 'select' && (
          <div className="space-y-4 py-4">
            <div
              onClick={() => { setImportType('licenses'); setStep('upload'); }}
              className={`border rounded-lg p-4 cursor-pointer hover:border-teal-500 transition-colors`}
            >
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-teal-600" />
                <div>
                  <p className="font-medium">Import Licenses</p>
                  <p className="text-sm text-slate-500">Bulk import state licenses for agents</p>
                </div>
                <ChevronRight className="h-5 w-5 ml-auto text-slate-400" />
              </div>
            </div>
            <div
              onClick={() => { setImportType('appointments'); setStep('upload'); }}
              className={`border rounded-lg p-4 cursor-pointer hover:border-teal-500 transition-colors`}
            >
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="font-medium">Import Carrier Appointments</p>
                  <p className="text-sm text-slate-500">Bulk import carrier appointment data</p>
                </div>
                <ChevronRight className="h-5 w-5 ml-auto text-slate-400" />
              </div>
            </div>
          </div>
        )}

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <p className="text-sm text-slate-600 mb-4">
                Upload a CSV file with {importType === 'licenses' ? 'license' : 'appointment'} data
              </p>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="max-w-xs mx-auto"
              />
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Need a template?</span>
              <Button variant="link" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" />
                Download Template
              </Button>
            </div>
            <div className="text-sm text-slate-500">
              <p className="font-medium mb-1">Required columns:</p>
              <p>{fields.filter(f => f.required).map(f => f.label).join(', ')}</p>
            </div>
          </div>
        )}

        {/* Step: Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4 py-4">
            <div className="text-sm text-slate-500 mb-4">
              <p>File: <span className="font-medium">{file?.name}</span></p>
              <p>{parsedData.length} row(s) detected</p>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {fields.map((field) => (
                <div key={field.key} className="flex items-center gap-4">
                  <Label className="w-40 flex items-center gap-1">
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                  </Label>
                  <select
                    className="flex-1 border rounded-lg px-3 py-2"
                    value={fieldMapping[field.key] || ''}
                    onChange={(e) => setFieldMapping({ ...fieldMapping, [field.key]: e.target.value })}
                  >
                    <option value="">— Select column —</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium">{validCount} valid</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="font-medium">{invalidCount} invalid</span>
              </div>
            </div>

            <div className="border rounded-lg max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Row</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {validationResults.slice(0, 50).map((result) => (
                    <tr key={result.row} className={result.valid ? '' : 'bg-red-50'}>
                      <td className="px-3 py-2">{result.row}</td>
                      <td className="px-3 py-2">
                        {result.valid ? (
                          <Badge variant="default">Valid</Badge>
                        ) : (
                          <Badge variant="destructive">Invalid</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {result.valid ? (
                          <span className="text-slate-600">
                            {importType === 'licenses'
                              ? `${result.data.state_code} - ${result.data.license_number}`
                              : result.data.carrier_name
                            }
                          </span>
                        ) : (
                          <span className="text-red-600">{result.errors.join(', ')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invalidCount > 0 && (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>Invalid rows will be skipped during import</span>
              </div>
            )}
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-teal-600 mx-auto mb-4" />
            <p className="text-lg font-medium">Importing data...</p>
            <p className="text-slate-500">Please wait while we process your file</p>
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <p className="text-xl font-medium mb-2">Import Complete</p>
            <div className="flex items-center justify-center gap-6 text-lg">
              <span className="text-green-600">{importResults.success} imported</span>
              {importResults.failed > 0 && (
                <span className="text-red-600">{importResults.failed} failed</span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {step !== 'select' && step !== 'importing' && step !== 'complete' && (
            <Button variant="outline" onClick={() => {
              if (step === 'upload') setStep('select');
              else if (step === 'mapping') setStep('upload');
              else if (step === 'preview') setStep('mapping');
            }}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          {step === 'select' && (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          )}
          {step === 'mapping' && (
            <Button onClick={handleValidate} disabled={!fields.filter(f => f.required).every(f => fieldMapping[f.key])}>
              Validate & Preview
            </Button>
          )}
          {step === 'preview' && (
            <Button onClick={handleImport} disabled={validCount === 0 || isProcessing}>
              Import {validCount} Record(s)
            </Button>
          )}
          {step === 'complete' && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
