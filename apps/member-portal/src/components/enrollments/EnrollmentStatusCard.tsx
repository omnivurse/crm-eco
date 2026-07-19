import { Card, CardContent, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import { FileText, Calendar, Warning, Clock, CheckCircle, XCircle } from '@phosphor-icons/react/dist/ssr';
import { format } from 'date-fns';

// Status mapping for member-friendly display
const statusConfig: Record<string, { 
  label: string; 
  className: string; 
  icon: React.ReactNode;
  message: string;
}> = {
  draft: {
    label: 'Draft - Not Submitted',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <FileText weight="light" className="h-3 w-3" />,
    message: 'You have not submitted this enrollment yet. Complete all steps and submit to apply for membership.',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <Clock weight="light" className="h-3 w-3" />,
    message: 'Your enrollment is in progress. Complete the remaining steps to submit your application.',
  },
  submitted: {
    label: 'Submitted - Under Review',
    className: 'border-[rgba(11,109,133,0.15)] bg-[rgba(11,109,133,0.08)] text-[var(--mp-teal)]',
    icon: <Clock weight="light" className="h-3 w-3" />,
    message: 'Your enrollment has been submitted and is under review by our team. We will contact you if we need any additional information.',
  },
  pending_review: {
    label: 'Under Review',
    className: 'border-[rgba(11,109,133,0.15)] bg-[rgba(11,109,133,0.08)] text-[var(--mp-teal)]',
    icon: <Clock weight="light" className="h-3 w-3" />,
    message: 'Your enrollment is being reviewed by our team. We will reach out if we need anything further.',
  },
  more_info: {
    label: 'Action Needed',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <Warning weight="light" className="h-3 w-3" />,
    message: 'Our team needs more information to continue reviewing your enrollment. Please review the request below and respond.',
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle weight="light" className="h-3 w-3" />,
    message: 'Your enrollment has been approved! Your membership has been created and you can now access your benefits.',
  },
  rejected: {
    label: 'Not Approved',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: <XCircle weight="light" className="h-3 w-3" />,
    message: 'This enrollment was not approved. Please contact support for more information about next steps.',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: <XCircle weight="light" className="h-3 w-3" />,
    message: 'This enrollment has been cancelled. If you believe this is an error, please contact support.',
  },
};

interface EnrollmentStatusCardProps {
  enrollment: {
    id: string;
    enrollment_number: string | null;
    status: string;
    requested_effective_date: string | null;
    effective_date: string | null;
    has_mandate_warning: boolean;
    has_age65_warning: boolean;
    updated_at: string;
    plans: {
      name: string;
      code: string;
      monthly_share: number;
    } | null;
  };
  membership: {
    id: string;
    membership_number: string | null;
    status: string;
  } | null;
}

export function EnrollmentStatusCard({ enrollment, membership }: EnrollmentStatusCardProps) {
  const config = statusConfig[enrollment.status] || statusConfig.draft;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText weight="light" className="h-5 w-5 text-[var(--mp-teal)]" />
            Enrollment Status
          </CardTitle>
          <Badge className={`${config.className} border font-medium`}>
            {config.icon}
            <span className="ml-1">{config.label}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-sm text-slate-700">{config.message}</p>
        </div>

        {membership && (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
            <CheckCircle weight="light" className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">
                Membership Created
              </p>
              <p className="text-sm text-green-700">
                #{membership.membership_number || 'Pending'} • Status: {membership.status}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {enrollment.enrollment_number && (
            <div className="flex items-start gap-2">
              <FileText weight="light" className="mt-0.5 h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Enrollment Number</p>
                <p className="text-sm font-medium text-slate-900">
                  {enrollment.enrollment_number}
                </p>
              </div>
            </div>
          )}

          {enrollment.plans && (
            <div className="flex items-start gap-2">
              <FileText weight="light" className="mt-0.5 h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Plan</p>
                <p className="text-sm font-medium text-slate-900">
                  {enrollment.plans.name} ({enrollment.plans.code})
                </p>
              </div>
            </div>
          )}

          {enrollment.requested_effective_date && (
            <div className="flex items-start gap-2">
              <Calendar weight="light" className="mt-0.5 h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Requested Effective Date</p>
                <p className="text-sm font-medium text-slate-900">
                  {format(new Date(enrollment.requested_effective_date), 'MMMM d, yyyy')}
                </p>
              </div>
            </div>
          )}

          {enrollment.effective_date && (
            <div className="flex items-start gap-2">
              <Calendar weight="light" className="mt-0.5 h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Effective Date</p>
                <p className="text-sm font-medium text-slate-900">
                  {format(new Date(enrollment.effective_date), 'MMMM d, yyyy')}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2">
            <Clock weight="light" className="mt-0.5 h-4 w-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Last Updated</p>
              <p className="text-sm font-medium text-slate-900">
                {format(new Date(enrollment.updated_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          </div>
        </div>

        {(enrollment.has_mandate_warning || enrollment.has_age65_warning) && (
          <div className="flex flex-wrap gap-2 border-t pt-2">
            {enrollment.has_mandate_warning && (
              <Badge className="border border-amber-200 bg-amber-100 text-amber-800">
                <Warning weight="light" className="mr-1 h-3 w-3" />
                Mandate State Notice
              </Badge>
            )}
            {enrollment.has_age65_warning && (
              <Badge className="border border-amber-200 bg-amber-100 text-amber-800">
                <Warning weight="light" className="mr-1 h-3 w-3" />
                Age 65+ Notice
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
