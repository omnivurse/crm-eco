'use client';

import { useState } from 'react';
import { 
  CheckSquare, 
  Phone, 
  Users, 
  Mail,
  Calendar,
  Clock,
  Loader2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import type { ActivityType, CallResult, CallType, MeetingType } from '@/lib/crm/types';

interface ActivityFormProps {
  onSubmit: (data: ActivityFormData) => Promise<void>;
  onCancel?: () => void;
  defaultActivityType?: ActivityType;
  isLoading?: boolean;
  className?: string;
}

export interface ActivityFormData {
  title: string;
  description?: string;
  activity_type: ActivityType;
  due_at?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  // Call fields
  call_type?: CallType;
  call_result?: CallResult;
  call_duration?: number;
  // Meeting fields
  meeting_type?: MeetingType;
  meeting_location?: string;
  // Common fields
  outcome?: string;
  reminder_at?: string;
}

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: React.ReactNode }[] = [
  { value: 'task', label: 'Task', icon: <CheckSquare className="w-4 h-4" /> },
  { value: 'call', label: 'Call', icon: <Phone className="w-4 h-4" /> },
  { value: 'meeting', label: 'Meeting', icon: <Users className="w-4 h-4" /> },
  { value: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const CALL_TYPES = [
  { value: 'outbound', label: 'Outbound' },
  { value: 'inbound', label: 'Inbound' },
];

const CALL_RESULTS = [
  { value: 'connected', label: 'Connected' },
  { value: 'left_voicemail', label: 'Left Voicemail' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'wrong_number', label: 'Wrong Number' },
];

const MEETING_TYPES = [
  { value: 'in_person', label: 'In Person' },
  { value: 'video', label: 'Video Call' },
  { value: 'phone', label: 'Phone Call' },
];

export function ActivityForm({
  onSubmit,
  onCancel,
  defaultActivityType = 'task',
  isLoading,
  className,
}: ActivityFormProps) {
  const [formData, setFormData] = useState<ActivityFormData>({
    title: '',
    description: '',
    activity_type: defaultActivityType,
    priority: 'normal',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    await onSubmit(formData);
  };

  const updateField = <K extends keyof ActivityFormData>(
    field: K, 
    value: ActivityFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const showCallFields = formData.activity_type === 'call';
  const showMeetingFields = formData.activity_type === 'meeting';

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      {/* Activity Type Selector */}
      <div className="flex gap-2">
        {ACTIVITY_TYPES.map((type) => (
          <Button
            key={type.value}
            type="button"
            variant={formData.activity_type === type.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateField('activity_type', type.value)}
            className={cn(
              formData.activity_type === type.value
                ? 'bg-teal-500 hover:bg-teal-400 text-white'
                : 'glass border-white/10 text-slate-300 hover:text-white hover:border-white/20'
            )}
          >
            {type.icon}
            <span className="ml-1.5">{type.label}</span>
          </Button>
        ))}
      </div>

      {/* Title */}
      <div>
        <label className="text-sm text-slate-400 mb-1 block">Subject *</label>
        <Input
          value={formData.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder={`Enter ${formData.activity_type} subject...`}
          required
          className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-sm text-slate-400 mb-1 block">Description</label>
        <Textarea
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Add details..."
          rows={3}
          className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-500 resize-none"
        />
      </div>

      {/* Date and Priority Row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-400 mb-1 block flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Due Date
          </label>
          <Input
            type="datetime-local"
            value={formData.due_at || ''}
            onChange={(e) => updateField('due_at', e.target.value)}
            className="bg-slate-900/50 border-white/10 text-white"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-1 block">Priority</label>
          <Select 
            value={formData.priority} 
            onValueChange={(value) => updateField('priority', value as ActivityFormData['priority'])}
          >
            <SelectTrigger className="bg-slate-900/50 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-card border-white/10">
              {PRIORITIES.map((p) => (
                <SelectItem 
                  key={p.value} 
                  value={p.value}
                  className="text-slate-300 focus:text-white focus:bg-white/10"
                >
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Call-specific fields */}
      {showCallFields && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Call Type</label>
            <Select 
              value={formData.call_type || ''} 
              onValueChange={(value) => updateField('call_type', value as CallType)}
            >
              <SelectTrigger className="bg-slate-900/50 border-white/10 text-white">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="glass-card border-white/10">
                {CALL_TYPES.map((t) => (
                  <SelectItem 
                    key={t.value} 
                    value={t.value}
                    className="text-slate-300 focus:text-white focus:bg-white/10"
                  >
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Call Result</label>
            <Select 
              value={formData.call_result || ''} 
              onValueChange={(value) => updateField('call_result', value as CallResult)}
            >
              <SelectTrigger className="bg-slate-900/50 border-white/10 text-white">
                <SelectValue placeholder="Select result" />
              </SelectTrigger>
              <SelectContent className="glass-card border-white/10">
                {CALL_RESULTS.map((r) => (
                  <SelectItem 
                    key={r.value} 
                    value={r.value}
                    className="text-slate-300 focus:text-white focus:bg-white/10"
                  >
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Meeting-specific fields */}
      {showMeetingFields && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Meeting Type</label>
            <Select 
              value={formData.meeting_type || ''} 
              onValueChange={(value) => updateField('meeting_type', value as MeetingType)}
            >
              <SelectTrigger className="bg-slate-900/50 border-white/10 text-white">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="glass-card border-white/10">
                {MEETING_TYPES.map((t) => (
                  <SelectItem 
                    key={t.value} 
                    value={t.value}
                    className="text-slate-300 focus:text-white focus:bg-white/10"
                  >
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Location</label>
            <Input
              value={formData.meeting_location || ''}
              onChange={(e) => updateField('meeting_location', e.target.value)}
              placeholder="Enter location or meeting link"
              className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-500"
            />
          </div>
        </div>
      )}

      {/* Outcome (for completed activities) */}
      <div>
        <label className="text-sm text-slate-400 mb-1 block">Outcome / Notes</label>
        <Textarea
          value={formData.outcome || ''}
          onChange={(e) => updateField('outcome', e.target.value)}
          placeholder="What was the result?"
          rows={2}
          className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-500 resize-none"
        />
      </div>

      {/* Reminder */}
      <div>
        <label className="text-sm text-slate-400 mb-1 block flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Reminder
        </label>
        <Input
          type="datetime-local"
          value={formData.reminder_at || ''}
          onChange={(e) => updateField('reminder_at', e.target.value)}
          className="bg-slate-900/50 border-white/10 text-white"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="text-slate-400 hover:text-white"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isLoading || !formData.title.trim()}
          className="bg-teal-500 hover:bg-teal-400 text-white"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            `Create ${formData.activity_type.charAt(0).toUpperCase() + formData.activity_type.slice(1)}`
          )}
        </Button>
      </div>
    </form>
  );
}
