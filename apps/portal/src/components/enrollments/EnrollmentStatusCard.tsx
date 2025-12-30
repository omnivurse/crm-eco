import { Card, CardContent, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import { FileText, Calendar, AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';
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
    icon: <FileText className="w-3 h-3" />,
    message: 'You have not submitted this enrollment yet. Complete all steps and submit to apply for membership.',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <Clock className="w-3 h-3" />,
    message: 'Your enrollment is in progress. Complete the remaining steps to submit your application.',
  },
  submitted: {
    label: 'Submitted - Under Review',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Clock className="w-3 h-3" />,
    message: 'Your enrollment has been submitted and is under review by our team. We will contact you if we need any additional information.',
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle className="w-3 h-3" />,
    message: 'Your enrollment has been approved! Your membership has been created and you can now access your benefits.',
  },
  rejected: {
    label: 'Not Approved',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: <XCircle className="w-3 h-3" />,
    message: 'This enrollment was not approved. Please contact support for more information about next steps.',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: <XCircle className="w-3 h-3" />,
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-blue-600" />
            Enrollment Status
          </CardTitle>
          <Badge className={`${config.className} border font-medium`}>
            {config.icon}
            <span className="ml-1">{config.label}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Message */}
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-sm text-slate-700">{config.message}</p>
        </div>

        {/* Membership Info (if exists) */}
        {membership && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
            <CheckCircle className="w-5 h-5 text-green-600" />
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

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Enrollment Number */}
          {enrollment.enrollment_number && (
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">Enrollment Number</p>
                <p className="text-sm font-medium text-slate-900">
                  {enrollment.enrollment_number}
                </p>
              </div>
            </div>
          )}

          {/* Plan */}
          {enrollment.plans && (
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">Plan</p>
                <p className="text-sm font-medium text-slate-900">
                  {enrollment.plans.name} ({enrollment.plans.code})
                </p>
              </div>
            </div>
          )}

          {/* Requested Effective Date */}
          {enrollment.requested_effective_date && (
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">Requested Effective Date</p>
                <p className="text-sm font-medium text-slate-900">
                  {format(new Date(enrollment.requested_effective_date), 'MMMM d, yyyy')}
                </p>
              </div>
            </div>
          )}

          {/* Actual Effective Date */}
          {enrollment.effective_date && (
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">Effective Date</p>
                <p className="text-sm font-medium text-slate-900">
                  {format(new Date(enrollment.effective_date), 'MMMM d, yyyy')}
                </p>
              </div>
            </div>
          )}

          {/* Last Updated */}
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500">Last Updated</p>
              <p className="text-sm font-medium text-slate-900">
                {format(new Date(enrollment.updated_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          </div>
        </div>

        {/* Warning Badges */}
        {(enrollment.has_mandate_warning || enrollment.has_age65_warning) && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {enrollment.has_mandate_warning && (
              <Badge className="bg-amber-100 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Mandate State Notice
              </Badge>
            )}
            {enrollment.has_age65_warning && (
              <Badge className="bg-amber-100 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Age 65+ Notice
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

