import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui';
import { ShieldX } from 'lucide-react';
import Link from 'next/link';

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <ShieldX className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription>
            You don&apos;t have permission to access the Admin Portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            This portal is restricted to administrators only. If you believe this is an error,
            please contact your system administrator.
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Sign in with different account
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
