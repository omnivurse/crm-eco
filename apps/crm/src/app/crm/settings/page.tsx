import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Boxes,
  FormInput,
  Layout,
  FileSpreadsheet,
  Users,
  UserPlus,
  ChevronRight,
  Settings,
  Zap,
  Activity,
  Mail,
  FileSignature,
  Globe,
  Image,
} from 'lucide-react';
import { getCurrentProfile } from '@/lib/crm/queries';

interface SettingCard {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  highlight?: boolean;
}

const settingsCards: SettingCard[] = [
  {
    title: 'Email System',
    description: 'Templates, signatures, domains, and asset library',
    href: '/crm/settings/templates',
    icon: <Mail className="w-6 h-6" />,
    highlight: true,
  },
  {
    title: 'Email Domains',
    description: 'Configure and verify sending domains',
    href: '/crm/settings/email-domains',
    icon: <Globe className="w-6 h-6" />,
    adminOnly: true,
  },
  {
    title: 'Email Signatures',
    description: 'Create and manage your email signatures',
    href: '/crm/settings/signatures',
    icon: <FileSignature className="w-6 h-6" />,
  },
  {
    title: 'Automations',
    description: 'Workflows, assignment rules, scoring, cadences, and webforms',
    href: '/crm/settings/automations',
    icon: <Zap className="w-6 h-6" />,
    adminOnly: true,
  },
  {
    title: 'Modules',
    description: 'Enable, disable, and configure CRM modules',
    href: '/crm/settings/modules',
    icon: <Boxes className="w-6 h-6" />,
    adminOnly: true,
  },
  {
    title: 'Fields',
    description: 'Customize fields for each module',
    href: '/crm/settings/fields',
    icon: <FormInput className="w-6 h-6" />,
    adminOnly: true,
  },
  {
    title: 'Layouts',
    description: 'Configure form layouts and sections',
    href: '/crm/settings/layouts',
    icon: <Layout className="w-6 h-6" />,
    adminOnly: true,
  },
  {
    title: 'Import Mappings',
    description: 'Manage saved import mapping templates',
    href: '/crm/settings/mappings',
    icon: <FileSpreadsheet className="w-6 h-6" />,
  },
  {
    title: 'Team Management',
    description: 'Invite team members and manage roles',
    href: '/crm/settings/team',
    icon: <UserPlus className="w-6 h-6" />,
    adminOnly: true,
    highlight: true,
  },
  {
    title: 'CRM Users',
    description: 'Manage CRM user access and roles',
    href: '/crm/settings/users',
    icon: <Users className="w-6 h-6" />,
    adminOnly: true,
  },
  {
    title: 'System Health',
    description: 'Monitor system status, connectivity, and configuration',
    href: '/crm/settings/system-health',
    icon: <Activity className="w-6 h-6" />,
    adminOnly: true,
  },
];

async function SettingsContent() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  const isAdmin = profile.crm_role === 'crm_admin';
  const visibleCards = settingsCards.filter(card => !card.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <Settings className="w-6 h-6 text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">CRM Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Configure your CRM modules, fields, and preferences
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6 hover:border-teal-500/50 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-lg ${card.highlight ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-teal-500/10 text-teal-600 dark:text-teal-400'}`}>
                {card.icon}
              </div>
              <ChevronRight className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-colors ${card.highlight ? 'group-hover:text-amber-600 dark:group-hover:text-amber-400' : 'group-hover:text-teal-600 dark:group-hover:text-teal-400'}`} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{card.title}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-20 bg-slate-200 dark:bg-slate-800/50 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-40 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
