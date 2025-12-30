'use client';

import { Button } from '@crm-eco/ui';
import { ChevronLeft, ChevronRight, Loader2, CheckCircle } from 'lucide-react';
import { useEnrollmentWizard, WIZARD_STEPS } from './EnrollmentWizardProvider';

interface WizardNavigationProps {
  onNext?: () => Promise<void> | void;
  onBack?: () => void;
  onSubmit?: () => Promise<void> | void;
  nextLabel?: string;
  backLabel?: string;
  submitLabel?: string;
  isNextDisabled?: boolean;
  showSubmit?: boolean;
}

export function WizardNavigation({
  onNext,
  onBack,
  onSubmit,
  nextLabel = 'Continue',
  backLabel = 'Back',
  submitLabel = 'Submit Enrollment',
  isNextDisabled = false,
  showSubmit = false,
}: WizardNavigationProps) {
  const { currentStep, currentStepIndex, prevStep, isLoading } = useEnrollmentWizard();

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      prevStep();
    }
  };

  return (
    <div className="flex items-center justify-between pt-6 border-t border-slate-200 mt-6">
      <div>
        {!isFirstStep && (
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={isLoading}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {backLabel}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {showSubmit || isLastStep ? (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isNextDisabled || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                {submitLabel}
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onNext}
            disabled={isNextDisabled || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                {nextLabel}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

