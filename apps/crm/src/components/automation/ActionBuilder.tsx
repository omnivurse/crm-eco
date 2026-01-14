'use client';

import { useState } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Label } from '@crm-eco/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Plus,
  Trash2,
  GripVertical,
  Edit3,
  UserCheck,
  ListTodo,
  MessageSquare,
  Bell,
  ArrowRight,
  Timer,
  StopCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Clock,
  Globe,
  Activity,
} from 'lucide-react';
import type { WorkflowAction, ActionType } from '@/lib/automation/types';

interface ActionBuilderProps {
  actions: WorkflowAction[];
  onChange: (actions: WorkflowAction[]) => void;
  readOnly?: boolean;
}

const ACTION_TYPES: { type: ActionType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'update_fields', label: 'Update Fields', icon: <Edit3 className="w-4 h-4" />, color: 'blue' },
  { type: 'assign_owner', label: 'Assign Owner', icon: <UserCheck className="w-4 h-4" />, color: 'green' },
  { type: 'create_task', label: 'Create Task', icon: <ListTodo className="w-4 h-4" />, color: 'amber' },
  { type: 'create_activity', label: 'Create Activity', icon: <Activity className="w-4 h-4" />, color: 'cyan' },
  { type: 'add_note', label: 'Add Note', icon: <MessageSquare className="w-4 h-4" />, color: 'purple' },
  { type: 'notify', label: 'Send Notification', icon: <Bell className="w-4 h-4" />, color: 'rose' },
  { type: 'move_stage', label: 'Move Stage', icon: <ArrowRight className="w-4 h-4" />, color: 'teal' },
  { type: 'delay_wait', label: 'Wait / Delay', icon: <Clock className="w-4 h-4" />, color: 'orange' },
  { type: 'post_webhook', label: 'Webhook (Outbound)', icon: <Globe className="w-4 h-4" />, color: 'sky' },
  { type: 'start_cadence', label: 'Start Cadence', icon: <Timer className="w-4 h-4" />, color: 'violet' },
  { type: 'stop_cadence', label: 'Stop Cadence', icon: <StopCircle className="w-4 h-4" />, color: 'slate' },
  { type: 'create_enrollment_draft', label: 'Create Enrollment Draft', icon: <FileText className="w-4 h-4" />, color: 'emerald' },
];

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function ActionBuilder({
  actions,
  onChange,
  readOnly = false,
}: ActionBuilderProps) {
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());

  function addAction(type: ActionType) {
    const newAction: WorkflowAction = {
      id: generateId(),
      type,
      config: getDefaultConfig(type),
      order: actions.length,
    };
    onChange([...actions, newAction]);
    setExpandedActions(prev => new Set([...Array.from(prev), newAction.id]));
  }

  function removeAction(id: string) {
    onChange(actions.filter(a => a.id !== id).map((a, i) => ({ ...a, order: i })));
  }

  function updateAction(id: string, updates: Partial<WorkflowAction>) {
    onChange(actions.map(a => a.id === id ? { ...a, ...updates } : a));
  }

  function moveAction(index: number, direction: 'up' | 'down') {
    const newActions = [...actions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newActions.length) return;
    
    [newActions[index], newActions[targetIndex]] = [newActions[targetIndex], newActions[index]];
    onChange(newActions.map((a, i) => ({ ...a, order: i })));
  }

  function toggleExpanded(id: string) {
    setExpandedActions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function getDefaultConfig(type: ActionType): Record<string, unknown> {
    switch (type) {
      case 'update_fields':
        return { fields: {} };
      case 'assign_owner':
        return { strategy: 'round_robin' };
      case 'create_task':
        return { title: '', dueInDays: 1, priority: 'normal', assignedTo: 'owner' };
      case 'create_activity':
        return { activityType: 'call', subject: '', notes: '', dueInDays: 0, assignedTo: 'owner' };
      case 'add_note':
        return { body: '' };
      case 'notify':
        return { recipients: ['owner'], title: '', body: '' };
      case 'move_stage':
        return { stage: '' };
      case 'delay_wait':
        return { delaySeconds: 3600, delayType: 'fixed' };
      case 'post_webhook':
        return { url: '', method: 'POST', headers: {}, bodyTemplate: '' };
      case 'start_cadence':
        return { cadenceId: '' };
      case 'stop_cadence':
        return {};
      case 'create_enrollment_draft':
        return { explicit: true };
      default:
        return {};
    }
  }

  function getActionInfo(type: ActionType) {
    return ACTION_TYPES.find(a => a.type === type) || ACTION_TYPES[0];
  }

  function renderActionConfig(action: WorkflowAction) {
    const config = action.config as Record<string, unknown>;

    switch (action.type) {
      case 'create_task':
        return (
          <div className="space-y-3">
            <div>
              <Label>Task Title</Label>
              <Input
                value={(config.title as string) || ''}
                onChange={(e) => updateAction(action.id, { config: { ...config, title: e.target.value } as any })}
                placeholder="Follow up with lead"
                disabled={readOnly}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Due in (days)</Label>
                <Input
                  type="number"
                  value={(config.dueInDays as number) || 1}
                  onChange={(e) => updateAction(action.id, { config: { ...config, dueInDays: parseInt(e.target.value) } as any })}
                  min={0}
                  disabled={readOnly}
                />
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={(config.priority as string) || 'normal'}
                  onValueChange={(value) => updateAction(action.id, { config: { ...config, priority: value } as any })}
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Assign To</Label>
              <Select
                value={(config.assignedTo as string) || 'owner'}
                onValueChange={(value) => updateAction(action.id, { config: { ...config, assignedTo: value } as any })}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Record Owner</SelectItem>
                  <SelectItem value="creator">Record Creator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'add_note':
        return (
          <div>
            <Label>Note Content</Label>
            <Textarea
              value={(config.body as string) || ''}
              onChange={(e) => updateAction(action.id, { config: { ...config, body: e.target.value } as any })}
              placeholder="Note to add..."
              rows={3}
              disabled={readOnly}
            />
          </div>
        );

      case 'notify':
        return (
          <div className="space-y-3">
            <div>
              <Label>Notification Title</Label>
              <Input
                value={(config.title as string) || ''}
                onChange={(e) => updateAction(action.id, { config: { ...config, title: e.target.value } as any })}
                placeholder="New lead assigned"
                disabled={readOnly}
              />
            </div>
            <div>
              <Label>Body (optional)</Label>
              <Input
                value={(config.body as string) || ''}
                onChange={(e) => updateAction(action.id, { config: { ...config, body: e.target.value } as any })}
                placeholder="Additional message..."
                disabled={readOnly}
              />
            </div>
            <div>
              <Label>Recipients</Label>
              <Select
                value={((config.recipients as string[]) || ['owner'])[0]}
                onValueChange={(value) => updateAction(action.id, { config: { ...config, recipients: [value] } as any })}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Record Owner</SelectItem>
                  <SelectItem value="creator">Record Creator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'move_stage':
        return (
          <div>
            <Label>New Stage</Label>
            <Input
              value={(config.stage as string) || ''}
              onChange={(e) => updateAction(action.id, { config: { ...config, stage: e.target.value } })}
              placeholder="e.g., Qualified, Proposal, Closed"
              disabled={readOnly}
            />
          </div>
        );

      case 'assign_owner':
        return (
          <div>
            <Label>Assignment Strategy</Label>
            <Select
              value={(config.strategy as string) || 'round_robin'}
              onValueChange={(value) => updateAction(action.id, { config: { ...config, strategy: value } as any })}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="round_robin">Round Robin</SelectItem>
                <SelectItem value="territory">Territory Based</SelectItem>
                <SelectItem value="least_loaded">Least Loaded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case 'create_activity':
        return (
          <div className="space-y-3">
            <div>
              <Label>Activity Type</Label>
              <Select
                value={(config.activityType as string) || 'call'}
                onValueChange={(value) => updateAction(action.id, { config: { ...config, activityType: value } as any })}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Input
                value={(config.subject as string) || ''}
                onChange={(e) => updateAction(action.id, { config: { ...config, subject: e.target.value } as any })}
                placeholder="Activity subject"
                disabled={readOnly}
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={(config.notes as string) || ''}
                onChange={(e) => updateAction(action.id, { config: { ...config, notes: e.target.value } as any })}
                placeholder="Additional notes..."
                rows={2}
                disabled={readOnly}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Due in (days)</Label>
                <Input
                  type="number"
                  value={(config.dueInDays as number) || 0}
                  onChange={(e) => updateAction(action.id, { config: { ...config, dueInDays: parseInt(e.target.value) } as any })}
                  min={0}
                  disabled={readOnly}
                />
              </div>
              <div>
                <Label>Assign To</Label>
                <Select
                  value={(config.assignedTo as string) || 'owner'}
                  onValueChange={(value) => updateAction(action.id, { config: { ...config, assignedTo: value } as any })}
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Record Owner</SelectItem>
                    <SelectItem value="creator">Record Creator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 'delay_wait':
        return (
          <div className="space-y-3">
            <div>
              <Label>Delay Type</Label>
              <Select
                value={(config.delayType as string) || 'fixed'}
                onValueChange={(value) => updateAction(action.id, { config: { ...config, delayType: value } as any })}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Duration</SelectItem>
                  <SelectItem value="until_field">Until Date Field</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(config.delayType === 'fixed' || !config.delayType) && (
              <div>
                <Label>Delay Duration (seconds)</Label>
                <Input
                  type="number"
                  value={(config.delaySeconds as number) || 3600}
                  onChange={(e) => updateAction(action.id, { config: { ...config, delaySeconds: parseInt(e.target.value) } as any })}
                  min={60}
                  disabled={readOnly}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {Math.floor(((config.delaySeconds as number) || 3600) / 3600)}h {Math.floor((((config.delaySeconds as number) || 3600) % 3600) / 60)}m
                </p>
              </div>
            )}
            {config.delayType === 'until_field' && (
              <div>
                <Label>Date Field</Label>
                <Input
                  value={(config.delayField as string) || ''}
                  onChange={(e) => updateAction(action.id, { config: { ...config, delayField: e.target.value } as any })}
                  placeholder="e.g., due_date, follow_up_date"
                  disabled={readOnly}
                />
              </div>
            )}
          </div>
        );

      case 'post_webhook':
        return (
          <div className="space-y-3">
            <div>
              <Label>Webhook URL</Label>
              <Input
                value={(config.url as string) || ''}
                onChange={(e) => updateAction(action.id, { config: { ...config, url: e.target.value } as any })}
                placeholder="https://api.example.com/webhook"
                disabled={readOnly}
              />
            </div>
            <div>
              <Label>HTTP Method</Label>
              <Select
                value={(config.method as string) || 'POST'}
                onValueChange={(value) => updateAction(action.id, { config: { ...config, method: value } as any })}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Body Template (JSON)</Label>
              <Textarea
                value={(config.bodyTemplate as string) || ''}
                onChange={(e) => updateAction(action.id, { config: { ...config, bodyTemplate: e.target.value } as any })}
                placeholder='{"recordId": "{{record.id}}", "title": "{{record.title}}"}'
                rows={3}
                disabled={readOnly}
              />
              <p className="text-xs text-slate-500 mt-1">
                Use {'{{record.field_name}}'} to insert record data
              </p>
            </div>
          </div>
        );

      default:
        return (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure this action type in the full editor.
          </p>
        );
    }
  }

  const sortedActions = [...actions].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      {/* Actions List */}
      {sortedActions.map((action, index) => {
        const info = getActionInfo(action.type);
        const isExpanded = expandedActions.has(action.id);

        return (
          <Card key={action.id} className="overflow-hidden">
            <CardHeader
              className="py-3 px-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
              onClick={() => toggleExpanded(action.id)}
            >
              <div className="flex items-center gap-3">
                {!readOnly && (
                  <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                )}
                <div className={`p-1.5 rounded bg-${info.color}-500/10`}>
                  {info.icon}
                </div>
                <div className="flex-1">
                  <span className="font-medium text-slate-900 dark:text-white">
                    {info.label}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {!readOnly && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); moveAction(index, 'up'); }}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); moveAction(index, 'down'); }}
                        disabled={index === sortedActions.length - 1}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); removeAction(action.id); }}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="pt-0 pb-4 px-4 border-t border-slate-100 dark:border-slate-800">
                {renderActionConfig(action)}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Add Action */}
      {!readOnly && (
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 text-center">
            Add an action
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {ACTION_TYPES.slice(0, 9).map((actionType) => (
              <Button
                key={actionType.type}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addAction(actionType.type)}
                className="gap-2"
              >
                {actionType.icon}
                {actionType.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {actions.length === 0 && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-4">
          No actions defined. Add at least one action.
        </p>
      )}
    </div>
  );
}
