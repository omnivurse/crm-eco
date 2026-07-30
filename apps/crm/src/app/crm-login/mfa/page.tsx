import type { Metadata } from 'next';
import { safeCrmRedirect } from '@/lib/login-branding-types';
import { MfaStepUpClient } from './MfaStepUpClient';

export const metadata: Metadata = {
  title: 'Two-Factor Authentication',
};

export default async function MfaStepUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const params = await searchParams;
  const requested = Array.isArray(params.redirect)
    ? params.redirect[0]
    : params.redirect;

  return <MfaStepUpClient redirectTo={safeCrmRedirect(requested)} />;
}
