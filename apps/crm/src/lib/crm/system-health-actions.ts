/**
 * What a System Health check means when it is not green, and where the admin
 * goes to act. Scorecards without a next step sit red forever.
 */

export type HealthCheckStatus = 'pass' | 'fail' | 'warning';

export type HealthCheckId =
  | 'database'
  | 'runtime'
  | 'env'
  | 'tls'
  | 'rls'
  | 'rbac'
  | 'org-isolation'
  | 'phi-logging'
  | 'auth-logging'
  | 'session'
  | 'mfa'
  | 'encryption-rest'
  | 'encryption-transit'
  | 'access-control'
  | 'crm-modules'
  | 'email-provider'
  | 'undelivered-mail';

export interface HealthRemediation {
  action: string;
  href: string;
  hrefLabel: string;
}

const UNDELIVERED: HealthRemediation = {
  action:
    'Open the parked-mail queue. Real mail: add the recipient domain under Email Domains. Probe or noise: mark reviewed — that does not deliver the message, it only clears this check.',
  href: '/crm/settings/system-health?tab=mail',
  hrefLabel: 'Review parked mail',
};

const REMEDIATION: Record<
  HealthCheckId,
  Partial<Record<'fail' | 'warning', HealthRemediation>>
> = {
  database: {
    fail: {
      action: 'Supabase did not answer. Confirm the project is up and NEXT_PUBLIC_SUPABASE_URL is correct, then reload this page.',
      href: '/crm/settings/developer',
      hrefLabel: 'Open developer settings',
    },
  },
  runtime: {},
  env: {
    fail: {
      action: 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on the deployment, then redeploy.',
      href: '/crm/settings/developer',
      hrefLabel: 'Open developer settings',
    },
  },
  tls: {
    fail: {
      action: 'Point NEXT_PUBLIC_SUPABASE_URL at an https:// host so traffic is TLS.',
      href: '/crm/settings/developer',
      hrefLabel: 'Open developer settings',
    },
  },
  rls: {
    warning: {
      action: 'Could not confirm RLS on crm_records. Reload. If this stays a warning, check table policies in Supabase.',
      href: '/crm/settings/system-health',
      hrefLabel: 'Re-run checks',
    },
  },
  rbac: {
    warning: {
      action: 'This signed-in user has no CRM role. Assign Agent, Manager, or Admin so permissions apply.',
      href: '/crm/settings/users',
      hrefLabel: 'Open users',
    },
  },
  'org-isolation': {},
  'phi-logging': {
    warning: {
      action: 'phi_access_log is not readable. Confirm the audit table exists, then use Audit Logs to inspect access.',
      href: '/crm/settings/system-health?tab=audit',
      hrefLabel: 'Open audit logs',
    },
  },
  'auth-logging': {
    warning: {
      action: 'auth_events is not readable. Login history and devices live under Security.',
      href: '/crm/settings/security',
      hrefLabel: 'Open security',
    },
  },
  session: {
    warning: {
      action: 'user_sessions is not readable. Idle / absolute timeouts are configured under Security.',
      href: '/crm/settings/security',
      hrefLabel: 'Open security',
    },
  },
  mfa: {
    warning: {
      action: 'MFA settings are not readable, or MFA is not enrolled. Turn on an authenticator app for admin accounts.',
      href: '/crm/settings/security',
      hrefLabel: 'Set up MFA',
    },
  },
  'encryption-rest': {},
  'encryption-transit': {
    fail: {
      action: 'API traffic is not HTTPS. Fix the Supabase URL, then reload.',
      href: '/crm/settings/developer',
      hrefLabel: 'Open developer settings',
    },
  },
  'access-control': {
    warning: {
      action: 'security_permissions is not readable. Role grants live under Security Control.',
      href: '/crm/settings/security-control',
      hrefLabel: 'Open security control',
    },
  },
  'crm-modules': {
    warning: {
      action: 'No enabled CRM modules for this org. Enable Contacts / Members / Leads so lists have a home.',
      href: '/crm/settings/modules',
      hrefLabel: 'Open modules',
    },
  },
  'email-provider': {
    warning: {
      action: 'No sending provider is configured. Connect email so outbound mail can leave.',
      href: '/crm/settings/email',
      hrefLabel: 'Open email settings',
    },
  },
  'undelivered-mail': {
    fail: UNDELIVERED,
    warning: UNDELIVERED,
  },
};

export function healthCheckAnchor(id: HealthCheckId): string {
  return `health-check-${id}`;
}

export function remediationFor(
  id: HealthCheckId,
  status: HealthCheckStatus,
): HealthRemediation | null {
  if (status === 'pass') return null;
  return REMEDIATION[id]?.[status] ?? null;
}

export function issuesNeedingAttention<
  T extends { status: HealthCheckStatus },
>(checks: readonly T[]): T[] {
  return checks.filter((c) => c.status === 'fail' || c.status === 'warning');
}
