'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Users,
  Key,
  Globe,
  Lock,
  Plus,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  History,
  Settings2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import { Switch } from '@crm-eco/ui/components/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permission_count: number;
  organization_id: string | null;
}

interface Permission {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  module: string | null;
}

interface TrustedDomain {
  id: string;
  domain: string;
  is_verified: boolean;
  auto_approve: boolean;
  created_at: string;
}

interface SSOConfig {
  id: string;
  provider: string;
  display_name: string | null;
  is_enabled: boolean;
  enforce_sso: boolean;
  allowed_domains: string[];
}

interface LoginEntry {
  id: string;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  device_info: Record<string, string> | null;
  created_at: string;
  profiles?: { full_name: string; email: string } | null;
}

type Tab = 'roles' | 'domains' | 'sso' | 'logins';

// ─── Component ────────────────────────────────────────────────────────────────
export default function SecurityControlPage() {
  const [activeTab, setActiveTab] = useState<Tab>('roles');
  const [loading, setLoading] = useState(true);

  // Data
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [domains, setDomains] = useState<TrustedDomain[]>([]);
  const [ssoConfigs, setSSOConfigs] = useState<SSOConfig[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginEntry[]>([]);

  // Dialogs
  const [showAddRole, setShowAddRole] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; label: string } | null>(null);

  // Form state
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newDomainAutoApprove, setNewDomainAutoApprove] = useState(false);

  // Expanded role for permission editing
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [rolePermIds, setRolePermIds] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes, domainsRes, ssoRes, loginsRes] = await Promise.all([
        fetch('/api/crm/security/roles'),
        fetch('/api/crm/security/permissions'),
        fetch('/api/crm/security/trusted-domains'),
        fetch('/api/crm/security/sso-config'),
        fetch('/api/crm/security/login-history?limit=50'),
      ]);

      if (rolesRes.ok) setRoles((await rolesRes.json()).roles || []);
      if (permsRes.ok) setPermissions((await permsRes.json()).permissions || []);
      if (domainsRes.ok) setDomains((await domainsRes.json()).domains || []);
      if (ssoRes.ok) setSSOConfigs((await ssoRes.json()).configs || []);
      if (loginsRes.ok) setLoginHistory((await loginsRes.json()).entries || []);
    } catch (err) {
      console.error('[SecurityControl] Fetch error:', err);
      toast.error('Failed to load security data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Load permissions for a role ───────────────────────────────────────────
  async function loadRolePermissions(roleId: string) {
    // We already have roles with permission_count, but we need the actual mapping
    // For now we fetch all role_permissions from the role endpoint
    // The role already has permissions in its JSONB — but we want granular IDs
    setExpandedRole(roleId);
    // Placeholder: load from crm_role_permissions would need a dedicated endpoint
    // For now show all permissions and let admin toggle
    setRolePermIds(new Set());
  }

  // ── Create role ───────────────────────────────────────────────────────────
  async function handleCreateRole() {
    if (!newRoleKey || !newRoleName) { toast.error('Key and name required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/crm/security/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newRoleKey, name: newRoleName, description: newRoleDesc }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      toast.success(`Role "${newRoleName}" created`);
      setShowAddRole(false);
      setNewRoleKey(''); setNewRoleName(''); setNewRoleDesc('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSaving(false); }
  }

  // ── Add domain ────────────────────────────────────────────────────────────
  async function handleAddDomain() {
    if (!newDomain) { toast.error('Domain required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/crm/security/trusted-domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain, auto_approve: newDomainAutoApprove }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      toast.success(`Domain "${newDomain}" added`);
      setShowAddDomain(false);
      setNewDomain(''); setNewDomainAutoApprove(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSaving(false); }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const urlMap: Record<string, string> = {
        role: `/api/crm/security/roles?id=${deleteTarget.id}`,
        domain: `/api/crm/security/trusted-domains?id=${deleteTarget.id}`,
        sso: `/api/crm/security/sso-config?id=${deleteTarget.id}`,
      };
      const res = await fetch(urlMap[deleteTarget.type], { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success(`Deleted ${deleteTarget.label}`);
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error('Failed to delete');
    }
  }

  // ── Tab definitions ───────────────────────────────────────────────────────
  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'roles',   label: 'Roles & Permissions', icon: <Users className="w-4 h-4" />,  count: roles.length },
    { key: 'domains', label: 'Trusted Domains',     icon: <Globe className="w-4 h-4" />,  count: domains.length },
    { key: 'sso',     label: 'SSO Configuration',   icon: <Lock className="w-4 h-4" />,   count: ssoConfigs.length },
    { key: 'logins',  label: 'Login History',        icon: <History className="w-4 h-4" />, count: loginHistory.length },
  ];

  // Group permissions by category
  const permsByCategory = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Security Control Center</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Roles, permissions, SSO, and access control
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-px overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <Badge variant="secondary" className="text-xs ml-1">{t.count}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ROLES TAB                                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddRole(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Role
            </Button>
          </div>

          <div className="space-y-3">
            {roles.map((role) => (
              <div
                key={role.id}
                className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/20">
                      <Key className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">{role.name}</span>
                        <code className="text-xs text-slate-400">{role.key}</code>
                        {role.is_system && <Badge variant="secondary" className="text-xs">System</Badge>}
                      </div>
                      {role.description && (
                        <p className="text-sm text-slate-500 mt-0.5">{role.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{role.permission_count} permissions</Badge>
                    {!role.is_system && (
                      <Button
                        size="sm" variant="ghost"
                        className="text-red-500"
                        onClick={() => setDeleteTarget({ type: 'role', id: role.id, label: role.name })}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Permissions reference */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Available Permissions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(permsByCategory).map(([cat, perms]) => (
                <div
                  key={cat}
                  className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/10 p-4"
                >
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wide">
                    {cat}
                  </h4>
                  <div className="space-y-2">
                    {perms.map((p) => (
                      <div key={p.id} className="flex items-center justify-between">
                        <div>
                          <code className="text-xs text-teal-600 dark:text-teal-400">{p.key}</code>
                          <p className="text-xs text-slate-500">{p.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TRUSTED DOMAINS TAB                                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'domains' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddDomain(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Domain
            </Button>
          </div>

          {domains.length === 0 ? (
            <p className="text-slate-400 text-sm py-8 text-center">No trusted domains configured</p>
          ) : (
            <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
              {domains.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <span className="font-mono text-sm text-slate-900 dark:text-white">{d.domain}</span>
                    {d.is_verified && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Verified</Badge>}
                    {d.auto_approve && <Badge variant="outline" className="text-xs">Auto-approve</Badge>}
                  </div>
                  <Button
                    size="sm" variant="ghost" className="text-red-500"
                    onClick={() => setDeleteTarget({ type: 'domain', id: d.id, label: d.domain })}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SSO TAB                                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sso' && (
        <div className="space-y-4">
          {ssoConfigs.length === 0 ? (
            <div className="text-center py-12">
              <Lock className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-slate-500">No SSO providers configured</p>
              <p className="text-sm text-slate-400 mt-1">
                Configure SAML, OIDC, or social SSO from the API
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {ssoConfigs.map((c) => (
                <div
                  key={c.id}
                  className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/10 px-5 py-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Settings2 className="w-5 h-5 text-blue-500" />
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {c.display_name || c.provider.toUpperCase()}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={c.is_enabled ? 'default' : 'secondary'} className="text-xs">
                            {c.is_enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          {c.enforce_sso && (
                            <Badge variant="outline" className="text-xs text-amber-600">Enforced</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm" variant="ghost" className="text-red-500"
                      onClick={() => setDeleteTarget({ type: 'sso', id: c.id, label: c.provider })}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* LOGIN HISTORY TAB                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'logins' && (
        <div className="space-y-4">
          {loginHistory.length === 0 ? (
            <p className="text-slate-400 text-sm py-8 text-center">No login events recorded yet</p>
          ) : (
            <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5 text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Event</th>
                    <th className="px-4 py-3 font-medium">IP</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {loginHistory.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-2 text-slate-900 dark:text-white">
                        {e.profiles?.full_name || e.profiles?.email || '—'}
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            e.event_type.includes('success')
                              ? 'text-emerald-600 border-emerald-300'
                              : e.event_type.includes('failed')
                              ? 'text-red-600 border-red-300'
                              : 'text-slate-600'
                          }`}
                        >
                          {e.event_type.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">
                        {e.ip_address || '—'}
                      </td>
                      <td className="px-4 py-2 text-slate-500 text-xs">
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Add Role Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showAddRole} onOpenChange={setShowAddRole}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
            <DialogDescription>Define a new role for your organization</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Key</label>
              <Input
                value={newRoleKey}
                onChange={(e) => setNewRoleKey(e.target.value.toLowerCase().replace(/[^a-z_]/g, ''))}
                placeholder="e.g. team_lead"
                className="mt-1 font-mono"
              />
              <p className="text-xs text-slate-400 mt-1">Lowercase letters and underscores only</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
              <Input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g. Team Lead"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <Input
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                placeholder="What can this role do?"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRole(false)}>Cancel</Button>
            <Button onClick={handleCreateRole} disabled={saving}>
              {saving ? 'Creating...' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Domain Dialog ────────────────────────────────────────────── */}
      <Dialog open={showAddDomain} onOpenChange={setShowAddDomain}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Trusted Domain</DialogTitle>
            <DialogDescription>Allow signups and access from this email domain</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Domain</label>
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
                placeholder="e.g. doublehelixhub.com"
                className="mt-1 font-mono"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={newDomainAutoApprove} onCheckedChange={setNewDomainAutoApprove} />
              <label className="text-sm text-slate-600 dark:text-slate-400">
                Auto-approve new signups from this domain
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDomain(false)}>Cancel</Button>
            <Button onClick={handleAddDomain} disabled={saving}>
              {saving ? 'Adding...' : 'Add Domain'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ───────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Delete {deleteTarget?.type}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.label}</strong>?
              This action is logged and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
