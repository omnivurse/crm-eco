'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Textarea,
} from '@crm-eco/ui';
import {
  CheckCircle2,
  Circle,
  Plus,
  Clock,
  AlertCircle,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
  ListTodo,
  Calendar,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'med' | 'high' | 'urgent';
  due_at: string | null;
  created_at: string;
  assignee_id: string | null;
  assignee?: {
    full_name: string;
  } | null;
}

interface TodoListWidgetProps {
  profileId: string;
  organizationId: string;
}

const priorityColors = {
  low: 'bg-slate-100 text-slate-600',
  med: 'bg-blue-100 text-blue-600',
  high: 'bg-amber-100 text-amber-600',
  urgent: 'bg-red-100 text-red-600',
};

const statusIcons = {
  todo: Circle,
  in_progress: Clock,
  review: AlertCircle,
  done: CheckCircle2,
};

export function TodoListWidget({ profileId, organizationId }: TodoListWidgetProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'med' as Task['priority'],
    due_at: '',
  });

  const supabase = createClient();

  const fetchTasks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_at,
          created_at,
          assignee_id,
          assignee:profiles!tasks_assignee_id_fkey(full_name)
        `)
        .or(`assignee_id.eq.${profileId},created_by_id.eq.${profileId}`)
        .neq('status', 'done')
        .order('priority', { ascending: false })
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(8);

      if (error) throw error;
      setTasks((data || []) as unknown as Task[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, profileId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const openCreateModal = () => {
    setEditingTask(null);
    setFormData({ title: '', description: '', priority: 'med', due_at: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      due_at: task.due_at ? format(new Date(task.due_at), "yyyy-MM-dd'T'HH:mm") : '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      const taskData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        priority: formData.priority,
        due_at: formData.due_at ? new Date(formData.due_at).toISOString() : null,
      };

      if (editingTask) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('tasks')
          .update(taskData)
          .eq('id', editingTask.id);

        if (error) throw error;
        toast.success('Task updated');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('tasks')
          .insert({
            ...taskData,
            status: 'todo',
            created_by_id: profileId,
            assignee_id: profileId,
            organization_id: organizationId,
          });

        if (error) throw error;
        toast.success('Task created');
      }

      setIsModalOpen(false);
      fetchTasks();
    } catch (error: any) {
      console.error('Error saving task:', error);
      toast.error(error.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id);

      if (error) throw error;

      toast.success(newStatus === 'done' ? 'Task completed' : 'Task reopened');
      fetchTasks();
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Task deleted');
      setIsModalOpen(false);
      fetchTasks();
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const isOverdue = (dueAt: string | null) => {
    if (!dueAt) return false;
    return new Date(dueAt) < new Date();
  };

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-400">
                <ListTodo className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">To Do List</CardTitle>
                <p className="text-sm text-slate-500">
                  {tasks.length} pending {tasks.length === 1 ? 'task' : 'tasks'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={openCreateModal}>
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
              <Link href="/tasks">
                <Button size="sm" variant="ghost">
                  View all
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-slate-300" />
              </div>
              <p className="font-medium text-slate-600 mb-1">All caught up!</p>
              <p className="text-sm text-slate-400">No pending tasks</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const StatusIcon = statusIcons[task.status];
                const overdue = isOverdue(task.due_at);

                return (
                  <div
                    key={task.id}
                    className="group flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => openEditModal(task)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleComplete(task);
                      }}
                      className="shrink-0 p-1 rounded-full hover:bg-slate-200 transition-colors"
                    >
                      <StatusIcon
                        className={`w-5 h-5 ${
                          task.status === 'done'
                            ? 'text-emerald-500'
                            : task.status === 'in_progress'
                            ? 'text-blue-500'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'
                      }`}>
                        {task.title}
                      </p>
                      {task.due_at && (
                        <p className={`text-xs flex items-center gap-1 ${
                          overdue ? 'text-red-500' : 'text-slate-400'
                        }`}>
                          <Calendar className="w-3 h-3" />
                          {overdue ? 'Overdue: ' : 'Due: '}
                          {formatDistanceToNow(new Date(task.due_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>

                    <Badge className={priorityColors[task.priority]}>
                      {task.priority}
                    </Badge>

                    <Pencil className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTask ? 'Edit Task' : 'Create Task'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Title *</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="What needs to be done?"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add more details..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Priority</label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value as Task['priority'] })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="med">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Due Date</label>
                <Input
                  type="datetime-local"
                  value={formData.due_at}
                  onChange={(e) => setFormData({ ...formData, due_at: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {editingTask && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDelete(editingTask.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingTask ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
