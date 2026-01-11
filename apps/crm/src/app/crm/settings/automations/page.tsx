import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Zap,
  GitBranch,
  UserCheck,
  Star,
  Timer,
  Clock,
  FileText,
  Bell,
  History,
  ChevronRight,
} from 'lucide-react';
import { getCurrentProfile } from '@/lib/crm/queries';
import { getAutomationStats } from '@/lib/automation';

interface AutomationCard {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
  count?: number;
}

const automationCards: AutomationCard[] = [
  {
    title: 'Workflows',
    description: 'Automate actions when records are created or updated',
    href: '/crm/settings/automations/workflows',
    icon: <GitBranch className="w-6 h-6" />,
    color: 'teal',
  },
  {
    title: 'Assignment Rules',
    description: 'Automatically assign owners to records',
    href: '/crm/settings/automations/assignment',
    icon: <UserCheck className="w-6 h-6" />,
    color: 'blue',
  },
  {
    title: 'Scoring Rules',
    description: 'Score leads and records based on criteria',
    href: '/crm/settings/automations/scoring',
    icon: <Star className="w-6 h-6" />,
    color: 'amber',
  },
  {
    title: 'Cadences',
    description: 'Multi-step engagement sequences',
    href: '/crm/settings/automations/cadences',
    icon: <Timer className="w-6 h-6" />,
    color: 'purple',
  },
  {
    title: 'SLA Policies',
    description: 'Set response times and escalation rules',
    href: '/crm/settings/automations/sla',
    icon: <Clock className="w-6 h-6" />,
    color: 'rose',
  },
  {
    title: 'Webforms',
    description: 'Create public forms for lead capture',
    href: '/crm/settings/automations/webforms',
    icon: <FileText className="w-6 h-6" />,
    color: 'emerald',
  },
  {
    title: 'Automation Runs',
    description: 'View execution logs and audit trail',
    href: '/crm/settings/automations/runs',
    icon: <History className="w-6 h-6" />,
    color: 'slate',
  },
];

function getColorClasses(color: string) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    teal: {
      bg: 'bg-teal-500/10',
      text: 'text-teal-600 dark:text-teal-400',
      border: 'hover:border-teal-500/50',
    },
    blue: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'hover:border-blue-500/50',
    },
    amber: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'hover:border-amber-500/50',
    },
    purple: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'hover:border-purple-500/50',
    },
    rose: {
      bg: 'bg-rose-500/10',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'hover:border-rose-500/50',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'hover:border-emerald-500/50',
    },
    slate: {
      bg: 'bg-slate-500/10',
      text: 'text-slate-600 dark:text-slate-400',
      border: 'hover:border-slate-500/50',
    },
  };
  return colors[color] || colors.teal;
}

async function AutomationsContent() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
    redirect('/crm');
  }

  // Fetch stats
  let stats = { activeWorkflows: 0, assignmentRules: 0, activeWebforms: 0, runsToday: 0 };
  try {
    stats = await getAutomationStats(profile.organization_id);
  } catch (e) {
    // Stats fetch failed, use defaults
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-amber-500/10 rounded-lg">
          <Zap className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Automations</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Configure workflows, assignment rules, scoring, and more
          </p>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {automationCards.map((card) => {
          const colors = getColorClasses(card.color);
          return (
            <Link
              key={card.href}
              href={card.href}
              className={`group glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6 ${colors.border} transition-all`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 ${colors.bg} rounded-lg ${colors.text}`}>
                  {card.icon}
                </div>
                <ChevronRight className={`w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:${colors.text} transition-colors`} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                {card.title}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {card.description}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Quick Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{stats.activeWorkflows}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Active Workflows</div>
          </div>
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.assignmentRules}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Assignment Rules</div>
          </div>
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.activeWebforms}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Active Webforms</div>
          </div>
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-2xl font-bold text-slate-600 dark:text-slate-400">{stats.runsToday}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Runs Today</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  return (
    <Suspense fallback={<AutomationsSkeleton />}>
      <AutomationsContent />
    </Suspense>
  );
}

function AutomationsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-20 bg-slate-200 dark:bg-slate-800/50 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-40 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
