import Link from 'next/link';
import { FileText, ArrowUpRight, Clock, Eye, Plus } from '@phosphor-icons/react/dist/ssr';
import { format } from 'date-fns';
import { StatusBadge } from './StatusBadge';
import { Bezel } from '@/components/ui/Bezel';

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
  if (!enrollment) {
    return (
      <Bezel>
        <div className="p-6 md:p-7">
          <p className="mp-kicker mp-kicker-teal">Enrollment</p>
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(11,109,133,0.1)]">
              <Plus weight="light" className="h-7 w-7 text-[var(--mp-teal)]" aria-hidden />
            </div>
            <p className="mb-1 font-medium text-[var(--mp-ink)]">Ready to get started?</p>
            <p className="mb-4 text-sm text-slate-500">
              You can start a new membership enrollment online.
            </p>
            <Link href="/enroll" className="mp-btn-island mx-auto">
              Start New Enrollment
              <span className="mp-btn-ico" aria-hidden>
                <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
        </div>
      </Bezel>
    );
  }

  if (enrollment.status === 'submitted') {
    return (
      <Bezel>
        <div className="p-6 md:p-7">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="mp-kicker mp-kicker-teal mb-0">Enrollment</p>
            <StatusBadge status={enrollment.status} />
          </div>
          <div className="mb-4 flex items-start gap-3 rounded-2xl bg-[rgba(11,109,133,0.08)] p-4">
            <Clock weight="light" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--mp-teal)]" aria-hidden />
            <div>
              <p className="font-medium text-[var(--mp-ink)]">Under Review</p>
              <p className="text-sm text-slate-600">
                Your enrollment has been submitted and is being reviewed by our team.
              </p>
            </div>
          </div>

          <div className="mb-4 space-y-2 text-sm">
            {enrollment.enrollment_number && (
              <div className="flex justify-between">
                <span className="text-slate-500">Enrollment #</span>
                <span className="font-medium text-[var(--mp-ink)]">{enrollment.enrollment_number}</span>
              </div>
            )}
            {enrollment.plans?.name && (
              <div className="flex justify-between">
                <span className="text-slate-500">Plan</span>
                <span className="font-medium text-[var(--mp-ink)]">{enrollment.plans.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Submitted</span>
              <span className="font-medium text-[var(--mp-ink)]">
                {format(new Date(enrollment.updated_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>

          <Link
            href={`/enrollments/${enrollment.id}`}
            className="inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-[var(--mp-teal)]"
          >
            <Eye weight="light" className="h-4 w-4" aria-hidden />
            View Status
            <ArrowUpRight weight="light" className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </Bezel>
    );
  }

  return (
    <Bezel>
      <div className="p-6 md:p-7">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="mp-kicker mp-kicker-teal mb-0">Enrollment</p>
          <StatusBadge status={enrollment.status} />
        </div>
        <div className="mb-4 rounded-2xl bg-amber-50 p-4">
          <p className="mb-1 font-medium text-amber-900">Enrollment in Progress</p>
          <p className="text-sm text-amber-700">
            You have an unfinished enrollment. Pick up where you left off.
          </p>
        </div>

        <div className="mb-4 space-y-2 text-sm">
          {enrollment.plans?.name && (
            <div className="flex justify-between">
              <span className="text-slate-500">Plan</span>
              <span className="font-medium text-[var(--mp-ink)]">{enrollment.plans.name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Last updated</span>
            <span className="font-medium text-[var(--mp-ink)]">
              {format(new Date(enrollment.updated_at), 'MMM d, yyyy')}
            </span>
          </div>
        </div>

        <Link href={`/enroll?resume=${enrollment.id}`} className="mp-btn-island">
          <FileText weight="light" className="h-4 w-4" aria-hidden />
          Resume Enrollment
          <span className="mp-btn-ico" aria-hidden>
            <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
          </span>
        </Link>

        <div className="mt-3 text-center">
          <Link href="/enroll" className="text-xs text-slate-500 hover:text-slate-700">
            Or start a new enrollment
          </Link>
        </div>
      </div>
    </Bezel>
  );
}
