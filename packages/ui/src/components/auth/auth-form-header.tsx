import Link from 'next/link';
import { BrandLogo } from '../brand-logo';
import { authForm } from './auth-form-styles';

interface AuthFormHeaderProps {
  title: string;
  subtitle: string;
  homeHref?: string;
}

/** Logo + title block for dark auth form panels */
export function AuthFormHeader({ title, subtitle, homeHref = '/' }: AuthFormHeaderProps) {
  return (
    <div className="text-center lg:text-left">
      <Link href={homeHref} className="inline-flex items-center mb-6 lg:hidden">
        <BrandLogo variant="full" size="md" tone="white" />
      </Link>
      <Link href={homeHref} className="hidden lg:inline-flex items-center mb-6">
        <BrandLogo variant="full" size="lg" tone="white" priority />
      </Link>
      <h2 className={authForm.title}>{title}</h2>
      <p className={authForm.subtitle}>{subtitle}</p>
    </div>
  );
}
