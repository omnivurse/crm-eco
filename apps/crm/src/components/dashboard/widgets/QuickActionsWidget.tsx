'use client';

import Link from 'next/link';
import {
  Users,
  DollarSign,
  Calendar,
  BarChart3,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import type { WidgetSize } from '@/lib/dashboard/types';

interface QuickActionsWidgetProps {
  data: null;
  size: WidgetSize;
}

const actions = [
  {
    href: '/crm/modules/contacts/new',
    icon: Users,
    label: 'New Contact',
    description: 'Add a contact',
    hoverBorder: 'hover:border-[#047474]/20',
    hoverBg: 'hover:from-[#047474]/5',
    iconBg: 'bg-[#047474]/10',
    iconBgHover: 'group-hover:bg-[#047474]',
    iconColor: 'text-[#047474]',
    chevronColor: 'group-hover:text-[#047474]',
  },
  {
    href: '/crm/modules/deals/new',
    icon: DollarSign,
    label: 'New Deal',
    description: 'Create a deal',
    hoverBorder: 'hover:border-emerald-200',
    hoverBg: 'hover:from-emerald-500/5',
    iconBg: 'bg-emerald-100 dark:bg-emerald-500/10',
    iconBgHover: 'group-hover:bg-emerald-500',
    iconColor: 'text-emerald-600',
    chevronColor: 'group-hover:text-emerald-500',
  },
  {
    href: '/crm/tasks/new',
    icon: Calendar,
    label: 'New Task',
    description: 'Schedule a task',
    hoverBorder: 'hover:border-amber-200',
    hoverBg: 'hover:from-amber-500/5',
    iconBg: 'bg-amber-100 dark:bg-amber-500/10',
    iconBgHover: 'group-hover:bg-amber-500',
    iconColor: 'text-amber-600',
    chevronColor: 'group-hover:text-amber-500',
  },
  {
    href: '/crm/reports',
    icon: BarChart3,
    label: 'View Reports',
    description: 'Analytics',
    hoverBorder: 'hover:border-violet-200',
    hoverBg: 'hover:from-violet-500/5',
    iconBg: 'bg-violet-100 dark:bg-violet-500/10',
    iconBgHover: 'group-hover:bg-violet-500',
    iconColor: 'text-violet-600',
    chevronColor: 'group-hover:text-violet-500',
  },
];

export default function QuickActionsWidget({ size }: QuickActionsWidgetProps) {
  const displayCount = size === 'small' ? 3 : 4;

  return (
    <WidgetCard
      title="Quick Actions"
      subtitle="Common tasks"
      icon={<Zap className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-[#003560] via-[#047474] to-[#E9B61F]"
    >
      <div className="space-y-2">
        {actions.slice(0, displayCount).map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`group flex items-center gap-4 p-4 rounded-xl border border-transparent ${action.hoverBorder} hover:bg-gradient-to-r ${action.hoverBg} hover:to-transparent transition-all`}
            >
              <div
                className={`p-3 rounded-xl ${action.iconBg} ${action.iconBgHover} transition-colors`}
              >
                <Icon
                  className={`w-5 h-5 ${action.iconColor} group-hover:text-white transition-colors`}
                />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                  {action.label}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {action.description}
                </p>
              </div>
              <ChevronRight
                className={`w-5 h-5 text-slate-300 ${action.chevronColor} group-hover:translate-x-1 transition-all`}
              />
            </Link>
          );
        })}
      </div>
    </WidgetCard>
  );
}
