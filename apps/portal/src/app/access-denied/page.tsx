import Link from 'next/link';
import { ShieldX, ArrowLeft, Mail } from 'lucide-react';
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
      default:
        return 'You do not have permission to access this page.';
    }
  };

  const isMemberGate = reason === 'no_member' || reason === 'no_membership';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-10 h-10 text-red-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Access Denied</h1>
        
        <p className="text-slate-600 mb-8">
          {getReasonMessage()}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4" />
              Go Home
            </Button>
          </Link>
          
          {reason === 'not_authenticated' ? (
            <Link href="/signin">
              <Button className="gap-2 w-full sm:w-auto">
                Sign In
              </Button>
            </Link>
          ) : isMemberGate ? (
            <Link href="/enroll">
              <Button className="gap-2 w-full sm:w-auto">
                Enroll Now
              </Button>
            </Link>
          ) : (
            <a href="mailto:support@doublehelixhub.com">
              <Button className="gap-2 w-full sm:w-auto">
                <Mail className="h-4 w-4" />
                Contact Support
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
