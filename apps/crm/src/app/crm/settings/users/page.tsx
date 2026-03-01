'use client';

/**
 * CRM User Management Page
 *
 * Allows admins to:
 * - View all organization users and their CRM roles
 * - Invite new users to the organization
 * - Change CRM roles (crm_admin, crm_manager, crm_agent, crm_viewer, or revoke)
 * - Send password reset emails
 * - Directly set user passwords (admin override)
 * - Edit user details (name, active status)
 * - Deactivate / remove users
 * - View and manage pending invitations
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  Mail,
  MoreVertical,
  KeyRound,
  UserCog,
  RefreshCw,
  Eye,
  EyeOff,
  Power,
  PowerOff,
  Check,
  X,
  UserPlus,
  Clock,
  Send,
  Trash2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Avatar } from '@/components/shared';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@crm-eco/ui/components/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';
import { createClient } from '@crm-eco/lib/supabase/client';
import { useClientAuth } from '@/hooks/useClientAuth';
import type { CrmRole } from '@/lib/crm/types';

// ============================================================================
// Types & Constants
// ============================================================================

interface UserProfile {
  id: string;
  user_id: string;
  organization_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  crm_role: CrmRole | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  invited_by: string;
  inviter_name?: string;
}

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

const ORG_ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  super_admin: 'Super Admin',
  admin: 'Admin',
  advisor: 'Advisor',
  staff: 'Staff',
};

// ============================================================================
// User Row Component
// ============================================================================

function UserRow({
  user,
  currentUserId,
  onRoleChange,
  onSendPasswordReset,
  onSetPassword,
  onEditUser,
  onToggleActive,
  onRemoveUser,
}: {
  user: UserProfile;
  currentUserId: string;
  onRoleChange: (user: UserProfile, newRole: CrmRole | 'no_access' | '') => void;
  onSendPasswordReset: (user: UserProfile) => void;
  onSetPassword: (user: UserProfile) => void;
  onEditUser: (user: UserProfile) => void;
  onToggleActive: (user: UserProfile) => void;
  onRemoveUser: (user: UserProfile) => void;
}) {
  const roleInfo = user.crm_role ? ROLE_LABELS[user.crm_role] : null;
  const isSelf = user.id === currentUserId;

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      <Avatar src={user.avatar_url} alt={user.full_name} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-slate-900 dark:text-white font-medium">{user.full_name}</span>
          {isSelf && (
            <Badge variant="outline" className="text-xs">You</Badge>
          )}
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

      <div className="flex items-center gap-3">
        {/* Role Badge */}
        {roleInfo ? (
          <span className={`px-2 py-1 text-xs font-medium rounded ${roleInfo.color}`}>
            {roleInfo.label}
          </span>
        ) : (
          <span className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
            No CRM Access
          </span>
        )}

        {/* Role Selector (disabled for self) */}
        {!isSelf ? (
          <Select
            value={user.crm_role || 'no_access'}
            onValueChange={(value) => onRoleChange(user, value as CrmRole | '')}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Set role..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no_access">No Access</SelectItem>
              <SelectItem value="crm_viewer">Viewer</SelectItem>
              <SelectItem value="crm_agent">Agent</SelectItem>
              <SelectItem value="crm_manager">Manager</SelectItem>
              <SelectItem value="crm_admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="w-[140px]" />
        )}

        {/* Actions Dropdown */}
        {!isSelf && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs text-slate-500">
                Manage {user.full_name.split(' ')[0]}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEditUser(user)}>
                <UserCog className="w-4 h-4 mr-2" />
                Edit User Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onSendPasswordReset(user)}>
                <Mail className="w-4 h-4 mr-2" />
                Send Password Reset
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSetPassword(user)}>
                <KeyRound className="w-4 h-4 mr-2" />
                Set New Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onToggleActive(user)}
                className={user.is_active ? 'text-amber-600' : 'text-emerald-600'}
              >
                {user.is_active ? (
                  <>
                    <PowerOff className="w-4 h-4 mr-2" />
                    Deactivate User
                  </>
                ) : (
                  <>
                    <Power className="w-4 h-4 mr-2" />
                    Reactivate User
                  </>
                )}
              </DropdownMenuItem>
              {user.role !== 'owner' && (
                <DropdownMenuItem
                  onClick={() => onRemoveUser(user)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove User
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function UsersPage() {
  const router = useRouter();
  const supabase = createClient();
  const { user: authUser, profile: authProfile, loading: authLoading } = useClientAuth();

  // Data state
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  // Dialog state
  const [passwordDialog, setPasswordDialog] = useState<{
    open: boolean;
    user: UserProfile | null;
  }>({ open: false, user: null });
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    user: UserProfile | null;
  }>({ open: false, user: null });
  const [inviteDialog, setInviteDialog] = useState(false);
  const [removeDialog, setRemoveDialog] = useState<{
    open: boolean;
    user: UserProfile | null;
  }>({ open: false, user: null });

  // Form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('staff');
  const [inviting, setInviting] = useState(false);

  // ========================================================================
  // Data Loading
  // ========================================================================

  const loadUsers = useCallback(async () => {
    if (!authProfile?.organization_id) return;

    // Redirect non-admins
    if (authProfile.crm_role !== 'crm_admin') {
      router.push('/crm/settings?error=admin_only');
      return;
    }

    try {
      // Get all org users
      const { data: orgUsers } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', authProfile.organization_id)
        .order('full_name');

      setUsers((orgUsers || []) as UserProfile[]);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [supabase, router, authProfile]);

  const loadInvitations = useCallback(async () => {
    if (!authProfile?.organization_id) return;

    try {
      const { data } = await supabase
        .from('team_invitations')
        .select('*, inviter:profiles!team_invitations_invited_by_fkey(full_name)')
        .eq('organization_id', authProfile.organization_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      setInvitations(
        (data || []).map((inv: Record<string, unknown>) => ({
          ...inv,
          inviter_name: (inv.inviter as { full_name?: string } | null)?.full_name || 'Unknown',
        })) as Invitation[]
      );
    } catch (error) {
      console.error('Failed to load invitations:', error);
    }
  }, [supabase, authProfile]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      router.push('/crm-login');
      return;
    }
    loadUsers();
    loadInvitations();
  }, [authLoading, authUser, loadUsers, loadInvitations, router]);

  // ========================================================================
  // Actions
  // ========================================================================

  /** Update a user's CRM role */
  async function handleRoleChange(user: UserProfile, newRole: CrmRole | 'no_access' | '') {
    const roleValue = newRole === 'no_access' ? '' : newRole;

    try {
      const res = await fetch(`/api/users/${user.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crm_role: roleValue }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, crm_role: (roleValue || null) as CrmRole | null }
            : u
        )
      );

      toast.success(data.message || 'Role updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update role');
    }
  }

  /** Send a password reset email to the user */
  async function handleSendPasswordReset(user: UserProfile) {
    try {
      const res = await fetch(`/api/users/${user.id}/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(data.message || `Password reset email sent to ${user.email}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send reset email');
    }
  }

  /** Directly set a user's password (admin override) */
  async function handleSetPassword() {
    if (!passwordDialog.user) return;

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 12) {
      toast.error('Password must be at least 12 characters');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/users/${passwordDialog.user.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(data.message || 'Password updated');
      setPasswordDialog({ open: false, user: null });
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to set password');
    } finally {
      setSaving(false);
    }
  }

  /** Edit a user's profile details */
  async function handleEditUser() {
    if (!editDialog.user) return;

    const trimmedName = editName.trim();
    if (trimmedName.length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/users/${editDialog.user.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: trimmedName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editDialog.user!.id ? { ...u, full_name: trimmedName } : u
        )
      );

      toast.success('User details updated');
      setEditDialog({ open: false, user: null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  }

  /** Toggle user active/inactive status */
  async function handleToggleActive(user: UserProfile) {
    const newStatus = !user.is_active;
    const action = newStatus ? 'reactivate' : 'deactivate';

    try {
      const res = await fetch(`/api/users/${user.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, is_active: newStatus } : u
        )
      );

      toast.success(`User ${action}d successfully`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action} user`);
    }
  }

  /** Remove (deactivate + revoke CRM access) a user */
  async function handleRemoveUser() {
    if (!removeDialog.user) return;
    const user = removeDialog.user;

    setSaving(true);
    try {
      // Deactivate and remove CRM role
      const res = await fetch(`/api/users/${user.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Also revoke CRM role
      if (user.crm_role) {
        await fetch(`/api/users/${user.id}/role`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ crm_role: '' }),
        });
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, is_active: false, crm_role: null } : u
        )
      );

      toast.success(`${user.full_name} has been removed`);
      setRemoveDialog({ open: false, user: null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove user');
    } finally {
      setSaving(false);
    }
  }

  /** Invite a new user */
  async function handleInviteUser() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setInviting(true);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: inviteRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(data.emailSent
        ? `Invitation sent to ${email}`
        : `Invitation created for ${email} (email delivery pending)`
      );

      setInviteDialog(false);
      setInviteEmail('');
      setInviteRole('staff');
      loadInvitations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  }

  /** Revoke a pending invitation */
  async function handleRevokeInvitation(invitationId: string) {
    try {
      const res = await fetch(`/api/team/invite/${invitationId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      toast.success('Invitation revoked');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke invitation');
    }
  }

  /** Resend a pending invitation */
  async function handleResendInvitation(invitationId: string) {
    try {
      const res = await fetch(`/api/team/invite/${invitationId}/resend`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success('Invitation resent');
      loadInvitations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resend invitation');
    }
  }

  // ========================================================================
  // Dialog Openers
  // ========================================================================

  function openSetPassword(user: UserProfile) {
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setPasswordDialog({ open: true, user });
  }

  function openEditUser(user: UserProfile) {
    setEditName(user.full_name);
    setEditDialog({ open: true, user });
  }

  // ========================================================================
  // Derived Data
  // ========================================================================

  const crmUsers = users.filter((u) => u.crm_role);
  const nonCrmUsers = users.filter((u) => !u.crm_role);

  // ========================================================================
  // Loading State
  // ========================================================================

  if (loading) {
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

  // ========================================================================
  // Render
  // ========================================================================

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
              Manage who has access to the CRM and their permissions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { loadUsers(); loadInvitations(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setInviteDialog(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Role Legend */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Role Permissions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.entries(ROLE_LABELS) as [CrmRole, (typeof ROLE_LABELS)[CrmRole]][]).map(
            ([role, info]) => (
              <div key={role}>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded mb-1 ${info.color}`}>
                  {info.label}
                </span>
                <p className="text-xs text-slate-500">{info.description}</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="glass-card border border-amber-200 dark:border-amber-700/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-700/50 flex items-center gap-2 bg-amber-50/50 dark:bg-amber-500/5">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-medium text-amber-900 dark:text-amber-300">
              Pending Invitations ({invitations.length})
            </h2>
          </div>
          <div className="divide-y divide-amber-100 dark:divide-amber-700/30">
            {invitations.map((inv) => {
              const isExpired = new Date(inv.expires_at) < new Date();
              return (
                <div key={inv.id} className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 dark:text-white font-medium">{inv.email}</span>
                      {isExpired && (
                        <span className="px-1.5 py-0.5 text-xs bg-red-500/10 text-red-600 dark:text-red-400 rounded">
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Invited as {ORG_ROLE_LABELS[inv.role] || inv.role}
                      {inv.inviter_name && <> by {inv.inviter_name}</>}
                      {' \u00b7 '}
                      {new Date(inv.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleResendInvitation(inv.id)}
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
                      onClick={() => handleRevokeInvitation(inv.id)}
                    >
                      <X className="w-3.5 h-3.5 mr-1.5" />
                      Revoke
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              <UserRow
                key={user.id}
                user={user}
                currentUserId={authProfile?.id || ''}
                onRoleChange={handleRoleChange}
                onSendPasswordReset={handleSendPasswordReset}
                onSetPassword={openSetPassword}
                onEditUser={openEditUser}
                onToggleActive={handleToggleActive}
                onRemoveUser={(u) => setRemoveDialog({ open: true, user: u })}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            No users have CRM access yet. Invite users or assign CRM roles to existing organization members.
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
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Assign a CRM role to grant access
            </p>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700/50">
            {nonCrmUsers.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                currentUserId={authProfile?.id || ''}
                onRoleChange={handleRoleChange}
                onSendPasswordReset={handleSendPasswordReset}
                onSetPassword={openSetPassword}
                onEditUser={openEditUser}
                onToggleActive={handleToggleActive}
                onRemoveUser={(u) => setRemoveDialog({ open: true, user: u })}
              />
            ))}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Invite User Dialog */}
      {/* ================================================================== */}
      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-teal-500" />
              Invite User
            </DialogTitle>
            <DialogDescription>
              Send an invitation email to add a new user to your organization.
              They will receive a link to create their account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="invite-email" className="mb-1.5 block">
                Email Address
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleInviteUser(); }}
              />
            </div>

            <div>
              <Label htmlFor="invite-role" className="mb-1.5 block">
                Organization Role
              </Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="advisor">Advisor</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1.5">
                You can assign a CRM-specific role after they accept the invitation.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteUser} disabled={inviting}>
              {inviting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Remove User Confirmation Dialog */}
      {/* ================================================================== */}
      <AlertDialog
        open={removeDialog.open}
        onOpenChange={(open) => {
          if (!open) setRemoveDialog({ open: false, user: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Remove User
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{removeDialog.user?.full_name}</strong>?
              This will deactivate their account and revoke all CRM access.
              They will no longer be able to log in. This action can be reversed by reactivating the user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveUser}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={saving}
            >
              {saving ? 'Removing...' : 'Remove User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ================================================================== */}
      {/* Set Password Dialog */}
      {/* ================================================================== */}
      <Dialog
        open={passwordDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordDialog({ open: false, user: null });
            setNewPassword('');
            setConfirmPassword('');
            setShowPassword(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-teal-500" />
              Set Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{passwordDialog.user?.full_name}</strong>.
              They will need to use this password to log in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="New password (min 12 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>

            {/* Password requirements */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Requirements:</p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li className="flex items-center gap-1.5">
                  {newPassword.length >= 12 ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <X className="w-3 h-3 text-slate-300" />
                  )}
                  At least 12 characters
                </li>
                <li className="flex items-center gap-1.5">
                  {/[A-Z]/.test(newPassword) ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <X className="w-3 h-3 text-slate-300" />
                  )}
                  One uppercase letter
                </li>
                <li className="flex items-center gap-1.5">
                  {/[a-z]/.test(newPassword) ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <X className="w-3 h-3 text-slate-300" />
                  )}
                  One lowercase letter
                </li>
                <li className="flex items-center gap-1.5">
                  {/[0-9]/.test(newPassword) ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <X className="w-3 h-3 text-slate-300" />
                  )}
                  One number
                </li>
                <li className="flex items-center gap-1.5">
                  {newPassword === confirmPassword && newPassword.length > 0 ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <X className="w-3 h-3 text-slate-300" />
                  )}
                  Passwords match
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPasswordDialog({ open: false, user: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleSetPassword} disabled={saving}>
              {saving ? 'Setting...' : 'Set Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Edit User Dialog */}
      {/* ================================================================== */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setEditDialog({ open: false, user: null });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5 text-teal-500" />
              Edit User Details
            </DialogTitle>
            <DialogDescription>
              Update details for <strong>{editDialog.user?.full_name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                Full Name
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                Email
              </label>
              <Input
                value={editDialog.user?.email || ''}
                disabled
                className="bg-slate-50 dark:bg-slate-800/50"
              />
              <p className="text-xs text-slate-400 mt-1">
                Email cannot be changed from here
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                Status
              </label>
              <Badge
                className={
                  editDialog.user?.is_active
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                }
              >
                {editDialog.user?.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, user: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleEditUser} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
