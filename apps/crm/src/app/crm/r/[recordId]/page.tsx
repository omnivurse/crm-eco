import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  Clock,
  User,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  CheckSquare,
  History,
  Link as LinkIcon,
  Plus,
  Send,
  FileText,
  Users,
  UserPlus,
  DollarSign,
  Building2,
  ExternalLink,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { 
  getRecordWithModule,
  getFieldsForModule,
  getDefaultLayout,
  getNotesForRecord,
  getTasksForRecord,
  getAuditLogForRecord,
  getCurrentProfile,
} from '@/lib/crm/queries';
import { DynamicRecordForm } from '@/components/crm/records/DynamicRecordForm';
import type { CrmRecord, CrmModule, CrmField, CrmLayout, CrmNote, CrmTask, CrmAuditLog } from '@/lib/crm/types';

interface PageProps {
  params: Promise<{ recordId: string }>;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <Users className="w-5 h-5" />,
  leads: <UserPlus className="w-5 h-5" />,
  deals: <DollarSign className="w-5 h-5" />,
  accounts: <Building2 className="w-5 h-5" />,
};

const MODULE_COLORS: Record<string, { text: string; bg: string }> = {
  contacts: { text: 'text-teal-400', bg: 'bg-teal-500/10' },
  leads: { text: 'text-violet-400', bg: 'bg-violet-500/10' },
  deals: { text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  accounts: { text: 'text-amber-400', bg: 'bg-amber-500/10' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Active': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'In-Active': { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  'New': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  'Contacted': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  'Hot Prospect - ready to move': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  'Qualified': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
  'Working': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  'Converted': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'Lost': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
};

function RecordHeader({ record, module }: { record: CrmRecord; module: CrmModule }) {
  const icon = MODULE_ICONS[module.key] || <FileText className="w-5 h-5" />;
  const colors = MODULE_COLORS[module.key] || { text: 'text-teal-400', bg: 'bg-teal-500/10' };
  
  // Build display name from data
  const firstName = String(record.data?.first_name || '');
  const lastName = String(record.data?.last_name || '');
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || record.title || 'Untitled Record';
  const email = String(record.data?.email || record.email || '');
  const phone = String(record.data?.phone || record.phone || '');
  const status = String(record.data?.contact_status || record.data?.lead_status || record.status || '');
  const statusStyle = STATUS_STYLES[status] || { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' };

  return (
    <div className="glass-card rounded-2xl p-6 border border-white/10">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            href={`/crm/modules/${module.key}`}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          
          <div className={`p-3 rounded-xl ${colors.bg}`}>
            <span className={colors.text}>{icon}</span>
          </div>
          
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
                {module.name}
              </span>
              {status && (
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                  {status}
                </span>
              )}
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-3">
              {displayName}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {email && (
                <a 
                  href={`mailto:${email}`}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-teal-400 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {email}
                </a>
              )}
              {phone && (
                <a 
                  href={`tel:${phone}`}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-teal-400 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {phone}
                </a>
              )}
              <span className="flex items-center gap-1.5 text-slate-500">
                <Calendar className="w-4 h-4" />
                Created {new Date(record.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="glass border-white/10 text-slate-300 hover:text-white hover:border-white/20"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-10 w-10 text-slate-400 hover:text-white hover:bg-white/5"
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass border-white/10 w-48">
              <DropdownMenuItem className="text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer">
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </DropdownMenuItem>
              <DropdownMenuItem className="text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer">
                <MessageSquare className="w-4 h-4 mr-2" />
                Add Note
              </DropdownMenuItem>
              <DropdownMenuItem className="text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer">
                <CheckSquare className="w-4 h-4 mr-2" />
                Create Task
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem className="text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer">
                <ExternalLink className="w-4 h-4 mr-2" />
                View in New Tab
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Record
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function TabButton({ 
  active, 
  icon: Icon, 
  label, 
  count,
}: { 
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
}) {
  return (
    <button
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
        active 
          ? 'bg-gradient-to-r from-teal-500/20 to-emerald-500/10 text-teal-400 border border-teal-500/30' 
          : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {count !== undefined && count > 0 && (
        <span className={`px-2 py-0.5 text-xs rounded-full ${active ? 'bg-teal-500/20 text-teal-400' : 'bg-slate-700 text-slate-400'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function NotesSection({ notes }: { notes: CrmNote[] }) {
  return (
    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-violet-400" />
          <h3 className="text-lg font-semibold text-white">Notes</h3>
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-400">{notes.length}</span>
        </div>
        <Button 
          size="sm"
          className="h-8 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Note
        </Button>
      </div>
      <div className="p-4">
        {notes.length === 0 ? (
          <div className="text-center py-8">
            <div className="p-4 rounded-full bg-slate-800/50 w-fit mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-white font-medium mb-1">No notes yet</p>
            <p className="text-slate-500 text-sm">Add a note to keep track of important details.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="p-4 rounded-xl bg-slate-900/30 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                      <User className="w-3 h-3" />
                    </div>
                    <span>Author</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(note.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-300 whitespace-pre-wrap text-sm">{note.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TasksSection({ tasks }: { tasks: CrmTask[] }) {
  return (
    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Tasks</h3>
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-400">{tasks.length}</span>
        </div>
        <Button 
          size="sm"
          className="h-8 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Task
        </Button>
      </div>
      <div className="p-4">
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <div className="p-4 rounded-full bg-slate-800/50 w-fit mx-auto mb-4">
              <CheckSquare className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-white font-medium mb-1">No tasks yet</p>
            <p className="text-slate-500 text-sm">Create a task to track follow-ups.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div 
                key={task.id} 
                className={`flex items-center gap-3 p-3 rounded-xl bg-slate-900/30 border border-white/5 hover:border-white/10 transition-colors ${
                  task.status === 'completed' ? 'opacity-60' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={task.status === 'completed'}
                  readOnly
                  className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-white text-sm ${task.status === 'completed' ? 'line-through text-slate-500' : ''}`}>
                    {task.title}
                  </p>
                  {task.due_at && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      Due {new Date(task.due_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  task.priority === 'urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                  task.priority === 'high' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                  'bg-slate-700 text-slate-400'
                }`}>
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityTimeline({ auditLog }: { auditLog: CrmAuditLog[] }) {
  const actionConfig: Record<string, { color: string; bg: string }> = {
    create: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
    update: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
    delete: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
    import: { color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30' },
  };

  return (
    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
        <History className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-white">Activity Timeline</h3>
      </div>
      <div className="p-4">
        {auditLog.length === 0 ? (
          <div className="text-center py-8">
            <div className="p-4 rounded-full bg-slate-800/50 w-fit mx-auto mb-4">
              <History className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-white font-medium mb-1">No activity recorded</p>
            <p className="text-slate-500 text-sm">Activity will appear here as changes are made.</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-700" />
            {auditLog.map((log) => {
              const config = actionConfig[log.action] || { color: 'text-slate-400', bg: 'bg-slate-700' };
              return (
                <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 border ${config.bg}`}>
                    <span className={`text-xs font-semibold uppercase ${config.color}`}>
                      {log.action[0]}
                    </span>
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm text-slate-300">
                      Record <span className={`font-medium ${config.color}`}>{log.action}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickInfoCard({ record }: { record: CrmRecord }) {
  return (
    <div className="glass-card rounded-2xl border border-white/10 p-4">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Quick Info</h3>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">Owner</p>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
              <User className="w-3 h-3 text-slate-400" />
            </div>
            <span className="text-sm text-white">{record.owner_id ? 'Assigned' : 'Unassigned'}</span>
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Created</p>
          <p className="text-sm text-white">{new Date(record.created_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Last Modified</p>
          <p className="text-sm text-white">{new Date(record.updated_at).toLocaleString()}</p>
        </div>
        
        {/* Key fields from data */}
        {typeof record.data?.product === 'string' && record.data.product && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Product</p>
            <p className="text-sm text-white">{record.data.product}</p>
          </div>
        )}
        {typeof record.data?.coverage_option === 'string' && record.data.coverage_option && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Coverage</p>
            <p className="text-sm text-white">{record.data.coverage_option}</p>
          </div>
        )}
        {typeof record.data?.lead_source === 'string' && record.data.lead_source && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Lead Source</p>
            <p className="text-sm text-white">{record.data.lead_source}</p>
          </div>
        )}
      </div>
    </div>
  );
}

async function RecordDetailContent({ params }: PageProps) {
  const { recordId } = await params;
  
  const result = await getRecordWithModule(recordId);
  if (!result) return notFound();

  const { record, module } = result;

  const [fields, layout, notes, tasks, auditLog] = await Promise.all([
    getFieldsForModule(module.id),
    getDefaultLayout(module.id),
    getNotesForRecord(recordId),
    getTasksForRecord(recordId),
    getAuditLogForRecord(recordId),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <RecordHeader record={record} module={module} />

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <TabButton active icon={User} label="Details" />
        <TabButton active={false} icon={MessageSquare} label="Notes" count={notes.length} />
        <TabButton active={false} icon={CheckSquare} label="Tasks" count={tasks.length} />
        <TabButton active={false} icon={History} label="Activity" count={auditLog.length} />
        <TabButton active={false} icon={LinkIcon} label="Related" />
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Record Details */}
          <div className="glass-card rounded-2xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-400" />
              Record Details
            </h3>
            <DynamicRecordForm
              record={record}
              fields={fields}
              layout={layout}
              readOnly
            />
          </div>

          {/* Notes Section */}
          <NotesSection notes={notes} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <QuickInfoCard record={record} />

          {/* Tasks Section */}
          <TasksSection tasks={tasks} />

          {/* Activity Timeline */}
          <ActivityTimeline auditLog={auditLog} />
        </div>
      </div>
    </div>
  );
}

export default function RecordDetailPage(props: PageProps) {
  return (
    <Suspense fallback={<RecordDetailSkeleton />}>
      <RecordDetailContent {...props} />
    </Suspense>
  );
}

function RecordDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header skeleton */}
      <div className="glass-card rounded-2xl p-6 border border-white/5 animate-pulse">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-slate-800 rounded-lg" />
          <div className="w-12 h-12 bg-slate-800 rounded-xl" />
          <div className="space-y-3 flex-1">
            <div className="h-4 w-24 bg-slate-800 rounded" />
            <div className="h-8 w-48 bg-slate-800 rounded" />
            <div className="flex gap-4">
              <div className="h-4 w-32 bg-slate-800 rounded" />
              <div className="h-4 w-24 bg-slate-800 rounded" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 w-24 bg-slate-800/50 rounded-lg animate-pulse" />
        ))}
      </div>
      
      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-96 bg-slate-800/30 rounded-2xl border border-white/5 animate-pulse" />
          <div className="h-48 bg-slate-800/30 rounded-2xl border border-white/5 animate-pulse" />
        </div>
        <div className="space-y-6">
          <div className="h-48 bg-slate-800/30 rounded-2xl border border-white/5 animate-pulse" />
          <div className="h-48 bg-slate-800/30 rounded-2xl border border-white/5 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
