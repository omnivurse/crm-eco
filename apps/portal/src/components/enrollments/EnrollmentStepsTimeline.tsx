import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { Check, Circle, User, Users, Heart, FileCheck, CreditCard, CheckCircle } from 'lucide-react';
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
    icon: <User className="w-4 h-4" />,
  },
  household: {
    label: 'Household',
    description: 'Family members to include',
    icon: <Users className="w-4 h-4" />,
  },
  plan_selection: {
    label: 'Plan Selection',
    description: 'Choose your coverage plan',
    icon: <Heart className="w-4 h-4" />,
  },
  compliance: {
    label: 'Acknowledgments',
    description: 'Review and sign agreements',
    icon: <FileCheck className="w-4 h-4" />,
  },
  payment: {
    label: 'Payment Setup',
    description: 'Billing preferences',
    icon: <CreditCard className="w-4 h-4" />,
  },
  confirmation: {
    label: 'Confirmation',
    description: 'Review and submit',
    icon: <CheckCircle className="w-4 h-4" />,
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
          <CheckCircle className="w-5 h-5 text-blue-600" />
          Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical line connecting steps */}
          <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-slate-200" />

          <div className="space-y-4">
            {STEP_ORDER.map((stepKey, index) => {
              const stepData = stepsMap.get(stepKey);
              const config = stepConfig[stepKey];
              const isCompleted = stepData?.status === 'completed';
              const isLast = index === STEP_ORDER.length - 1;

              return (
                <div key={stepKey} className="relative flex gap-4">
                  {/* Step indicator */}
                  <div
                    className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                      isCompleted
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'bg-white border-slate-300 text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <span className="text-xs font-medium">{index + 1}</span>
                    )}
                  </div>

                  {/* Step content */}
                  <div className={`flex-1 pb-4 ${isLast ? 'pb-0' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className={`${isCompleted ? 'text-slate-400' : 'text-slate-600'}`}>
                        {config.icon}
                      </span>
                      <h4 className={`font-medium ${isCompleted ? 'text-slate-900' : 'text-slate-600'}`}>
                        {config.label}
                      </h4>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {config.description}
                    </p>
                    {isCompleted && stepData?.completed_at && (
                      <p className="text-xs text-green-600 mt-1">
                        Completed {format(new Date(stepData.completed_at), 'MMM d, yyyy')}
                      </p>
                    )}
                    {!isCompleted && (
                      <p className="text-xs text-slate-400 mt-1">
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

