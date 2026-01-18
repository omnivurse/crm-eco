'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  Lock,
  Eye,
  CheckCircle2,
  Key,
  Activity,
  Server,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Fingerprint,
  Clock,
  FileText,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@crm-eco/ui/components/popover';

interface SecurityFeature {
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'active' | 'enabled' | 'configured';
}

const securityFeatures: SecurityFeature[] = [
  {
    name: 'HIPAA Compliant',
    description: 'Healthcare data protection standards',
    icon: <Shield className="w-4 h-4" />,
    status: 'active',
  },
  {
    name: 'AES-256 Encryption',
    description: 'Military-grade data encryption at rest',
    icon: <Lock className="w-4 h-4" />,
    status: 'active',
  },
  {
    name: 'TLS 1.3 in Transit',
    description: 'Secure data transmission',
    icon: <Server className="w-4 h-4" />,
    status: 'active',
  },
  {
    name: 'MFA Available',
    description: 'Multi-factor authentication support',
    icon: <Fingerprint className="w-4 h-4" />,
    status: 'enabled',
  },
  {
    name: 'Session Timeout',
    description: '30-minute inactivity auto-lock',
    icon: <Clock className="w-4 h-4" />,
    status: 'active',
  },
  {
    name: 'Audit Logging',
    description: 'Complete PHI access tracking',
    icon: <FileText className="w-4 h-4" />,
    status: 'active',
  },
  {
    name: 'Row-Level Security',
    description: 'Data isolation per organization',
    icon: <Eye className="w-4 h-4" />,
    status: 'active',
  },
  {
    name: 'Role-Based Access',
    description: 'Granular permission controls',
    icon: <Key className="w-4 h-4" />,
    status: 'configured',
  },
];

interface SecurityTrustBadgeProps {
  variant?: 'minimal' | 'compact' | 'full';
  showPopover?: boolean;
}

export function SecurityTrustBadge({
  variant = 'compact',
  showPopover = true
}: SecurityTrustBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = securityFeatures.filter(f => f.status === 'active').length;

  // Minimal variant - just a shield icon with tooltip
  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title="HIPAA Compliant & Secured">
        <ShieldCheck className="w-4 h-4" />
      </div>
    );
  }

  // Compact variant - shield with text
  if (variant === 'compact' && !showPopover) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-full text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Secured</span>
      </div>
    );
  }

  const badgeContent = (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-full text-xs font-medium text-emerald-700 dark:text-emerald-400 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
      <ShieldCheck className="w-3.5 h-3.5" />
      <span>HIPAA Secured</span>
      {showPopover && (
        isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      )}
    </div>
  );

  if (!showPopover) {
    return badgeContent;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {badgeContent}
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl"
        align="end"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
              <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Security Status</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeCount} of {securityFeatures.length} features active
              </p>
            </div>
          </div>
        </div>

        {/* Features List */}
        <div className="p-2 max-h-64 overflow-y-auto">
          {securityFeatures.map((feature, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <div className={`p-1.5 rounded-md ${
                feature.status === 'active'
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {feature.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {feature.name}
                  </span>
                  {feature.status === 'active' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Activity className="w-3.5 h-3.5" />
              <span>All systems operational</span>
            </div>
            <Link
              href="/crm/settings/security"
              className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
            >
              Security Settings →
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Export a simpler inline badge for use in various places
export function SecurityBadgeInline() {
  return (
    <div className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
      <ShieldCheck className="w-3.5 h-3.5" />
      <span>HIPAA Compliant</span>
    </div>
  );
}

// Security notice banner for important pages
export function SecurityNoticeBanner() {
  return (
    <div className="flex items-center justify-center gap-6 px-4 py-2 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-500/5 dark:via-teal-500/5 dark:to-emerald-500/5 border-y border-emerald-200/50 dark:border-emerald-500/20">
      <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <Shield className="w-3.5 h-3.5" />
        <span>HIPAA Compliant</span>
      </div>
      <div className="w-px h-3 bg-emerald-300 dark:bg-emerald-500/30" />
      <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <Lock className="w-3.5 h-3.5" />
        <span>256-bit Encrypted</span>
      </div>
      <div className="w-px h-3 bg-emerald-300 dark:bg-emerald-500/30" />
      <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <Eye className="w-3.5 h-3.5" />
        <span>Audit Logged</span>
      </div>
      <div className="w-px h-3 bg-emerald-300 dark:bg-emerald-500/30" />
      <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <Fingerprint className="w-3.5 h-3.5" />
        <span>MFA Protected</span>
      </div>
    </div>
  );
}
