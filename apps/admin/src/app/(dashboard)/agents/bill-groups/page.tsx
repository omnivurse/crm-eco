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
  Checkbox,
} from '@crm-eco/ui';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  ChevronLeft,
  Loader2,
  Building2,
  DollarSign,
  BarChart3,
  MapPin,
  UserPlus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface BillGroup {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  group_type: string;
  config: Record<string, unknown>;
  is_active: boolean;
  manager_advisor_id: string | null;
  created_at: string;
  member_count?: number;
  manager?: { id: string; first_name: string; last_name: string } | null;
}

interface BillGroupMember {
  id: string;
  advisor_id: string;
  role: string;
  effective_date: string;
  end_date: string | null;
  advisor?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
}

const GROUP_TYPES = [
  { value: 'commission', label: 'Commission Group', icon: DollarSign, description: 'Group for commission calculations' },
  { value: 'billing', label: 'Billing Group', icon: Building2, description: 'Group for billing purposes' },
  { value: 'reporting', label: 'Reporting Group', icon: BarChart3, description: 'Group for reporting and analytics' },
  { value: 'territory', label: 'Territory', icon: MapPin, description: 'Geographic or sales territory' },
  { value: 'team', label: 'Team', icon: Users, description: 'General team grouping' },
];

export default function BillGroupsPage() {
  const [groups, setGroups] = useState<BillGroup[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<BillGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<BillGroupMember[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    group_type: 'commission',
    manager_advisor_id: '',
    is_active: true,
  });

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

      // Load agents
      const { data: agentsData } = await supabase
        .from('advisors')
        .select('id, first_name, last_name, email, status')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'active')
        .order('first_name') as { data: Agent[] | null };

      if (agentsData) {
        setAgents(agentsData);
      }

      // Load bill groups with member counts
      try {
        const { data: groupsData } = await (supabase as any)
          .from('agent_bill_groups')
          .select(`
            *,
            manager:advisors!agent_bill_groups_manager_advisor_id_fkey(id, first_name, last_name)
          `)
          .eq('organization_id', profile.organization_id)
          .order('name') as { data: BillGroup[] | null };

        if (groupsData) {
          // Get member counts
          const groupIds = groupsData.map(g => g.id);
          const { data: memberCounts } = await (supabase as any)
            .from('agent_bill_group_members')
            .select('bill_group_id')
            .in('bill_group_id', groupIds);

          const countMap: Record<string, number> = {};
          memberCounts?.forEach((m: { bill_group_id: string }) => {
            countMap[m.bill_group_id] = (countMap[m.bill_group_id] || 0) + 1;
          });

          setGroups(groupsData.map(g => ({
            ...g,
            member_count: countMap[g.id] || 0
          })));
        }
      } catch (err) {
        console.log('agent_bill_groups table not available:', err);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadGroupMembers = async (groupId: string) => {
    try {
      const { data } = await (supabase as any)
        .from('agent_bill_group_members')
        .select(`
          *,
          advisor:advisors(id, first_name, last_name, email)
        `)
        .eq('bill_group_id', groupId)
        .order('created_at') as { data: BillGroupMember[] | null };

      if (data) {
        setGroupMembers(data);
      }
    } catch (error) {
      console.error('Error loading group members:', error);
    }
  };

  const handleNewGroup = () => {
    setSelectedGroup(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      group_type: 'commission',
      manager_advisor_id: '',
      is_active: true,
    });
    setIsEditModalOpen(true);
  };

  const handleEditGroup = (group: BillGroup) => {
    setSelectedGroup(group);
    setFormData({
      name: group.name,
      code: group.code || '',
      description: group.description || '',
      group_type: group.group_type,
      manager_advisor_id: group.manager_advisor_id || '',
      is_active: group.is_active,
    });
    setIsEditModalOpen(true);
  };

  const handleManageMembers = async (group: BillGroup) => {
    setSelectedGroup(group);
    await loadGroupMembers(group.id);
    setIsMembersModalOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!organizationId) return;
    setIsSaving(true);

    try {
      const data = {
        organization_id: organizationId,
        name: formData.name,
        code: formData.code || null,
        description: formData.description || null,
        group_type: formData.group_type,
        manager_advisor_id: formData.manager_advisor_id || null,
        is_active: formData.is_active,
      };

      if (selectedGroup) {
        const { error } = await (supabase as any)
          .from('agent_bill_groups')
          .update(data)
          .eq('id', selectedGroup.id);
        if (error) throw error;
        toast.success('Group updated successfully');
      } else {
        const { error } = await (supabase as any)
          .from('agent_bill_groups')
          .insert(data);
        if (error) throw error;
        toast.success('Group created successfully');
      }

      setIsEditModalOpen(false);
      loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to save group: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    setIsSaving(true);

    try {
      const { error } = await (supabase as any)
        .from('agent_bill_groups')
        .delete()
        .eq('id', selectedGroup.id);
      if (error) throw error;
      toast.success('Group deleted');
      setIsDeleteModalOpen(false);
      setSelectedGroup(null);
      loadData();
    } catch (error) {
      toast.error('Failed to delete group');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async (agentId: string) => {
    if (!selectedGroup || !organizationId) return;

    try {
      const { error } = await (supabase as any)
        .from('agent_bill_group_members')
        .insert({
          organization_id: organizationId,
          bill_group_id: selectedGroup.id,
          advisor_id: agentId,
          role: 'member',
          effective_date: new Date().toISOString().split('T')[0],
        });

      if (error) throw error;
      toast.success('Member added to group');
      loadGroupMembers(selectedGroup.id);
      loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to add member: ${message}`);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedGroup) return;

    try {
      const { error } = await (supabase as any)
        .from('agent_bill_group_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      toast.success('Member removed from group');
      loadGroupMembers(selectedGroup.id);
      loadData();
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const handleUpdateMemberRole = async (memberId: string, role: string) => {
    try {
      const { error } = await (supabase as any)
        .from('agent_bill_group_members')
        .update({ role })
        .eq('id', memberId);

      if (error) throw error;
      toast.success('Member role updated');
      if (selectedGroup) {
        loadGroupMembers(selectedGroup.id);
      }
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (group.code?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const availableAgentsForGroup = agents.filter(
    agent => !groupMembers.some(m => m.advisor_id === agent.id)
  );

  const getGroupTypeIcon = (type: string) => {
    const typeDef = GROUP_TYPES.find(t => t.value === type);
    return typeDef?.icon || Users;
  };

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
        <Link href="/agents">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Bill Groups</h1>
          <p className="text-slate-500">Organize agents into groups for billing, commissions, and reporting</p>
        </div>
        <Button onClick={handleNewGroup}>
          <Plus className="h-4 w-4 mr-2" />
          New Group
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{groups.length}</p>
                <p className="text-sm text-muted-foreground">Total Groups</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{groups.filter(g => g.group_type === 'commission').length}</p>
                <p className="text-sm text-muted-foreground">Commission Groups</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{groups.filter(g => g.group_type === 'territory').length}</p>
                <p className="text-sm text-muted-foreground">Territories</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{groups.reduce((sum, g) => sum + (g.member_count || 0), 0)}</p>
                <p className="text-sm text-muted-foreground">Total Memberships</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Groups</CardTitle>
              <CardDescription>Manage agent bill groups and memberships</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No bill groups yet</p>
              <p className="text-sm mb-4">Create your first group to organize agents</p>
              <Button onClick={handleNewGroup}>
                <Plus className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGroups.map((group) => {
                const Icon = getGroupTypeIcon(group.group_type);
                return (
                  <Card key={group.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            group.is_active ? 'bg-teal-50' : 'bg-slate-100'
                          }`}>
                            <Icon className={`h-5 w-5 ${group.is_active ? 'text-teal-600' : 'text-slate-400'}`} />
                          </div>
                          <div>
                            <CardTitle className="text-base">{group.name}</CardTitle>
                            {group.code && (
                              <p className="text-xs text-slate-500 font-mono">{group.code}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant={group.is_active ? 'default' : 'secondary'}>
                          {group.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {group.description && (
                        <p className="text-sm text-slate-500 mb-3 line-clamp-2">{group.description}</p>
                      )}
                      <div className="flex items-center justify-between text-sm text-slate-500 mb-3">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {group.member_count || 0} member(s)
                        </span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {group.group_type}
                        </Badge>
                      </div>
                      {group.manager && (
                        <p className="text-xs text-slate-500 mb-3">
                          Manager: {group.manager.first_name} {group.manager.last_name}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleManageMembers(group)}>
                          <UserPlus className="h-4 w-4 mr-1" />
                          Members
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditGroup(group)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedGroup(group); setIsDeleteModalOpen(true); }}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Group Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedGroup ? 'Edit Group' : 'New Group'}</DialogTitle>
            <DialogDescription>Configure the bill group settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Group name"
                />
              </div>
              <div className="space-y-2">
                <Label>Code (optional)</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="GRP-001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Group Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {GROUP_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <div
                      key={type.value}
                      onClick={() => setFormData({ ...formData, group_type: type.value })}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        formData.group_type === type.value
                          ? 'border-teal-500 bg-teal-50'
                          : 'hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{type.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
              />
            </div>

            <div className="space-y-2">
              <Label>Group Manager (optional)</Label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={formData.manager_advisor_id}
                onChange={(e) => setFormData({ ...formData, manager_advisor_id: e.target.value })}
              >
                <option value="">No manager</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.first_name} {agent.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: !!checked })}
              />
              <Label>Group is active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveGroup} disabled={isSaving || !formData.name}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedGroup ? 'Update' : 'Create'} Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Members Modal */}
      <Dialog open={isMembersModalOpen} onOpenChange={setIsMembersModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Members: {selectedGroup?.name}</DialogTitle>
            <DialogDescription>Add or remove agents from this group</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add Member */}
            <div className="space-y-2">
              <Label>Add Member</Label>
              <div className="border rounded-lg max-h-40 overflow-y-auto">
                {availableAgentsForGroup.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500 text-center">All agents are already in this group</p>
                ) : (
                  availableAgentsForGroup.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between p-3 hover:bg-slate-50 border-b last:border-b-0"
                    >
                      <div>
                        <p className="font-medium text-sm">{agent.first_name} {agent.last_name}</p>
                        <p className="text-xs text-slate-500">{agent.email}</p>
                      </div>
                      <Button size="sm" onClick={() => handleAddMember(agent.id)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Current Members */}
            <div className="space-y-2">
              <Label>Current Members ({groupMembers.length})</Label>
              <div className="border rounded-lg">
                {groupMembers.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500 text-center">No members in this group</p>
                ) : (
                  groupMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 hover:bg-slate-50 border-b last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-teal-700">
                            {member.advisor?.first_name?.[0]}{member.advisor?.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {member.advisor?.first_name} {member.advisor?.last_name}
                          </p>
                          <p className="text-xs text-slate-500">{member.advisor?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="text-sm border rounded px-2 py-1"
                          value={member.role}
                          onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                        >
                          <option value="member">Member</option>
                          <option value="lead">Lead</option>
                          <option value="manager">Manager</option>
                        </select>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(member.id)}>
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsMembersModalOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedGroup?.name}&quot;? This will remove all member associations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteGroup} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
