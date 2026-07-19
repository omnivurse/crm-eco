import Link from 'next/link';
import { ShieldSlash, ArrowLeft, Envelope } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@crm-eco/ui/components/button';

interface PageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function AccessDeniedPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const reason = resolvedSearchParams.reason;

  const getReasonMessage = () => {
    switch (reason) {
      case 'not_agent':
        return 'Your account is not registered as an agent. If you believe this is an error, please contact support.';
      case 'agent_inactive':
        return 'Your agent account has not been activated yet. Please wait for an administrator to approve your account.';
      case 'not_authenticated':
        return 'You need to sign in to access this page.';
      case 'no_member':
      case 'no_membership':
        return 'You need an active membership to view this page. Enroll to get started — or contact support if you believe this is an error.';
      case 'inactive_member':
        return 'Your membership is not currently active, so the member portal is unavailable. If you believe this is an error or would like to reactivate, please contact support.';
      default:
        return 'You do not have permission to access this page.';
    }
  };

  // Enroll CTA only makes sense for prospects with no membership — not for an
  // inactive member, who should reach support instead.
  const isMemberGate = reason === 'no_member' || reason === 'no_membership';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--mp-canvas)] p-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <ShieldSlash weight="light" className="h-10 w-10 text-red-600" />
        </div>
        
        <h1 className="mb-4 text-2xl font-bold tracking-[-0.03em] text-[var(--mp-ink)]">Access Denied</h1>
        
        <p className="mb-8 text-slate-600">
          {getReasonMessage()}
        </p>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/">
            <Button variant="outline" className="w-full gap-2 rounded-full sm:w-auto">
              <ArrowLeft weight="light" className="h-4 w-4" />
              Go Home
            </Button>
          </Link>
          
          {reason === 'not_authenticated' ? (
            <Link href="/signin">
              <Button className="w-full gap-2 rounded-full bg-[var(--mp-teal)] hover:bg-[var(--mp-teal-soft)] sm:w-auto">
                Sign In
              </Button>
            </Link>
          ) : isMemberGate ? (
            <Link href="/enroll">
              <Button className="w-full gap-2 rounded-full bg-[var(--mp-teal)] hover:bg-[var(--mp-teal-soft)] sm:w-auto">
                Enroll Now
              </Button>
            </Link>
          ) : (
            <a href="mailto:support@doublehelixhub.com">
              <Button className="w-full gap-2 rounded-full bg-[var(--mp-teal)] hover:bg-[var(--mp-teal-soft)] sm:w-auto">
                <Envelope weight="light" className="h-4 w-4" />
                Contact Support
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
