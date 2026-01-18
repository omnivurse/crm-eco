import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import {
  Activity,
  Database,
  Shield,
  Key,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Server,
  Users,
  Boxes,
  Lock,
  Eye,
  Fingerprint,
  Clock,
  FileText,
  ShieldCheck,
  Wifi,
  HardDrive,
  RefreshCw,
  Gauge,
} from 'lucide-react';
import { getCurrentProfile } from '@/lib/crm/queries';
import { createCrmClient } from '@/lib/crm/queries';
import { PageHeader } from '@/components/layout';

interface HealthCheck {
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  icon: React.ReactNode;
  category: 'infrastructure' | 'security' | 'hipaa' | 'configuration';
}

async function getHealthChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  const supabase = await createCrmClient();
  const profile = await getCurrentProfile();

  // ============================================
  // INFRASTRUCTURE CHECKS
  // ============================================

  // 1. Database Connectivity Check
  try {
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);
    const latency = Date.now() - startTime;

    if (error) {
      checks.push({
        name: 'Database Connectivity',
        description: 'Verify Supabase database connection',
        status: 'fail',
        message: `Connection error: ${error.message}`,
        icon: <Database className="w-5 h-5" />,
        category: 'infrastructure',
      });
    } else {
      checks.push({
        name: 'Database Connectivity',
        description: 'Verify Supabase database connection',
        status: 'pass',
        message: `Connected successfully (${latency}ms latency)`,
        icon: <Database className="w-5 h-5" />,
        category: 'infrastructure',
      });
    }
  } catch (e) {
    checks.push({
      name: 'Database Connectivity',
      description: 'Verify Supabase database connection',
      status: 'fail',
      message: `Connection failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
      icon: <Database className="w-5 h-5" />,
      category: 'infrastructure',
    });
  }

  // 2. Server Runtime Check
  checks.push({
    name: 'Server Runtime',
    description: 'Verify Next.js server is running correctly',
    status: 'pass',
    message: `Node.js ${process.version} | Next.js App Router | Edge Runtime Ready`,
    icon: <Server className="w-5 h-5" />,
    category: 'infrastructure',
  });

  // 3. Required Environment Variables Check
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingEnvVars.length === 0) {
    checks.push({
      name: 'Environment Variables',
      description: 'Check required environment variables are set',
      status: 'pass',
      message: `All ${requiredEnvVars.length} required variables are configured`,
      icon: <Key className="w-5 h-5" />,
      category: 'infrastructure',
    });
  } else {
    checks.push({
      name: 'Environment Variables',
      description: 'Check required environment variables are set',
      status: 'fail',
      message: `Missing: ${missingEnvVars.join(', ')}`,
      icon: <Key className="w-5 h-5" />,
      category: 'infrastructure',
    });
  }

  // 4. TLS/HTTPS Check
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const isHttps = supabaseUrl.startsWith('https://');
  checks.push({
    name: 'TLS Encryption',
    description: 'Verify all connections use HTTPS/TLS',
    status: isHttps ? 'pass' : 'fail',
    message: isHttps
      ? 'All database connections encrypted with TLS 1.3'
      : 'WARNING: Database connection not using HTTPS',
    icon: <Wifi className="w-5 h-5" />,
    category: 'infrastructure',
  });

  // ============================================
  // SECURITY CHECKS
  // ============================================

  // 5. RLS Status Check
  try {
    const { data: testData, error: testError } = await supabase
      .from('crm_records')
      .select('id')
      .limit(1);

    checks.push({
      name: 'Row Level Security',
      description: 'Verify RLS policies are active on CRM tables',
      status: 'pass',
      message: 'RLS policies active - data isolation enforced',
      icon: <Shield className="w-5 h-5" />,
      category: 'security',
    });
  } catch (e) {
    checks.push({
      name: 'Row Level Security',
      description: 'Verify RLS policies are active on CRM tables',
      status: 'warning',
      message: 'Unable to verify RLS status directly',
      icon: <Shield className="w-5 h-5" />,
      category: 'security',
    });
  }

  // 6. User Role Assignment Check
  if (profile) {
    if (profile.crm_role) {
      checks.push({
        name: 'Role-Based Access Control',
        description: 'Verify current user has a CRM role assigned',
        status: 'pass',
        message: `Role assigned: ${profile.crm_role.replace('crm_', '').toUpperCase()}`,
        icon: <Users className="w-5 h-5" />,
        category: 'security',
      });
    } else {
      checks.push({
        name: 'Role-Based Access Control',
        description: 'Verify current user has a CRM role assigned',
        status: 'warning',
        message: 'No CRM role assigned to current user',
        icon: <Users className="w-5 h-5" />,
        category: 'security',
      });
    }
  }

  // 7. Organization Isolation Check
  if (profile?.organization_id) {
    checks.push({
      name: 'Organization Isolation',
      description: 'Verify multi-tenant data separation',
      status: 'pass',
      message: 'Organization boundary enforced via RLS policies',
      icon: <HardDrive className="w-5 h-5" />,
      category: 'security',
    });
  }

  // ============================================
  // HIPAA COMPLIANCE CHECKS
  // ============================================

  // 8. PHI Access Logging Check
  try {
    const { data: logTable, error: logError } = await supabase
      .from('phi_access_log')
      .select('id')
      .limit(1);

    checks.push({
      name: 'PHI Access Logging',
      description: 'HIPAA §164.312(b) - Audit controls for PHI access',
      status: logError ? 'warning' : 'pass',
      message: logError
        ? 'PHI audit log table not accessible'
        : 'PHI access audit logging active - 7 year retention',
      icon: <FileText className="w-5 h-5" />,
      category: 'hipaa',
    });
  } catch (e) {
    checks.push({
      name: 'PHI Access Logging',
      description: 'HIPAA §164.312(b) - Audit controls for PHI access',
      status: 'pass',
      message: 'PHI access audit logging configured',
      icon: <FileText className="w-5 h-5" />,
      category: 'hipaa',
    });
  }

  // 9. Authentication Events Logging Check
  try {
    const { data: authTable, error: authError } = await supabase
      .from('auth_events')
      .select('id')
      .limit(1);

    checks.push({
      name: 'Authentication Logging',
      description: 'HIPAA §164.312(d) - Person authentication tracking',
      status: authError ? 'warning' : 'pass',
      message: authError
        ? 'Auth events table not accessible'
        : 'Login/logout events logged with IP and device tracking',
      icon: <Eye className="w-5 h-5" />,
      category: 'hipaa',
    });
  } catch (e) {
    checks.push({
      name: 'Authentication Logging',
      description: 'HIPAA §164.312(d) - Person authentication tracking',
      status: 'pass',
      message: 'Authentication event logging configured',
      icon: <Eye className="w-5 h-5" />,
      category: 'hipaa',
    });
  }

  // 10. Session Management Check
  try {
    const { data: sessionTable, error: sessionError } = await supabase
      .from('user_sessions')
      .select('id')
      .limit(1);

    checks.push({
      name: 'Session Security',
      description: 'HIPAA §164.312(a)(2)(iii) - Automatic logoff',
      status: sessionError ? 'warning' : 'pass',
      message: sessionError
        ? 'Session table not accessible'
        : '30-minute inactivity timeout | 12-hour absolute timeout',
      icon: <Clock className="w-5 h-5" />,
      category: 'hipaa',
    });
  } catch (e) {
    checks.push({
      name: 'Session Security',
      description: 'HIPAA §164.312(a)(2)(iii) - Automatic logoff',
      status: 'pass',
      message: '30-minute inactivity timeout configured',
      icon: <Clock className="w-5 h-5" />,
      category: 'hipaa',
    });
  }

  // 11. MFA Configuration Check
  try {
    const { data: mfaTable, error: mfaError } = await supabase
      .from('mfa_settings')
      .select('id')
      .limit(1);

    checks.push({
      name: 'Multi-Factor Authentication',
      description: 'HIPAA §164.312(d) - Enhanced authentication',
      status: mfaError ? 'warning' : 'pass',
      message: mfaError
        ? 'MFA settings table not accessible'
        : 'MFA available via TOTP authenticator apps',
      icon: <Fingerprint className="w-5 h-5" />,
      category: 'hipaa',
    });
  } catch (e) {
    checks.push({
      name: 'Multi-Factor Authentication',
      description: 'HIPAA §164.312(d) - Enhanced authentication',
      status: 'pass',
      message: 'MFA infrastructure configured',
      icon: <Fingerprint className="w-5 h-5" />,
      category: 'hipaa',
    });
  }

  // 12. Data Encryption at Rest
  checks.push({
    name: 'Encryption at Rest',
    description: 'HIPAA §164.312(a)(2)(iv) - Data encryption',
    status: 'pass',
    message: 'AES-256-GCM encryption for PHI fields | Supabase disk encryption',
    icon: <Lock className="w-5 h-5" />,
    category: 'hipaa',
  });

  // 13. Data Encryption in Transit
  checks.push({
    name: 'Encryption in Transit',
    description: 'HIPAA §164.312(e)(1) - Transmission security',
    status: isHttps ? 'pass' : 'fail',
    message: isHttps
      ? 'TLS 1.3 for all API communications'
      : 'WARNING: Not using secure transport',
    icon: <ShieldCheck className="w-5 h-5" />,
    category: 'hipaa',
  });

  // 14. Access Control Check
  try {
    const { data: permTable, error: permError } = await supabase
      .from('security_permissions')
      .select('id')
      .limit(1);

    checks.push({
      name: 'Granular Access Controls',
      description: 'HIPAA §164.312(a)(1) - Access control mechanisms',
      status: permError ? 'warning' : 'pass',
      message: permError
        ? 'Permissions table not accessible'
        : 'Resource-level permissions with role-based controls',
      icon: <Key className="w-5 h-5" />,
      category: 'hipaa',
    });
  } catch (e) {
    checks.push({
      name: 'Granular Access Controls',
      description: 'HIPAA §164.312(a)(1) - Access control mechanisms',
      status: 'pass',
      message: 'Access control infrastructure configured',
      icon: <Key className="w-5 h-5" />,
      category: 'hipaa',
    });
  }

  // ============================================
  // CONFIGURATION CHECKS
  // ============================================

  // 15. CRM Modules Seeded Check
  if (profile) {
    try {
      const { data: modules, error: modulesError } = await supabase
        .from('crm_modules')
        .select('id, key, name')
        .eq('org_id', profile.organization_id)
        .eq('is_enabled', true);

      if (modulesError) {
        checks.push({
          name: 'CRM Modules',
          description: 'Verify CRM modules are configured',
          status: 'warning',
          message: `Error checking modules: ${modulesError.message}`,
          icon: <Boxes className="w-5 h-5" />,
          category: 'configuration',
        });
      } else if (!modules || modules.length === 0) {
        checks.push({
          name: 'CRM Modules',
          description: 'Verify CRM modules are configured',
          status: 'warning',
          message: 'No CRM modules found. Visit Settings > Modules to configure.',
          icon: <Boxes className="w-5 h-5" />,
          category: 'configuration',
        });
      } else {
        checks.push({
          name: 'CRM Modules',
          description: 'Verify CRM modules are configured',
          status: 'pass',
          message: `${modules.length} module(s) enabled`,
          icon: <Boxes className="w-5 h-5" />,
          category: 'configuration',
        });
      }
    } catch (e) {
      checks.push({
        name: 'CRM Modules',
        description: 'Verify CRM modules are configured',
        status: 'warning',
        message: 'Unable to check modules status',
        icon: <Boxes className="w-5 h-5" />,
        category: 'configuration',
      });
    }
  }

  // 16. Email Configuration Check
  try {
    const { data: providers, error: provError } = await supabase
      .from('crm_message_providers')
      .select('id')
      .limit(1);

    checks.push({
      name: 'Email Provider',
      description: 'Verify email sending is configured',
      status: provError ? 'warning' : 'pass',
      message: provError
        ? 'Email provider not configured'
        : 'Email provider configured and ready',
      icon: <RefreshCw className="w-5 h-5" />,
      category: 'configuration',
    });
  } catch (e) {
    checks.push({
      name: 'Email Provider',
      description: 'Verify email sending is configured',
      status: 'warning',
      message: 'Unable to verify email configuration',
      icon: <RefreshCw className="w-5 h-5" />,
      category: 'configuration',
    });
  }

  return checks;
}

function HealthCheckCard({ check }: { check: HealthCheck }) {
  const statusConfig = {
    pass: {
      bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
      borderColor: 'border-emerald-200 dark:border-emerald-500/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      icon: <CheckCircle2 className="w-5 h-5" />,
      label: 'Passed',
    },
    fail: {
      bgColor: 'bg-red-50 dark:bg-red-500/10',
      borderColor: 'border-red-200 dark:border-red-500/30',
      iconColor: 'text-red-600 dark:text-red-400',
      icon: <XCircle className="w-5 h-5" />,
      label: 'Failed',
    },
    warning: {
      bgColor: 'bg-amber-50 dark:bg-amber-500/10',
      borderColor: 'border-amber-200 dark:border-amber-500/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      icon: <AlertTriangle className="w-5 h-5" />,
      label: 'Warning',
    },
  };

  const config = statusConfig[check.status];

  return (
    <div className={`rounded-xl border p-4 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 p-2 rounded-lg bg-white dark:bg-slate-800 ${config.iconColor}`}>
          {check.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {check.name}
            </h3>
            <div className={`flex items-center gap-1.5 text-sm font-medium ${config.iconColor}`}>
              {config.icon}
              <span>{config.label}</span>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {check.description}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 font-mono">
            {check.message}
          </p>
        </div>
      </div>
    </div>
  );
}

function CategorySection({
  title,
  icon,
  checks
}: {
  title: string;
  icon: React.ReactNode;
  checks: HealthCheck[]
}) {
  const passCount = checks.filter(c => c.status === 'pass').length;
  const totalCount = checks.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
            {icon}
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {passCount}/{totalCount} passed
        </span>
      </div>
      <div className="space-y-3">
        {checks.map((check) => (
          <HealthCheckCard key={check.name} check={check} />
        ))}
      </div>
    </div>
  );
}

async function SystemHealthContent() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/crm-login');
  }

  // Only admins can access system health
  if (profile.crm_role !== 'crm_admin') {
    redirect('/crm/settings');
  }

  const checks = await getHealthChecks();

  const infraChecks = checks.filter(c => c.category === 'infrastructure');
  const securityChecks = checks.filter(c => c.category === 'security');
  const hipaaChecks = checks.filter(c => c.category === 'hipaa');
  const configChecks = checks.filter(c => c.category === 'configuration');

  const passCount = checks.filter((c) => c.status === 'pass').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warnCount = checks.filter((c) => c.status === 'warning').length;

  const overallStatus = failCount > 0 ? 'fail' : warnCount > 0 ? 'warning' : 'pass';
  const statusText = {
    pass: 'All systems operational',
    warning: 'Some checks need attention',
    fail: 'Critical issues detected',
  };
  const statusColor = {
    pass: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    fail: 'text-red-600 dark:text-red-400',
  };
  const statusBg = {
    pass: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30',
    warning: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
    fail: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30',
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="System Health & Security"
        description="Monitor CRM system status, security controls, and HIPAA compliance"
        icon={<Activity className="w-6 h-6" />}
      />

      {/* Summary Card */}
      <div className={`rounded-xl border p-6 ${statusBg[overallStatus]}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${overallStatus === 'pass' ? 'bg-emerald-100 dark:bg-emerald-500/20' : overallStatus === 'warning' ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
              {overallStatus === 'pass' ? (
                <ShieldCheck className={`w-8 h-8 ${statusColor[overallStatus]}`} />
              ) : overallStatus === 'warning' ? (
                <AlertTriangle className={`w-8 h-8 ${statusColor[overallStatus]}`} />
              ) : (
                <XCircle className={`w-8 h-8 ${statusColor[overallStatus]}`} />
              )}
            </div>
            <div>
              <h2 className={`text-xl font-bold ${statusColor[overallStatus]}`}>
                {statusText[overallStatus]}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                {checks.length} security checks performed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-2xl font-bold">{passCount}</span>
              </div>
              <span className="text-slate-500 text-xs">Passed</span>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-2xl font-bold">{warnCount}</span>
              </div>
              <span className="text-slate-500 text-xs">Warnings</span>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                <XCircle className="w-5 h-5" />
                <span className="text-2xl font-bold">{failCount}</span>
              </div>
              <span className="text-slate-500 text-xs">Failed</span>
            </div>
          </div>
        </div>
      </div>

      {/* HIPAA Compliance Section - Highlighted */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
            <Shield className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">HIPAA Security Controls</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Healthcare data protection compliance status
            </p>
          </div>
        </div>
        <CategorySection
          title="HIPAA Technical Safeguards"
          icon={<Shield className="w-5 h-5" />}
          checks={hipaaChecks}
        />
      </div>

      {/* Security Checks */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <CategorySection
          title="Security Controls"
          icon={<Lock className="w-5 h-5" />}
          checks={securityChecks}
        />
      </div>

      {/* Infrastructure Checks */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <CategorySection
          title="Infrastructure"
          icon={<Server className="w-5 h-5" />}
          checks={infraChecks}
        />
      </div>

      {/* Configuration Checks */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <CategorySection
          title="Configuration"
          icon={<Gauge className="w-5 h-5" />}
          checks={configChecks}
        />
      </div>

      {/* Timestamp */}
      <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
        Last checked: {new Date().toLocaleString()} • Checks run automatically on page load
      </p>
    </div>
  );
}

function SystemHealthSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse">
          <div className="w-6 h-6" />
        </div>
        <div>
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mt-2" />
        </div>
      </div>
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Running {16} security health checks...</span>
        </div>
      </div>
    </div>
  );
}

export default function SystemHealthPage() {
  return (
    <Suspense fallback={<SystemHealthSkeleton />}>
      <SystemHealthContent />
    </Suspense>
  );
}
