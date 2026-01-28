'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '@crm-eco/ui';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  ArrowLeft,
  Calendar,
  Eye,
  UserPlus,
  UserMinus,
  Search,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface InvoiceGroup {
  id: string;
  name: string;
  description: string | null;
  group_type: string;
  billing_frequency: string;
  billing_day: number | null;
  invoice_prefix: string | null;
  default_due_days: number;
  auto_generate: boolean;
  auto_send: boolean;
  is_active: boolean;
  member_count: number;
  last_generated_at: string | null;
  created_at: string;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface GroupMember {
  id: string;
  member_id: string;
  member: Member;
  added_at: string;
}

const emptyGroup = {
  name: '',
  description: '',
  group_type: 'custom',
  billing_frequency: 'monthly',
  billing_day: 1,
  invoice_prefix: '',
  default_due_days: 30,
  auto_generate: false,
  auto_send: false,
};

export default function InvoiceGroupsPage() {
  const [groups, setGroups] = useState<InvoiceGroup[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<InvoiceGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Form
  const [formData, setFormData] = useState(emptyGroup);
  const [editingGroup, setEditingGroup] = useState<InvoiceGroup | null>(null);
  const [saving, setSaving] = useState(false);

  // Add member
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  const supabase = createClient();

  useEffect(() => {
    async function getOrgId() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setOrganizationId(profile.organization_id);
        setProfileId(profile.id);
      }
    }

    getOrgId();
  }, [supabase]);

  const fetchGroups = async () => {
    if (!organizationId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('invoice_groups')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');

      if (error && error.code !== '42P01') throw error;
      setGroups((data || []) as InvoiceGroup[]);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to load invoice groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMembers = async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, first_name, last_name, email')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .order('last_name');

      if (error) throw error;
      setAllMembers((data || []) as Member[]);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const fetchGroupMembers = async (groupId: string) => {
    setLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from('invoice_group_members')
        .select(
          `
          id,
          member_id,
          added_at,
          member:members(id, first_name, last_name, email)
        `
        )
        .eq('invoice_group_id', groupId)
        .order('added_at', { ascending: false });

      if (error && error.code !== '42P01') throw error;
      setGroupMembers((data || []) as unknown as GroupMember[]);
    } catch (error) {
      console.error('Error fetching group members:', error);
      toast.error('Failed to load group members');
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchGroups();
      fetchAllMembers();
    }
  }, [organizationId]);

  const openCreateModal = () => {
    setEditingGroup(null);
    setFormData(emptyGroup);
    setShowCreateModal(true);
  };

  const openEditModal = (group: InvoiceGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      group_type: group.group_type,
      billing_frequency: group.billing_frequency,
      billing_day: group.billing_day || 1,
      invoice_prefix: group.invoice_prefix || '',
      default_due_days: group.default_due_days,
      auto_generate: group.auto_generate,
      auto_send: group.auto_send,
    });
    setShowCreateModal(true);
  };

  const openMembersModal = (group: InvoiceGroup) => {
    setSelectedGroup(group);
    fetchGroupMembers(group.id);
    setShowMembersModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const saveData = {
        name: formData.name,
        description: formData.description || null,
        group_type: formData.group_type,
        billing_frequency: formData.billing_frequency,
        billing_day: formData.billing_day,
        invoice_prefix: formData.invoice_prefix || null,
        default_due_days: formData.default_due_days,
        auto_generate: formData.auto_generate,
        auto_send: formData.auto_send,
      };

      if (editingGroup) {
        const { error } = await supabase.from('invoice_groups').update(saveData).eq('id', editingGroup.id);

        if (error) throw error;
        toast.success('Invoice group updated');
      } else {
        const { error } = await supabase.from('invoice_groups').insert({
          ...saveData,
          organization_id: organizationId,
          created_by: profileId,
        });

        if (error) throw error;
        toast.success('Invoice group created');
      }

      setShowCreateModal(false);
      fetchGroups();
    } catch (error) {
      console.error('Error saving group:', error);
      toast.error('Failed to save invoice group');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (group: InvoiceGroup) => {
    if (!confirm(`Delete "${group.name}"? This will remove all member assignments.`)) return;

    try {
      const { error } = await supabase.from('invoice_groups').delete().eq('id', group.id);

      if (error) throw error;
      toast.success('Invoice group deleted');
      fetchGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete invoice group');
    }
  };

  const toggleActive = async (group: InvoiceGroup) => {
    try {
      const { error } = await supabase
        .from('invoice_groups')
        .update({ is_active: !group.is_active })
        .eq('id', group.id);

      if (error) throw error;
      toast.success(`Group ${group.is_active ? 'deactivated' : 'activated'}`);
      fetchGroups();
    } catch (error) {
      console.error('Error toggling group:', error);
      toast.error('Failed to update group');
    }
  };

  const addMemberToGroup = async (memberId: string) => {
    if (!selectedGroup) return;

    try {
      const { error } = await supabase.from('invoice_group_members').insert({
        invoice_group_id: selectedGroup.id,
        member_id: memberId,
        added_by: profileId,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('Member already in group');
          return;
        }
        throw error;
      }

      // Update member count
      await supabase
        .from('invoice_groups')
        .update({ member_count: (selectedGroup.member_count || 0) + 1 })
        .eq('id', selectedGroup.id);

      toast.success('Member added to group');
      fetchGroupMembers(selectedGroup.id);
      fetchGroups();
      setShowAddMemberModal(false);
      setMemberSearchQuery('');
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Failed to add member');
    }
  };

  const removeMemberFromGroup = async (membershipId: string) => {
    if (!selectedGroup) return;

    try {
      const { error } = await supabase.from('invoice_group_members').delete().eq('id', membershipId);

      if (error) throw error;

      // Update member count
      await supabase
        .from('invoice_groups')
        .update({ member_count: Math.max(0, (selectedGroup.member_count || 0) - 1) })
        .eq('id', selectedGroup.id);

      toast.success('Member removed from group');
      fetchGroupMembers(selectedGroup.id);
      fetchGroups();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };

  const filteredMembers = allMembers.filter((m) => {
    if (!memberSearchQuery) return true;
    const query = memberSearchQuery.toLowerCase();
    return (
      m.first_name.toLowerCase().includes(query) ||
      m.last_name.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query)
    );
  });

  const memberIdsInGroup = new Set(groupMembers.map((gm) => gm.member_id));
  const availableMembers = filteredMembers.filter((m) => !memberIdsInGroup.has(m.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Invoice Groups</h1>
            <p className="text-muted-foreground">Manage groups for batch invoice generation</p>
          </div>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          New Group
        </Button>
      </div>

      {/* Groups List */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse flex items-center gap-4">
                  <div className="h-12 w-12 bg-slate-100 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-slate-100 rounded" />
                    <div className="h-3 w-32 bg-slate-100 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-lg font-medium">No Invoice Groups</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create groups to generate invoices for multiple members at once
              </p>
              <Button onClick={openCreateModal}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Group
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => (
            <Card key={group.id} className={!group.is_active ? 'opacity-60' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-lg ${
                        group.is_active ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{group.name}</h3>
                        {!group.is_active && <Badge variant="secondary">Inactive</Badge>}
                        {group.auto_generate && (
                          <Badge className="bg-blue-100 text-blue-700">Auto-generate</Badge>
                        )}
                      </div>
                      {group.description && (
                        <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <Badge variant="outline">{group.group_type}</Badge>
                        <Badge variant="secondary">{group.billing_frequency}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {group.member_count} members
                        </span>
                      </div>
                      {group.last_generated_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          Last generated: {format(new Date(group.last_generated_at), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openMembersModal(group)}>
                      <Users className="h-4 w-4 mr-1" />
                      Members
                    </Button>
                    <Link href={`/invoices/generate/group?groupId=${group.id}`}>
                      <Button variant="outline" size="sm">
                        Generate
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => openEditModal(group)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleActive(group)}>
                      {group.is_active ? (
                        <XCircle className="h-4 w-4 text-amber-500" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500"
                      onClick={() => handleDelete(group)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Invoice Group' : 'Create Invoice Group'}</DialogTitle>
            <DialogDescription>Configure the invoice group settings</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="e.g., Monthly Members"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Group description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Group Type</Label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={formData.group_type}
                  onChange={(e) => setFormData({ ...formData, group_type: e.target.value })}
                >
                  <option value="custom">Custom</option>
                  <option value="bill_group">Bill Group</option>
                  <option value="plan">Plan</option>
                  <option value="agent">Agent</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Billing Frequency</Label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={formData.billing_frequency}
                  onChange={(e) => setFormData({ ...formData, billing_frequency: e.target.value })}
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Billing Day</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.billing_day}
                  onChange={(e) => setFormData({ ...formData, billing_day: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Default Due Days</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.default_due_days}
                  onChange={(e) =>
                    setFormData({ ...formData, default_due_days: parseInt(e.target.value) || 30 })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Invoice Prefix</Label>
              <Input
                placeholder="e.g., INV-GRP"
                value={formData.invoice_prefix}
                onChange={(e) => setFormData({ ...formData, invoice_prefix: e.target.value })}
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoGenerate"
                  checked={formData.auto_generate}
                  onChange={(e) => setFormData({ ...formData, auto_generate: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="autoGenerate">Auto-generate invoices</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoSend"
                  checked={formData.auto_send}
                  onChange={(e) => setFormData({ ...formData, auto_send: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="autoSend">Auto-send invoices after generation</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingGroup ? (
                'Update Group'
              ) : (
                'Create Group'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Modal */}
      <Dialog open={showMembersModal} onOpenChange={setShowMembersModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedGroup?.name} - Members</DialogTitle>
            <DialogDescription>Manage members in this invoice group</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => setShowAddMemberModal(true)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Add Member
              </Button>
            </div>

            {loadingMembers ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : groupMembers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                <p className="text-muted-foreground">No members in this group</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {groupMembers.map((gm) => (
                  <div key={gm.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">
                        {gm.member?.first_name} {gm.member?.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">{gm.member?.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500"
                      onClick={() => removeMemberFromGroup(gm.id)}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMembersModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Modal */}
      <Dialog open={showAddMemberModal} onOpenChange={setShowAddMemberModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member to Group</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableMembers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {memberSearchQuery ? 'No members found' : 'All members are already in this group'}
                </p>
              ) : (
                availableMembers.slice(0, 20).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                    onClick={() => addMemberToGroup(member.id)}
                  >
                    <div>
                      <p className="font-medium">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                    <Plus className="h-4 w-4 text-teal-500" />
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMemberModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
