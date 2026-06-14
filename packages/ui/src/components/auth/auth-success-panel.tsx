import Link from 'next/link';
import { Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { authForm } from './auth-form-styles';

interface AuthSuccessPanelProps {
  title: string;
  description: React.ReactNode;
  primaryHref: string;
  primaryLabel: string;
  showPrimaryArrow?: boolean;
}

/** Dark-themed success state for auth flows (reset email sent, password updated, etc.) */
export function AuthSuccessPanel({
  title,
  description,
  primaryHref,
  primaryLabel,
  showPrimaryArrow = false,
}: AuthSuccessPanelProps) {
  return (
    <div className="space-y-8 text-center lg:text-left">
      <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto lg:mx-0">
        <Check className="w-8 h-8 text-emerald-400" />
      </div>
      <div>
        <h2 className={authForm.title}>{title}</h2>
        <p className={`${authForm.subtitle} mt-3`}>{description}</p>
      </div>
      <Link
        href={primaryHref}
        className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-800/50 transition-colors font-medium"
      >
        {showPrimaryArrow ? (
          <>
            {primaryLabel}
            <ArrowRight className="h-4 w-4" />
          </>
        ) : (
          <>
            <ArrowLeft className="h-4 w-4" />
            {primaryLabel}
          </>
        )}
      </Link>
    </div>
  );
}
