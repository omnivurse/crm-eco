import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@crm-eco/ui';
import { FileText, ArrowRight, Clock, Eye, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { StatusBadge } from './StatusBadge';

interface LatestEnrollment {
  id: string;
  enrollment_number: string | null;
  status: string;
  enrollment_mode: string;
  updated_at: string;
  created_at: string;
  plans: { id: string; name: string; code: string } | null;
}

interface EnrollmentPanelProps {
  enrollment: LatestEnrollment | null;
}

export function EnrollmentPanel({ enrollment }: EnrollmentPanelProps) {
  // No enrollment - show start new enrollment
  if (!enrollment) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-slate-400" />
            Enrollment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
              <Plus className="w-7 h-7 text-blue-600" />
            </div>
            <p className="text-slate-900 font-medium mb-2">Ready to get started?</p>
            <p className="text-sm text-slate-500 mb-4">
              You can start a new membership enrollment online.
            </p>
            <Link href="/enroll">
              <Button className="gap-2">
                Start New Enrollment
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Submitted enrollment - waiting for review
  if (enrollment.status === 'submitted') {
    return (
      <Card className="h-full border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-blue-600" />
              Enrollment
            </CardTitle>
            <StatusBadge status={enrollment.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-blue-900 font-medium">Under Review</p>
                <p className="text-sm text-blue-700">
                  Your enrollment has been submitted and is being reviewed by our team.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm mb-4">
            {enrollment.enrollment_number && (
              <div className="flex justify-between">
                <span className="text-slate-500">Enrollment #</span>
                <span className="font-medium text-slate-900">{enrollment.enrollment_number}</span>
              </div>
            )}
            {enrollment.plans?.name && (
              <div className="flex justify-between">
                <span className="text-slate-500">Plan</span>
                <span className="font-medium text-slate-900">{enrollment.plans.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Submitted</span>
              <span className="font-medium text-slate-900">
                {format(new Date(enrollment.updated_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Link href={`/enrollments/${enrollment.id}`} className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <Eye className="w-4 h-4" />
                View Status
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Draft or in_progress - show resume option
  return (
    <Card className="h-full border-amber-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-amber-600" />
            Enrollment
          </CardTitle>
          <StatusBadge status={enrollment.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-amber-50 rounded-lg p-4 mb-4">
          <p className="text-amber-900 font-medium mb-1">Enrollment in Progress</p>
          <p className="text-sm text-amber-700">
            You have an unfinished enrollment. Pick up where you left off.
          </p>
        </div>

        <div className="space-y-2 text-sm mb-4">
          {enrollment.plans?.name && (
            <div className="flex justify-between">
              <span className="text-slate-500">Plan</span>
              <span className="font-medium text-slate-900">{enrollment.plans.name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Last updated</span>
            <span className="font-medium text-slate-900">
              {format(new Date(enrollment.updated_at), 'MMM d, yyyy')}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/enroll?resume=${enrollment.id}`} className="flex-1">
            <Button className="w-full gap-2">
              Resume Enrollment
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-3 text-center">
          <Link href="/enroll" className="text-xs text-slate-500 hover:text-slate-700">
            Or start a new enrollment
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

