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
  Switch,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Checkbox,
} from '@crm-eco/ui';
import {
  RefreshCw,
  Plus,
  Search,
  Edit2,
  Trash2,
  ChevronLeft,
  Users,
  MapPin,
  BarChart3,
  Target,
  Loader2,
  Check,
  X,
  ArrowRight,
  GripVertical,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AssignmentPreview } from '@/components/agents';

interface AssignmentRule {
  id: string;
  org_id: string;
  module_id: string | null;
  name: string;
  is_enabled: boolean;
  strategy: 'round_robin' | 'territory' | 'least_loaded' | 'fixed';
  config: {
    users?: string[];
    cursor?: number;
    territories?: Record<string, string[]>;
    territory_field?: string;
    fixed_owner?: string;
  };
  conditions: Array<{
    field: string;
    operator: string;
    value: string;
  }>;
  priority: number;
  created_at: string;
  updated_at: string;
}

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  profile_id?: string;
}

const STRATEGIES = [
  { value: 'round_robin', label: 'Round Robin', icon: RefreshCw, description: 'Rotate assignments among selected agents in order' },
  { value: 'least_loaded', label: 'Least Loaded', icon: BarChart3, description: 'Assign to agent with fewest active records' },
  { value: 'territory', label: 'Territory', icon: MapPin, description: 'Assign based on geographic or custom territories' },
  { value: 'fixed', label: 'Fixed Owner', icon: Target, description: 'Always assign to a specific agent' },
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
];

const APPLY_TO_OPTIONS = [
  { value: 'leads', label: 'New Leads' },
  { value: 'members', label: 'New Members' },
  { value: 'enrollments', label: 'New Enrollments' },
];

export default function AgentAssignmentPage() {
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRule, setSelectedRule] = useState<AssignmentRule | null>(null);
  const [previewRule, setPreviewRule] = useState<AssignmentRule | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    strategy: 'round_robin' as 'round_robin' | 'territory' | 'least_loaded' | 'fixed',
    is_enabled: true,
    selected_agents: [] as string[],
    conditions: [] as Array<{ field: string; operator: string; value: string }>,
    territory_field: '',
    territories: {} as Record<string, string[]>,
    fixed_owner: '',
    apply_to: 'leads',
    priority: 100,
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
        .select('id, first_name, last_name, email, status, profile_id')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'active')
        .order('first_name') as { data: Agent[] | null };

      if (agentsData) {
        setAgents(agentsData);
      }

      // Load assignment rules
      try {
        const { data: rulesData } = await supabase
          .from('crm_assignment_rules')
          .select('*')
          .eq('org_id', profile.organization_id)
          .order('priority', { ascending: true }) as { data: AssignmentRule[] | null };

        if (rulesData) {
          setRules(rulesData);
        }
      } catch (err) {
        // Table may not exist
        console.log('crm_assignment_rules table not available:', err);
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

  const handleNewRule = () => {
    setSelectedRule(null);
    setFormData({
      name: '',
      strategy: 'round_robin',
      is_enabled: true,
      selected_agents: [],
      conditions: [],
      territory_field: '',
      territories: {},
      fixed_owner: '',
      apply_to: 'leads',
      priority: 100,
    });
    setIsEditModalOpen(true);
  };

  const handleEditRule = (rule: AssignmentRule) => {
    setSelectedRule(rule);
    setFormData({
      name: rule.name,
      strategy: rule.strategy,
      is_enabled: rule.is_enabled,
      selected_agents: rule.config.users || [],
      conditions: rule.conditions || [],
      territory_field: rule.config.territory_field || '',
      territories: rule.config.territories || {},
      fixed_owner: rule.config.fixed_owner || '',
      apply_to: 'leads', // Would need to derive from module_id
      priority: rule.priority,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (!organizationId) return;
    setIsSaving(true);

    try {
      const config: AssignmentRule['config'] = {};

      if (formData.strategy === 'round_robin' || formData.strategy === 'least_loaded') {
        config.users = formData.selected_agents;
        config.cursor = 0;
      } else if (formData.strategy === 'territory') {
        config.territories = formData.territories;
        config.territory_field = formData.territory_field;
      } else if (formData.strategy === 'fixed') {
        config.fixed_owner = formData.fixed_owner;
      }

      const ruleData = {
        org_id: organizationId,
        name: formData.name,
        is_enabled: formData.is_enabled,
        strategy: formData.strategy,
        config,
        conditions: formData.conditions,
        priority: formData.priority,
      };

      if (selectedRule) {
        const { error } = await supabase
          .from('crm_assignment_rules')
          .update(ruleData)
          .eq('id', selectedRule.id);

        if (error) throw error;
        toast.success('Assignment rule updated successfully');
      } else {
        const { error } = await supabase
          .from('crm_assignment_rules')
          .insert(ruleData);

        if (error) throw error;
        toast.success('Assignment rule created successfully');
      }

      setIsEditModalOpen(false);
      loadData();
    } catch (error: unknown) {
      console.error('Error saving rule:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to save rule: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (rule: AssignmentRule) => {
    try {
      const { error } = await supabase
        .from('crm_assignment_rules')
        .update({ is_enabled: !rule.is_enabled })
        .eq('id', rule.id);

      if (error) throw error;
      toast.success(rule.is_enabled ? 'Rule disabled' : 'Rule enabled');
      loadData();
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast.error('Failed to update rule');
    }
  };

  const handleDeleteRule = async () => {
    if (!selectedRule) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('crm_assignment_rules')
        .delete()
        .eq('id', selectedRule.id);

      if (error) throw error;
      toast.success('Assignment rule deleted');
      setIsDeleteModalOpen(false);
      setSelectedRule(null);
      loadData();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete rule');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAgentSelection = (agentId: string) => {
    setFormData((prev) => ({
      ...prev,
      selected_agents: prev.selected_agents.includes(agentId)
        ? prev.selected_agents.filter((id) => id !== agentId)
        : [...prev.selected_agents, agentId],
    }));
  };

  const addCondition = () => {
    setFormData((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { field: '', operator: 'equals', value: '' }],
    }));
  };

  const removeCondition = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const filteredRules = rules.filter((rule) =>
    rule.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStrategyIcon = (strategy: string) => {
    const strategyDef = STRATEGIES.find((s) => s.value === strategy);
    if (!strategyDef) return RefreshCw;
    return strategyDef.icon;
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
          <h1 className="text-2xl font-bold text-slate-900">Agent Assignment Rules</h1>
          <p className="text-slate-500">Configure how leads and enrollments are automatically assigned to agents</p>
        </div>
        <Button onClick={handleNewRule}>
          <Plus className="h-4 w-4 mr-2" />
          New Rule
        </Button>
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">How Assignment Rules Work</p>
              <p className="text-sm text-blue-700">
                Rules are evaluated in priority order (lowest number first). When a new lead or enrollment is created,
                the first matching rule determines which agent is assigned. Round robin rotates through the agent list
                in order.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rules.length}</p>
                <p className="text-sm text-muted-foreground">Total Rules</p>
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
                <p className="text-2xl font-bold">{rules.filter((r) => r.is_enabled).length}</p>
                <p className="text-sm text-muted-foreground">Active Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{agents.length}</p>
                <p className="text-sm text-muted-foreground">Active Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rules.filter((r) => r.strategy === 'round_robin').length}</p>
                <p className="text-sm text-muted-foreground">Round Robin</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Assignment Rules</CardTitle>
              <CardDescription>Rules are evaluated in priority order</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search rules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRules.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No assignment rules yet</p>
              <p className="text-sm mb-4">Create your first rule to automatically assign leads to agents</p>
              <Button onClick={handleNewRule}>
                <Plus className="h-4 w-4 mr-2" />
                Create Rule
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRules.map((rule, index) => {
                const Icon = getStrategyIcon(rule.strategy);
                const agentCount = rule.config.users?.length || 0;
                return (
                  <div
                    key={rule.id}
                    className="border rounded-lg p-4 hover:border-teal-500/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-slate-400">
                        <GripVertical className="h-5 w-5" />
                        <span className="text-sm font-medium w-8">#{index + 1}</span>
                      </div>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        rule.is_enabled ? 'bg-teal-50' : 'bg-slate-100'
                      }`}>
                        <Icon className={`h-5 w-5 ${rule.is_enabled ? 'text-teal-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-slate-900">{rule.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {rule.strategy.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                          {agentCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {agentCount} agent{agentCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {rule.conditions.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Target className="h-3.5 w-3.5" />
                              {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          <span className="text-xs">Priority: {rule.priority}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.is_enabled}
                          onCheckedChange={() => handleToggleEnabled(rule)}
                        />
                        {(rule.strategy === 'round_robin' || rule.strategy === 'least_loaded' || rule.strategy === 'fixed') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewRule(previewRule?.id === rule.id ? null : rule)}
                            className={previewRule?.id === rule.id ? 'bg-teal-100' : ''}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleEditRule(rule)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRule(rule);
                            setIsDeleteModalOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment Preview */}
      {previewRule && organizationId && (
        <AssignmentPreview
          rule={previewRule}
          agents={agents}
          organizationId={organizationId}
        />
      )}

      {/* Active Agents Card */}
      <Card>
        <CardHeader>
          <CardTitle>Available Agents</CardTitle>
          <CardDescription>Active agents that can be assigned to rules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-teal-700">
                    {agent.first_name?.[0]}{agent.last_name?.[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {agent.first_name} {agent.last_name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{agent.email}</p>
                </div>
                <Badge variant="default" className="bg-green-100 text-green-700">
                  Active
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit/Create Rule Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRule ? 'Edit Assignment Rule' : 'New Assignment Rule'}
            </DialogTitle>
            <DialogDescription>
              Configure how leads and enrollments are automatically assigned to agents
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., West Coast Leads Round Robin"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
                    min={1}
                    max={1000}
                  />
                  <p className="text-xs text-muted-foreground">Lower numbers = higher priority</p>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={formData.is_enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_enabled: checked })}
                  />
                  <Label>Rule is active</Label>
                </div>
              </div>
            </div>

            {/* Strategy Selection */}
            <div className="space-y-3">
              <Label>Assignment Strategy</Label>
              <div className="grid grid-cols-2 gap-3">
                {STRATEGIES.map((strategy) => {
                  const Icon = strategy.icon;
                  return (
                    <div
                      key={strategy.value}
                      onClick={() => setFormData({ ...formData, strategy: strategy.value as 'round_robin' | 'territory' | 'least_loaded' | 'fixed' })}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        formData.strategy === strategy.value
                          ? 'border-teal-500 bg-teal-50'
                          : 'hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5" />
                        <div>
                          <p className="font-medium">{strategy.label}</p>
                          <p className="text-xs text-slate-500">{strategy.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Agent Selection for Round Robin / Least Loaded */}
            {(formData.strategy === 'round_robin' || formData.strategy === 'least_loaded') && (
              <div className="space-y-3">
                <Label>Select Agents</Label>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {agents.map((agent) => (
                    <label
                      key={agent.id}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b last:border-b-0"
                    >
                      <Checkbox
                        checked={formData.selected_agents.includes(agent.id)}
                        onCheckedChange={() => toggleAgentSelection(agent.id)}
                      />
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-teal-700">
                          {agent.first_name?.[0]}{agent.last_name?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{agent.first_name} {agent.last_name}</p>
                        <p className="text-xs text-slate-500">{agent.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {formData.selected_agents.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {formData.selected_agents.length} agent{formData.selected_agents.length !== 1 ? 's' : ''} selected
                    {formData.strategy === 'round_robin' && (
                      <span className="ml-2">
                        <ArrowRight className="inline h-3 w-3" /> Will rotate in selection order
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Fixed Owner Selection */}
            {formData.strategy === 'fixed' && (
              <div className="space-y-2">
                <Label>Assign To</Label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.fixed_owner}
                  onChange={(e) => setFormData({ ...formData, fixed_owner: e.target.value })}
                >
                  <option value="">Select an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.first_name} {agent.last_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Territory Configuration */}
            {formData.strategy === 'territory' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Territory Field</Label>
                  <Input
                    value={formData.territory_field}
                    onChange={(e) => setFormData({ ...formData, territory_field: e.target.value })}
                    placeholder="e.g., state, region, zip_code"
                  />
                  <p className="text-xs text-muted-foreground">
                    The field used to determine territory (e.g., state for geographic territories)
                  </p>
                </div>
                <p className="text-sm text-slate-500">
                  Territory mappings can be configured after saving the rule.
                </p>
              </div>
            )}

            {/* Conditions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Conditions (optional)</Label>
                <Button variant="outline" size="sm" onClick={addCondition}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Only assign using this rule when these conditions are met
              </p>
              {formData.conditions.map((condition, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Field name"
                    value={condition.field}
                    onChange={(e) => {
                      const newConditions = [...formData.conditions];
                      newConditions[index] = { ...condition, field: e.target.value };
                      setFormData({ ...formData, conditions: newConditions });
                    }}
                    className="flex-1"
                  />
                  <select
                    className="border rounded px-2 py-2"
                    value={condition.operator}
                    onChange={(e) => {
                      const newConditions = [...formData.conditions];
                      newConditions[index] = { ...condition, operator: e.target.value };
                      setFormData({ ...formData, conditions: newConditions });
                    }}
                  >
                    {OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="Value"
                    value={condition.value}
                    onChange={(e) => {
                      const newConditions = [...formData.conditions];
                      newConditions[index] = { ...condition, value: e.target.value };
                      setFormData({ ...formData, conditions: newConditions });
                    }}
                    className="flex-1"
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeCondition(index)}>
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveRule}
              disabled={isSaving || !formData.name || (
                (formData.strategy === 'round_robin' || formData.strategy === 'least_loaded') && formData.selected_agents.length === 0
              ) || (
                formData.strategy === 'fixed' && !formData.fixed_owner
              )}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Assignment Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedRule?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRule} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
