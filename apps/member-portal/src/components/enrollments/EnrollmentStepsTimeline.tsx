import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { Check, User, Users, Heart, Checks, CreditCard, CheckCircle } from '@phosphor-icons/react/dist/ssr';
import { format } from 'date-fns';

// Step configuration with display info
const stepConfig: Record<string, { 
  label: string; 
  description: string;
  icon: React.ReactNode;
}> = {
  intake: {
    label: 'Your Information',
    description: 'Contact details and address',
    icon: <User weight="light" className="h-4 w-4" />,
  },
  household: {
    label: 'Household',
    description: 'Family members to include',
    icon: <Users weight="light" className="h-4 w-4" />,
  },
  plan_selection: {
    label: 'Plan Selection',
    description: 'Choose your coverage plan',
    icon: <Heart weight="light" className="h-4 w-4" />,
  },
  compliance: {
    label: 'Acknowledgments',
    description: 'Review and sign agreements',
    icon: <Checks weight="light" className="h-4 w-4" />,
  },
  payment: {
    label: 'Payment Setup',
    description: 'Billing preferences',
    icon: <CreditCard weight="light" className="h-4 w-4" />,
  },
  confirmation: {
    label: 'Confirmation',
    description: 'Review and submit',
    icon: <CheckCircle weight="light" className="h-4 w-4" />,
  },
};

// Ordered step keys
const STEP_ORDER = ['intake', 'household', 'plan_selection', 'compliance', 'payment', 'confirmation'];

interface EnrollmentStep {
  id: string;
  step_key: string;
  status: string;
  completed_at: string | null;
}

interface EnrollmentStepsTimelineProps {
  steps: EnrollmentStep[];
}

export function EnrollmentStepsTimeline({ steps }: EnrollmentStepsTimelineProps) {
  // Create a map for quick lookup
  const stepsMap = new Map(steps.map((s) => [s.step_key, s]));

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle weight="light" className="h-5 w-5 text-[var(--mp-teal)]" />
          Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="absolute bottom-3 left-4 top-3 w-0.5 bg-slate-200" />

          <div className="space-y-4">
            {STEP_ORDER.map((stepKey, index) => {
              const stepData = stepsMap.get(stepKey);
              const config = stepConfig[stepKey];
              const isCompleted = stepData?.status === 'completed';
              const isLast = index === STEP_ORDER.length - 1;

              return (
                <div key={stepKey} className="relative flex gap-4">
                  <div
                    className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                      isCompleted
                        ? 'border-[var(--mp-teal)] bg-[var(--mp-teal)] text-white'
                        : 'border-slate-300 bg-white text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Check weight="light" className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-medium">{index + 1}</span>
                    )}
                  </div>

                  <div className={`flex-1 pb-4 ${isLast ? 'pb-0' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className={`${isCompleted ? 'text-slate-400' : 'text-slate-600'}`}>
                        {config.icon}
                      </span>
                      <h4 className={`font-medium ${isCompleted ? 'text-slate-900' : 'text-slate-600'}`}>
                        {config.label}
                      </h4>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {config.description}
                    </p>
                    {isCompleted && stepData?.completed_at && (
                      <p className="mt-1 text-xs text-[var(--mp-teal)]">
                        Completed {format(new Date(stepData.completed_at), 'MMM d, yyyy')}
                      </p>
                    )}
                    {!isCompleted && (
                      <p className="mt-1 text-xs text-slate-400">
                        Pending
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
