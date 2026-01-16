'use client';

import { useState } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  MessageSquare,
  Phone,
  CheckSquare,
  Mail,
  FileText,
  Send,
  X,
  Loader2,
} from 'lucide-react';

type ComposerMode = 'note' | 'call' | 'task' | 'email' | null;

interface ComposerBarProps {
  recordId: string;
  onNoteCreated?: () => void;
  onTaskCreated?: () => void;
  onCallLogged?: () => void;
  onEmailSent?: () => void;
  className?: string;
}

export function ComposerBar({
  recordId,
  onNoteCreated,
  onTaskCreated,
  onCallLogged,
  onEmailSent,
  className,
}: ComposerBarProps) {
  const [mode, setMode] = useState<ComposerMode>(null);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || !mode) return;

    setSubmitting(true);
    
    try {
      // TODO: Implement actual API calls
      switch (mode) {
        case 'note':
          await createNote();
          onNoteCreated?.();
          break;
        case 'task':
          await createTask();
          onTaskCreated?.();
          break;
        case 'call':
          await logCall();
          onCallLogged?.();
          break;
        case 'email':
          // Would open email composer
          onEmailSent?.();
          break;
      }
      
      setContent('');
      setMode(null);
    } catch (error) {
      console.error('Error submitting:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const createNote = async () => {
    const response = await fetch('/api/crm/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, body: content }),
    });
    if (!response.ok) throw new Error('Failed to create note');
  };

  const createTask = async () => {
    const response = await fetch('/api/crm/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, title: content }),
    });
    if (!response.ok) throw new Error('Failed to create task');
  };

  const logCall = async () => {
    const response = await fetch('/api/crm/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, type: 'call', outcome: content }),
    });
    if (!response.ok) throw new Error('Failed to log call');
  };

  const getPlaceholder = (): string => {
    switch (mode) {
      case 'note': return 'Write a note...';
      case 'task': return 'Task title...';
      case 'call': return 'Call outcome or notes...';
      case 'email': return 'Email subject...';
      default: return '';
    }
  };

  const getModeLabel = (): string => {
    switch (mode) {
      case 'note': return 'Add Note';
      case 'task': return 'Create Task';
      case 'call': return 'Log Call';
      case 'email': return 'Send Email';
      default: return '';
    }
  };

  return (
    <div className={cn(
      'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl p-3',
      className
    )}>
      {mode ? (
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {getModeLabel()}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setMode(null); setContent(''); }}
              className="h-7 w-7 text-slate-500 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Input */}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={getPlaceholder()}
            className="min-h-[60px] bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10 text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />

          {/* Actions */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Press Cmd+Enter to submit
            </span>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!content.trim() || submitting}
              className="h-8 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Submit
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode('note')}
            className="h-9 flex-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-white/10"
          >
            <MessageSquare className="w-4 h-4 mr-1.5" />
            Note
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode('task')}
            className="h-9 flex-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-white/10"
          >
            <CheckSquare className="w-4 h-4 mr-1.5" />
            Task
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode('call')}
            className="h-9 flex-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-white/10"
          >
            <Phone className="w-4 h-4 mr-1.5" />
            Call
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode('email')}
            className="h-9 flex-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-white/10"
          >
            <Mail className="w-4 h-4 mr-1.5" />
            Email
          </Button>
        </div>
      )}
    </div>
  );
}
