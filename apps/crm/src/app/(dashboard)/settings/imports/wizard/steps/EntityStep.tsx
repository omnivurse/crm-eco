'use client';

import { Button, Input, Label } from '@crm-eco/ui';
import { Users, UserCheck, UserPlus, FileText, CreditCard, ArrowRight, Info } from 'lucide-react';
import { useImportWizard, ENTITY_INFO } from '../context';
import { TARGET_COLUMNS, type EntityType } from '@crm-eco/lib';

const ENTITY_ICONS: Record<EntityType, React.ReactNode> = {
  plan: <FileText className="w-6 h-6" />,
  advisor: <UserCheck className="w-6 h-6" />,
  member: <Users className="w-6 h-6" />,
  lead: <UserPlus className="w-6 h-6" />,
  membership: <CreditCard className="w-6 h-6" />,
};

export function EntityStep() {
  const { state, dispatch, nextStep, canProceed } = useImportWizard();
  
  const handleSelectEntity = (entityType: EntityType) => {
    dispatch({ 
      type: 'SET_ENTITY_TYPE', 
      entityType, 
      targetColumns: TARGET_COLUMNS[entityType] 
    });
  };
  
  const sortedEntities = Object.entries(ENTITY_INFO)
    .sort(([, a], [, b]) => a.order - b.order) as [EntityType, typeof ENTITY_INFO[EntityType]][];
  
  return (
    <div className="space-y-6">
      {/* Source Name Input */}
      <div className="space-y-2">
        <Label htmlFor="sourceName">Source System Name</Label>
        <Input
          id="sourceName"
          value={state.sourceName}
          onChange={(e) => dispatch({ type: 'SET_SOURCE_NAME', sourceName: e.target.value })}
          placeholder="e.g., zoho_crm, legacy_system"
          className="max-w-md"
        />
        <p className="text-xs text-slate-500">
          This helps identify where the data came from and enables saving field mappings for reuse.
        </p>
      </div>
      
      {/* Entity Type Selection */}
      <div className="space-y-3">
        <Label>Select Entity Type to Import</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedEntities.map(([entityType, info]) => (
            <button
              key={entityType}
              onClick={() => handleSelectEntity(entityType)}
              className={`
                p-4 rounded-lg border-2 text-left transition-all
                ${state.entityType === entityType 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div className={`
                  p-2 rounded-lg
                  ${state.entityType === entityType ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}
                `}>
                  {ENTITY_ICONS[entityType]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{info.label}</span>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                      #{info.order}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{info.description}</p>
                  {info.dependencies.length > 0 && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Import {info.dependencies.join(', ')} first
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Import Order Info */}
      <div className="bg-slate-50 rounded-lg p-4">
        <h4 className="font-medium text-slate-900 mb-2">Recommended Import Order</h4>
        <div className="flex flex-wrap gap-2">
          {sortedEntities.map(([entityType, info], index) => (
            <div key={entityType} className="flex items-center gap-1">
              <span className="text-sm font-medium text-slate-600">
                {index + 1}. {info.label}
              </span>
              {index < sortedEntities.length - 1 && (
                <ArrowRight className="w-4 h-4 text-slate-400" />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Following this order ensures relationships can be properly linked during import.
        </p>
      </div>
      
      {/* Navigation */}
      <div className="flex justify-end pt-4 border-t">
        <Button 
          onClick={nextStep} 
          disabled={!canProceed()}
          className="gap-2"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
