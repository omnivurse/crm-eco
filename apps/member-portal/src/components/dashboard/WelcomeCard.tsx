import Link from 'next/link';
import { Heart, ArrowUpRight, FileText } from '@phosphor-icons/react/dist/ssr';
import { Bezel } from '@/components/ui/Bezel';

interface WelcomeCardProps {
  firstName: string;
  hasActiveMembership: boolean;
  hasInProgressEnrollment: boolean;
  inProgressEnrollmentId?: string;
}

export function WelcomeCard({
  firstName,
  hasActiveMembership,
  hasInProgressEnrollment,
  inProgressEnrollmentId,
}: WelcomeCardProps) {
  const getSubtext = () => {
    if (hasActiveMembership) {
      return "Here's a calm view of your membership and recent activity — everything that matters, nothing that doesn't.";
    }
    if (hasInProgressEnrollment) {
      return 'You have an enrollment in progress. Pick up where you left off.';
    }
    return "You don't have an active membership yet. You can start an enrollment below.";
  };

  return (
    <Bezel variant="hero" className="h-full">
      <div className="flex h-full flex-col justify-between p-6 md:p-7">
        <div>
          <p className="mp-kicker mp-kicker-light">Welcome back</p>
          <h1 className="mb-2 text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.035em]">
            Hi, {firstName}
          </h1>
          <p className="max-w-md text-[0.95rem] leading-relaxed text-white/75">
            {getSubtext()}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2.5">
          {hasInProgressEnrollment ? (
            <Link
              href={inProgressEnrollmentId ? `/enroll?resume=${inProgressEnrollmentId}` : '/enroll'}
              className="mp-btn-island"
            >
              <FileText weight="light" className="h-4 w-4" aria-hidden />
              Resume Enrollment
              <span className="mp-btn-ico" aria-hidden>
                <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
              </span>
            </Link>
          ) : !hasActiveMembership ? (
            <Link href="/enroll" className="mp-btn-island">
              <Heart weight="light" className="h-4 w-4" aria-hidden />
              Start Enrollment
              <span className="mp-btn-ico" aria-hidden>
                <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
              </span>
            </Link>
          ) : (
            <Link href="/coverage" className="mp-btn-island">
              View coverage
              <span className="mp-btn-ico" aria-hidden>
                <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
              </span>
            </Link>
          )}

          {hasActiveMembership ? (
            <Link href="/needs/new" className="mp-btn-ghost-light">
              Submit a need
            </Link>
          ) : (
            <Link href="/support" className="mp-btn-ghost-light">
              Contact Support
            </Link>
          )}
        </div>
      </div>
    </Bezel>
  );
}
