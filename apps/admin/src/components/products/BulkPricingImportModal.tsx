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
  Badge,
} from '@crm-eco/ui';
import {
  Upload,
  Download,
  FileSpreadsheet,
  Loader2,
  Check,
  X,
  AlertTriangle,
  ArrowRight,
  Table,
} from 'lucide-react';
import { toast } from 'sonner';

interface BulkPricingImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  organizationId: string;
}

interface ParsedRow {
  iua_amount: number;
  age_min: number;
  age_max: number;
  benefit_type: string;
  price: number;
  tobacco_surcharge?: number;
  raw: Record<string, string>;
}

interface ValidationResult {
  valid: ParsedRow[];
  errors: Array<{ row: number; message: string; data: Record<string, string> }>;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

const REQUIRED_COLUMNS = ['iua_amount', 'age_min', 'age_max', 'price'];
const OPTIONAL_COLUMNS = ['benefit_type', 'tobacco_surcharge', 'effective_date'];

export function BulkPricingImportModal({
  isOpen,
  onClose,
  productId,
  productName,
  organizationId,
}: BulkPricingImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState<{ created: number; updated: number; errors: number }>({
    created: 0,
    updated: 0,
    errors: 0,
  });

  const supabase = createClient();

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setHeaders([]);
    setRows([]);
    setColumnMapping({});
    setValidationResult(null);
    setImportResults({ created: 0, updated: 0, errors: 0 });
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const parseCSV = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseRow = (line: string): string[] => {
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

    const headerRow = parseRow(lines[0]);
    const dataRows = lines.slice(1).map(line => {
      const values = parseRow(line);
      const row: Record<string, string> = {};
      headerRow.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    return { headers: headerRow, rows: dataRows };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);

    try {
      const text = await uploadedFile.text();
      const { headers: parsedHeaders, rows: parsedRows } = parseCSV(text);

      setHeaders(parsedHeaders);
      setRows(parsedRows);

      // Auto-map columns based on common names
      const mapping: Record<string, string> = {};
      parsedHeaders.forEach(header => {
        const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (normalized.includes('iua') || normalized.includes('deductible')) {
          mapping.iua_amount = header;
        } else if (normalized.includes('age') && normalized.includes('min')) {
          mapping.age_min = header;
        } else if (normalized.includes('age') && normalized.includes('max')) {
          mapping.age_max = header;
        } else if (normalized.includes('price') || normalized.includes('premium') || normalized.includes('amount')) {
          if (!mapping.price) mapping.price = header;
        } else if (normalized.includes('benefit') || normalized.includes('type')) {
          mapping.benefit_type = header;
        } else if (normalized.includes('tobacco')) {
          mapping.tobacco_surcharge = header;
        }
      });

      setColumnMapping(mapping);
      setStep('mapping');
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Failed to parse file');
    } finally {
      setIsProcessing(false);
    }
  };

  const validateData = useCallback((): ValidationResult => {
    const valid: ParsedRow[] = [];
    const errors: Array<{ row: number; message: string; data: Record<string, string> }> = [];

    rows.forEach((row, index) => {
      const rowNum = index + 2; // Account for header row

      // Get mapped values
      const iuaAmount = parseFloat(row[columnMapping.iua_amount] || '');
      const ageMin = parseInt(row[columnMapping.age_min] || '');
      const ageMax = parseInt(row[columnMapping.age_max] || '');
      const price = parseFloat(row[columnMapping.price] || '');
      const benefitType = row[columnMapping.benefit_type] || 'individual';
      const tobaccoSurcharge = columnMapping.tobacco_surcharge
        ? parseFloat(row[columnMapping.tobacco_surcharge] || '0')
        : undefined;

      // Validate required fields
      if (isNaN(iuaAmount)) {
        errors.push({ row: rowNum, message: 'Invalid IUA amount', data: row });
        return;
      }
      if (isNaN(ageMin) || isNaN(ageMax)) {
        errors.push({ row: rowNum, message: 'Invalid age range', data: row });
        return;
      }
      if (isNaN(price) || price < 0) {
        errors.push({ row: rowNum, message: 'Invalid price', data: row });
        return;
      }
      if (ageMin > ageMax) {
        errors.push({ row: rowNum, message: 'Min age cannot be greater than max age', data: row });
        return;
      }

      valid.push({
        iua_amount: iuaAmount,
        age_min: ageMin,
        age_max: ageMax,
        benefit_type: benefitType,
        price,
        tobacco_surcharge: tobaccoSurcharge,
        raw: row,
      });
    });

    return { valid, errors };
  }, [rows, columnMapping]);

  const handleProceedToPreview = () => {
    const result = validateData();
    setValidationResult(result);
    setStep('preview');
  };

  const handleImport = async () => {
    if (!validationResult) return;

    setStep('importing');
    setIsProcessing(true);

    let created = 0;
    let updated = 0;
    let errors = 0;

    try {
      // First, get or create IUA levels and age brackets
      const iuaAmounts = Array.from(new Set(validationResult.valid.map(r => r.iua_amount)));
      const ageBrackets = Array.from(new Set(validationResult.valid.map(r => `${r.age_min}-${r.age_max}`)));

      // Get existing IUA levels
      const sb = supabase as any;
      const { data: existingIuas } = await sb
        .from('product_iua')
        .select('id, amount')
        .eq('plan_id', productId);

      const iuaMap = new Map((existingIuas || []).map((i: { amount: number; id: string }) => [i.amount, i.id]));

      // Create missing IUA levels
      for (const amount of iuaAmounts) {
        if (!iuaMap.has(amount)) {
          const { data: newIua, error } = await sb
            .from('product_iua')
            .insert({ plan_id: productId, amount, sort_order: iuaMap.size })
            .select('id')
            .single();

          if (!error && newIua) {
            iuaMap.set(amount, (newIua as { id: string }).id);
          }
        }
      }

      // Get existing age brackets
      const { data: existingBrackets } = await sb
        .from('product_age_brackets')
        .select('id, min_age, max_age')
        .eq('plan_id', productId);

      const bracketMap = new Map(
        (existingBrackets || []).map((b: { min_age: number; max_age: number; id: string }) => [`${b.min_age}-${b.max_age}`, b.id])
      );

      // Create missing age brackets
      for (const bracket of ageBrackets) {
        if (!bracketMap.has(bracket)) {
          const [min, max] = bracket.split('-').map(Number);
          const { data: newBracket, error } = await sb
            .from('product_age_brackets')
            .insert({ plan_id: productId, min_age: min, max_age: max, sort_order: bracketMap.size })
            .select('id')
            .single();

          if (!error && newBracket) {
            bracketMap.set(bracket, (newBracket as { id: string }).id);
          }
        }
      }

      // Now upsert pricing matrix entries
      for (const row of validationResult.valid) {
        const iuaId = iuaMap.get(row.iua_amount);
        const bracketId = bracketMap.get(`${row.age_min}-${row.age_max}`);

        if (!iuaId || !bracketId) {
          errors++;
          continue;
        }

        // Check if pricing exists
        const { data: existingPricing } = await sb
          .from('product_pricing_matrix')
          .select('id')
          .eq('plan_id', productId)
          .eq('iua_id', iuaId)
          .eq('age_bracket_id', bracketId)
          .maybeSingle();

        const pricingData = {
          plan_id: productId,
          iua_id: iuaId,
          age_bracket_id: bracketId,
          price: row.price,
          tobacco_surcharge: row.tobacco_surcharge || 0,
        };

        if (existingPricing) {
          const { error } = await sb
            .from('product_pricing_matrix')
            .update(pricingData)
            .eq('id', (existingPricing as { id: string }).id);

          if (error) errors++;
          else updated++;
        } else {
          const { error } = await sb
            .from('product_pricing_matrix')
            .insert(pricingData);

          if (error) errors++;
          else created++;
        }
      }

      // Log the import
      await sb.from('product_audit_log').insert({
        organization_id: organizationId,
        plan_id: productId,
        action: 'bulk_import',
        entity_type: 'pricing',
        changes: {
          file_name: file?.name,
          rows_imported: validationResult.valid.length,
          created,
          updated,
          errors,
        },
      });

      setImportResults({ created, updated, errors });
      setStep('complete');
      toast.success(`Import complete: ${created} created, ${updated} updated`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed');
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['iua_amount', 'age_min', 'age_max', 'benefit_type', 'price', 'tobacco_surcharge'];
    const sampleData = [
      ['1000', '0', '29', 'individual', '199.99', '25'],
      ['1000', '30', '39', 'individual', '249.99', '30'],
      ['1000', '40', '49', 'individual', '299.99', '35'],
      ['2500', '0', '29', 'individual', '149.99', '20'],
      ['2500', '30', '39', 'individual', '199.99', '25'],
    ];

    const csv = [headers.join(','), ...sampleData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pricing_import_template_${productId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Pricing Import
          </DialogTitle>
          <DialogDescription>
            Import pricing data for {productName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 py-4 mb-4 border-b">
            {['upload', 'mapping', 'preview', 'complete'].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s ? 'bg-teal-600 text-white' :
                  ['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(step) > i
                    ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-400'
                }`}>
                  {i + 1}
                </div>
                {i < 3 && <ArrowRight className="h-4 w-4 text-slate-300" />}
              </div>
            ))}
          </div>

          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-6 py-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <p className="text-lg font-medium mb-2">Upload CSV File</p>
                <p className="text-sm text-slate-500 mb-4">
                  Upload a CSV file with pricing data
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="pricing-file-upload"
                />
                <label htmlFor="pricing-file-upload">
                  <Button asChild disabled={isProcessing}>
                    <span>
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Select File
                    </span>
                  </Button>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">Need a template?</p>
                  <p className="text-sm text-slate-500">
                    Download a sample CSV with the correct format
                  </p>
                </div>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <div className="text-sm text-slate-500">
                <p className="font-medium mb-2">Required columns:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>iua_amount - The IUA/deductible amount</li>
                  <li>age_min - Minimum age for this tier</li>
                  <li>age_max - Maximum age for this tier</li>
                  <li>price - Monthly premium amount</li>
                </ul>
                <p className="font-medium mt-3 mb-2">Optional columns:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>benefit_type - Coverage type (individual, family, etc.)</li>
                  <li>tobacco_surcharge - Additional charge for tobacco users</li>
                </ul>
              </div>
            </div>
          )}

          {/* Mapping Step */}
          {step === 'mapping' && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Table className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-blue-900">
                  Found {headers.length} columns and {rows.length} data rows
                </span>
              </div>

              <div className="space-y-4">
                <p className="font-medium">Map your columns:</p>

                {REQUIRED_COLUMNS.map((field) => (
                  <div key={field} className="flex items-center gap-4">
                    <div className="w-40">
                      <Badge variant="default">{field} *</Badge>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300" />
                    <select
                      className="flex-1 border rounded-lg px-3 py-2"
                      value={columnMapping[field] || ''}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                    >
                      <option value="">Select column...</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}

                {OPTIONAL_COLUMNS.map((field) => (
                  <div key={field} className="flex items-center gap-4">
                    <div className="w-40">
                      <Badge variant="outline">{field}</Badge>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300" />
                    <select
                      className="flex-1 border rounded-lg px-3 py-2"
                      value={columnMapping[field] || ''}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                    >
                      <option value="">Skip this field</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview first few rows */}
              {rows.length > 0 && (
                <div className="mt-6">
                  <p className="font-medium mb-2">Data preview (first 3 rows):</p>
                  <div className="overflow-x-auto border rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {headers.slice(0, 6).map((h) => (
                            <th key={h} className="px-3 py-2 text-left border-b">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 3).map((row, i) => (
                          <tr key={i}>
                            {headers.slice(0, 6).map((h) => (
                              <td key={h} className="px-3 py-2 border-b">{row[h]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && validationResult && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900">
                      {validationResult.valid.length} Valid Rows
                    </span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">Ready to import</p>
                </div>
                {validationResult.errors.length > 0 && (
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2">
                      <X className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-900">
                        {validationResult.errors.length} Errors
                      </span>
                    </div>
                    <p className="text-sm text-red-700 mt-1">Will be skipped</p>
                  </div>
                )}
              </div>

              {/* Validation Errors */}
              {validationResult.errors.length > 0 && (
                <div className="border rounded-lg">
                  <div className="px-4 py-2 bg-red-50 border-b">
                    <p className="font-medium text-red-900">Validation Errors</p>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {validationResult.errors.map((error, i) => (
                      <div key={i} className="px-4 py-2 border-b last:border-b-0 text-sm">
                        <span className="text-red-600">Row {error.row}:</span> {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Valid Data Preview */}
              {validationResult.valid.length > 0 && (
                <div className="border rounded-lg">
                  <div className="px-4 py-2 bg-slate-50 border-b">
                    <p className="font-medium">Data to Import (showing first 10)</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="px-3 py-2 text-left">IUA</th>
                          <th className="px-3 py-2 text-left">Age Range</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-right">Price</th>
                          <th className="px-3 py-2 text-right">Tobacco</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationResult.valid.slice(0, 10).map((row, i) => (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="px-3 py-2">${row.iua_amount.toLocaleString()}</td>
                            <td className="px-3 py-2">{row.age_min} - {row.age_max}</td>
                            <td className="px-3 py-2">{row.benefit_type}</td>
                            <td className="px-3 py-2 text-right">${row.price.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">
                              {row.tobacco_surcharge ? `$${row.tobacco_surcharge.toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Importing Step */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-teal-600 mb-4" />
              <p className="text-lg font-medium">Importing pricing data...</p>
              <p className="text-sm text-slate-500">This may take a moment</p>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-lg font-medium mb-4">Import Complete!</p>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-3xl font-bold text-green-600">{importResults.created}</p>
                  <p className="text-sm text-slate-500">Created</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-blue-600">{importResults.updated}</p>
                  <p className="text-sm text-slate-500">Updated</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-red-600">{importResults.errors}</p>
                  <p className="text-sm text-slate-500">Errors</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button
                onClick={handleProceedToPreview}
                disabled={!REQUIRED_COLUMNS.every(c => columnMapping[c])}
              >
                Continue
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={!validationResult || validationResult.valid.length === 0}
              >
                Import {validationResult?.valid.length || 0} Rows
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
