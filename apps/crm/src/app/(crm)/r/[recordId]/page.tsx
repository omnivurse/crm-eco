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
} from 'lucide-react';
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

function RecordHeader({ record, module }: { record: CrmRecord; module: CrmModule }) {
  return (
    <div className="flex items-start justify-between pb-6 border-b border-slate-700">
      <div className="flex items-start gap-4">
        <Link
          href={`/crm/modules/${module.key}`}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">
              {module.name}
            </span>
            {record.status && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-700 text-slate-300">
                {record.status}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">
            {record.title || 'Untitled Record'}
          </h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
            {record.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-4 h-4" />
                {record.email}
              </span>
            )}
            {record.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-4 h-4" />
                {record.phone}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Created {new Date(record.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="inline-flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors">
          <Edit className="w-4 h-4" />
          Edit
        </button>
        <button className="p-2 text-slate-400 hover:text-red-400 transition-colors">
          <Trash2 className="w-5 h-5" />
        </button>
        <button className="p-2 text-slate-400 hover:text-white transition-colors">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function TabButton({ 
  active, 
  icon: Icon, 
  label, 
  count,
  onClick 
}: { 
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active 
          ? 'border-blue-500 text-blue-400' 
          : 'border-transparent text-slate-400 hover:text-white'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {count !== undefined && count > 0 && (
        <span className="px-1.5 py-0.5 text-xs bg-slate-700 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
}

function NotesTab({ notes }: { notes: CrmNote[] }) {
  return (
    <div className="space-y-4">
      {notes.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No notes yet</p>
          <button className="mt-4 text-blue-400 hover:text-blue-300 text-sm">
            Add the first note
          </button>
        </div>
      ) : (
        notes.map((note) => (
          <div key={note.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <User className="w-4 h-4" />
                <span>Author</span>
              </div>
              <span className="text-xs text-slate-500">
                {new Date(note.created_at).toLocaleString()}
              </span>
            </div>
            <p className="text-slate-300 whitespace-pre-wrap">{note.body}</p>
          </div>
        ))
      )}
    </div>
  );
}

function TasksTab({ tasks }: { tasks: CrmTask[] }) {
  return (
    <div className="space-y-3">
      {tasks.length === 0 ? (
        <div className="text-center py-12">
          <CheckSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No tasks yet</p>
          <button className="mt-4 text-blue-400 hover:text-blue-300 text-sm">
            Create a task
          </button>
        </div>
      ) : (
        tasks.map((task) => (
          <div 
            key={task.id} 
            className={`flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-lg ${
              task.status === 'completed' ? 'opacity-60' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={task.status === 'completed'}
              readOnly
              className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
            />
            <div className="flex-1">
              <p className={`text-white ${task.status === 'completed' ? 'line-through' : ''}`}>
                {task.title}
              </p>
              {task.due_at && (
                <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" />
                  Due {new Date(task.due_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <span className={`px-2 py-1 text-xs rounded-full ${
              task.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
              task.priority === 'high' ? 'bg-amber-500/20 text-amber-400' :
              'bg-slate-700 text-slate-400'
            }`}>
              {task.priority}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function ActivityTab({ auditLog }: { auditLog: CrmAuditLog[] }) {
  return (
    <div className="space-y-1">
      {auditLog.length === 0 ? (
        <div className="text-center py-12">
          <History className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No activity recorded</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-700" />
          {auditLog.map((log, idx) => (
            <div key={log.id} className="relative flex gap-4 pb-6">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center z-10 ${
                log.action === 'create' ? 'bg-emerald-500/20 text-emerald-400' :
                log.action === 'update' ? 'bg-blue-500/20 text-blue-400' :
                log.action === 'delete' ? 'bg-red-500/20 text-red-400' :
                'bg-slate-700 text-slate-400'
              }`}>
                <span className="text-xs font-medium uppercase">
                  {log.action[0]}
                </span>
              </div>
              <div className="flex-1 pt-1">
                <p className="text-sm text-slate-300">
                  <span className="capitalize">{log.action}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(log.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
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
    <div className="space-y-6">
      <RecordHeader record={record} module={module} />

      {/* Tabs */}
      <div className="border-b border-slate-700 -mx-6 px-6">
        <div className="flex gap-1">
          <TabButton active icon={User} label="Overview" />
          <TabButton active={false} icon={MessageSquare} label="Notes" count={notes.length} />
          <TabButton active={false} icon={CheckSquare} label="Tasks" count={tasks.length} />
          <TabButton active={false} icon={History} label="Activity" count={auditLog.length} />
          <TabButton active={false} icon={LinkIcon} label="Relations" />
        </div>
      </div>

      {/* Content - Overview Tab */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <DynamicRecordForm
              record={record}
              fields={fields}
              layout={layout}
              readOnly
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-4">Quick Info</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Owner</p>
                <p className="text-sm text-white">{record.owner_id || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Created</p>
                <p className="text-sm text-white">{new Date(record.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Last Modified</p>
                <p className="text-sm text-white">{new Date(record.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Upcoming Tasks */}
          {tasks.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-4">Upcoming Tasks</h3>
              <div className="space-y-2">
                {tasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-300 truncate">{task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
    <div className="space-y-6 animate-pulse">
      <div className="flex items-start justify-between pb-6 border-b border-slate-700">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-slate-800 rounded-lg" />
          <div className="space-y-2">
            <div className="h-4 w-20 bg-slate-800 rounded" />
            <div className="h-8 w-48 bg-slate-800 rounded" />
            <div className="h-4 w-64 bg-slate-800 rounded" />
          </div>
        </div>
      </div>
      <div className="h-12 bg-slate-800/50 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 bg-slate-800/50 rounded-xl" />
        <div className="h-64 bg-slate-800/50 rounded-xl" />
      </div>
    </div>
  );
}
