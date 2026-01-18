'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Shield,
  User,
  Mail,
  MoreHorizontal,
  Check,
  X,
  Clock,
  UserPlus,
  Crown,
  RefreshCw,
  Trash2,
  Edit,
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui';

type UserRole = 'owner' | 'super_admin' | 'admin' | 'advisor' | 'staff';
type InvitableRole = 'super_admin' | 'admin' | 'advisor' | 'staff';
type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

interface TeamInvitation {
  id: string;
  email: string;
  role: InvitableRole;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
  invited_by: string;
  inviter_name?: string;
}

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bgColor: string; description: string }> = {
  owner: {
    label: 'Owner',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10',
    description: 'Full control including billing and organization settings',
  },
  super_admin: {
    label: 'Super Admin',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/10',
    description: 'Full access except ownership transfer',
  },
  admin: {
    label: 'Admin',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
    description: 'Can manage team members and settings',
  },
  advisor: {
    label: 'Advisor',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    description: 'Can manage assigned members and leads',
  },
  staff: {
    label: 'Staff',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-500/10',
    description: 'Standard operational access',
  },
};

const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 5,
  super_admin: 4,
  admin: 3,
  advisor: 2,
  staff: 1,
};

function canManageRole(userRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] > ROLE_HIERARCHY[targetRole];
}

export default function TeamManagementPage() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InvitableRole>('staff');
  const [inviting, setInviting] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadTeamData();
  }, []);

  async function loadTeamData() {
    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;
      setCurrentUser(profile as TeamMember);

      // Check if user has permission
      if (!['owner', 'super_admin', 'admin'].includes(profile.role)) {
        toast.error('You do not have permission to access this page');
        return;
      }

      // Get team members
      const { data: members } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('role')
        .order('full_name');

      setTeamMembers((members || []) as TeamMember[]);

      // Get pending invitations
      const { data: invites } = await supabase
        .from('team_invitations')
        .select(`
          *,
          inviter:profiles!team_invitations_invited_by_fkey(full_name)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      setInvitations((invites || []).map((inv: any) => ({
        ...inv,
        inviter_name: inv.inviter?.full_name,
      })) as TeamInvitation[]);
    } catch (error) {
      console.error('Error loading team data:', error);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail || !inviteRole) {
      toast.error('Please enter an email and select a role');
      return;
    }

    setInviting(true);
    try {
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitation');
      }

      toast.success(`Invitation sent to ${inviteEmail}`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('staff');
      loadTeamData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    try {
      const response = await fetch(`/api/team/invite/${invitationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to revoke invitation');
      }

      toast.success('Invitation revoked');
      loadTeamData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke invitation');
    }
  }

  async function handleResendInvitation(invitationId: string) {
    try {
      const response = await fetch(`/api/team/invite/${invitationId}/resend`, {
        method: 'POST',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to resend invitation');
      }

      toast.success('Invitation resent');
      loadTeamData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resend invitation');
    }
  }

  async function handleUpdateRole(memberId: string, newRole: UserRole) {
    try {
      const response = await fetch(`/api/team/members/${memberId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update role');
      }

      toast.success('Role updated successfully');
      setShowEditModal(false);
      setEditingMember(null);
      loadTeamData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update role');
    }
  }

  async function handleDeactivateMember(memberId: string) {
    try {
      const response = await fetch(`/api/team/members/${memberId}/deactivate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to deactivate member');
      }

      toast.success('Member deactivated');
      loadTeamData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to deactivate member');
    }
  }

  async function handleReactivateMember(memberId: string) {
    try {
      const response = await fetch(`/api/team/members/${memberId}/reactivate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to reactivate member');
      }

      toast.success('Member reactivated');
      loadTeamData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reactivate member');
    }
  }

  const canInviteRole = (role: InvitableRole): boolean => {
    if (!currentUser) return false;
    if (role === 'super_admin') {
      return ['owner', 'super_admin'].includes(currentUser.role);
    }
    return ['owner', 'super_admin', 'admin'].includes(currentUser.role);
  };

  const activeMembers = teamMembers.filter(m => m.is_active);
  const inactiveMembers = teamMembers.filter(m => !m.is_active);

  if (loading) {
    return <TeamPageSkeleton />;
  }

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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Team Management</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Manage team members and their roles
            </p>
          </div>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Team Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Members</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{teamMembers.length}</p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Active</p>
          <p className="text-2xl font-bold text-emerald-600">{activeMembers.length}</p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Inactive</p>
          <p className="text-2xl font-bold text-slate-500">{inactiveMembers.length}</p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Pending Invites</p>
          <p className="text-2xl font-bold text-amber-600">{invitations.length}</p>
        </div>
      </div>

      {/* Role Legend */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Role Permissions</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {(Object.entries(ROLE_CONFIG) as [UserRole, typeof ROLE_CONFIG[UserRole]][]).map(([role, info]) => (
            <div key={role}>
              <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded mb-1 ${info.bgColor} ${info.color}`}>
                {role === 'owner' && <Crown className="w-3 h-3" />}
                {info.label}
              </span>
              <p className="text-xs text-slate-500">{info.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="glass-card border border-amber-200 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-700/50 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Pending Invitations ({invitations.length})
            </h2>
          </div>
          <div className="divide-y divide-amber-200 dark:divide-amber-700/30">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 dark:text-white font-medium">{invitation.email}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Invited as {ROLE_CONFIG[invitation.role]?.label || invitation.role}
                    {invitation.inviter_name && ` by ${invitation.inviter_name}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    Expires {new Date(invitation.expires_at).toLocaleDateString()}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleResendInvitation(invitation.id)}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resend
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleRevokeInvitation(invitation.id)}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Revoke
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Team Members */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <Shield className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">
            Active Team Members ({activeMembers.length})
          </h2>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700/50">
          {activeMembers.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              currentUser={currentUser}
              onEditRole={() => {
                setEditingMember(member);
                setShowEditModal(true);
              }}
              onDeactivate={() => handleDeactivateMember(member.id)}
            />
          ))}
        </div>
      </div>

      {/* Inactive Members */}
      {inactiveMembers.length > 0 && (
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden opacity-75">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Inactive Members ({inactiveMembers.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700/50">
            {inactiveMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                currentUser={currentUser}
                onReactivate={() => handleReactivateMember(member.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={inviteEmail}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={(v: string) => setInviteRole(v as InvitableRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canInviteRole('super_admin') && (
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  )}
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="advisor">Advisor</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                {ROLE_CONFIG[inviteRole]?.description}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Change role for {editingMember?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select
                value={editingMember?.role}
                onValueChange={(v: string) => {
                  if (editingMember) {
                    handleUpdateRole(editingMember.id, v as UserRole);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentUser?.role === 'owner' && (
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  )}
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="advisor">Advisor</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MemberRowProps {
  member: TeamMember;
  currentUser: TeamMember | null;
  onEditRole?: () => void;
  onDeactivate?: () => void;
  onReactivate?: () => void;
}

function MemberRow({ member, currentUser, onEditRole, onDeactivate, onReactivate }: MemberRowProps) {
  const roleInfo = ROLE_CONFIG[member.role];
  const isCurrentUser = currentUser?.id === member.id;
  const canManage = currentUser && !isCurrentUser && canManageRole(currentUser.role, member.role);

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-slate-900 dark:text-white font-medium">
            {member.full_name}
          </span>
          {isCurrentUser && (
            <span className="px-1.5 py-0.5 text-xs bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded">
              You
            </span>
          )}
          {!member.is_active && (
            <span className="px-1.5 py-0.5 text-xs bg-red-500/10 text-red-600 dark:text-red-400 rounded">
              Inactive
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          <Mail className="w-3 h-3" />
          {member.email}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${roleInfo?.bgColor} ${roleInfo?.color}`}>
          {member.role === 'owner' && <Crown className="w-3 h-3" />}
          {roleInfo?.label || member.role}
        </span>

        {canManage && member.is_active && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEditRole && (
                <DropdownMenuItem onClick={onEditRole}>
                  <Edit className="w-4 h-4 mr-2" />
                  Change Role
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {onDeactivate && (
                <DropdownMenuItem className="text-red-600" onClick={onDeactivate}>
                  <X className="w-4 h-4 mr-2" />
                  Deactivate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {canManage && !member.is_active && onReactivate && (
          <Button variant="outline" size="sm" onClick={onReactivate}>
            <Check className="w-4 h-4 mr-1" />
            Reactivate
          </Button>
        )}
      </div>
    </div>
  );
}

function TeamPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="space-y-2">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
        ))}
      </div>
      <div className="h-24 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
      <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
    </div>
  );
}
