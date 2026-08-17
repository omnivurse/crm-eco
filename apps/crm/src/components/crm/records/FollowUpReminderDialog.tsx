'use client';

/**
 * Focused dialog for setting a follow-up reminder on a Lead / Contact.
 *
 * Quick presets: "In 1 week", "In 1 month", "In 3 months", "In 6 months",
 * "In 18 months", or a custom date. Optionally repeats every N days until
 * the user marks it complete.
 */

import { useState, useCallback } from 'react';
import { addDays, addMonths, addWeeks, format } from 'date-fns';
import { Bell, Calendar, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';

interface FollowUpReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
  recordTitle: string;
  /** Called after successful creation so the parent can refresh. */
  onCreated?: () => void;
}

type Preset = { label: string; getDueDate: () => Date };

const PRESETS: Preset[] = [
  { label: 'In 1 week', getDueDate: () => addWeeks(new Date(), 1) },
  { label: 'In 1 month', getDueDate: () => addMonths(new Date(), 1) },
  { label: 'In 3 months', getDueDate: () => addMonths(new Date(), 3) },
  { label: 'In 6 months', getDueDate: () => addMonths(new Date(), 6) },
  { label: 'In 12 months', getDueDate: () => addMonths(new Date(), 12) },
  { label: 'In 18 months', getDueDate: () => addMonths(new Date(), 18) },
];

const REPEAT_OPTIONS = [
  { value: '0', label: 'No repeat' },
  { value: '1', label: 'Every day' },
  { value: '3', label: 'Every 3 days' },
  { value: '7', label: 'Every week' },
  { value: '14', label: 'Every 2 weeks' },
  { value: '30', label: 'Every month' },
];

export function FollowUpReminderDialog({
  open,
  onOpenChange,
  recordId,
  recordTitle,
  onCreated,
}: FollowUpReminderDialogProps) {
  const [dueDate, setDueDate] = useState(() =>
    format(addMonths(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
  );
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [repeatDays, setRepeatDays] = useState('0');
  const [saving, setSaving] = useState(false);
  const [activePreset, setActivePreset] = useState<number | null>(null);

  const selectPreset = useCallback((idx: number) => {
    const d = PRESETS[idx].getDueDate();
    setDueDate(format(d, "yyyy-MM-dd'T'HH:mm"));
    setActivePreset(idx);
  }, []);

  const handleSave = async () => {
    if (!dueDate) {
      toast.error('Please select a follow-up date');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Follow up: ${recordTitle}`,
          description: note || undefined,
          activity_type: 'follow_up',
          priority,
          due_date: new Date(dueDate).toISOString(),
          record_id: recordId,
          repeat_interval_days: Number(repeatDays) || undefined,
          follow_up_note: note || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create reminder');
      }

      toast.success('Follow-up reminder set!', {
        description: `You'll be reminded on ${format(new Date(dueDate), 'MMM d, yyyy')}`,
      });
      onOpenChange(false);
      onCreated?.();

      // Reset
      setNote('');
      setPriority('normal');
      setRepeatDays('0');
      setActivePreset(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create reminder');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg glass-card border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Bell className="w-5 h-5 text-teal-500" />
            Set Follow-Up Reminder
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            You&rsquo;ll receive a notification on the date you choose. Reminders repeat until you
            mark them complete.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Quick presets */}
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              Quick select
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset, idx) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectPreset(idx)}
                  className={cn(
                    'rounded-full transition-all',
                    activePreset === idx
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground border-primary'
                      : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-primary/60',
                  )}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom date */}
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Follow-up date
            </label>
            <Input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                setActivePreset(null);
              }}
              className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
              Reason / Note
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. COBRA expires, reach out about new plan"
              rows={2}
              className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none"
            />
          </div>

          {/* Priority + Repeat row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                Priority
              </label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-card border-slate-200 dark:border-white/10">
                  <SelectItem value="normal" className="text-slate-700 dark:text-slate-300 focus:text-white focus:bg-white/10">Normal</SelectItem>
                  <SelectItem value="high" className="text-slate-700 dark:text-slate-300 focus:text-white focus:bg-white/10">High</SelectItem>
                  <SelectItem value="urgent" className="text-slate-700 dark:text-slate-300 focus:text-white focus:bg-white/10">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" />
                Keep reminding
              </label>
              <Select value={repeatDays} onValueChange={setRepeatDays}>
                <SelectTrigger className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-card border-slate-200 dark:border-white/10">
                  {REPEAT_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-slate-700 dark:text-slate-300 focus:text-white focus:bg-white/10"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !dueDate}
           
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                Set Reminder
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
