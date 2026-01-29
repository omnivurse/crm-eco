'use client';

import { cn } from '@crm-eco/ui/lib/utils';
import { RelatedListTable } from './RelatedListTable';
import { 
  CheckSquare, 
  MessageSquare, 
  FileText, 
  Link as LinkIcon,
  Mail,
  Phone,
} from 'lucide-react';
import type { CrmTask, CrmNote, CrmAttachment, CrmLinkedRecord } from '@/lib/crm/types';

interface RelatedListsProps {
  recordId: string;
  tasks?: CrmTask[];
  notes?: CrmNote[];
  attachments?: CrmAttachment[];
  linkedRecords?: CrmLinkedRecord[];
  communications?: Array<{
    id: string;
    type: string;
    subject?: string;
    created_at: string;
    status?: string;
  }>;
  onAddTask?: () => void;
  onAddNote?: () => void;
  onUploadFile?: () => void;
  onLinkRecord?: () => void;
  className?: string;
}

export function RelatedLists({
  recordId,
  tasks = [],
  notes = [],
  attachments = [],
  linkedRecords = [],
  communications = [],
  onAddTask,
  onAddNote,
  onUploadFile,
  onLinkRecord,
  className,
}: RelatedListsProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Tasks */}
      <RelatedListTable
        title="Tasks"
        icon={<CheckSquare className="w-4 h-4" />}
        items={tasks as unknown as Record<string, unknown>[]}
        columns={[
          { 
            key: 'title', 
            label: 'Task',
            render: (value) => (
              <span className="font-medium text-slate-900 dark:text-white">
                {String(value || 'Untitled')}
              </span>
            ),
          },
          { 
            key: 'status', 
            label: 'Status',
            render: (value) => {
              const status = String(value || 'open');
              const colors: Record<string, string> = {
                open: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
                in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
                completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
                cancelled: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400',
              };
              return (
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', colors[status] || colors.open)}>
                  {status.replace('_', ' ')}
                </span>
              );
            },
          },
          { 
            key: 'due_at', 
            label: 'Due',
            render: (value) => {
              if (!value) return <span className="text-slate-400">—</span>;
              const date = new Date(String(value));
              const isOverdue = date < new Date() && value;
              return (
                <span className={isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'} suppressHydrationWarning>
                  {date.toLocaleDateString()}
                </span>
              );
            },
          },
        ]}
        onAdd={onAddTask}
        emptyMessage="No tasks created yet"
      />

      {/* Notes */}
      <RelatedListTable
        title="Notes"
        icon={<MessageSquare className="w-4 h-4" />}
        items={notes as unknown as Record<string, unknown>[]}
        columns={[
          { 
            key: 'body', 
            label: 'Note',
            render: (value) => {
              const text = String(value || '');
              return (
                <span className="text-slate-700 dark:text-slate-300 line-clamp-2">
                  {text.length > 100 ? text.slice(0, 100) + '...' : text}
                </span>
              );
            },
          },
          { 
            key: 'created_at', 
            label: 'Created',
            render: (value) => (
              <span className="text-slate-500 text-xs" suppressHydrationWarning>
                {value ? new Date(String(value)).toLocaleDateString() : '—'}
              </span>
            ),
          },
        ]}
        onAdd={onAddNote}
        emptyMessage="No notes added yet"
      />

      {/* Communications */}
      {communications.length > 0 && (
        <RelatedListTable
          title="Communications"
          icon={<Mail className="w-4 h-4" />}
          items={communications as unknown as Record<string, unknown>[]}
          columns={[
            { 
              key: 'type', 
              label: 'Type',
              render: (value) => {
                const type = String(value || 'email');
                const icons: Record<string, React.ReactNode> = {
                  email: <Mail className="w-3.5 h-3.5" />,
                  call: <Phone className="w-3.5 h-3.5" />,
                };
                return (
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    {icons[type] || icons.email}
                    <span className="capitalize">{type}</span>
                  </span>
                );
              },
            },
            { 
              key: 'subject', 
              label: 'Subject',
              render: (value) => (
                <span className="text-slate-700 dark:text-slate-300">
                  {String(value || '—')}
                </span>
              ),
            },
            {
              key: 'created_at',
              label: 'Date',
              render: (value) => (
                <span className="text-slate-500 text-xs" suppressHydrationWarning>
                  {value ? new Date(String(value)).toLocaleDateString() : '—'}
                </span>
              ),
            },
          ]}
          emptyMessage="No communications logged"
        />
      )}

      {/* Attachments */}
      <RelatedListTable
        title="Files"
        icon={<FileText className="w-4 h-4" />}
        items={attachments as unknown as Record<string, unknown>[]}
        columns={[
          { 
            key: 'file_name', 
            label: 'Name',
            render: (value) => (
              <span className="font-medium text-slate-900 dark:text-white">
                {String(value || 'Untitled')}
              </span>
            ),
          },
          { 
            key: 'file_size', 
            label: 'Size',
            render: (value) => {
              if (!value) return <span className="text-slate-400">—</span>;
              const bytes = Number(value);
              if (bytes < 1024) return `${bytes} B`;
              if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
              return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
            },
          },
          {
            key: 'created_at',
            label: 'Uploaded',
            render: (value) => (
              <span className="text-slate-500 text-xs" suppressHydrationWarning>
                {value ? new Date(String(value)).toLocaleDateString() : '—'}
              </span>
            ),
          },
        ]}
        onAdd={onUploadFile}
        emptyMessage="No files uploaded"
      />

      {/* Linked Records */}
      <RelatedListTable
        title="Linked Records"
        icon={<LinkIcon className="w-4 h-4" />}
        items={linkedRecords as unknown as Record<string, unknown>[]}
        columns={[
          { 
            key: 'record_title', 
            label: 'Name',
            render: (value) => (
              <span className="font-medium text-teal-600 dark:text-teal-400 hover:underline cursor-pointer">
                {String(value || 'Untitled')}
              </span>
            ),
          },
          { 
            key: 'record_module_name', 
            label: 'Type',
            render: (value) => (
              <span className="text-slate-600 dark:text-slate-300">
                {String(value || '—')}
              </span>
            ),
          },
          { 
            key: 'link_type', 
            label: 'Relationship',
            render: (value) => (
              <span className="text-slate-500 capitalize">
                {String(value || 'related').replace('_', ' ')}
              </span>
            ),
          },
        ]}
        onAdd={onLinkRecord}
        emptyMessage="No linked records"
      />
    </div>
  );
}
