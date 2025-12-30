'use client';

import { CheckCircle, Circle } from 'lucide-react';
import { cn } from '@crm-eco/ui';
import { useEnrollmentWizard, WIZARD_STEPS, WizardStep } from './EnrollmentWizardProvider';

export function WizardStepper() {
  const { currentStep, stepStatuses, isStepAccessible, goToStep } = useEnrollmentWizard();

  return (
    <nav aria-label="Enrollment progress" className="mb-8">
      <ol className="flex items-center justify-between">
        {WIZARD_STEPS.map((step, index) => {
          const isActive = currentStep === step.key;
          const isCompleted = stepStatuses[step.key]?.isCompleted;
          const isAccessible = isStepAccessible(step.key);

          return (
            <li key={step.key} className="flex-1">
              <div className="flex flex-col items-center">
                {/* Step connector line (not for first step) */}
                <div className="flex items-center w-full">
                  {index > 0 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 transition-colors',
                        stepStatuses[WIZARD_STEPS[index - 1].key]?.isCompleted
                          ? 'bg-blue-600'
                          : 'bg-slate-200'
                      )}
                    />
                  )}
                  
                  {/* Step circle */}
                  <button
                    type="button"
                    onClick={() => isAccessible && goToStep(step.key)}
                    disabled={!isAccessible}
                    className={cn(
                      'relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all',
                      isActive && !isCompleted && 'border-blue-600 bg-blue-50',
                      isCompleted && 'border-blue-600 bg-blue-600',
                      !isActive && !isCompleted && 'border-slate-300 bg-white',
                      isAccessible && !isActive && 'cursor-pointer hover:border-blue-400',
                      !isAccessible && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6 text-white" />
                    ) : (
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          isActive ? 'text-blue-600' : 'text-slate-400'
                        )}
                      >
                        {index + 1}
                      </span>
                    )}
                  </button>

                  {/* Step connector line (not for last step) */}
                  {index < WIZARD_STEPS.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 transition-colors',
                        isCompleted ? 'bg-blue-600' : 'bg-slate-200'
                      )}
                    />
                  )}
                </div>

                {/* Step label */}
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isActive ? 'text-blue-600' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-slate-400 hidden md:block">{step.description}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

