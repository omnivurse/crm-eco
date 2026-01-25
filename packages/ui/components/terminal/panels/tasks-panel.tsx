// Tasks Panel - Starship Command Center
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../providers/auth';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  assigned_to?: string;
}

interface TasksPanelProps {
  data?: {
    tasks?: Task[];
    filter?: string;
  };
}

export function TasksPanel({ data }: TasksPanelProps) {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTasks() {
      if (data?.tasks) {
        setTasks(data.tasks);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data: taskData, error } = await supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, assigned_to')
          .neq('status', 'completed')
          .order('priority', { ascending: false })
          .order('due_date', { ascending: true })
          .limit(10);

        if (error) throw error;
        setTasks(taskData || []);
      } catch (error) {
        console.error('Failed to fetch tasks:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();
  }, [data?.tasks, profile]);

  const getPriorityIcon = (priority: string) => {
    const icons: Record<string, string> = {
      urgent: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };
    return icons[priority] || '⚪';
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'PENDING',
      'in-progress': 'IN PROGRESS',
      review: 'REVIEW',
      completed: 'DONE',
      blocked: 'BLOCKED',
    };
    return badges[status] || status.toUpperCase();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const today = new Date();
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="terminal-panel tasks-panel loading">
        <div className="panel-header">
          <span className="panel-icon">📋</span>
          <span className="panel-title">TASK QUEUE</span>
          <span className="panel-status loading">LOADING...</span>
        </div>
        <div className="panel-loading">
          <div className="loading-bar" />
        </div>
      </div>
    );
  }

  const urgentTasks = tasks.filter(t => t.priority === 'urgent' || t.priority === 'high');
  const normalTasks = tasks.filter(t => t.priority !== 'urgent' && t.priority !== 'high');

  return (
    <div className="terminal-panel tasks-panel">
      <div className="panel-header">
        <span className="panel-icon">📋</span>
        <span className="panel-title">TASK QUEUE</span>
        <span className="panel-count">{tasks.length} active</span>
      </div>

      <div className="panel-content">
        {/* Priority Tasks */}
        {urgentTasks.length > 0 && (
          <div className="tasks-section priority">
            <div className="section-title">◈ PRIORITY TASKS</div>
            <div className="tasks-list">
              {urgentTasks.map(task => (
                <div key={task.id} className={`task-item priority-${task.priority}`}>
                  <span className="task-priority">{getPriorityIcon(task.priority)}</span>
                  <span className="task-title">{task.title}</span>
                  <span className={`task-status status-${task.status}`}>
                    {getStatusBadge(task.status)}
                  </span>
                  <span className="task-due">{formatDate(task.due_date)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Normal Tasks */}
        <div className="tasks-section">
          <div className="section-title">◈ TASK QUEUE</div>
          {normalTasks.length === 0 && urgentTasks.length === 0 ? (
            <div className="tasks-empty">
              <span className="empty-icon">✨</span>
              <span className="empty-text">No pending tasks</span>
            </div>
          ) : (
            <div className="tasks-list">
              {normalTasks.map(task => (
                <div key={task.id} className={`task-item priority-${task.priority}`}>
                  <span className="task-priority">{getPriorityIcon(task.priority)}</span>
                  <span className="task-title">{task.title}</span>
                  <span className={`task-status status-${task.status}`}>
                    {getStatusBadge(task.status)}
                  </span>
                  <span className="task-due">{formatDate(task.due_date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel-footer">
        <span className="footer-hint">Type <code>new task</code> to create a task</span>
      </div>
    </div>
  );
}
