'use client';

import { useState } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Input } from '@crm-eco/ui/components/input';
import {
  Search,
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
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { NodeType } from '@/lib/workflows/types';

interface NodePaletteItem {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface NodeCategory {
  id: string;
  label: string;
  color: string;
  items: NodePaletteItem[];
}

const NODE_CATEGORIES: NodeCategory[] = [
  {
    id: 'triggers',
    label: 'Triggers',
    color: 'text-green-500',
    items: [
      {
        type: 'trigger_record_created',
        label: 'Record Created',
        description: 'When a new record is created',
        icon: <Play className="w-4 h-4" />,
      },
      {
        type: 'trigger_record_updated',
        label: 'Record Updated',
        description: 'When a record is modified',
        icon: <RefreshCw className="w-4 h-4" />,
      },
      {
        type: 'trigger_field_changed',
        label: 'Field Changed',
        description: 'When a specific field changes',
        icon: <Settings className="w-4 h-4" />,
      },
      {
        type: 'trigger_stage_changed',
        label: 'Stage Changed',
        description: 'When deal stage changes',
        icon: <GitBranch className="w-4 h-4" />,
      },
      {
        type: 'trigger_scheduled',
        label: 'Scheduled',
        description: 'Run on a schedule',
        icon: <Clock className="w-4 h-4" />,
      },
    ],
  },
  {
    id: 'conditions',
    label: 'Conditions',
    color: 'text-amber-500',
    items: [
      {
        type: 'condition_if',
        label: 'If/Else',
        description: 'Branch based on condition',
        icon: <GitBranch className="w-4 h-4" />,
      },
      {
        type: 'condition_switch',
        label: 'Switch',
        description: 'Multiple branches',
        icon: <GitBranch className="w-4 h-4" />,
      },
      {
        type: 'condition_filter',
        label: 'Filter',
        description: 'Filter records by criteria',
        icon: <Settings className="w-4 h-4" />,
      },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    color: 'text-blue-500',
    items: [
      {
        type: 'action_update_field',
        label: 'Update Field',
        description: 'Update a record field',
        icon: <Settings className="w-4 h-4" />,
      },
      {
        type: 'action_send_email',
        label: 'Send Email',
        description: 'Send an email to contact',
        icon: <Mail className="w-4 h-4" />,
      },
      {
        type: 'action_send_sms',
        label: 'Send SMS',
        description: 'Send an SMS message',
        icon: <MessageSquare className="w-4 h-4" />,
      },
      {
        type: 'action_create_task',
        label: 'Create Task',
        description: 'Create a follow-up task',
        icon: <CheckSquare className="w-4 h-4" />,
      },
      {
        type: 'action_assign_owner',
        label: 'Assign Owner',
        description: 'Change record owner',
        icon: <User className="w-4 h-4" />,
      },
      {
        type: 'action_add_tag',
        label: 'Add Tag',
        description: 'Add a tag to record',
        icon: <Tag className="w-4 h-4" />,
      },
      {
        type: 'action_remove_tag',
        label: 'Remove Tag',
        description: 'Remove a tag from record',
        icon: <Tag className="w-4 h-4" />,
      },
      {
        type: 'action_webhook',
        label: 'Webhook',
        description: 'Call external webhook',
        icon: <Webhook className="w-4 h-4" />,
      },
    ],
  },
  {
    id: 'flow',
    label: 'Flow Control',
    color: 'text-purple-500',
    items: [
      {
        type: 'flow_wait',
        label: 'Wait',
        description: 'Wait for a period of time',
        icon: <Clock className="w-4 h-4" />,
      },
      {
        type: 'flow_split',
        label: 'Split',
        description: 'Run paths in parallel',
        icon: <GitBranch className="w-4 h-4" />,
      },
      {
        type: 'flow_merge',
        label: 'Merge',
        description: 'Merge parallel paths',
        icon: <GitBranch className="w-4 h-4" />,
      },
    ],
  },
];

interface WorkflowSidebarProps {
  onAddNode: (type: NodeType, label: string) => void;
}

export function WorkflowSidebar({ onAddNode }: WorkflowSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['triggers', 'conditions', 'actions', 'flow']);

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev =>
      prev.includes(id)
        ? prev.filter(c => c !== id)
        : [...prev, id]
    );
  };

  const filteredCategories = NODE_CATEGORIES.map(category => ({
    ...category,
    items: category.items.filter(item =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(category => category.items.length > 0);

  return (
    <div className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-3">
          Node Palette
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredCategories.map(category => (
          <div key={category.id} className="mb-2">
            <button
              onClick={() => toggleCategory(category.id)}
              className="flex items-center gap-2 w-full px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {expandedCategories.includes(category.id) ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
              <span className={cn('font-medium text-sm', category.color)}>
                {category.label}
              </span>
              <span className="text-xs text-slate-400 ml-auto">
                {category.items.length}
              </span>
            </button>

            {expandedCategories.includes(category.id) && (
              <div className="space-y-1 mt-1 ml-2">
                {category.items.map(item => (
                  <button
                    key={item.type}
                    onClick={() => onAddNode(item.type, item.label)}
                    className="flex items-start gap-3 w-full p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors group"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('nodeType', item.type);
                      e.dataTransfer.setData('nodeLabel', item.label);
                    }}
                  >
                    <div className={cn(
                      'p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800',
                      category.color,
                      'group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors'
                    )}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Help */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Click or drag nodes onto the canvas. Connect nodes by dragging from output to input handles.
        </p>
      </div>
    </div>
  );
}
