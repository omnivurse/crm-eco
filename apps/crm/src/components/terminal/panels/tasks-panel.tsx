'use client';

// Tasks Panel - Starship Command Center
import React from 'react';

interface TasksPanelProps {
  data?: any;
}

export function TasksPanel({ data }: TasksPanelProps) {
  const tasks = [
    { id: '1', title: 'Follow up with Acme Corp', priority: 'high', status: 'pending', due: 'Today' },
    { id: '2', title: 'Prepare proposal for TechStart', priority: 'medium', status: 'in-progress', due: 'Tomorrow' },
    { id: '3', title: 'Review contract terms', priority: 'urgent', status: 'pending', due: 'Today' },
  ];

  const getPriorityIcon = (priority: string) => {
    const icons: Record<string, string> = {
      urgent: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };
    return icons[priority] || '⚪';
  };

  return (
    <div className="terminal-panel tasks-panel">
      <div className="panel-header">
        <span className="panel-icon">📋</span>
        <span className="panel-title">TASK QUEUE</span>
        <span className="panel-count">{tasks.length} active</span>
      </div>

      <div className="panel-content">
        <div className="tasks-section">
          <div className="section-title">◈ PENDING TASKS</div>
          <div className="tasks-list">
            {tasks.map(task => (
              <div key={task.id} className={`task-item priority-${task.priority}`}>
                <span className="task-priority">{getPriorityIcon(task.priority)}</span>
                <span className="task-title">{task.title}</span>
                <span className={`task-status status-${task.status}`}>
                  {task.status.toUpperCase()}
                </span>
                <span className="task-due">{task.due}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
