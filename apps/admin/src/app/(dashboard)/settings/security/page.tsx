'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@crm-eco/ui';
import {
  Shield,
  Users,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  ChevronLeft,
  Key,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface User {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  role: string;
  crm_role: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  created_at: string;
}

interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
}

const SYSTEM_ROLES = ['super_admin', 'admin', 'it', 'staff', 'advisor', 'member'];
const CRM_ROLES = ['crm_admin', 'crm_manager', 'crm_rep', 'crm_ops'];

const PERMISSIONS_MATRIX = [
  { key: 'read', label: 'View Records', description: 'View members, enrollments, and agents' },
  { key: 'write', label: 'Create/Edit Records', description: 'Create and modify records' },
  { key: 'delete', label: 'Delete Records', description: 'Permanently delete records' },
  { key: 'manage_users', label: 'Manage Users', description: 'Add, edit, and remove users' },
  { key: 'manage_settings', label: 'Manage Settings', description: 'Modify system settings' },
  { key: 'view_audit', label: 'View Audit Logs', description: 'Access audit and activity logs' },
  { key: 'view_reports', label: 'View Reports', description: 'Access reports and analytics' },
  { key: 'manage_team', label: 'Manage Team', description: 'Assign and manage team members' },
];

const roleColors: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800',
  admin: 'bg-red-100 text-red-800',
  it: 'bg-blue-100 text-blue-800',
  staff: 'bg-green-100 text-green-800',
  advisor: 'bg-yellow-100 text-yellow-800',
  member: 'bg-slate-100 text-slate-800',
  crm_admin: 'bg-purple-100 text-purple-800',
  crm_manager: 'bg-orange-100 text-orange-800',
  crm_rep: 'bg-teal-100 text-teal-800',
  crm_ops: 'bg-indigo-100 text-indigo-800',
};

export default function SecuritySettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState('');
  const [editingCrmRole, setEditingCrmRole] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [isSaving, setIsSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single() as { data: { organization_id: string } | null };

      if (!profile) return;
      setOrganizationId(profile.organization_id);

      // Load users in this organization
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, user_id, email, full_name, display_name, role, crm_role, is_active, is_super_admin, created_at')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false }) as { data: User[] | null };

      if (usersData) {
        setUsers(usersData);
      }

      // Try to load CRM governance roles (if table exists)
      try {
        const { data: rolesData } = await supabase
          .from('crm_roles')
          .select('*') as { data: Role[] | null };

        if (rolesData) {
          setRoles(rolesData);
        }
      } catch {
        // Table may not exist yet
        console.log('crm_roles table not available');
      }
    } catch (error) {
      console.error('Error loading security data:', error);
      toast.error('Failed to load security settings');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditingRole(user.role);
    setEditingCrmRole(user.crm_role || '');
    setIsEditModalOpen(true);
  };

  const handleSaveUserRole = async () => {
    if (!selectedUser) return;
    setIsSaving(true);

    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          role: editingRole,
          crm_role: editingCrmRole || null,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success('User role updated successfully');
      setIsEditModalOpen(false);
      loadData();
    } catch (error: unknown) {
      console.error('Error updating user role:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to update user role: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleUserActive = async (user: User) => {
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(user.is_active ? 'User deactivated' : 'User activated');
      loadData();
    } catch (error: unknown) {
      console.error('Error toggling user status:', error);
      toast.error('Failed to update user status');
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail || !organizationId) return;
    setIsSaving(true);

    try {
      // In a real implementation, this would send an invite email
      // For now, we'll show a placeholder message
      toast.success(`Invitation would be sent to ${inviteEmail}`);
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('staff');
    } catch (error: unknown) {
      console.error('Error inviting user:', error);
      toast.error('Failed to send invitation');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (user.email?.toLowerCase() || '').includes(searchLower) ||
      (user.full_name?.toLowerCase() || '').includes(searchLower) ||
      (user.display_name?.toLowerCase() || '').includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">User Security</h1>
          <p className="text-slate-500">Manage users, roles, and permissions</p>
        </div>
        <Button onClick={() => setIsInviteModalOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.filter(u => u.is_active).length}</p>
                <p className="text-sm text-muted-foreground">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.filter(u => u.role === 'admin' || u.role === 'super_admin').length}</p>
                <p className="text-sm text-muted-foreground">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <Key className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{roles.length || 4}</p>
                <p className="text-sm text-muted-foreground">Roles Defined</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Organization Users</CardTitle>
              <CardDescription>Manage user access and role assignments</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">User</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">System Role</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">CRM Role</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          {user.full_name || user.display_name || 'Unnamed User'}
                        </p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={roleColors[user.role] || 'bg-slate-100 text-slate-800'}>
                        {user.role}
                      </Badge>
                      {user.is_super_admin && (
                        <Badge className="ml-2 bg-purple-100 text-purple-800">
                          Super Admin
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.crm_role ? (
                        <Badge className={roleColors[user.crm_role] || 'bg-slate-100 text-slate-800'}>
                          {user.crm_role}
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.is_active ? 'default' : 'secondary'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleUserActive(user)}
                        >
                          {user.is_active ? (
                            <Lock className="h-4 w-4 text-red-500" />
                          ) : (
                            <Check className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Permissions Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Role Permissions Matrix</CardTitle>
          <CardDescription>Overview of permissions by role</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600 sticky left-0 bg-slate-50">
                    Permission
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Admin</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Manager</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Rep</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Ops</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PERMISSIONS_MATRIX.map((perm) => (
                  <tr key={perm.key} className="hover:bg-slate-50">
                    <td className="px-4 py-3 sticky left-0 bg-white">
                      <div>
                        <p className="font-medium text-slate-900">{perm.label}</p>
                        <p className="text-xs text-slate-500">{perm.description}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {['read', 'write', 'delete', 'manage_team', 'view_reports'].includes(perm.key) ? (
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-5 w-5 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {['read', 'write'].includes(perm.key) ? (
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-5 w-5 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {['read', 'view_audit', 'view_reports'].includes(perm.key) ? (
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-5 w-5 text-slate-300 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Role Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Update role assignments for {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>System Role</Label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={editingRole}
                onChange={(e) => setEditingRole(e.target.value)}
              >
                {SYSTEM_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                System role controls base access level
              </p>
            </div>
            <div className="space-y-2">
              <Label>CRM Role</Label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={editingCrmRole}
                onChange={(e) => setEditingCrmRole(e.target.value)}
              >
                <option value="">No CRM Role</option>
                {CRM_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.replace('crm_', '').replace(/\b\w/g, c => c.toUpperCase())}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                CRM role controls member/enrollment/agent access
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUserRole} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite User Modal */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to join your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email Address</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Initial Role</Label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                {SYSTEM_ROLES.filter(r => r !== 'super_admin').map((role) => (
                  <option key={role} value={role}>
                    {role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteUser} disabled={isSaving || !inviteEmail}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
