'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crm-eco/ui/components/card';
import { ArrowLeft, Loader2, Zap, Play, Users, Tag, GitBranch, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { TriggerType } from '@/lib/sequences/types';

const TRIGGER_OPTIONS: { value: TriggerType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'manual',
    label: 'Manual Enrollment',
    description: 'Manually enroll contacts into this sequence',
    icon: <Users className="w-5 h-5" />,
  },
  {
    value: 'on_create',
    label: 'When Record Created',
    description: 'Auto-enroll when a new record is created',
    icon: <Play className="w-5 h-5" />,
  },
  {
    value: 'on_stage_change',
    label: 'When Stage Changes',
    description: 'Auto-enroll when a deal moves to a specific stage',
    icon: <GitBranch className="w-5 h-5" />,
  },
  {
    value: 'on_tag_add',
    label: 'When Tag Added',
    description: 'Auto-enroll when a specific tag is added',
    icon: <Tag className="w-5 h-5" />,
  },
  {
    value: 'on_field_change',
    label: 'When Field Changes',
    description: 'Auto-enroll when a specific field value changes',
    icon: <Clock className="w-5 h-5" />,
  },
];

export default function NewSequencePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'manual' as TriggerType,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Please enter a sequence name');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create sequence');
      }

      const sequence = await response.json();
      toast.success('Sequence created');
      router.push(`/crm/sequences/${sequence.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create sequence');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/crm/sequences">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Create Email Sequence
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Set up an automated email sequence to nurture leads
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-500" />
              Sequence Details
            </CardTitle>
            <CardDescription>
              Give your sequence a name and description
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Sequence Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Welcome Series, Lead Nurturing"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the purpose of this sequence..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Trigger Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Enrollment Trigger</CardTitle>
            <CardDescription>
              Choose how contacts will be enrolled in this sequence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {TRIGGER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, trigger_type: option.value })}
                  className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                    formData.trigger_type === option.value
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    formData.trigger_type === option.value
                      ? 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {option.icon}
                  </div>
                  <div>
                    <p className={`font-medium ${
                      formData.trigger_type === option.value
                        ? 'text-violet-900 dark:text-violet-100'
                        : 'text-slate-900 dark:text-white'
                    }`}>
                      {option.label}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {option.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/crm/sequences">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Sequence'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
