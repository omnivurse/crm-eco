import Link from 'next/link';
import {
  Users,
  UserPlus,
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
  gradient,
  href,
  change,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  href?: string;
  change?: number;
}) {
  const content = (
    <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] transition-all duration-500 hover:-translate-y-1">
      {/* Gradient accent */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${gradient}`} />

      {/* Glow effect on hover */}
      <div
        className={`absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradient} blur-xl`}
      />

      <div className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              {title}
            </p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {value}
            </p>
          </div>
          <div
            className={`p-3 rounded-xl ${gradient.replace(
              'bg-gradient-to-r',
              'bg-gradient-to-br'
            )} bg-opacity-10 backdrop-blur-sm`}
          >
            <div className="text-white">{icon}</div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-400 dark:text-slate-500">
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
  { gradient: string; icon: React.ReactNode }
> = {
  accounts: {
    gradient: 'bg-gradient-to-r from-amber-500 to-orange-400',
    icon: <Building2 className="w-5 h-5" />,
  },
  contacts: {
    gradient: 'bg-gradient-to-r from-[#047474] to-[#069B9A]',
    icon: <Users className="w-5 h-5" />,
  },
  deals: {
    gradient: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    icon: <DollarSign className="w-5 h-5" />,
  },
  leads: {
    gradient: 'bg-gradient-to-r from-violet-500 to-purple-400',
    icon: <UserPlus className="w-5 h-5" />,
  },
};

export function DashboardStats({ stats }: DashboardStatsProps) {
  if (stats.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <PremiumStatCard
          title="Accounts"
          value="0"
          subtitle="Total accounts"
          icon={<Building2 className="w-5 h-5" />}
          gradient="bg-gradient-to-r from-amber-500 to-orange-400"
          href="/crm/modules/accounts"
        />
        <PremiumStatCard
          title="Contacts"
          value="0"
          subtitle="Total contacts"
          icon={<Users className="w-5 h-5" />}
          gradient="bg-gradient-to-r from-[#047474] to-[#069B9A]"
          href="/crm/modules/contacts"
        />
        <PremiumStatCard
          title="Deals"
          value="0"
          subtitle="Total deals"
          icon={<DollarSign className="w-5 h-5" />}
          gradient="bg-gradient-to-r from-emerald-500 to-teal-400"
          href="/crm/modules/deals"
        />
        <PremiumStatCard
          title="Leads"
          value="0"
          subtitle="Total leads"
          icon={<UserPlus className="w-5 h-5" />}
          gradient="bg-gradient-to-r from-violet-500 to-purple-400"
          href="/crm/modules/leads"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {stats.map((stat) => {
        const config = statConfigs[stat.moduleKey] || statConfigs.contacts;
        return (
          <PremiumStatCard
            key={stat.moduleKey}
            title={stat.moduleName}
            value={stat.totalRecords.toLocaleString()}
            subtitle={`Total ${stat.moduleName.toLowerCase()}`}
            icon={config.icon}
            gradient={config.gradient}
            href={`/crm/modules/${stat.moduleKey}`}
            change={stat.createdThisWeek}
          />
        );
      })}
    </div>
  );
}
