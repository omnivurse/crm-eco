'use client';

import { Button } from '@crm-eco/ui';
import { CheckCircle, XCircle, ArrowRight, RotateCcw, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { useImportWizard } from '../context';

export function CompleteStep() {
  const { state, dispatch } = useImportWizard();
  const result = state.executionResult;
  
  const isSuccess = result && result.errors === 0;
  const hasPartialSuccess = result && result.errors > 0 && (result.inserted > 0 || result.updated > 0);
  
  const handleStartNew = () => {
    dispatch({ type: 'RESET' });
  };
  
  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={`
        rounded-lg p-8 text-center
        ${isSuccess ? 'bg-emerald-50 border border-emerald-200' : 
          hasPartialSuccess ? 'bg-amber-50 border border-amber-200' : 
          'bg-red-50 border border-red-200'}
      `}>
        {isSuccess ? (
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        ) : hasPartialSuccess ? (
          <CheckCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        ) : (
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        )}
        
        <h2 className={`text-2xl font-bold mb-2 ${
          isSuccess ? 'text-emerald-900' : 
          hasPartialSuccess ? 'text-amber-900' : 
          'text-red-900'
        }`}>
          {isSuccess ? 'Import Completed Successfully!' : 
           hasPartialSuccess ? 'Import Completed with Errors' : 
           'Import Failed'}
        </h2>
        
        <p className={`text-sm ${
          isSuccess ? 'text-emerald-700' : 
          hasPartialSuccess ? 'text-amber-700' : 
          'text-red-700'
        }`}>
          {isSuccess 
            ? `All ${result?.total} records have been processed successfully.`
            : hasPartialSuccess 
              ? `${(result?.inserted || 0) + (result?.updated || 0)} records processed, ${result?.errors} errors.`
              : 'No records were imported. Please check the error details.'}
        </p>
      </div>
      
      {/* Results Summary */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-slate-900">{result.total}</div>
            <div className="text-sm text-slate-500">Total</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{result.inserted}</div>
            <div className="text-sm text-slate-500">Inserted</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{result.updated}</div>
            <div className="text-sm text-slate-500">Updated</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-slate-600">{result.skipped}</div>
            <div className="text-sm text-slate-500">Skipped</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{result.errors}</div>
            <div className="text-sm text-slate-500">Errors</div>
          </div>
        </div>
      )}
      
      {/* Job Details Link */}
      {state.importJobId && (
        <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-slate-500" />
            <div>
              <div className="font-medium text-slate-900">Import Job Details</div>
              <div className="text-sm text-slate-500">
                View detailed row-by-row results and rollback options
              </div>
            </div>
          </div>
          <Link href={`/settings/imports/${state.importJobId}`}>
            <Button variant="outline" size="sm" className="gap-2">
              View Details
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      )}
      
      {/* Next Steps */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-medium text-slate-900">Next Steps</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {state.entityType === 'advisor' && (
            <Link href="/settings/imports/wizard" onClick={() => dispatch({ type: 'RESET' })}>
              <div className="p-3 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="font-medium text-slate-900">Import Members</div>
                <div className="text-sm text-slate-500">Now that advisors are imported, you can link members to them</div>
              </div>
            </Link>
          )}
          {state.entityType === 'plan' && (
            <Link href="/settings/imports/wizard" onClick={() => dispatch({ type: 'RESET' })}>
              <div className="p-3 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="font-medium text-slate-900">Import Memberships</div>
                <div className="text-sm text-slate-500">Link members to plans with membership records</div>
              </div>
            </Link>
          )}
          <Link href={`/${state.entityType}s`}>
            <div className="p-3 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="font-medium text-slate-900">View Imported {state.entityType}s</div>
              <div className="text-sm text-slate-500">Review the imported data in the CRM</div>
            </div>
          </Link>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <Link href="/settings/imports">
          <Button variant="outline" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            View All Imports
          </Button>
        </Link>
        <Button onClick={handleStartNew} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Start New Import
        </Button>
      </div>
    </div>
  );
}
