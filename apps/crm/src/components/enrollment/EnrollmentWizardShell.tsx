'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  EnrollmentWizardProvider,
  WizardStepper,
  useEnrollmentWizard,
  type WizardStep,
  type WizardSnapshot,
  type StepStatus,
} from './wizard';
import {
  IntakeStep,
  HouseholdStep,
  PlanSelectionStep,
  ComplianceStep,
  PaymentStep,
  ConfirmationStep,
} from './steps';
import type { Member as CanonicalMember, Advisor as CanonicalAdvisor } from '@crm-eco/lib/types';

type Member = Pick<
  CanonicalMember,
  'id' | 'first_name' | 'last_name' | 'email' | 'state' | 'date_of_birth'
>;
type Advisor = Pick<CanonicalAdvisor, 'id' | 'first_name' | 'last_name'>;

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

export interface EnrollmentWizardBootstrap {
  members: Member[];
  leads: Lead[];
  advisors: Advisor[];
  plans: Plan[];
  isAdvisorRole: boolean;
  userRole?: 'owner' | 'admin' | 'advisor' | 'staff';
  currentAdvisorId?: string | null;
}

export interface EnrollmentWizardResumeData {
  enrollmentId: string;
  snapshot: WizardSnapshot;
  stepStatuses: Record<WizardStep, StepStatus>;
  initialStep: WizardStep;
}

interface EnrollmentWizardShellProps extends EnrollmentWizardBootstrap {
  isNew: boolean;
  resume?: EnrollmentWizardResumeData;
}

function WizardStepRenderer({ bootstrap }: { bootstrap: EnrollmentWizardBootstrap }) {
  const { currentStep } = useEnrollmentWizard();

  switch (currentStep) {
    case 'intake':
      return (
        <IntakeStep
          members={bootstrap.members}
          leads={bootstrap.leads}
          advisors={bootstrap.advisors}
          currentAdvisorId={bootstrap.currentAdvisorId}
          isAdvisorRole={bootstrap.isAdvisorRole}
          userRole={bootstrap.userRole}
        />
      );
    case 'household':
      return <HouseholdStep />;
    case 'plan_selection':
      return <PlanSelectionStep plans={bootstrap.plans} />;
    case 'compliance':
      return <ComplianceStep />;
    case 'payment':
      return <PaymentStep plans={bootstrap.plans} />;
    case 'confirmation':
      return (
        <ConfirmationStep
          members={bootstrap.members}
          plans={bootstrap.plans}
          advisors={bootstrap.advisors}
        />
      );
    default:
      return null;
  }
}

export function EnrollmentWizardShell({ isNew, resume, ...bootstrap }: EnrollmentWizardShellProps) {
  const initialEnrollmentId = isNew ? 'pending' : resume?.enrollmentId ?? null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/crm/enrollment"
          prefetch={false}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to enrollments
        </Link>
      </div>

      <EnrollmentWizardProvider
        initialEnrollmentId={initialEnrollmentId}
        initialStep={resume?.initialStep ?? 'intake'}
        initialSnapshot={resume?.snapshot ?? {}}
        initialStepStatuses={resume?.stepStatuses}
      >
        <WizardStepper />
        <WizardStepRenderer bootstrap={bootstrap} />
      </EnrollmentWizardProvider>
    </div>
  );
}
