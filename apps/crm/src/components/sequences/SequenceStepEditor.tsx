'use client';

import { useState, useEffect } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@crm-eco/ui/components/tabs';
import { cn } from '@crm-eco/ui/lib/utils';
import { Mail, Clock, GitBranch, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { SequenceStep, StepType } from '@/lib/sequences/types';

interface SequenceStepEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (step: Partial<SequenceStep>) => Promise<void>;
  step?: SequenceStep | null;
}

const STEP_TYPES: { value: StepType; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'email',
    label: 'Send Email',
    icon: <Mail className="w-5 h-5" />,
    description: 'Send an email to the contact',
  },
  {
    value: 'wait',
    label: 'Wait',
    icon: <Clock className="w-5 h-5" />,
    description: 'Wait for a period of time',
  },
  {
    value: 'condition',
    label: 'Condition',
    icon: <GitBranch className="w-5 h-5" />,
    description: 'Branch based on a condition',
  },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export function SequenceStepEditor({ open, onClose, onSave, step }: SequenceStepEditorProps) {
  const [saving, setSaving] = useState(false);
  const [stepType, setStepType] = useState<StepType>('email');
  const [formData, setFormData] = useState({
    name: '',
    delay_days: 0,
    delay_hours: 0,
    delay_minutes: 0,
    subject: '',
    body_html: '',
    body_text: '',
    from_name: '',
    from_email: '',
    send_time: '',
    send_days: [] as string[],
  });

  useEffect(() => {
    if (step) {
      setStepType(step.step_type);
      setFormData({
        name: step.name || '',
        delay_days: step.delay_days || 0,
        delay_hours: step.delay_hours || 0,
        delay_minutes: step.delay_minutes || 0,
        subject: step.subject || '',
        body_html: step.body_html || '',
        body_text: step.body_text || '',
        from_name: step.from_name || '',
        from_email: step.from_email || '',
        send_time: step.send_time || '',
        send_days: step.send_days || [],
      });
    } else {
      // Reset form for new step
      setStepType('email');
      setFormData({
        name: '',
        delay_days: 0,
        delay_hours: 0,
        delay_minutes: 0,
        subject: '',
        body_html: '',
        body_text: '',
        from_name: '',
        from_email: '',
        send_time: '',
        send_days: [],
      });
    }
  }, [step, open]);

  async function handleSave() {
    // Validation
    if (stepType === 'email' && !formData.subject.trim()) {
      toast.error('Please enter an email subject');
      return;
    }

    if (stepType === 'wait' && formData.delay_days === 0 && formData.delay_hours === 0 && formData.delay_minutes === 0) {
      toast.error('Please set a wait duration');
      return;
    }

    if (stepType === 'condition' && !formData.name.trim()) {
      toast.error('Please enter a condition name');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        step_type: stepType,
        ...formData,
      });
    } catch (error) {
      console.error('Error saving step:', error);
      toast.error('Failed to save step');
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(day: number) {
    const dayStr = String(day);
    setFormData(prev => ({
      ...prev,
      send_days: prev.send_days.includes(dayStr)
        ? prev.send_days.filter(d => d !== dayStr)
        : [...prev.send_days, dayStr].sort((a, b) => Number(a) - Number(b)),
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step ? 'Edit Step' : 'Add Step'}</DialogTitle>
          <DialogDescription>
            {step ? 'Update the step configuration' : 'Choose a step type and configure it'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step Type Selection */}
          {!step && (
            <div className="space-y-2">
              <Label>Step Type</Label>
              <div className="grid grid-cols-3 gap-3">
                {STEP_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setStepType(type.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all',
                      stepType === type.value
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    )}
                  >
                    <div className={cn(
                      'p-2 rounded-lg',
                      stepType === type.value
                        ? 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                    )}>
                      {type.icon}
                    </div>
                    <span className={cn(
                      'font-medium text-sm',
                      stepType === type.value
                        ? 'text-violet-900 dark:text-violet-100'
                        : 'text-slate-900 dark:text-white'
                    )}>
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Delay Settings */}
          <div className="space-y-2">
            <Label>Delay Before This Step</Label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Input
                  type="number"
                  min="0"
                  value={formData.delay_days}
                  onChange={(e) => setFormData({ ...formData, delay_days: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
                <span className="text-xs text-slate-500 mt-1 block">Days</span>
              </div>
              <div>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={formData.delay_hours}
                  onChange={(e) => setFormData({ ...formData, delay_hours: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
                <span className="text-xs text-slate-500 mt-1 block">Hours</span>
              </div>
              <div>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={formData.delay_minutes}
                  onChange={(e) => setFormData({ ...formData, delay_minutes: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
                <span className="text-xs text-slate-500 mt-1 block">Minutes</span>
              </div>
            </div>
          </div>

          {/* Email Step Configuration */}
          {stepType === 'email' && (
            <Tabs defaultValue="content" className="space-y-4">
              <TabsList>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Step Name (optional)</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Welcome Email, Follow-up #1"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject Line *</Label>
                  <Input
                    id="subject"
                    placeholder="Enter email subject..."
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">
                    Use merge fields: {'{{contact.first_name}}'}, {'{{contact.company}}'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body_html">Email Body</Label>
                  <Textarea
                    id="body_html"
                    placeholder="Write your email content here..."
                    value={formData.body_html}
                    onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    You can use HTML or plain text. Merge fields are supported.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="from_name">From Name</Label>
                  <Input
                    id="from_name"
                    placeholder="Leave blank to use default"
                    value={formData.from_name}
                    onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="from_email">From Email</Label>
                  <Input
                    id="from_email"
                    type="email"
                    placeholder="Leave blank to use default"
                    value={formData.from_email}
                    onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4">
                <div className="space-y-2">
                  <Label>Send Time (optional)</Label>
                  <Input
                    type="time"
                    value={formData.send_time}
                    onChange={(e) => setFormData({ ...formData, send_time: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">
                    Leave empty to send immediately when delay completes
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Send Days (optional)</Label>
                  <div className="flex gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={cn(
                          'w-10 h-10 rounded-lg text-sm font-medium transition-colors',
                          formData.send_days.includes(String(day.value))
                            ? 'bg-violet-500 text-white'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                        )}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Leave empty to send any day. Select specific days to restrict sending.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Wait Step Configuration */}
          {stepType === 'wait' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wait_name">Step Name (optional)</Label>
                <Input
                  id="wait_name"
                  placeholder="e.g., Wait 3 days"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <p className="text-sm text-slate-500">
                Configure the wait duration using the delay settings above.
              </p>
            </div>
          )}

          {/* Condition Step Configuration */}
          {stepType === 'condition' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="condition_name">Condition Name</Label>
                <Input
                  id="condition_name"
                  placeholder="e.g., Check if email opened"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                <p className="text-sm text-slate-500">
                  Condition configuration coming soon. Conditions allow branching based on:
                </p>
                <ul className="text-sm text-slate-500 mt-2 space-y-1">
                  <li>• Email opened/not opened</li>
                  <li>• Link clicked/not clicked</li>
                  <li>• Reply received</li>
                  <li>• Custom field values</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              step ? 'Update Step' : 'Add Step'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
