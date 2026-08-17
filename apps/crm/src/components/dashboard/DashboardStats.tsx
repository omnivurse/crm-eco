import Link from 'next/link';
import {
  Users,
  UserPlus,
  UserCheck,
  DollarSign,
  Building2,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import type { ModuleStats } from '@/lib/crm/types';

interface DashboardStatsProps {
  stats: ModuleStats[];
}

function PremiumStatCard({
  title,
  value,
  subtitle,
  icon,
  href,
  change,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  href?: string;
  change?: number;
}) {
  const content = (
    <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/50 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow duration-200">
      {/* Accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-slate-200 dark:bg-slate-700" />

      <div className="relative p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">
              {title}
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {value}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
            <div className="text-slate-600 dark:text-slate-300">{icon}</div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {subtitle}
            </p>
            {change !== undefined && change > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-3 h-3" />+{change}
              </span>
            )}
          </div>
          {href && (
            <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

const statConfigs: Record<
  string,
  { icon: React.ReactNode; href?: string }
> = {
  accounts: {
    icon: <Building2 className="w-5 h-5" />,
  },
  contacts: {
    icon: <Users className="w-5 h-5" />,
  },
  deals: {
    icon: <DollarSign className="w-5 h-5" />,
  },
  leads: {
    icon: <UserPlus className="w-5 h-5" />,
  },
  advisors: {
    icon: <UserCheck className="w-5 h-5" />,
    href: '/crm/settings/team',
  },
};

export function DashboardStats({ stats }: DashboardStatsProps) {
  if (stats.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <PremiumStatCard
          title="Accounts"
          value="0"
          subtitle="Total accounts"
          icon={<Building2 className="w-5 h-5" />}
          href="/crm/modules/accounts"
        />
        <PremiumStatCard
          title="Contacts"
          value="0"
          subtitle="Total contacts"
          icon={<Users className="w-5 h-5" />}
          href="/crm/modules/contacts"
        />
        <PremiumStatCard
          title="Deals"
          value="0"
          subtitle="Total deals"
          icon={<DollarSign className="w-5 h-5" />}
          href="/crm/modules/deals"
        />
        <PremiumStatCard
          title="Leads"
          value="0"
          subtitle="Total leads"
          icon={<UserPlus className="w-5 h-5" />}
          href="/crm/modules/leads"
        />
      </div>
    );
  }

  // Deduplicate stats by moduleKey (prevents duplicate cards if DB has dupes)
  // Exclude 'members' — it has its own dedicated page and is redundant here
  const uniqueStats = Array.from(
    new Map(stats.map((s) => [s.moduleKey, s])).values()
  ).filter((s) => s.moduleKey !== 'members' && s.moduleKey !== 'advisors');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {uniqueStats.map((stat) => {
        const config = statConfigs[stat.moduleKey] || statConfigs.contacts;
        return (
          <PremiumStatCard
            key={stat.moduleKey}
            title={stat.moduleName}
            value={stat.totalRecords.toLocaleString()}
            subtitle={`Total ${stat.moduleName.toLowerCase()}`}
            icon={config.icon}
            href={config.href || `/crm/modules/${stat.moduleKey}`}
            change={stat.createdThisWeek}
          />
        );
      })}
    </div>
  );
}
