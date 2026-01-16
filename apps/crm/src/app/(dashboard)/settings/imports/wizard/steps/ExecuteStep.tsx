'use client';

import { useState } from 'react';
import { Button } from '@crm-eco/ui';
import { ArrowLeft, Play, Loader2, AlertTriangle, Shield } from 'lucide-react';
import { useImportWizard } from '../context';
import { executeImport } from '../actions';
import { applyMapping, mappingsToObject } from '@crm-eco/lib';

export function ExecuteStep() {
  const { state, dispatch, prevStep } = useImportWizard();
  const [isExecuting, setIsExecuting] = useState(false);
  
  const handleExecute = async () => {
    if (!state.entityType) return;
    
    setIsExecuting(true);
    dispatch({ type: 'START_EXECUTION' });
    
    try {
      // Apply mappings to rows
      const mappedRows = state.rows.map((row, index) => ({
        index: index + 1,
        data: applyMapping(row, state.mappings),
      }));
      
      const result = await executeImport({
        entityType: state.entityType,
        sourceName: state.sourceName,
        fileName: state.fileName || 'import.csv',
        rows: mappedRows,
        mapping: mappingsToObject(state.mappings),
        duplicateStrategy: state.duplicateStrategy,
        isIncremental: state.isIncremental,
        validationResult: state.validationResult,
      });
      
      if (result.error) {
        dispatch({ type: 'SET_ERROR', error: result.error });
      } else {
        dispatch({
          type: 'SET_EXECUTION_RESULT',
          jobId: result.jobId!,
          result: result.result!,
        });
      }
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Import failed',
      });
    } finally {
      setIsExecuting(false);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Confirmation Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-4">Ready to Import</h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-blue-600">Entity Type:</span>
            <span className="ml-2 font-medium text-blue-900 capitalize">{state.entityType}</span>
          </div>
          <div>
            <span className="text-blue-600">Source:</span>
            <span className="ml-2 font-medium text-blue-900">{state.sourceName}</span>
          </div>
          <div>
            <span className="text-blue-600">Total Rows:</span>
            <span className="ml-2 font-medium text-blue-900">{state.rows.length}</span>
          </div>
          <div>
            <span className="text-blue-600">Valid Rows:</span>
            <span className="ml-2 font-medium text-blue-900">{state.validationResult?.validRows || 0}</span>
          </div>
          <div>
            <span className="text-blue-600">Duplicate Strategy:</span>
            <span className="ml-2 font-medium text-blue-900 capitalize">{state.duplicateStrategy}</span>
          </div>
          <div>
            <span className="text-blue-600">Incremental:</span>
            <span className="ml-2 font-medium text-blue-900">{state.isIncremental ? 'Yes' : 'No'}</span>
          </div>
        </div>
        
        {/* Existing records warning */}
        {state.validationResult && state.validationResult.summary.duplicates > 0 && (
          <div className="mt-4 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <strong>{state.validationResult.summary.duplicates}</strong> existing records will be{' '}
              {state.duplicateStrategy === 'update' ? 'updated' : 
               state.duplicateStrategy === 'skip' ? 'skipped' : 'flagged as errors'}.
            </div>
          </div>
        )}
      </div>
      
      {/* Rollback Info */}
      <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4">
        <Shield className="w-5 h-5 text-slate-500 mt-0.5" />
        <div className="text-sm text-slate-600">
          <strong className="text-slate-900">Rollback Protection Enabled</strong>
          <p className="mt-1">
            A snapshot of all changes will be saved. If something goes wrong, you can rollback 
            this import from the import history page.
          </p>
        </div>
      </div>
      
      {/* Execution Progress */}
      {isExecuting && (
        <div className="bg-white border rounded-lg p-8 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Importing Data...</h3>
          <p className="text-sm text-slate-500 mt-2">
            Processing {state.rows.length} rows. This may take a moment.
          </p>
          <div className="mt-4 w-full bg-slate-200 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}
      
      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button 
          variant="outline" 
          onClick={prevStep} 
          disabled={isExecuting}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Preview
        </Button>
        <Button 
          onClick={handleExecute} 
          disabled={isExecuting}
          className="gap-2"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Start Import
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
