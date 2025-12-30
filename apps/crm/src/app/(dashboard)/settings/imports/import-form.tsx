'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@crm-eco/ui';
import { Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { createImportJob, type ImportFormState } from './actions';
import { useState } from 'react';
import Link from 'next/link';

const initialState: ImportFormState = {};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  
  return (
    <Button type="submit" disabled={pending || disabled} className="gap-2">
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Importing...
        </>
      ) : (
        <>
          <Upload className="w-4 h-4" />
          Upload &amp; Import
        </>
      )}
    </Button>
  );
}

export function ImportForm() {
  const [state, formAction] = useFormState(createImportJob, initialState);
  const [entityType, setEntityType] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileName(file?.name || '');
  };

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          {state.error}
        </div>
      )}
      
      {state.success && state.result && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
            <CheckCircle className="w-5 h-5" />
            Import completed successfully!
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm text-green-600">
            <div>
              <span className="font-medium">{state.result.total}</span> Total
            </div>
            <div>
              <span className="font-medium">{state.result.inserted}</span> Inserted
            </div>
            <div>
              <span className="font-medium">{state.result.updated}</span> Updated
            </div>
            <div>
              <span className="font-medium">{state.result.errors.length}</span> Errors
            </div>
          </div>
          {state.jobId && (
            <div className="mt-3">
              <Link
                href={`/settings/imports/${state.jobId}`}
                className="text-sm text-green-700 hover:underline"
              >
                View import details →
              </Link>
            </div>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="entityType">Entity Type *</Label>
          <Select 
            name="entityType" 
            value={entityType} 
            onValueChange={setEntityType}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select entity type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Members</SelectItem>
              <SelectItem value="advisor">Advisors</SelectItem>
              <SelectItem value="lead">Leads</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            Choose the type of data you are importing
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="sourceName">Source Name (Optional)</Label>
          <Input
            id="sourceName"
            name="sourceName"
            placeholder="e.g., Legacy CRM, VendorX"
          />
          <p className="text-xs text-slate-500">
            Identify where this data came from
          </p>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="file">CSV File *</Label>
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-slate-300 transition-colors">
          <input
            type="file"
            id="file"
            name="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <label htmlFor="file" className="cursor-pointer">
            <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            {fileName ? (
              <p className="text-sm font-medium text-slate-700">{fileName}</p>
            ) : (
              <p className="text-sm text-slate-500">
                Click to upload or drag and drop
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1">CSV files only</p>
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Make sure your CSV has headers matching the expected columns (first_name, last_name, email, etc.)
        </p>
      </div>
      
      <div className="flex justify-end">
        <SubmitButton disabled={!entityType} />
      </div>
    </form>
  );
}

