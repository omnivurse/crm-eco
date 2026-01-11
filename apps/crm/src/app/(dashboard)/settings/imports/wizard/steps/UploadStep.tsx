'use client';

import { useCallback, useState } from 'react';
import { Button } from '@crm-eco/ui';
import { Upload, FileSpreadsheet, ArrowLeft, ArrowRight, X, CheckCircle } from 'lucide-react';
import { useImportWizard } from '../context';
import { parseCSV, autoMatchColumns } from '@crm-eco/lib';

export function UploadStep() {
  const { state, dispatch, nextStep, prevStep, canProceed } = useImportWizard();
  const [isDragging, setIsDragging] = useState(false);
  
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      dispatch({ type: 'SET_ERROR', error: 'Please upload a CSV file' });
      return;
    }
    
    try {
      const content = await file.text();
      const { headers, rows } = parseCSV(content);
      
      if (headers.length === 0) {
        dispatch({ type: 'SET_ERROR', error: 'CSV file appears to be empty or has no headers' });
        return;
      }
      
      if (rows.length === 0) {
        dispatch({ type: 'SET_ERROR', error: 'CSV file has headers but no data rows' });
        return;
      }
      
      // Store file data
      dispatch({
        type: 'SET_FILE_DATA',
        fileName: file.name,
        fileContent: content,
        headers,
        rows,
      });
      
      // Auto-match columns
      if (state.targetColumns.length > 0) {
        const mappings = autoMatchColumns(headers, state.targetColumns);
        dispatch({ type: 'SET_MAPPINGS', mappings });
      }
      
      dispatch({ type: 'CLEAR_ERROR' });
    } catch (err) {
      dispatch({ 
        type: 'SET_ERROR', 
        error: err instanceof Error ? err.message : 'Failed to parse CSV file' 
      });
    }
  }, [dispatch, state.targetColumns]);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);
  
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };
  
  const handleClearFile = () => {
    dispatch({
      type: 'SET_FILE_DATA',
      fileName: '',
      fileContent: '',
      headers: [],
      rows: [],
    });
  };
  
  return (
    <div className="space-y-6">
      {/* File Upload Zone */}
      {!state.fileName ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}
          `}
        >
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileInput}
            className="hidden"
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="cursor-pointer">
            <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
            <p className="text-lg font-medium text-slate-700">
              {isDragging ? 'Drop your CSV file here' : 'Drag & drop your CSV file'}
            </p>
            <p className="text-sm text-slate-500 mt-1">or click to browse</p>
            <p className="text-xs text-slate-400 mt-4">
              Supported format: CSV files with headers
            </p>
          </label>
        </div>
      ) : (
        <div className="border rounded-lg p-6 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{state.fileName}</span>
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-sm text-slate-500">
                  {state.rows.length} rows, {state.headers.length} columns
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClearFile}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Column Preview */}
          <div className="mt-6">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Detected Columns</h4>
            <div className="flex flex-wrap gap-2">
              {state.headers.map((header) => (
                <span 
                  key={header}
                  className="px-2 py-1 text-xs bg-white border rounded text-slate-600"
                >
                  {header}
                </span>
              ))}
            </div>
          </div>
          
          {/* Data Preview */}
          <div className="mt-6">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Data Preview (first 3 rows)</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {state.headers.slice(0, 6).map((header) => (
                      <th key={header} className="text-left py-2 px-3 font-medium text-slate-700 bg-white">
                        {header}
                      </th>
                    ))}
                    {state.headers.length > 6 && (
                      <th className="text-left py-2 px-3 font-medium text-slate-400 bg-white">
                        +{state.headers.length - 6} more
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {state.rows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-b bg-white">
                      {state.headers.slice(0, 6).map((header) => (
                        <td key={header} className="py-2 px-3 text-slate-600 truncate max-w-[200px]">
                          {row[header] || '—'}
                        </td>
                      ))}
                      {state.headers.length > 6 && (
                        <td className="py-2 px-3 text-slate-400">...</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={prevStep} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button onClick={nextStep} disabled={!canProceed()} className="gap-2">
          Continue
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
