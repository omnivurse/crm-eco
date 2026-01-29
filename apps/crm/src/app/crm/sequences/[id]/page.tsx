'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@crm-eco/ui/components/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  ArrowLeft,
  Play,
  Pause,
  MoreHorizontal,
  Settings,
  Users,
  BarChart3,
  Plus,
  Mail,
  Clock,
  GitBranch,
  Trash2,
  GripVertical,
  Pencil,
  Loader2,
  Zap,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { EmailSequence, SequenceStep, SequenceStatus, StepType } from '@/lib/sequences/types';
import { SequenceStepEditor } from '@/components/sequences/SequenceStepEditor';

interface SequenceWithDetails extends EmailSequence {
  steps: SequenceStep[];
  created_by_profile?: { full_name: string; avatar_url: string };
}

interface EnrollmentStats {
  total: number;
  active: number;
  completed: number;
  exited: number;
  paused: number;
}

function StatusBadge({ status }: { status: SequenceStatus }) {
  const config = {
    draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    active: { label: 'Active', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
    paused: { label: 'Paused', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
    archived: { label: 'Archived', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500' },
  };

  const { label, color } = config[status];

  return (
    <Badge variant="secondary" className={cn('font-medium', color)}>
      {label}
    </Badge>
  );
}

function StepTypeIcon({ type }: { type: StepType }) {
  switch (type) {
    case 'email':
      return <Mail className="w-4 h-4" />;
    case 'wait':
      return <Clock className="w-4 h-4" />;
    case 'condition':
      return <GitBranch className="w-4 h-4" />;
    default:
      return <Mail className="w-4 h-4" />;
  }
}

function StepCard({
  step,
  index,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  step: SequenceStep;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const getStepLabel = () => {
    switch (step.step_type) {
      case 'email':
        return step.name || step.subject || 'Email';
      case 'wait':
        const parts = [];
        if (step.delay_days) parts.push(`${step.delay_days}d`);
        if (step.delay_hours) parts.push(`${step.delay_hours}h`);
        if (step.delay_minutes) parts.push(`${step.delay_minutes}m`);
        return `Wait ${parts.join(' ') || '0m'}`;
      case 'condition':
        return step.name || 'Condition';
      default:
        return 'Step';
    }
  };

  const getDelayLabel = () => {
    const parts = [];
    if (step.delay_days) parts.push(`${step.delay_days} day${step.delay_days > 1 ? 's' : ''}`);
    if (step.delay_hours) parts.push(`${step.delay_hours} hour${step.delay_hours > 1 ? 's' : ''}`);
    if (step.delay_minutes) parts.push(`${step.delay_minutes} minute${step.delay_minutes > 1 ? 's' : ''}`);
    return parts.length > 0 ? `After ${parts.join(', ')}` : 'Immediately';
  };

  return (
    <div className="relative">
      {/* Connector Line */}
      {index > 0 && (
        <div className="absolute left-6 -top-6 w-0.5 h-6 bg-slate-200 dark:bg-slate-700" />
      )}

      <div className={cn(
        'border rounded-xl transition-all',
        isExpanded
          ? 'border-violet-500 bg-white dark:bg-slate-900'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-600'
      )}>
        <div className="flex items-center gap-3 p-4">
          {/* Drag Handle */}
          <button className="cursor-grab text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <GripVertical className="w-4 h-4" />
          </button>

          {/* Step Number */}
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
            step.step_type === 'email' && 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
            step.step_type === 'wait' && 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
            step.step_type === 'condition' && 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400'
          )}>
            <StepTypeIcon type={step.step_type} />
          </div>

          {/* Step Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900 dark:text-white truncate">
                {getStepLabel()}
              </span>
              {step.step_type !== 'wait' && (
                <span className="text-xs text-slate-500">
                  {getDelayLabel()}
                </span>
              )}
            </div>
            {step.step_type === 'email' && step.subject && (
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                Subject: {step.subject}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && step.step_type === 'email' && (
          <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
              <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                Preview:
              </div>
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: step.body_html || '<p>No content</p>' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SequenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sequence, setSequence] = useState<SequenceWithDetails | null>(null);
  const [stats, setStats] = useState<EnrollmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null);
  const [deleteStepId, setDeleteStepId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    loadSequence();
  }, [id]);

  async function loadSequence() {
    try {
      const response = await fetch(`/api/sequences/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Sequence not found');
          router.push('/crm/sequences');
          return;
        }
        throw new Error('Failed to load sequence');
      }

      const data = await response.json();
      setSequence(data.sequence);
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading sequence:', error);
      toast.error('Failed to load sequence');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(status: SequenceStatus) {
    if (!sequence) return;

    if (status === 'active' && (!sequence.steps || sequence.steps.length === 0)) {
      toast.error('Add at least one step before activating');
      return;
    }

    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/sequences/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      setSequence({ ...sequence, status });
      toast.success(`Sequence ${status === 'active' ? 'activated' : status === 'paused' ? 'paused' : 'updated'}`);
    } catch (error) {
      toast.error('Failed to update sequence status');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDeleteStep(stepId: string) {
    try {
      const response = await fetch(`/api/sequences/${id}/steps/${stepId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete step');

      setSequence(prev => prev ? {
        ...prev,
        steps: prev.steps.filter(s => s.id !== stepId),
      } : null);
      setDeleteStepId(null);
      toast.success('Step deleted');
    } catch (error) {
      toast.error('Failed to delete step');
    }
  }

  async function handleStepSave(step: Partial<SequenceStep>) {
    try {
      if (editingStep) {
        // Update existing step
        const response = await fetch(`/api/sequences/${id}/steps/${editingStep.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(step),
        });

        if (!response.ok) throw new Error('Failed to update step');

        const updatedStep = await response.json();
        setSequence(prev => prev ? {
          ...prev,
          steps: prev.steps.map(s => s.id === editingStep.id ? updatedStep : s),
        } : null);
        toast.success('Step updated');
      } else {
        // Create new step
        const response = await fetch(`/api/sequences/${id}/steps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(step),
        });

        if (!response.ok) throw new Error('Failed to create step');

        const newStep = await response.json();
        setSequence(prev => prev ? {
          ...prev,
          steps: [...prev.steps, newStep],
        } : null);
        toast.success('Step added');
      }

      setEditingStep(null);
      setAddStepOpen(false);
    } catch (error) {
      toast.error(editingStep ? 'Failed to update step' : 'Failed to create step');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!sequence) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/crm/sequences">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {sequence.name}
              </h1>
              <StatusBadge status={sequence.status} />
            </div>
            {sequence.description && (
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                {sequence.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sequence.status === 'active' ? (
            <Button
              variant="outline"
              onClick={() => handleStatusChange('paused')}
              disabled={updatingStatus}
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          ) : sequence.status !== 'archived' ? (
            <Button
              onClick={() => handleStatusChange('active')}
              disabled={updatingStatus}
            >
              <Play className="w-4 h-4 mr-2" />
              Activate
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toast.info('Sequence settings coming soon')}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleStatusChange('archived')}
                className="text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Archive Sequence
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-sm">Total Enrolled</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-500 mb-1">
              <Play className="w-4 h-4" />
              <span className="text-sm">Active</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.active}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-500 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">Completed</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.completed}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <Pause className="w-4 h-4" />
              <span className="text-sm">Paused</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.paused}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Exited</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.exited}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="steps" className="space-y-6">
        <TabsList>
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="steps" className="space-y-4">
          {/* Steps Builder */}
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Sequence Steps
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {sequence.steps.length} step{sequence.steps.length !== 1 ? 's' : ''} in this sequence
                </p>
              </div>
              <Button onClick={() => setAddStepOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Step
              </Button>
            </div>

            {sequence.steps.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                <Zap className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No steps yet
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  Add your first step to start building this sequence
                </p>
                <Button onClick={() => setAddStepOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Step
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {sequence.steps.map((step, index) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    index={index}
                    isExpanded={expandedStep === step.id}
                    onToggle={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                    onEdit={() => setEditingStep(step)}
                    onDelete={() => setDeleteStepId(step.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="enrollments">
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                Enrollments
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                View and manage contacts enrolled in this sequence
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                Analytics
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                Performance metrics for this sequence will appear here
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Step Dialog */}
      <SequenceStepEditor
        open={addStepOpen || !!editingStep}
        onClose={() => {
          setAddStepOpen(false);
          setEditingStep(null);
        }}
        onSave={handleStepSave}
        step={editingStep}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteStepId} onOpenChange={() => setDeleteStepId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Step</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this step? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStepId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteStepId && handleDeleteStep(deleteStepId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
