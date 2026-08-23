'use client';

import { useRouter } from 'next/navigation';
import {
  UserPlus,
  Contact,
  DollarSign,
  ClipboardCheck,
  PhoneCall,
  Mail,
  Calendar,
  StickyNote,
  Blocks,
  Building,
  Upload,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmModule } from '@/lib/crm/types';
import { resolveCreateIntent } from '@/lib/crm/create-intent';
import { openCrmQuickCreate } from '@/lib/crm/create-intent-bus';
import { useClientAuth } from '@/hooks/useClientAuth';
import { canCreateRecords } from '@/lib/crm/can-create-records';
import { isCrmManagerOrAdminRole } from '@/lib/crm/nav-profile';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  href: string;
}

const defaultActions: QuickAction[] = [
  {
    id: 'new-lead',
    label: 'New Lead',
    icon: <UserPlus className="w-4 h-4" />,
    color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
    href: '/crm/modules/leads/new',
  },
  {
    id: 'new-contact',
    label: 'New Contact',
    icon: <Contact className="w-4 h-4" />,
    color: 'text-teal-500 bg-teal-50 dark:bg-teal-500/10',
    href: '/crm/modules/contacts/new',
  },
  {
    id: 'new-deal',
    label: 'New Deal',
    icon: <DollarSign className="w-4 h-4" />,
    color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
    href: '/crm/modules/deals/new',
  },
  {
    id: 'new-account',
    label: 'New Account',
    icon: <Building className="w-4 h-4" />,
    color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10',
    href: '/crm/modules/accounts/new',
  },
  {
    id: 'new-task',
    label: 'New Task',
    icon: <ClipboardCheck className="w-4 h-4" />,
    color: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10',
    href: '/crm/tasks/new',
  },
  {
    id: 'log-call',
    label: 'Log Call',
    icon: <PhoneCall className="w-4 h-4" />,
    color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10',
    href: '/crm/activities?type=call',
  },
  {
    id: 'send-email',
    label: 'Send Email',
    icon: <Mail className="w-4 h-4" />,
    color: 'text-sky-500 bg-sky-50 dark:bg-sky-500/10',
    href: '/crm/inbox?compose=true',
  },
  {
    id: 'schedule-meeting',
    label: 'Meeting',
    icon: <Calendar className="w-4 h-4" />,
    color: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10',
    href: '/crm/activities?type=meeting',
  },
  {
    id: 'import-data',
    label: 'Import Data',
    icon: <Upload className="w-4 h-4" />,
    color: 'text-slate-500 bg-slate-100 dark:bg-slate-500/10',
    href: '/crm/import',
  },
];

interface CommandsPopupProps {
  modules: CrmModule[];
  onClose: () => void;
}

/** Create shortcuts (`…/new`) need a creating role; Import needs manager/admin (same gates as the palette / nav). */
export function commandsPopupActionAllowed(href: string, crmRole: string | null | undefined): boolean {
  if (/^\/crm\/modules\/[^/]+\/new$/.test(href) || href === '/crm/tasks/new') return canCreateRecords(crmRole);
  if (href.startsWith('/crm/import')) return isCrmManagerOrAdminRole(crmRole);
  return true;
}

export function CommandsPopup({ modules, onClose }: CommandsPopupProps) {
  const router = useRouter();
  // DE-M1: the same role predicate as every other create affordance — a
  // crm_viewer never sees New Lead / New Contact / … here either.
  const { profile } = useClientAuth();
  const crmRole = profile?.crm_role;

  const dealsEnabled = modules.some((m) => m.key === 'deals' && m.is_enabled);
  const handleAction = (href: string) => {
    const match = href.match(/^\/crm\/modules\/([^/]+)\/new$/);
    if (match) {
      const intent = resolveCreateIntent({ moduleKey: match[1]!, dealsEnabled });
      if (intent.kind === 'blocked') {
        onClose();
        return;
      }
      if (intent.kind === 'quick') {
        openCrmQuickCreate(intent.moduleKey);
        onClose();
        return;
      }
    }
    router.push(href);
    onClose();
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <Blocks className="w-4 h-4 text-teal-500" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Quick Actions</h3>
      </div>

      {/* Actions Grid */}
      <div className="p-3 grid grid-cols-3 gap-2">
        {defaultActions
          .filter((action) => action.id !== 'new-deal' || dealsEnabled)
          .filter((action) => commandsPopupActionAllowed(action.href, crmRole))
          .map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action.href)}
            className={cn(
              'flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-all',
              'hover:scale-[1.02] active:scale-[0.98] hover:shadow-sm hover:border-teal-200 dark:hover:border-teal-500/30'
            )}
          >
            <span className={cn('flex items-center justify-center w-8 h-8 rounded-lg', action.color)}>
              {action.icon}
            </span>
            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 text-center leading-tight">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
