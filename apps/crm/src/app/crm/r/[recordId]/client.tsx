'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@crm-eco/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Badge } from '@crm-eco/ui/components/badge';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@crm-eco/ui/components/tabs';
import { Avatar, AvatarFallback } from '@crm-eco/ui/components/avatar';
import { Separator } from '@crm-eco/ui/components/separator';
import { DynamicRecordForm, FieldRenderer } from '@/components/crm/records';
import type {
  CrmRecord,
  CrmModule,
  CrmField,
  CrmLayout,
  CrmNote,
  CrmTask,
  CrmAuditLog,
  CrmProfile,
} from '@/lib/crm/types';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MoreHorizontal,
  StickyNote,
  CheckSquare,
  History,
  Plus,
  Pin,
  Check,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface RecordDetailClientProps {
  record: CrmRecord;
  module: CrmModule;
  fields: CrmField[];
  layout: CrmLayout;
  notes: CrmNote[];
  tasks: CrmTask[];
  auditLog: CrmAuditLog[];
  profile: CrmProfile;
  initialEditMode?: boolean;
}

export function RecordDetailClient({
  record,
  module,
  fields,
  layout,
  notes: initialNotes,
  tasks: initialTasks,
  auditLog,
  profile,
  initialEditMode = false,
}: RecordDetailClientProps) {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [tasks, setTasks] = useState(initialTasks);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const router = useRouter();

  const canEdit = ['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '');
  const canDelete = ['crm_admin', 'crm_manager'].includes(profile.crm_role || '');

  // Group fields by section
  const fieldsBySection = fields.reduce((acc, field) => {
    const section = field.section || 'main';
    if (!acc[section]) acc[section] = [];
    acc[section].push(field);
    return acc;
  }, {} as Record<string, CrmField[]>);

  const handleSave = async (data: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/crm/records/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });

      if (response.ok) {
        setIsEditing(false);
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to save record:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/crm/records/${record.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push(`/modules/${module.key}`);
      }
    } catch (error) {
      console.error('Failed to delete record:', error);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setIsAddingNote(true);
    try {
      const response = await fetch('/api/crm/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: profile.organization_id,
          record_id: record.id,
          body: newNote.trim(),
        }),
      });

      if (response.ok) {
        const note = await response.json();
        setNotes([note, ...notes]);
        setNewNote('');
      }
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/crm/tasks/${taskId}/complete`, {
        method: 'POST',
      });

      if (response.ok) {
        setTasks(tasks.map((t) =>
          t.id === taskId ? { ...t, status: 'completed' as const, completed_at: new Date().toISOString() } : t
        ));
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const renderFieldValue = (field: CrmField) => {
    const value = record.data[field.key];
    return <FieldRenderer field={field} value={value} />;
  };

  const getTaskStatusIcon = (task: CrmTask) => {
    if (task.status === 'completed') {
      return <Check className="w-4 h-4 text-brand-emerald-600" />;
    }
    if (task.due_at && new Date(task.due_at) < new Date()) {
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    }
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/modules/${module.key}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to {module.name_plural || module.name + 's'}
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-brand-navy-800">
                {record.title || 'Untitled'}
              </h1>
              {record.status && (
                <Badge variant="secondary">{record.status}</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              Created {format(new Date(record.created_at), 'MMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && !isEditing && (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
            {canDelete && (
              <Button variant="outline" className="text-destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {isEditing ? (
            <Card>
              <CardHeader>
                <CardTitle>Edit {module.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <DynamicRecordForm
                  fields={fields}
                  layout={layout}
                  defaultValues={record.data as Record<string, unknown>}
                  onSubmit={handleSave}
                  onCancel={() => setIsEditing(false)}
                  isLoading={isSaving}
                  mode="edit"
                />
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Field Display */}
              {layout.config.sections.map((section) => {
                const sectionFields = fieldsBySection[section.key] || [];
                if (sectionFields.length === 0) return null;

                return (
                  <Card key={section.key}>
                    <CardHeader className="py-4">
                      <CardTitle className="text-base">{section.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sectionFields.map((field) => (
                          <div key={field.key} className={field.width === 'full' ? 'md:col-span-2' : ''}>
                            <dt className="text-sm font-medium text-muted-foreground mb-1">
                              {field.label}
                            </dt>
                            <dd className="text-sm">{renderFieldValue(field)}</dd>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Tabs defaultValue="activity">
            <TabsList className="w-full">
              <TabsTrigger value="activity" className="flex-1">
                <History className="w-4 h-4 mr-1" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex-1">
                <StickyNote className="w-4 h-4 mr-1" />
                Notes
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex-1">
                <CheckSquare className="w-4 h-4 mr-1" />
                Tasks
              </TabsTrigger>
            </TabsList>

            {/* Activity Tab */}
            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {auditLog.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No activity yet
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {auditLog.map((entry) => (
                        <div key={entry.id} className="flex gap-3 text-sm">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs">U</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-muted-foreground">
                              <span className="font-medium text-foreground capitalize">
                                {entry.action}
                              </span>
                              {' '}record
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(entry.created_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="mt-4">
              <Card>
                <CardContent className="p-4 space-y-4">
                  {/* Add Note */}
                  {canEdit && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Add a note..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        rows={2}
                      />
                      <Button
                        size="sm"
                        onClick={handleAddNote}
                        disabled={!newNote.trim() || isAddingNote}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Note
                      </Button>
                      <Separator />
                    </div>
                  )}

                  {/* Notes List */}
                  {notes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No notes yet
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {notes.map((note) => (
                        <div key={note.id} className="relative">
                          {note.is_pinned && (
                            <Pin className="absolute top-0 right-0 w-3 h-3 text-brand-gold-500" />
                          )}
                          <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(note.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No tasks yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50"
                        >
                          <button
                            onClick={() => task.status !== 'completed' && handleCompleteTask(task.id)}
                            className="mt-0.5"
                            disabled={task.status === 'completed'}
                          >
                            {getTaskStatusIcon(task)}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                              {task.title}
                            </p>
                            {task.due_at && (
                              <p className="text-xs text-muted-foreground">
                                Due {format(new Date(task.due_at), 'MMM d')}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant="secondary"
                            className={
                              task.priority === 'high' || task.priority === 'urgent'
                                ? 'bg-destructive/10 text-destructive'
                                : ''
                            }
                          >
                            {task.priority}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
