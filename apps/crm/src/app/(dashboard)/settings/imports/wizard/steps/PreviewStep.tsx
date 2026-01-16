'use client';

import { useEffect, useState } from 'react';
import { Button } from '@crm-eco/ui';
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useImportWizard } from '../context';
import { validatePreview } from '../actions';
import { applyMapping } from '@crm-eco/lib';

export function PreviewStep() {
  const { state, dispatch, nextStep, prevStep, canProceed } = useImportWizard();
  const [isValidating, setIsValidating] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  
  // Run validation on mount or when mappings change
  useEffect(() => {
    runValidation();
  }, []); // Only run on mount - user can manually re-run
  
  const runValidation = async () => {
    if (!state.entityType) return;
    
    setIsValidating(true);
    try {
      // Apply mappings to rows
      const mappedRows = state.rows.map((row, index) => ({
        index: index + 1,
        data: applyMapping(row, state.mappings),
      }));
      
      const result = await validatePreview(
        state.entityType,
        mappedRows,
        state.duplicateStrategy
      );
      
      dispatch({ type: 'SET_VALIDATION_RESULT', result });
    } catch (err) {
      dispatch({ 
        type: 'SET_ERROR', 
        error: err instanceof Error ? err.message : 'Validation failed' 
      });
    } finally {
      setIsValidating(false);
    }
  };
  
  const validationResult = state.validationResult;
  const selectedRow = selectedRowIndex !== null 
    ? validationResult?.rows.find(r => r.rowIndex === selectedRowIndex + 1)
    : null;
  
  return (
    <div className="space-y-6">
      {/* Validation Status */}
      {isValidating ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mr-3" />
          <span className="text-slate-600">Validating {state.rows.length} rows...</span>
        </div>
      ) : validationResult ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-slate-900">{validationResult.totalRows}</div>
              <div className="text-sm text-slate-500">Total Rows</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-emerald-600">{validationResult.validRows}</div>
              <div className="text-sm text-slate-500">Valid</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{validationResult.errorRows}</div>
              <div className="text-sm text-slate-500">Errors</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-amber-600">{validationResult.warningRows}</div>
              <div className="text-sm text-slate-500">Warnings</div>
            </div>
          </div>
          
          {/* Summary Details */}
          {(validationResult.summary.duplicates > 0 || 
            validationResult.summary.orphaned > 0 ||
            validationResult.summary.missingRequired > 0) && (
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-slate-900">Validation Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {validationResult.summary.duplicates > 0 && (
                  <div className="text-slate-600">
                    <span className="font-medium">{validationResult.summary.duplicates}</span> existing records found
                  </div>
                )}
                {validationResult.summary.missingRequired > 0 && (
                  <div className="text-red-600">
                    <span className="font-medium">{validationResult.summary.missingRequired}</span> missing required fields
                  </div>
                )}
                {validationResult.summary.invalidFormat > 0 && (
                  <div className="text-red-600">
                    <span className="font-medium">{validationResult.summary.invalidFormat}</span> invalid format errors
                  </div>
                )}
                {validationResult.summary.orphaned > 0 && (
                  <div className="text-amber-600">
                    <span className="font-medium">{validationResult.summary.orphaned}</span> unlinked references
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Error/Warning Block */}
          {validationResult.errorRows > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                <AlertCircle className="w-5 h-5" />
                Cannot proceed with errors
              </div>
              <p className="text-sm text-red-700">
                Please fix the {validationResult.errorRows} row(s) with errors before importing. 
                Go back to adjust your field mappings or fix the source data.
              </p>
            </div>
          )}
          
          {/* Row Details Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-3 bg-slate-50 border-b">
              <h4 className="font-medium text-slate-900">Row Details</h4>
              <Button variant="outline" size="sm" onClick={runValidation} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Re-validate
              </Button>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-slate-700">Row</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-700">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-700">Match</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-700">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {validationResult.rows.slice(0, 100).map((row) => (
                    <tr 
                      key={row.rowIndex}
                      onClick={() => setSelectedRowIndex(row.rowIndex - 1)}
                      className={`
                        cursor-pointer hover:bg-slate-50
                        ${selectedRowIndex === row.rowIndex - 1 ? 'bg-blue-50' : ''}
                      `}
                    >
                      <td className="py-2 px-3 text-slate-600">#{row.rowIndex}</td>
                      <td className="py-2 px-3">
                        {row.isValid ? (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle className="w-4 h-4" />
                            Valid
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600">
                            <AlertCircle className="w-4 h-4" />
                            Error
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {row.matchType === 'new' && <span className="text-blue-600">New</span>}
                        {row.matchType === 'exact_match' && <span className="text-amber-600">Update</span>}
                        {row.matchType === 'fuzzy_match' && <span className="text-amber-600">Fuzzy Match</span>}
                        {row.matchType === 'duplicate' && <span className="text-red-600">Duplicate</span>}
                        {!row.matchType && '—'}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {row.errors.length > 0 && (
                            <span className="text-red-600 text-xs">
                              {row.errors.length} error(s)
                            </span>
                          )}
                          {row.warnings.length > 0 && (
                            <span className="text-amber-600 text-xs">
                              {row.warnings.length} warning(s)
                            </span>
                          )}
                          {row.errors.length === 0 && row.warnings.length === 0 && '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {validationResult.rows.length > 100 && (
                <div className="p-3 text-center text-sm text-slate-500 bg-slate-50 border-t">
                  Showing first 100 rows of {validationResult.rows.length}
                </div>
              )}
            </div>
          </div>
          
          {/* Selected Row Detail */}
          {selectedRow && (
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium text-slate-900">Row #{selectedRow.rowIndex} Details</h4>
              
              {selectedRow.errors.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-red-700">Errors</h5>
                  {selectedRow.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">{err.field}:</span> {err.message}
                        {err.value && <span className="text-red-400 ml-1">({err.value})</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {selectedRow.warnings.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-amber-700">Warnings</h5>
                  {selectedRow.warnings.map((warn, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">{warn.field}:</span> {warn.message}
                        {warn.value && <span className="text-amber-400 ml-1">({warn.value})</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Linked Entities */}
              {Object.keys(selectedRow.linkedEntities).length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-slate-700">Linked Entities</h5>
                  <div className="text-sm text-slate-600">
                    {Object.entries(selectedRow.linkedEntities).map(([key, value]) => (
                      <div key={key}>
                        {key}: {value ? <span className="text-emerald-600">{value}</span> : <span className="text-slate-400">Not found</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
      
      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={prevStep} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Mapping
        </Button>
        <Button 
          onClick={nextStep} 
          disabled={!canProceed() || isValidating} 
          className="gap-2"
        >
          Proceed to Import
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
