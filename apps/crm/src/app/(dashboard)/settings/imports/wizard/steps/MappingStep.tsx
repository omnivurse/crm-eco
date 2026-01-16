'use client';

import { useMemo } from 'react';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Label } from '@crm-eco/ui';
import { ArrowLeft, ArrowRight, ArrowRightLeft, Check, AlertCircle, Sparkles, RotateCcw } from 'lucide-react';
import { useImportWizard } from '../context';
import { autoMatchColumns } from '@crm-eco/lib';

export function MappingStep() {
  const { state, dispatch, nextStep, prevStep, canProceed } = useImportWizard();
  
  // Check which required fields are mapped
  const requiredMappingStatus = useMemo(() => {
    const required = state.targetColumns.filter(c => c.required);
    const mappedTargets = new Set(
      state.mappings
        .filter(m => m.targetColumn)
        .map(m => m.targetColumn)
    );
    
    return required.map(col => ({
      column: col.column,
      label: col.label,
      isMapped: mappedTargets.has(col.column),
    }));
  }, [state.targetColumns, state.mappings]);
  
  const unmappedRequired = requiredMappingStatus.filter(r => !r.isMapped);
  const autoMatchedCount = state.mappings.filter(m => m.isAutoMatched && m.targetColumn).length;
  
  const handleMappingChange = (sourceColumn: string, targetColumn: string | null) => {
    dispatch({
      type: 'UPDATE_MAPPING',
      sourceColumn,
      targetColumn: targetColumn === '_unmapped' ? null : targetColumn,
    });
  };
  
  const handleReAutoMatch = () => {
    const newMappings = autoMatchColumns(state.headers, state.targetColumns);
    dispatch({ type: 'SET_MAPPINGS', mappings: newMappings });
  };
  
  // Get already mapped targets to prevent duplicates
  const mappedTargets = new Set(
    state.mappings
      .filter(m => m.targetColumn)
      .map(m => m.targetColumn)
  );
  
  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4">
        <div className="flex items-center gap-6">
          {autoMatchedCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-slate-600">
                {autoMatchedCount} columns auto-matched
              </span>
            </div>
          )}
          {unmappedRequired.length > 0 ? (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span>{unmappedRequired.length} required fields unmapped</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <Check className="w-4 h-4" />
              <span>All required fields mapped</span>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleReAutoMatch} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Re-detect
        </Button>
      </div>
      
      {/* Unmapped Required Fields Warning */}
      {unmappedRequired.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-800 mb-2">Missing Required Mappings</h4>
          <div className="flex flex-wrap gap-2">
            {unmappedRequired.map(req => (
              <span 
                key={req.column}
                className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded"
              >
                {req.label}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Mapping Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-3 bg-slate-50 border-b font-medium text-sm text-slate-700">
          <div className="col-span-5">CSV Column</div>
          <div className="col-span-1 flex justify-center">
            <ArrowRightLeft className="w-4 h-4 text-slate-400" />
          </div>
          <div className="col-span-5">Database Field</div>
          <div className="col-span-1">Match</div>
        </div>
        
        <div className="divide-y max-h-[400px] overflow-y-auto">
          {state.mappings.map((mapping) => {
            const isRequired = state.targetColumns.find(
              c => c.column === mapping.targetColumn
            )?.required;
            
            return (
              <div 
                key={mapping.sourceColumn}
                className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-slate-50"
              >
                <div className="col-span-5">
                  <span className="text-sm font-medium text-slate-700">
                    {mapping.sourceColumn}
                  </span>
                </div>
                
                <div className="col-span-1 flex justify-center">
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                </div>
                
                <div className="col-span-5">
                  <Select
                    value={mapping.targetColumn || '_unmapped'}
                    onValueChange={(value) => handleMappingChange(mapping.sourceColumn, value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_unmapped">
                        <span className="text-slate-400">— Do not import —</span>
                      </SelectItem>
                      {state.targetColumns.map((col) => {
                        const isAlreadyMapped = mappedTargets.has(col.column) && 
                          mapping.targetColumn !== col.column;
                        
                        return (
                          <SelectItem 
                            key={col.column} 
                            value={col.column}
                            disabled={isAlreadyMapped}
                          >
                            <span className="flex items-center gap-2">
                              {col.label}
                              {col.required && (
                                <span className="text-xs text-red-500">*</span>
                              )}
                              {isAlreadyMapped && (
                                <span className="text-xs text-slate-400">(mapped)</span>
                              )}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="col-span-1 flex justify-center">
                  {mapping.targetColumn && (
                    <div className="flex items-center gap-1">
                      {mapping.isAutoMatched && mapping.confidence >= 0.9 ? (
                        <Sparkles className="w-4 h-4 text-amber-500" />
                      ) : mapping.isAutoMatched ? (
                        <Check className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Check className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>High confidence auto-match</span>
        </div>
        <div className="flex items-center gap-1">
          <Check className="w-3 h-3 text-blue-500" />
          <span>Auto-matched</span>
        </div>
        <div className="flex items-center gap-1">
          <Check className="w-3 h-3 text-emerald-500" />
          <span>Manual mapping</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-red-500">*</span>
          <span>Required field</span>
        </div>
      </div>
      
      {/* Options */}
      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="font-medium text-slate-900">Import Options</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Duplicate Handling</Label>
            <Select
              value={state.duplicateStrategy}
              onValueChange={(v) => dispatch({ 
                type: 'SET_DUPLICATE_STRATEGY', 
                strategy: v as 'skip' | 'update' | 'error' 
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="update">Update existing records</SelectItem>
                <SelectItem value="skip">Skip duplicates</SelectItem>
                <SelectItem value="error">Treat as error</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="incremental"
              checked={state.isIncremental}
              onChange={(e) => dispatch({ type: 'SET_INCREMENTAL', isIncremental: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300"
            />
            <Label htmlFor="incremental" className="cursor-pointer">
              Incremental import (only update changed fields)
            </Label>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={prevStep} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button onClick={nextStep} disabled={!canProceed()} className="gap-2">
          Continue to Preview
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
