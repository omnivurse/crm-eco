'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Progress,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ScrollArea,
  Switch,
  Label,
} from '@crm-eco/ui';
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  AlertCircle,
  Loader2,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

type ImportType = 'member' | 'agent';
type WizardStep = 'upload' | 'mapping' | 'validation' | 'processing' | 'complete';

interface ImportWizardProps {
  importType: ImportType;
  organizationId: string;
  profileId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

// Target fields for each import type
const targetFields: Record<ImportType, { field: string; label: string; required: boolean }[]> = {
  member: [
    { field: 'first_name', label: 'First Name', required: true },
    { field: 'last_name', label: 'Last Name', required: true },
    { field: 'email', label: 'Email', required: true },
    { field: 'phone', label: 'Phone', required: false },
    { field: 'date_of_birth', label: 'Date of Birth', required: false },
    { field: 'gender', label: 'Gender', required: false },
    { field: 'address_line1', label: 'Address Line 1', required: false },
    { field: 'address_line2', label: 'Address Line 2', required: false },
    { field: 'city', label: 'City', required: false },
    { field: 'state', label: 'State', required: false },
    { field: 'zip_code', label: 'Zip Code', required: false },
    { field: 'member_id', label: 'Member ID', required: false },
    { field: 'status', label: 'Status', required: false },
    { field: 'effective_date', label: 'Effective Date', required: false },
    { field: 'termination_date', label: 'Termination Date', required: false },
    { field: 'plan_name', label: 'Plan Name', required: false },
    { field: 'advisor_email', label: 'Advisor Email', required: false },
    { field: 'notes', label: 'Notes', required: false },
  ],
  agent: [
    { field: 'first_name', label: 'First Name', required: true },
    { field: 'last_name', label: 'Last Name', required: true },
    { field: 'email', label: 'Email', required: true },
    { field: 'phone', label: 'Phone', required: false },
    { field: 'agency_name', label: 'Agency Name', required: false },
    { field: 'license_number', label: 'License Number', required: false },
    { field: 'license_state', label: 'License State', required: false },
    { field: 'npn', label: 'NPN', required: false },
    { field: 'address_line1', label: 'Address Line 1', required: false },
    { field: 'city', label: 'City', required: false },
    { field: 'state', label: 'State', required: false },
    { field: 'zip_code', label: 'Zip Code', required: false },
    { field: 'status', label: 'Status', required: false },
    { field: 'upline_email', label: 'Upline Email', required: false },
    { field: 'commission_tier', label: 'Commission Tier', required: false },
    { field: 'notes', label: 'Notes', required: false },
  ],
};

export function ImportWizard({
  importType,
  organizationId,
  profileId,
  onComplete,
  onCancel,
}: ImportWizardProps) {
  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<{
    valid: number;
    invalid: number;
    errors: { row: number; field: string; message: string }[];
  } | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');
  const [results, setResults] = useState<{
    total: number;
    success: number;
    errors: number;
    skipped: number;
  } | null>(null);
  const [options, setOptions] = useState({
    skipDuplicates: true,
    updateExisting: false,
  });
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  // Parse CSV file
  const parseCSV = useCallback((text: string): { columns: string[]; data: Record<string, string>[] } => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return { columns: [], data: [] };

    // Parse header
    const columns = lines[0].split(',').map(col => col.trim().replace(/^"|"$/g, ''));

    // Parse data rows
    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(val => val.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      columns.forEach((col, i) => {
        row[col] = values[i] || '';
      });
      return row;
    });

    return { columns, data };
  }, []);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setFile(uploadedFile);
    setLoading(true);

    try {
      const text = await uploadedFile.text();
      const { columns, data } = parseCSV(text);

      if (columns.length === 0 || data.length === 0) {
        toast.error('Could not parse CSV file. Please check the format.');
        return;
      }

      setSourceColumns(columns);
      setParsedData(data);

      // Auto-map fields based on common patterns
      const autoMapping: Record<string, string> = {};
      const fields = targetFields[importType];

      columns.forEach(col => {
        const normalizedCol = col.toLowerCase().replace(/[_\s-]/g, '');
        const matchedField = fields.find(f => {
          const normalizedField = f.field.toLowerCase().replace(/_/g, '');
          const normalizedLabel = f.label.toLowerCase().replace(/\s/g, '');
          return normalizedCol === normalizedField ||
            normalizedCol === normalizedLabel ||
            normalizedCol.includes(normalizedField) ||
            normalizedField.includes(normalizedCol);
        });
        if (matchedField) {
          autoMapping[col] = matchedField.field;
        }
      });

      setFieldMapping(autoMapping);
      toast.success(`Loaded ${data.length} rows from ${uploadedFile.name}`);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Error reading file');
    } finally {
      setLoading(false);
    }
  };

  // Validate data
  const validateData = useCallback(() => {
    const fields = targetFields[importType];
    const requiredFields = fields.filter(f => f.required).map(f => f.field);
    const mappedRequiredFields = Object.entries(fieldMapping)
      .filter(([_, target]) => requiredFields.includes(target))
      .map(([source]) => source);

    const errors: { row: number; field: string; message: string }[] = [];
    let validCount = 0;

    parsedData.forEach((row, index) => {
      let rowValid = true;

      // Check required fields
      requiredFields.forEach(reqField => {
        const sourceCol = Object.entries(fieldMapping).find(([_, target]) => target === reqField)?.[0];
        if (!sourceCol || !row[sourceCol]?.trim()) {
          errors.push({
            row: index + 1,
            field: reqField,
            message: `Missing required field: ${fields.find(f => f.field === reqField)?.label}`,
          });
          rowValid = false;
        }
      });

      // Validate email format
      const emailCol = Object.entries(fieldMapping).find(([_, target]) => target === 'email')?.[0];
      if (emailCol && row[emailCol]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(row[emailCol])) {
          errors.push({
            row: index + 1,
            field: 'email',
            message: 'Invalid email format',
          });
          rowValid = false;
        }
      }

      if (rowValid) validCount++;
    });

    setValidationResults({
      valid: validCount,
      invalid: parsedData.length - validCount,
      errors: errors.slice(0, 100), // Limit to first 100 errors for display
    });
  }, [parsedData, fieldMapping, importType]);

  // Process import
  const processImport = async () => {
    setProcessingStatus('processing');
    setProcessingProgress(0);

    try {
      // Create import job record
      const { data: job, error: jobError } = await (supabase as any)
        .from('import_jobs')
        .insert({
          organization_id: organizationId,
          import_type: importType,
          file_name: file?.name || 'unknown',
          file_size: file?.size,
          file_type: 'csv',
          status: 'processing',
          field_mapping: fieldMapping,
          total_rows: parsedData.length,
          options,
          created_by: profileId,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (jobError) throw jobError;

      setImportJobId((job as { id: string }).id);

      // Process in batches
      const batchSize = 50;
      let successCount = 0;
      let errorCount = 0;
      let skipCount = 0;

      for (let i = 0; i < parsedData.length; i += batchSize) {
        const batch = parsedData.slice(i, i + batchSize);

        for (const row of batch) {
          try {
            // Map data
            const mappedData: Record<string, any> = {};
            Object.entries(fieldMapping).forEach(([source, target]) => {
              if (row[source]) {
                mappedData[target] = row[source];
              }
            });

            // Add organization_id
            mappedData.organization_id = organizationId;

            // Insert based on type
            const sb = supabase as any;
            if (importType === 'member') {
              const { error } = await sb.from('members').insert({
                first_name: mappedData.first_name,
                last_name: mappedData.last_name,
                email: mappedData.email,
                phone: mappedData.phone,
                date_of_birth: mappedData.date_of_birth || null,
                organization_id: organizationId,
                status: mappedData.status || 'active',
              });

              if (error) {
                if (error.code === '23505' && options.skipDuplicates) {
                  skipCount++;
                } else {
                  throw error;
                }
              } else {
                successCount++;
              }
            } else if (importType === 'agent') {
              const { error } = await sb.from('advisors').insert({
                first_name: mappedData.first_name,
                last_name: mappedData.last_name,
                email: mappedData.email,
                phone: mappedData.phone,
                organization_id: organizationId,
                status: mappedData.status || 'active',
              });

              if (error) {
                if (error.code === '23505' && options.skipDuplicates) {
                  skipCount++;
                } else {
                  throw error;
                }
              } else {
                successCount++;
              }
            }
          } catch (err) {
            errorCount++;
            console.error('Error importing row:', err);
          }
        }

        setProcessingProgress(Math.round(((i + batch.length) / parsedData.length) * 100));
      }

      // Update job with results
      await (supabase as any)
        .from('import_jobs')
        .update({
          status: 'completed',
          processed_rows: parsedData.length,
          success_count: successCount,
          error_count: errorCount,
          skip_count: skipCount,
          completed_at: new Date().toISOString(),
        })
        .eq('id', (job as { id: string }).id);

      setResults({
        total: parsedData.length,
        success: successCount,
        errors: errorCount,
        skipped: skipCount,
      });

      setProcessingStatus('complete');
      setStep('complete');

      // Log activity
      await (supabase as any).rpc('log_admin_activity', {
        p_actor_profile_id: profileId,
        p_entity_type: importType,
        p_entity_id: (job as { id: string }).id,
        p_action: 'import',
        p_metadata: { count: successCount, errors: errorCount, skipped: skipCount },
      }).catch(() => {});

    } catch (error: any) {
      console.error('Import error:', error);
      setProcessingStatus('error');
      toast.error(error.message || 'Import failed');
    }
  };

  const steps = [
    { key: 'upload', label: 'Upload File' },
    { key: 'mapping', label: 'Map Fields' },
    { key: 'validation', label: 'Validate' },
    { key: 'processing', label: 'Import' },
    { key: 'complete', label: 'Complete' },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              i < currentStepIndex
                ? 'bg-emerald-500 text-white'
                : i === currentStepIndex
                ? 'bg-[#047474] text-white'
                : 'bg-slate-200 text-slate-500'
            }`}>
              {i < currentStepIndex ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`ml-2 text-sm ${
              i <= currentStepIndex ? 'text-slate-700 font-medium' : 'text-slate-400'
            }`}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-4 ${
                i < currentStepIndex ? 'bg-emerald-500' : 'bg-slate-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  Upload {importType === 'member' ? 'Members' : 'Agents'} File
                </h2>
                <p className="text-slate-500">Upload a CSV file with your data</p>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-[#047474] transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  {loading ? (
                    <Loader2 className="w-12 h-12 text-slate-400 mx-auto mb-4 animate-spin" />
                  ) : file ? (
                    <FileSpreadsheet className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                  ) : (
                    <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  )}
                  {file ? (
                    <div>
                      <p className="font-medium text-slate-700">{file.name}</p>
                      <p className="text-sm text-slate-500">{parsedData.length} rows loaded</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-slate-700">Click to upload or drag and drop</p>
                      <p className="text-sm text-slate-500">CSV files only</p>
                    </div>
                  )}
                </label>
              </div>

              {parsedData.length > 0 && (
                <div>
                  <h3 className="font-medium text-slate-700 mb-2">Preview (first 5 rows)</h3>
                  <ScrollArea className="h-48 border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {sourceColumns.map(col => (
                            <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.slice(0, 5).map((row, i) => (
                          <TableRow key={i}>
                            {sourceColumns.map(col => (
                              <TableCell key={col} className="whitespace-nowrap">
                                {row[col] || '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {/* Mapping Step */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Map Fields</h2>
                <p className="text-slate-500">Match your file columns to system fields</p>
              </div>

              <div className="space-y-3">
                {targetFields[importType].map(field => (
                  <div key={field.field} className="flex items-center gap-4">
                    <div className="w-48">
                      <span className="text-sm font-medium text-slate-700">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                    </div>
                    <ArrowLeft className="w-4 h-4 text-slate-400" />
                    <Select
                      value={Object.entries(fieldMapping).find(([_, target]) => target === field.field)?.[0] || ''}
                      onValueChange={(sourceCol) => {
                        const newMapping = { ...fieldMapping };
                        // Remove old mapping for this target
                        Object.keys(newMapping).forEach(key => {
                          if (newMapping[key] === field.field) delete newMapping[key];
                        });
                        // Add new mapping
                        if (sourceCol) {
                          newMapping[sourceCol] = field.field;
                        }
                        setFieldMapping(newMapping);
                      }}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">-- Not mapped --</SelectItem>
                        {sourceColumns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-medium text-slate-700 mb-3">Import Options</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="skip-duplicates"
                      checked={options.skipDuplicates}
                      onCheckedChange={(checked) => setOptions({ ...options, skipDuplicates: checked })}
                    />
                    <Label htmlFor="skip-duplicates">Skip duplicate records (by email)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="update-existing"
                      checked={options.updateExisting}
                      onCheckedChange={(checked) => setOptions({ ...options, updateExisting: checked })}
                    />
                    <Label htmlFor="update-existing">Update existing records</Label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validation Step */}
          {step === 'validation' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Validation Results</h2>
                <p className="text-slate-500">Review data before importing</p>
              </div>

              {validationResults && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                          <div>
                            <p className="text-2xl font-bold text-slate-900">{validationResults.valid}</p>
                            <p className="text-sm text-slate-500">Valid rows</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-8 h-8 text-red-500" />
                          <div>
                            <p className="text-2xl font-bold text-slate-900">{validationResults.invalid}</p>
                            <p className="text-sm text-slate-500">Invalid rows</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet className="w-8 h-8 text-slate-500" />
                          <div>
                            <p className="text-2xl font-bold text-slate-900">{parsedData.length}</p>
                            <p className="text-sm text-slate-500">Total rows</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {validationResults.errors.length > 0 && (
                    <div>
                      <h3 className="font-medium text-slate-700 mb-2">
                        Errors ({validationResults.errors.length})
                      </h3>
                      <ScrollArea className="h-48 border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Row</TableHead>
                              <TableHead>Field</TableHead>
                              <TableHead>Error</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {validationResults.errors.map((err, i) => (
                              <TableRow key={i}>
                                <TableCell>{err.row}</TableCell>
                                <TableCell>{err.field}</TableCell>
                                <TableCell className="text-red-600">{err.message}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <div className="space-y-6 text-center py-8">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  {processingStatus === 'processing' ? 'Importing Data...' : 'Import Complete'}
                </h2>
                <p className="text-slate-500">
                  {processingStatus === 'processing'
                    ? 'Please wait while we process your data'
                    : 'Your data has been imported'}
                </p>
              </div>

              <div className="max-w-md mx-auto">
                <Progress value={processingProgress} className="h-2" />
                <p className="text-sm text-slate-500 mt-2">{processingProgress}% complete</p>
              </div>

              {processingStatus === 'processing' && (
                <Loader2 className="w-8 h-8 animate-spin text-[#047474] mx-auto" />
              )}
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && results && (
            <div className="space-y-6 text-center py-8">
              <div>
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Import Complete</h2>
              </div>

              <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-slate-900">{results.total}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg">
                  <p className="text-2xl font-bold text-emerald-600">{results.success}</p>
                  <p className="text-xs text-slate-500">Imported</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600">{results.skipped}</p>
                  <p className="text-xs text-slate-500">Skipped</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{results.errors}</p>
                  <p className="text-xs text-slate-500">Errors</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {step !== 'complete' && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {step === 'mapping' && (
            <Button variant="outline" onClick={() => setStep('upload')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {step === 'validation' && (
            <Button variant="outline" onClick={() => setStep('mapping')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}

          {step === 'upload' && parsedData.length > 0 && (
            <Button onClick={() => setStep('mapping')}>
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {step === 'mapping' && (
            <Button onClick={() => {
              validateData();
              setStep('validation');
            }}>
              Validate
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {step === 'validation' && validationResults && (
            <Button
              onClick={() => {
                setStep('processing');
                processImport();
              }}
              disabled={validationResults.valid === 0}
            >
              Import {validationResults.valid} Rows
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {step === 'complete' && (
            <Button onClick={onComplete}>
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
