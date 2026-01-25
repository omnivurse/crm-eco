import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Mail,
  Shield,
  Clock,
  CheckCircle,
  Download,
  ArrowUp,
  ArrowDown,
  UserCheck,
  UserX,
  Zap,
  RefreshCw,
  KeyRound,
  MailCheck,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../providers/AuthProvider';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'member' | 'advisor' | 'staff' | 'agent' | 'admin' | 'super_admin' | 'concierge';
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at?: string;
  is_active?: boolean;
}

interface UserStats {
  total: number;
  active: number;
  admins: number;
  agents: number;
  members: number;
}

export default function UsersAdmin() {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeEmail, setPurgeEmail] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    active: 0,
    admins: 0,
    agents: 0,
    members: 0,
  });

  const canManageRoles = profile?.role === 'admin' || profile?.role === 'super_admin';

  const [newUser, setNewUser] = useState({
    email: '',
    full_name: '',
    role: 'member' as User['role'],
    password: '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (usersData: User[]) => {
    setStats({
      total: usersData.length,
      active: usersData.filter(u => u.is_active !== false).length,
      admins: usersData.filter(u => u.role === 'admin' || u.role === 'super_admin').length,
      agents: usersData.filter(u => u.role === 'agent' || u.role === 'staff').length,
      members: usersData.filter(u => u.role === 'member' || u.role === 'advisor').length,
    });
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (searchTerm) {
      filtered = filtered.filter(
        user =>
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  };

  const handleCreateUser = async () => {
    try {
      // Validation
      if (!newUser.email || !newUser.email.includes('@')) {
        showToast('Please enter a valid email address.', 'error');
        return;
      }

      if (newUser.password && newUser.password.length < 6) {
        showToast('Password must be at least 6 characters long.', 'error');
        return;
      }

      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        showToast('Authentication error. Please log in again.', 'error');
        return;
      }

      console.log('Creating user with payload:', {
        email: newUser.email,
        full_name: newUser.full_name,
        role: newUser.role,
        hasPassword: !!newUser.password,
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(newUser),
        }
      );

      // Removed console.log

      const responseData = await response.text();
      // Removed console.log

      if (!response.ok) {
        let errorMessage = 'Failed to create user';
        try {
          const errorJson = JSON.parse(responseData);
          errorMessage = errorJson.error || errorJson.message || responseData;
        } catch {
          errorMessage = responseData || `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Parse success response
      let result;
      try {
        result = JSON.parse(responseData);
      } catch {
        result = { success: true };
      }

      // Removed console.log
      showToast(`User created successfully! ${result.invite_url ? 'Invite link generated.' : ''}`, 'success');

      setShowCreateModal(false);
      setNewUser({ email: '', full_name: '', role: 'member', password: '' });
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast(`Failed to create user: ${errorMessage}`, 'error');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: User['role']) => {
    if (!canManageRoles) {
      showToast('You do not have permission to change user roles', 'error');
      return;
    }

    const targetUser = users.find(u => u.id === userId);
    const oldRole = targetUser?.role;

    if (!targetUser) {
      showToast('User not found', 'error');
      return;
    }

    if (oldRole === newRole) {
      return;
    }

    setUsers(prevUsers =>
      prevUsers.map(u => u.id === userId ? { ...u, role: newRole } : u)
    );

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        setUsers(prevUsers =>
          prevUsers.map(u => u.id === userId ? { ...u, role: oldRole } : u)
        );
        throw error;
      }

      showToast(
        `Role updated successfully: ${targetUser.email} is now ${newRole.replace('_', ' ')}`,
        'success'
      );
      fetchUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast(`Failed to update role: ${errorMessage}`, 'error');
      setUsers(prevUsers =>
        prevUsers.map(u => u.id === userId ? { ...u, role: oldRole } : u)
      );
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    if (!canManageRoles && editingUser.role !== users.find(u => u.id === editingUser.id)?.role) {
      showToast('You do not have permission to change user roles', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editingUser.full_name,
          role: editingUser.role,
          email: editingUser.email
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      showToast('User updated successfully', 'success');
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast(`Failed to update user: ${errorMessage}`, 'error');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    const originalUsers = [...users];

    try {
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));

      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        setUsers(originalUsers);
        showToast('Authentication error. Please log in again.', 'error');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        setUsers(originalUsers);
        throw new Error(errorText || `HTTP ${response.status}: ${response.statusText}`);
      }

      showToast('User deleted successfully', 'success');
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast(`Failed to delete user: ${errorMessage}`, 'error');
      setUsers(originalUsers);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!editingUser) return;

    setIsSendingPasswordReset(true);
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        showToast('Authentication error. Please log in again.', 'error');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            user_id: editingUser.id,
            email: editingUser.email
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to send password reset: ${response.statusText}`);
      }

      if (data.message) {
        showToast(data.message, 'success');
      } else {
        showToast(
          `Password reset ${data.email_sent ? 'email sent' : 'completed'} successfully for ${editingUser.email}`,
          'success'
        );
      }
    } catch (error) {
      console.error('Error sending password reset:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast(`Failed to send password reset: ${errorMessage}`, 'error');
    } finally {
      setIsSendingPasswordReset(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!editingUser) return;

    setIsResendingConfirmation(true);
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        showToast('Authentication error. Please log in again.', 'error');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-resend-confirmation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            user_id: editingUser.id,
            email: editingUser.email
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to resend confirmation: ${response.statusText}`);
      }

      if (data.already_confirmed) {
        showToast('Email is already confirmed', 'error');
      } else if (data.message) {
        showToast(data.message, 'success');
      } else {
        showToast(
          `Email confirmation ${data.email_sent ? 'sent' : 'completed'} successfully for ${editingUser.email}`,
          'success'
        );
      }
    } catch (error) {
      console.error('Error resending confirmation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast(`Failed to resend confirmation: ${errorMessage}`, 'error');
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  const purgeDeletedUsers = async () => {
    if (!purgeEmail.trim()) {
      showToast('Please enter an email address', 'error');
      return;
    }

    setIsPurging(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-purge-deleted-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ email: purgeEmail.trim() }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to purge: ${response.statusText}`);
      }

      if (data.success) {
        showToast(data.message || 'Deleted users purged successfully', 'success');
        setPurgeEmail('');
        setShowPurgeModal(false);
      } else {
        showToast(data.message || 'No deleted users found', 'error');
      }
    } catch (error) {
      console.error('Error purging users:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast(`Failed to purge: ${errorMessage}`, 'error');
    } finally {
      setIsPurging(false);
    }
  };

  const exportUsers = () => {
    const csv = [
      ['Email', 'Name', 'Role', 'Created At'],
      ...filteredUsers.map(u => [
        u.email,
        u.full_name || '',
        u.role,
        format(new Date(u.created_at), 'yyyy-MM-dd HH:mm:ss'),
      ]),
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const roleColors: Record<string, string> = {
    super_admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    admin: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    agent: 'bg-primary-100 text-primary-900 dark:bg-primary-950 dark:text-primary-200',
    staff: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    concierge: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    advisor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    member: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-end mb-8"
        >
          <div>
            <h1 className="championship-title" data-text="User Management">
              User Management
            </h1>
            <p className="text-xl text-neutral-600 dark:text-neutral-400 mt-2">
              Manage user accounts, roles, and permissions
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowPurgeModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-medium transition-colors"
              title="Purge soft-deleted users to free up email addresses"
            >
              <RefreshCw size={20} />
              Purge Deleted
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="neon-button inline-flex items-center gap-2"
            >
              <Plus size={20} />
              Create User
            </button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                  <Users className="text-white floating" size={24} />
                </div>
                <div className="flex items-center gap-1 text-sm text-primary-800">
                  <ArrowUp size={16} />
                  <span>8%</span>
                </div>
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Total Users</div>
              <div className="text-3xl font-bold text-neutral-900 dark:text-white">{stats.total}</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <CheckCircle className="text-white floating" size={24} />
                </div>
                <div className="flex items-center gap-1 text-sm text-success-600">
                  <ArrowUp size={16} />
                  <span>12%</span>
                </div>
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Active</div>
              <div className="text-3xl font-bold text-neutral-900 dark:text-white">{stats.active}</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <Shield className="text-white floating" size={24} />
                </div>
                <div className="flex items-center gap-1 text-sm text-orange-600">
                  <ArrowUp size={16} />
                  <span>2</span>
                </div>
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Admins</div>
              <div className="text-3xl font-bold text-neutral-900 dark:text-white">{stats.admins}</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-900 to-cyan-600 flex items-center justify-center">
                  <Zap className="text-white floating" size={24} />
                </div>
                <div className="flex items-center gap-1 text-sm text-neutral-500">
                  <span>—</span>
                </div>
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Agents</div>
              <div className="text-3xl font-bold text-neutral-900 dark:text-white">{stats.agents}</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                  <UserCheck className="text-white floating" size={24} />
                </div>
                <div className="flex items-center gap-1 text-sm text-teal-600">
                  <ArrowUp size={16} />
                  <span>5%</span>
                </div>
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Members</div>
              <div className="text-3xl font-bold text-neutral-900 dark:text-white">{stats.members}</div>
            </div>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6 mb-8"
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 floating" size={20} />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-neutral-200/50 dark:border-neutral-700/50 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm text-neutral-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-600/50 transition-all"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-3 rounded-xl border-2 border-neutral-200/50 dark:border-neutral-700/50 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-600/50 transition-all cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="agent">Agent</option>
              <option value="staff">Staff</option>
              <option value="concierge">Concierge</option>
              <option value="advisor">Advisor</option>
              <option value="member">Member</option>
            </select>

            <button
              onClick={exportUsers}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-teal-600 text-white font-semibold hover:from-primary-700 hover:to-teal-700 transition-all hover:scale-105 hover:shadow-lg"
            >
              <Download size={20} />
              Export
            </button>
          </div>
        </motion.div>

        {/* Users Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-primary-500/10 to-teal-500/10 border-b border-neutral-200/50 dark:border-neutral-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-700/50">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <UserX className="mx-auto mb-3 text-neutral-400" size={48} />
                      <p className="text-lg font-semibold text-neutral-900 dark:text-white">No users found</p>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Try adjusting your search or filters</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, index) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-white/50 dark:hover:bg-neutral-800/50 transition-all group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
                            {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-900 dark:text-white group-hover:text-primary-800 dark:group-hover:text-primary-500 transition-colors">
                              {user.full_name || 'No name'}
                            </p>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateRole(user.id, e.target.value as User['role'])}
                          disabled={!canManageRoles}
                          className={`modern-badge px-4 py-2 text-xs font-semibold rounded-xl ${roleColors[user.role]} border-0 focus:ring-2 focus:ring-primary-500 ${canManageRoles ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-60'} transition-transform`}
                          title={!canManageRoles ? 'You do not have permission to change roles' : 'Change user role'}
                        >
                          <option value="super_admin">Super Admin</option>
                          <option value="admin">Admin</option>
                          <option value="agent">Agent</option>
                          <option value="staff">Staff</option>
                          <option value="concierge">Concierge</option>
                          <option value="advisor">Advisor</option>
                          <option value="member">Member</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                          <Clock size={16} className="text-primary-600" />
                          {format(new Date(user.created_at), 'MMM d, yyyy')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="modern-badge inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-success-700 dark:text-green-300 border border-success-500/30 glow-effect">
                          <CheckCircle size={14} />
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => window.location.href = `mailto:${user.email}`}
                            className="p-2.5 text-primary-800 dark:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950/20 rounded-xl transition-all hover:scale-110"
                            title="Send email"
                          >
                            <Mail size={18} />
                          </button>
                          <button
                            onClick={() => setEditingUser(user)}
                            className="p-2.5 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-xl transition-all hover:scale-110"
                            title="Edit user"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2.5 text-accent-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all hover:scale-110"
                            title="Delete user"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Create User Modal */}
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card max-w-md w-full p-8"
            >
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-700 to-teal-600 bg-clip-text text-transparent mb-6">Create New User</h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-200 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200/50 dark:border-neutral-700/50 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm text-neutral-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-600/50 transition-all"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-200 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200/50 dark:border-neutral-700/50 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm text-neutral-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-600/50 transition-all"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-200 mb-2">
                    Role
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as User['role'] })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200/50 dark:border-neutral-700/50 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-600/50 transition-all cursor-pointer"
                  >
                    <option value="member">Member</option>
                    <option value="advisor">Advisor</option>
                    <option value="staff">Staff</option>
                    <option value="agent">Agent</option>
                    <option value="concierge">Concierge</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-200 mb-2">
                    Temporary Password
                  </label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200/50 dark:border-neutral-700/50 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm text-neutral-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-600/50 transition-all"
                    placeholder="Min 6 characters"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl border-2 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all hover:scale-105"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateUser}
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-teal-600 text-white font-semibold hover:from-primary-700 hover:to-teal-700 transition-all hover:scale-105 hover:shadow-lg"
                >
                  Create User
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Edit User Modal */}
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setEditingUser(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card max-w-md w-full p-8"
            >
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-700 to-teal-600 bg-clip-text text-transparent mb-6">Edit User</h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-neutral-200 dark:text-white mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200/50 dark:border-neutral-700/50 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm text-neutral-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-600/50 transition-all"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-200 dark:text-white mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editingUser.full_name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200/50 dark:border-neutral-700/50 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm text-neutral-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-600/50 transition-all"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-200 dark:text-white mb-2">
                    Role
                  </label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as User['role'] })}
                    disabled={!canManageRoles}
                    className={`w-full px-4 py-3 rounded-xl border-2 border-neutral-200/50 dark:border-neutral-700/50 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-600/50 transition-all ${canManageRoles ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                  >
                    <option value="member">Member</option>
                    <option value="advisor">Advisor</option>
                    <option value="staff">Staff</option>
                    <option value="agent">Agent</option>
                    <option value="concierge">Concierge</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                  {!canManageRoles && (
                    <p className="text-xs text-neutral-400 dark:text-neutral-300 mt-1">
                      You do not have permission to change roles
                    </p>
                  )}
                </div>

                <div className="border-t border-neutral-200/50 dark:border-neutral-700/50 pt-5">
                  <label className="block text-sm font-semibold text-neutral-200 dark:text-white mb-3">
                    Account Actions
                  </label>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleSendPasswordReset}
                      disabled={isSendingPasswordReset}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      title="Send password reset link to user"
                    >
                      {isSendingPasswordReset ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <KeyRound size={18} />
                      )}
                      {isSendingPasswordReset ? 'Sending...' : 'Send Password Reset'}
                    </button>
                    <button
                      onClick={handleResendConfirmation}
                      disabled={isResendingConfirmation}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      title="Resend email confirmation link"
                    >
                      {isResendingConfirmation ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <MailCheck size={18} />
                      )}
                      {isResendingConfirmation ? 'Sending...' : 'Resend Email Confirmation'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-6 py-3 rounded-xl border-2 border-neutral-400 dark:border-neutral-500 text-neutral-800 dark:text-white font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all hover:scale-105"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateUser}
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-teal-600 text-white font-semibold hover:from-primary-700 hover:to-teal-700 transition-all hover:scale-105 hover:shadow-lg"
                >
                  Update User
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Purge Deleted Users Modal */}
        {showPurgeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => !isPurging && setShowPurgeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full p-8 border-2 border-neutral-200 dark:border-neutral-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <RefreshCw className="text-yellow-600 dark:text-yellow-400" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
                    Purge Deleted Users
                  </h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Free up email addresses
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                  When you delete a user, their email is reserved by Supabase Auth. Use this tool to permanently purge soft-deleted users and free up the email address for re-registration.
                </p>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Warning:</strong> This action is permanent and cannot be undone. Only use this if you need to re-register a deleted user with the same email.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Email Address to Purge
                  </label>
                  <input
                    type="email"
                    value={purgeEmail}
                    onChange={(e) => setPurgeEmail(e.target.value)}
                    placeholder="user@example.com"
                    disabled={isPurging}
                    className="w-full px-4 py-3 rounded-xl border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:border-yellow-500 focus:ring-4 focus:ring-yellow-500/20 transition-all disabled:opacity-50"
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                    Enter the email address of the deleted user you want to purge
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setPurgeEmail('');
                      setShowPurgeModal(false);
                    }}
                    disabled={isPurging}
                    className="flex-1 px-6 py-3 rounded-xl border-2 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all hover:scale-105 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={purgeDeletedUsers}
                    disabled={isPurging || !purgeEmail.trim()}
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-semibold hover:from-yellow-600 hover:to-orange-700 transition-all hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {isPurging ? (
                      <>
                        <RefreshCw className="animate-spin" size={20} />
                        Purging...
                      </>
                    ) : (
                      <>
                        <Trash2 size={20} />
                        Purge Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
