import Link from 'next/link';
import { Mail, Phone, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';

interface AdvisorCardProps {
  advisor: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url?: string | null;
  } | null;
}

export function AdvisorCard({ advisor }: AdvisorCardProps) {
  if (!advisor) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-slate-500">
            We&apos;ll match you with an advisor once your enrollment is active.
          </p>
        </CardContent>
      </Card>
    );
  }

  const fullName = `${advisor.first_name ?? ''} ${advisor.last_name ?? ''}`.trim() || 'Your advisor';
  const initials = (advisor.first_name?.[0] ?? '') + (advisor.last_name?.[0] ?? '');

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-900">Your advisor</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-semibold text-white">
            {initials.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{fullName}</p>
            {advisor.email && (
              <a
                href={`mailto:${advisor.email}`}
                className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 hover:text-blue-700"
              >
                <Mail className="h-3 w-3" />
                {advisor.email}
              </a>
            )}
            {advisor.phone && (
              <a
                href={`tel:${advisor.phone}`}
                className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 hover:text-blue-700"
              >
                <Phone className="h-3 w-3" />
                {advisor.phone}
              </a>
            )}
          </div>
          <Link
            href="/support?topic=advisor"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Message
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
