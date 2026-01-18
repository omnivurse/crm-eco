'use client';

import { cn } from '@crm-eco/ui/lib/utils';
import {
  Play,
  RefreshCw,
  GitBranch,
  Clock,
  Mail,
  MessageSquare,
  CheckSquare,
  User,
  Tag,
  Webhook,
  Settings,
  Trash2,
  Circle,
} from 'lucide-react';
import type { WorkflowNode as WorkflowNodeType, NodeType } from '@/lib/workflows/types';

interface WorkflowNodeProps {
  node: WorkflowNodeType;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onConnectionStart: () => void;
  onConnectionEnd: () => void;
  onDelete: () => void;
}

const NODE_ICONS: Record<string, React.ReactNode> = {
  trigger_record_created: <Play className="w-4 h-4" />,
  trigger_record_updated: <RefreshCw className="w-4 h-4" />,
  trigger_field_changed: <Settings className="w-4 h-4" />,
  trigger_stage_changed: <GitBranch className="w-4 h-4" />,
  trigger_scheduled: <Clock className="w-4 h-4" />,
  condition_if: <GitBranch className="w-4 h-4" />,
  condition_switch: <GitBranch className="w-4 h-4" />,
  condition_filter: <Settings className="w-4 h-4" />,
  action_update_field: <Settings className="w-4 h-4" />,
  action_send_email: <Mail className="w-4 h-4" />,
  action_send_sms: <MessageSquare className="w-4 h-4" />,
  action_create_task: <CheckSquare className="w-4 h-4" />,
  action_assign_owner: <User className="w-4 h-4" />,
  action_add_tag: <Tag className="w-4 h-4" />,
  action_remove_tag: <Tag className="w-4 h-4" />,
  action_webhook: <Webhook className="w-4 h-4" />,
  flow_wait: <Clock className="w-4 h-4" />,
  flow_split: <GitBranch className="w-4 h-4" />,
  flow_merge: <GitBranch className="w-4 h-4" />,
};

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  trigger: {
    bg: 'bg-green-50 dark:bg-green-500/10',
    border: 'border-green-200 dark:border-green-500/30',
    text: 'text-green-600 dark:text-green-400',
  },
  condition: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
  },
  action: {
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-blue-200 dark:border-blue-500/30',
    text: 'text-blue-600 dark:text-blue-400',
  },
  flow: {
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    border: 'border-purple-200 dark:border-purple-500/30',
    text: 'text-purple-600 dark:text-purple-400',
  },
};

function getNodeCategory(type: NodeType): 'trigger' | 'condition' | 'action' | 'flow' {
  if (type.startsWith('trigger_')) return 'trigger';
  if (type.startsWith('condition_')) return 'condition';
  if (type.startsWith('action_')) return 'action';
  return 'flow';
}

export function WorkflowNode({
  node,
  isSelected,
  onSelect,
  onDragStart,
  onConnectionStart,
  onConnectionEnd,
  onDelete,
}: WorkflowNodeProps) {
  const category = getNodeCategory(node.type);
  const colors = NODE_COLORS[category];
  const icon = NODE_ICONS[node.type] || <Circle className="w-4 h-4" />;

  return (
    <div
      className={cn(
        'absolute w-[280px] rounded-xl border-2 shadow-sm cursor-move transition-all',
        colors.bg,
        isSelected ? 'border-violet-500 shadow-lg' : colors.border,
        'hover:shadow-md'
      )}
      style={{
        left: node.position.x,
        top: node.position.y,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect();
        onDragStart(e);
      }}
    >
      {/* Header */}
      <div className={cn('flex items-center gap-2 p-3 border-b', colors.border)}>
        <div className={cn('p-1.5 rounded-lg', colors.bg, colors.text)}>
          {icon}
        </div>
        <span className="font-medium text-sm text-slate-900 dark:text-white flex-1 truncate">
          {node.label}
        </span>
        {isSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {getNodeDescription(node)}
        </p>
      </div>

      {/* Input Handle (left) */}
      {category !== 'trigger' && (
        <div
          className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/20 cursor-pointer transition-colors"
          onMouseUp={(e) => {
            e.stopPropagation();
            onConnectionEnd();
          }}
        />
      )}

      {/* Output Handle (right) */}
      <div
        className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/20 cursor-pointer transition-colors"
        onMouseDown={(e) => {
          e.stopPropagation();
          onConnectionStart();
        }}
      />
    </div>
  );
}

function getNodeDescription(node: WorkflowNodeType): string {
  const config = (node.config || {}) as Record<string, string | undefined>;

  switch (node.type) {
    case 'trigger_record_created':
      return config.module ? `When a ${config.module} is created` : 'When a record is created';
    case 'trigger_record_updated':
      return config.module ? `When a ${config.module} is updated` : 'When a record is updated';
    case 'trigger_field_changed':
      return config.field ? `When ${config.field} changes` : 'When a field changes';
    case 'trigger_stage_changed':
      return config.stage ? `When moved to ${config.stage}` : 'When deal stage changes';
    case 'trigger_scheduled':
      return config.schedule || 'Runs on schedule';
    case 'condition_if':
      return config.condition || 'If condition is met';
    case 'condition_switch':
      return 'Switch based on value';
    case 'condition_filter':
      return config.filter || 'Filter records';
    case 'action_update_field':
      return config.field ? `Update ${config.field}` : 'Update a field';
    case 'action_send_email':
      return config.template || 'Send an email';
    case 'action_send_sms':
      return 'Send SMS message';
    case 'action_create_task':
      return config.taskType || 'Create a task';
    case 'action_assign_owner':
      return config.owner || 'Assign owner';
    case 'action_add_tag':
      return config.tag ? `Add tag: ${config.tag}` : 'Add a tag';
    case 'action_remove_tag':
      return config.tag ? `Remove tag: ${config.tag}` : 'Remove a tag';
    case 'action_webhook':
      return config.url || 'Call webhook';
    case 'flow_wait':
      return config.duration || 'Wait for a period';
    case 'flow_split':
      return 'Split into parallel paths';
    case 'flow_merge':
      return 'Merge parallel paths';
    default:
      return 'Configure this node';
  }
}
