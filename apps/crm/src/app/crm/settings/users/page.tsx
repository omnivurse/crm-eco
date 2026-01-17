import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Shield, User, Mail, Check, X } from 'lucide-react';
import { getCurrentProfile, getOrganizationProfiles } from '@/lib/crm/queries';
import type { CrmProfile, CrmRole } from '@/lib/crm/types';

const ROLE_LABELS: Record<CrmRole, { label: string; color: string; description: string }> = {
  crm_admin: {
    label: 'Admin',
    color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10',
    description: 'Full access to all CRM features and settings',
  },
  crm_manager: {
    label: 'Manager',
    color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
    description: 'Can create, edit, delete records and import data',
  },
  crm_agent: {
    label: 'Agent',
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    description: 'Can create and edit records',
  },
  crm_viewer: {
    label: 'Viewer',
    color: 'text-slate-600 dark:text-slate-400 bg-slate-500/10',
    description: 'Read-only access to CRM records',
  },
};

function UserRow({ user }: { user: CrmProfile }) {
  const roleInfo = user.crm_role ? ROLE_LABELS[user.crm_role] : null;

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full" />
        ) : (
          <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-slate-900 dark:text-white font-medium">{user.full_name}</span>
          {!user.is_active && (
            <span className="px-1.5 py-0.5 text-xs bg-red-500/10 text-red-600 dark:text-red-400 rounded">
              Inactive
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          <Mail className="w-3 h-3" />
          {user.email}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {roleInfo ? (
          <span className={`px-2 py-1 text-xs font-medium rounded ${roleInfo.color}`}>
            {roleInfo.label}
          </span>
        ) : (
          <span className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
            No CRM Access
          </span>
        )}

        <select
          defaultValue={user.crm_role || ''}
          className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">No Access</option>
          <option value="crm_viewer">Viewer</option>
          <option value="crm_agent">Agent</option>
          <option value="crm_manager">Manager</option>
          <option value="crm_admin">Admin</option>
        </select>
      </div>
    </div>
  );
}

async function UsersContent() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  if (profile.crm_role !== 'crm_admin') {
    redirect('/crm/settings?error=admin_only');
  }

  const allProfiles = await getOrganizationProfiles(profile.organization_id);

  // Get all users in org, not just CRM users
  const { createCrmClient } = await import('@/lib/crm/queries');
  const supabase = await createCrmClient();
  const { data: orgProfiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('is_active', true)
    .order('full_name');

  const users = (orgProfiles || []) as CrmProfile[];
  const crmUsers = users.filter(u => u.crm_role);
  const nonCrmUsers = users.filter(u => !u.crm_role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/crm/settings"
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">CRM Users</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Manage who has access to the CRM
            </p>
          </div>
        </div>
      </div>

      {/* Role Legend */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Role Permissions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.entries(ROLE_LABELS) as [CrmRole, typeof ROLE_LABELS[CrmRole]][]).map(([role, info]) => (
            <div key={role}>
              <span className={`inline-block px-2 py-1 text-xs font-medium rounded mb-1 ${info.color}`}>
                {info.label}
              </span>
              <p className="text-xs text-slate-500">{info.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CRM Users */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <Shield className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">
            CRM Users ({crmUsers.length})
          </h2>
        </div>
        {crmUsers.length > 0 ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-700/50">
            {crmUsers.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            No users have CRM access yet
          </div>
        )}
      </div>

      {/* Other Org Users */}
      {nonCrmUsers.length > 0 && (
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Other Organization Users ({nonCrmUsers.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700/50">
            {nonCrmUsers.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<UsersSkeleton />}>
      <UsersContent />
    </Suspense>
  );
}

function UsersSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="space-y-2">
          <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
      <div className="h-24 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
      <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
    </div>
  );
}
