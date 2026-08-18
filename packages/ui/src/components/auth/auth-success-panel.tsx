import Link from 'next/link';
import { Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { authForm } from './auth-form-styles';

export interface AuthSuccessPanelProps {
  title: string;
  description: React.ReactNode;
  primaryHref: string;
  primaryLabel: string;
  showPrimaryArrow?: boolean;
}

/**
 * Success state for auth flows (reset email sent, password updated).
 *
 * v1 hard-coded `border-slate-600 text-slate-200 hover:bg-slate-800/50`, which
 * was designed for an always-dark panel and read as grey-on-white in the light
 * theme. Everything is token-driven now; the emerald mark comes from
 * `--auth-ok`, which derives from `--lp-emerald`.
 *
 * Copy is passed in by the caller and is untouched.
 */
export function AuthSuccessPanel({
  title,
  description,
  primaryHref,
  primaryLabel,
  showPrimaryArrow = false,
}: AuthSuccessPanelProps) {
  return (
    <div className="space-y-7 text-center lg:text-left">
      <div className="auth-success-mark mx-auto lg:mx-0">
        <Check className="h-7 w-7" aria-hidden="true" />
      </div>
      <div>
        <h2 className={authForm.title}>{title}</h2>
        <p className={authForm.subtitle}>{description}</p>
      </div>
      <Link href={primaryHref} className={authForm.secondaryBtn}>
        {showPrimaryArrow ? (
          <span className="flex items-center justify-center gap-2">
            {primaryLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {primaryLabel}
          </span>
        )}
      </Link>
    </div>
  );
}
