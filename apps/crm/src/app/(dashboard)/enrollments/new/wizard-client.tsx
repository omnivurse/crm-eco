'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@crm-eco/ui';
import { Loader2 } from 'lucide-react';
import { 
  EnrollmentWizardProvider, 
  useEnrollmentWizard, 
  WizardStepper,
  type WizardStep 
} from '@/components/enrollment/wizard';
import {
  IntakeStep,
  HouseholdStep,
  PlanSelectionStep,
  ComplianceStep,
  PaymentStep,
  ConfirmationStep,
} from '@/components/enrollment/steps';
import { initializeEnrollment } from './actions';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  state: string | null;
  date_of_birth: string | null;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface Plan {
  id: string;
  name: string;
  code: string;
  description: string | null;
  tier: string | null;
  monthly_share: number | null;
  iua_amount: number | null;
  enrollment_fee: number | null;
}

interface Advisor {
  id: string;
  first_name: string;
  last_name: string;
}

interface EnrollmentWizardClientProps {
  members: Member[];
  leads: Lead[];
  plans: Plan[];
  advisors: Advisor[];
  currentAdvisorId: string | null;
  isAdvisorRole: boolean;
}

function WizardContent({
  members,
  leads,
  plans,
  advisors,
  currentAdvisorId,
  isAdvisorRole,
}: EnrollmentWizardClientProps) {
  const { currentStep, enrollmentId, setEnrollmentId, setIsLoading, setError } = useEnrollmentWizard();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    async function init() {
      if (enrollmentId) {
        setInitializing(false);
        return;
      }

      setIsLoading(true);
      const result = await initializeEnrollment(currentAdvisorId);
      
      if (result.success && result.data) {
        setEnrollmentId(result.data.enrollmentId);
      } else {
        setError(result.error || 'Failed to initialize enrollment');
      }
      
      setIsLoading(false);
      setInitializing(false);
    }

    init();
  }, [enrollmentId, currentAdvisorId, setEnrollmentId, setIsLoading, setError]);

  if (initializing) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          <span className="ml-3 text-slate-500">Initializing enrollment...</span>
        </CardContent>
      </Card>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'intake':
        return (
          <IntakeStep
            members={members}
            leads={leads}
            advisors={advisors}
            currentAdvisorId={currentAdvisorId}
            isAdvisorRole={isAdvisorRole}
          />
        );
      case 'household':
        return <HouseholdStep />;
      case 'plan_selection':
        return <PlanSelectionStep plans={plans} />;
      case 'compliance':
        return <ComplianceStep />;
      case 'payment':
        return <PaymentStep plans={plans} />;
      case 'confirmation':
        return <ConfirmationStep members={members} plans={plans} advisors={advisors} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <WizardStepper />
      {renderStep()}
    </div>
  );
}

export function EnrollmentWizardClient(props: EnrollmentWizardClientProps) {
  return (
    <EnrollmentWizardProvider>
      <WizardContent {...props} />
    </EnrollmentWizardProvider>
  );
}
