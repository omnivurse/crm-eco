'use client';

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { 
  EntityType, 
  ColumnMapping, 
  TargetColumn,
  BatchValidationResult 
} from '@crm-eco/lib';

// ============================================================================
// TYPES
// ============================================================================

export type WizardStep = 
  | 'entity' 
  | 'upload' 
  | 'mapping' 
  | 'preview' 
  | 'execute' 
  | 'complete';

export interface WizardState {
  currentStep: WizardStep;
  entityType: EntityType | null;
  sourceName: string;
  
  // Upload data
  fileName: string | null;
  fileContent: string | null;
  headers: string[];
  rows: Record<string, string>[];
  
  // Mapping data
  mappings: ColumnMapping[];
  targetColumns: TargetColumn[];
  
  // Options
  duplicateStrategy: 'skip' | 'update' | 'error';
  isIncremental: boolean;
  
  // Validation results
  validationResult: BatchValidationResult | null;
  
  // Execution state
  isExecuting: boolean;
  importJobId: string | null;
  executionResult: {
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  } | null;
  
  // Errors
  error: string | null;
}

type WizardAction =
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SET_ENTITY_TYPE'; entityType: EntityType; targetColumns: TargetColumn[] }
  | { type: 'SET_SOURCE_NAME'; sourceName: string }
  | { type: 'SET_FILE_DATA'; fileName: string; fileContent: string; headers: string[]; rows: Record<string, string>[] }
  | { type: 'SET_MAPPINGS'; mappings: ColumnMapping[] }
  | { type: 'UPDATE_MAPPING'; sourceColumn: string; targetColumn: string | null }
  | { type: 'SET_DUPLICATE_STRATEGY'; strategy: 'skip' | 'update' | 'error' }
  | { type: 'SET_INCREMENTAL'; isIncremental: boolean }
  | { type: 'SET_VALIDATION_RESULT'; result: BatchValidationResult }
  | { type: 'START_EXECUTION' }
  | { type: 'SET_EXECUTION_RESULT'; jobId: string; result: WizardState['executionResult'] }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' };

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: WizardState = {
  currentStep: 'entity',
  entityType: null,
  sourceName: 'zoho_crm',
  fileName: null,
  fileContent: null,
  headers: [],
  rows: [],
  mappings: [],
  targetColumns: [],
  duplicateStrategy: 'update',
  isIncremental: false,
  validationResult: null,
  isExecuting: false,
  importJobId: null,
  executionResult: null,
  error: null,
};

// ============================================================================
// REDUCER
// ============================================================================

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step, error: null };
      
    case 'SET_ENTITY_TYPE':
      return { 
        ...state, 
        entityType: action.entityType, 
        targetColumns: action.targetColumns,
        // Reset downstream state when entity type changes
        mappings: [],
        validationResult: null,
      };
      
    case 'SET_SOURCE_NAME':
      return { ...state, sourceName: action.sourceName };
      
    case 'SET_FILE_DATA':
      return {
        ...state,
        fileName: action.fileName,
        fileContent: action.fileContent,
        headers: action.headers,
        rows: action.rows,
        // Reset downstream state when file changes
        mappings: [],
        validationResult: null,
      };
      
    case 'SET_MAPPINGS':
      return { ...state, mappings: action.mappings };
      
    case 'UPDATE_MAPPING':
      return {
        ...state,
        mappings: state.mappings.map(m => 
          m.sourceColumn === action.sourceColumn
            ? { ...m, targetColumn: action.targetColumn, isAutoMatched: false }
            : m
        ),
        validationResult: null, // Reset validation when mapping changes
      };
      
    case 'SET_DUPLICATE_STRATEGY':
      return { ...state, duplicateStrategy: action.strategy };
      
    case 'SET_INCREMENTAL':
      return { ...state, isIncremental: action.isIncremental };
      
    case 'SET_VALIDATION_RESULT':
      return { ...state, validationResult: action.result };
      
    case 'START_EXECUTION':
      return { ...state, isExecuting: true, error: null };
      
    case 'SET_EXECUTION_RESULT':
      return {
        ...state,
        isExecuting: false,
        importJobId: action.jobId,
        executionResult: action.result,
        currentStep: 'complete',
      };
      
    case 'SET_ERROR':
      return { ...state, error: action.error, isExecuting: false };
      
    case 'CLEAR_ERROR':
      return { ...state, error: null };
      
    case 'RESET':
      return initialState;
      
    default:
      return state;
  }
}

// ============================================================================
// CONTEXT
// ============================================================================

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  
  // Helper actions
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  canProceed: () => boolean;
}

const WizardContext = createContext<WizardContextValue | null>(null);

// ============================================================================
// STEP ORDER
// ============================================================================

const STEP_ORDER: WizardStep[] = ['entity', 'upload', 'mapping', 'preview', 'execute', 'complete'];

// ============================================================================
// PROVIDER
// ============================================================================

export function ImportWizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  
  const goToStep = (step: WizardStep) => {
    dispatch({ type: 'SET_STEP', step });
  };
  
  const nextStep = () => {
    const currentIndex = STEP_ORDER.indexOf(state.currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      dispatch({ type: 'SET_STEP', step: STEP_ORDER[currentIndex + 1] });
    }
  };
  
  const prevStep = () => {
    const currentIndex = STEP_ORDER.indexOf(state.currentStep);
    if (currentIndex > 0) {
      dispatch({ type: 'SET_STEP', step: STEP_ORDER[currentIndex - 1] });
    }
  };
  
  const canProceed = (): boolean => {
    switch (state.currentStep) {
      case 'entity':
        return !!state.entityType;
      case 'upload':
        return state.rows.length > 0;
      case 'mapping':
        // Check that required fields are mapped
        const requiredColumns = state.targetColumns.filter(c => c.required);
        const mappedTargets = state.mappings
          .filter(m => m.targetColumn)
          .map(m => m.targetColumn);
        return requiredColumns.every(c => mappedTargets.includes(c.column));
      case 'preview':
        return state.validationResult !== null && state.validationResult.errorRows === 0;
      case 'execute':
        return true;
      case 'complete':
        return true;
      default:
        return false;
    }
  };
  
  return (
    <WizardContext.Provider value={{ state, dispatch, goToStep, nextStep, prevStep, canProceed }}>
      {children}
    </WizardContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useImportWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useImportWizard must be used within an ImportWizardProvider');
  }
  return context;
}

// ============================================================================
// STEP INFO
// ============================================================================

export const STEP_INFO: Record<WizardStep, { title: string; description: string }> = {
  entity: {
    title: 'Select Entity Type',
    description: 'Choose what type of data you are importing',
  },
  upload: {
    title: 'Upload CSV',
    description: 'Upload your CSV file with the data to import',
  },
  mapping: {
    title: 'Map Fields',
    description: 'Map your CSV columns to database fields',
  },
  preview: {
    title: 'Preview & Validate',
    description: 'Review and validate your data before importing',
  },
  execute: {
    title: 'Import',
    description: 'Execute the import and track progress',
  },
  complete: {
    title: 'Complete',
    description: 'Import finished - review results',
  },
};

// Entity type info for the wizard
export const ENTITY_INFO: Record<EntityType, { 
  label: string; 
  description: string; 
  order: number;
  dependencies: EntityType[];
}> = {
  plan: {
    label: 'Plans',
    description: 'Import plan definitions (should be imported first)',
    order: 1,
    dependencies: [],
  },
  advisor: {
    label: 'Advisors',
    description: 'Import advisor/agent records',
    order: 2,
    dependencies: [],
  },
  member: {
    label: 'Members',
    description: 'Import member records (can link to advisors)',
    order: 3,
    dependencies: ['advisor'],
  },
  lead: {
    label: 'Leads',
    description: 'Import lead/prospect records (can link to advisors)',
    order: 4,
    dependencies: ['advisor'],
  },
  membership: {
    label: 'Memberships',
    description: 'Import membership records (requires members and plans)',
    order: 5,
    dependencies: ['member', 'plan'],
  },
};
