'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { CheckCircle, Circle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ImportWizardProvider, useImportWizard, STEP_INFO, type WizardStep } from './context';
import { EntityStep } from './steps/EntityStep';
import { UploadStep } from './steps/UploadStep';
import { MappingStep } from './steps/MappingStep';
import { PreviewStep } from './steps/PreviewStep';
import { ExecuteStep } from './steps/ExecuteStep';
import { CompleteStep } from './steps/CompleteStep';

// Step order for the stepper
const STEPS: WizardStep[] = ['entity', 'upload', 'mapping', 'preview', 'execute', 'complete'];

function StepIndicator({ 
  step, 
  currentStep, 
  index 
}: { 
  step: WizardStep; 
  currentStep: WizardStep;
  index: number;
}) {
  const currentIndex = STEPS.indexOf(currentStep);
  const stepIndex = STEPS.indexOf(step);
  const isCompleted = stepIndex < currentIndex;
  const isCurrent = step === currentStep;
  
  return (
    <div className="flex items-center">
      <div className={`
        flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors
        ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : ''}
        ${isCurrent ? 'border-blue-500 text-blue-500 bg-blue-50' : ''}
        ${!isCompleted && !isCurrent ? 'border-slate-300 text-slate-400' : ''}
      `}>
        {isCompleted ? (
          <CheckCircle className="w-5 h-5" />
        ) : (
          <span className="text-sm font-medium">{index + 1}</span>
        )}
      </div>
      <span className={`
        ml-2 text-sm font-medium hidden sm:block
        ${isCurrent ? 'text-slate-900' : 'text-slate-500'}
      `}>
        {STEP_INFO[step].title}
      </span>
    </div>
  );
}

function Stepper() {
  const { state } = useImportWizard();
  
  return (
    <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
      {STEPS.map((step, index) => (
        <div key={step} className="flex items-center">
          <StepIndicator step={step} currentStep={state.currentStep} index={index} />
          {index < STEPS.length - 1 && (
            <div className={`
              w-8 sm:w-16 h-0.5 mx-2
              ${STEPS.indexOf(state.currentStep) > index ? 'bg-emerald-500' : 'bg-slate-200'}
            `} />
          )}
        </div>
      ))}
    </div>
  );
}

function StepContent() {
  const { state } = useImportWizard();
  
  switch (state.currentStep) {
    case 'entity':
      return <EntityStep />;
    case 'upload':
      return <UploadStep />;
    case 'mapping':
      return <MappingStep />;
    case 'preview':
      return <PreviewStep />;
    case 'execute':
      return <ExecuteStep />;
    case 'complete':
      return <CompleteStep />;
    default:
      return null;
  }
}

function WizardContent() {
  const { state } = useImportWizard();
  const stepInfo = STEP_INFO[state.currentStep];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href="/settings/imports" 
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import Wizard</h1>
          <p className="text-slate-500">Migrate data from external systems</p>
        </div>
      </div>
      
      {/* Stepper */}
      <Stepper />
      
      {/* Step Card */}
      <Card>
        <CardHeader>
          <CardTitle>{stepInfo.title}</CardTitle>
          <p className="text-sm text-slate-500">{stepInfo.description}</p>
        </CardHeader>
        <CardContent>
          {state.error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {state.error}
            </div>
          )}
          <StepContent />
        </CardContent>
      </Card>
    </div>
  );
}

export function WizardClient() {
  return (
    <ImportWizardProvider>
      <WizardContent />
    </ImportWizardProvider>
  );
}
