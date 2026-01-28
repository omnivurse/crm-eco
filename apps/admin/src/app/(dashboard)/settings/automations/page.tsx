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
} from '@crm-eco/ui';
import {
  Zap,
  Plus,
  Search,
  Edit2,
  Trash2,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Mail,
  MessageSquare,
  ListTodo,
  Webhook,
  Calendar,
  GitBranch,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: 'event' | 'schedule' | 'webhook';
  trigger_config: {
    event_type?: string;
    entity_type?: string;
    cron?: string;
    timezone?: string;
    path?: string;
  };
  conditions: {
    match: 'all' | 'any';
    rules: Array<{
      field: string;
      operator: string;
      value: string;
    }>;
  };
  actions: Array<{
    type: string;
    config: Record<string, unknown>;
  }>;
  is_active: boolean;
  run_count: number;
  last_run_at: string | null;
  last_run_status: string | null;
  error_count: number;
  created_at: string;
}

interface RuleRun {
  id: string;
  rule_id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  actions_executed: Array<{
    action_type: string;
    status: string;
    error?: string;
  }>;
  created_at: string;
}

const TRIGGER_TYPES = [
  { value: 'event', label: 'Event Trigger', icon: GitBranch, description: 'Trigger when a record changes' },
  { value: 'schedule', label: 'Schedule', icon: Calendar, description: 'Run on a schedule (cron)' },
  { value: 'webhook', label: 'Webhook', icon: Webhook, description: 'Trigger via external webhook' },
];

const EVENT_TYPES = [
  { value: 'lead.created', label: 'Lead Created' },
  { value: 'lead.updated', label: 'Lead Updated' },
  { value: 'lead.converted', label: 'Lead Converted' },
  { value: 'deal.created', label: 'Deal Created' },
  { value: 'deal.updated', label: 'Deal Updated' },
  { value: 'deal.stage_changed', label: 'Deal Stage Changed' },
  { value: 'deal.won', label: 'Deal Won' },
  { value: 'deal.lost', label: 'Deal Lost' },
  { value: 'contact.created', label: 'Contact Created' },
  { value: 'contact.updated', label: 'Contact Updated' },
  { value: 'task.created', label: 'Task Created' },
  { value: 'task.completed', label: 'Task Completed' },
  { value: 'task.overdue', label: 'Task Overdue' },
  { value: 'member.created', label: 'Member Created' },
  { value: 'member.updated', label: 'Member Updated' },
  { value: 'enrollment.created', label: 'Enrollment Created' },
  { value: 'enrollment.approved', label: 'Enrollment Approved' },
];

const ACTION_TYPES = [
  { value: 'send_email', label: 'Send Email', icon: Mail },
  { value: 'send_sms', label: 'Send SMS', icon: MessageSquare },
  { value: 'create_task', label: 'Create Task', icon: ListTodo },
  { value: 'update_record', label: 'Update Record', icon: Edit2 },
  { value: 'webhook_call', label: 'Call Webhook', icon: Webhook },
  { value: 'slack_message', label: 'Send Slack Message', icon: MessageSquare },
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
];

export default function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [recentRuns, setRecentRuns] = useState<RuleRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [editStep, setEditStep] = useState(1);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'event' as 'event' | 'schedule' | 'webhook',
    trigger_config: {} as Record<string, unknown>,
    conditions: { match: 'all' as 'all' | 'any', rules: [] as Array<{ field: string; operator: string; value: string }> },
    actions: [] as Array<{ type: string; config: Record<string, unknown> }>,
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

      // Load automation rules
      try {
        const { data: rulesData } = await supabase
          .from('automation_rules')
          .select('*')
          .eq('org_id', profile.organization_id)
          .order('created_at', { ascending: false }) as { data: AutomationRule[] | null };

        if (rulesData) {
          setRules(rulesData);
        }
      } catch (err) {
        // Table may not exist
        console.log('automation_rules table not available:', err);
      }

      // Load recent rule runs
      try {
        const { data: runsData } = await supabase
          .from('automation_rule_runs')
          .select('*')
          .eq('org_id', profile.organization_id)
          .order('created_at', { ascending: false })
          .limit(50) as { data: RuleRun[] | null };

        if (runsData) {
          setRecentRuns(runsData);
        }
      } catch (err) {
        console.log('automation_rule_runs table not available:', err);
      }
    } catch (error) {
      console.error('Error loading automation data:', error);
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
      description: '',
      trigger_type: 'event',
      trigger_config: {},
      conditions: { match: 'all', rules: [] },
      actions: [],
      is_active: true,
    });
    setEditStep(1);
    setIsEditModalOpen(true);
  };

  const handleEditRule = (rule: AutomationRule) => {
    setSelectedRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      trigger_type: rule.trigger_type,
      trigger_config: rule.trigger_config,
      conditions: rule.conditions,
      actions: rule.actions,
      is_active: rule.is_active,
    });
    setEditStep(1);
    setIsEditModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (!organizationId) return;
    setIsSaving(true);

    try {
      const ruleData = {
        org_id: organizationId,
        name: formData.name,
        description: formData.description || null,
        trigger_type: formData.trigger_type,
        trigger_config: formData.trigger_config,
        conditions: formData.conditions,
        actions: formData.actions,
        is_active: formData.is_active,
      };

      if (selectedRule) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('automation_rules')
          .update(ruleData)
          .eq('id', selectedRule.id);

        if (error) throw error;
        toast.success('Automation rule updated successfully');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('automation_rules')
          .insert(ruleData);

        if (error) throw error;
        toast.success('Automation rule created successfully');
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

  const handleToggleActive = async (rule: AutomationRule) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('automation_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;
      toast.success(rule.is_active ? 'Rule paused' : 'Rule activated');
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
        .from('automation_rules')
        .delete()
        .eq('id', selectedRule.id);

      if (error) throw error;
      toast.success('Automation rule deleted');
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

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: {
        ...formData.conditions,
        rules: [...formData.conditions.rules, { field: '', operator: 'equals', value: '' }],
      },
    });
  };

  const removeCondition = (index: number) => {
    const newRules = [...formData.conditions.rules];
    newRules.splice(index, 1);
    setFormData({
      ...formData,
      conditions: { ...formData.conditions, rules: newRules },
    });
  };

  const addAction = (type: string) => {
    setFormData({
      ...formData,
      actions: [...formData.actions, { type, config: {} }],
    });
  };

  const removeAction = (index: number) => {
    const newActions = [...formData.actions];
    newActions.splice(index, 1);
    setFormData({ ...formData, actions: newActions });
  };

  const filteredRules = rules.filter(rule =>
    rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (rule.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
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
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Automations</h1>
          <p className="text-slate-500">Create workflow automations triggered by events or schedules</p>
        </div>
        <Button onClick={handleNewRule}>
          <Plus className="h-4 w-4 mr-2" />
          New Automation
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Zap className="h-5 w-5 text-purple-600" />
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
                <Play className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rules.filter(r => r.is_active).length}</p>
                <p className="text-sm text-muted-foreground">Active Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rules.reduce((sum, r) => sum + r.run_count, 0)}</p>
                <p className="text-sm text-muted-foreground">Total Executions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rules.reduce((sum, r) => sum + r.error_count, 0)}</p>
                <p className="text-sm text-muted-foreground">Total Errors</p>
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
              <CardTitle>Automation Rules</CardTitle>
              <CardDescription>Manage your automation workflows</CardDescription>
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
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No automation rules yet</p>
              <p className="text-sm mb-4">Create your first automation to get started</p>
              <Button onClick={handleNewRule}>
                <Plus className="h-4 w-4 mr-2" />
                Create Rule
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRules.map((rule) => (
                <div
                  key={rule.id}
                  className="border rounded-lg p-4 hover:border-teal-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        rule.is_active ? 'bg-teal-50' : 'bg-slate-100'
                      }`}>
                        <Zap className={`h-5 w-5 ${rule.is_active ? 'text-teal-600' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900">{rule.name}</h3>
                        {rule.description && (
                          <p className="text-sm text-slate-500 mt-1">{rule.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {rule.trigger_type === 'event' && (rule.trigger_config.event_type || 'Event')}
                            {rule.trigger_type === 'schedule' && (rule.trigger_config.cron || 'Schedule')}
                            {rule.trigger_type === 'webhook' && 'Webhook'}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            {rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}
                          </span>
                          {rule.last_run_at && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              {getStatusIcon(rule.last_run_status)}
                              Last run {new Date(rule.last_run_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 mr-4">
                        <span className="text-xs text-slate-500">
                          {rule.run_count} runs
                        </span>
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={() => handleToggleActive(rule)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedRule(rule);
                          setIsHistoryModalOpen(true);
                        }}
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Executions */}
      {recentRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Executions</CardTitle>
            <CardDescription>Latest automation rule runs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Rule</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Duration</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentRuns.slice(0, 10).map((run) => {
                    const rule = rules.find(r => r.id === run.rule_id);
                    return (
                      <tr key={run.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">
                          {rule?.name || 'Unknown Rule'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(run.status)}
                            <span className="text-sm capitalize">{run.status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {run.duration_ms ? `${run.duration_ms}ms` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {new Date(run.created_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit/Create Rule Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRule ? 'Edit Automation' : 'New Automation'}
            </DialogTitle>
            <DialogDescription>
              Step {editStep} of 4: {
                editStep === 1 ? 'Basic Info' :
                editStep === 2 ? 'Trigger' :
                editStep === 3 ? 'Conditions' :
                'Actions'
              }
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-4">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`flex-1 h-1 rounded ${
                  step <= editStep ? 'bg-teal-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {/* Step 1: Basic Info */}
          {editStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Send welcome email on enrollment"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this automation does"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active (rule will run when triggered)</Label>
              </div>
            </div>
          )}

          {/* Step 2: Trigger */}
          {editStep === 2 && (
            <div className="space-y-4">
              <Label>Select Trigger Type</Label>
              <div className="grid grid-cols-1 gap-3">
                {TRIGGER_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <div
                      key={type.value}
                      onClick={() => setFormData({ ...formData, trigger_type: type.value as 'event' | 'schedule' | 'webhook' })}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        formData.trigger_type === type.value
                          ? 'border-teal-500 bg-teal-50'
                          : 'hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5" />
                        <div>
                          <p className="font-medium">{type.label}</p>
                          <p className="text-sm text-slate-500">{type.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {formData.trigger_type === 'event' && (
                <div className="space-y-2 mt-4">
                  <Label>Event Type</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={(formData.trigger_config as { event_type?: string }).event_type || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      trigger_config: { ...formData.trigger_config, event_type: e.target.value }
                    })}
                  >
                    <option value="">Select an event...</option>
                    {EVENT_TYPES.map((event) => (
                      <option key={event.value} value={event.value}>
                        {event.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.trigger_type === 'schedule' && (
                <div className="space-y-2 mt-4">
                  <Label>Cron Expression</Label>
                  <Input
                    value={(formData.trigger_config as { cron?: string }).cron || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      trigger_config: { ...formData.trigger_config, cron: e.target.value }
                    })}
                    placeholder="0 9 * * 1-5 (9am weekdays)"
                  />
                  <p className="text-xs text-slate-500">
                    Format: minute hour day month weekday
                  </p>
                </div>
              )}

              {formData.trigger_type === 'webhook' && (
                <div className="space-y-2 mt-4">
                  <Label>Webhook Path</Label>
                  <Input
                    value={(formData.trigger_config as { path?: string }).path || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      trigger_config: { ...formData.trigger_config, path: e.target.value }
                    })}
                    placeholder="/custom/my-webhook"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 3: Conditions */}
          {editStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Conditions (optional)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Match</span>
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={formData.conditions.match}
                    onChange={(e) => setFormData({
                      ...formData,
                      conditions: { ...formData.conditions, match: e.target.value as 'all' | 'any' }
                    })}
                  >
                    <option value="all">All conditions</option>
                    <option value="any">Any condition</option>
                  </select>
                </div>
              </div>

              {formData.conditions.rules.map((rule, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Field name"
                    value={rule.field}
                    onChange={(e) => {
                      const newRules = [...formData.conditions.rules];
                      newRules[index] = { ...rule, field: e.target.value };
                      setFormData({
                        ...formData,
                        conditions: { ...formData.conditions, rules: newRules }
                      });
                    }}
                    className="flex-1"
                  />
                  <select
                    className="border rounded px-2 py-2"
                    value={rule.operator}
                    onChange={(e) => {
                      const newRules = [...formData.conditions.rules];
                      newRules[index] = { ...rule, operator: e.target.value };
                      setFormData({
                        ...formData,
                        conditions: { ...formData.conditions, rules: newRules }
                      });
                    }}
                  >
                    {OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="Value"
                    value={rule.value}
                    onChange={(e) => {
                      const newRules = [...formData.conditions.rules];
                      newRules[index] = { ...rule, value: e.target.value };
                      setFormData({
                        ...formData,
                        conditions: { ...formData.conditions, rules: newRules }
                      });
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(index)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}

              <Button variant="outline" onClick={addCondition}>
                <Plus className="h-4 w-4 mr-2" />
                Add Condition
              </Button>
            </div>
          )}

          {/* Step 4: Actions */}
          {editStep === 4 && (
            <div className="space-y-4">
              <Label>Actions to Execute</Label>

              {formData.actions.map((action, index) => {
                const actionType = ACTION_TYPES.find(a => a.value === action.type);
                const Icon = actionType?.icon || Zap;
                return (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium">{actionType?.label || action.type}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeAction(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>

                    {action.type === 'send_email' && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Template ID or subject"
                          value={String(action.config.template || '')}
                          onChange={(e) => {
                            const newActions = [...formData.actions];
                            newActions[index] = { ...action, config: { ...action.config, template: e.target.value } };
                            setFormData({ ...formData, actions: newActions });
                          }}
                        />
                      </div>
                    )}

                    {action.type === 'create_task' && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Task title"
                          value={String(action.config.title || '')}
                          onChange={(e) => {
                            const newActions = [...formData.actions];
                            newActions[index] = { ...action, config: { ...action.config, title: e.target.value } };
                            setFormData({ ...formData, actions: newActions });
                          }}
                        />
                      </div>
                    )}

                    {action.type === 'webhook_call' && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Webhook URL"
                          value={String(action.config.url || '')}
                          onChange={(e) => {
                            const newActions = [...formData.actions];
                            newActions[index] = { ...action, config: { ...action.config, url: e.target.value } };
                            setFormData({ ...formData, actions: newActions });
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="grid grid-cols-3 gap-2">
                {ACTION_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <Button
                      key={type.value}
                      variant="outline"
                      size="sm"
                      onClick={() => addAction(type.value)}
                      className="justify-start"
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {type.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <div>
              {editStep > 1 && (
                <Button variant="outline" onClick={() => setEditStep(editStep - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              {editStep < 4 ? (
                <Button onClick={() => setEditStep(editStep + 1)} disabled={!formData.name && editStep === 1}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSaveRule} disabled={isSaving || formData.actions.length === 0}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Rule
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Automation Rule</DialogTitle>
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

      {/* Run History Modal */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Execution History: {selectedRule?.name}</DialogTitle>
            <DialogDescription>Recent runs of this automation rule</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {recentRuns.filter(r => r.rule_id === selectedRule?.id).length === 0 ? (
              <p className="text-center py-8 text-slate-500">No executions yet</p>
            ) : (
              <div className="space-y-2">
                {recentRuns
                  .filter(r => r.rule_id === selectedRule?.id)
                  .map((run) => (
                    <div key={run.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(run.status)}
                          <span className="font-medium capitalize">{run.status}</span>
                        </div>
                        <span className="text-sm text-slate-500">
                          {new Date(run.created_at).toLocaleString()}
                        </span>
                      </div>
                      {run.duration_ms && (
                        <p className="text-sm text-slate-500 mt-1">Duration: {run.duration_ms}ms</p>
                      )}
                      {run.error_message && (
                        <p className="text-sm text-red-500 mt-1">{run.error_message}</p>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsHistoryModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
